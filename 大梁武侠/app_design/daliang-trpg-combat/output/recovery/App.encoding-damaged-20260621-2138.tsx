import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyOutcome,
  canDeclareAction,
  changeMomentum,
  commitDiceRollResults,
  confirmInitiative,
  declareAction,
  dmOverride,
  endRound,
  enterScene,
  equipItem,
  expireSource,
  formMove,
  prepareCombatRound,
  regulateBreath,
  resolveInterceptSuccess,
  resolveReact,
  unequipItem,
  useInventoryItem,
  useReflection,
  visibleForLanPublic,
  visibleForPlayer,
} from "../combat/combatEngine";
import {
  clearAppSession,
  clearCombatState,
  loadAppSession,
  loadCombatState,
  saveAppSession,
  saveCombatState,
} from "../combat/storage";
import type { Actor, AppSession, CombatState, DistanceBand, InventoryCategory, InventoryItem, MoveTiming, QiDie, QiZone, ShiCondition, ShiState, SixRootName, StatusEffect, StatusName } from "../combat/types";
import { createLanClient, type LanClient, type LanConnectionStatus } from "../net/lanClient";
import type { LanMessage } from "../rules/schema";
import { PhaserCombatBoard } from "../game/PhaserCombatBoard";
import type { CombatBoardSnapshot } from "../game/combatScene";
import { QiDiceTray } from "../dice3d/QiDiceTray";
import type { DiceRollResult } from "../dice3d/diceTypes";
import { ruleCatalog } from "../rules/ruleCatalog";

const zoneLabels: Record<QiZone, string> = {
  QI_POOL: "姘旀睜",
  QI_SEA: "姘旀捣",
  QI_LOCK: "閿佹皵",
  QI_REST: "鎭簱",
  TEMP_QI: "涓存皵鍖",
  YIN_SLOT: "闃存Ы",
  YANG_SLOT: "闃虫Ы",
};

const zoneOrder: QiZone[] = ["QI_POOL", "QI_SEA", "QI_LOCK", "QI_REST", "TEMP_QI", "YIN_SLOT", "YANG_SLOT"];

const categoryLabels: Record<InventoryCategory, string> = {
  weapon: "姝﹀櫒",
  armor: "鎶ょ敳",
  accessory: "浣╅グ",
  tool: "鍣ㄥ叿",
  medicine: "鑽墿",
  mount: "鍧愰獞",
  document: "鏂囦功",
  misc: "鏉傜墿",
};

const iconMap = {
  character: "/assets/icons/png128/001_player_character_瑙掕壊.png",
  inventory: "/assets/icons/png128/002_inventory_鑳屽寘.png",
  combat: "/assets/icons/png128/006_combat_浜ら攱.png",
  qi: "/assets/icons/png128/009_qi_dice_姘旈.png",
  response: "/assets/icons/png128/008_response_鍝嶅簲.png",
  momentum: "/assets/icons/png128/011_momentum_鍔?png",
  dm: "/assets/icons/png128/040_dm_tools_DM宸ュ叿.png",
  world: "/assets/icons/png128/005_world_涓栫晫.png",
};

type DrawerId =
  | "character"
  | "sixRoots"
  | "innerArt"
  | "inventory"
  | "moves"
  | "statuses"
  | "logs"
  | "library"
  | "settings"
  | "dmEnemies"
  | "dmDistance"
  | "dmRuling"
  | "dmHidden"
  | "dmScene"
  | "dmLog";

