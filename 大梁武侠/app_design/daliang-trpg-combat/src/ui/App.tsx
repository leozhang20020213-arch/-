import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyOutcome,
  advanceTurn,
  canDeclareAction,
  changeMomentum,
  commitDiceRollResults,
  confirmInitiative,
  declareAction,
  dmSetDistance,
  dmOverride,
  enterScene,
  equipItem,
  expireSource,
  formMove,
  getBasicActionAvailability,
  prepareCombatRound,
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
import type { Actor, AppSession, CombatState, DistanceBand, InventoryCategory, InventoryItem, Move, QiDie, QiZone, SceneActionRequest, SceneActionType } from "../combat/types";
import { deriveTargetState } from "../lib/combat/targetValidation";
import { advanceAutoDm } from "../lib/combat/autoDm";
import { createLanClient, type LanClient, type LanConnectionStatus } from "../net/lanClient";
import type { LanMessage } from "../rules/schema";
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
import { CharacterSelect } from "./CharacterSelect";
import {
  SCENE_ACTIONS,
  createHttpNarrationProvider,
  previewSceneAction,
  queueSceneActionRequest,
  resolveQueuedSceneRequest,
  resolveSceneActionWithNarration,
} from "../lib/scene/autoSceneDm";
import { claimPlayerSeat, evaluateRoomReadiness } from "../lib/room/roomRules";

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
  character: `${import.meta.env.BASE_URL}assets/icons/png128/001_player_character_角色.png`,
  inventory: `${import.meta.env.BASE_URL}assets/icons/png128/002_inventory_背包.png`,
  combat: `${import.meta.env.BASE_URL}assets/icons/png128/006_combat_交锋.png`,
  qi: `${import.meta.env.BASE_URL}assets/icons/png128/009_qi_dice_气骰.png`,
  response: `${import.meta.env.BASE_URL}assets/icons/png128/008_response_响应.png`,
  momentum: `${import.meta.env.BASE_URL}assets/icons/png128/011_momentum_势.png`,
  dm: `${import.meta.env.BASE_URL}assets/icons/png128/040_dm_tools_DM工具.png`,
  world: `${import.meta.env.BASE_URL}assets/icons/png128/005_world_世界.png`,
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
  nextRoute?: AppSession["route"];
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

