import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyOutcome,
  canDeclareAction,
  changeMomentum,
  commitDiceRollResults,
  declareAction,
  dmSetDistance,
  dmOverride,
  endRound,
  enterScene,
  equipItem,
  expireSource,
  formMove,
  getBasicActionAvailability,
  regulateBreath,
  resolveInterceptSuccess,
  resolveReact,
  skipReact,
  unequipItem,
  useInventoryItem,
  useReflection,
  visibleForPlayer,
} from "../combat/combatEngine";
import type { BasicActionType } from "../combat/combatEngine";
import {
  clearAppSession,
  clearCombatState,
  loadAppSession,
  loadCombatState,
  saveAppSession,
  saveCombatState,
} from "../combat/storage";
import type { Actor, AppSession, CombatState, DistanceBand, InventoryCategory, InventoryItem, Move, QiDie, QiZone } from "../combat/types";
import { deriveTargetState } from "../lib/combat/targetValidation";
import { advanceAutoDm } from "../lib/combat/autoDm";
import { createLanClient, type LanClient, type LanConnectionStatus } from "../net/lanClient";
// PhaserCombatBoard replaced by TacticalCombatStage in PHASE2
import { QiDiceRollOverlay } from "../dice3d/QiDiceRollOverlay";
import type { DiceRollResult } from "../dice3d/diceTypes";
import { TitleBar } from "./layouts/TitleBar";
import { MainToolbar } from "./layouts/MainToolbar";
import { RoundStatusBar } from "./layouts/RoundStatusBar";
import { MainWorkspace } from "./layouts/MainWorkspace";
import { LeftInfoPanel } from "./layouts/LeftInfoPanel";
import { CenterCombatZone } from "./layouts/CenterCombatZone";
import { RightActionPanel } from "./layouts/RightActionPanel";
import { BottomStatusBar } from "./layouts/BottomStatusBar";
import { CombatShell } from "./combat/CombatShell";
import { TopCombatBar } from "./combat/TopCombatBar";
import { LeftCombatPanel } from "./combat/LeftCombatPanel";
import { CenterCombatPanel } from "./combat/CenterCombatPanel";
import { RightCombatPanel } from "./combat/RightCombatPanel";
import { PhaseActionBar } from "./combat/PhaseActionBar";
import { CombatStage as TacticalCombatStage } from "./combat/stage/CombatStage";
import { buildStageData } from "../data/mockCombatData";
import { EnemyPublicDrawer } from "./combat/enemy/EnemyPublicDrawer";
import { QiDiceDock } from "./combat/dice/QiDiceDock";
import { PlayerResponseWorkbench } from "./combat/player/PlayerResponseWorkbench";
import { DmControlPanel } from "./combat/dm/DmControlPanel";
import { DebugPanel } from "./debug/DebugPanel";
import { LibraryPage, PacksPage, SettingsPage } from "./pages/SupportPages";

const zoneLabels: Record<QiZone, string> = {
  QI_POOL: "气池",
  QI_SEA: "气海",
  QI_LOCK: "锁气",
  QI_REST: "息库",
  TEMP_QI: "临气区",
  YIN_SLOT: "阴槽",
  YANG_SLOT: "阳槽",
};

const zoneOrder: QiZone[] = ["QI_POOL", "QI_SEA", "TEMP_QI", "QI_LOCK", "YIN_SLOT", "YANG_SLOT", "QI_REST"];

const categoryLabels: Record<InventoryCategory, string> = {
  weapon: "兵器",
  armor: "护具",
  accessory: "佩饰",
  tool: "器具",
  medicine: "药物",
  mount: "坐骑",
  document: "文书",
  misc: "杂物",
};