export function App() {
  const [state, setState] = useState<CombatState>(() => loadCombatState());
  const [session, setSession] = useState<AppSession>(() => loadAppSession());
  const [selectedTargetId, setSelectedTargetId] = useState("enemy-short-blade");
  const [selectedMoveId, setSelectedMoveId] = useState("move-rain-step-cut");
  const [selectedDice, setSelectedDice] = useState<string[]>([]);
  const [slotDice, setSlotDice] = useState<{ yin: string[]; yang: string[] }>({ yin: [], yang: [] });
  const [slotHint, setSlotHint] = useState("");
  const [dmNote, setDmNote] = useState("闆ㄥ娍鍔犻噸锛屽贰妫€鐏妸宸茬粡鍒版ˉ澶淬€");
  const [debugView, setDebugView] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<DrawerId | null>(null);
  const [lanUrl, setLanUrl] = useState("ws://localhost:8787");
  const [lanStatus, setLanStatus] = useState<LanConnectionStatus>("idle");
  const [lanDetail, setLanDetail] = useState("");
  const [lanHostReady, setLanHostReady] = useState(false);
  const [rollDice, setRollDice] = useState<QiDie[] | null>(null);
  const [prompt, setPrompt] = useState<{ title: string; message: string } | null>(null);
  const [autoRollKey, setAutoRollKey] = useState(0);
  const [autoRollOnEnter, setAutoRollOnEnter] = useState(true);
  const [windowTimerDuration, setWindowTimerDuration] = useState(15);
  const lanClientRef = useRef<LanClient | null>(null);

  // --- Timer system for intercept/react windows ---
  const [windowTimer, setWindowTimer] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerExpiredRef = useRef(false);
  const [recentlyRestoredDiceIds, setRecentlyRestoredDiceIds] = useState<string[]>([]);

  function startWindow(seconds: number) {
    timerExpiredRef.current = false;
    setWindowTimer(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setWindowTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          timerExpiredRef.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function clearWindowTimer() {
    timerExpiredRef.current = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setWindowTimer(0);
  }

  function skipWindow() {
    clearWindowTimer();
    if (state.phase === "intercept_window") {
      patch((current) => formMove(current));
    } else if (state.phase === "react_window") {
      patch((current) => applyOutcome(current));
    }
  }

  function respondInWindow(responderId: string, responseId: string) {
    const pending = state.pendingAction;
    const lockedDiceIds = pending?.diceIds ?? [];
    clearWindowTimer();
    if (state.phase === "intercept_window") {
      const dieId = pickFirstSeaDie(responderId);
      if (!dieId) return;
      patch((current) => resolveInterceptSuccess(current, responderId, responseId, [dieId]));
      setRecentlyRestoredDiceIds(lockedDiceIds);
      setTimeout(() => setRecentlyRestoredDiceIds([]), 700);
    } else if (state.phase === "react_window") {
      const respDieId = pickFirstSeaDie(responderId);
      if (!respDieId) return;
      patch((current) => resolveReact(current, responderId, responseId, [respDieId]));
    }
  }

  // Watch phase changes to start window timers
  const prevPhaseRef = useRef(state.phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = state.phase;
    if (prev === state.phase) return;
    if (state.phase === "intercept_window" || state.phase === "react_window") {
      startWindow(windowTimerDuration);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setWindowTimer(0);
    }
  }, [state.phase]);

  // Auto-advance when timer expires naturally
  useEffect(() => {
    if (windowTimer !== 0) return;
    if (!timerExpiredRef.current) return;
    timerExpiredRef.current = false;
    if (state.phase === "intercept_window") {
      patch((current) => formMove(current));
    } else if (state.phase === "react_window") {
      patch((current) => applyOutcome(current));
    }
  }, [windowTimer]);

  const playerActorId = session.selectedActorId "? "pc-shen-qing";
  const playerState = useMemo(() => visibleForPlayer(state, playerActorId), [state, playerActorId]);
  const currentActor = state.actors.find((actor) => actor.id === playerActorId) ?? state.actors[0];

  useEffect(() => saveCombatState(state), [state]);
  useEffect(() => saveAppSession(session), [session]);

  useEffect(() => {
    if (session.identity !== "dm" || lanStatus !== "connected" || !lanHostReady) return;
    lanClientRef.current?.send("public_state_synced", { publicState: visibleForLanPublic(state) });
  }, [state, session.identity, lanStatus, lanHostReady]);

  useEffect(() => {
    if (!currentActor.moves.some((move) => move.id === selectedMoveId)) {
      setSelectedMoveId(currentActor.moves[0]?.id "? "");
    }
  }, [currentActor, selectedMoveId]);

  useEffect(() => {
    if (session.identity !== "dm" || session.gameMode !== "combat") return;
    const activeActor = state.actors.find((actor) => actor.id === state.activeActorId);
    if (activeActor && !activeActor.moves.some((move) => move.id === selectedMoveId)) {
      setSelectedMoveId(activeActor.moves[0]?.id "? "");
    }
  }, [session.identity, session.gameMode, state.activeActorId, state.actors, selectedMoveId]);

  function patch(updater: (current: CombatState) => CombatState) {
    setState((current) => updater(current));
    setSelectedDice([]);
    setSlotDice({ yin: [], yang: [] });
  }

  function enterCombatRoute(route: "playerCombat" | "dmCombat", patchSession: Partial<AppSession> = {}) {
    patch((current) => prepareCombatRound(current));
    go(route, { ...patchSession, gameMode: "combat" });
  }

  function confirmInitiativeAndRoll() {
    patch((current) => confirmInitiative(current));
    setAutoRollKey((value) => value + 1);
  }

  function go(route: AppSession["route"], patchSession: Partial<AppSession> = {}) {
    setSession((current) => ({ ...current, ...patchSession, route }));
    setActiveDrawer(null);
  }

  function resetAll() {
    setState(clearCombatState());
    setSession(clearAppSession());
    setSelectedDice([]);
  }

  function enterAs(identity: "dm" | "player" | "spectator") {
    if (identity === "dm") {
      go("dmScene", { identity, gameMode: "scene" });
    } else {
      go("characterSelect", { identity, gameMode: "scene" });
    }
  }

  function startLanRoom() {
    const roomCode = /^LAN-[A-Z0-9]{4}$/.test(session.roomCode) ? session.roomCode : generateLanRoomCode();
    setSession((current) => ({ ...current, roomCode, identity: "dm" }));
    lanClientRef.current?.close();
    setLanHostReady(false);
    const client = createLanClient({
      url: lanUrl,
      roomCode,
      senderId: `dm-${session.room.hostName || "host"}`,
      onMessage: handleLanMessage,
      onStatus: (status, detail) => {
        setLanStatus(status);
        setLanDetail(detail "? "");
      },
    });
    lanClientRef.current = client;
    client.connect();
    window.setTimeout(() => {
      const sent = client.send("room_created", { room: session.room, seats: session.seats, publicState: visibleForLanPublic(state) });
      if (sent) setLanHostReady(true);
    }, 250);
  }

  function joinLanRoom() {
    lanClientRef.current?.close();
    setLanHostReady(false);
    const client = createLanClient({
      url: lanUrl,
      roomCode: session.roomCode,
      senderId: `player-${session.playerName || "guest"}`,
      onMessage: handleLanMessage,
      onStatus: (status, detail) => {
        setLanStatus(status);
        setLanDetail(detail "? "");
      },
    });
    lanClientRef.current = client;
    client.connect();
    window.setTimeout(() => client.send("room_joined", { playerName: session.playerName, actorId: session.selectedActorId }), 250);
  }

  function handleLanMessage(message: LanMessage) {
    setLanDetail(`鏀跺埌 ${message.type}`);
    if (session.identity === "dm" || message.type !== "public_state_synced") return;
    const publicState = readLanPublicState(message.payload);
    if (publicState) {
      setState((current) => mergeLanPublicState(current, publicState));
    }
  }

  function toggleDie(dieId: string) {
    const die = state.dice.find((item) => item.id === dieId);
    if (session.identity === "player" && die?.ownerId !== playerActorId) {
      patch((current) => dmOverride(current, "鐜╁涓嶈兘鎿嶄綔闈炴湰浜烘皵楠般€"));
      return;
    }
    setSelectedDice((current) => (current.includes(dieId) ? current.filter((id) => id !== dieId) : [...current, dieId]));
  }

  function assignDieToSlot(dieId: string, slot: "yin" | "yang") {
    const die = state.dice.find((item) => item.id === dieId);
    const legality = canDragDieToSlot(state, die, die?.ownerId ?? state.activeActorId, slot);
    if (!legality.allowed) {
      const message = legality.reason "? "姝ら褰撳墠涓嶅彲鏀惧叆璇ユЫ浣?;
      setSlotHint(message);
      setPrompt({ title: "涓嶅彲鎶曞叆妲戒綅", message });
      window.setTimeout(() => setSlotHint(""), 1600);
      return;
    }
    if (!die) return;
    if (session.identity === "player" && die.ownerId !== playerActorId) {
      setSlotHint("鐜╁鍙兘鎿嶄綔鑷繁鐨勬皵楠");
      setPrompt({ title: "鏉冮檺涓嶈冻", message: "鐜╁鍙兘鎿嶄綔鑷繁鐨勬皵楠般€? });
      window.setTimeout(() => setSlotHint(""), 1600);
      return;
    }
    setSlotDice((current) => {
      const without = {
        yin: current.yin.filter((id) => id !== dieId),
        yang: current.yang.filter((id) => id !== dieId),
      };
      return { ...without, [slot]: [...without[slot], dieId] };
    });
    setSelectedDice((current) => (current.includes(dieId) ? current : [...current, dieId]));
  }

  function pickFirstSeaDie(ownerId: string) {
    return state.dice.find((die) => die.ownerId === ownerId && die.zone === "QI_SEA")?.id;
  }

  function declareFor(actorId: string, targetId: string, moveId: string) {
    if (session.identity === "player" && actorId !== playerActorId) {
      patch((current) => dmOverride(current, "鐜╁鍙兘瀹ｈ█鑷繁鐨勮鑹层€"));
      return;
    }
    const slottedDice = [...slotDice.yin, ...slotDice.yang];
    const diceToUse = slottedDice.length > 0 ? slottedDice : selectedDice;
    const availability = canDeclareAction(state, actorId, moveId, {
      yinSlotDiceIds: slotDice.yin,
      yangSlotDiceIds: slotDice.yang,
    }, diceToUse);
    if (!availability.allowed) {
      const message = displayActionReasons(availability.reasons);
      setPrompt({ title: "瀹ｈ█涓嶅彲鐢", message });
      patch((current) => dmOverride(current, `瀹ｈ█涓嶅彲鐢細${message}`));
      return;
    }
    if (diceToUse.length === 0) {
      setPrompt({ title: "闇€瑕佹皵楠", message: "闇€瑕佸厛閫夋嫨鎴栨嫋鍏ヨ嚦灏戜竴鏋氬彲鐢ㄦ皵楠般€? });
      patch((current) => dmOverride(current, "闇€瑕佸厛閫夋嫨鑷冲皯涓€鏋氬彲鐢ㄦ皵楠般€"));
      return;
    }
    patch((current) =>
      declareAction(current, actorId, targetId, moveId, diceToUse, {
        yinSlotDiceIds: slotDice.yin,
        yangSlotDiceIds: slotDice.yang,
      }),
    );
  }

  function interceptPending() {
    const pending = state.pendingAction;
    if (!pending) return;
    const responder = state.actors.find((actor) => actor.id === pending.targetId);
    const response = responder?.responses.find((item) => item.responseType === "鎴嚮");
    const dieId = responder ? pickFirstSeaDie(responder.id) : undefined;
    if (!responder || !response || !dieId) {
      patch((current) => dmOverride(current, "褰撳墠娌℃湁鍙敤鎴嚮鎸傝浇鎴栨皵楠般€"));
      return;
    }
    const lockedDiceIds = pending.diceIds ?? [];
    patch((current) => resolveInterceptSuccess(current, responder.id, response.id, [dieId]));
    setRecentlyRestoredDiceIds(lockedDiceIds);
    setTimeout(() => setRecentlyRestoredDiceIds([]), 700);
  }

  function reactPending() {
    const pending = state.pendingAction;
    if (!pending) return;
    const responder = state.actors.find((actor) => actor.id === pending.targetId);
    const response = responder?.responses.find((item) => item.responseType === "搴旀嫑");
    const dieId = responder ? pickFirstSeaDie(responder.id) : undefined;
    if (!responder || !response || !dieId) {
      patch((current) => dmOverride(current, "褰撳墠娌℃湁鍙敤搴旀嫑鎸傝浇鎴栨皵楠般€"));
      return;
    }
    patch((current) => resolveReact(current, responder.id, response.id, [dieId]));
  }

  function handleMomentumChange(momentum: ShiState) {
    const activeId = state.activeActorId;
    patch((current) => changeMomentum(current, activeId, momentum));
  }

  const common = {
    state,
    playerState,
    session,
    selectedDice,
    slotDice,
    slotHint,
    selectedTargetId,
    selectedMoveId,
    debugView,
    setDebugView,
    setSelectedTargetId,
    setSelectedMoveId,
    activeDrawer,
    setActiveDrawer,
    toggleDie,
    assignDieToSlot,
    setSlotDice,
    setRollDice,
    declareFor,
    patch,
    go,
    windowTimer,
    windowTimerDuration,
    setWindowTimerDuration,
    autoRollOnEnter,
    setAutoRollOnEnter,
    onSkipWindow: skipWindow,
    onRespond: respondInWindow,
    recentlyRestoredDiceIds,
    autoRollKey,
  };

  return (
    <main className="app-shell">
      {(session.route === "playerScene" || session.route === "playerCombat" || session.route === "dmScene" || session.route === "dmCombat") ? (
        <Topbar
          session={session}
          debugView={debugView}
          setDebugView={setDebugView}
          activeDrawer={activeDrawer}
          setActiveDrawer={setActiveDrawer}
          onHome={() => go("home")}
          onReset={resetAll}
        />
      ) : null}
      {session.route === "home" ? <HomeScreen go={go} /> : null}
      {session.route === "characterSelect" ? <CharacterSelect state={state} session={session} setSession={setSession} go={go} patch={patch} /> : null}
      {session.route === "createRoom" || session.route === "room" ? (
        <CreateRoomPage session={session} setSession={setSession} go={go} lanUrl={lanUrl} setLanUrl={setLanUrl} lanStatus={lanStatus} lanDetail={lanDetail} startLanRoom={startLanRoom} />
      ) : null}
      {session.route === "joinRoom" ? (
        <JoinRoomPage state={state} session={session} setSession={setSession} go={go} enterAs={enterAs} lanUrl={lanUrl} setLanUrl={setLanUrl} lanStatus={lanStatus} lanDetail={lanDetail} joinLanRoom={joinLanRoom} />
      ) : null}
      {session.route === "roomWaiting" ? (
        <RoomWaitingPage state={state} session={session} setSession={setSession} go={go} />
      ) : null}
      {session.route === "characterAssign" ? (
        <CharacterAssignPage state={state} session={session} setSession={setSession} enterAs={enterAs} go={go} />
      ) : null}
      {session.route === "playerScene" ? (
        <PlayerSceneDesk
          {...common}
          state={debugView && session.developerMode ? state : playerState}
          rawState={state}
          actorId={playerActorId}
          onEnterCombat={() => enterCombatRoute("playerCombat")}
          onStartScene={() => patch((current) => enterScene(current))}
        />
      ) : null}
      {session.route === "playerCombat" || session.route === "player" ? (
        <PlayerCombatDesk
          {...common}
          state={debugView && session.developerMode ? state : playerState}
          rawState={state}
          actorId={playerActorId}
          onStartScene={() => patch((current) => enterScene(current))}
          onForm={() => patch((current) => formMove(current))}
          onReact={reactPending}
          onOutcome={() => patch((current) => applyOutcome(current))}
          onRegulateBreath={() => regulateFirstRestDie(patch, state, playerActorId)}
          onReflection={() => patch((current) => useReflection(current, playerActorId))}
        />
      ) : null}
      {session.route === "dmScene" ? (
        <DmSceneDesk
          {...common}
          dmNote={dmNote}
          setDmNote={setDmNote}
          onStartScene={() => patch((current) => enterScene(current))}
          onEnterCombat={() => enterCombatRoute("dmCombat")}
          onOverride={() => patch((current) => dmOverride(current, dmNote, true))}
        />
      ) : null}
      {session.route === "dmCombat" || session.route === "dm" ? (
        <DmCombatDesk
          {...common}
          dmNote={dmNote}
          setDmNote={setDmNote}
          onStartScene={confirmInitiativeAndRoll}
          onIntercept={interceptPending}
          onForm={() => patch((current) => formMove(current))}
          onReact={reactPending}
          onOutcome={() => patch((current) => applyOutcome(current))}
          onEndRound={() => patch((current) => endRound(current))}
          onMomentum={handleMomentumChange}
          onRegulateBreath={() => regulateFirstRestDie(patch, state, playerActorId)}
          onReflection={() => patch((current) => useReflection(current, playerActorId))}
          onExpireSource={() => patch((current) => expireSource(current, "鐭叺瀹⒙烽洦姝"))}
          onOverride={() => patch((current) => dmOverride(current, dmNote, true))}
        />
      ) : null}
      {session.route === "library" || session.route === "packs" || session.route === "settings" ? (
        <PlaceholderPage session={session} go={go} />
      ) : null}
      {/* QiDiceRollOverlay disabled 鈥?dice rolling is now inline in QiZoneBoard.
          The 3D overlay component is kept for potential future re-enablement.
      {rollDice ? (
        <QiDiceRollOverlay
          dice={rollDice}
          onClose={() => setRollDice(null)}
          onConfirm={(results: DiceRollResult[]) => {
            patch((current) => commitDiceRollResults(current, results));
            setRollDice(null);
          }}
        />
      ) : null} */}
      {prompt ? <PromptModal title={prompt.title} message={prompt.message} onClose={() => setPrompt(null)} /> : null}
    </main>
  );
}

function readLanPublicState(payload: unknown): CombatState | undefined {
  if (!isRecord(payload) || !isCombatStateLike(payload.publicState)) return undefined;
  return payload.publicState;
}

function mergeLanPublicState(current: CombatState, incoming: CombatState): CombatState {
  return {
    ...current,
    campaignName: incoming.campaignName,
    sceneName: incoming.sceneName,
    sceneGoal: incoming.sceneGoal,
    round: incoming.round,
    phase: incoming.phase,
    activeActorId: incoming.activeActorId,
    actors: incoming.actors,
    tracks: incoming.tracks,
    distances: incoming.distances,
    pendingAction: incoming.pendingAction,
    logs: incoming.logs,
    lastSavedAt: incoming.lastSavedAt,
    dice: current.dice,
  };
}

function isCombatStateLike(value: unknown): value is CombatState {
  return (
    isRecord(value) &&
    typeof value.campaignName === "string" &&
    typeof value.sceneName === "string" &&
    typeof value.sceneGoal === "string" &&
    typeof value.round === "number" &&
    typeof value.phase === "string" &&
    typeof value.activeActorId === "string" &&
    Array.isArray(value.actors) &&
    Array.isArray(value.tracks) &&
    Array.isArray(value.distances) &&
    Array.isArray(value.logs)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getActiveMomentum(state: CombatState): ShiState {
  return state.actors.find((a) => a.id === state.activeActorId)?.momentum "? "鍚堝娍";
}

function Topbar({
  session,
  debugView,
  setDebugView,
  activeDrawer,
  setActiveDrawer,
  onHome,
  onReset,
}: {
  session: AppSession;
  debugView: boolean;
  setDebugView: (value: boolean) => void;
  activeDrawer: DrawerId | null;
  setActiveDrawer: (value: DrawerId | null) => void;
  onHome: () => void;
  onReset: () => void;
}) {
  const role = session.identity === "dm" ? "dm" : "player";
  const playerItems: DrawerId[] = ["character", "sixRoots", "innerArt", "inventory", "moves", "statuses", "logs", "library", "settings"];
  const dmItems: DrawerId[] = ["dmEnemies", "dmDistance", "dmHidden", "dmRuling", "dmScene", "dmLog", "library", "settings"];
  const items = role === "dm" ? dmItems : playerItems;

  return (
    <header className="topbar compact app-tool-topbar">
      <div className="topbar-left">
        <strong className="topbar-brand">澶ф姹熸箹</strong>
        <span className="identity-pill">{role === "dm" ? "DM" : "鐜╁"}</span>
      </div>
      <div className="topbar-center">
        {items.map((item) => (
          <button
            key={item}
            className={activeDrawer === item ? "active" : ""}
            type="button"
            onClick={() => setActiveDrawer(activeDrawer === item ? null : item)}
          >
            {drawerShortTitle(item)}
          </button>
        ))}
      </div>
      <div className="topbar-right">
        {session.developerMode ? (
          <button type="button" onClick={() => setDebugView(!debugView)}>
            {debugView ? "鍏抽棴璋冭瘯" : "璋冭瘯"}
          </button>
        ) : null}
        <button type="button" onClick={onHome}>杩斿洖棣栭〉</button>
        <button type="button" onClick={onReset}>閲嶇疆</button>
      </div>
    </header>
  );
}

function HomeScreen({ go }: { go: (route: string) => void }) {
  return (
    <section className="home-screen">
      <div className="home-hero">
        {/* ART SLOT: home-logo 鈥?400脳160 澶ф姹熸箹姣涚瑪涔︽硶鏍囬锛屽甫鏈辩爞鍗扮珷 */}
        <h1 style={{ fontSize: 48, marginBottom: 8, color: "var(--ink-light)", textAlign: "center" }}>澶ф姹熸箹</h1>
        <p className="eyebrow" style={{ textAlign: "center", fontSize: 16 }}>鍐呮祴绗竴鐗?路 妗ラ櫟闆ㄥ</p>
        <div className="home-actions" style={{ marginTop: 48, flexDirection: "column", gap: 14 }}>
          <button className="primary-action" type="button" onClick={() => go("createRoom")} style={{ minWidth: 280 }}>
            鍒涘缓鎴块棿锛圖M锛"          </button>
          <button type="button" onClick={() => go("joinRoom")} style={{ minWidth: 280 }}>
            鍔犲叆鎴块棿锛堢帺瀹讹級
          </button>
          <button type="button" onClick={() => go("characterSelect")} style={{ minWidth: 280 }}>
            鏈湴婕斾範
          </button>
        </div>
        <p className="hint" style={{ marginTop: 32, textAlign: "center" }}>v0.1 鍐呮祴鐗?鈥?閫夋嫨"鏈湴婕斾範"鐩存帴寮€鍗¤繘鍏?/p>
      </div>
    </section>
  );
}

function CharacterSelect({
  state,
  session,
  setSession,
  go,
  patch,
}: {
  state: CombatState;
  session: AppSession;
  setSession: React.Dispatch<React.SetStateAction<AppSession>>;
  go: (route: AppSession["route"], patchSession": Partial<AppSession>) => void;
  patch: (updater: (current: CombatState) => CombatState) => void;
}) {
  const playerActors = state.actors.filter((actor) => actor.side === "player");

  function selectCharacter(actorId: string) {
    setSession((current) => ({ ...current, selectedActorId: actorId, identity: "player" }));
    go("playerScene", { identity: "player", gameMode: "scene" });
    patch((current) => enterScene(current));
  }

  return (
    <section className="home-screen">
      <div className="home-hero panel">
        <p className="eyebrow">閫夋嫨瑙掕壊</p>
        <h2>浠ヨ皝鐨勮韩浠借笍鍏ユ睙婀栵紵</h2>
        <div className="character-select-grid">
          {playerActors.map((actor) => (
            <div className="character-select-card" key={actor.id}>
              <UnitCard actor={actor} mode="self" />
              <button
                className="primary-action"
                type="button"
                style={{ marginTop: 10, width: "100%" }}
                onClick={() => selectCharacter(actor.id)}
              >
                浠ャ€寋actor.name}銆嶈繘鍏"              </button>
            </div>
          ))}
        </div>
        <div className="home-actions" style={{ marginTop: 18 }}>
          <button type="button" onClick={() => go("home")}>
            杩斿洖棣栭〉
          </button>
          <button type="button" onClick={() => go("library")}>
            璧勬枡搴"          </button>
        </div>
      </div>
    </section>
  );
}

function CreateRoomPage({
  session,
  setSession,
  go,
  lanUrl,
  setLanUrl,
  lanStatus,
  lanDetail,
  startLanRoom,
}: {
  session: AppSession;
  setSession: React.Dispatch<React.SetStateAction<AppSession>>;
  go: (route: AppSession["route"], patchSession": Partial<AppSession>) => void;
  lanUrl: string;
  setLanUrl: (value: string) => void;
  lanStatus: LanConnectionStatus;
  lanDetail: string;
  startLanRoom: () => void;
}) {
  function updateRoom(key: keyof AppSession["room"], value: string | boolean | number) {
    setSession((current) => ({ ...current, room: { ...current.room, [key]: value } }));
  }

  return (
    <section className="room-grid">
      <div className="panel">
        <h2>鍒涘缓鎴块棿</h2>
        <label>
          鎴块棿鍚?          <input value={session.room.roomName} onChange={(event) => updateRoom("roomName", event.target.value)} />
        </label>
        <label>
          涓绘寔浜哄悕绉?          <input value={session.room.hostName} onChange={(event) => updateRoom("hostName", event.target.value)} />
        </label>
        <label>
          鍥㈠寘
          <select value={session.room.campaignId} onChange={(event) => updateRoom("campaignId", event.target.value)}>
            <option value="bridge-rain">妗ラ櫟闀囬洦澶滃け闀?/option>
          </select>
        </label>
        <label>
          浜烘暟涓婇檺
          <input
            type="number"
            min={1}
            max={8}
            value={session.room.maxPlayers}
            onChange={(event) => updateRoom("maxPlayers", Number(event.target.value))}
          />
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={session.room.allowSpectators}
            onChange={(event) => updateRoom("allowSpectators", event.target.checked)}
          />
          鍏佽鏃佽
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={session.developerMode}
            onChange={(event) => setSession((current) => ({ ...current, developerMode: event.target.checked }))}
          />
          寮€鍙戞ā寮"        </label>
        <button className="primary-action" type="button" onClick={() => go("roomWaiting", { identity: "dm" })}>
          浠?DM 韬唤寮€鎴"        </button>
      </div>

      <div className="panel">
        <h2>鍥㈠寘閫夋嫨</h2>
        <p><strong>褰撳墠鍥㈠寘锛?/strong>妗ラ櫟闀囬洦澶滃け闀?/p>
        <p>绫诲瀷锛氭儏鏅?/ 浜ら攱鏍蜂緥銆傛帹鑽?1-4 浜猴紝棰勮 60-90 鍒嗛挓銆?/p>
        <p className="hint">鏈疆淇濈暀鏍蜂緥鍥㈠寘鍏ュ彛锛屽悗缁啀鎺ュ叆瀵煎叆鍜岀増鏈鐞嗐€?/p>
        <div className="split-actions">
          <button type="button" onClick={() => go("home")}>
            杩斿洖
          </button>
          <button type="button" onClick={() => go("joinRoom")}>
            鏀逛负鍔犲叆鎴块棿
          </button>
        </div>
        <div className="lan-box">
          <h3>灞€鍩熺綉棰勫</h3>
          <p className="hint">鍏堝湪鎴夸富鐢佃剳杩愯 <code>npm.cmd run dev:lan</code>锛屽啀鐐瑰嚮寮€鍚眬鍩熺綉鎴块棿銆?/p>
          <label>
            鎴夸富 WebSocket 鍦板潃
            <input value={lanUrl} onChange={(event) => setLanUrl(event.target.value)} />
          </label>
          <p>鎴块棿鐮侊細{session.roomCode}</p>
          <p>杩炴帴鐘舵€侊細{lanStatus}{lanDetail ? ` 路 ${lanDetail}` : ""}</p>
          <button type="button" onClick={startLanRoom}>寮€鍚眬鍩熺綉鎴块棿</button>
        </div>
      </div>
    </section>
  );
}

function JoinRoomPage({
  state,
  session,
  setSession,
  enterAs,
  go,
  lanUrl,
  setLanUrl,
  lanStatus,
  lanDetail,
  joinLanRoom,
}: {
  state: CombatState;
  session: AppSession;
  setSession: React.Dispatch<React.SetStateAction<AppSession>>;
  enterAs: (identity: "dm" | "player" | "spectator") => void;
  go: (route: AppSession["route"], patchSession": Partial<AppSession>) => void;
  lanUrl: string;
  setLanUrl: (value: string) => void;
  lanStatus: LanConnectionStatus;
  lanDetail: string;
  joinLanRoom: () => void;
}) {
  return (
    <section className="room-grid">
      <div className="panel">
        <h2>鍔犲叆鎴块棿</h2>
        <label>
          鎴块棿鐮?/ 鏈湴鎴块棿
          <input value={session.roomCode} onChange={(event) => setSession((current) => ({ ...current, roomCode: event.target.value }))} />
        </label>
        <label>
          鐜╁鍚嶇О
          <input value={session.playerName} onChange={(event) => setSession((current) => ({ ...current, playerName: event.target.value }))} />
        </label>
      </div>
      <div className="panel">
        <h2>瑙掕壊閫夋嫨</h2>
        <label>
          閫夋嫨瑙掕壊
          <select value={session.selectedActorId} onChange={(event) => setSession((current) => ({ ...current, selectedActorId: event.target.value }))}>
            {state.actors.filter((actor) => actor.side === "player").map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
          </select>
        </label>
        <div className="split-actions">
          <button type="button" onClick={() => go("home")}>杩斿洖</button>
          <button className="primary-action" type="button" onClick={() => enterAs("player")}>浠ョ帺瀹惰韩浠借繘鍏?/button>
          <button type="button" onClick={() => enterAs("spectator")} disabled={!session.room.allowSpectators}>鏃佽</button>
        </div>
        <div className="lan-box">
          <h3>灞€鍩熺綉鍔犲叆</h3>
          <label>
            鎴夸富 WebSocket 鍦板潃
            <input value={lanUrl} onChange={(event) => setLanUrl(event.target.value)} />
          </label>
          <p>杩炴帴鐘舵€侊細{lanStatus}{lanDetail ? ` 路 ${lanDetail}` : ""}</p>
          <button type="button" onClick={joinLanRoom}>杩炴帴灞€鍩熺綉鎴块棿</button>
        </div>
      </div>
    </section>
  );
}

function RoomWaitingPage({
  state,
  session,
  setSession,
  go,
}: {
  state: CombatState;
  session: AppSession;
  setSession: React.Dispatch<React.SetStateAction<AppSession>>;
  go: (route: AppSession["route"], patchSession": Partial<AppSession>) => void;
}) {
  const players = state.actors.filter((actor) => actor.side === "player");
  return (
    <section className="room-grid">
      <div className="panel">
        <h2>鎴块棿锛歿session.room.roomName}</h2>
        <p>鎴块棿鐮侊細{session.roomCode}</p>
        <div className="actor-list">
          {session.seats.map((seat) => <div className="actor-card static" key={seat.id}><strong>{seat.label}</strong><span>{seat.playerName "? "绌轰綅"}</span><small>{seat.ready ? "宸插噯澶" : "鏈噯澶"}</small></div>)}
        </div>
      </div>
      <div className="panel">
        <h2>瑙掕壊鍒嗛厤</h2>
        {players.map((actor) => <div className="actor-card static" key={actor.id}><strong>{actor.name}</strong><span>{session.selectedActorId === actor.id ? "宸插垎閰" : "鏈垎閰"}</span></div>)}
        <label className="check-row">
          <input checked={session.room.allowSpectators} type="checkbox" onChange={(event) => setSession((current) => ({ ...current, room: { ...current.room, allowSpectators: event.target.checked } }))} />
          鍏佽鏃佽
        </label>
        <div className="split-actions">
          <button type="button" onClick={() => go("home")}>杩斿洖棣栭〉</button>
          <button type="button" onClick={() => go("characterAssign")}>瑙掕壊鍒嗛厤</button>
          <button className="primary-action" type="button" onClick={() => go("dmScene", { identity: "dm", gameMode: "scene" })}>寮€濮嬫儏鏅?/button>
          <button type="button" onClick={() => go("dmCombat", { identity: "dm", gameMode: "combat" })}>鐩存帴杩涘叆浜ら攱</button>
        </div>
      </div>
    </section>
  );
}

function CharacterAssignPage({
  state,
  session,
  setSession,
  enterAs,
  go,
}: {
  state: CombatState;
  session: AppSession;
  setSession: React.Dispatch<React.SetStateAction<AppSession>>;
  enterAs: (identity: "dm" | "player" | "spectator") => void;
  go: (route: AppSession["route"], patchSession": Partial<AppSession>) => void;
}) {
  return (
    <section className="room-grid">
      <div className="panel">
        <h2>瑙掕壊鍒嗛厤</h2>
        <label>
          鐜╁瑙掕壊
          <select value={session.selectedActorId} onChange={(event) => setSession((current) => ({ ...current, selectedActorId: event.target.value }))}>
            {state.actors.filter((actor) => actor.side === "player").map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
          </select>
        </label>
        <p className="hint">鏈垎閰嶈鑹蹭笉鑳借繘鍏ョ帺瀹舵闈€傚綋鍓嶆牱渚嬮粯璁ゅ垎閰嶆矆闈掋€?/p>
      </div>
      <div className="panel">
        <h2>杩涘叆妗岄潰</h2>
        <div className="split-actions">
          <button type="button" onClick={() => go("roomWaiting")}>杩斿洖鎴块棿</button>
          <button className="primary-action" type="button" onClick={() => enterAs("player")} disabled={!session.selectedActorId}>浠ョ帺瀹惰韩浠借繘鍏?/button>
          <button type="button" onClick={() => enterAs("dm")}>浠?DM 韬唤杩涘叆</button>
        </div>
      </div>
    </section>
  );
}

function PlayerSceneDesk(props: DeskProps & {
  rawState: CombatState;
  actorId: string;
  onStartScene: () => void;
  onEnterCombat: () => void;
}) {
  const actor = props.state.actors.find((item) => item.id === props.actorId) ?? props.state.actors[0];
  const publicObjects = props.state.actors.filter((item) => item.id !== actor.id);

  return (
    <section className="game-desk player-scene-desk">
      <GameModeHeader state={props.state} modeLabel="鐜╁鎯呮櫙妗岄潰" />
      <div className="scene-layout">
        <section className="panel">
          <h2>鎴戠殑绠€鍗?/h2>
          <CombatBriefCard actor={actor} />
        </section>
        <section className="panel scene-board">
          <h2>{props.state.sceneName}</h2>
          <p>{props.state.sceneGoal}</p>
          <div className="track-row">
            {props.state.tracks.map((track) => (
              <div className="track" key={track.id}>
                <span>{track.name}</span>
                <meter min={0} max={track.max} value={track.value} />
                <small>{track.value}/{track.max}</small>
              </div>
            ))}
          </div>
          <div className="action-card-grid">
            {["瑙傚療", "浜ゆ秹", "鎼滄煡", "绉绘", "鍙栫墿", "浣跨敤鐗╁搧"].map((action) => (
              <button className="action-card" type="button" key={action}>
                <strong>{action}</strong>
                <span>鎯呮櫙鍔ㄤ綔</span>
                <small>鐢?DM 瑁佸畾骞跺啓鍏ヤ簨浠?/small>
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>鍏紑瀵硅薄</h2>
          <div className="actor-list">
            {publicObjects.map((item) => <UnitCard actor={item} mode={item.side === "player" ? "teammate" : "enemyPublic"} key={item.id} />)}
          </div>
        </section>
      </div>
      <div className="split-actions desk-primary-actions">
        <button type="button" onClick={props.onStartScene}>寮€濮?鍒锋柊褰撳墠鍦烘櫙</button>
        <button className="primary-action" type="button" onClick={props.onEnterCombat}>杩涘叆浜ら攱</button>
      </div>
      <DrawerToolbar activeDrawer={props.activeDrawer} setActiveDrawer={props.setActiveDrawer} role="player" />
      <DrawerLayer {...props} actor={actor} role="player" />
    </section>
  );
}

function PendingActionBar({ state }: { state: CombatState }) {
  const pending = state.pendingAction;
  if (!pending) return null;
  const actor = state.actors.find((item) => item.id === pending.actorId);
  const target = state.actors.find((item) => item.id === pending.targetId);
  const move = actor?.moves.find((item) => item.id === pending.moveId);
  return (
    <div className="pending-action-bar">
      <img src={iconMap.response} alt="" style={{ width: 32, height: 32, objectFit: "contain", borderRadius: 6, border: "1px solid rgba(107,75,45,0.25)" }} />
      <div>
        <strong>{pending.formed ? "宸叉垚鎷涳紝绛夊緟搴旀嫑鎴栬惤鏋" : "鎴嚮绐楀彛鎵撳紑"}</strong>
        <p style={{ margin: "2px 0 0", fontSize: 13 }}>
          {actor?.name} 瀹ｈ█銆寋move?.name}銆嶁啋 {target?.name}
          锛岄攣姘?{pending.diceIds.length} 鏋氾紙闃磠pending.yinSlotDiceIds?.length ?? 0} 闃硔pending.yangSlotDiceIds?.length ?? 0}锛"        </p>
      </div>
    </div>
  );
}

function CenterDrawer({
  drawerId,
  onClose,
  children,
}: {
  drawerId: DrawerId;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [width, setWidth] = useState(400);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: width };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    if (!resizeRef.current) return;
    const delta = e.clientX - resizeRef.current.startX;
    const newWidth = Math.max(360, Math.min(640, resizeRef.current.startWidth + delta));
    setWidth(newWidth);
  }

  function onMouseUp() {
    resizeRef.current = null;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  return (
    <div className="center-drawer" style={{ width }}>
      <div className="drawer-header">
        <h3>{drawerTitle(drawerId)}</h3>
        <button className="icon-button close-button" type="button" onClick={onClose} aria-label="鍏抽棴鎶藉眽">脳</button>
      </div>
      <div className="drawer-body">{children}</div>
      <div className="drawer-resize-handle" onMouseDown={onMouseDown} />
    </div>
  );
}

function DmControlPanelCompact({
  onStartScene, onIntercept, onForm, onReact, onOutcome, onEndRound,
  onRegulateBreath, onReflection, onExpireSource, hasPending,
  dmNote, setDmNote, onOverride,
}: {
  onStartScene: () => void;
  onIntercept: () => void;
  onForm: () => void;
  onReact: () => void;
  onOutcome: () => void;
  onEndRound: () => void;
  onRegulateBreath: () => void;
  onReflection: () => void;
  onExpireSource: () => void;
  hasPending: boolean;
  dmNote: string;
  setDmNote: (value: string) => void;
  onOverride: () => void;
  momentum: ShiState;
  onMomentum: (momentum: ShiState) => void;
}) {
  return (
    <div className="panel" style={{ padding: 8, display: "grid", gap: 6 }}>
      <h3 style={{ margin: 0, fontSize: 13 }}>瑁佸畾闈㈡澘</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <button type="button" onClick={onStartScene} style={{ fontSize: 11, padding: "3px 8px" }}>鍏堝悗/鎶曢</button>
        <button type="button" onClick={onIntercept} disabled={!hasPending} style={{ fontSize: 11, padding: "3px 8px" }}>鎴嚮</button>
        <button type="button" onClick={onForm} disabled={!hasPending} style={{ fontSize: 11, padding: "3px 8px" }}>鎴愭嫑</button>
        <button type="button" onClick={onReact} disabled={!hasPending} style={{ fontSize: 11, padding: "3px 8px" }}>搴旀嫑</button>
        <button type="button" onClick={onOutcome} disabled={!hasPending} style={{ fontSize: 11, padding: "3px 8px" }}>钀芥灉</button>
        <button type="button" onClick={onEndRound} style={{ fontSize: 11, padding: "3px 8px" }}>杞湯</button>
        <button type="button" onClick={onRegulateBreath} style={{ fontSize: 11, padding: "3px 8px" }}>璋冩伅</button>
        <button type="button" onClick={onReflection} style={{ fontSize: 11, padding: "3px 8px" }}>杩旂収</button>
        <button type="button" onClick={onExpireSource} style={{ fontSize: 11, padding: "3px 8px" }}>澶辨晥</button>
      </div>
      <textarea value={dmNote} onChange={(e) => setDmNote(e.target.value)} style={{ minHeight: 50, fontSize: 11 }} placeholder="DM澶囨敞..." />
      <button type="button" onClick={onOverride} style={{ fontSize: 11 }}>鍐欏叆瑁佸畾鏃ュ織</button>
    </div>
  );
}

function PlayerCombatDesk(props: DeskProps & {
  rawState: CombatState;
  actorId: string;
  onStartScene: () => void;
  onForm: () => void;
  onReact: () => void;
  onOutcome: () => void;
  onRegulateBreath: () => void;
  onReflection: () => void;
}) {
  const actor = props.state.actors.find((item) => item.id === props.actorId) ?? props.state.actors[0];
  const teammates = props.state.actors.filter((item) => item.side === "player" && item.id !== props.actorId);
  const enemies = props.state.actors.filter((item) => item.side !== "player");
  const pending = props.rawState.pendingAction;
  const phase = props.state.phase;
  const activeDrawers = props.activeDrawer ? [props.activeDrawer] : [];
  const waitingForDmResponse = phase === "intercept_window" || phase === "react_window";

  return (
    <section className="game-desk player-combat-desk">
      <section className="combat-layout">
        {/* LEFT COLUMN -- cards scrollable, drawer buttons fixed at bottom */}
        <div className="combat-left-column">
          <div className="combat-cards-scroll">
            {teammates.map((t) => (
              <CombatCharacterCard
                key={t.id}
                actor={t}
                selected={props.selectedTargetId === t.id}
                onClick={() => props.setSelectedTargetId(t.id)}
              />
            ))}
            <CombatCharacterCard actor={actor} isOwn />
          </div>
          <div className="combat-drawer-buttons">
            {(["character", "sixRoots", "innerArt", "inventory", "moves", "statuses", "logs", "library", "settings"] as DrawerId[]).map((id) => (
              <button
                key={id}
                className={props.activeDrawer === id ? "active" : ""}
                type="button"
                onClick={() => props.setActiveDrawer(props.activeDrawer === id ? null : id)}
              >
                {drawerTitle(id)}
              </button>
            ))}
          </div>
        </div>

        {/* CENTER COLUMN -- Target Lines + Response Window + Declaration Preview + Drawers */}
        <div className="combat-center-column">
          <TargetLinesOverlay state={props.state} />
          <div className="target-lines-area">
            {props.state.distances.length > 0 ? props.state.distances.map((d) => {
              const from = props.state.actors.find((a) => a.id === d.fromActorId);
              const to = props.state.actors.find((a) => a.id === d.toActorId);
              return (
                <div className="target-line" key={d.id}>
                  <span className="from">{from?.name "? "?"}</span>
                  <span className="band">{d.band}{d.entangled ? " 路 绾犵紶" : ""}</span>
                  <span className="to">{to?.name "? "?"}</span>
                </div>
              );
            }) : <p className="empty-state">鏆傛棤璺濈鍏崇郴</p>}
          </div>

          {waitingForDmResponse ? (
            <div className="response-window public-wait-window">
              <strong>绛夊緟 DM 瑁佸畾鍝嶅簲</strong>
              <p className="empty-state">鍝嶅簲鏄惁鍙戠敓銆佺敱璋佸搷搴斻€佷綍鏃惰烦杩囷紝鍧囩敱 DM 涓绘寔鍙板鐞嗐€?/p>
            </div>
          ) : null}

          {/* Declaration Preview -- only shown when a pending action exists */}
          {pending ? (
            <DeclarationPreview pending={pending} state={props.state} />
          ) : null}

          {/* Center Drawers */}
          <div className="center-drawers">
            {activeDrawers.map((drawerId) => (
              <CenterDrawer
                key={drawerId}
                drawerId={drawerId}
                onClose={() => props.setActiveDrawer(null)}
              >
                <DrawerContent {...props} actor={actor} role="player" drawerOverride={drawerId} />
              </CenterDrawer>
            ))}
          </div>
          {activeDrawers.length === 0 ? <p className="empty-state" style={{ padding: "12px", textAlign: "center" }}>鐐瑰嚮椤舵爮鎸夐挳鎵撳紑鎶藉眽</p> : null}
        </div>

        {/* RIGHT COLUMN -- Enemy Cards, scrollable */}
        <div className="combat-right-column">
          {enemies.map((enemy) => (
            <CombatCharacterCard
              key={enemy.id}
              actor={enemy}
              selected={props.selectedTargetId === enemy.id}
              onClick={() => props.setSelectedTargetId(enemy.id)}
            />
          ))}
        </div>
      </section>

      {/* QI DICE ZONE */}
      <QiZoneBoard
        state={props.state}
        dice={props.state.dice.filter((die) => die.ownerId === actor.id)}
        activeActorId={actor.id}
        selectedDice={props.selectedDice}
        slotDice={props.slotDice}
        slotHint={props.slotHint}
        onToggleDie={props.toggleDie}
        onAssignDieToSlot={props.assignDieToSlot}
        onRollDice={props.setRollDice}
        onCommitRoll={(results) => props.patch((current) => commitDiceRollResults(current, results))}
        onRemoveFromSlot={(dieId) => props.setSlotDice((current) => ({ yin: current.yin.filter((id) => id !== dieId), yang: current.yang.filter((id) => id !== dieId) }))}
        recentlyRestoredDiceIds={props.recentlyRestoredDiceIds}
        autoRollKey={props.autoRollKey}
      />

      {/* HAND AREA -- Move Cards with double-click to declare */}
      <div className="hand-area">
        {actor.moves.map((move) => {
          const availability = canDeclareAction(props.state, actor.id, move.id, {
            yinSlotDiceIds: props.slotDice.yin,
            yangSlotDiceIds: props.slotDice.yang,
          }, [...props.slotDice.yin, ...props.slotDice.yang]);
          const selected = props.selectedMoveId === move.id;
          const isUnavailable = !availability.allowed;
          const reasonText = isUnavailable ? displayActionReasons(availability.reasons) : "";
          return (
            <div
              key={move.id}
              className={`hand-card ${selected ? "selected" : ""} ${isUnavailable ? "card-unavailable" : ""}`}
              data-reason={reasonText}
              title={isUnavailable ? reasonText : `${move.name}\n${move.baseEffect}`}
              onClick={() => props.setSelectedMoveId(move.id)}
              onDoubleClick={() => props.declareFor(actor.id, props.selectedTargetId, move.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                props.setSelectedMoveId(move.id);
                props.setActiveDrawer("moves");
              }}
            >
              {/* ART SLOT: action-card-face 鈥?96x72 name and base-effect card face */}
              <strong>{move.name}</strong>
              <span className="card-effect-line">{move.baseEffect}</span>
              <span className="card-meta-line">
                {move.qiNatureThreshold === "浠绘剰姘旀€" ? "浠绘剰" : move.qiNatureThreshold} 路 {move.minDice}楠"              </span>
            </div>
          );
        })}
        <div className="hand-card" onClick={() => props.onRegulateBreath()}>
          <strong>璋冩伅</strong>
          <span className="card-meta-line">浠绘剰 路 1楠?/span>
        </div>
        {(() => {
          const seaDice = props.state.dice.filter((d) => d.ownerId === actor.id && d.zone === "QI_SEA");
          const restDice = props.state.dice.filter((d) => d.ownerId === actor.id && d.zone === "QI_REST" && d.value !== null);
          const isBreathStopped = seaDice.length === 0 && restDice.length > 0;
          if (!isBreathStopped) return null;
          return (
            <div className="hand-card reflection-hand-card" onClick={() => props.onReflection()}>
              <strong>杩旂収</strong>
              <span className="card-meta-line">鏂皵淇濆簳 路 {restDice.length}鏋氬彲鍙?/span>
            </div>
          );
        })()}
      </div>
    </section>
  );
}

function DmSceneDesk(props: DeskProps & {
  dmNote: string;
  setDmNote: (value: string) => void;
  onStartScene: () => void;
  onEnterCombat: () => void;
  onOverride: () => void;
}) {
  const publicObjects = props.state.actors;

  return (
    <section className="game-desk dm-scene-desk">
      <GameModeHeader state={props.state} modeLabel="DM鎯呮櫙涓绘寔鍙" />
      <div className="dm-scene-grid">
        <section className="panel">
          <h2>鍦烘櫙绠＄悊</h2>
          <p>褰撳墠鍦烘櫙锛歿props.state.sceneName}</p>
          <p>浠诲姟锛歿props.state.sceneGoal}</p>
          <div className="track-row">
            {props.state.tracks.map((track) => (
              <div className="track" key={track.id}>
                <span>{track.name}{track.hidden ? "锛堥殣钘忥級" : ""}</span>
                <meter min={0} max={track.max} value={track.value} />
                <small>{track.value}/{track.max}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel scene-board">
          <h2>鍏变韩鎯呮櫙鑸炲彴</h2>
          <p>澶滈洦鐭虫ˉ锛屽け闀栬绠变粛鍦ㄥ宀告殫澶勩€傚叕寮€瀵硅薄涓庣嚎绱㈢敱 DM 鍐冲畾浣曟椂骞挎挱銆?/p>
          <div className="actor-list">
            {publicObjects.map((actor) => <UnitCard actor={actor} mode={actor.side === "player" ? "teammate" : "enemyDm"} key={actor.id} />)}
          </div>
        </section>
        <section className="panel">
          <h2>DM鎿嶄綔</h2>
          <div className="flow-buttons">
            <button type="button" onClick={props.onStartScene}>鎺ㄨ繘鍦烘櫙</button>
            <button type="button" onClick={props.onOverride}>鍏紑绾跨储</button>
            <button className="primary-action" type="button" onClick={props.onEnterCombat}>杩涘叆浜ら攱</button>
          </div>
          <label>
            DM 绉佹湁/骞挎挱澶囨敞
            <textarea value={props.dmNote} onChange={(event) => props.setDmNote(event.target.value)} />
          </label>
        </section>
      </div>
      <DrawerToolbar activeDrawer={props.activeDrawer} setActiveDrawer={props.setActiveDrawer} role="dm" />
      <DrawerLayer {...props} actor={props.state.actors[0]} role="dm" />
    </section>
  );
}

function DmCombatDesk(props: DeskProps & {
  dmNote: string;
  setDmNote: (value: string) => void;
  onStartScene: () => void;
  onIntercept: () => void;
  onForm: () => void;
  onReact: () => void;
  onOutcome: () => void;
  onEndRound: () => void;
  onMomentum: (momentum: ShiState) => void;
  onRegulateBreath: () => void;
  onReflection: () => void;
  onExpireSource: () => void;
  onOverride: () => void;
}) {
  const players = props.state.actors.filter((actor) => actor.side === "player");
  const enemies = props.state.actors.filter((actor) => actor.side !== "player");
  const pending = props.state.pendingAction;
  const phase = props.state.phase;
  const isWindowPhase = phase === "intercept_window" || phase === "react_window";
  const isInterceptWindow = phase === "intercept_window";
  const isReactWindow = phase === "react_window";
  const activeDrawers = props.activeDrawer ? [props.activeDrawer] : [];
  const dmActor = props.state.actors.find((actor) => actor.id === props.state.activeActorId) ?? enemies[0] ?? players[0];

  // Determine available responses during windows (DM can respond with any actor)
  const windowResponses = useMemo(() => {
    if (!pending || !isWindowPhase) return [];
    const target = props.state.actors.find((a) => a.id === pending.targetId);
    if (!target) return [];
    const responseType = isInterceptWindow ? "鎴嚮" : "搴旀嫑";
    return target.responses.filter((r) => r.responseType === responseType);
  }, [pending, isWindowPhase, isInterceptWindow, props.state.actors]);

  return (
    <section className="game-desk dm-combat-desk">
      <section className="combat-layout">
        {/* LEFT COLUMN -- Players scrollable + drawer buttons fixed */}
        <div className="combat-left-column">
          <div className="combat-cards-scroll">
            {players.map((p) => (
              <CombatCharacterCard
                key={p.id}
                actor={p}
                selected={props.selectedTargetId === p.id}
                onClick={() => props.setSelectedTargetId(p.id)}
              />
            ))}
          </div>
          <div className="combat-drawer-buttons">
            {(["dmEnemies", "dmDistance", "dmHidden", "dmRuling", "dmScene", "dmLog", "library", "settings"] as DrawerId[]).map((id) => (
              <button
                key={id}
                className={props.activeDrawer === id ? "active" : ""}
                type="button"
                onClick={() => props.setActiveDrawer(props.activeDrawer === id ? null : id)}
              >
                {drawerTitle(id)}
              </button>
            ))}
          </div>
        </div>

        {/* CENTER COLUMN -- Target Lines + Response Window + Declaration Preview + Drawers */}
        <div className="combat-center-column">
          <div className="target-lines-area">
            {props.state.distances.length > 0 ? props.state.distances.map((d) => {
              const from = props.state.actors.find((a) => a.id === d.fromActorId);
              const to = props.state.actors.find((a) => a.id === d.toActorId);
              return (
                <div className="target-line" key={d.id}>
                  <span className="from">{from?.name "? "?"}</span>
                  <span className="band">{d.band}{d.entangled ? " 路 绾犵紶" : ""}</span>
                  <span className="to">{to?.name "? "?"}</span>
                </div>
              );
            }) : <p className="empty-state">鏆傛棤璺濈鍏崇郴</p>}
          </div>

          {/* Response Window -- only during timer phases */}
          {isWindowPhase ? (
            <ResponseWindow
              phase={phase}
              timer={props.windowTimer}
              timerMax={props.windowTimerDuration}
              responses={windowResponses}
              onRespond={(responseId) => {
                const targetId = pending?.targetId;
                if (targetId) props.onRespond(targetId, responseId);
              }}
              onSkip={props.onSkipWindow}
            />
          ) : null}

          {/* Declaration Preview -- only shown when a pending action exists */}
          {pending ? (
            <DeclarationPreview pending={pending} state={props.state} />
          ) : null}

          {/* Center Drawers */}
          <div className="center-drawers">
            {activeDrawers.map((drawerId) => (
              <CenterDrawer
                key={drawerId}
                drawerId={drawerId}
                onClose={() => props.setActiveDrawer(null)}
              >
                <DrawerContent {...props} actor={players[0] ?? props.state.actors[0]} role="dm" drawerOverride={drawerId} />
              </CenterDrawer>
            ))}
          </div>
          {activeDrawers.length === 0 ? <p className="empty-state" style={{ padding: "12px", textAlign: "center" }}>鐐瑰嚮椤舵爮鎸夐挳鎵撳紑鎶藉眽</p> : null}
        </div>

        {/* RIGHT COLUMN -- Enemy Cards + DM Controls */}
        <div className="combat-right-column">
          <div className="combat-cards-scroll">
            {enemies.map((enemy) => (
              <CombatCharacterCard
                key={enemy.id}
                actor={enemy}
                selected={props.selectedTargetId === enemy.id}
                onClick={() => props.setSelectedTargetId(enemy.id)}
              />
            ))}
          </div>
          <DmControlPanelCompact
            onStartScene={props.onStartScene}
            onIntercept={props.onIntercept}
            onForm={props.onForm}
            onReact={props.onReact}
            onOutcome={props.onOutcome}
            onEndRound={props.onEndRound}
            onRegulateBreath={props.onRegulateBreath}
            onReflection={props.onReflection}
            onExpireSource={props.onExpireSource}
            hasPending={Boolean(props.state.pendingAction)}
            dmNote={props.dmNote}
            setDmNote={props.setDmNote}
            onOverride={props.onOverride}
            momentum={props.state.actors.find((a) => a.id === props.state.activeActorId)?.momentum "? "鍚堝娍"}
            onMomentum={props.onMomentum}
          />
        </div>
      </section>

      {/* QI DICE ZONE */}
      <QiZoneBoard
        state={props.state}
        dice={props.state.dice}
        activeActorId={props.state.activeActorId}
        selectedDice={props.selectedDice}
        slotDice={props.slotDice}
        slotHint={props.slotHint}
        onToggleDie={props.toggleDie}
        onAssignDieToSlot={props.assignDieToSlot}
        onRollDice={props.setRollDice}
        onCommitRoll={(results) => props.patch((current) => commitDiceRollResults(current, results))}
        onRemoveFromSlot={(dieId) => props.setSlotDice((current) => ({ yin: current.yin.filter((id) => id !== dieId), yang: current.yang.filter((id) => id !== dieId) }))}
        recentlyRestoredDiceIds={props.recentlyRestoredDiceIds}
        autoRollKey={props.autoRollKey}
      />

      {/* HAND AREA -- Move Cards with double-click to declare */}
      <div className="hand-area">
        {(dmActor?.moves ?? []).map((move) => {
          const availability = canDeclareAction(props.state, dmActor?.id "? "", move.id, {
            yinSlotDiceIds: props.slotDice.yin,
            yangSlotDiceIds: props.slotDice.yang,
          }, [...props.slotDice.yin, ...props.slotDice.yang]);
          const selected = props.selectedMoveId === move.id;
          const isUnavailable = !availability.allowed;
          const reasonText = isUnavailable ? displayActionReasons(availability.reasons) : "";
          return (
            <div
              key={move.id}
              className={`hand-card ${selected ? "selected" : ""} ${isUnavailable ? "card-unavailable" : ""}`}
              data-reason={reasonText}
              title={isUnavailable ? reasonText : `${move.name}\n${move.baseEffect}`}
              onClick={() => props.setSelectedMoveId(move.id)}
              onDoubleClick={() => props.declareFor(dmActor?.id "? "", props.selectedTargetId, move.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                props.setSelectedMoveId(move.id);
                props.setActiveDrawer("moves");
              }}
            >
              <strong>{move.name}</strong>
              <span className="card-effect-line">{move.baseEffect}</span>
              <span className="card-meta-line">
                {move.qiNatureThreshold === "浠绘剰姘旀€" ? "浠绘剰" : move.qiNatureThreshold} 路 {move.minDice}楠"              </span>
            </div>
          );
        })}
        <div className="hand-card" onClick={() => props.onRegulateBreath()}>
          <strong>璋冩伅</strong>
          <span className="card-meta-line">浠绘剰 路 1楠?/span>
        </div>
        {(() => {
          const dmId = dmActor?.id "? "";
          const seaDice = props.state.dice.filter((d) => d.ownerId === dmId && d.zone === "QI_SEA");
          const restDice = props.state.dice.filter((d) => d.ownerId === dmId && d.zone === "QI_REST" && d.value !== null);
          const isBreathStopped = seaDice.length === 0 && restDice.length > 0;
          if (!isBreathStopped) return null;
          return (
            <div className="hand-card reflection-hand-card" onClick={() => props.onReflection()}>
              <strong>杩旂収</strong>
              <span className="card-meta-line">鏂皵淇濆簳 路 {restDice.length}鏋氬彲鍙?/span>
            </div>
          );
        })()}
      </div>
    </section>
  );
}

interface DeskProps {
  state: CombatState;
  playerState: CombatState;
  session: AppSession;
  selectedDice: string[];
  slotDice: { yin: string[]; yang: string[] };
  slotHint: string;
  selectedTargetId: string;
  selectedMoveId: string;
  debugView: boolean;
  setDebugView: (value: boolean) => void;
  activeDrawer: DrawerId | null;
  setActiveDrawer: (value: DrawerId | null) => void;
  setSelectedTargetId: (id: string) => void;
  setSelectedMoveId: (id: string) => void;
  setRollDice: (dice: QiDie[]) => void;
  toggleDie: (id: string) => void;
  assignDieToSlot: (id: string, slot: "yin" | "yang") => void;
  setSlotDice: React.Dispatch<React.SetStateAction<{ yin: string[]; yang: string[] }>>;
  declareFor: (actorId: string, targetId: string, moveId: string) => void;
  patch: (updater: (current: CombatState) => CombatState) => void;
  go: (route: AppSession["route"], patchSession": Partial<AppSession>) => void;
  windowTimer: number;
  windowTimerDuration: number;
  setWindowTimerDuration: (value: number) => void;
  autoRollOnEnter: boolean;
  setAutoRollOnEnter: (value: boolean) => void;
  onSkipWindow: () => void;
  onRespond: (responderId: string, responseId: string) => void;
  recentlyRestoredDiceIds: string[];
  autoRollKey: number;
}

function GameModeHeader({ state, modeLabel }: { state: CombatState; modeLabel: string }) {
  const activeActor = state.actors.find((actor) => actor.id === state.activeActorId);
  return (
    <section className="panel mode-header">
      <div>
        <p className="eyebrow">{modeLabel}</p>
        <h2>{state.sceneName}</h2>
      </div>
      <div className="round-strip">
        <strong>绗瑊state.round}杞?/strong>
        <span>琛屽姩鐘舵€侊細{actionStateLabel(state)}</span>
        <span>褰撳墠琛屽姩鑰咃細{activeActor?.name "? "寰呭畾"}</span>
        <small className="action-state-hint">{actionStateHint(state)}</small>
      </div>
    </section>
  );
}

function CombatBriefCard({ actor }: { actor: Actor }) {
  return (
    <article className="combat-brief-card">
      <UnitCard actor={actor} mode={actor.side === "player" ? "teammate" : "enemyPublic"} />
      <div className="stat-grid">
        <span>鎶や綋 {actor.tableAttrs.鎶や綋}</span>
        <span>鐖嗗彂 {actor.tableAttrs.鐖嗗彂}</span>
        <span>鍥炴皵 {actor.tableAttrs.鍥炴皵}</span>
        <span>韬娍 {actor.tableAttrs.韬娍}</span>
      </div>
    </article>
  );
}

function ActionStackPanel({ state }: { state: CombatState }) {
  return (
    <section className="panel">
      <ActionStack state={state} />
    </section>
  );
}

function CampaignPanel({ state, title }: { state: CombatState; title: string }) {
  return (
    <section className="panel hero-panel">
      <div className="panel-title">
        <img src={iconMap.world} alt="" />
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{state.campaignName}</h2>
        </div>
      </div>
      <p>{state.sceneGoal}</p>
      <div className="meta-grid">
        <span>鍦烘櫙锛歿state.sceneName}</span>
        <span>杞锛歿state.round}</span>
        <span>琛屽姩鐘舵€侊細{actionStateLabel(state)}</span>
      </div>
    </section>
  );
}

function MyCharacterCard({ actor }: { actor: Actor }) {
  return (
    <section className="panel">
      <h2>鎴戠殑瑙掕壊</h2>
      <UnitCard actor={actor} mode="self" />
      <div className="stat-grid">
        <span>姘旇 {actor.tableAttrs.姘旇}</span>
        <span>鎶や綋 {actor.tableAttrs.鎶や綋}</span>
        <span>鐖嗗彂 {actor.tableAttrs.鐖嗗彂}</span>
        <span>鍥炴皵 {actor.tableAttrs.鍥炴皵}</span>
        <span>瑙傜収 {actor.tableAttrs.瑙傜収}</span>
        <span>韬娍 {actor.tableAttrs.韬娍}</span>
      </div>
      <p className="hint">{actor.publicNote}</p>
    </section>
  );
}

function TeamOverview({ actors }: { actors: Actor[] }) {
  return (
    <section className="panel">
      <h2>闃熷弸姒傝</h2>
      {actors.length === 0 ? <p className="empty-state">褰撳墠鏈湴鏍蜂緥鍙湁涓€鍚嶇帺瀹惰鑹层€?/p> : null}
      {actors.map((actor) => (
        <UnitCard actor={actor} mode="teammate" key={actor.id} />
      ))}
    </section>
  );
}

function ActorList({ title, actors }: { title: string; actors: Actor[] }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="actor-list">
        {actors.map((actor) => (
          <UnitCard actor={actor} mode={actor.side === "player" ? "teammate" : "enemyDm"} key={actor.id} />
        ))}
      </div>
    </section>
  );
}

// --- Response Window Component (shown during timer phases) ---
function ResponseWindow({
  phase,
  timer,
  timerMax,
  responses,
  onRespond,
  onSkip,
}: {
  phase: string;
  timer: number;
  timerMax: number;
  responses: { id: string; moveName: string; responseType: string; baseEffect: string }[];
  onRespond: (responseId: string) => void;
  onSkip: () => void;
}) {
  const isIntercept = phase === "intercept_window";
  const label = isIntercept ? "鎴嚮" : "搴旀嫑";
  const timerPercent = Math.max(0, (timer / Math.max(1, timerMax)) * 100);

  return (
    <div className={`response-window ${isIntercept ? "intercept-window" : "react-window"}`}>
      <div className="response-window-header">
        <span className="response-window-label">
          {label}绐楀彛 路 <TimerRing seconds={timer} maxSeconds={timerMax} />
        </span>
        <button type="button" className="skip-button" onClick={onSkip}>
          璺宠繃
        </button>
      </div>
      {responses.length > 0 ? (
        <div className="response-cards">
          {responses.map((r) => (
            <div
              key={r.id}
              className="hand-card response-card highlighted"
              title={r.baseEffect}
              onClick={() => onRespond(r.id)}
            >
              <strong>{r.moveName}</strong>
              <span className="card-meta-line">{r.responseType}鍝嶅簲</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state" style={{ padding: 6, fontSize: 12 }}>
          鏃犲彲鐢▄label}鍝嶅簲
        </p>
      )}
    </div>
  );
}

function TimerRing({ seconds, maxSeconds = 15 }: { seconds: number; maxSeconds": number }) {
  const pct = Math.max(0, (seconds / Math.max(1, maxSeconds)) * 100);
  return (
    <span className="timer-ring-inline">
      <svg width="32" height="32" viewBox="0 0 32 32" className="timer-ring-svg">
        <circle cx="16" cy="16" r="13" fill="none" stroke="var(--border-panel)" strokeWidth="3" />
        <circle
          cx="16" cy="16" r="13"
          fill="none"
          stroke={seconds <= 5 ? "#c44" : "var(--yang-die, #d4843a)"}
          strokeWidth="3"
          strokeDasharray={`${(pct / 100) * 81.68} 81.68`}
          strokeLinecap="round"
          transform="rotate(-90 16 16)"
          style={{ transition: "stroke-dasharray 0.9s linear, stroke 0.3s" }}
        />
      </svg>
      <span className="timer-ring-text" style={{ color: seconds <= 5 ? "#c44" : "var(--ink-dark)" }}>
        {seconds}s
      </span>
    </span>
  );
}

// --- Declaration Preview (shows current pending action) ---
function DeclarationPreview({
  pending,
  state,
}: {
  pending: NonNullable<CombatState["pendingAction"]>;
  state: CombatState;
}) {
  const actor = state.actors.find((a) => a.id === pending.actorId);
  const target = state.actors.find((a) => a.id === pending.targetId);
  const move = actor?.moves.find((m) => m.id === pending.moveId);

  return (
    <div className="declaration-preview">
      <div className="preview-header">
        <span className="preview-label">褰撳墠瀹ｈ█</span>
      </div>
      <div className="preview-body">
        <p>
          <strong>{actor?.name "? "?"}</strong> 鈹€鈹€銆寋move?.name "? "?"}銆嶁啋 <strong>{target?.name "? "?"}</strong>
        </p>
        <p className="preview-meta">
          閿佹皵锛氶槾{pending.yinSlotDiceIds?.length ?? 0}楠?闃硔pending.yangSlotDiceIds?.length ?? 0}楠?          {pending.formed ? " 路 宸叉垚鎷" : " 路 绛夊緟鎴嚮"}
        </p>
      </div>
    </div>
  );
}

function UnitCard({
  actor,
  mode,
}: {
  actor: Actor;
  mode: "self" | "teammate" | "enemyPublic" | "enemyDm";
}) {
  const statuses = mode === "enemyDm"
    ? actor.statuses
    : actor.statuses.filter((s) => s.public);
  const visibleStatuses = statuses.slice(0, mode === "self" || mode === "enemyDm" ? 6 : 4);
  const momentum = actor.momentum "? "鍚堝娍";
  const avatar = actor.side === "player" ? iconMap.character : iconMap.combat;

  return (
    <article className={`unit-card ${mode}`}>
      <div className="unit-head">
        <img src={avatar} alt="" />
        <div>
          <div className="unit-name-row">
            <strong>{actor.name}</strong>
            <span className={`unit-momentum momentum-pill-sm ${momentumClass(momentum)}`}>{momentum}</span>
          </div>
          <div className="status-bar" aria-label="鐘舵€佹爮">
            {visibleStatuses.length > 0
              ? visibleStatuses.map((status) => (
                  <span key={status.id} className={`status-badge status-${statusCSSKey(status.name)}`}>
                    {status.name}{status.layers > 1 ? `脳${status.layers}` : ""}
                  </span>
                ))
              : <span className="status-none">鏃犵姸鎬?/span>}
          </div>
        </div>
      </div>
      <meter min={0} max={actor.maxHp} value={actor.hp} />
      <p className="unit-hp">姘旇 {actor.hp}/{actor.maxHp}</p>
      {mode === "self" ? <SixRootsSummary actor={actor} /> : null}
      {mode === "enemyDm"
        ? (() => {
            const hidden = actor.statuses.filter((s) => !s.public);
            return hidden.length
              ? <p className="hint">闅愯棌鐘舵€侊細{hidden.map((s) => s.name).join("銆")}</p>
              : null;
          })()
        : null}
    </article>
  );
}

function SixRootsSummary({ actor }: { actor: Actor }) {
  const rootDesc: Record<SixRootName, string> = {
    椤堕棬: "蹇冪鎰熺煡涓庤鐓ф皵鏈",
    鐩獚: "鏌ユ帰璇嗙牬涓庣洰鍔涜寖鍥",
    蹇冨彛: "鐖嗗彂姘斿娍涓庢嫑寮忛攱閿",
    涓圭敯: "姘旀満鎬婚噺涓庡彇姘旀晥鐜",
    鍛介棬: "鎶や綋鎶楁€т笌韬綋鏍瑰熀",
    姝ユ牴: "韬娍绉绘涓庝笅鐩樼ǔ瀹",
  };
  const rootNames: SixRootName[] = ["椤堕棬", "鐩獚", "蹇冨彛", "涓圭敯", "鍛介棬", "姝ユ牴"];
  const neigong = actor.innerArts[0];
  return (
    <div className="six-roots-summary">
      {/* ART SLOT: six-roots-icons 鈥?24x24 monochrome icons per root, transparent PNG */}
      <div className="six-roots-grid">
        {rootNames.map((root) => (
          <div className="six-root-cell" key={root} title={rootDesc[root]}>
            <span className="six-root-icon">{root.slice(0, 1)}</span>
            <span className="six-root-label">{root}</span>
            <span className="six-root-value">{actor.sixRoots[root]}</span>
          </div>
        ))}
      </div>
      <p className="hint">
        褰撳墠鍐呭姛锛歿neigong?.name "? "鏈繍杞唴鍔"}锛涜繍琛岀獚浣嶏細{neigong?.occupiedAcupoints?.join("銆") "? "鏃"}锛涜鍔ㄦ憳瑕侊細
        {neigong?.passive "? "鏃"}
      </p>
    </div>
  );
}

function StatusBadgeRow({ statuses, limit = 5 }: { statuses: StatusEffect[]; limit": number }) {
  const visible = statuses.slice(0, limit);
  const overflow = Math.max(0, statuses.length - visible.length);
  if (statuses.length === 0) return <div className="card-status-row empty"><span>鏃犲叕寮€鐘舵€?/span></div>;
  return (
    <div className="card-status-row">
      {/* ART SLOT: status-badge-strip 鈥?160x24 compact colored status badges */}
      {visible.map((status) => (
        <span
          key={status.id}
          className={`card-status-badge status-${statusCSSKey(status.name)}`}
          title={`${status.name}${status.layers > 1 ? ` x${status.layers}` : ""} 路 ${status.source}`}
        >
          {status.name}{status.layers > 1 ? `脳${status.layers}` : ""}
        </span>
      ))}
      {overflow > 0 ? <span className="card-status-badge overflow">+{overflow}</span> : null}
    </div>
  );
}

function CombatCharacterCard({
  actor,
  isOwn = false,
  selected = false,
  onClick,
}: {
  actor: Actor;
  isOwn": boolean;
  selected": boolean;
  onClick": () => void;
}) {
  const momentum = actor.momentum "? "鍚堝娍";
  const shiCls = momentumClass(momentum);
  const statuses = actor.statuses.filter((s) => s.public);
  const showFullAttrs = actor.side === "player" || isOwn;
  const isDying = actor.hp <= 0;
  const cardClasses = [
    "character-card",
    isOwn ? "own-card" : "",
    selected ? "selected" : "",
    isDying ? "card-dying" : "",
  ].filter(Boolean).join(" ");

  return (
    <article className={cardClasses} onClick={onClick}>
      <div className="card-name-row">
        {/* ART SLOT: unit-portrait-frame 鈥?48x48 portrait frame for actor avatar */}
        <span className="card-name">{actor.name}</span>
        {isDying ? <span className="card-dying-badge">婵掓</span> : null}
        <span className={`card-momentum ${shiCls}`}>{momentum}</span>
      </div>
      <StatusBadgeRow statuses={statuses} />
      <div className="card-hp-row">
        <div className="card-hp-bar-wrap">
          <div className="card-hp-bar-fill" style={{ width: `${Math.max(0, (actor.hp / actor.maxHp) * 100)}%` }} />
        </div>
        <span className="card-hp-text">{actor.hp}/{actor.maxHp}</span>
      </div>
      {showFullAttrs ? (
        <div className="card-attr-grid">
          <span>姘旇 {actor.tableAttrs.姘旇}</span>
          <span>鎶や綋 {actor.tableAttrs.鎶や綋}</span>
          <span>鐖嗗彂 {actor.tableAttrs.鐖嗗彂}</span>
          <span>鍥炴皵 {actor.tableAttrs.鍥炴皵}</span>
          <span>瑙傜収 {actor.tableAttrs.瑙傜収}</span>
          <span>韬娍 {actor.tableAttrs.韬娍}</span>
        </div>
      ) : (
        <div className="card-public-note">鍏紑鐘舵€佷笌姘旇</div>
      )}
    </article>
  );
}

// ActionPanel removed 鈥?target selection now via clicking enemy cards in right column,
// move selection via hand area cards, and declaration via double-click on hand cards.
function ActionPanel(_props: DeskProps & { actor: Actor; enemies: Actor[] }) {
  return null;
}

function CombatStage({ state }: { state: CombatState }) {
  const players = state.actors.filter((actor) => actor.side === "player");
  const enemies = state.actors.filter((actor) => actor.side !== "player");
  const snapshot = createCombatBoardSnapshot(state);

  return (
    <section className="stage">
      <div className="ink-sun" />
      <div className="stage-header">
        <div>
          <p className="eyebrow">鍏变韩浜ら攱鑸炲彴</p>
          <h2>{state.sceneName}</h2>
        </div>
      </div>
      <PhaserCombatBoard snapshot={snapshot} onSelectUnit={() => undefined} />
      <div className="fighters">
        <FighterGroup title="鐜╁鏂" actors={players} />
        <div className="versus">浜ら攱</div>
        <FighterGroup title="鏁屾柟 / 鍘嬪姏" actors={enemies} />
      </div>
      <DistanceLines state={state} />
      <div className="track-row">
        {state.tracks.map((track) => (
          <div className="track" key={track.id}>
            <span>{track.name}</span>
            <meter min={0} max={track.max} value={track.value} />
            <small>{track.value}/{track.max}</small>
          </div>
        ))}
      </div>
      {state.pendingAction ? <PendingPreview state={state} /> : <p className="empty-state">褰撳墠娌℃湁寰呯粨绠楀瑷€銆?/p>}
    </section>
  );
}

function createCombatBoardSnapshot(state: CombatState): CombatBoardSnapshot {
  const action = state.pendingAction;
  const actor = action ? state.actors.find((item) => item.id === action.actorId) : undefined;
  const target = action ? state.actors.find((item) => item.id === action.targetId) : undefined;
  const move = actor && action ? actor.moves.find((item) => item.id === action.moveId) : undefined;
  return {
    sceneName: state.sceneName,
    units: state.actors.map((actorItem) => ({
      id: actorItem.id,
      name: actorItem.name,
      side: actorItem.side,
      hp: actorItem.hp,
      maxHp: actorItem.maxHp,
      momentum: actorItem.momentum,
      statuses: actorItem.statuses.filter((s) => s.public).map((s) => s.name),
    })),
    distances: state.distances.map((distance) => ({
      id: distance.id,
      fromActorId: distance.fromActorId,
      toActorId: distance.toActorId,
      band: distance.band,
      height: distance.height,
      entangled: distance.entangled,
    })),
    pendingLabel: action ? `${actor?.name "? "?"} 鈫?${target?.name "? "?"}锛?{move?.name "? "寰呭畾"}` : "绛夊緟瀹ｈ█",
  };
}

function DistanceLines({ state }: { state: CombatState }) {
  return (
    <div className="distance-lines">
      {state.distances.map((distance) => {
        const from = state.actors.find((actor) => actor.id === distance.fromActorId);
        const to = state.actors.find((actor) => actor.id === distance.toActorId);
        return (
          <div className="distance-line" key={distance.id}>
            <span>{from?.name}</span>
            <strong>{distance.band}{distance.entangled ? " 路 绾犵紶" : ""}</strong>
            <span>{to?.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function mergeDiceById(...groups: QiDie[][]): QiDie[] {
  const byId = new Map<string, QiDie>();
  for (const group of groups) {
    for (const die of group) byId.set(die.id, die);
  }
  return Array.from(byId.values());
}

function TargetLinesOverlay({ state }: { state: CombatState }) {
  const action = state.pendingAction;
  if (!action) return null;
  const actor = state.actors.find((item) => item.id === action.actorId);
  const targets = (action.targetIds?.length ? action.targetIds : [action.targetId])
    .map((id) => state.actors.find((item) => item.id === id))
    .filter((item): item is Actor => Boolean(item));
  const move = actor?.moves.find((item) => item.id === action.moveId);
  return (
    <div className="target-line-overlay">
      {/* ART SLOT: target-line-arc 鈥?520x72 animated arc layer from action card to selected target */}
      {targets.map((target) => (
        <div className="declared-target-line" key={target.id}>
          <span>{actor?.name "? "?"}</span>
          <i />
          <strong>{move?.name "? "鍔ㄤ綔"}</strong>
          <i />
          <span>{target.name}</span>
        </div>
      ))}
    </div>
  );
}

function ActionStack({ state }: { state: CombatState }) {
  const action = state.pendingAction;
  const actor = action ? state.actors.find((item) => item.id === action.actorId) : undefined;
  const target = action ? state.actors.find((item) => item.id === action.targetId) : undefined;
  const move = actor && action ? actor.moves.find((item) => item.id === action.moveId) : undefined;
  const steps = action
    ? [
        `${actor?.name} 瀹ｈ█銆?{move?.name}銆嶁啋 ${target?.name}`,
        `閿佹皵锛氶槾${action.yinSlotDiceIds?.length ?? 0}銆侀槼${action.yangSlotDiceIds?.length ?? 0}`,
        action.formed ? "鎴愭嫑锛氱瓑寰呭簲鎷涙垨钀芥灉" : "绛夊緟鎴嚮绐楀彛澶勭悊",
      ]
    : ["褰撳墠鍥炲悎灏氭棤琛屽姩鏍堛€"];

  return (
    <div className="action-stack">
      <h3>琛屽姩鏍?/h3>
      {steps.map((step, index) => <p key={`${step}-${index}`}>{index + 1}. {step}</p>)}
    </div>
  );
}

function FighterGroup({ title, actors }: { title: string; actors: Actor[] }) {
  return (
    <div className="fighter-group">
      <h3>{title}</h3>
      {actors.map((actor) => (
        <UnitCard actor={actor} mode={actor.side === "player" ? "teammate" : "enemyPublic"} key={actor.id} />
      ))}
    </div>
  );
}

function PendingPreview({ state }: { state: CombatState }) {
  const pending = state.pendingAction;
  if (!pending) return null;
  const actor = state.actors.find((item) => item.id === pending.actorId);
  const target = state.actors.find((item) => item.id === pending.targetId);
  const move = actor?.moves.find((item) => item.id === pending.moveId);
  return (
    <div className="pending-preview">
      <img src={iconMap.response} alt="" />
      <div>
        <strong>{pending.formed ? "宸叉垚鎷涳紝绛夊緟搴旀嫑鎴栬惤鏋" : "鎴嚮绐楀彛鎵撳紑"}</strong>
        <p>{actor?.name} 瀵?{target?.name} 浣跨敤銆寋move?.name}銆嶏紝閿佹皵 {pending.diceIds.length} 鏋氥€?/p>
      </div>
    </div>
  );
}

function QiZoneBoard({
  state,
  dice,
  selectedDice,
  activeActorId,
  slotDice,
  slotHint,
  onToggleDie,
  onAssignDieToSlot,
  onRollDice,
  onCommitRoll,
  onRemoveFromSlot,
  recentlyRestoredDiceIds,
  autoRollKey,
}: {
  state: CombatState;
  dice: QiDie[];
  selectedDice: string[];
  activeActorId: string;
  slotDice: { yin: string[]; yang: string[] };
  slotHint: string;
  onToggleDie: (id: string) => void;
  onAssignDieToSlot: (id: string, slot: "yin" | "yang") => void;
  onRollDice: (dice: QiDie[]) => void;
  onCommitRoll: (results: DiceRollResult[]) => void;
  onRemoveFromSlot: (dieId: string) => void;
  recentlyRestoredDiceIds": string[];
  autoRollKey: number;
}) {
  const poolDice = dice.filter((die) => die.zone === "QI_POOL");
  const seaDice = dice.filter((die) => die.zone === "QI_SEA");
  const tempDice = dice.filter((die) => die.zone === "TEMP_QI");
  const restDice = dice.filter((die) => die.zone === "QI_REST");
  const lockedDice = dice.filter((die) => die.zone === "QI_LOCK");
  const yinSlotDieIds = slotDice.yin;
  const yangSlotDieIds = slotDice.yang;
  const slottedDieIds = new Set([...yinSlotDieIds, ...yangSlotDieIds]);
  const yinSlotDice = dice.filter((die) => yinSlotDieIds.includes(die.id));
  const yangSlotDice = dice.filter((die) => yangSlotDieIds.includes(die.id));
  const yinSum = yinSlotDice.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const yangSum = yangSlotDice.reduce((sum, d) => sum + (d.value ?? 0), 0);

  const [justRolledIds, setJustRolledIds] = useState<string[]>([]);
  const [is3DRolling, setIs3DRolling] = useState(false);
  const [draggedDieId, setDraggedDieId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<"yin" | "yang" | null>(null);
  const lastAutoRollKeyRef = useRef(autoRollKey);

  const unslottedSeaDice = seaDice.filter((die) => !slottedDieIds.has(die.id));
  const unrolledSeaDice = unslottedSeaDice.filter((die) => die.value === null);
  const rolledSeaDice = unslottedSeaDice.filter((die) => die.value !== null);
  const rollableDice = poolDice.length > 0 ? poolDice : unrolledSeaDice;
  const operationDice = mergeDiceById(
    is3DRolling ? rollableDice : [],
    rolledSeaDice,
    tempDice,
    yinSlotDice,
    yangSlotDice,
  );
  const draggedDie = draggedDieId ? dice.find((die) => die.id === draggedDieId) : undefined;

  useEffect(() => {
    if (lastAutoRollKeyRef.current === autoRollKey) return;
    lastAutoRollKeyRef.current = autoRollKey;
    if (rollableDice.length > 0) {
      setIs3DRolling(true);
    }
  }, [autoRollKey, rollableDice.length]);

  function canDrag(die: QiDie) {
    if (die.zone === "QI_LOCK" || die.zone === "QI_REST") return false;
    if (!state.pendingAction && (yinSlotDieIds.includes(die.id) || yangSlotDieIds.includes(die.id))) return true;
    return canDragDieToSlot(state, die, activeActorId, "yin").allowed
      || canDragDieToSlot(state, die, activeActorId, "yang").allowed;
  }

  return (
    <div className="qi-zone-horizontal qi-zone-3d-layout">
      <div className="qi-zone-section qi-operation-board">
        <span className="section-label">
          姘旀捣 / 涓存皵妲?/ 闃撮槼妲戒綅 路 3D鎿嶄綔搴曟澘
          <small className="qi-warning">姘旀捣 {seaDice.length} 路 涓存皵 {tempDice.length} 路 闃磠yinSlotDice.length} / 闃硔yangSlotDice.length}</small>
          {unrolledSeaDice.length > 0 ? <small className="qi-warning">{unrolledSeaDice.length}鏋氭湭鎶?/small> : null}
          <button
            className="inline-roll-button"
            type="button"
            disabled={rollableDice.length === 0 || is3DRolling}
            onClick={() => setIs3DRolling(true)}
          >
            {is3DRolling ? "鎶曟幏涓?.." : poolDice.length > 0 ? "鎶曟皵姹" : "琛ユ姇"}
          </button>
        </span>
        {slotHint ? <p className="slot-hint">{slotHint}</p> : null}
        <div className="dice-tray-visual operation-dice-tray">
          <QiDiceTray
            dice={operationDice}
            rolling={is3DRolling}
            onRollComplete={(results) => {
              onCommitRoll(results);
              setJustRolledIds(results.map((r) => r.id));
              setIs3DRolling(false);
              window.setTimeout(() => setJustRolledIds([]), 600);
            }}
            highlightedIds={selectedDice.filter((id) => operationDice.some((die) => die.id === id))}
            selectedIds={selectedDice}
            onSelectDie={onToggleDie}
            canDragDie={(id) => {
              const die = dice.find((item) => item.id === id);
              return die ? canDrag(die) : false;
            }}
            slotDice={slotDice}
            onAssignToSlot={onAssignDieToSlot}
            onRemoveFromSlot={onRemoveFromSlot}
            onDragStartDie={setDraggedDieId}
            onDragEndDie={() => {
              setDraggedDieId(null);
              setDragOverSlot(null);
            }}
            canInteract={!is3DRolling}
          />
        </div>
      </div>

      <div className="qi-zone-section qi-rest-section">
        <span className="section-label">鎭簱 路 宸茬敤 {restDice.length}</span>
        <QiDiceTray
          dice={restDice}
          rolling={false}
          onRollComplete={() => undefined}
          selectedIds={selectedDice}
          highlightedIds={recentlyRestoredDiceIds}
          onSelectDie={onToggleDie}
          canInteract={false}
          compact
        />
      </div>

      {lockedDice.length > 0 ? (
        <div className="qi-zone-section qi-locked-section">
          <span className="section-label">宸查攣 路 {lockedDice.length}</span>
          <QiDiceTray
            dice={lockedDice}
            rolling={false}
            onRollComplete={() => undefined}
            selectedIds={selectedDice}
            onSelectDie={onToggleDie}
            canInteract={false}
            compact
          />
        </div>
      ) : null}

      <details className="qi-pool-strip">
        <summary>姘旀睜 路 {poolDice.length}鏋歿poolDice.length > 0 ? "寰呮姇" : ""}</summary>
        <QiDiceTray
          dice={poolDice}
          rolling={false}
          onRollComplete={() => undefined}
          selectedIds={selectedDice}
          onSelectDie={onToggleDie}
          canInteract={false}
          compact
        />
      </details>
    </div>
  );
}

function QiDiceGroup({
  dice,
  selectedDice,
  activeActorId,
  onToggleDie,
  draggable = false,
  temporary = false,
  highlightedIds,
  justRolledIds,
  recentlyRestoredDiceIds,
  canDragDie,
  onDragStartDie,
  onDragEndDie,
}: {
  dice: QiDie[];
  selectedDice: string[];
  activeActorId: string;
  onToggleDie: (id: string) => void;
  draggable": boolean;
  temporary": boolean;
  highlightedIds": string[];
  justRolledIds": string[];
  recentlyRestoredDiceIds": string[];
  canDragDie": (die: QiDie) => boolean;
  onDragStartDie": (id: string) => void;
  onDragEndDie": () => void;
}) {
  if (dice.length === 0) {
    return <p className="empty-state" style={{ fontSize: 11 }}>鏆傛棤</p>;
  }

  return (
    <>
      {dice.map((die) => {
        const isSelected = selectedDice.includes(die.id);
        const isHighlighted = highlightedIds?.includes(die.id) ?? false;
        const justRolled = justRolledIds?.includes(die.id) ?? false;
        const isRestoring = recentlyRestoredDiceIds?.includes(die.id) ?? false;
        const canActuallyDrag = draggable && (canDragDie?.(die) ?? true);
        const classes = [
          "qi-die",
          `die-${die.nature}`,
          die.nature,
          isSelected ? "selected" : "",
          (temporary || die.temporary) ? "temporary" : "",
          isHighlighted ? "highlighted" : "",
          justRolled ? "just-rolled" : "",
          isRestoring ? "die-to-rest" : "",
          draggable && !canActuallyDrag ? "not-draggable" : "",
        ].filter(Boolean).join(" ");
        return (
          <div
            key={die.id}
            draggable={draggable}
            title={`${die.sourceName} 路 ${die.label} 路 ${die.value "? "鏈姇"}`}
            className={classes}
            onClick={() => onToggleDie(die.id)}
            onDragStart={(event) => {
              if (!draggable) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.setData("text/plain", die.id);
              event.dataTransfer.effectAllowed = "move";
              onDragStartDie?.(die.id);
            }}
            onDragEnd={() => {
              onDragEndDie?.();
            }}
          >
            <span className="die-value">{die.value "? "?"}</span>
            <span className="die-sides">{die.label}</span>
            {(temporary || die.temporary) ? <span className="temp-badge">涓?/span> : null}
          </div>
        );
      })}
    </>
  );
}

function InventoryDrawer({ actor, canManage, patch }: {
  actor: Actor;
  canManage: boolean;
  patch: (updater: (current: CombatState) => CombatState) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="inventory-entry">
      <button className="inventory-launcher" type="button" onClick={() => setOpen(true)}>
        <img src={iconMap.inventory} alt="" />
        <span>鑳屽寘</span>
      </button>
      {open ? (
        <section className="panel inventory-panel inventory-popover" aria-label="鑳屽寘 / 瑁呭 / 鑽墿">
          <div className="panel-title">
            <img src={iconMap.inventory} alt="" />
            <h2>鑳屽寘 / 瑁呭 / 鑽墿</h2>
            <button className="icon-button close-button" type="button" onClick={() => setOpen(false)} aria-label="鍏抽棴鑳屽寘">脳</button>
          </div>
          <div className="inventory-tabs">
            {(Object.keys(categoryLabels) as InventoryCategory[]).map((category) => {
              const items = actor.inventory.filter((item) => item.category === category);
              return (
                <div className="inventory-group" key={category}>
                  <h3>{categoryLabels[category]}</h3>
                  {items.length === 0 ? <p className="empty-state">鏆傛棤</p> : null}
                  {items.map((item) => (
                    <InventoryItemCard key={item.id} actorId={actor.id} item={item} canManage={canManage} patch={patch} />
                  ))}
                </div>
              );
            })}
          </div>
          <h3>浣跨敤璁板綍</h3>
          {(actor.inventoryEvents ?? []).slice(0, 4).map((event) => (
            <p className="hint" key={`${event.itemId}-${event.createdAt}`}>{event.eventType} 路 {event.itemId} 路 {new Date(event.createdAt).toLocaleTimeString()}</p>
          ))}
          {(actor.inventoryEvents ?? []).length === 0 ? <p className="empty-state">杩樻病鏈夌墿鍝佷簨浠躲€?/p> : null}
        </section>
      ) : null}
    </div>
  );
}

function InventoryItemCard({ actorId, item, canManage, patch }: {
  actorId: string;
  item: InventoryItem;
  canManage: boolean;
  patch: (updater: (current: CombatState) => CombatState) => void;
}) {
  return (
    <article className="inventory-item">
      <strong>{item.name}{item.equipped ? "锛堝凡瑁呭锛" : ""}</strong>
      <span>鏁伴噺 {item.quantity}</span>
      <p>{item.publicNote}</p>
      {canManage ? (
        <div className="split-actions">
          {item.category === "weapon" || item.category === "armor" || item.category === "accessory" ? (
            <button type="button" onClick={() => patch((current) => item.equipped ? unequipItem(current, actorId, item.id) : equipItem(current, actorId, item.id))}>
              {item.equipped ? "鍗镐笅" : "瑁呭"}
            </button>
          ) : null}
          <button type="button" onClick={() => patch((current) => useInventoryItem(current, actorId, item.id))}>浣跨敤</button>
        </div>
      ) : null}
    </article>
  );
}

function DrawerToolbar({
  activeDrawer,
  setActiveDrawer,
  role,
}: {
  activeDrawer: DrawerId | null;
  setActiveDrawer: (value: DrawerId | null) => void;
  role: "player" | "dm";
}) {
  const playerItems: Array<{ id: DrawerId; label: string }> = [
    { id: "character", label: "浜虹墿" },
    { id: "sixRoots", label: "鍏牴" },
    { id: "innerArt", label: "鍐呭姛" },
    { id: "inventory", label: "鑳屽寘" },
    { id: "moves", label: "鎷涘紡" },
    { id: "statuses", label: "鐘舵€? },
    { id: "logs", label: "鏃ュ織" },
    { id: "library", label: "璧勬枡" },
    { id: "settings", label: "璁剧疆" },
  ];
  const dmItems: Array<{ id: DrawerId; label: string }> = [
    { id: "dmEnemies", label: "鏁屼汉" },
    { id: "dmDistance", label: "璺濈" },
    { id: "dmHidden", label: "闅愯棌" },
    { id: "dmRuling", label: "瑁佸畾" },
    { id: "dmScene", label: "鍦烘櫙" },
    { id: "dmLog", label: "DM鏃ュ織" },
    { id: "library", label: "璧勬枡" },
    { id: "settings", label: "璁剧疆" },
  ];
  const items = role === "dm" ? dmItems : playerItems;

  return (
    <nav className="drawer-toolbar" aria-label={role === "dm" ? "DM宸ュ叿鏉" : "鐜╁宸ュ叿鏉"}>
      {items.map((item) => (
        <button className={activeDrawer === item.id ? "active" : ""} type="button" key={item.id} onClick={() => setActiveDrawer(activeDrawer === item.id ? null : item.id)}>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function PromptModal({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <section className="panel prompt-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-title">
          <h2>{title}</h2>
          <button className="icon-button close-button" type="button" onClick={onClose} aria-label="鍏抽棴鎻愮ず">脳</button>
        </div>
        <p>{message}</p>
        <button className="primary-action" type="button" onClick={onClose}>鏄庣櫧</button>
      </section>
    </div>
  );
}

function DrawerLayer(props: DeskProps & { actor: Actor; role: "player" | "dm" }) {
  if (!props.activeDrawer) return null;

  const title = drawerTitle(props.activeDrawer);
  return (
    <aside className="drawer-layer">
      <div className="panel-title drawer-title">
        <h2>{title}</h2>
        <button className="icon-button close-button" type="button" onClick={() => props.setActiveDrawer(null)} aria-label="鍏抽棴鎶藉眽">脳</button>
      </div>
      <DrawerContent {...props} />
    </aside>
  );
}

function DrawerContent(props: DeskProps & { actor: Actor; role: "player" | "dm"; drawerOverride": DrawerId }) {
  const drawer = props.drawerOverride ?? props.activeDrawer;
  const actor = props.actor;
  const enemies = props.state.actors.filter((item) => item.side !== "player");

  if (drawer === "character") {
    return (
      <div className="drawer-content">
        <UnitCard actor={actor} mode="self" />
        <div className="stat-grid">
          <span>姘旇 {actor.hp}/{actor.maxHp}</span>
          <span>鎶や綋 {actor.tableAttrs.鎶や綋}</span>
          <span>鐖嗗彂 {actor.tableAttrs.鐖嗗彂}</span>
          <span>鍥炴皵 {actor.tableAttrs.鍥炴皵}</span>
          <span>瑙傜収 {actor.tableAttrs.瑙傜収}</span>
          <span>韬娍 {actor.tableAttrs.韬娍}</span>
        </div>
        <p>{actor.publicNote}</p>
      </div>
    );
  }

  if (drawer === "sixRoots") {
    return (
      <div className="drawer-content six-root-detail">
        <SixRootsSummary actor={actor} />
        <p className="hint">鍏牴閿佸畾涓猴細椤堕棬/鐩獚/蹇冨彛/涓圭敯/鍛介棬/姝ユ牴銆?/p>
      </div>
    );
  }

  if (drawer === "innerArt") {
    const arts = actor.innerArts;
    return (
      <div className="drawer-content">
        {/* ART SLOT: panel-drawer-bg-innerart 鈥?400x600 inner art scroll background */}
        {arts.length === 0 ? (
          <p className="empty-state">鏈澶囦换浣曞唴鍔熴€?/p>
        ) : (
          arts.map((art, idx) => (
            <article className="inner-art-card" key={art.id}>
              <div className="inner-art-header">
                <strong>{art.name}</strong>
                <span className={`tier-badge tier-${art.tier}`}>{art.tier}</span>
              </div>
              <div className="inner-art-body">
                <div className="inner-art-stat-row">
                  <span className="stat-label">閲嶆暟</span>
                  <span className="stat-value">{art.currentLevel}/{art.maxLevel}</span>
                </div>
                <div className="inner-art-stat-row">
                  <span className="stat-label">鍗犵獚</span>
                  <div className="inner-art-acupoints">
                    {/* ART SLOT: acupoint-dot 鈥?12x12 colored dot per occupied acupoint */}
                    {art.occupiedAcupoints.map((pt) => (
                      <span className={`acupoint-dot acupoint-${pt}`} key={pt} title={pt}>{pt}</span>
                    ))}
                  </div>
                </div>
                <div className="inner-art-stat-row">
                  <span className="stat-label">璇诲彇鍏牴</span>
                  <span className="stat-value">{art.readRoots.join("銆")}</span>
                </div>
                {art.attrContributions.length > 0 ? (
                  <div className="inner-art-attr-section">
                    <span className="stat-label">灞炴€ц础鐚?/span>
                    <table className="inner-art-table">
                      <thead><tr><th>鍏牴</th><th>鈫?/th><th>灞炴€?/th><th>杩愮畻</th></tr></thead>
                      <tbody>
                        {art.attrContributions.map((ac, i) => (
                          <tr key={i}>
                            <td>{ac.root}</td>
                            <td>鈫?/td>
                            <td>{ac.targetAttr}</td>
                            <td>{ac.root}脳{ac.multiplier}{ac.bonus > 0 ? `+${ac.bonus}` : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {art.qiGeneration.length > 0 ? (
                  <div className="inner-art-attr-section">
                    <span className="stat-label">鍙栨皵</span>
                    <table className="inner-art-table">
                      <thead><tr><th>鏉ユ簮鏍?/th><th>姘旀€?/th><th>楠伴樁</th><th>鏁伴噺</th><th>杩愮畻</th></tr></thead>
                      <tbody>
                        {art.qiGeneration.map((qg, i) => (
                          <tr key={i}>
                            <td>{qg.root}</td>
                            <td>{qg.nature === "yin" ? "闃" : qg.nature === "yang" ? "闃" : "鍘熷"}</td>
                            <td>d{qg.diceSides}</td>
                            <td>{qg.diceCount}</td>
                            <td>{qg.root}脳{qg.multiplier}{qg.bonus > 0 ? `+${qg.bonus}` : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                <div className="inner-art-stat-row">
                  <span className="stat-label">琚姩</span>
                  <span className="stat-value">{art.passive || "鏃"}</span>
                </div>
                <div className="inner-art-stat-row">
                  <span className="stat-label">鏁ｅ姛</span>
                  <span className="stat-value">{art.disperseRules || "鏈畾涔"}</span>
                </div>
                {art.parallelRestriction ? (
                  <div className="inner-art-stat-row">
                    <span className="stat-label">骞惰闄愬埗</span>
                    <span className="stat-value">{art.parallelRestriction}</span>
                  </div>
                ) : null}
              </div>
              {idx < arts.length - 1 ? <hr className="inner-art-divider" /> : null}
            </article>
          ))
        )}
      </div>
    );
  }

  if (drawer === "inventory") {
    const slots = Array.from({ length: 40 }, (_, index) => actor.inventory[index] ?? null);
    return (
      <div className="drawer-content inventory-drawer-page">
        {/* ART SLOT: panel-drawer-bg-inventory 鈥?400x640 backpack parchment and wood frame */}
        <div className="inventory-drawer-header">
          <strong>鑳屽寘</strong>
          <span>{actor.inventory.length}/40</span>
        </div>
        <div className="backpack-grid" aria-label="鑳屽寘鏍煎瓙">
          {slots.map((item, index) => (
            <button
              key={item?.id ?? `empty-${index}`}
              className={`backpack-slot ${item ? "filled" : ""}`}
              type="button"
              title={item ? `${item.name}\n${categoryLabels[item.category]}\n${item.publicNote}` : "绌烘牸"}
              disabled={!item}
              onDoubleClick={() => {
                if (!item) return;
                if (item.equipped) props.patch((current) => unequipItem(current, actor.id, item.id));
                else if (item.category === "medicine" || item.category === "tool") props.patch((current) => useInventoryItem(current, actor.id, item.id));
                else props.patch((current) => equipItem(current, actor.id, item.id));
              }}
            >
              {/* ART SLOT: inventory-item-icon 鈥?48x48 item icon, transparent PNG preferred */}
              {item ? (
                <>
                  <span className="item-icon-placeholder">{item.name.slice(0, 1)}</span>
                  {item.quantity > 1 ? <span className="item-qty">{item.quantity}</span> : null}
                  {item.equipped ? <span className="item-equipped-dot" /> : null}
                </>
              ) : null}
            </button>
          ))}
        </div>
        <p className="hint">鍙屽嚮鑽墿/鍣ㄥ叿浣跨敤锛涘弻鍑昏澶囩┛鎴存垨鍗镐笅銆傜墿鍝佽鎯呮殏鏀惧湪鎮诞鎻愮ず涓€?/p>
      </div>
    );
  }

  if ((drawer as string) === "__legacy_inventory__") {
    return (
      <div className="drawer-content">
        <div className="inventory-tabs">
          {(Object.keys(categoryLabels) as InventoryCategory[]).map((category) => {
            const items = actor.inventory.filter((item) => item.category === category);
            return (
              <div className="inventory-group" key={category}>
                <h3>{categoryLabels[category]}</h3>
                {items.length === 0 ? <p className="empty-state">鏆傛棤</p> : null}
                {items.map((item) => <InventoryItemCard key={item.id} actorId={actor.id} item={item} canManage={props.role !== "dm" || actor.side === "player"} patch={props.patch} />)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (drawer === "moves") {
    return (
      <div className="drawer-content action-card-grid">
        {/* ART SLOT: move-card-icons 鈥?32x32 style icons per move category */}
        {actor.moves.map((move) => (
          <article className="action-card" key={move.id}>
            <div className="move-card-header">
              <strong>{move.name}</strong>
              <div className="move-card-badges">
                <span className={`tier-badge tier-${move.tier}`}>{move.tier}</span>
                {move.designGrade ? <span className="grade-badge">{move.designGrade}</span> : null}
              </div>
            </div>
            <div className="move-card-meta">
              <span>{move.category}/{move.subCategory || move.timing}</span>
              {move.formPosition && move.formPosition !== "鏃? ? <span className="form-position-badge">{move.formPosition}</span> : null}
            </div>
            <div className="move-card-detail">
              <span className="move-detail-line">鏃剁偣锛歿move.timing}</span>
              <span className="move-detail-line">鎶曞叆锛歿move.minDice}鏋?路 {move.qiNatureThreshold}</span>
              <span className="move-detail-line">鍔匡細{move.shiCondition} 鈫?{move.allowedShi.join("/")}</span>
              <span className="move-detail-line">瑁呭锛歿move.equipPermission}</span>
            </div>
            <div className="move-card-effect">
              <strong>鍩虹鏁堟灉锛?/strong>{move.baseEffect}
            </div>
            {move.triggers.length > 0 ? (
              <div className="move-card-triggers">
                <span className="move-trigger-label">妲藉€艰Е鍙戯細</span>
                {move.triggers.map((t, i) => (
                  <span className="move-trigger-line" key={i}>[{t.type}] {t.condition}锛歿t.effect}</span>
                ))}
              </div>
            ) : null}
            <div className="move-card-footer">
              <span>杞娍锛歿move.postShi}</span>
              <span>璧勬簮锛歿move.resourceDestination}</span>
              {move.hasIntercept ? <span className="attachment-badge">鎴嚮</span> : null}
              {move.hasReact ? <span className="attachment-badge">搴旀嫑</span> : null}
            </div>
          </article>
        ))}
        {/* Quick Actions section */}
        <div className="library-section-divider">
          <span className="section-divider-label">渚胯鍔ㄤ綔</span>
        </div>
        {ruleCatalog.quickActions.map((qa) => (
          <article className="action-card" key={qa.id}>
            <div className="move-card-header">
              <strong>{qa.name}</strong>
              <span className="tier-badge">{qa.type}</span>
            </div>
            <div className="move-card-meta">
              <span>{qa.timing}</span>
            </div>
            <div className="move-card-detail">
              <span className="move-detail-line">鎶曞叆锛歿qa.minimumDice}鏋?路 {qa.qiRequirement}</span>
              <span className="move-detail-line">璁稿彲锛歿qa.permission}</span>
            </div>
            <div className="move-card-effect">
              <strong>鏁堟灉锛?/strong>{qa.effect}
            </div>
            <div className="move-card-footer">
              <span>闄愬埗锛歿qa.limit}</span>
              <span>鍘诲悜锛歿qa.resourceFlow}</span>
            </div>
          </article>
        ))}
      </div>
    );
  }

  if (drawer === "statuses") {
    const allStatuses = actor.statuses;
    const showAll = props.role === "dm" || actor.side === "player";
    const visible = showAll ? allStatuses : allStatuses.filter((s) => s.public);
    return (
      <div className="drawer-content">
        {/* ART SLOT: status-card-icons 鈥?28x28 severity-colored status icons per type */}
        {visible.length === 0 ? (
          <p className="empty-state">鏆傛棤鐘舵€併€?/p>
        ) : (
          visible.map((status) => (
            <article className={`status-card-full status-card-${statusCSSKey(status.name)}`} key={status.id}>
              <div className="status-card-head">
                <span className={`status-badge-lg status-${statusCSSKey(status.name)}`}>
                  {status.name}{status.layers > 1 ? ` 脳${status.layers}` : ""}
                </span>
                {!status.public ? <span className="status-hidden-badge">闅愯棌</span> : null}
              </div>
              <div className="status-card-meta">
                <span>鏉ユ簮锛歿status.source}</span>
                {status.durationRounds !== undefined ? (
                  <span>鍓╀綑 {status.durationRounds} 杞?/span>
                ) : <span className="status-permanent">鎸佺画鑷崇Щ闄?/span>}
              </div>
              <div className="status-card-effects">
                <span className="status-effects-label">姣忓眰鏁堟灉锛?/span>
                {status.effects.length > 0 ? (
                  <ul className="status-effects-list">
                    {status.effects.map((eff, i) => <li key={i}>{eff}</li>)}
                  </ul>
                ) : <span className="hint">锛堟棤鍏蜂綋鏁堟灉鎻忚堪锛?/span>}
              </div>
              {status.decayRule ? (
                <div className="status-card-decay">
                  <span className="status-decay-label">琛板噺锛?/span>
                  <span>{status.decayRule}</span>
                </div>
              ) : null}
              {status.removalEntries.length > 0 ? (
                <div className="status-card-removal">
                  <span className="status-removal-label">瑙ｉ櫎锛?/span>
                  <span>{status.removalEntries.join("锛")}</span>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    );
  }

  if (drawer === "logs" || drawer === "dmLog") {
    return <LogPanel state={props.state} />;
  }

  if (drawer === "library") {
    return <LibraryDrawer actor={actor} />;
  }

  if (drawer === "settings") {
    return <SettingsDrawer {...props} />;
  }

  if (drawer === "dmEnemies" && props.role === "dm") {
    return <EnemyRoster actors={enemies} mode="dm" />;
  }

  if (drawer === "dmDistance" && props.role === "dm") {
    const distances = props.state.distances;
    const actors = props.state.actors;
    return (
      <div className="drawer-content">
        {/* ART SLOT: panel-drawer-bg-distance 鈥?400x500 distance map parchment */}
        {distances.length === 0 ? (
          <p className="empty-state">鏆傛棤璺濈鍏崇郴璁板綍銆?/p>
        ) : (
          distances.map((dist) => {
            const from = actors.find((a) => a.id === dist.fromActorId);
            const to = actors.find((a) => a.id === dist.toActorId);
            return (
              <article className="distance-pair-card" key={dist.id}>
                <div className="distance-pair-actors">
                  <span className="distance-actor-name">{from?.name "? "?"}</span>
                  <span className="distance-arrow">鈹佲攣</span>
                  <span className="distance-actor-name">{to?.name "? "?"}</span>
                </div>
                <div className="distance-pair-detail">
                  <span className={`distance-band-pill distance-${dist.band}`}>{dist.band}</span>
                  {dist.height && dist.height !== "鍚屽眰" ? (
                    <span className={`height-badge height-${dist.height}`}>{dist.height}</span>
                  ) : null}
                  {dist.entangled ? <span className="entangled-badge">绾犵紶</span> : null}
                </div>
                <div className="distance-pair-actions">
                  {(["璐磋韩", "杩戣韩", "鐭窛", "涓窛", "杩滆窛", "绂诲満"] as DistanceBand[]).map((band) => (
                    <button
                      type="button"
                      key={band}
                      className={`distance-btn ${dist.band === band ? "active" : ""}`}
                      onClick={() => props.patch((current) => {
                        const updated = { ...current };
                        const idx = updated.distances.findIndex((d) => d.id === dist.id);
                        if (idx >= 0) { updated.distances[idx] = { ...updated.distances[idx], band }; }
                        return dmOverride(updated, `${from?.name "? "?"} 鈫?${to?.name "? "?"} 璺濈鏀逛负${band}`);
                      })}
                    >{band}</button>
                  ))}
                  <button
                    type="button"
                    className={`distance-btn ${dist.entangled ? "active" : ""}`}
                    onClick={() => props.patch((current) => {
                      const updated = { ...current };
                      const idx = updated.distances.findIndex((d) => d.id === dist.id);
                      if (idx >= 0) { updated.distances[idx] = { ...updated.distances[idx], entangled: !updated.distances[idx].entangled }; }
                      return dmOverride(updated, `${from?.name "? "?"} 鈫?${to?.name "? "?"} ${dist.entangled ? "瑙ｉ櫎绾犵紶" : "璁句负绾犵紶"}`);
                    })}
                  >{dist.entangled ? "瑙ｇ籂缂" : "绾犵紶"}</button>
                  {(["鍚屽眰", "楂樺", "浣庡"] as const).map((h) => (
                    <button
                      type="button"
                      key={h}
                      className={`distance-btn ${dist.height === h ? "active" : ""}`}
                      onClick={() => props.patch((current) => {
                        const updated = { ...current };
                        const idx = updated.distances.findIndex((d) => d.id === dist.id);
                        if (idx >= 0) { updated.distances[idx] = { ...updated.distances[idx], height: h }; }
                        return dmOverride(updated, `${from?.name "? "?"} 鈫?${to?.name "? "?"} 楂樺害鏀逛负${h}`);
                      })}
                    >{h}</button>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </div>
    );
  }

  if (drawer === "dmRuling" && props.role === "dm") {
    const pending = props.state.pendingAction;
    const activeActor = props.state.actors.find((a) => a.id === props.state.activeActorId);
    return (
      <div className="drawer-content">
        {/* ART SLOT: panel-drawer-bg-ruling 鈥?400x600 DM ruling panel background */}
        <div className="ruling-status-section">
          <div className="ruling-status-row">
            <span className="ruling-label">缁撶畻鐘舵€?/span>
            <span className="ruling-value">{actionStateLabel(props.state)}</span>
          </div>
          <div className="ruling-status-row">
            <span className="ruling-label">褰撳墠琛屽姩鑰?/span>
            <span className="ruling-value">{activeActor?.name "? "寰呭畾"}</span>
          </div>
          <div className="ruling-status-row">
            <span className="ruling-label">鍔?/span>
            <span className={`ruling-value momentum-pill-sm ${momentumClass(activeActor?.momentum "? "鍚堝娍")}`}>{activeActor?.momentum "? "鍚堝娍"}</span>
          </div>
          <div className="ruling-status-row">
            <span className="ruling-label">寰呯粨绠楀瑷€</span>
            <span className="ruling-value">{pending ? `${pending.actorId} 鈫?${pending.targetId}` : "鏃"}</span>
          </div>
        </div>
        <div className="ruling-section">
          <span className="ruling-section-label">寮哄埗鎴愭嫑</span>
          <div className="flow-buttons">
            {["鎴愭嫑", "澶辫触"].map((item) => (
              <button type="button" key={item} onClick={() => props.patch((current) => dmOverride(current, `寮哄埗${item}`))}>
                {item === "鎴愭嫑" ? "鉁?" : "鉁?"}{item}
              </button>
            ))}
          </div>
        </div>
        <div className="ruling-section">
          <span className="ruling-section-label">浼ゅ涓庢晥闃?/span>
          <div className="flow-buttons">
            {["+1姘旇", "+3姘旇", "+5姘旇", "脳2浼ゅ", "陆浼ゅ", "鏃犳晥"].map((item) => (
              <button type="button" key={item} onClick={() => props.patch((current) => dmOverride(current, `淇敼浼ゅ锛?{item}`))}>{item}</button>
            ))}
          </div>
        </div>
        <div className="ruling-section">
          <span className="ruling-section-label">娣诲姞鐘舵€?/span>
          <div className="flow-buttons">
            {(["杩熸粸", "鐮村彛", "澶辫　", "娴佽", "涓瘨", "鐕冪儳", "鍐荤粨", "鐪╂檿", "灏佺┐"] as StatusName[]).map((name) => (
              <button type="button" key={name} onClick={() => props.patch((current) => dmOverride(current, `娣诲姞鐘舵€侊細${name} 1灞俙))}>{name}</button>
            ))}
          </div>
        </div>
        <div className="ruling-section">
          <span className="ruling-section-label">鍔夸笌璧勬簮</span>
          <div className="flow-buttons">
            {(["闃寸洓", "闃崇洓", "鍚堝娍", "鍦嗚瀺", "宕╁娍", "澶卞娍"] as ShiState[]).map((shi) => (
              <button type="button" key={shi} onClick={() => props.patch((current) => changeMomentum(current, props.state.activeActorId, shi))}>{shi}</button>
            ))}
          </div>
          <div className="flow-buttons" style={{ marginTop: 6 }}>
            {["+1姘旇", "+5姘旇", "鎭㈠鍏ㄨ", "+1姘旈锛堜复姘旓級"].map((item) => (
              <button type="button" key={item} onClick={() => props.patch((current) => dmOverride(current, item))}>{item}</button>
            ))}
          </div>
        </div>
        <div className="ruling-section">
          <span className="ruling-section-label">鍏朵粬瑁佸畾</span>
          <div className="flow-buttons">
            {["淇敼璺濈", "淇敼鍗辨満", "淇敼瑙ｅ瘑", "骞挎挱鏂囨湰", "寮哄埗鍦烘櫙"].map((item) => (
              <button type="button" key={item} onClick={() => props.patch((current) => dmOverride(current, `DM瑁佸畾锛?{item}`))}>{item}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (drawer === "dmHidden" && props.role === "dm") {
    return (
      <div className="drawer-content">
        {enemies.map((enemy) => (
          <article className="enemy-card" key={enemy.id}>
            <strong>{enemy.name}</strong>
            <p>闅愯棌鐩爣锛歿enemy.hiddenGoal "? "鏃"}</p>
            <p>闅愯棌寮辩偣锛歿enemy.publicWeakness "? "鏃"}</p>
            <p>琛屼负鎻愮ず锛歿enemy.behaviorHint "? "鏃"}</p>
          </article>
        ))}
      </div>
    );
  }

  if (drawer === "dmScene" && props.role === "dm") {
    return <CampaignPanel state={props.state} title="DM鍦烘櫙鎶藉眽" />;
  }

  return <p className="empty-state">姝ゆ娊灞変粎鍦ㄥ搴旇韩浠戒笅鍙銆?/p>;
}

// ========== Library Drawer ==========
function LibraryDrawer({ actor }: { actor: Actor }) {
  const [libTab, setLibTab] = useState<"鎷涘紡" | "鍐呭姛" | "鐘舵€" | "瑁呭" | "鏈">("鎷涘紡");
  const [moveSearch, setMoveSearch] = useState("");

  const libTabs: Array<{ key: typeof libTab; label: string }> = [
    { key: "鎷涘紡", label: "鎷涘紡" },
    { key: "鍐呭姛", label: "鍐呭姛" },
    { key: "鐘舵€", label: "鐘舵€? },
    { key: "瑁呭", label: "瑁呭" },
    { key: "鏈", label: "鏈" },
  ];

  const allCatalogMoves = [...ruleCatalog.moves];

  // ---- 鐘舵€佹暟鎹?----
  const statusDefs: Array<{
    name: StatusName; effects: string; decayRule: string; removalEntries: string[];
  }> = [
    { name: "杩熸粸", effects: "姣忓眰锛氳韩鍔?1锛岀Щ姝ユ秷鑰?1鏋氭皵楠", decayRule: "姣忚疆缁撴潫-1灞傦紱鏁磋韩鍔ㄤ綔鍙Щ闄?灞", removalEntries: ["鏁磋韩渚胯", "鏀跺紡/鎶や汉鎷涘紡", "闃熷弸鎻存墜"] },
    { name: "鐮村彛", effects: "姣忓眰锛氭姢浣?1锛屼笅涓€杞捣姣忓眰棰濆鍙楀埌姘旇1鐐", decayRule: "鏀跺紡銆佽皟鎭垨鐗瑰畾瑁呭鍙姷娑堬紱闈炴垬鏂楀満鏅嚜鍔ㄦ秷澶", removalEntries: ["鏀跺垁褰掓伅", "鏁磋韩渚胯", "鐗瑰畾鍐呭姛琚姩"] },
    { name: "澶辫　", effects: "姣忓眰锛氫笉鑳藉０鏄庢壙寮?缁濆紡/寮烘埅鍑伙紱灞傛暟鈮?鏃跺彲琚拷韬", decayRule: "鏁磋韩鍔ㄤ綔绉婚櫎1灞傦紱鏈疆鏈彈缃氬垯鑷姩-1灞", removalEntries: ["鏁磋韩渚胯", "闃熷弸鎻存墜", "鐗瑰畾鎷涘紡"] },
    { name: "娴佽", effects: "姣忓眰锛氭瘡杞粨鏉熸椂鍙楀埌姘旇=灞傛暟鐐逛激瀹", decayRule: "绠€鑽琛€绉婚櫎锛涙垬鏂楀悗鑷姩绉婚櫎", removalEntries: ["绠€鑽琛€", "缁峰甫/閲戝垱鑽", "闃熷弸鏁戞不"] },
    { name: "涓瘨", effects: "姣忓眰锛氭瘡杞粨鏉熸椂鍙楀埌姘旇=灞傛暟鐐逛激瀹筹紝鍥炴皵-1", decayRule: "姣忚疆-1灞傦紱瑙ｆ瘨鑽墿鍙壒閲忕Щ闄", removalEntries: ["瑙ｆ瘨涓?鑽墿", "琛屾皵娉曢棬鎺掓瘨", "闃熷弸鏁戞不"] },
    { name: "鐕冪儳", effects: "姣忓眰锛氭瘡杞粨鏉熸椂鍙楀埌姘旇=灞傛暟鐐逛激瀹筹紱鍙犺嚦3灞傚彲寮曠噧瑁呭鎴栫墿浠", decayRule: "鍊掑湴/鍏ユ按/闃熷弸鎵戠伃鍙Щ闄わ紱姣忚疆鑷姩-1灞傦紙鍙噧鐜涓嶅噺锛", removalEntries: ["鎵戝€?鍏ユ按", "闃熷弸鎻存墜鎵戠伃", "闂伅渚胯"] },
    { name: "鍐荤粨", effects: "姣忓眰锛氳韩鍔?2锛屾寔鎻¤鍙叧闂紝鍓墜涓嶅彲鐢", decayRule: "鐏簮/鍐呭姛闃冲睘鎬у彲绉婚櫎锛涙瘡杞?1灞傦紙甯告俯鐜锛", removalEntries: ["闃冲睘鎬у唴鍔?鎷涘紡", "鐏簮/鐏姌瀛", "闃熷弸鎻存墜"] },
    { name: "鐪╂檿", effects: "姣忓眰锛氫笉鑳藉０鏄庢寮忓嚭鎵嬶紱灞傛暟鈮?鏃朵笉鑳芥埅鍑?搴旀嫑", decayRule: "姣忚疆-1灞傦紱琚繚鎶や竴杞彲鑷姩-1灞", removalEntries: ["闃熷弸淇濇姢鏁磋疆", "鐗瑰畾搴旀嫑/鎶や汉", "鑷剤锛堟瘡杞?1锛"] },
    { name: "灏佺┐", effects: "姣忓眰锛氫綔鐢ㄤ簬鎸囧畾鍏牴锛涜鍏牴瀵瑰簲姘旈涓嶈兘杩涘叆闃存Ы鎴栭槼妲", decayRule: "琛屾皵瑙ｇ┐绉婚櫎锛涙渶闀挎寔缁嚦鎴樻枟缁撴潫", removalEntries: ["琛屾皵瑙ｇ┐", "闃熷弸琛屾皵鏁戞不", "鎴樻枟鍚庤嚜鍔ㄨВ闄"] },
  ];

  return (
    <div className="drawer-content">
      {/* ART SLOT: panel-drawer-bg-library 鈥?400x600 rulebook parchment background */}
      <div className="library-tabs">
        {libTabs.map((tab) => (
          <button
            type="button"
            key={tab.key}
            className={`library-tab-btn ${libTab === tab.key ? "active" : ""}`}
            onClick={() => setLibTab(tab.key)}
          >{tab.label}</button>
        ))}
      </div>

      <div className="library-tab-content">
        {/* === 鎷涘紡 tab === */}
        {libTab === "鎷涘紡" ? (
          <>
            <input
              type="text"
              className="library-search"
              placeholder="鎼滅储鎷涘紡鍚嶆垨鍒嗙被..."
              value={moveSearch}
              onChange={(e) => setMoveSearch(e.target.value)}
            />
            <div className="library-move-list">
              {allCatalogMoves
                .filter((m) => !moveSearch || m.name.includes(moveSearch) || m.category.includes(moveSearch) || m.subCategory.includes(moveSearch))
                .map((move) => (
                  <article className="action-card" key={move.id}>
                    <div className="move-card-header">
                      <strong>{move.name}</strong>
                      <div className="move-card-badges">
                        <span className={`tier-badge tier-${move.tier}`}>{move.tier}</span>
                        <span className="grade-badge">{move.designGrade}</span>
                      </div>
                    </div>
                    <div className="move-card-meta">
                      <span>{move.category}/{move.subCategory}</span>
                      {move.formPosition !== "鏃? ? <span className="form-position-badge">{move.formPosition}</span> : null}
                      <span className="yin-yang-label">{move.yinYangLabel}</span>
                    </div>
                    <div className="move-card-detail">
                      <span className="move-detail-line">鏃剁偣锛歿move.timing} 路 鎶曞叆锛歿move.minimumDice}鏋?/span>
                      <span className="move-detail-line">姘旀€э細{move.qiRequirement}</span>
                      <span className="move-detail-line">鍔匡細{move.momentumRequirement} 鈫?[{move.allowedMomentum.join("/")}]</span>
                    </div>
                    <div className="move-card-effect">
                      <strong>鍩虹鏁堟灉锛?/strong>{move.baseEffect}
                    </div>
                    {move.slotTriggers.length > 0 ? (
                      <div className="move-card-triggers">
                        {move.slotTriggers.map((t, i) => (
                          <span className="move-trigger-line" key={i}>{t}</span>
                        ))}
                      </div>
                    ) : null}
                    <div className="move-card-footer">
                      <span>{move.afterMomentum}</span>
                      <span>{move.resourceFlow}</span>
                      {move.hasIntercept ? <span className="attachment-badge">鎴?/span> : null}
                      {move.hasReact ? <span className="attachment-badge">搴?/span> : null}
                    </div>
                  </article>
                ))}
            </div>
            <p className="hint">鍏?{allCatalogMoves.length} 鏉℃嫑寮忥紙WG澶栧姛+FM娉曢棬锛夛紝鏁版嵁婧愯嚜瑙勫垯涔﹀簱銆?/p>
          </>
        ) : null}

        {/* === 鍐呭姛 tab === */}
        {libTab === "鍐呭姛" ? (
          <>
            {actor.innerArts.length === 0 ? (
              <p className="empty-state">褰撳墠瑙掕壊鏈澶囧唴鍔熴€傚唴鍔熸暟鎹潵鑷鑹叉瀯绛戙€?/p>
            ) : (
              actor.innerArts.map((art) => (
                <article className="inner-art-card" key={art.id}>
                  <div className="inner-art-header">
                    <strong>{art.name}</strong>
                    <span className={`tier-badge tier-${art.tier}`}>{art.tier}</span>
                  </div>
                  <div className="inner-art-body">
                    <div className="inner-art-stat-row">
                      <span className="stat-label">閲嶆暟</span>
                      <span className="stat-value">{art.currentLevel}/{art.maxLevel}</span>
                    </div>
                    <div className="inner-art-stat-row">
                      <span className="stat-label">鍗犵獚</span>
                      <span className="stat-value">{art.occupiedAcupoints.join("銆")}</span>
                    </div>
                    <div className="inner-art-stat-row">
                      <span className="stat-label">璇诲彇鍏牴</span>
                      <span className="stat-value">{art.readRoots.join("銆")}</span>
                    </div>
                    <div className="inner-art-stat-row">
                      <span className="stat-label">琚姩</span>
                      <span className="stat-value">{art.passive || "鏃"}</span>
                    </div>
                  </div>
                </article>
              ))
            )}
          </>
        ) : null}

        {/* === 鐘舵€?tab === */}
        {libTab === "鐘舵€? ? (
          <div className="library-status-list">
            {/* ART SLOT: status-catalog-icons 鈥?24x24 status type icons */}
            {statusDefs.map((def) => (
              <article className={`status-card-full status-card-${statusCSSKey(def.name)}`} key={def.name}>
                <div className="status-card-head">
                  <span className={`status-badge-lg status-${statusCSSKey(def.name)}`}>{def.name}</span>
                </div>
                <div className="status-card-effects">
                  <span className="status-effects-label">鏁堟灉锛?/span>
                  <span className="hint">{def.effects}</span>
                </div>
                <div className="status-card-decay">
                  <span className="status-decay-label">琛板噺锛?/span>
                  <span>{def.decayRule}</span>
                </div>
                <div className="status-card-removal">
                  <span className="status-removal-label">瑙ｉ櫎锛?/span>
                  <span>{def.removalEntries.join("锛")}</span>
                </div>
              </article>
            ))}
            <p className="hint">鍏?{statusDefs.length} 绉嶇姸鎬佺被鍨嬨€?/p>
          </div>
        ) : null}

        {/* === 瑁呭 tab === */}
        {libTab === "瑁呭" ? (
          <div className="library-equip-section">
            {/* ART SLOT: equip-catalog-icons 鈥?32x32 equipment slot icons */}
            <article className="inner-art-card">
              <div className="inner-art-header"><strong>姝﹀櫒锛堜富鎵?鍓墜锛?/strong></div>
              <div className="inner-art-body">
                <p className="hint">瑙掕壊鍙悓鏃舵寔鎻′富鎵嬫鍣ㄥ拰鍓墜姝﹀櫒锛堟垨鐩剧墝锛夈€傚弻鎵嬫鍣ㄥ崰鐢ㄤ富鍓墜銆?/p>
                <p className="hint">姝﹀櫒绫诲埆锛氬垁銆佸墤銆佺煭鍏点€侀暱鍏点€佽蒋鍏点€佹殫鍣ㄣ€佸紦寮┿€佺浘鐗屻€?/p>
                <p className="hint">鎸佹彙鏂瑰紡锛氫富鎵嬨€佸壇鎵嬨€佸弻鎵嬨€佹殫钘忋€佹姇鎺枫€佽濉€?/p>
              </div>
            </article>
            <article className="inner-art-card">
              <div className="inner-art-header"><strong>鎶ょ敳锛堜笂瑁?涓嬭锛?/strong></div>
              <div className="inner-art-body">
                <p className="hint">涓婅锛氭姢蹇冮暅銆佺毊鐢层€侀攣瀛愮敳銆佽鏈嶇瓑銆?/p>
                <p className="hint">涓嬭锛氭姢鑵裤€佽儷鐢层€佹闈淬€佺粦鑵跨瓑銆?/p>
                <p className="hint">鎶ょ敳鍙彁渚涙姢浣撳姞鍊笺€佸睘鎬т慨姝ｆ垨涓存椂姘旈銆?/p>
              </div>
            </article>
            <article className="inner-art-card">
              <div className="inner-art-header"><strong>浣╅グ锛堥檺1浠讹級</strong></div>
              <div className="inner-art-body">
                <p className="hint">鐜変僵銆佹姢绗︺€侀鍥娿€佷护鐗屻€佸畻闂ㄤ俊鐗╃瓑銆?/p>
                <p className="hint">浣╅グ閫氬父鎻愪緵琚姩淇銆佺壒娈婅鍙垨姘旈鏉ユ簮銆?/p>
              </div>
            </article>
            <article className="inner-art-card">
              <div className="inner-art-header"><strong>鑽墿/鍣ㄥ叿/鍧愰獞/鏂囦功/鏉傜墿</strong></div>
              <div className="inner-art-body">
                <p className="hint">鑽墿锛氬崟娆′娇鐢紝鎭㈠姘旇銆佺Щ闄ょ姸鎬佹垨鎻愪緵涓存椂澧炵泭銆?/p>
                <p className="hint">鍣ㄥ叿锛氬紑閿侀拡銆佺伀鑽€佺怀绱€佺伅绗肩瓑宸ュ叿銆?/p>
                <p className="hint">鍧愰獞锛氭彁渚涚Щ鍔ㄥ姞鎴愭垨涓存皵銆?/p>
              </div>
            </article>
            <p className="hint">瑁呭鏍间笂闄愶細鑳屽寘40鏍硷紝浣╅グ1浠躲€傚凡瑁呭鐗╁搧璁″叆鑳屽寘銆?/p>
          </div>
        ) : null}

        {/* === 鏈 tab === */}
        {libTab === "鏈" ? (
          <div className="library-term-list">
            {/* ART SLOT: term-glossary-icons 鈥?20x20 category icons */}
            {[
              { label: "姘旈绯荤粺", terms: [
                { name: "姘旈", def: "浜ら攱涓厤缃€佹姇鍏ャ€佷繚瀛樹笌鍥炴敹鐨勮祫婧愬崟浣嶃€? },
                { name: "姘旀睜", def: "鏈姇鎺风殑甯歌姘旈鎬绘睜銆? },
                { name: "姘旀捣", def: "宸叉姇鎺枫€佸彲璋冨害鐨勫父瑙勬皵楠板尯銆? },
                { name: "閿佹皵", def: "鏈瀹ｈ█涓凡閿佸畾鎶曞叆鐨勬皵楠板尯銆? },
                { name: "闃存Ы/闃虫Ы", def: "鍒嗛厤鍒伴槾闈?闃抽潰鐨勬皵楠板尯銆? },
                { name: "鎭簱", def: "宸蹭娇鐢ㄦ皵楠扮殑鍥炴敹鏆傚瓨鍖恒€? },
                { name: "涓存皵鍖", def: "涓存椂姘旈鐨勫瓨鏀惧尯锛岄粯璁や娇鐢ㄥ悗娑堝け銆? },
              ]},
              { label: "鎷涘紡涓庢垚鎷", terms: [
                { name: "鎴愭嫑", def: "婊¤冻鎵€鏈夐棬妲涘悗鐨勭‘璁ょ姸鎬併€? },
                { name: "鍩虹鏁堟灉", def: "鎴愭嫑鍚庡繀瀹氬彂鐢熺殑鍥哄畾缁撴灉銆? },
                { name: "妲藉€艰Е鍙", def: "鏍规嵁闃村€?闃冲€?鍚堝€?闃撮槼宸Е鍙戦澶栨晥鏋溿€? },
                { name: "钀芥灉", def: "鎶婃渶缁堢粨鏋滃啓鍏ヨ褰曠殑姝ラ銆? },
                { name: "鏈€浣庢姇鍏", def: "澹版槑鎷涘紡蹇呴』鐨勬渶灏戞皵楠版暟銆? },
              ]},
              { label: "寮忎綅", terms: [
                { name: "璧峰紡", def: "绗竴妗ｏ紝鎶曞叆灏戙€佸ソ澹版槑銆? },
                { name: "鎵垮紡", def: "绗簩妗ｏ紝鎺ㄨ繘鎷涘紡銆? },
                { name: "杞紡", def: "绗笁妗ｏ紝鎷嗘嫑/鍓婂娍/缂存銆? },
                { name: "鏀跺紡", def: "绗洓妗ｏ紝闃插畧/鍥炴敹銆? },
                { name: "缁濆紡", def: "鏈€楂樻。锛屽崟鍔?楂樻姇鍏?鏄庣‘椋庨櫓銆? },
              ]},
              { label: "鍝嶅簲", terms: [
                { name: "鎴嚮", def: "瀹ｈ█鍚庛€佹垚鎷涘墠锛屽共棰勫姩浣滄槸鍚︽垚绔嬨€? },
                { name: "搴旀嫑", def: "鎴愭嫑鍚庛€佽惤鏋滃墠锛屽鐞嗙粨鏋溿€? },
                { name: "鍝嶅簲鎸傝浇", def: "鎴嚮/搴旀嫑鎸傝浇鍦ㄥ鍔?娉曢棬涓婄殑鐙珛妯″潡銆? },
              ]},
              { label: "鍔", terms: [
                { name: "闃寸洓/闃崇洓", def: "鍋忛槻瀹?鍋忚繘鏀荤殑鍔块潰銆? },
                { name: "鍚堝娍", def: "闃撮槼鍗忚皟锛岄€傚悎涓珮绾ф嫑寮忋€? },
                { name: "鍦嗚瀺", def: "璐€氬渾婊★紝寮烘嫑/缁濆紡杩涘叆鏉′欢銆? },
                { name: "宕╁娍", def: "鍔块潰鐡﹁В锛屾湰杞笉鑳芥寮忓嚭鎵嬨€? },
                { name: "澶卞娍", def: "鍔茶矾鏁ｄ贡锛屽己鎷涗笉鑳藉０鏄庛€? },
              ]},
            ].map((group) => (
              <div className="term-group" key={group.label}>
                <h4 className="term-group-label">{group.label}</h4>
                {group.terms.map((term) => (
                  <div className="term-entry" key={term.name}>
                    <span className="term-name">{term.name}</span>
                    <span className="term-def">{term.def}</span>
                  </div>
                ))}
              </div>
            ))}
            <p className="hint">鏈婧愯嚜瑙勫垯涔﹀簱_鍐呮祴.01 路 鏈琛ㄥ畬鏁寸増锛?6鏉★級</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ========== Settings Drawer ==========
function SettingsDrawer(props: DeskProps) {
  const session = props.session;
  return (
    <div className="drawer-content">
      {/* ART SLOT: panel-drawer-bg-settings 鈥?400x550 settings scroll parchment */}

      <div className="settings-section">
        <span className="settings-section-label">寮€鍙戜笌璋冭瘯</span>
        <label className="check-row">
          <input
            type="checkbox"
            checked={session.developerMode}
            onChange={(event) => {
              saveAppSession({ ...session, developerMode: event.target.checked });
            }}
          />
          寮€鍙戣€呮ā寮忥紙鏄剧ず瀹屾暣鐘舵€佷笌璋冭瘯淇℃伅锛"        </label>
        <p className="hint">鏇存敼灏嗗湪涓嬫椤甸潰鍔犺浇鏃剁敓鏁堛€?/p>
        {session.developerMode ? (
          <label className="check-row">
            <input
              type="checkbox"
              checked={props.debugView}
              onChange={(event) => props.setDebugView(event.target.checked)}
            />
            璋冭瘯瑙嗗浘锛堟樉绀篋M瀹屾暣鏁版嵁锛"          </label>
        ) : null}
      </div>

      <div className="settings-section">
        <span className="settings-section-label">LAN 鑱旀満鐘舵€?/span>
        <div className="lan-status-display">
          <span className={`lan-status-dot ${props.state.logs.length > 0 ? "connected" : ""}`} />
          <span>{
            session.identity === "dm" ? "DM涓绘満" :
            session.identity === "player" ? "鐜╁" : "鏃佽"
          } 路 鎴块棿 {session.roomCode || "鏈垱寤"}</span>
        </div>
      </div>

      <div className="settings-section">
        <span className="settings-section-label">瀛樻。绠＄悊</span>
        <div className="flow-buttons">
          <button type="button" onClick={() => { saveCombatState(props.state); saveAppSession(session); }}>
            馃捑 淇濆瓨娓告垙
          </button>
          <button type="button" onClick={() => {
            const loaded = loadCombatState();
            if (loaded) { props.patch(() => loaded); }
          }}>
            馃搨 璇诲彇瀛樻。
          </button>
          <button type="button" className="danger-btn" onClick={() => {
            if (window.confirm("纭畾瑕侀噸缃墍鏈夋父鎴忔暟鎹紵姝ゆ搷浣滀笉鍙挙閿€銆")) {
              props.patch((current) => clearCombatState());
              props.go("home", clearAppSession());
            }
          }}>
            馃攧 閲嶇疆娓告垙
          </button>
        </div>
      </div>

      <div className="settings-section">
        <span className="settings-section-label">娓告垙閫夐」</span>
        <label className="check-row">
          <input
            type="checkbox"
            checked={props.autoRollOnEnter}
            onChange={(event) => props.setAutoRollOnEnter(event.target.checked)}
          />
          杩涘叆鍦烘櫙鏃惰嚜鍔ㄦ姇鎺锋皵楠"        </label>
        <label className="settings-number-row">
          <span>鍝嶅簲绐楀彛璁℃椂锛堢锛?/span>
          <input
            type="number"
            min={5}
            max={60}
            value={props.windowTimerDuration}
            onChange={(event) => {
              const v = Math.max(5, Math.min(60, Number(event.target.value) || 15));
              props.setWindowTimerDuration(v);
            }}
            style={{ width: 80 }}
          />
        </label>
      </div>

      <div className="settings-section">
        <span className="settings-section-label">鐣岄潰涓庤瑷€</span>
        <label className="check-row">
          <input type="checkbox" disabled />
          娣辫壊缇婄毊绾告ā寮忥紙寮€鍙戜腑锛"        </label>
        <label className="check-row">
          <input type="checkbox" disabled />
          绻佷綋涓枃锛堝紑鍙戜腑锛"        </label>
        <p className="hint">鏇村涓婚鍜岃瑷€閫夐」灏嗗湪鍚庣画鐗堟湰涓紑鏀俱€?/p>
      </div>

      <div className="settings-section">
        <span className="settings-section-label">鐗堟湰淇℃伅</span>
        <p className="hint">澶ф姹熸箹TRPG 路 鍐呮祴绗竴鐗?路 2026骞?鏈?0鏃?/p>
        <p className="hint">v0.1.0 路 鎷涘紡搴撶粺涓€鐗?路 14澶栧姛+娉曢棬</p>
      </div>
    </div>
  );
}

function drawerTitle(drawer: DrawerId) {
  const titles: Record<DrawerId, string> = {
    character: "浜虹墿璇︽儏",
    sixRoots: "鍏牴璇︽儏",
    innerArt: "鍐呭姛涓庣獚浣",
    inventory: "鑳屽寘",
    moves: "鎷涘紡涓庡姩浣",
    statuses: "鐘舵€佽鎯",
    logs: "鏃ュ織鍥炴斁",
    library: "璧勬枡搴",
    settings: "璁剧疆",
    dmEnemies: "鏁屼汉瀹屾暣璇︽儏",
    dmDistance: "璺濈璋冩暣",
    dmRuling: "瑁佸畾",
    dmHidden: "闅愯棌淇℃伅绠＄悊",
    dmScene: "鍦烘櫙",
    dmLog: "DM鏃ュ織",
  };
  return titles[drawer];
}

function drawerShortTitle(drawer: DrawerId) {
  const titles: Record<DrawerId, string> = {
    character: "浜虹墿",
    sixRoots: "鍏牴",
    innerArt: "鍐呭姛",
    inventory: "鑳屽寘",
    moves: "鎷涘紡",
    statuses: "鐘舵€",
    logs: "鏃ュ織",
    library: "璧勬枡",
    settings: "璁剧疆",
    dmEnemies: "鏁屼汉",
    dmDistance: "璺濈",
    dmRuling: "瑁佸畾",
    dmHidden: "闅愯棌",
    dmScene: "鍦烘櫙",
    dmLog: "DM鏃ュ織",
  };
  return titles[drawer];
}

function EnemyRoster({ actors, mode }: { actors: Actor[]; mode: "public" | "dm" }) {
  return (
    <section className="panel enemy-roster">
      <h2>{mode === "dm" ? "鏁屼汉瀹屾暣璇︽儏" : "鏁屾柟鍏紑鍗"}</h2>
      {actors.map((actor) => (
        <article className="enemy-card" key={actor.id}>
          <UnitCard actor={actor} mode={mode === "dm" ? "enemyDm" : "enemyPublic"} />
          <p>{actor.publicNote}</p>
          {actor.publicWeakness ? <p><strong>鍏紑寮辩偣锛?/strong>{actor.publicWeakness}</p> : null}
          {mode === "dm" ? (
            <>
              <p><strong>闅愯棌鐩爣锛?/strong>{actor.hiddenGoal "? "鏃"}</p>
              <p><strong>琛屼负鎻愮ず锛?/strong>{actor.behaviorHint "? "鏃"}</p>
              <p><strong>鍏ュ満鏉′欢锛?/strong>{actor.entryCondition "? "鏃"}</p>
              <p><strong>鎺夎惤/绾跨储锛?/strong>{actor.lootOrClue "? "鏃"}</p>
              <p><strong>鍝嶅簲锛?/strong>{actor.responses.map((item) => item.moveName).join("銆") || "鏃"}</p>
            </>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function DmControlPanel(props: DmDeskParameters) {
  const activeMomentum = props.state.actors.find((a) => a.id === props.state.activeActorId)?.momentum "? "鍚堝娍";
  return (
    <section className="panel dm-console">
      <div className="panel-title">
        <img src={iconMap.dm} alt="" />
        <h2>瑁佸畾闈㈡澘</h2>
      </div>
      <div className="flow-buttons">
        <button type="button" onClick={props.onStartScene}>寮€濮嬪満鏅?/button>
        <button type="button" onClick={props.onIntercept} disabled={!props.state.pendingAction}>鎴嚮鍙栨秷</button>
        <button type="button" onClick={props.onForm} disabled={!props.state.pendingAction}>鍒ゅ畾鎴愭嫑</button>
        <button type="button" onClick={props.onReact} disabled={!props.state.pendingAction}>鐩爣搴旀嫑</button>
        <button type="button" onClick={props.onOutcome} disabled={!props.state.pendingAction}>搴旂敤钀芥灉</button>
        <button type="button" onClick={props.onEndRound}>杞缁撴潫</button>
        <button type="button" onClick={props.onRegulateBreath}>璋冩伅</button>
        <button type="button" onClick={props.onReflection}>杩旂収</button>
        <button type="button" onClick={props.onExpireSource}>鏉ユ簮澶辨晥</button>
      </div>
      <label>
        鍔垮彉鍖?        <select value={activeMomentum} onChange={(event) => props.onMomentum(event.target.value as ShiState)}>
          {(["闃寸洓", "闃崇洓", "鍚堝娍", "鍦嗚瀺", "宕╁娍", "澶卞娍"] as ShiState[]).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label>
        鎵嬪姩瑁佸畾 / 骞挎挱鏂囨湰
        <textarea value={props.dmNote} onChange={(event) => props.setDmNote(event.target.value)} />
      </label>
      <button className="secondary-action" type="button" onClick={props.onOverride}>鍐欏叆瑁佸畾鏃ュ織</button>
    </section>
  );
}

type DmDeskParameters = Parameters<typeof DmCombatDesk>[0];

function BroadcastPreview({ state }: { state: CombatState }) {
  return (
    <section className="panel">
      <h2>骞挎挱缁撶畻棰勮</h2>
      <p>{state.logs.find((log) => log.public)?.message "? "鏆傛棤鍏紑缁撶畻銆"}</p>
      <p className="hint">DM 鍙湪瑁佸畾闈㈡澘淇敼钀芥灉銆佸娍鍙樺寲銆侀€€鍦哄拰鍏紑淇℃伅锛涙瘡娆¤瀹氬啓鍏ユ棩蹇椼€?/p>
    </section>
  );
}

function LogPanel({ state }: { state: CombatState }) {
  return (
    <section className="panel log-panel">
      <h2>鏃ュ織鍥炴斁</h2>
      <div className="log-list">
        {state.logs.map((log) => (
          <article key={log.id}>
            <span>{log.type}</span>
            <p>{log.message}</p>
            <small>绗瑊log.round}杞?路 {new Date(log.createdAt).toLocaleTimeString()}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function PlaceholderPage({ session, go }: { session: AppSession; go: (route: AppSession["route"]) => void }) {
  const title = session.route === "packs" ? "鍥㈠寘绠＄悊" : session.route === "library" ? "璧勬枡搴" : "璁剧疆";
  return (
    <section className="home-screen">
      <div className="panel home-hero">
        <h2>{title}</h2>
        <p>鏈疆鍏堝缓绔嬪叆鍙ｅ拰椤甸潰灞傜骇锛涘悗缁啀鎺?xlsx 瀵煎叆銆佽鍒欒祫鏂欐绱㈠拰姝ｅ紡璁剧疆椤广€?/p>
        <button type="button" onClick={() => go("home")}>杩斿洖棣栭〉</button>
      </div>
    </section>
  );
}

function regulateFirstRestDie(
  patch: (updater: (current: CombatState) => CombatState) => void,
  state: CombatState,
  actorId: string,
) {
  const die = state.dice.find((item) => item.ownerId === actorId && item.zone === "QI_REST");
  if (!die) {
    patch((current) => dmOverride(current, "鎭簱娌℃湁鍙皟鎭皵楠般€"));
    return;
  }
  patch((current) => regulateBreath(current, actorId, [die.id]));
}

function canDragDieToSlot(
  state: CombatState,
  die: QiDie | undefined,
  activeActorId: string,
  slot: "yin" | "yang",
): { allowed: boolean; reason": string } {
  if (!die) return { allowed: false, reason: "鏈壘鍒版皵楠般€? };
  if (die.ownerId !== activeActorId) {
    return { allowed: false, reason: "鍙湁褰撳墠琛屽姩鑰呭彲浠ユ姇鍏ユ皵楠般€? };
  }
  if (false && die.ownerId !== state.activeActorId) {
    return { allowed: false, reason: "褰撳墠琛屽姩鑰呭皻鏈疆鍒版姘旈涓讳汉銆? };
  }
  if (state.pendingAction) {
    return { allowed: false, reason: "琛屽姩宸茶繘鍏ュ搷搴旀垨缁撶畻锛屼笉鑳藉啀璋冩暣閿佹皵銆? };
  }
  if (state.phase !== "scene" && state.phase !== "declare") {
    return { allowed: false, reason: "褰撳墠鍙兘鍦ㄩ€夋嫨鍔ㄤ綔鎴栧瑷€鍓嶆姇鍏ユ皵楠般€? };
  }
  if (die.zone !== "QI_SEA" && die.zone !== "TEMP_QI" && die.zone !== "QI_LOCK") {
    // Also allow dice that are in slots (QI_LOCK) to be moved 鈥?they can be dragged between slots or out
    return { allowed: false, reason: "姝ら涓嶅湪鍙搷浣滃尯鍩熴€? };
  }
  if (die.value === null) {
    return { allowed: false, reason: "姝ら灏氭湭鎶曞嚭锛屽厛鎶曟幏鍏ユ皵娴枫€? };
  }
  return { allowed: true };
}

function actionStateLabel(state: CombatState) {
  if (state.pendingAction?.formed) return "鍝嶅簲鎴栬惤鏋?;
  if (state.pendingAction) return "绛夊緟鍝嶅簲";
  if (state.phase === "round_end") return "鍥炲悎鏁寸悊";
  if (state.phase === "initiative") return "鍏堝悗纭";
  if (state.phase === "setup") return "鍑嗗琛屽姩";
  return "鍙瑷€";
}

function actionStateHint(state: CombatState) {
  if (state.pendingAction?.formed) return "鐩爣鍙簲鎷涳紱鏃犱汉鍝嶅簲鏃惰繘鍏ヨ惤鏋溿€?;
  if (state.pendingAction) return "鍝嶅簲绐楀彛宸叉墦寮€锛涘彲鍝嶅簲鎴栬烦杩囥€?;
  if (state.phase === "round_end") return "鏁寸悊鐘舵€併€佽皟鎭垨寮€濮嬩笅涓€杞€?;
  if (state.phase === "initiative") return "DM 纭鍏堝悗鍚庯紝鏁翠綋鎶曟幏姘旈鍏ユ皵娴枫€?;
  if (state.phase === "setup") return "涓绘寔浜烘帹杩涘満鏅悗寮€濮嬭鍔ㄣ€?;
  return "閫夋嫨鍔ㄤ綔鍗★紝鎶曞叆姘旈鍒伴槾妲?闃虫Ы鍚庡瑷€銆?;
}

function displayActionReasons(reasons: string[]) {
  return reasons
    .map((reason) => reason.replace("褰撳墠鏃剁偣涓嶅厑璁稿瑷€", "褰撳墠琛屽姩鐘舵€佷笉鑳藉瑷€"))
    .join("銆");
}

function momentumClass(momentum: ShiState): string {
  const map: Record<ShiState, string> = {
    闃寸洓: "shi-yin",
    闃崇洓: "shi-yang",
    鍚堝娍: "shi-he",
    鍦嗚瀺: "shi-harmony",
    宕╁娍: "shi-collapse",
    澶卞娍: "shi-lost",
  };
  return map[momentum] "? "shi-he";
}

function statusCSSKey(name: string): string {
  const map: Record<string, string> = {
    杩熸粸: "chizhi",
    鐮村彛: "pokou",
    澶辫　: "shiheng",
    娴佽: "liuxue",
    涓瘨: "zhongdu",
    鐕冪儳: "ranshao",
    鍐荤粨: "dongjie",
    鐪╂檿: "xuanyun",
    灏佺┐: "fengxue",
  };
  return map[name] "? "default";
}

function identityLabel(identity: AppSession["identity"]) {
  if (identity === "dm") return "DM";
  if (identity === "player") return "鐜╁";
  if (identity === "spectator") return "鏃佽";
  return "鏈叆甯?;
}

function generateLanRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "LAN-";
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