type RoomChannelMessage =
  | { type: "scene_action_requested"; request: SceneActionRequest }
  | { type: "public_state_synced"; state: CombatState; gameMode: AppSession["gameMode"] };

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
    targetId: "",
    moveId: "",
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
  const actedActorIds = useMemo(() => new Set(state.actedActorIds), [state.actedActorIds]);
  const [selectedBasicAction, setSelectedBasicAction] = useState<BasicActionType | null>(null);
  const [autoDmStatus, setAutoDmStatus] = useState("");
  const [selectedSceneAction, setSelectedSceneAction] = useState<SceneActionType>("observe");
  const [selectedSceneTarget, setSelectedSceneTarget] = useState("");
  const [sceneApproach, setSceneApproach] = useState("");
  const [sceneDmStatus, setSceneDmStatus] = useState("");
  const lanClientRef = useRef<LanClient | null>(null);
  const roomChannelRef = useRef<BroadcastChannel | null>(null);

  const playerActorId = session.selectedActorId ?? "pc-shen-qing";
  const selectedTargetId = declarationDraft.targetId;
  const selectedMoveId = declarationDraft.moveId;
  const slotDice = { yin: declarationDraft.yinSlotIds, yang: declarationDraft.yangSlotIds };
  const playerState = useMemo(() => visibleForPlayer(state, playerActorId), [state, playerActorId]);
  const controlledActorId = session.identity === "dm" ? state.activeActorId : playerActorId;
  const controlledActor = state.actors.find((actor) => actor.id === controlledActorId) ?? state.actors[0];

  useEffect(() => saveCombatState(state), [state]);
  useEffect(() => saveAppSession(session), [session]);
  useEffect(() => setSceneDmStatus(""), [session.playMode]);

  useEffect(() => {
    if (rollRequest || session.identity !== "player" || !session.autoDmEnabled || session.route !== "playerScene") return;
    const poolDice = state.dice.filter((die) => die.zone === "QI_POOL" && !die.temporary);
    if (poolDice.length > 0) setRollRequest({ dice: poolDice, mode: "enterScene" });
  }, [rollRequest, session.autoDmEnabled, session.identity, session.route, state.dice]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`daliang-trpg-room:${session.roomCode}`);
    roomChannelRef.current = channel;
    channel.onmessage = (event: MessageEvent<RoomChannelMessage>) => {
      const message = event.data;
      if (!message || typeof message !== "object") return;
      if (message.type === "scene_action_requested" && session.identity === "dm") {
        setState((current) => queueSceneActionRequest(current, message.request));
      }
      if (message.type === "public_state_synced" && session.identity === "player" && session.playMode === "room") {
        setState(message.state);
        setSession((current) => ({
          ...current,
          gameMode: message.gameMode,
          route: message.gameMode === "combat" ? "playerCombat" : "playerScene",
        }));
        setSceneDmStatus("真人 DM 已完成裁定并同步公开状态。");
      }
    };
    return () => {
      channel.close();
      if (roomChannelRef.current === channel) roomChannelRef.current = null;
    };
  }, [session.identity, session.playMode, session.roomCode]);

  useEffect(() => {
    if (session.identity !== "dm" || session.playMode !== "room") return;
    if (session.route !== "dmScene" && session.route !== "dmCombat" && session.route !== "dm") return;
    const publicState = visibleForPlayer(state, session.selectedActorId ?? "pc-shen-qing");
    roomChannelRef.current?.postMessage({
      type: "public_state_synced",
      state: publicState,
      gameMode: session.gameMode,
    } satisfies RoomChannelMessage);
    if (lanStatus === "connected") {
      lanClientRef.current?.send("public_state_synced", { publicState, gameMode: session.gameMode });
    }
  }, [lanStatus, session.gameMode, session.identity, session.playMode, session.route, session.selectedActorId, state]);

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveDrawer(null);
      if (event.key === "F11") {
        event.preventDefault();
        window.daliangDesktop?.toggleFullScreen();
      }
      if (event.code === "Space" && (state.phase === "intercept_window" || state.phase === "react_window")) {
        event.preventDefault();
        skipPendingResponse();
      }
    }
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  });

  useEffect(() => {
    const isPlayerDesk = session.route === "playerScene" || session.route === "playerCombat" || session.route === "player";
    if (!session.autoDmEnabled || session.identity !== "player" || !isPlayerDesk || state.turnPaused) {
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
    }, 420);
    return () => window.clearTimeout(timer);
  }, [playerActorId, session.autoDmEnabled, session.identity, session.route, state]);

  useEffect(() => {
    if (selectedMoveId && !controlledActor.moves.some((move) => move.id === selectedMoveId)) {
      setSelectedMoveId("");
      setSelectedTargetId("");
      setSelectedDice([]);
      setSlotDice({ yin: [], yang: [] });
    }
  }, [controlledActor, selectedBasicAction, selectedMoveId]);

  useEffect(() => {
    setDeclarationDraft({
      actorId: controlledActor.id,
      moveId: "",
      targetId: "",
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
    setDeclarationDraft((current) => ({
      ...current,
      moveId: "",
      targetId: "",
      yinSlotIds: [],
      yangSlotIds: [],
    }));
    setSelectedCombatantId(undefined);
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
      },
    });
  }

  function startNewSoloStory() {
    setState(clearCombatState());
    clearActionDraft();
    setSelectedSceneAction("observe");
    setSelectedSceneTarget("");
    setSceneApproach("");
    setSceneDmStatus("");
    go("characterSelect", { identity: "player", gameMode: "scene", playMode: "solo", autoDmEnabled: true });
  }

  function enterAs(identity: "dm" | "player" | "spectator") {
    const route = identity === "dm" ? "dmScene" : "playerScene";
    setSceneDmStatus("");
    if (identity === "player") {
      setSession((current) => {
        const targetSeat = current.seats.find((seat) => seat.id !== "seat-dm" && (seat.playerName === current.playerName || !seat.playerName));
        return {
          ...current,
          identity,
          playMode: "room",
          autoDmEnabled: false,
          gameMode: "scene",
          route,
          seats: targetSeat ? claimPlayerSeat(current.seats, current.playerName, current.selectedActorId, lanStatus === "connected") : current.seats,
        };
      });
      setActiveDrawer(null);
      return;
    }
    go(route, { identity, gameMode: "scene", playMode: "room", autoDmEnabled: false });
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
    if (session.playMode === "room") {
      showPermissionDenied("真人房间由 DM 裁定。自动 DM 只能向主持提供建议，不能在玩家端代替主持提交。");
      return;
    }
    setSession((current) => ({ ...current, autoDmEnabled: enabled }));
  }

  function handleLanMessage(message: LanMessage) {
    setLanDetail(`收到 ${message.type}`);
    if (message.type === "scene_action_requested" && session.identity === "dm") {
      const request = (message.payload as { request?: SceneActionRequest }).request;
      if (request) setState((current) => queueSceneActionRequest(current, request));
    }
    if (message.type === "public_state_synced" && session.identity === "player") {
      const payload = message.payload as { publicState?: CombatState; gameMode?: AppSession["gameMode"] };
      if (!payload.publicState) return;
      setState(payload.publicState);
      const gameMode = payload.gameMode ?? session.gameMode;
      setSession((current) => ({
        ...current,
        gameMode,
        route: gameMode === "combat" ? "playerCombat" : "playerScene",
      }));
      setSceneDmStatus("已从房主同步公开裁定结果。");
    }
  }

  function startLanRoom() {
    const roomCode = /^LAN-[A-Z0-9]{4}$/.test(session.roomCode) ? session.roomCode : generateLanRoomCode();
    setSession((current) => ({ ...current, roomCode, identity: "dm" }));
    lanClientRef.current?.close();
    const client = createLanClient({
      url: lanUrl,
      roomCode,
      senderId: `dm-${session.room.hostName || "host"}`,
      onMessage: handleLanMessage,
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
      onMessage: handleLanMessage,
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
    setSelectedTargetId("");
    setSelectedCombatantId(undefined);
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

  function enterCombatWithSceneRoll(nextRoute: AppSession["route"]) {
    if (!state.scene.combatUnlocked && session.identity === "player") {
      setPrompt({ title: "尚未取得交锋条件", message: "需要先查明足够线索或抵近仓门。自动 DM 会在裁定中明确显示解锁条件。" });
      return;
    }
    patch((current) => confirmInitiative(prepareCombatRound(current)));
    go(nextRoute, { gameMode: "combat" });
  }

  function commitRollRequest(results: DiceRollResult[]) {
    if (!rollRequest) return;
    patch((current) => {
      const prepared = rollRequest.mode === "enterScene" && (session.identity === "dm" || session.autoDmEnabled)
        ? enterScene(current, () => 1)
        : current;
      const committed = commitDiceRollResults(prepared, results);
      // The embedded 3D roll supplies the authoritative faces. Rebuild the
      // scene initiative after those faces arrive; the temporary placeholder
      // values used to open the scene must never decide who already acted.
      return rollRequest.mode === "enterScene" ? confirmInitiative(committed) : committed;
    });
    if (rollRequest.nextRoute) go(rollRequest.nextRoute, { gameMode: "combat" });
    setRollRequest(null);
  }

  async function submitSceneAction() {
    if (session.identity !== "player") {
      showPermissionDenied("只有玩家本人能提交情景行动；真人 DM 请在主持桌面裁定。 ");
      return;
    }
    const visibleTargets = state.scene.elements.filter((element) => element.public && element.interactionIds.includes(selectedSceneAction));
    const targetId = selectedSceneTarget || visibleTargets[0]?.id;
    if (!targetId) {
      setPrompt({ title: "没有合法目标", message: "当前行动没有可见且具备对应互动入口的目标。" });
      return;
    }
    const request: SceneActionRequest = {
      id: `scene-request-${Date.now()}`,
      actorId: playerActorId,
      actionType: selectedSceneAction,
      targetId,
      approach: sceneApproach.trim() || "按当前环境中最稳妥的规则入口行动",
      createdAt: Date.now(),
    };
    if (session.playMode === "room" && !session.autoDmEnabled) {
      setState((current) => queueSceneActionRequest(current, request));
      roomChannelRef.current?.postMessage({ type: "scene_action_requested", request } satisfies RoomChannelMessage);
      if (lanStatus === "connected") lanClientRef.current?.send("scene_action_requested", { request });
      setSelectedSceneTarget("");
      setSceneApproach("");
      setSceneDmStatus("行动请求已提交给真人 DM；权威状态将在主持裁定后更新。");
      return;
    }
    setSceneDmStatus("自动 DM 正在校验行动类型、目标、危机与资源变化……");
    const narrationProvider = session.aiNarrationEnabled
      ? createHttpNarrationProvider(session.aiNarrationEndpoint)
      : undefined;
    const resolved = await resolveSceneActionWithNarration(state, request, { narrationProvider });
    const next = { ...resolved, phase: "round_end" as const };
    if (!state.scene.combatUnlocked && next.scene.combatUnlocked) {
      setState(confirmInitiative(prepareCombatRound(next)));
      go("playerCombat", { gameMode: "combat" });
    } else {
      setState(next);
    }
    setSelectedSceneTarget("");
    setSceneApproach("");
    setSceneDmStatus(narrationProvider ? "裁定完成；AI 不可用时已自动使用本地规则叙述。" : "裁定完成；本地规则核心已写入状态与日志。 ");
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
    const declaringActor = state.actors.find((actor) => actor.id === actorId);
    const declaringMove = declaringActor?.moves.find((move) => move.id === moveId);
    const targetState = deriveTargetState(state, targetId, declaringMove, actorId);
    if (!targetState.isRangeValid) {
      setPrompt({ title: "目标距离不合法", message: targetState.invalidReason ?? "该目标不在招式允许距离内。" });
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

  function executeBasicAction(
    actorId: string,
    actionType: BasicActionType,
    guideDieId?: string,
    recoverDiceIds: string[] = [],
  ) {
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
      if (!guideDieId || recoverDiceIds.length === 0) {
        setPrompt({ title: "调息尚未配置", message: "请明确选择1枚气海/临气骰作为息引，并至少选择1枚息库常规骰取回。" });
        return;
      }
      patch((current) => regulateBreath(current, actorId, recoverDiceIds, true, undefined, guideDieId));
    }
    if (actionType === "fanzhao") {
      patch((current) => useReflection(current, actorId));
    }
    clearActionDraft();
  }

  function interceptPending(
    responseId?: string,
    diceIds?: string[],
    slots?: { yinSlotDiceIds: string[]; yangSlotDiceIds: string[] },
  ) {
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
      setState(resolveInterceptSuccess(state, responder.id, response.id, submittedDice, slots));
    } catch (error) {
      setPrompt({ title: "截击未通过规则校验", message: error instanceof Error ? error.message : "请重新检查气骰与响应条件。" });
    }
  }

  function reactPending(
    responseId?: string,
    diceIds?: string[],
    slots?: { yinSlotDiceIds: string[]; yangSlotDiceIds: string[] },
  ) {
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
      setState(resolveReact(state, responder.id, response.id, submittedDice, slots));
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
    selectedSceneAction,
    setSelectedSceneAction,
    selectedSceneTarget,
    setSelectedSceneTarget,
    sceneApproach,
    setSceneApproach,
    sceneDmStatus,
    hasPendingSceneRequest: Boolean(state.scene.pendingRequest),
    submitSceneAction,
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
            onEnterCombat={() => enterCombatWithSceneRoll("playerCombat")}
            onStartScene={requestSceneRoll}
            onIntercept={interceptPending}
            onReact={reactPending}
            onSkipResponse={skipPendingResponse}
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
            onEnterCombat={() => enterCombatWithSceneRoll("dmCombat")}
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
            onEndRound={() => patch((current) => advanceTurn(current))}
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
          {session.route === "home" ? <HomeScreen session={session} go={go} onNewSolo={startNewSoloStory} /> : null}
          {session.route === "characterSelect" ? (
            <CharacterSelect state={state} session={session} setSession={setSession} go={go} patch={patch} />
          ) : null}
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
  onNewSolo,
}: {
  session: AppSession;
  go: (route: AppSession["route"], patchSession?: Partial<AppSession>) => void;
  onNewSolo: () => void;
}) {
  const canContinuePlayer = Boolean(session.selectedActorId);
  const canContinueDm = Boolean(session.room.roomName.trim() && session.room.hostName.trim());
  const playerContinueRoute: AppSession["route"] = session.gameMode === "combat" ? "playerCombat" : "playerScene";
  const dmContinueRoute: AppSession["route"] = session.gameMode === "combat" ? "dmCombat" : "dmScene";
  return (
    <section className="home-screen windows-home">
      <header className="home-masthead">
        <img src={iconMap.world} alt="" />
        <div>
          <p className="eyebrow">大梁江湖 · Windows 案桌</p>
          <h2>桥陵雨夜，失镖未归</h2>
          <p>选择你的席位。玩家与主持使用完全独立的桌面、权限和情报层。</p>
        </div>
      </header>
      <div className="role-entry-grid">
        <article className="role-entry role-player">
          <span className="role-seal">侠</span>
          <p className="eyebrow">玩家游玩</p>
          <h3>以一名江湖人进入故事</h3>
          <p>单人故事由本地规则核心全程主持；断网、未配置 AI 或 AI 出错均不会中断。</p>
          <div className="role-actions">
            <button className="primary-action" type="button" disabled={!canContinuePlayer} onClick={() => go(playerContinueRoute, { identity: "player", playMode: "solo", autoDmEnabled: true })}>
              继续单人故事
            </button>
            <button type="button" onClick={onNewSolo}>
              新开单人故事
            </button>
            <button type="button" onClick={() => go("joinRoom", { identity: undefined, playMode: "room", autoDmEnabled: false })}>
              加入房间
            </button>
          </div>
        </article>
        <article className="role-entry role-dm">
          <span className="role-seal">案</span>
          <p className="eyebrow">主持开团</p>
          <h3>掌握边界、暗线与落果</h3>
          <p>真人 DM 处理行动请求、隐藏信息与场景广播；自动 DM 只提供建议，不越权提交。</p>
          <div className="role-actions">
            <button className="primary-action" type="button" disabled={!canContinueDm} onClick={() => go(dmContinueRoute, { identity: "dm", playMode: "room", autoDmEnabled: false })}>
              继续主持
            </button>
            <button type="button" onClick={() => go("createRoom", { identity: "dm", playMode: "room", autoDmEnabled: false })}>
              创建房间
            </button>
            <button type="button" onClick={() => go("packs", { identity: "dm" })}>
              管理团包
            </button>
          </div>
        </article>
      </div>
      <footer className="home-utility-row">
        <button type="button" onClick={() => go("joinRoom", { identity: "spectator", playMode: "room" })}>旁观入席</button>
        <button type="button" onClick={() => go("library")}>规则资料库</button>
        <button type="button" onClick={() => go("settings")}>设置与存档</button>
        <span>F11 全屏 · Esc 关闭抽屉 · 空格跳过响应</span>
      </footer>
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
    <section className="room-grid room-console">
      <div className="panel room-console__primary">
        <header className="room-console__heading">
          <div>
            <p className="eyebrow">真人 DM · 房间筹备</p>
            <h2>创建房间</h2>
          </div>
          <span className="room-console__step">01 / 建桌</span>
        </header>
        <div className="room-form-grid">
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
        </div>
        <div className="room-option-strip">
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
        </div>
        <button className="primary-action room-console__commit" type="button" disabled={!canCreate} onClick={() => go("roomWaiting", { identity: "dm" })}>
          以 DM 身份开房
        </button>
        {!canCreate ? <p className="form-error">请填写房间名与主持人名称。</p> : null}
      </div>

      <div className="panel room-console__dossier">
        <header className="room-console__heading">
          <div>
            <p className="eyebrow">当前团包</p>
            <h2>桥陵镇雨夜失镖</h2>
          </div>
          <span className="support-active-badge">校验通过</span>
        </header>
        <p className="room-console__lead">调查失镖真相，在巡检与敌人撤离前夺回镖箱。</p>
        <dl className="room-dossier-grid">
          <div><dt>流程</dt><dd>调查 → 交锋 → 收束</dd></div>
          <div><dt>规模</dt><dd>推荐 1–4 人</dd></div>
          <div><dt>时长</dt><dd>约 60–90 分钟</dd></div>
          <div><dt>兼容</dt><dd>规则引擎 v4</dd></div>
        </dl>
        <div className="split-actions">
          <button type="button" onClick={() => go("home")}>返回</button>
          <button type="button" onClick={() => go("joinRoom")}>改为加入房间</button>
        </div>
        <details className="room-advanced">
          <summary>高级设置 · 局域网联机</summary>
          <div className="lan-box">
            <p className="hint">仅在需要跨窗口或局域网联机时使用；单机主持无需开启。</p>
            <label>
              房主 WebSocket 地址
              <input value={lanUrl} onChange={(event) => setLanUrl(event.target.value)} />
            </label>
            <p>房间码：{session.roomCode}</p>
            <p>连接状态：{lanStatus}{lanDetail ? ` · ${lanDetail}` : ""}</p>
            <button type="button" disabled={!canCreate} title={!canCreate ? "请先填写房间名与主持人名称" : undefined} onClick={startLanRoom}>开启局域网房间</button>
          </div>
        </details>
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
    <section className="room-grid room-console">
      <div className="panel room-console__primary">
        <header className="room-console__heading">
          <div><p className="eyebrow">玩家 · 入席准备</p><h2>加入房间</h2></div>
          <span className="room-console__step">01 / 入席</span>
        </header>
        <label>
          房间码 / 本地房间
          <input value={session.roomCode} onChange={(event) => setSession((current) => ({ ...current, roomCode: event.target.value }))} />
        </label>
        <label>
          玩家名称
          <input value={session.playerName} onChange={(event) => setSession((current) => ({ ...current, playerName: event.target.value }))} />
        </label>
      </div>
      <div className="panel room-console__dossier">
        <header className="room-console__heading">
          <div><p className="eyebrow">公开席位</p><h2>角色选择</h2></div>
          <span className="room-console__step">02 / 认领</span>
        </header>
        <label>
          选择角色
          <select value={session.selectedActorId} onChange={(event) => setSession((current) => ({ ...current, selectedActorId: event.target.value }))}>
            {state.actors.filter((actor) => actor.side === "player").map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
          </select>
        </label>
        <div className="split-actions">
          <button type="button" onClick={() => go("home")}>返回</button>
          <button className="primary-action" type="button" disabled={!canJoin} onClick={() => enterAs("player")}>以玩家身份进入</button>
          <button type="button" title={!session.room.allowSpectators ? "房主未开放旁观席位" : !session.roomCode.trim() ? "请先填写房间码" : undefined} onClick={() => enterAs("spectator")} disabled={!session.room.allowSpectators || !session.roomCode.trim()}>旁观</button>
        </div>
        <details className="room-advanced">
          <summary>高级设置 · 局域网联机</summary>
          <div className="lan-box">
            <label>
              房主 WebSocket 地址
              <input value={lanUrl} onChange={(event) => setLanUrl(event.target.value)} />
            </label>
            <p>连接状态：{lanStatus}{lanDetail ? ` · ${lanDetail}` : ""}</p>
            <button type="button" disabled={!canJoin} title={!canJoin ? "请填写房间码、玩家名称并选择角色" : undefined} onClick={joinLanRoom}>连接局域网房间</button>
          </div>
        </details>
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
  const readiness = evaluateRoomReadiness(session.seats);
  const canStart = readiness.canStart;
  const startReason = readiness.reason;
  return (
    <section className="room-grid room-console room-waiting">
      <div className="panel room-console__primary">
        <header className="room-console__heading">
          <div><p className="eyebrow">席位与连接状态</p><h2>{session.room.roomName}</h2></div>
          <span className="room-code-badge">{session.roomCode}</span>
        </header>
        <div className="actor-list">
          {session.seats.map((seat) => <div className={`actor-card static room-seat-card ${seat.ready ? "is-ready" : "is-waiting"} ${seat.playerName ? "is-occupied" : "is-empty"}`} key={seat.id}><strong>{seat.label}</strong><span>{seat.playerName ?? "空位"}</span><small>{seat.actorId ? players.find((actor) => actor.id === seat.actorId)?.name : "未分配人物"}</small><em className={`connection-dot ${seat.connectionStatus ?? "offline"}`}>{seat.connectionStatus === "connected" ? "已连接" : seat.connectionStatus === "disconnected" ? "已断线，可重连" : "本地/离线"}</em><b>{seat.ready ? "已准备" : seat.playerName ? "等待准备" : "未占用"}</b></div>)}
        </div>
      </div>
      <div className="panel room-console__dossier">
        <header className="room-console__heading">
          <div><p className="eyebrow">主持控制</p><h2>角色与开场</h2></div>
          <span className={`room-console__step ${canStart ? "is-ready" : ""}`}>{canStart ? "可开场" : "待就绪"}</span>
        </header>
        {players.map((actor) => <div className="actor-card static" key={actor.id}><strong>{actor.name}</strong><span>{session.selectedActorId === actor.id ? "已分配" : "未分配"}</span></div>)}
        <label className="check-row">
          <input checked={session.room.allowSpectators} disabled={!isHost} type="checkbox" onChange={(event) => setSession((current) => ({ ...current, room: { ...current.room, allowSpectators: event.target.checked } }))} />
          允许旁观
        </label>
        <div className="split-actions">
          <button type="button" onClick={() => go("home")}>返回首页</button>
          {session.identity !== "spectator" ? <button type="button" onClick={() => go("characterAssign")}>{isHost ? "角色分配" : "选择角色"}</button> : null}
          {isHost ? <button className="primary-action" type="button" disabled={!canStart} title={!canStart ? startReason : "进入真人 DM 情景桌面"} onClick={() => go("dmScene", { gameMode: "scene" })}>开始情景</button> : null}
          {isHost ? <button type="button" disabled={!canStart} title={!canStart ? startReason : "跳过调查，直接进入交锋台"} onClick={() => go("dmCombat", { gameMode: "combat" })}>直接进入交锋</button> : null}
          {session.identity === "spectator" ? <button type="button" onClick={() => go("playerScene", { gameMode: "scene" })}>返回旁观桌面</button> : null}
        </div>
        <p className={canStart ? "room-ready-reason ready" : "room-ready-reason"}>{startReason}</p>
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
  const playerActors = state.actors.filter((actor) => actor.side === "player");
  const playerSeats = session.seats.filter((seat) => seat.id !== "seat-dm");

  function updateSeat(seatId: string, patchSeat: Partial<AppSession["seats"][number]>) {
    setSession((current) => ({ ...current, seats: current.seats.map((seat) => seat.id === seatId ? { ...seat, ...patchSeat } : seat) }));
  }
  return (
    <section className="room-grid room-console room-assignment">
      <div className="panel room-console__primary">
        <header className="room-console__heading">
          <div><p className="eyebrow">人物、玩家、准备状态独立保存</p><h2>{isHost ? "逐席位分配" : "选择你的角色"}</h2></div>
          <span className="room-console__step">02 / 分配</span>
        </header>
        {isHost ? playerSeats.map((seat) => {
          const otherUsed = new Set(playerSeats.filter((item) => item.id !== seat.id).map((item) => item.actorId).filter(Boolean));
          return <article className="seat-assignment-row" key={seat.id}><strong>{seat.label}</strong><label>玩家<input value={seat.playerName ?? ""} placeholder="空位不参与开场校验" onChange={(event) => updateSeat(seat.id, { playerName: event.target.value, ready: false })} /></label><label>人物<select value={seat.actorId ?? ""} disabled={!seat.playerName?.trim()} onChange={(event) => updateSeat(seat.id, { actorId: event.target.value || undefined, ready: false })}><option value="">未分配</option>{playerActors.map((actor) => <option key={actor.id} value={actor.id} disabled={otherUsed.has(actor.id)}>{actor.name}{otherUsed.has(actor.id) ? "（已占用）" : ""}</option>)}</select></label><label className="check-row"><input type="checkbox" checked={seat.ready} disabled={!seat.playerName?.trim() || !seat.actorId} onChange={(event) => updateSeat(seat.id, { ready: event.target.checked })} />准备</label></article>;
        }) : <label>玩家角色<select disabled={isSpectator} value={session.selectedActorId ?? ""} onChange={(event) => setSession((current) => ({ ...current, selectedActorId: event.target.value }))}><option value="">未分配</option>{playerActors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}</select></label>}
        <p className="hint">人物、玩家、准备和连接状态均按席位独立保存；角色冲突会阻止开场。</p>
      </div>
      <div className="panel room-console__dossier">
        <header className="room-console__heading"><div><p className="eyebrow">权限分流</p><h2>进入桌面</h2></div></header>
        <p className="room-console__lead">玩家只进入自己的公开桌面；主持继续使用隐藏信息与裁定桌面。</p>
        <div className="split-actions">
          <button type="button" onClick={() => go("roomWaiting")}>返回房间</button>
          {!isSpectator && !isHost ? <button className="primary-action" type="button" onClick={() => enterAs("player")} disabled={!session.selectedActorId} title={!session.selectedActorId ? "请先选择人物" : "进入玩家公开桌面"}>以玩家身份进入</button> : null}
        </div>
      </div>
    </section>
  );
}

function PlayerSceneDesk(props: DeskProps & {
  actorId: string;
  onStartScene: () => void;
  onEnterCombat: () => void;
  onIntercept: (
    responseId?: string,
    diceIds?: string[],
    slots?: { yinSlotDiceIds: string[]; yangSlotDiceIds: string[] },
  ) => void;
  onReact: (
    responseId?: string,
    diceIds?: string[],
    slots?: { yinSlotDiceIds: string[]; yangSlotDiceIds: string[] },
  ) => void;
  onSkipResponse: () => void;
}) {
  const actor = props.state.actors.find((item) => item.id === props.actorId) ?? props.state.actors[0];
  const enemies = props.state.actors.filter((item) => item.side !== "player");
  const selectedMove = props.selectedBasicAction ? undefined : actor.moves.find((move) => move.id === props.selectedMoveId);
  const targets = targetCandidatesFor(props.state, actor, selectedMove);
  const targetableActorIds = selectedMove ? targets.map((target) => target.id) : [];
  const selectedEnemy = enemies.find((enemy) => enemy.id === props.selectedCombatantId);
  const ownsResponseWindow = Boolean(
    props.state.pendingAction?.targetId === actor.id
    && (props.state.phase === "intercept_window" || props.state.phase === "react_window"),
  );

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
      leftCollapsible
      leftInitiallyCollapsed
      leftCollapsedLabel="江湖卷宗"
      center={
        <CenterCombatPanel
          stage={
            <div className="scene-confrontation-stage">
              <header className="scene-context-ribbon">
                <div><small>第{props.state.scene.act}幕 · {props.state.scene.timeWindow}</small><strong>{props.state.scene.location}</strong></div>
                <div className="scene-token-row" aria-label="场景对象">
                  {props.state.scene.elements.filter((element) => element.public).map((element) => (
                    <button key={element.id} type="button" title={element.description} onDoubleClick={() => props.setSelectedSceneTarget(element.id)}><i>{element.kind === "person" ? "人" : element.kind === "object" ? "物" : "景"}</i>{element.name}</button>
                  ))}
                </div>
                {props.state.tracks.map((track) => <span className="scene-track-token" key={track.id} title={`${track.description}\n${track.triggerOutcome ?? ""}`}>{track.name}<b>{track.value}/{track.max}</b></span>)}
              </header>
              <CombatStage state={props.state} selectedId={props.selectedCombatantId} selectedTargetId={props.selectedTargetId} targetableActorIds={targetableActorIds} onSelect={(id) => { props.setSelectedCombatantId(id); if (targetableActorIds.includes(id)) props.setSelectedTargetId(id); }} selectedMove={selectedMove} />
            </div>
          }
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
              onRollToSea={!props.readOnly ? props.onStartScene : undefined}
              declarationEnabled={Boolean(!props.readOnly && !props.selectedBasicAction && selectedMove && props.selectedTargetId && actor.id === props.state.activeActorId)}
              inactiveReason={!selectedMove ? "选择一张情景或武学卡。" : !props.selectedTargetId ? "双击场上人物确定目标。" : undefined}
              onConfirm={() => {
                if (!selectedMove || !props.selectedTargetId) return;
                props.declareFor(actor.id, props.selectedTargetId, selectedMove.id);
              }}
            />
          }
        />
      }
      right={
        <RightCombatPanel actions={
          ownsResponseWindow ? <PlayerResponseWorkbench state={props.state} actor={actor} readOnly={props.readOnly} onSubmit={props.state.phase === "intercept_window" ? props.onIntercept : props.onReact} onSkip={props.onSkipResponse} />
            : selectedEnemy ? <EnemyPublicDrawer actor={selectedEnemy} mode="player" onClose={() => props.setSelectedCombatantId(undefined)} />
              : <section className="panel scene-inspector"><span className="context-kicker">情景交锋</span><h2>{props.state.sceneGoal}</h2><p>{props.state.scene.narration}</p><div className="scene-fact-chips">{[...props.state.scene.permissions, ...props.state.scene.resources].filter((fact) => !fact.consumed).map((fact) => <span key={fact.id} title={fact.description}>{fact.name}</span>)}</div></section>
        } />
      }
      rightCollapsed={!ownsResponseWindow && !selectedEnemy}
      rightCollapsedLabel="情景情报"
      bottom={
        <PhaseActionBar state={props.state} isDM={false} readOnly={props.readOnly} canCurrentUserRespond={props.state.pendingAction?.targetId === actor.id} responseHandledInWorkbench automationMessage={props.session.autoDmEnabled ? props.autoDmStatus : undefined} onEnterDeclaration={props.onStartScene} onIntercept={props.onIntercept} onReact={props.onReact} onSkipResponse={props.onSkipResponse} />
      }
      drawer={props.activeDrawer ? <DrawerLayer {...props} actor={actor} role="player" /> : null}
    />
  );
}

function PlayerCombatDesk(props: DeskProps & {
  actorId: string;
  onStartScene: () => void;
  onIntercept: (
    responseId?: string,
    diceIds?: string[],
    slots?: { yinSlotDiceIds: string[]; yangSlotDiceIds: string[] },
  ) => void;
  onReact: (
    responseId?: string,
    diceIds?: string[],
    slots?: { yinSlotDiceIds: string[]; yangSlotDiceIds: string[] },
  ) => void;
  onSkipResponse: () => void;
}) {
  const actor = props.state.actors.find((item) => item.id === props.actorId) ?? props.state.actors[0];
  const enemies = props.state.actors.filter((item) => item.side !== "player");
  const selectedMove = props.selectedBasicAction
    ? undefined
    : actor.moves.find((move) => move.id === props.selectedMoveId);
  const targets = targetCandidatesFor(props.state, actor, selectedMove);
  const targetableActorIds = selectedMove ? targets.map((target) => target.id) : [];
  const selectedEnemy = enemies.find((enemy) => enemy.id === props.selectedCombatantId);
  const ownsResponseWindow = Boolean(
    props.state.pendingAction?.targetId === actor.id
    && (props.state.phase === "intercept_window" || props.state.phase === "react_window"),
  );

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
      leftCollapsible
      leftInitiallyCollapsed
      leftCollapsedLabel="战况卷宗"
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
              declarationEnabled={Boolean(
                !props.readOnly
                && !props.selectedBasicAction
                && selectedMove
                && props.selectedTargetId
                && actor.id === props.state.activeActorId
              )}
              inactiveReason={!selectedMove
                ? "先选择一张行动牌。"
                : !props.selectedTargetId
                  ? "行动牌已选；请在交锋台或目标栏选择对象。"
                  : undefined}
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
      rightCollapsed={!ownsResponseWindow && !selectedEnemy}
      rightCollapsedLabel="目标情报"
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
  const publicElements = props.state.scene.elements.filter((element) => element.public);
  const hiddenElements = props.state.scene.elements.filter((element) => !element.public);

  function recordTrackChange(trackId: string, delta: number) {
    props.patch((current) => {
      const track = current.tracks.find((item) => item.id === trackId);
      if (!track) return current;
      const nextValue = Math.max(0, Math.min(track.max, track.value + delta));
      const message = `DM手动覆盖｜${track.name} ${track.value}→${nextValue}｜${props.dmNote || "主持台调整"}`;
      return {
        ...current,
        tracks: current.tracks.map((item) => item.id === trackId ? { ...item, value: nextValue } : item),
        logs: [{ id: `DM_TRACK-${Date.now()}`, type: "DM_OVERRIDE", round: current.round, message, public: false, createdAt: Date.now() }, ...current.logs],
      };
    });
  }

  function revealElement(elementId: string) {
    props.patch((current) => {
      const target = current.scene.elements.find((element) => element.id === elementId);
      if (!target) return current;
      const message = `线索公开｜${target.name}｜${props.dmNote || target.description}`;
      return {
        ...current,
        scene: { ...current.scene, elements: current.scene.elements.map((element) => element.id === elementId ? { ...element, public: true } : element) },
        logs: [{ id: `DM_REVEAL-${Date.now()}`, type: "SCENE_REVEAL", round: current.round, message, public: true, createdAt: Date.now() }, ...current.logs],
      };
    });
  }

  function rulePendingRequest(ruling: "approved" | "modified" | "rejected") {
    props.patch((current) => resolveQueuedSceneRequest(
      current,
      ruling,
      ruling === "approved" ? "" : props.dmNote,
    ));
  }

  const pendingSceneRequest = props.state.scene.pendingRequest;
  const pendingActor = props.state.actors.find((actor) => actor.id === pendingSceneRequest?.actorId);
  const pendingTarget = props.state.scene.elements.find((element) => element.id === pendingSceneRequest?.targetId);
  const pendingDefinition = SCENE_ACTIONS.find((action) => action.id === pendingSceneRequest?.actionType);

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
      left={
        <aside className="scene-side-column dm-scene-ledger">
          <section className="panel"><p className="eyebrow">主持记录</p><h2>{props.state.scene.location}</h2><dl className="scene-ledger"><dt>时间窗</dt><dd>{props.state.scene.timeWindow}</dd><dt>边界</dt><dd>{props.state.scene.boundary}</dd><dt>收束</dt><dd>{props.state.scene.completed ? props.state.scene.ending : "夺回镖箱、确认内应去向或危机落果"}</dd></dl></section>
          <section className="panel scene-tracks-vertical"><h3>危机与解密</h3>{props.state.tracks.map((track) => <article className="dm-track-card" key={track.id}><div><strong>{track.name}</strong><span>{track.value}/{track.max}</span></div><meter min={0} max={track.max} value={track.value} /><small>{track.description}</small>{track.kind === "crisis" ? <><em>增长：{track.growthConditions?.join("；")}</em><em>阈值：{track.triggerOutcome}</em><em>降低：{track.reductionConditions?.join("；")}</em></> : <div className="insight-layers">{track.insightLayers?.map((layer) => <span className={track.value >= layer.level * 2 ? "revealed" : ""} key={layer.level}>第{layer.level}层 · {track.value >= layer.level * 2 ? layer.summary : "尚未公开"}</span>)}</div>}<div className="mini-stepper"><button type="button" onClick={() => recordTrackChange(track.id, -1)}>−</button><button type="button" onClick={() => recordTrackChange(track.id, 1)}>＋</button></div></article>)}</section>
        </aside>
      }
      center={
        <main className="dm-scene-center">
          <section className="scene-stage dm-stage"><div className="scene-stage-heading"><div><p className="eyebrow">真人 DM · 共享画面</p><h2>{props.state.sceneName}</h2></div><span className="identity-pill">玩家可见层</span></div><p className="scene-narration">{props.state.scene.narration}</p><div className="scene-elements">{publicElements.map((element) => <article className={`scene-element kind-${element.kind}`} key={element.id}><span>{element.kind === "person" ? "人" : element.kind === "object" ? "物" : "景"}</span><div><strong>{element.name}</strong><small>{element.description}</small></div></article>)}</div></section>
          <section className="panel dm-request-queue">
            <div className="panel-title">
              <div><p className="eyebrow">行动请求</p><h2>{pendingSceneRequest ? "需要主持裁定" : "等待玩家提交"}</h2></div>
              <span>{pendingSceneRequest ? "1 项" : "空"}</span>
            </div>
            {pendingSceneRequest ? (
              <article className="dm-scene-request-card">
                <div className="dm-request-facts">
                  <span><small>玩家</small><strong>{pendingActor?.name ?? pendingSceneRequest.actorId}</strong></span>
                  <span><small>行动</small><strong>{pendingDefinition?.name ?? pendingSceneRequest.actionType}</strong></span>
                  <span><small>目标</small><strong>{pendingTarget?.name ?? "未指定"}</strong></span>
                  <span><small>规则入口</small><strong>{pendingDefinition?.ruleEntry ?? "待主持核定"}</strong></span>
                </div>
                <p>{pendingSceneRequest.approach}</p>
                <small>修改提案将使用右侧“私有依据 / 广播内容”作为新的行动办法，再由规则核心结算。</small>
                <div className="split-actions">
                  <button type="button" onClick={() => rulePendingRequest("rejected")}>驳回并说明</button>
                  <button type="button" disabled={!props.dmNote.trim()} title={!props.dmNote.trim() ? "请先在右侧填写修改后的行动办法" : undefined} onClick={() => rulePendingRequest("modified")}>修改后结算</button>
                  <button className="primary-action" type="button" onClick={() => rulePendingRequest("approved")}>批准并结算</button>
                </div>
              </article>
            ) : <p className="empty-copy">房间玩家提交情景行动后，会在这里显示玩家、目标、办法与规则入口。</p>}
          </section>
          <section className="panel dm-scene-cast"><h3>人物与行为倾向</h3><div className="dm-cast-grid">{props.state.actors.map((actor) => <article key={actor.id}><strong>{actor.name}</strong><span>{actor.side === "player" ? "玩家公开" : actor.behaviorHint || "按局势保命与护送目标"}</span><small>{actor.side === "player" ? `${actor.hp}/${actor.maxHp} 气血` : actor.hiddenGoal || "无隐藏目标"}</small></article>)}</div></section>
        </main>
      }
      right={
        <aside className="dm-scene-tools">
          <section className="panel"><p className="eyebrow">隐藏层</p><h2>未公开对象</h2>{hiddenElements.length ? hiddenElements.map((element) => <article className="hidden-scene-item" key={element.id}><strong>{element.name}</strong><small>{element.description}</small><button type="button" onClick={() => revealElement(element.id)}>公开并记日志</button></article>) : <p className="empty-copy">当前无隐藏对象。</p>}</section>
          <section className="panel"><h2>主持裁定与广播</h2><label>私有依据 / 广播内容<textarea value={props.dmNote} onChange={(event) => props.setDmNote(event.target.value)} /></label><div className="flow-buttons"><button type="button" onClick={() => props.setDmNote(props.state.scene.lastResolution?.nextPrompt || "建议：先确认玩家目标是否合法，再根据危机增长条件给出代价。")}>请求自动 DM 建议</button><button type="button" onClick={props.onOverride}>广播并写入日志</button><button className="primary-action" type="button" onClick={props.onEnterCombat}>切换战斗表现</button></div><small>沿用当前轮次与气海，不重新投骰。自动 DM 建议不会自动提交；所有手动覆盖均保留主持备注。</small></section>
        </aside>
      }
      bottom={
        <div className="scene-status-bar"><span>真人 DM 主持桌面</span><span>公开对象 {publicElements.length} · 隐藏对象 {hiddenElements.length}</span><span>{props.state.scene.combatUnlocked ? "交锋条件成立" : "可由主持按场景边界推进"}</span></div>
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
  const activeActor = props.state.actors.find((actor) => actor.id === props.state.activeActorId) ?? props.state.actors[0];
  const selectedMove = activeActor.moves.find((move) => move.id === props.selectedMoveId);
  const targets = targetCandidatesFor(props.state, activeActor, selectedMove);
  const targetableActorIds = selectedMove ? targets.map((target) => target.id) : [];
  const selectedActor = props.state.actors.find((actor) => actor.id === props.selectedCombatantId);
  const availableDice = props.state.dice.filter((die) => die.ownerId === activeActor.id && (die.zone === "QI_SEA" || die.zone === "TEMP_QI"));
  const pending = props.state.pendingAction;
  const pendingActor = props.state.actors.find((actor) => actor.id === pending?.actorId);
  const pendingTarget = props.state.actors.find((actor) => actor.id === pending?.targetId);
  const pendingMove = pendingActor?.moves.find((move) => move.id === pending?.moveId);

  function recordDmState(label: string, updater: (current: CombatState) => CombatState) {
    props.patch((current) => {
      const changed = updater(current);
      return {
        ...changed,
        logs: [{ id: `DM-${Date.now()}`, type: "DM_OVERRIDE", round: current.round, message: `${label}｜${props.dmNote || "主持台操作"}`, public: false, createdAt: Date.now() }, ...changed.logs],
      };
    });
  }

  function assignDmDie(die: QiDie) {
    if (die.nature === "yin") props.assignDieToSlot(die.id, "yin");
    else if (die.nature === "yang") props.assignDieToSlot(die.id, "yang");
    else props.assignDieToSlot(die.id, props.slotDice.yin.length <= props.slotDice.yang.length ? "yin" : "yang");
  }

  return (
    <CombatShell
      top={<TopCombatBar session={props.session} state={props.state} activeDrawer={props.activeDrawer} setActiveDrawer={props.setActiveDrawer} debugView={props.debugView} setDebugView={props.setDebugView} onHome={() => props.go("home")} onReset={props.resetAll} actedActorIds={props.actedActorIds} />}
      left={
        <aside className="dm-host-ledger">
          <header><small>真人 DM · 私有卷宗</small><h2>{props.state.sceneName}</h2><span>{props.state.scene.timeWindow}</span></header>
          <section><h3>场景边界</h3><p>{props.state.scene.boundary}</p><h3>收束条件</h3><p>{props.state.scene.completed ? props.state.scene.ending : props.state.sceneGoal}</p></section>
          <section className="dm-host-tracks"><h3>危机与解密</h3>{props.state.tracks.map((track) => <article key={track.id} title={`${track.description}\n${track.triggerOutcome ?? ""}`}><div><span>{track.name}</span><b>{track.value}/{track.max}</b></div><meter min={0} max={track.max} value={track.value} /><div className="mini-stepper"><button type="button" onDoubleClick={() => recordDmState(`${track.name}-1`, (current) => ({ ...current, tracks: current.tracks.map((item) => item.id === track.id ? { ...item, value: Math.max(0, item.value - 1) } : item) }))}>−</button><button type="button" onDoubleClick={() => recordDmState(`${track.name}+1`, (current) => ({ ...current, tracks: current.tracks.map((item) => item.id === track.id ? { ...item, value: Math.min(item.max, item.value + 1) } : item) }))}>＋</button></div></article>)}</section>
          <section className="dm-private-cast"><h3>隐藏意图</h3>{props.state.actors.filter((actor) => actor.side !== "player").map((actor) => <button type="button" key={actor.id} onClick={() => props.setSelectedCombatantId(actor.id)}><strong>{actor.name}</strong><span>{actor.hiddenGoal || actor.behaviorHint || "按策略档案行动"}</span></button>)}</section>
        </aside>
      }
      center={
        <main className="dm-shared-monitor">
          <header><div><small>玩家共享画面监看</small><strong>{props.state.encounterMode === "scene" ? "情景交锋" : "战斗交锋"}</strong></div><span className={props.state.turnPaused ? "paused" : "live"}>{props.state.turnPaused ? "已暂停" : "同步中"}</span></header>
          <div className="dm-monitor-stage"><CombatStage state={props.state} selectedId={props.selectedCombatantId} selectedTargetId={props.selectedTargetId} targetableActorIds={targetableActorIds} onSelect={(id) => { props.setSelectedCombatantId(id); if (targetableActorIds.includes(id)) props.setSelectedTargetId(id); }} selectedMove={selectedMove} /></div>
          <section className="dm-action-stack">
            <span>当前时点</span><strong>{phaseLabel(props.state.phase)}</strong>
            {pending ? <p>{pendingActor?.name}「{pendingMove?.name}」→ {pendingTarget?.name} · 锁气{pending.diceIds.length}</p> : <p>{activeActor.name} 正在行动，尚无宣言。</p>}
            <div>{props.state.phase === "intercept_window" ? <><button type="button" onClick={props.onIntercept}>代为截击</button><button type="button" onClick={props.onSkipResponse}>关闭截击窗</button></> : null}{props.state.phase === "react_window" ? <><button type="button" onClick={props.onReact}>代为应招</button><button type="button" onClick={props.onSkipResponse}>放弃应招</button></> : null}{props.state.phase === "outcome" ? <button className="dm-outcome-confirm" type="button" onClick={props.onOutcome}>落果确认印</button> : null}{props.state.phase === "round_end" ? <button type="button" onClick={props.onEndRound}>推进序列</button> : null}</div>
          </section>
        </main>
      }
      right={
        <aside className="dm-command-column">
          <section className="dm-command-head"><div><small>当前行动者</small><h2>{activeActor.name}</h2><span>{activeActor.side === "player" ? "玩家角色" : "自动角色"} · {activeActor.momentum}</span></div><button type="button" onClick={() => recordDmState(props.state.turnPaused ? "恢复行动序列" : "暂停行动序列", (current) => ({ ...current, turnPaused: !current.turnPaused }))}>{props.state.turnPaused ? "恢复" : "暂停"}</button></section>
          <section className="dm-takeover"><header><h3>手动接管</h3><small>双击招式、目标与气骰</small></header><div className="dm-move-rack">{activeActor.moves.map((move) => <button type="button" className={selectedMove?.id === move.id ? "selected" : ""} key={move.id} title={`${move.targetRange}\n${move.baseEffect}`} onDoubleClick={() => props.setSelectedMoveId(move.id)}><b>{move.name}</b><span>{move.minDice}骰 · {move.qiNatureThreshold}</span></button>)}</div><div className="dm-dice-rack">{availableDice.map((die) => <button type="button" className={props.slotDice.yin.includes(die.id) ? "yin" : props.slotDice.yang.includes(die.id) ? "yang" : ""} key={die.id} title={`${die.sourceName}\n双击自动入合法槽`} onDoubleClick={() => assignDmDie(die)}>{die.nature === "yin" ? "阴" : die.nature === "yang" ? "阳" : "原"}<b>{die.value}</b></button>)}</div><div className="dm-slot-summary"><span>阴槽 {props.slotDice.yin.length}</span><span>阳槽 {props.slotDice.yang.length}</span><span>{props.selectedTargetId ? `目标 ${props.state.actors.find((actor) => actor.id === props.selectedTargetId)?.name}` : "双击场上目标"}</span></div><button className="dm-takeover-confirm" type="button" disabled={!selectedMove || !props.selectedTargetId || props.slotDice.yin.length + props.slotDice.yang.length < (selectedMove?.minDice ?? 99)} onClick={() => selectedMove && props.selectedTargetId && props.declareFor(activeActor.id, props.selectedTargetId, selectedMove.id)}>确认接管宣言</button></section>
          <section className="dm-ruling-box"><h3>裁定、建议与广播</h3><textarea value={props.dmNote} onChange={(event) => props.setDmNote(event.target.value)} placeholder="填写简短理由或广播内容" /><div><button type="button" onClick={() => props.setDmNote(`建议：${activeActor.name}优先${activeActor.aiProfile?.objective || activeActor.behaviorHint || "维持当前目标"}；建议不会自动提交。`)}>自动DM建议</button><button type="button" onClick={props.onOverride}>广播确认印</button></div></section>
          {selectedActor ? <section className="dm-selected-inspector"><button type="button" aria-label="关闭检查器" onClick={() => props.setSelectedCombatantId(undefined)}>×</button><strong>{selectedActor.name}</strong><span>气血 {selectedActor.hp}/{selectedActor.maxHp} · 势 {selectedActor.momentum}</span><p>{selectedActor.hiddenGoal || selectedActor.publicNote}</p></section> : null}
        </aside>
      }
      bottom={<nav className="dm-hidden-tray" aria-label="主持隐藏牌匣"><span>隐藏牌匣</span><button type="button" onClick={() => props.setActiveDrawer("dmEnemies")}>NPC / 敌人</button><button type="button" onClick={() => props.setActiveDrawer("dmHidden")}>线索 / 事件</button><button type="button" onClick={() => props.setActiveDrawer("dmScene")}>动景 / 触发器</button><button type="button" onClick={() => props.setActiveDrawer("dmLog")}>主持日志</button></nav>}
      drawer={props.activeDrawer ? <DrawerLayer {...props} actor={activeActor} role="dm" /> : null}
    />
  );
}

function LegacyDmCombatDesk(props: DeskProps & {
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
  const targetableActorIds = selectedMove ? targets.map((target) => target.id) : [];
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
      leftCollapsible
      leftInitiallyCollapsed
      leftCollapsedLabel="主持战况"
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
                  declarationEnabled={Boolean(!props.selectedBasicAction && selectedMove && props.selectedTargetId)}
                  inactiveReason={!selectedMove
                    ? "先为当前行动者选择行动牌。"
                    : !props.selectedTargetId
                      ? "行动牌已选；请选择合法目标。"
                      : undefined}
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
  executeBasicAction: (
    actorId: string,
    actionType: BasicActionType,
    guideDieId?: string,
    recoverDiceIds?: string[],
  ) => void;
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
  selectedSceneAction: SceneActionType;
  setSelectedSceneAction: (action: SceneActionType) => void;
  selectedSceneTarget: string;
  setSelectedSceneTarget: (targetId: string) => void;
  sceneApproach: string;
  setSceneApproach: (approach: string) => void;
  sceneDmStatus: string;
  hasPendingSceneRequest: boolean;
  submitSceneAction: () => Promise<void>;
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
  const [inspectedMoveId, setInspectedMoveId] = useState<string | null>(null);
  const selectedMove = props.selectedBasicAction ? undefined : props.actor.moves.find((move) => move.id === props.selectedMoveId);
  const inspectedMove = props.actor.moves.find((move) => move.id === inspectedMoveId);
  const regulateBreathAvail = getBasicActionAvailability(props.state, props.actor.id, "regulateBreath");
  const fanzhaoAvail = getBasicActionAvailability(props.state, props.actor.id, "fanzhao");
  const isBreathSelected = props.selectedBasicAction === "regulateBreath";
  const isFanzhaoSelected = props.selectedBasicAction === "fanzhao";
  const guideCandidates = props.state.dice.filter((die) =>
    die.ownerId === props.actor.id && (die.zone === "QI_SEA" || die.zone === "TEMP_QI"));
  const recoveryCandidates = props.state.dice.filter((die) =>
    die.ownerId === props.actor.id && die.zone === "QI_REST" && !die.temporary);
  const selectedGuideIds = props.selectedDice.filter((id) => guideCandidates.some((die) => die.id === id));
  const selectedRecoveryIds = props.selectedDice.filter((id) => recoveryCandidates.some((die) => die.id === id));
  const breathLimit = 1 + props.actor.innerArts
    .filter((art) => art.currentLevel > 0)
    .reduce((sum, art) => sum + Math.max(0, art.regulateBreathBonus ?? 0), 0);
  const breathConfigured = selectedGuideIds.length === 1
    && selectedRecoveryIds.length > 0
    && selectedRecoveryIds.length <= breathLimit;

  useEffect(() => {
    if (!inspectedMove) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInspectedMoveId(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [inspectedMove]);

  useEffect(() => {
    setInspectedMoveId(null);
  }, [props.state.phase, props.state.activeActorId]);

  function selectHandMove(move: Move, double = false) {
    props.setSelectedMoveId(move.id);
    props.setSelectedBasicAction(null);
    if (double && props.targets.length === 1) props.setSelectedTargetId(props.targets[0].id);
  }

  function shortDistance(move: Move) {
    return move.targetRange.match(/贴身|近身|短距|中距|远距/)?.[0] ?? "情景";
  }

  return (
    <section className={`combat-action-deck-panel hand-deck${selectedMove ? " has-selected-card" : ""}`} aria-label="招式手牌">
      {props.selectedBasicAction ? (
        <div className="basic-action-tray" role="dialog" aria-label={isBreathSelected ? "调息配置" : "返照确认"}>
          <button className="basic-action-tray__close" type="button" aria-label="返回手牌" onClick={() => props.setSelectedBasicAction(null)}>×</button>
          <header>
            <strong>{isBreathSelected ? "调息" : "返照"}</strong>
            <span>{isBreathSelected ? "消耗一次主行动 · 保留骰面" : "每轮一次 · 重投 · 保留正式出手"}</span>
          </header>
          {isBreathSelected ? (
            <div className="breath-config compact" aria-label="调息气骰配置">
              <div><small>息引 · 选1</small><div className="breath-dice-options">{guideCandidates.map((die) => (
                <button key={die.id} type="button" className={selectedGuideIds.includes(die.id) ? "is-selected" : ""} onClick={() => {
                  selectedGuideIds.filter((id) => id !== die.id).forEach(props.toggleDie);
                  if (!selectedGuideIds.includes(die.id)) props.toggleDie(die.id);
                }}>{die.nature === "yin" ? "阴" : die.nature === "yang" ? "阳" : "原"}{die.value}</button>
              ))}</div></div>
              <div><small>息库 · 最多{breathLimit}</small><div className="breath-dice-options">{recoveryCandidates.map((die) => (
                <button key={die.id} type="button" disabled={!selectedRecoveryIds.includes(die.id) && selectedRecoveryIds.length >= breathLimit} className={selectedRecoveryIds.includes(die.id) ? "is-selected" : ""} onClick={() => props.toggleDie(die.id)}>{die.nature === "yin" ? "阴" : die.nature === "yang" ? "阳" : "原"}{die.value}</button>
              ))}</div></div>
            </div>
          ) : <p>{fanzhaoAvail.usable ? "取回息库中最低阶本命骰，保持原点数。" : fanzhaoAvail.detailReasons.join("、")}</p>}
          <button className="seal-confirm" type="button" disabled={props.readOnly || (isBreathSelected ? !regulateBreathAvail.usable || !breathConfigured : !fanzhaoAvail.usable)} onClick={() => {
            if (isBreathSelected) props.executeBasicAction(props.actor.id, "regulateBreath", selectedGuideIds[0], selectedRecoveryIds);
            else props.executeBasicAction(props.actor.id, "fanzhao");
          }}>{isBreathSelected ? "确认调息" : "确认返照"}</button>
        </div>
      ) : null}

      <div className="hand-deck__label"><span>{props.actor.name}</span><strong>{selectedMove ? selectedMove.name : "招式手牌"}</strong><small>{selectedMove ? selectedMove.baseEffect : "单击选牌 · 双击推进 · 右键详情"}</small></div>
      <div className="action-card-grid" role="listbox" aria-label="可用招式">
        {props.actor.moves.map((move) => {
          const selected = props.selectedMoveId === move.id && !props.selectedBasicAction;
          const moveAvail = canDeclareAction(props.state, props.actor.id, move.id, {
            yinSlotDiceIds: props.slotDice.yin,
            yangSlotDiceIds: props.slotDice.yang,
          });
          const selectionReasons = moveAvail.reasons.filter((reason) => !reason.includes("阴槽") && !reason.includes("阳槽"));
          const canPrepare = selectionReasons.length === 0;
          return (
            <button
              className={`action-card hand-card category-${move.category}${move.hasIntercept ? " has-intercept" : ""}${move.hasReact ? " has-react" : ""}${selected ? " selected" : ""}${!canPrepare ? " disabled-card" : ""}`}
              type="button"
              key={move.id}
              role="option"
              aria-selected={selected}
              data-playable={canPrepare}
              data-tooltip={canPrepare ? `${move.timing} · ${move.targetRange}\n${move.baseEffect}\n右键查看完整规则` : selectionReasons.slice(0, 3).join("\n")}
              onClick={() => selectHandMove(move)}
              onDoubleClick={() => selectHandMove(move, true)}
              onContextMenu={(event) => { event.preventDefault(); setInspectedMoveId(move.id); }}
            >
              <span className="card-cost" aria-label={`最低投入${move.minDice}枚`}>{move.minDice}</span>
              {move.hasIntercept || move.hasReact ? <span className="card-response-marks" aria-label={`${move.hasIntercept ? "可截击" : ""}${move.hasIntercept && move.hasReact ? "、" : ""}${move.hasReact ? "可应招" : ""}`}>{move.hasIntercept ? <i className="intercept-mark">截</i> : null}{move.hasReact ? <i className="react-mark">应</i> : null}</span> : null}
              <span className="card-art" aria-hidden="true"><i>{move.category === "法门" ? "法" : move.category === "便行" ? "行" : "武"}</i></span>
              <span className="card-name">{move.name}</span><span className="card-type">{move.category} · {move.formPosition}</span>
              <span className="card-effect">{move.baseEffect}</span>
              <span className="card-reqs"><b>{shortDistance(move)}</b><b>{move.qiNatureThreshold}</b></span>
              {!canPrepare ? <span className="card-seal">{selectionReasons[0] ?? "不可用"}</span> : null}
            </button>
          );
        })}
        <button
          className={`action-card hand-card category-便行${!regulateBreathAvail.usable ? " disabled-card" : ""}`}
          type="button"
          disabled={props.readOnly}
          data-tooltip={regulateBreathAvail.usable ? `支付1枚息引\n取回最多${breathLimit}枚\n保持原点数` : regulateBreathAvail.detailReasons.slice(0, 3).join("\n")}
          onClick={() => props.setSelectedBasicAction("regulateBreath")}
        >
          <span className="card-cost">1</span><span className="card-art"><i>息</i></span><span className="card-name">调息</span><span className="card-type">特殊便行</span><span className="card-effect">息引换气，不重掷</span><span className="card-reqs"><b>自身</b><b>耗行动</b></span>
          {!regulateBreathAvail.usable ? <span className="card-seal">{regulateBreathAvail.reasonTags[0]}</span> : null}
        </button>
        <button
          className={`action-card hand-card category-便行${!fanzhaoAvail.usable ? " disabled-card" : ""}`}
          type="button"
          disabled={props.readOnly}
          data-tooltip={fanzhaoAvail.usable ? "断气时取回最低阶本命骰\n保持原点数" : fanzhaoAvail.detailReasons.slice(0, 3).join("\n")}
          onClick={() => props.setSelectedBasicAction("fanzhao")}
        >
          <span className="card-cost">1</span><span className="card-art"><i>照</i></span><span className="card-name">返照</span><span className="card-type">随手便行·特殊</span><span className="card-effect">最低本命骰重投入海</span><span className="card-reqs"><b>断气</b><b>保留出手</b></span>
          {!fanzhaoAvail.usable ? <span className="card-seal">{fanzhaoAvail.reasonTags[0]}</span> : null}
        </button>
      </div>

      {inspectedMove && (() => {
        const inspectedAvailability = canDeclareAction(props.state, props.actor.id, inspectedMove.id, {
          yinSlotDiceIds: props.slotDice.yin,
          yangSlotDiceIds: props.slotDice.yang,
        });
        const prepareReasons = inspectedAvailability.reasons.filter(
          (reason) => !reason.includes("阴槽") && !reason.includes("阳槽"),
        );
        const canChoose = prepareReasons.length === 0 && !props.readOnly;
        return (
          <div className="move-card-detail-layer" role="presentation" onMouseDown={(event) => {
            if (event.currentTarget === event.target) setInspectedMoveId(null);
          }}>
            <article className="move-card-detail" role="dialog" aria-modal="true" aria-labelledby="move-card-detail-title">
              <button className="move-card-detail__close" type="button" onClick={() => setInspectedMoveId(null)} aria-label="关闭招式详情">×</button>
              <header className="move-card-detail__header">
                <span className="move-card-detail__cost">{inspectedMove.minDice}</span>
                <div>
                  <p>{inspectedMove.tier} · {inspectedMove.category}</p>
                  <h2 id="move-card-detail-title">{inspectedMove.name}</h2>
                </div>
                <span className="move-card-detail__grade">{inspectedMove.designGrade}</span>
              </header>
              <div className="move-card-detail__ribbon">
                <span>{inspectedMove.timing}</span><span>{inspectedMove.formPosition}</span><span>{inspectedMove.yinYangLabel}</span>
              </div>
              <section className="move-card-detail__effect">
                <small>基础效果</small>
                <strong>{inspectedMove.baseEffect}</strong>
              </section>
              <dl className="move-card-detail__rules">
                <dt>对象 / 距离</dt><dd>{inspectedMove.targetRange}</dd>
                <dt>气性门槛</dt><dd>{inspectedMove.qiNatureThreshold} · 最低{inspectedMove.minDice}枚</dd>
                <dt>势条件</dt><dd>{inspectedMove.allowedShi.join("、") || "无明示门槛"}</dd>
                <dt>装备许可</dt><dd>{inspectedMove.equipPermission}</dd>
                <dt>成招后转势</dt><dd>{inspectedMove.postShi}</dd>
                <dt>资源去向</dt><dd>{inspectedMove.resourceDestination}</dd>
              </dl>
              <section className="move-card-detail__triggers">
                <small>槽值触发</small>
                {inspectedMove.triggers.length > 0
                  ? inspectedMove.triggers.map((trigger) => (
                    <p key={`${trigger.type}:${trigger.condition}`}><b>{trigger.condition}</b><span>{trigger.effect}</span></p>
                  ))
                  : <p><span>无额外槽值触发</span></p>}
              </section>
              <footer className="move-card-detail__footer">
                <p className={canChoose ? "is-ready" : "is-blocked"}>
                  {canChoose ? "条件已满足，可加入本次宣言。" : prepareReasons.join("、") || "当前身份不能选择招式。"}
                </p>
                <button className="primary-action" type="button" disabled={!canChoose} onClick={() => {
                  selectHandMove(inspectedMove);
                  setInspectedMoveId(null);
                }}>置为当前手牌</button>
              </footer>
            </article>
          </div>
        );
      })()}
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
  const pending = state.pendingAction;
  const pendingActor = pending ? state.actors.find((actor) => actor.id === pending.actorId) : undefined;
  const pendingMove = pendingActor?.moves.find((move) => move.id === pending?.moveId);
  const feedback = state.feedback?.[0];
  return (
    <div className={`combat-stage-stack${feedback?.kind === "damage" ? " has-impact" : ""}`}>
      <TacticalCombatStage
        data={stageData}
        state={state}
        selectedId={selectedId}
        selectedTargetId={selectedTargetId}
        targetableActorIds={targetableActorIds}
        onSelectCombatant={onSelect}
        selectedMove={selectedMove}
        targetLines={pending ? [{
          sourceActorId: pending.actorId,
          targetActorId: pending.targetId,
          move: pendingMove,
        }] : undefined}
      />
      {feedback ? (
        <div className={`combat-feedback feedback-${feedback.kind}`} key={feedback.id} role="status">
          <strong>{feedback.title}</strong>{feedback.detail ? <span>{feedback.detail}</span> : null}
        </div>
      ) : null}
    </div>
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
          {!equippable ? <button type="button" onClick={() => patch((current) => useInventoryItem(current, actorId, item.id))}>使用</button> : null}
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
        {actor.moves.map((move) => <article className="action-card" key={move.id}><strong>{move.name}</strong><span>{actor.name} · {move.category} · {move.timing}</span><small>{move.baseEffect}</small></article>)}
        {["调息", "返照", "出手便行", "随手便行", "取物", "争夺物", "使用物品"].map((move) => <article className="action-card" key={move}><strong>{move}</strong><span>{actor.name} · 基础/便行动作</span><small>按当前时点显示可用原因</small></article>)}
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
    const autoDmLocked = props.readOnly || props.session.playMode === "room";
    return (
      <div className="drawer-content drawer-settings">
        <label className="check-row support-setting-row">
          <input
            type="checkbox"
            checked={props.session.autoDmEnabled}
            disabled={autoDmLocked}
            title={props.session.playMode === "room" ? "真人房间由 DM 裁定；自动 DM 只向主持提供建议" : props.readOnly ? "当前身份只能查看" : undefined}
            onChange={(event) => props.setAutoDmEnabled(event.target.checked)}
          />
          <span><strong>{props.session.playMode === "room" ? "真人 DM 主持中" : "自动 DM"}</strong><small>{props.session.playMode === "room" ? "房间裁定由真人 DM 提交；自动建议不会越权改变权威状态。" : "处理敌方响应、敌方主行动、落果与轮末；玩家宣言和玩家响应始终由你决定。"}</small></span>
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
            ? { label: "推进至下一角色", run: advanceTurn }
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
  type LogFilter = "all" | "public" | "dm" | "scene" | "combat" | "resource";
  const [filter, setFilter] = useState<LogFilter>("all");
  const filters: Array<{ id: LogFilter; label: string }> = [
    { id: "all", label: "全部" },
    { id: "public", label: "公开" },
    { id: "dm", label: "DM" },
    { id: "scene", label: "情景" },
    { id: "combat", label: "交锋" },
    { id: "resource", label: "资源" },
  ];

  function categoriesFor(type: string, isPublic: boolean): Set<LogFilter> {
    const normalized = type.toUpperCase();
    const result = new Set<LogFilter>(["all"]);
    if (isPublic) result.add("public");
    if (!isPublic || normalized.startsWith("DM_") || normalized.includes("OVERRIDE")) result.add("dm");
    if (/SCENE|AUTO_DM|CRISIS|CLUE|INSIGHT|PERMISSION|RULING|REVEAL/.test(normalized)) result.add("scene");
    if (/ITEM|INVENTORY|EQUIP|RESOURCE|QI_|DICE|LOCK|RECOVER|CONSUME|REST/.test(normalized)) result.add("resource");
    if (!result.has("scene") || /COMBAT|DECLARE|INTERCEPT|REACT|OUTCOME|ROUND|DAMAGE|MOVE|ACTION/.test(normalized)) result.add("combat");
    return result;
  }

  function readableType(type: string) {
    const labels: Record<string, string> = {
      DM_RULING: "DM 裁定",
      DM_OVERRIDE: "DM 覆盖",
      SCENE_ACTION: "情景行动",
      SCENE_REVEAL: "线索公开",
      AUTO_DM: "自动 DM",
      ITEM_USED: "使用物品",
      ITEM_EQUIPPED: "装备变更",
      ITEM_UNEQUIPPED: "装备变更",
    };
    return labels[type] ?? type.replaceAll("_", " · ");
  }

  const entries = state.logs.filter((log) => categoriesFor(log.type, log.public).has(filter));
  return (
    <section className="panel log-panel">
      <div className="log-panel__heading"><h2>日志回放</h2><small>{entries.length}/{state.logs.length} 条</small></div>
      <div className="log-filter-tabs" role="tablist" aria-label="日志分类">
        {filters.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>
        ))}
      </div>
      <div className="log-list">
        {entries.map((log) => (
          <article key={log.id}>
            <span>{readableType(log.type)} · {log.public ? "公开" : "DM"}</span>
            <p>{log.message}</p>
            <small>第{log.round}轮 · {new Date(log.createdAt).toLocaleTimeString()}</small>
          </article>
        ))}
        {entries.length === 0 ? <p className="empty-state">当前分类暂无记录。</p> : null}
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