const iconMap = {
  character: "/assets/icons/png128/001_player_character_角色.png",
  inventory: "/assets/icons/png128/002_inventory_背包.png",
  combat: "/assets/icons/png128/006_combat_交锋.png",
  qi: "/assets/icons/png128/009_qi_dice_气骰.png",
  response: "/assets/icons/png128/008_response_响应.png",
  momentum: "/assets/icons/png128/011_momentum_势.png",
  dm: "/assets/icons/png128/040_dm_tools_DM工具.png",
  world: "/assets/icons/png128/005_world_世界.png",
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

interface DiceRollRequest {
  dice: QiDie[];
  mode: "enterScene" | "reroll";
}

interface DeclarationDraft {
  actorId: string;
  moveId: string;
  targetId: string;
  yinSlotIds: string[];
  yangSlotIds: string[];
}

interface PromptState {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
}

function targetCandidatesFor(state: CombatState, actor: Actor, move?: Move): Actor[] {
  const targetRule = move?.targetRange ?? "";
  const living = state.actors.filter((candidate) => candidate.hp > 0);

  if (/自身|自己/.test(targetRule)) return [actor];
  if (/队友|同伴|护人/.test(targetRule)) {
    return living.filter((candidate) => candidate.side === actor.side);
  }
  if (/任意|所有角色|任一角色/.test(targetRule)) return living;
  return living.filter((candidate) => candidate.id !== actor.id && candidate.side !== actor.side);
}

export function App() {
  const [state, setState] = useState<CombatState>(() => loadCombatState());
  const [session, setSession] = useState<AppSession>(() => loadAppSession());
  const [declarationDraft, setDeclarationDraft] = useState<DeclarationDraft>({
    actorId: "pc-shen-qing",
    targetId: "enemy-short-blade",
    moveId: "move-rain-step-cut",
    yinSlotIds: [],
    yangSlotIds: [],
  });
  const [selectedDice, setSelectedDice] = useState<string[]>([]);
  const [slotHint, setSlotHint] = useState("");
  const [dmNote, setDmNote] = useState("雨势加重，巡检火把已经到桥头。");
  const [debugView, setDebugView] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<DrawerId | null>(null);
  const [lanUrl, setLanUrl] = useState("ws://localhost:8787");
  const [lanStatus, setLanStatus] = useState<LanConnectionStatus>("idle");
  const [lanDetail, setLanDetail] = useState("");
  const [rollRequest, setRollRequest] = useState<DiceRollRequest | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [selectedCombatantId, setSelectedCombatantId] = useState<string | undefined>();
  const [actedActorIds, setActedActorIds] = useState<Set<string>>(new Set());
  const [selectedBasicAction, setSelectedBasicAction] = useState<BasicActionType | null>(null);
  const [autoDmStatus, setAutoDmStatus] = useState("");
  const lanClientRef = useRef<LanClient | null>(null);

  const playerActorId = session.selectedActorId ?? "pc-shen-qing";
  const selectedTargetId = declarationDraft.targetId;
  const selectedMoveId = declarationDraft.moveId;
  const slotDice = { yin: declarationDraft.yinSlotIds, yang: declarationDraft.yangSlotIds };
  const playerState = useMemo(() => visibleForPlayer(state, playerActorId), [state, playerActorId]);
  const controlledActorId = session.identity === "dm" ? state.activeActorId : playerActorId;
  const controlledActor = state.actors.find((actor) => actor.id === controlledActorId) ?? state.actors[0];

  useEffect(() => saveCombatState(state), [state]);
  useEffect(() => saveAppSession(session), [session]);

  useEffect(() => {
    const isPlayerCombat = session.route === "playerCombat" || session.route === "player";
    if (!session.autoDmEnabled || session.identity !== "player" || !isPlayerCombat) {
      setAutoDmStatus("");
      return;
    }

    const step = advanceAutoDm(state, playerActorId);
    if (step.decision === "idle" || step.decision === "waiting_player") {
      setAutoDmStatus(step.message.trim());
      return;
    }

    setAutoDmStatus("自动 DM 正在按规则处理当前时点……");
    const timer = window.setTimeout(() => {
      setState(step.state);
      setAutoDmStatus(step.message.trim());
    }, 650);
    return () => window.clearTimeout(timer);
  }, [playerActorId, session.autoDmEnabled, session.identity, session.route, state]);

  useEffect(() => {
    if (!selectedBasicAction && !controlledActor.moves.some((move) => move.id === selectedMoveId)) {
      setSelectedMoveId(controlledActor.moves[0]?.id ?? "");
      setSelectedDice([]);
      setSlotDice({ yin: [], yang: [] });
    }
  }, [controlledActor, selectedBasicAction, selectedMoveId]);

  useEffect(() => {
    const firstMove = controlledActor.moves[0];
    const firstTarget = targetCandidatesFor(state, controlledActor, firstMove)[0];
    setDeclarationDraft({
      actorId: controlledActor.id,
      moveId: firstMove?.id ?? "",
      targetId: firstTarget?.id ?? controlledActor.id,
      yinSlotIds: [],
      yangSlotIds: [],
    });
    setSelectedDice([]);
    setSelectedBasicAction(null);
  }, [controlledActor.id, state.activeActorId]);

  function setSelectedTargetId(targetId: string) {
    setDeclarationDraft((current) => ({ ...current, targetId }));
  }

  function setSelectedMoveId(moveId: string) {
    setDeclarationDraft((current) => ({ ...current, moveId }));
  }

  function setSlotDice(
    next: { yin: string[]; yang: string[] } | ((current: { yin: string[]; yang: string[] }) => { yin: string[]; yang: string[] }),
  ) {
    setDeclarationDraft((current) => {
      const previous = { yin: current.yinSlotIds, yang: current.yangSlotIds };
      const resolved = typeof next === "function" ? next(previous) : next;
      return { ...current, yinSlotIds: resolved.yin, yangSlotIds: resolved.yang };
    });
  }

  function patch(updater: (current: CombatState) => CombatState) {
    setState((current) => updater(current));
  }

  function clearActionDraft() {
    setSelectedDice([]);
    setSlotDice({ yin: [], yang: [] });
    setSelectedBasicAction(null);
  }

  function go(route: AppSession["route"], patchSession: Partial<AppSession> = {}) {
    setSession((current) => ({ ...current, ...patchSession, route }));
    setActiveDrawer(null);
  }

  function resetAll() {
    setPrompt({
      title: "清空本地存档？",
      message: "这会重置当前房间、角色分配和交锋进度。此操作无法撤销。",
      confirmLabel: "确认清空",
      cancelLabel: "保留存档",
      destructive: true,
      onConfirm: () => {
        setState(clearCombatState());
        setSession(clearAppSession());
        clearActionDraft();
        setActedActorIds(new Set());
      },
    });
  }

  function enterAs(identity: "dm" | "player" | "spectator") {
    const route = identity === "dm" ? "dmScene" : "playerScene";
    go(route, { identity, gameMode: "scene" });
  }

  function canControlActor(actorId: string) {
    if (session.identity === "dm") return true;
    return session.identity === "player" && actorId === playerActorId;
  }

  function showPermissionDenied(message = "当前身份只能查看，不能修改权威游戏状态。") {
    setPrompt({ title: "权限不足", message });
  }

  function setAutoDmEnabled(enabled: boolean) {
    if (session.identity === "spectator") {
      showPermissionDenied("旁观者不能启用测试自动 DM。");
      return;
    }
    setSession((current) => ({ ...current, autoDmEnabled: enabled }));
  }

  function startLanRoom() {
    const roomCode = /^LAN-[A-Z0-9]{4}$/.test(session.roomCode) ? session.roomCode : generateLanRoomCode();
    setSession((current) => ({ ...current, roomCode, identity: "dm" }));
    lanClientRef.current?.close();
    const client = createLanClient({
      url: lanUrl,
      roomCode,
      senderId: `dm-${session.room.hostName || "host"}`,
      onMessage: (message) => setLanDetail(`收到 ${message.type}`),
      onStatus: (status, detail) => {
        setLanStatus(status);
        setLanDetail(detail ?? "");
      },
    });
    lanClientRef.current = client;
    client.connect();
    window.setTimeout(() => client.send("room_created", { room: session.room, seats: session.seats }), 250);
  }

  function joinLanRoom() {
    lanClientRef.current?.close();
    const client = createLanClient({
      url: lanUrl,
      roomCode: session.roomCode,
      senderId: `player-${session.playerName || "guest"}`,
      onMessage: (message) => setLanDetail(`收到 ${message.type}`),
      onStatus: (status, detail) => {
        setLanStatus(status);
        setLanDetail(detail ?? "");
      },
    });
    lanClientRef.current = client;
    client.connect();
    window.setTimeout(() => client.send("room_joined", { playerName: session.playerName, actorId: session.selectedActorId }), 250);
  }

  function toggleDie(dieId: string) {
    const die = state.dice.find((item) => item.id === dieId);
    if (!die || !canControlActor(die.ownerId)) {
      showPermissionDenied("玩家只能操作自己的气骰；旁观者不能操作气骰。");
      return;
    }
    setSelectedDice((current) => (current.includes(dieId) ? current.filter((id) => id !== dieId) : [...current, dieId]));
  }

  function assignDieToSlot(dieId: string, slot: "yin" | "yang"): boolean {
    const die = state.dice.find((item) => item.id === dieId);
    if (!die || (die.zone !== "QI_SEA" && die.zone !== "TEMP_QI")) {
      setSlotHint("此骰当前不可放入该槽位");
      setPrompt({ title: "不可投入槽位", message: "此骰当前不可放入该槽位。" });
      window.setTimeout(() => setSlotHint(""), 1600);
      return false;
    }
    if (state.activeActorId !== die.ownerId || (state.phase !== "scene" && state.phase !== "declare")) {
      setSlotHint("当前时点或行动者不可锁气");
      setPrompt({ title: "不可锁气", message: "只有当前行动者在合法时点可以移动气骰并投入阴阳槽。" });
      window.setTimeout(() => setSlotHint(""), 1600);
      return false;
    }
    if (!canControlActor(die.ownerId)) {
      setSlotHint("玩家只能操作自己的气骰");
      showPermissionDenied("玩家只能操作自己的气骰；旁观者不能配置槽位。");
      window.setTimeout(() => setSlotHint(""), 1600);
      return false;
    }
    setSlotDice((current) => {
      const without = {
        yin: current.yin.filter((id) => id !== dieId),
        yang: current.yang.filter((id) => id !== dieId),
      };
      return { ...without, [slot]: [...without[slot], dieId] };
    });
    setSelectedDice((current) => (current.includes(dieId) ? current : [...current, dieId]));
    return true;
  }

  function removeDieFromSlot(dieId: string) {
    setSlotDice((current) => ({
      yin: current.yin.filter((id) => id !== dieId),
      yang: current.yang.filter((id) => id !== dieId),
    }));
  }

  function selectMove(moveId: string) {
    setSelectedMoveId(moveId);
    setSelectedBasicAction(null);
    setSelectedDice([]);
    setSlotDice({ yin: [], yang: [] });
  }

  function selectBasicAction(action: BasicActionType | null) {
    setSelectedBasicAction(action);
    if (action) setSelectedMoveId("");
    setSelectedDice([]);
    setSlotDice({ yin: [], yang: [] });
  }

  function requestSceneRoll() {
    if (session.identity === "spectator" || !session.identity) {
      showPermissionDenied("旁观者不能投掷或推进场景。");
      return;
    }
    if (session.identity === "player" && !session.autoDmEnabled) {
      showPermissionDenied("正式房间由 DM 开始新场景并整体投骰；如需单人测试，请启用测试自动 DM。");
      return;
    }
    const poolDice = state.dice.filter(
      (die) => die.zone === "QI_POOL" && !die.temporary &&
        (session.identity === "dm" || session.autoDmEnabled || die.ownerId === playerActorId),
    );
    if (poolDice.length === 0) {
      setPrompt({ title: "气池无骰", message: "当前没有可投入气海的常规气骰。" });
      return;
    }
    setRollRequest({ dice: poolDice, mode: "enterScene" });
  }

  function commitRollRequest(results: DiceRollResult[]) {
    if (!rollRequest) return;
    patch((current) => {
      const prepared = rollRequest.mode === "enterScene" && (session.identity === "dm" || session.autoDmEnabled)
        ? enterScene(current, () => 1)
        : current;
      return commitDiceRollResults(prepared, results);
    });
    setRollRequest(null);
  }

  function pickFirstSeaDie(ownerId: string) {
    return state.dice.find((die) => die.ownerId === ownerId && die.zone === "QI_SEA")?.id;
  }

  function declareFor(actorId: string, targetId: string, moveId: string) {
    if (!canControlActor(actorId)) {
      showPermissionDenied("玩家只能为自己的角色宣言；旁观者不能宣言。");
      return;
    }
    if (actorId !== state.activeActorId || actorId !== declarationDraft.actorId) {
      setPrompt({ title: "行动者不一致", message: "当前草稿已失效，请按现在的行动者重新选择招式与目标。" });
      return;
    }
    const slottedDice = [...slotDice.yin, ...slotDice.yang];
    const diceToUse = slottedDice.length > 0 ? slottedDice : selectedDice;
    const availability = canDeclareAction(state, actorId, moveId, {
      yinSlotDiceIds: slotDice.yin,
      yangSlotDiceIds: slotDice.yang,
    });
    if (!availability.allowed) {
      setPrompt({ title: "宣言不可用", message: availability.reasons.join("、") });
      return;
    }
    if (diceToUse.length === 0) {
      setPrompt({ title: "需要气骰", message: "需要先选择或拖入至少一枚可用气骰。" });
      return;
    }
    patch((current) =>
      declareAction(current, actorId, targetId, moveId, diceToUse, {
        yinSlotDiceIds: slotDice.yin,
        yangSlotDiceIds: slotDice.yang,
      }),
    );
    clearActionDraft();
  }

  function executeBasicAction(actorId: string, actionType: BasicActionType) {
    if (!canControlActor(actorId) || actorId !== state.activeActorId) {
      showPermissionDenied("只有当前行动者本人或 DM 可以确认这个基础动作。");
      return;
    }
    const availability = getBasicActionAvailability(state, actorId, actionType);
    if (!availability.usable) {
      setPrompt({ title: "动作不可用", message: availability.detailReasons.join("、") });
      return;
    }
    if (actionType === "regulateBreath") {
      const die = state.dice.find((d) => d.ownerId === actorId && d.zone === "QI_REST");
      if (!die) {
        setPrompt({ title: "调息失败", message: "息库没有可调息气骰。" });
        return;
      }
      patch((current) => regulateBreath(current, actorId, [die.id], true));
    }
    if (actionType === "fanzhao") {
      patch((current) => useReflection(current, actorId));
    }
    clearActionDraft();
  }

  function interceptPending(responseId?: string, diceIds?: string[]) {
    const pending = state.pendingAction;
    if (!pending) return;
    const responder = state.actors.find((actor) => actor.id === pending.targetId);
    if (responder && !canControlActor(responder.id)) {
      showPermissionDenied("只有受招者本人或 DM 可以提交截击。");
      return;
    }
    const response = responseId
      ? responder?.responses.find((item) => item.id === responseId && item.responseType === "截击")
      : responder?.responses.find((item) => item.responseType === "截击");
    const submittedDice = diceIds ?? (responder ? [pickFirstSeaDie(responder.id)].filter(Boolean) as string[] : []);
    if (!responder || !response || submittedDice.length === 0) {
      setPrompt({ title: "无法截击", message: "当前没有可用截击挂载或气骰。" });
      return;
    }
    try {
      setState(resolveInterceptSuccess(state, responder.id, response.id, submittedDice));
    } catch (error) {
      setPrompt({ title: "截击未通过规则校验", message: error instanceof Error ? error.message : "请重新检查气骰与响应条件。" });
    }
  }

  function reactPending(responseId?: string, diceIds?: string[]) {
    const pending = state.pendingAction;
    if (!pending) return;
    const responder = state.actors.find((actor) => actor.id === pending.targetId);
    if (responder && !canControlActor(responder.id)) {
      showPermissionDenied("只有受招者本人或 DM 可以提交应招。");
      return;
    }
    const response = responseId
      ? responder?.responses.find((item) => item.id === responseId && item.responseType === "应招")
      : responder?.responses.find((item) => item.responseType === "应招");
    const submittedDice = diceIds ?? (responder ? [pickFirstSeaDie(responder.id)].filter(Boolean) as string[] : []);
    if (!responder || !response || submittedDice.length === 0) {
      setPrompt({ title: "无法应招", message: "当前没有可用应招挂载或气骰。" });
      return;
    }
    try {
      setState(resolveReact(state, responder.id, response.id, submittedDice));
    } catch (error) {
      setPrompt({ title: "应招未通过规则校验", message: error instanceof Error ? error.message : "请重新检查气骰与响应条件。" });
    }
  }

  function skipPendingResponse() {
    const pending = state.pendingAction;
    if (!pending) return;
    if (!canControlActor(pending.targetId)) {
      showPermissionDenied("只有受招者本人或 DM 可以放弃当前响应。");
      return;
    }
    if (state.phase === "intercept_window") {
      patch((current) => formMove(current));
      return;
    }
    if (state.phase === "react_window") {
      patch((current) => skipReact(current));
    }
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
    setSelectedMoveId: selectMove,
    activeDrawer,
    setActiveDrawer,
    toggleDie,
    assignDieToSlot,
    removeDieFromSlot,
    requestSceneRoll,
    declareFor,
    executeBasicAction,
    patch,
    go,
    resetAll,
    selectedCombatantId,
    setSelectedCombatantId,
    selectedBasicAction,
    setSelectedBasicAction: selectBasicAction,
    setPrompt,
    actedActorIds,
    readOnly: session.identity === "spectator",
    setAutoDmEnabled,
    autoDmStatus,
  };

  const isDeskRoute =
    session.route === "playerScene" || session.route === "playerCombat" || session.route === "player" ||
    session.route === "dmScene" || session.route === "dmCombat" || session.route === "dm";

  // ---- Combat routes: each desk renders its own CombatShell ----
  if (isDeskRoute) {
    const displayState = session.identity === "dm" ? state : playerState;
    return (
      <>
        {session.route === "playerScene" ? (
          <PlayerSceneDesk
            {...common}
            state={displayState}
            actorId={playerActorId}
            onEnterCombat={() => go("playerCombat", { gameMode: "combat" })}
            onStartScene={requestSceneRoll}
          />
        ) : null}
        {(session.route === "playerCombat" || session.route === "player") ? (
          <PlayerCombatDesk
            {...common}
            state={displayState}
            actorId={playerActorId}
            onStartScene={requestSceneRoll}
            onIntercept={interceptPending}
            onReact={reactPending}
            onSkipResponse={skipPendingResponse}
          />
        ) : null}
        {session.route === "dmScene" ? (
          <DmSceneDesk
            {...common}
            dmNote={dmNote}
            setDmNote={setDmNote}
            onStartScene={requestSceneRoll}
            onEnterCombat={() => go("dmCombat", { gameMode: "combat" })}
            onOverride={() => patch((current) => dmOverride(current, dmNote, true))}
          />
        ) : null}
        {(session.route === "dmCombat" || session.route === "dm") ? (
          <DmCombatDesk
            {...common}
            dmNote={dmNote}
            setDmNote={setDmNote}
            onStartScene={requestSceneRoll}
            onIntercept={interceptPending}
            onReact={reactPending}
            onSkipResponse={skipPendingResponse}
            onOutcome={() => patch((current) => applyOutcome(current))}
            onEndRound={() => patch((current) => endRound(current))}
            onMomentum={(actorId, momentum) => patch((current) => changeMomentum(current, actorId, momentum))}
            onExpireSource={() => patch((current) => expireSource(current, "短兵客·雨步"))}
            onOverride={() => patch((current) => dmOverride(current, dmNote, true))}
          />
        ) : null}
        {rollRequest ? (
          <QiDiceRollOverlay
            dice={rollRequest.dice}
            onClose={() => setRollRequest(null)}
            onConfirm={(results: DiceRollResult[]) => {
              commitRollRequest(results);
            }}
          />
        ) : null}
        {prompt ? <PromptModal {...prompt} onClose={() => setPrompt(null)} /> : null}
        {session.identity === "dm" && session.developerMode ? (
          <DebugPanel state={state} session={session} debugView={debugView} setDebugView={setDebugView} />
        ) : null}
      </>
    );
  }

  // ---- Non-combat routes: keep original app-shell ----
  return (
    <>
      <div className="app-shell">
        <TitleBar session={session} debugView={debugView} setDebugView={setDebugView} onHome={() => go("home")} onReset={resetAll} />
        <div style={{ gridRow: "2 / -1", overflow: "auto" }}>
          {session.route === "home" ? <HomeScreen session={session} go={go} resetAll={resetAll} /> : null}
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
          {session.route === "library" ? (
            <LibraryPage state={session.identity === "dm" ? state : playerState} onBack={() => go("home")} />
          ) : null}
          {session.route === "packs" ? (
            <PacksPage state={session.identity === "dm" ? state : playerState} session={session} onBack={() => go("home")} />
          ) : null}
          {session.route === "settings" ? (
            <SettingsPage session={session} setSession={setSession} onBack={() => go("home")} onReset={resetAll} />
          ) : null}
        </div>
      </div>
      {prompt ? <PromptModal {...prompt} onClose={() => setPrompt(null)} /> : null}
      {session.identity === "dm" && session.developerMode ? (
        <DebugPanel state={state} session={session} debugView={debugView} setDebugView={setDebugView} />
      ) : null}
    </>
  );
}

function Topbar({
  session,
  debugView,
  setDebugView,
  onHome,
  onReset,
}: {
  session: AppSession;
  debugView: boolean;
  setDebugView: (value: boolean) => void;
  onHome: () => void;
  onReset: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <img src={iconMap.combat} alt="" />
        <div>
        <p className="eyebrow">Windows 本地版 · 游戏模式框架</p>
          <h1>大梁江湖 TRPG 跑团桌面</h1>
        </div>
      </div>
      <div className="top-actions">
        <span className="identity-pill">{session.identity ? identityLabel(session.identity) : "未入席"}</span>
        {session.identity === "dm" && session.developerMode ? (
          <button type="button" onClick={() => setDebugView(!debugView)}>
            {debugView ? "关闭调试全量视图" : "开发调试视图"}
          </button>
        ) : null}
        <button type="button" onClick={onHome}>
          首页
        </button>
        <button type="button" onClick={onReset}>
          重置
        </button>
      </div>
    </header>
  );
}

function HomeScreen({
  session,
  go,
  resetAll,
}: {
  session: AppSession;
  go: (route: AppSession["route"], patchSession?: Partial<AppSession>) => void;
  resetAll: () => void;
}) {
  return (
    <section className="home-screen">
      <div className="home-hero panel">
        <img src={iconMap.world} alt="" />
        <p className="eyebrow">启动层</p>
        <h2>先选房间、身份和团包，再进入桌面</h2>
        <p>当前版本是本地单机房间。正式界面不再默认进入交锋，玩家端和 DM 端按身份分流。</p>
        <div className="home-actions">
          <button className="primary-action" type="button" onClick={() => go("createRoom", { identity: undefined })}>
            创建本地房间
          </button>
          <button type="button" disabled={!session.identity} onClick={() => go(session.identity === "dm" ? "dmScene" : "playerScene")}>
            继续上次
          </button>
          <button type="button" onClick={() => go("joinRoom", { identity: undefined })}>
            加入房间
          </button>
          <button type="button" onClick={() => go("playerScene", { identity: "player", gameMode: "scene", autoDmEnabled: true })}>
            单人规则测试
          </button>
          <button type="button" onClick={() => go("packs")}>
            团包管理
          </button>
          <button type="button" onClick={() => go("library")}>
            资料库
          </button>
          <button type="button" onClick={() => go("settings")}>
            设置
          </button>
          <button type="button" onClick={resetAll}>
            清空本地存档
          </button>
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
  go: (route: AppSession["route"], patchSession?: Partial<AppSession>) => void;
  lanUrl: string;
  setLanUrl: (value: string) => void;
  lanStatus: LanConnectionStatus;
  lanDetail: string;
  startLanRoom: () => void;
}) {
  function updateRoom(key: keyof AppSession["room"], value: string | boolean | number) {
    setSession((current) => {
      if (key !== "maxPlayers") return { ...current, room: { ...current.room, [key]: value } };
      const maxPlayers = Math.max(1, Math.min(8, Number(value) || 1));
      const playerSeatCount = Math.max(1, maxPlayers - 1);
      const dmSeat = current.seats.find((seat) => seat.id === "seat-dm") ?? { id: "seat-dm", label: "DM", ready: true };
      const existingPlayers = current.seats.filter((seat) => seat.id !== "seat-dm");
      const seats = [
        dmSeat,
        ...Array.from({ length: playerSeatCount }, (_, index) => existingPlayers[index] ?? {
          id: `seat-${index + 1}`,
          label: `玩家${index + 1}`,
          ready: false,
        }),
      ];
      return { ...current, seats, room: { ...current.room, maxPlayers } };
    });
  }

  const canCreate = session.room.roomName.trim().length > 0 && session.room.hostName.trim().length > 0;

  return (
    <section className="room-grid">
      <div className="panel">
        <h2>创建房间</h2>
        <label>
          房间名
          <input value={session.room.roomName} onChange={(event) => updateRoom("roomName", event.target.value)} />
        </label>
        <label>
          主持人名称
          <input value={session.room.hostName} onChange={(event) => updateRoom("hostName", event.target.value)} />
        </label>
        <label>
          团包
          <select value={session.room.campaignId} onChange={(event) => updateRoom("campaignId", event.target.value)}>
            <option value="bridge-rain">桥陵镇雨夜失镖</option>
          </select>
        </label>
        <label>
          人数上限
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
          允许旁观
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={session.developerMode}
            onChange={(event) => setSession((current) => ({ ...current, developerMode: event.target.checked }))}
          />
          开发模式
        </label>
        <button className="primary-action" type="button" disabled={!canCreate} onClick={() => go("roomWaiting", { identity: "dm" })}>
          以 DM 身份开房
        </button>
        {!canCreate ? <p className="form-error">请填写房间名与主持人名称。</p> : null}
      </div>

      <div className="panel">
        <h2>团包选择</h2>
        <p><strong>当前团包：</strong>桥陵镇雨夜失镖</p>
        <p>类型：情景 / 交锋样例。推荐 1-4 人，预计 60-90 分钟。</p>
        <p className="hint">本轮保留样例团包入口，后续再接入导入和版本管理。</p>
        <div className="split-actions">
          <button type="button" onClick={() => go("home")}>
            返回
          </button>
          <button type="button" onClick={() => go("joinRoom")}>
            改为加入房间
          </button>
        </div>
        <div className="lan-box">
          <h3>局域网预备</h3>
          <p className="hint">先在房主电脑运行 <code>npm.cmd run dev:lan</code>，再点击开启局域网房间。</p>
          <label>
            房主 WebSocket 地址
            <input value={lanUrl} onChange={(event) => setLanUrl(event.target.value)} />
          </label>
          <p>房间码：{session.roomCode}</p>
          <p>连接状态：{lanStatus}{lanDetail ? ` · ${lanDetail}` : ""}</p>
          <button type="button" disabled={!canCreate} onClick={startLanRoom}>开启局域网房间</button>
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
  go: (route: AppSession["route"], patchSession?: Partial<AppSession>) => void;
  lanUrl: string;
  setLanUrl: (value: string) => void;
  lanStatus: LanConnectionStatus;
  lanDetail: string;
  joinLanRoom: () => void;
}) {
  const canJoin = session.roomCode.trim().length > 0 && session.playerName.trim().length > 0 && Boolean(session.selectedActorId);
  return (
    <section className="room-grid">
      <div className="panel">
        <h2>加入房间</h2>
        <label>
          房间码 / 本地房间
          <input value={session.roomCode} onChange={(event) => setSession((current) => ({ ...current, roomCode: event.target.value }))} />
        </label>
        <label>
          玩家名称
          <input value={session.playerName} onChange={(event) => setSession((current) => ({ ...current, playerName: event.target.value }))} />
        </label>
      </div>
      <div className="panel">
        <h2>角色选择</h2>
        <label>
          选择角色
          <select value={session.selectedActorId} onChange={(event) => setSession((current) => ({ ...current, selectedActorId: event.target.value }))}>
            {state.actors.filter((actor) => actor.side === "player").map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
          </select>
        </label>
        <div className="split-actions">
          <button type="button" onClick={() => go("home")}>返回</button>
          <button className="primary-action" type="button" disabled={!canJoin} onClick={() => enterAs("player")}>以玩家身份进入</button>
          <button type="button" onClick={() => enterAs("spectator")} disabled={!session.room.allowSpectators || !session.roomCode.trim()}>旁观</button>
        </div>
        <div className="lan-box">
          <h3>局域网加入</h3>
          <label>
            房主 WebSocket 地址
            <input value={lanUrl} onChange={(event) => setLanUrl(event.target.value)} />
          </label>
          <p>连接状态：{lanStatus}{lanDetail ? ` · ${lanDetail}` : ""}</p>
          <button type="button" disabled={!canJoin} onClick={joinLanRoom}>连接局域网房间</button>
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
  go: (route: AppSession["route"], patchSession?: Partial<AppSession>) => void;
}) {
  const players = state.actors.filter((actor) => actor.side === "player");
  const isHost = session.identity === "dm";
  return (
    <section className="room-grid">
      <div className="panel">
        <h2>房间：{session.room.roomName}</h2>
        <p>房间码：{session.roomCode}</p>
        <div className="actor-list">
          {session.seats.map((seat) => <div className="actor-card static" key={seat.id}><strong>{seat.label}</strong><span>{seat.playerName ?? "空位"}</span><small>{seat.ready ? "已准备" : "未准备"}</small></div>)}
        </div>
      </div>
      <div className="panel">
        <h2>角色分配</h2>
        {players.map((actor) => <div className="actor-card static" key={actor.id}><strong>{actor.name}</strong><span>{session.selectedActorId === actor.id ? "已分配" : "未分配"}</span></div>)}
        <label className="check-row">
          <input checked={session.room.allowSpectators} disabled={!isHost} type="checkbox" onChange={(event) => setSession((current) => ({ ...current, room: { ...current.room, allowSpectators: event.target.checked } }))} />
          允许旁观
        </label>
        <div className="split-actions">
          <button type="button" onClick={() => go("home")}>返回首页</button>
          {session.identity !== "spectator" ? <button type="button" onClick={() => go("characterAssign")}>{isHost ? "角色分配" : "选择角色"}</button> : null}
          {isHost ? <button className="primary-action" type="button" onClick={() => go("dmScene", { gameMode: "scene" })}>开始情景</button> : null}
          {isHost ? <button type="button" onClick={() => go("dmCombat", { gameMode: "combat" })}>直接进入交锋</button> : null}
          {session.identity === "spectator" ? <button type="button" onClick={() => go("playerScene", { gameMode: "scene" })}>返回旁观桌面</button> : null}
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
  go: (route: AppSession["route"], patchSession?: Partial<AppSession>) => void;
}) {
  const isHost = session.identity === "dm";
  const isSpectator = session.identity === "spectator";
  return (
    <section className="room-grid">
      <div className="panel">
        <h2>角色分配</h2>
        <label>
          玩家角色
          <select disabled={isSpectator} value={session.selectedActorId} onChange={(event) => setSession((current) => ({ ...current, selectedActorId: event.target.value }))}>
            {state.actors.filter((actor) => actor.side === "player").map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
          </select>
        </label>
        <p className="hint">未分配角色不能进入玩家桌面。当前样例默认分配沈青。</p>
      </div>
      <div className="panel">
        <h2>进入桌面</h2>
        <div className="split-actions">
          <button type="button" onClick={() => go("roomWaiting")}>返回房间</button>
          {!isSpectator ? <button className="primary-action" type="button" onClick={() => enterAs("player")} disabled={!session.selectedActorId}>以玩家身份进入</button> : null}
          {isHost ? <button type="button" onClick={() => enterAs("dm")}>返回 DM 桌面</button> : null}
        </div>
      </div>
    </section>
  );
}

function PlayerSceneDesk(props: DeskProps & {
  actorId: string;
  onStartScene: () => void;
  onEnterCombat: () => void;
}) {
  const actor = props.state.actors.find((item) => item.id === props.actorId) ?? props.state.actors[0];
  const publicObjects = props.state.actors.filter((item) => item.id !== actor.id);

  return (
    <CombatShell
      top={
        <TopCombatBar
          session={props.session}
          state={props.state}
          activeDrawer={props.activeDrawer}
          setActiveDrawer={props.setActiveDrawer}
          debugView={props.debugView}
          setDebugView={props.setDebugView}
          onHome={() => props.go("home")}
          onReset={props.resetAll}
          actedActorIds={props.actedActorIds}
        />
      }
      left={<LeftCombatPanel actor={actor} state={props.state} />}
      center={
        <CenterCombatPanel
          stage={
            <section className="panel scene-board" style={{ height: "100%" }}>
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
            </section>
          }
          qiZone={
            <section className="panel scene-board" style={{ height: "100%", padding: "12px" }}>
              <h2>情景动作</h2>
              <div className="action-card-grid">
                {["观察", "交涉", "搜查", "移步", "取物", "使用物品"].map((action) => (
                  <button className="action-card" type="button" key={action}>
                    <strong>{action}</strong>
                    <span>情景动作</span>
                    <small>由 DM 裁定并写入事件</small>
                  </button>
                ))}
              </div>
            </section>
          }
        />
      }
      right={
        <RightCombatPanel
          actions={
            <section className="panel">
              <h2>公开对象</h2>
              <div className="actor-list">
                {publicObjects.map((item) => <UnitCard actor={item} mode={item.side === "player" ? "teammate" : "enemyPublic"} key={item.id} />)}
              </div>
            </section>
          }
          flowButtons={
            <div className="split-actions desk-primary-actions">
              <span className="hint">{props.readOnly ? "旁观模式仅显示公开内容" : "场景推进由 DM 确认"}</span>
              <button className="primary-action" type="button" onClick={props.onEnterCombat}>进入交锋视图</button>
            </div>
          }
        />
      }
      bottom={
        <PhaseActionBar state={props.state} isDM={false} readOnly />
      }
      drawer={props.activeDrawer ? <DrawerLayer {...props} actor={actor} role="player" /> : null}
    />
  );
}

function PlayerCombatDesk(props: DeskProps & {
  actorId: string;
  onStartScene: () => void;
  onIntercept: (responseId?: string, diceIds?: string[]) => void;
  onReact: (responseId?: string, diceIds?: string[]) => void;
  onSkipResponse: () => void;
}) {
  const actor = props.state.actors.find((item) => item.id === props.actorId) ?? props.state.actors[0];
  const enemies = props.state.actors.filter((item) => item.side !== "player");
  const selectedMove = props.selectedBasicAction
    ? undefined
    : actor.moves.find((move) => move.id === props.selectedMoveId);
  const targets = targetCandidatesFor(props.state, actor, selectedMove);
  const targetableActorIds = targets.map((target) => target.id);
  const selectedEnemyId = props.selectedCombatantId ?? props.selectedTargetId;
  const selectedEnemy = enemies.find((enemy) => enemy.id === selectedEnemyId);

  return (
    <CombatShell
      top={
        <TopCombatBar
          session={props.session}
          state={props.state}
          activeDrawer={props.activeDrawer}
          setActiveDrawer={props.setActiveDrawer}
          debugView={props.debugView}
          setDebugView={props.setDebugView}
          onHome={() => props.go("home")}
          onReset={props.resetAll}
          actedActorIds={props.actedActorIds}
        />
      }
      left={<LeftCombatPanel actor={actor} state={props.state} />}
      center={
        <CenterCombatPanel
          stage={<CombatStage state={props.state} selectedId={props.selectedCombatantId} selectedTargetId={props.selectedTargetId} targetableActorIds={targetableActorIds} onSelect={(id) => { props.setSelectedCombatantId(id); if (targetableActorIds.includes(id)) props.setSelectedTargetId(id); }} selectedMove={selectedMove} />}
          actionDeck={<ActionPanel {...props} actor={actor} targets={targets} />}
          qiZone={
            <QiDiceDock
              state={props.state}
              actorDice={props.state.dice.filter((die) => die.ownerId === actor.id)}
              selectedMove={selectedMove}
              hasSelectedTarget={Boolean(props.selectedTargetId)}
              yinSlotIds={props.slotDice.yin}
              yangSlotIds={props.slotDice.yang}
              onAssignDie={props.assignDieToSlot}
              onRemoveDie={props.removeDieFromSlot}
              onRollToSea={!props.readOnly && props.session.autoDmEnabled ? props.requestSceneRoll : undefined}
              declarationEnabled={!props.readOnly && !props.selectedBasicAction && actor.id === props.state.activeActorId}
              distanceWarning={(() => {
                const m = actor.moves.find((mv) => mv.id === props.selectedMoveId);
                const ts = deriveTargetState(props.state, props.selectedTargetId, m);
                return ts.isRangeValid ? undefined : ts.invalidReason;
              })()}
              onConfirm={() => {
                const move = actor.moves.find((m) => m.id === props.selectedMoveId);
                if (!move || !props.selectedTargetId) return;
                const diceToUse = [...props.slotDice.yin, ...props.slotDice.yang];
                if (diceToUse.length === 0) {
                  props.setPrompt({ title: "需要气骰", message: "至少需要投入一枚气骰。" });
                  return;
                }
                const availability = canDeclareAction(props.state, actor.id, move.id, {
                  yinSlotDiceIds: props.slotDice.yin,
                  yangSlotDiceIds: props.slotDice.yang,
                });
                if (!availability.allowed) {
                  props.setPrompt({ title: "宣言不可用", message: availability.reasons.join("、") });
                  return;
                }
                props.declareFor(actor.id, props.selectedTargetId, move.id);
              }}
            />
          }
        />
      }
      right={
        <RightCombatPanel
          actions={
            props.state.pendingAction?.targetId === actor.id
              && (props.state.phase === "intercept_window" || props.state.phase === "react_window") ? (
              <PlayerResponseWorkbench
                state={props.state}
                actor={actor}
                readOnly={props.readOnly}
                onSubmit={props.state.phase === "intercept_window" ? props.onIntercept : props.onReact}
                onSkip={props.onSkipResponse}
              />
            ) : selectedEnemy ? (
              <EnemyPublicDrawer
                actor={selectedEnemy}
                mode="player"
                onClose={() => props.setSelectedCombatantId(undefined)}
              />
            ) : (
              <section className="panel" style={{ textAlign: "center" }}>
                <p className="hint" style={{ padding: "12px 0" }}>点击战场敌人卡片查看情报</p>
              </section>
            )
          }
        />
      }
      bottom={
        <PhaseActionBar
          state={props.state}
          isDM={false}
          readOnly={props.readOnly}
          canCurrentUserRespond={props.state.pendingAction?.targetId === actor.id}
          responseHandledInWorkbench
          automationMessage={props.session.autoDmEnabled ? props.autoDmStatus : undefined}
          onEnterDeclaration={props.onStartScene}
          onIntercept={props.onIntercept}
          onReact={props.onReact}
          onSkipResponse={props.onSkipResponse}
        />
      }
      drawer={props.activeDrawer ? <DrawerLayer {...props} actor={actor} role="player" /> : null}
    />
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
    <CombatShell
      top={
        <TopCombatBar
          session={props.session}
          state={props.state}
          activeDrawer={props.activeDrawer}
          setActiveDrawer={props.setActiveDrawer}
          debugView={props.debugView}
          setDebugView={props.setDebugView}
          onHome={() => props.go("home")}
          onReset={props.resetAll}
          actedActorIds={props.actedActorIds}
        />
      }
      left={<LeftCombatPanel actor={props.state.actors[0]} state={props.state} isDM />}
      center={
        <CenterCombatPanel
          stage={
            <section className="panel" style={{ height: "100%" }}>
              <h2>场景管理</h2>
              <p>当前场景：{props.state.sceneName}</p>
              <p>任务：{props.state.sceneGoal}</p>
              <div className="track-row">
                {props.state.tracks.map((track) => (
                  <div className="track" key={track.id}>
                    <span>{track.name}{track.hidden ? "（隐藏）" : ""}</span>
                    <meter min={0} max={track.max} value={track.value} />
                    <small>{track.value}/{track.max}</small>
                  </div>
                ))}
              </div>
            </section>
          }
          qiZone={
            <section className="panel scene-board" style={{ height: "100%" }}>
              <h2>共享情景舞台</h2>
              <p>夜雨石桥，失镖血箱仍在对岸暗处。</p>
              <div className="actor-list">
                {publicObjects.map((actor) => <UnitCard actor={actor} mode={actor.side === "player" ? "teammate" : "enemyDm"} key={actor.id} />)}
              </div>
            </section>
          }
        />
      }
      right={
        <RightCombatPanel
          actions={<></>}
          flowButtons={
            <section className="panel">
              <h2>DM操作</h2>
              <div className="flow-buttons">
                <button type="button" onClick={props.onStartScene}>推进场景</button>
                <button type="button" onClick={props.onOverride}>公开线索</button>
                <button className="primary-action" type="button" onClick={props.onEnterCombat}>进入交锋</button>
              </div>
              <label>
                DM 私有/广播备注
                <textarea value={props.dmNote} onChange={(event) => props.setDmNote(event.target.value)} />
              </label>
            </section>
          }
        />
      }
      bottom={
        <PhaseActionBar
          state={props.state}
          isDM
          onStartScene={props.onStartScene}
          onEnterDeclaration={props.onStartScene}
        />
      }
      drawer={props.activeDrawer ? <DrawerLayer {...props} actor={props.state.actors[0]} role="dm" /> : null}
    />
  );
}

function DmCombatDesk(props: DeskProps & {
  dmNote: string;
  setDmNote: (value: string) => void;
  onStartScene: () => void;
  onIntercept: () => void;
  onReact: () => void;
  onSkipResponse: () => void;
  onOutcome: () => void;
  onEndRound: () => void;
  onMomentum: (actorId: string, momentum: Actor["momentum"]) => void;
  onExpireSource: () => void;
  onOverride: () => void;
}) {
  const players = props.state.actors.filter((actor) => actor.side === "player");
  const enemies = props.state.actors.filter((actor) => actor.side !== "player");
  const activeActor = props.state.actors.find((actor) => actor.id === props.state.activeActorId) ?? props.state.actors[0];
  const selectedMove = props.selectedBasicAction
    ? undefined
    : activeActor.moves.find((move) => move.id === props.selectedMoveId);
  const targets = targetCandidatesFor(props.state, activeActor, selectedMove);
  const targetableActorIds = targets.map((target) => target.id);
  const selectedContextActor = props.selectedCombatantId
    ? props.state.actors.find((actor) => actor.id === props.selectedCombatantId)
    : undefined;

  return (
    <CombatShell
      top={
        <TopCombatBar
          session={props.session}
          state={props.state}
          activeDrawer={props.activeDrawer}
          setActiveDrawer={props.setActiveDrawer}
          debugView={props.debugView}
          setDebugView={props.setDebugView}
          onHome={() => props.go("home")}
          onReset={props.resetAll}
          actedActorIds={props.actedActorIds}
        />
      }
      left={<LeftCombatPanel actor={activeActor} state={props.state} isDM />}
      center={
        <CenterCombatPanel
          stage={<CombatStage state={props.state} selectedId={props.selectedCombatantId} selectedTargetId={props.selectedTargetId} targetableActorIds={targetableActorIds} onSelect={(id) => { props.setSelectedCombatantId(id); if (targetableActorIds.includes(id)) props.setSelectedTargetId(id); }} selectedMove={selectedMove} />}
          actionDeck={
            <ActionPanel
              {...props}
              actor={activeActor}
              targets={targets}
            />
          }
          qiZone={
            (() => {
              const dmActorId = activeActor.id;
              const dmActor = activeActor;
              return (
                <QiDiceDock
                  state={props.state}
                  actorDice={props.state.dice.filter((die) => die.ownerId === dmActorId)}
                  selectedMove={selectedMove}
                  hasSelectedTarget={Boolean(props.selectedTargetId)}
                  yinSlotIds={props.slotDice.yin}
                  yangSlotIds={props.slotDice.yang}
                  onAssignDie={props.assignDieToSlot}
                  onRemoveDie={props.removeDieFromSlot}
                  onRollToSea={props.requestSceneRoll}
                  declarationEnabled={!props.selectedBasicAction}
                  onConfirm={() => {
                    const move = selectedMove;
                    if (!move || !props.selectedTargetId) return;
                    const diceToUse = [...props.slotDice.yin, ...props.slotDice.yang];
                    if (diceToUse.length === 0) {
                      props.setPrompt({ title: "需要气骰", message: "至少需要投入一枚气骰。" });
                      return;
                    }
                    props.declareFor(dmActorId, props.selectedTargetId, move.id);
                  }}
                />
              );
            })()
          }
        />
      }
      right={
        <RightCombatPanel
          actions={
            selectedContextActor ? (
              selectedContextActor.side !== "player" ? (
                <EnemyPublicDrawer
                  actor={selectedContextActor}
                  mode="dm"
                  onClose={() => props.setSelectedCombatantId(undefined)}
                />
              ) : (
                <section className="panel combat-context-card">
                  <div className="panel-title">
                    <h2>玩家目标</h2>
                    <button className="icon-button close-button" type="button" onClick={() => props.setSelectedCombatantId(undefined)} aria-label="关闭目标情报">×</button>
                  </div>
                  <UnitCard actor={selectedContextActor} mode="self" />
                  <p className="hint">当前行动者可将该玩家设为合法目标；伤害与状态会在落果阶段统一结算。</p>
                </section>
              )
            ) : (
              <section className="panel combat-context-empty">
                <span className="context-kicker">目标情报</span>
                <h2>未选中对象</h2>
                <p className="hint">点击交锋台上的单位，查看完整情报、响应挂载与退场条件。</p>
              </section>
            )
          }
          enemies={
            <DmControlPanel
              state={props.state}
              dmNote={props.dmNote}
              setDmNote={props.setDmNote}
              onExpireSource={props.onExpireSource}
              onMomentum={props.onMomentum}
              onOverride={props.onOverride}
            />
          }
          hint="DM 可查看全部隐藏信息"
        />
      }
      bottom={
        <PhaseActionBar
          state={props.state}
          isDM
          onStartScene={props.onStartScene}
          onEnterDeclaration={props.onStartScene}
          onIntercept={props.onIntercept}
          onReact={props.onReact}
          onSkipResponse={props.onSkipResponse}
          onResolveResult={props.onOutcome}
          onNextRound={props.onEndRound}
          onApplyMomentum={() => {
            const active = props.state.actors.find((a) => a.id === props.state.activeActorId);
            if (active) props.onMomentum(active.id, active.momentum);
          }}
        />
      }
      drawer={props.activeDrawer ? <DrawerLayer {...props} actor={activeActor} role="dm" /> : null}
    />
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
  requestSceneRoll: () => void;
  toggleDie: (id: string) => void;
  assignDieToSlot: (id: string, slot: "yin" | "yang") => boolean;
  removeDieFromSlot: (id: string) => void;
  declareFor: (actorId: string, targetId: string, moveId: string) => void;
  executeBasicAction: (actorId: string, actionType: BasicActionType) => void;
  patch: (updater: (current: CombatState) => CombatState) => void;
  go: (route: AppSession["route"], patchSession?: Partial<AppSession>) => void;
  resetAll: () => void;
  selectedCombatantId: string | undefined;
  setSelectedCombatantId: (id: string | undefined) => void;
  selectedBasicAction: BasicActionType | null;
  setSelectedBasicAction: (action: BasicActionType | null) => void;
  setPrompt: (p: PromptState | null) => void;
  actedActorIds: Set<string>;
  readOnly: boolean;
  setAutoDmEnabled: (enabled: boolean) => void;
  autoDmStatus: string;
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
        <strong>第{state.round}轮</strong>
        <span>时点：{phaseLabel(state.phase)}</span>
        <span>当前行动者：{activeActor?.name ?? "待定"}</span>
      </div>
    </section>
  );
}

function CombatBriefCard({ actor }: { actor: Actor }) {
  return (
    <article className="combat-brief-card">
      <UnitCard actor={actor} mode={actor.side === "player" ? "teammate" : "enemyPublic"} />
      <div className="stat-grid">
        <span>护体 {actor.tableAttrs.护体}</span>
        <span>爆发 {actor.tableAttrs.爆发}</span>
        <span>回气 {actor.tableAttrs.回气}</span>
        <span>身势 {actor.tableAttrs.身势}</span>
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
        <span>场景：{state.sceneName}</span>
        <span>轮次：{state.round}</span>
        <span>阶段：{phaseLabel(state.phase)}</span>
        <span>当前行动者：{state.actors.find((actor) => actor.id === state.activeActorId)?.name ?? "待定"}</span>
      </div>
    </section>
  );
}

function MyCharacterCard({ actor }: { actor: Actor }) {
  return (
    <section className="panel">
      <h2>我的角色</h2>
      <UnitCard actor={actor} mode="self" />
      <div className="stat-grid">
        <span>气血 {actor.tableAttrs.气血}</span>
        <span>护体 {actor.tableAttrs.护体}</span>
        <span>爆发 {actor.tableAttrs.爆发}</span>
        <span>回气 {actor.tableAttrs.回气}</span>
        <span>观照 {actor.tableAttrs.观照}</span>
        <span>身势 {actor.tableAttrs.身势}</span>
      </div>
      <p className="hint">{actor.publicNote}</p>
    </section>
  );
}

function TeamOverview({ actors }: { actors: Actor[] }) {
  return (
    <section className="panel">
      <h2>队友概览</h2>
      {actors.length === 0 ? <p className="empty-state">当前本地样例只有一名玩家角色。</p> : null}
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

const timepoints: Array<{ phase: CombatState["phase"] | "momentum"; label: string }> = [
  { phase: "setup", label: "准备" },
  { phase: "declare", label: "宣言" },
  { phase: "declare", label: "锁气" },
  { phase: "intercept_window", label: "截击窗口" },
  { phase: "react_window", label: "成招" },
  { phase: "react_window", label: "应招窗口" },
  { phase: "outcome", label: "落果" },
  { phase: "momentum", label: "势变化" },
  { phase: "round_end", label: "回合结束" },
];

function RoundTimeline({ state }: { state: CombatState }) {
  const activeActor = state.actors.find((actor) => actor.id === state.activeActorId);

  return (
    <section className="panel round-panel">
      <div className="round-strip">
        <strong>第{state.round}轮</strong>
        <span>{phaseLabel(state.phase)}</span>
        <span>当前行动者：{activeActor?.name ?? "待定"}</span>
        <span>响应：由 DM 裁定</span>
      </div>
      <div className="timepoint-strip">
        {timepoints.map((point) => (
          <span className={point.phase === state.phase ? "active" : ""} key={point.label}>{point.label}</span>
        ))}
      </div>
    </section>
  );
}

function publicStatuses(actor: Actor) {
  return actor.statuses.filter((status) => status.public);
}

function UnitCard({
  actor,
  mode,
}: {
  actor: Actor;
  mode: "self" | "teammate" | "enemyPublic" | "enemyDm";
}) {
  const statuses = mode === "enemyDm" ? [...actor.statuses, ...(actor.hiddenStatuses ?? [])] : publicStatuses(actor);
  const visibleStatuses = statuses.slice(0, mode === "self" || mode === "enemyDm" ? 6 : 4);
  const momentum = actor.momentum;
  const avatar = actor.side === "player" ? iconMap.character : iconMap.combat;

  return (
    <article className={`unit-card ${mode}`}>
      <div className="unit-head">
        <img src={avatar} alt="" />
        <div>
          <div className="unit-name-row">
            <strong>{actor.name}</strong>
            <span className="unit-momentum">{momentum}</span>
          </div>
          <div className="status-bar" aria-label="状态栏">
            {visibleStatuses.length > 0 ? visibleStatuses.map((status) => <span key={status.id}>{status.name}</span>) : <span>无状态</span>}
          </div>
        </div>
      </div>
      <meter min={0} max={actor.maxHp} value={actor.hp} />
      <p className="unit-hp">气血 {actor.hp}/{actor.maxHp}</p>
      {mode === "self" ? <SixRootsSummary actor={actor} /> : null}
      {mode === "enemyDm" && actor.hiddenStatuses?.length ? <p className="hint">隐藏状态：{actor.hiddenStatuses.map((status) => status.name).join("、")}</p> : null}
    </article>
  );
}

function SixRootsSummary({ actor }: { actor: Actor }) {
  const neigong = actor.innerArts[0];
  return (
    <div className="six-roots-summary">
      <div className="six-roots-grid">
        <span>顶门 {actor.sixRoots.顶门}</span>
        <span>目窍 {actor.sixRoots.目窍}</span>
        <span>心口 {actor.sixRoots.心口}</span>
        <span>丹田 {actor.sixRoots.丹田}</span>
        <span>命门 {actor.sixRoots.命门}</span>
        <span>步根 {actor.sixRoots.步根}</span>
      </div>
      <p className="hint">
        当前内功：{neigong?.name ?? "未运转内功"}；运行窍位：{neigong?.occupiedAcupoints.join("、") || "无"}；被动摘要：
        {neigong?.passive ?? "无"}
      </p>
    </div>
  );
}

function ActionPanel(props: DeskProps & { actor: Actor; targets: Actor[] }) {
  const selectedMove = props.selectedBasicAction
    ? undefined
    : props.actor.moves.find((move) => move.id === props.selectedMoveId) ?? props.actor.moves[0];
  const moveAvailability = selectedMove
    ? canDeclareAction(props.state, props.actor.id, selectedMove.id, {
        yinSlotDiceIds: props.slotDice.yin,
        yangSlotDiceIds: props.slotDice.yang,
      })
    : { allowed: false, reasons: ["未选择行动"] };

  // Basic action availability
  const regulateBreathAvail = getBasicActionAvailability(props.state, props.actor.id, "regulateBreath");
  const fanzhaoAvail = getBasicActionAvailability(props.state, props.actor.id, "fanzhao");

  const isBreathSelected = props.selectedBasicAction === "regulateBreath";
  const isFanzhaoSelected = props.selectedBasicAction === "fanzhao";

  // Dynamic confirm button
  const confirmLabel = isBreathSelected ? "确认调息"
    : isFanzhaoSelected ? "确认返照"
    : "确认宣言并锁气";

  const confirmDisabled = props.readOnly ? true
    : isBreathSelected ? !regulateBreathAvail.usable
    : isFanzhaoSelected ? !fanzhaoAvail.usable
    : !moveAvailability.allowed;

  const confirmHint = isBreathSelected
    ? (props.readOnly ? "旁观模式不能确认动作" : regulateBreathAvail.usable ? "调息：从息库取回气骰入气海" : regulateBreathAvail.detailReasons.join("、"))
    : isFanzhaoSelected
    ? (fanzhaoAvail.usable ? "返照：气海为空时取回最低起投气骰" : fanzhaoAvail.detailReasons.join("、"))
    : moveAvailability.allowed
    ? (selectedMove?.baseEffect ?? "")
    : moveAvailability.reasons.join("、");

  function handleConfirm() {
    if (isBreathSelected) {
      props.executeBasicAction(props.actor.id, "regulateBreath");
    } else if (isFanzhaoSelected) {
      props.executeBasicAction(props.actor.id, "fanzhao");
    } else {
      props.declareFor(props.actor.id, props.selectedTargetId, props.selectedMoveId);
    }
  }

  return (
    <section className="panel combat-action-deck-panel">
      <div className="panel-title">
        <img src={iconMap.response} alt="" />
        <h2>招式与宣言</h2>
      </div>

      {/* Target & Move dropdowns — only for normal moves */}
      {!props.selectedBasicAction && (
        <div className="form-grid">
          <label>
            目标
            <select value={props.selectedTargetId} onChange={(event) => { const id = event.target.value; props.setSelectedTargetId(id); props.setSelectedCombatantId(id); }}>
              {props.targets.map((target) => (
                <option key={target.id} value={target.id}>{target.name}</option>
              ))}
            </select>
          </label>
          <label>
            招式
            <select value={props.selectedMoveId} onChange={(event) => props.setSelectedMoveId(event.target.value)}>
              {props.actor.moves.map((move) => (
                <option key={move.id} value={move.id}>{move.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* Current selection summary */}
      <div className="action-panel__selection">
        {isBreathSelected && (
          <div className="action-summary">
            <p><strong>当前选择：调息</strong></p>
            <p className="hint">类型：基础动作 · 目标：自身 · 距离：无</p>
            <p className="hint">效果：从息库回气海</p>
            <p className="hint" style={{ color: regulateBreathAvail.usable ? "var(--shield-green)" : "var(--hp-red)" }}>
              {regulateBreathAvail.reasonTags.join("、")}
            </p>
          </div>
        )}
        {isFanzhaoSelected && (
          <div className="action-summary">
            <p><strong>当前选择：返照</strong></p>
            <p className="hint">类型：基础动作 · 目标：自身 · 距离：无</p>
            <p className="hint">效果：气海为空时取回最低起投气骰</p>
            <p className="hint" style={{ color: fanzhaoAvail.usable ? "var(--shield-green)" : "var(--hp-red)" }}>
              {fanzhaoAvail.reasonTags.join("、")}
            </p>
          </div>
        )}
        {!props.selectedBasicAction && selectedMove && (
          <p className="hint">{selectedMove.baseEffect}</p>
        )}
      </div>

      {/* Action cards — compact, gameplay-relevant fields only */}
      <div className="action-card-grid">
        {/* Normal moves */}
        {props.actor.moves.map((move) => {
          const selected = !props.selectedBasicAction && props.selectedMoveId === move.id;
          const moveAvail = canDeclareAction(props.state, props.actor.id, move.id, {
            yinSlotDiceIds: props.slotDice.yin,
            yangSlotDiceIds: props.slotDice.yang,
          });
          const selectionReasons = moveAvail.reasons.filter(
            (reason) => !reason.includes("阴槽") && !reason.includes("阳槽"),
          );
          const canPrepare = selectionReasons.length === 0;
          const gradeClass = move.designGrade ? `grade-${move.designGrade}` : "";
          return (
            <button
              className={`action-card ${selected ? "selected" : ""} ${!canPrepare ? "warn" : ""}`}
              type="button"
              key={move.id}
              disabled={props.readOnly}
              aria-disabled={!canPrepare}
              title={[
                `${move.name} · ${move.timing} · ${move.formPosition}`,
                `对象/距离：${move.targetRange}`,
                `装备许可：${move.equipPermission}`,
                `势条件：${move.allowedShi?.join("、") || "无明示门槛"}`,
                `气性/投入：${move.qiNatureThreshold} · 最低${move.minDice}枚`,
                `基础效果：${move.baseEffect}`,
                ...(move.triggers ?? []).map((trigger) => `${trigger.condition}：${trigger.effect}`),
                `资源去向：${move.resourceDestination}`,
              ].join("\n")}
              onClick={() => {
                if (!canPrepare) {
                  props.setPrompt({ title: "招式当前不可用", message: selectionReasons.join("、") });
                  return;
                }
                props.setSelectedMoveId(move.id);
                props.setSelectedBasicAction(null);
              }}
            >
              <span className="card-name">{move.name}</span>
              <span className="card-badges">
                {move.formPosition !== "无" && <span className="card-badge form">{move.formPosition}</span>}
                {move.designGrade && <span className={`card-badge ${gradeClass}`}>{move.designGrade}</span>}
              </span>
              <span className="card-effect">{move.baseEffect}</span>
              <span className="card-reqs">
                <span>{move.targetRange}</span>
                <span>·</span>
                <span>最低{move.minDice}枚</span>
              </span>
              <span className={`card-status ${canPrepare ? "ok" : "no"}`}>
                {canPrepare ? "可配骰" : selectionReasons.join("、")}
              </span>
            </button>
          );
        })}

        {/* 调息 card */}
        <button
          className={`action-card ${isBreathSelected ? "selected" : ""} ${!regulateBreathAvail.usable ? "warn" : ""}`}
          type="button"
          disabled={props.readOnly}
          onClick={() => { props.setSelectedBasicAction("regulateBreath"); }}
        >
          <span className="card-name">调息</span>
          <span className="card-badges"><span className="card-badge form">基础</span></span>
          <span className="card-reqs">目标：自身 · 从息库回气海</span>
          <span className={`card-status ${regulateBreathAvail.usable ? "ok" : "no"}`}>
            {regulateBreathAvail.usable ? "✓ 可用" : regulateBreathAvail.reasonTags.join("、")}
          </span>
        </button>

        {/* 返照 card */}
        <button
          className={`action-card ${isFanzhaoSelected ? "selected" : ""} ${!fanzhaoAvail.usable ? "warn" : ""}`}
          type="button"
          disabled={props.readOnly}
          onClick={() => { props.setSelectedBasicAction("fanzhao"); }}
        >
          <span className="card-name">返照</span>
          <span className="card-badges"><span className="card-badge form">特殊</span></span>
          <span className="card-reqs">目标：自身 · 气海空时取回最低起投骰</span>
          <span className={`card-status ${fanzhaoAvail.usable ? "ok" : "no"}`}>
            {fanzhaoAvail.usable ? "✓ 可用" : fanzhaoAvail.reasonTags.join("、")}
          </span>
        </button>
      </div>

      {props.selectedBasicAction ? (
        <>
          <button className="primary-action" type="button" disabled={confirmDisabled} onClick={handleConfirm}>
            {confirmLabel}
          </button>
          {confirmDisabled ? <p className="hint">{confirmHint}</p> : null}
        </>
      ) : (
        <div className="action-panel__handoff">
          <span>下一步</span>
          <strong>
            {props.state.phase === "intercept_window"
              ? "宣言已锁定；在底部命令条处理截击或放弃响应"
              : props.state.phase === "react_window"
                ? "招式已成形；在底部命令条处理应招或进入结算"
                : props.state.phase === "outcome"
                  ? "结果已生成；在底部命令条确认落果与资源去向"
                  : props.state.phase === "round_end"
                    ? "本轮已结束；在底部命令条确认势变化并开启下一轮"
                    : "在气骰工作台中配置阴、阳槽并确认宣言"}
          </strong>
        </div>
      )}
    </section>
  );
}

function CombatStage({ state, selectedId, selectedTargetId, targetableActorIds, onSelect, selectedMove }: {
  state: CombatState;
  selectedId?: string;
  selectedTargetId?: string;
  targetableActorIds?: string[];
  onSelect: (id: string) => void;
  selectedMove?: Move;
}) {
  const stageData = buildStageData(state);
  return (
    <TacticalCombatStage
      data={stageData}
      state={state}
      selectedId={selectedId}
      selectedTargetId={selectedTargetId}
      targetableActorIds={targetableActorIds}
      onSelectCombatant={onSelect}
      selectedMove={selectedMove}
    />
  );
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
            <strong>{distance.band}{distance.entangled ? " · 纠缠" : ""}</strong>
            <span>{to?.name}</span>
          </div>
        );
      })}
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
        `${actor?.name} 宣言「${move?.name}」→ ${target?.name}`,
        `锁气：阴${action.yinSlotDiceIds?.length ?? 0}、阳${action.yangSlotDiceIds?.length ?? 0}`,
        action.formed ? "成招：等待应招或落果" : "等待截击窗口处理",
      ]
    : ["当前回合尚无行动栈。"];

  return (
    <div className="action-stack">
      <h3>行动栈</h3>
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
        <strong>{pending.formed ? "已成招，等待应招或落果" : "截击窗口打开"}</strong>
        <p>{actor?.name} 对 {target?.name} 使用「{move?.name}」，锁气 {pending.diceIds.length} 枚。</p>
      </div>
    </div>
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
        <span>背包</span>
      </button>
      {open ? (
        <section className="panel inventory-panel inventory-popover" aria-label="背包 / 装备 / 药物">
          <div className="panel-title">
            <img src={iconMap.inventory} alt="" />
            <h2>背包 / 装备 / 药物</h2>
            <button className="icon-button close-button" type="button" onClick={() => setOpen(false)} aria-label="关闭背包">×</button>
          </div>
          <div className="inventory-tabs">
            {(Object.keys(categoryLabels) as InventoryCategory[]).map((category) => {
              const items = actor.inventory.filter((item) => item.category === category);
              return (
                <div className="inventory-group" key={category}>
                  <h3>{categoryLabels[category]}</h3>
                  {items.length === 0 ? <p className="empty-state">暂无</p> : null}
                  {items.map((item) => (
                    <InventoryItemCard key={item.id} actorId={actor.id} item={item} canManage={canManage} patch={patch} />
                  ))}
                </div>
              );
            })}
          </div>
          <h3>使用记录</h3>
          {(actor.inventoryEvents ?? []).slice(0, 4).map((event) => (
            <p className="hint" key={`${event.itemId}-${event.createdAt}`}>{event.eventType} · {event.itemId} · {new Date(event.createdAt).toLocaleTimeString()}</p>
          ))}
          {(actor.inventoryEvents ?? []).length === 0 ? <p className="empty-state">还没有物品事件。</p> : null}
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
  const equippable = item.category === "weapon" || item.category === "armor" || item.category === "accessory";
  return (
    <article className="inventory-item">
      <strong>{item.name}{item.equipped ? "（已装备）" : ""}</strong>
      <span>数量 {item.quantity}</span>
      <p>{item.publicNote}</p>
      {canManage ? (
        <div className="split-actions">
          {equippable ? (
            <button type="button" onClick={() => patch((current) => item.equipped ? unequipItem(current, actorId, item.id) : equipItem(current, actorId, item.id))}>
              {item.equipped ? "卸下" : "装备"}
            </button>
          ) : null}
          <button type="button" onClick={() => patch((current) => useInventoryItem(current, actorId, item.id))}>使用</button>
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
    { id: "character", label: "人物" },
    { id: "sixRoots", label: "六根" },
    { id: "innerArt", label: "内功" },
    { id: "inventory", label: "背包" },
    { id: "moves", label: "招式" },
    { id: "statuses", label: "状态" },
    { id: "logs", label: "日志" },
    { id: "library", label: "资料" },
    { id: "settings", label: "设置" },
  ];
  const dmItems: Array<{ id: DrawerId; label: string }> = [
    { id: "dmEnemies", label: "敌人" },
    { id: "dmDistance", label: "距离" },
    { id: "dmHidden", label: "隐藏" },
    { id: "dmRuling", label: "裁定" },
    { id: "dmScene", label: "场景" },
    { id: "dmLog", label: "DM日志" },
    { id: "library", label: "资料" },
    { id: "settings", label: "设置" },
  ];
  const items = role === "dm" ? dmItems : playerItems;

  return (
    <nav className="drawer-toolbar" aria-label={role === "dm" ? "DM工具条" : "玩家工具条"}>
      {items.map((item) => (
        <button className={activeDrawer === item.id ? "active" : ""} type="button" key={item.id} onClick={() => setActiveDrawer(activeDrawer === item.id ? null : item.id)}>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function PromptModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onClose,
}: PromptState & { onClose: () => void }) {
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const confirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="panel prompt-modal" role={onConfirm ? "alertdialog" : "dialog"} aria-modal="true" aria-label={title}>
        <div className="panel-title">
          <h2>{title}</h2>
          <button className="icon-button close-button" type="button" onClick={onClose} aria-label="关闭提示">×</button>
        </div>
        <p>{message}</p>
        <div className="prompt-modal__actions">
          {onConfirm ? <button type="button" onClick={onClose}>{cancelLabel ?? "取消"}</button> : null}
          <button
            ref={primaryRef}
            className={`${onConfirm && destructive ? "danger-action" : "primary-action"}`}
            type="button"
            onClick={onConfirm ? confirm : onClose}
          >
            {confirmLabel ?? (onConfirm ? "确认" : "明白")}
          </button>
        </div>
      </section>
    </div>
  );
}

function DrawerLayer(props: DeskProps & { actor: Actor; role: "player" | "dm" }) {
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!props.activeDrawer) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const drawer = drawerRef.current;
    const focusables = () => Array.from(
      drawer?.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])") ?? [],
    ).filter((element) => !element.hasAttribute("disabled"));
    focusables()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        props.setActiveDrawer(null);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [props.activeDrawer, props.setActiveDrawer]);

  if (!props.activeDrawer) return null;

  const title = drawerTitle(props.activeDrawer);
  return (
    <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) props.setActiveDrawer(null); }}>
      <aside ref={drawerRef} className="drawer-layer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-title drawer-title">
          <h2>{title}</h2>
          <button className="icon-button close-button" type="button" onClick={() => props.setActiveDrawer(null)} aria-label="关闭抽屉">×</button>
        </div>
        <DrawerContent {...props} />
      </aside>
    </div>
  );
}

function CharacterDrawerTabs({ actor, initialTab }: { actor: Actor; initialTab?: string }) {
  const [tab, setTab] = useState(initialTab ?? "基础");
  const innerArt = actor.innerArts[0];
  const tabs = ["基础", "六根", "内功", "状态"] as const;

  return (
    <div className="drawer-content">
      <div className="tabs tabs--underline">
        {tabs.map((t) => (
          <button key={t} className={`tab${tab === t ? " active" : ""}`} type="button" onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === "基础" && (
        <>
          <UnitCard actor={actor} mode="self" />
          <div className="stat-grid">
            <span>气血 {actor.hp}/{actor.maxHp}</span>
            <span>护体 {actor.tableAttrs.护体}</span>
            <span>爆发 {actor.tableAttrs.爆发}</span>
            <span>回气 {actor.tableAttrs.回气}</span>
            <span>观照 {actor.tableAttrs.观照}</span>
            <span>身势 {actor.tableAttrs.身势}</span>
          </div>
          <p>{actor.publicNote}</p>
        </>
      )}
      {tab === "六根" && (
        <div className="six-root-detail">
          <SixRootsSummary actor={actor} />
          <p className="hint">六根：顶门、目窍、心口、丹田、命门、步根。</p>
        </div>
      )}
      {tab === "内功" && (
        <>
          <p><strong>已装备内功：</strong>{innerArt?.name ?? "无"}</p>
          <p><strong>运行窍位：</strong>{innerArt?.occupiedAcupoints.join("、") || "无"}</p>
          <p><strong>被动：</strong>{innerArt?.passive ?? "无"}</p>
        </>
      )}
      {tab === "状态" && (
        <div>
          {actor.statuses.length > 0
            ? actor.statuses.map((s) => <p key={s.id} className="inventory-item">{s.name} · 层数{s.layers} · {s.source}</p>)
            : <p className="empty-state">无状态</p>}
        </div>
      )}
    </div>
  );
}

function DrawerContent(props: DeskProps & { actor: Actor; role: "player" | "dm" }) {
  const drawer = props.activeDrawer;
  const actor = props.actor;
  const enemies = props.state.actors.filter((item) => item.side !== "player");

  if (drawer === "character") {
    return <CharacterDrawerTabs actor={actor} />;
  }

  // sixRoots and innerArt now folded into character drawer
  if (drawer === "sixRoots" || drawer === "innerArt") {
    return <CharacterDrawerTabs actor={actor} initialTab={drawer === "innerArt" ? "内功" : "六根"} />;
  }

  if (drawer === "inventory") {
    return (
      <div className="drawer-content">
        <div className="inventory-tabs">
          {(Object.keys(categoryLabels) as InventoryCategory[]).map((category) => {
            const items = actor.inventory.filter((item) => item.category === category);
            return (
              <div className="inventory-group" key={category}>
                <h3>{categoryLabels[category]}</h3>
                {items.length === 0 ? <p className="empty-state">暂无</p> : null}
                {items.map((item) => <InventoryItemCard key={item.id} actorId={actor.id} item={item} canManage={!props.readOnly && (props.role !== "dm" || actor.side === "player")} patch={props.patch} />)}
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
        {actor.moves.map((move) => <article className="action-card" key={move.id}><strong>{move.name}</strong><span>{move.category} · {move.timing}</span><small>{move.baseEffect}</small></article>)}
        {["调息", "返照", "出手便行", "随手便行", "取物", "争夺物", "使用物品"].map((move) => <article className="action-card" key={move}><strong>{move}</strong><span>基础/便行动作</span><small>按当前时点显示可用原因</small></article>)}
      </div>
    );
  }

  if (drawer === "statuses") {
    const statuses = props.role === "dm" ? [...actor.statuses, ...(actor.hiddenStatuses ?? [])] : publicStatuses(actor);
    return <div className="drawer-content">{statuses.length ? statuses.map((status) => <p className="inventory-item" key={status.id}>{status.name} · {status.public ? "公开" : "隐藏"} · {status.source}</p>) : <p className="empty-state">暂无公开状态。</p>}</div>;
  }

  if (drawer === "logs" || drawer === "dmLog") {
    return <LogPanel state={props.state} />;
  }

  if (drawer === "library") {
    const moveCount = props.state.actors.reduce((sum, item) => sum + item.moves.length + item.responses.length, 0);
    return (
      <div className="drawer-content drawer-support-summary">
        <p>当前公开数据包含 {props.state.actors.length} 名角色、{moveCount} 条招式与响应、{props.state.tracks.length} 条场景轨。</p>
        <button className="primary-action" type="button" onClick={() => props.go("library")}>打开完整资料库</button>
      </div>
    );
  }

  if (drawer === "settings") {
    return (
      <div className="drawer-content drawer-settings">
        <label className="check-row support-setting-row">
          <input
            type="checkbox"
            checked={props.session.autoDmEnabled}
            disabled={props.readOnly}
            onChange={(event) => props.setAutoDmEnabled(event.target.checked)}
          />
          <span><strong>测试自动 DM</strong><small>只处理敌方响应、落果与轮末推进。</small></span>
        </label>
        <p className="hint">进度已在本机自动保存。玩家与旁观者永远不会获得 DM 隐藏数据。</p>
        <button type="button" onClick={() => props.go("settings")}>打开完整设置</button>
      </div>
    );
  }

  if (drawer === "dmEnemies" && props.role === "dm") {
    return <EnemyRoster actors={enemies} mode="dm" />;
  }

  if (drawer === "dmDistance" && props.role === "dm") {
    const target = props.state.actors.find((candidate) => candidate.id === props.selectedTargetId);
    const relation = target
      ? props.state.distances.find((item) =>
        (item.fromActorId === actor.id && item.toActorId === target.id)
          || (item.fromActorId === target.id && item.toActorId === actor.id))
      : undefined;
    const distanceBands: DistanceBand[] = ["贴身", "近身", "短距", "中距", "远距", "离场"];
    return (
      <div className="drawer-content">
        <DistanceLines state={props.state} />
        <p className="hint">
          调整对象：{actor.name} ↔ {target?.name ?? "请先在战场选择目标"}
        </p>
        <div className="flow-buttons">
          {distanceBands.map((band) => (
            <button
              type="button"
              key={band}
              disabled={!target}
              aria-pressed={relation?.band === band}
              onClick={() => target && props.patch((current) => dmSetDistance(current, actor.id, target.id, band))}
            >
              {band}
            </button>
          ))}
          <button
            type="button"
            disabled={!target}
            aria-pressed={relation?.entangled === true}
            onClick={() => target && props.patch((current) => dmSetDistance(
              current,
              actor.id,
              target.id,
              relation?.band ?? "近身",
              !relation?.entangled,
            ))}
          >
            {relation?.entangled ? "解除纠缠" : "设为纠缠"}
          </button>
        </div>
      </div>
    );
  }

  if (drawer === "dmRuling" && props.role === "dm") {
    const phaseAction = props.state.phase === "intercept_window"
      ? { label: "无截击，进入成招", run: formMove }
      : props.state.phase === "react_window"
        ? { label: "无应招，进入落果", run: skipReact }
        : props.state.phase === "outcome"
          ? { label: "结算落果", run: applyOutcome }
          : props.state.phase === "round_end"
            ? { label: "结束本轮", run: endRound }
            : undefined;
    return (
      <div className="drawer-content">
        <p>当前时点：{phaseLabel(props.state.phase)}</p>
        <p>当前行动：{props.state.pendingAction ? "有待结算宣言" : "暂无待结算宣言"}</p>
        {phaseAction ? (
          <button className="primary-action" type="button" onClick={() => props.patch(phaseAction.run)}>
            {phaseAction.label}
          </button>
        ) : <p className="empty-state">当前时点没有需要 DM 推进的裁定。</p>}
        <p className="hint">伤害、状态、势与自由裁定请使用交锋台右侧 DM 工具；距离调整请使用“距离”抽屉。</p>
      </div>
    );
  }

  if (drawer === "dmHidden" && props.role === "dm") {
    return (
      <div className="drawer-content">
        {enemies.map((enemy) => (
          <article className="enemy-card" key={enemy.id}>
            <strong>{enemy.name}</strong>
            <p>隐藏目标：{enemy.hiddenGoal ?? "无"}</p>
            <p>隐藏弱点：{enemy.publicWeakness ?? "无"}</p>
            <p>行为提示：{enemy.behaviorHint ?? "无"}</p>
          </article>
        ))}
      </div>
    );
  }

  if (drawer === "dmScene" && props.role === "dm") {
    return <CampaignPanel state={props.state} title="DM场景抽屉" />;
  }

  return <p className="empty-state">此抽屉仅在对应身份下可见。</p>;
}

function drawerTitle(drawer: DrawerId) {
  const titles: Record<DrawerId, string> = {
    character: "人物详情",
    sixRoots: "六根详情",
    innerArt: "内功与窍位",
    inventory: "背包",
    moves: "招式与动作",
    statuses: "状态详情",
    logs: "日志回放",
    library: "资料库",
    settings: "设置",
    dmEnemies: "敌人完整详情",
    dmDistance: "距离调整",
    dmRuling: "裁定",
    dmHidden: "隐藏信息管理",
    dmScene: "场景",
    dmLog: "DM日志",
  };
  return titles[drawer];
}

function EnemyRoster({ actors, mode }: { actors: Actor[]; mode: "public" | "dm" }) {
  return (
    <section className="panel enemy-roster">
      <h2>{mode === "dm" ? "敌人完整详情" : "敌方公开卡"}</h2>
      {actors.map((actor) => (
        <article className="enemy-card" key={actor.id}>
          <UnitCard actor={actor} mode={mode === "dm" ? "enemyDm" : "enemyPublic"} />
          <p>{actor.publicNote}</p>
          {actor.publicWeakness ? <p><strong>公开弱点：</strong>{actor.publicWeakness}</p> : null}
          {mode === "dm" ? (
            <>
              <p><strong>隐藏目标：</strong>{actor.hiddenGoal ?? "无"}</p>
              <p><strong>行为提示：</strong>{actor.behaviorHint ?? "无"}</p>
              <p><strong>入场条件：</strong>{actor.entryCondition ?? "无"}</p>
              <p><strong>掉落/线索：</strong>{actor.lootOrClue ?? "无"}</p>
              <p><strong>响应：</strong>{actor.responses.map((item) => `${item.responseType}：${item.moveName}`).join("、") || "无"}</p>
            </>
          ) : null}
        </article>
      ))}
    </section>
  );
}

function LogPanel({ state }: { state: CombatState }) {
  return (
    <section className="panel log-panel">
      <h2>日志回放</h2>
      <div className="log-list">
        {state.logs.map((log) => (
          <article key={log.id}>
            <span>{log.type}</span>
            <p>{log.message}</p>
            <small>第{log.round}轮 · {new Date(log.createdAt).toLocaleTimeString()}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function dieLabel(die: QiDie) {
  const nature = die.nature === "yin" ? "阴" : die.nature === "yang" ? "阳" : "原";
  return `${nature}${die.value ?? "?"}/${die.label}`;
}

function phaseLabel(phase: CombatState["phase"]) {
  const labels: Record<CombatState["phase"], string> = {
    setup: "准备",
    initiative: "先后",
    scene: "场景",
    declare: "宣言",
    intercept_window: "截击窗口",
    react_window: "应招窗口",
    outcome: "落果",
    round_end: "轮末",
  };
  return labels[phase];
}

function identityLabel(identity: AppSession["identity"]) {
  if (identity === "dm") return "DM";
  if (identity === "player") return "玩家";
  if (identity === "spectator") return "旁观";
  return "未入席";
}

function generateLanRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "LAN-";
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
