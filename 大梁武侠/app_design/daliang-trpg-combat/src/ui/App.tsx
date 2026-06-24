import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyOutcome,
  canDeclareAction,
  changeMomentum,
  commitDiceRollResults,
  declareAction,
  dmOverride,
  endRound,
  enterScene,
  equipItem,
  expireSource,
  formMove,
  regulateBreath,
  resolveInterceptSuccess,
  resolveReact,
  unequipItem,
  useInventoryItem,
  useReflection,
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
import type { Actor, AppSession, CombatState, InventoryCategory, InventoryItem, QiDie, QiZone } from "../combat/types";
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
import { DmControlPanel } from "./combat/dm/DmControlPanel";
import { PlayerPromptBar } from "./combat/player/PlayerPromptBar";
import { DebugPanel } from "./debug/DebugPanel";

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

export function App() {
  const [state, setState] = useState<CombatState>(() => loadCombatState());
  const [session, setSession] = useState<AppSession>(() => loadAppSession());
  const [selectedTargetId, setSelectedTargetId] = useState("enemy-short-blade");
  const [selectedMoveId, setSelectedMoveId] = useState("move-rain-step-cut");
  const [selectedDice, setSelectedDice] = useState<string[]>([]);
  const [slotDice, setSlotDice] = useState<{ yin: string[]; yang: string[] }>({ yin: [], yang: [] });
  const [slotHint, setSlotHint] = useState("");
  const [dmNote, setDmNote] = useState("雨势加重，巡检火把已经到桥头。");
  const [debugView, setDebugView] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<DrawerId | null>(null);
  const [lanUrl, setLanUrl] = useState("ws://localhost:8787");
  const [lanStatus, setLanStatus] = useState<LanConnectionStatus>("idle");
  const [lanDetail, setLanDetail] = useState("");
  const [rollDice, setRollDice] = useState<QiDie[] | null>(null);
  const [prompt, setPrompt] = useState<{ title: string; message: string } | null>(null);
  const [selectedCombatantId, setSelectedCombatantId] = useState<string | undefined>();
  const [actedActorIds, setActedActorIds] = useState<Set<string>>(new Set());
  const lanClientRef = useRef<LanClient | null>(null);

  const playerActorId = session.selectedActorId ?? "pc-shen-qing";
  const playerState = useMemo(() => visibleForPlayer(state, playerActorId), [state, playerActorId]);
  const currentActor = state.actors.find((actor) => actor.id === playerActorId) ?? state.actors[0];

  useEffect(() => saveCombatState(state), [state]);
  useEffect(() => saveAppSession(session), [session]);

  useEffect(() => {
    if (!currentActor.moves.some((move) => move.id === selectedMoveId)) {
      setSelectedMoveId(currentActor.moves[0]?.id ?? "");
    }
  }, [currentActor, selectedMoveId]);

  function patch(updater: (current: CombatState) => CombatState) {
    setState((current) => updater(current));
    setSelectedDice([]);
    setSlotDice({ yin: [], yang: [] });
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
    const route = identity === "dm" ? "dmScene" : "playerScene";
    go(route, { identity, gameMode: "scene" });
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
    if (session.identity === "player" && die?.ownerId !== playerActorId) {
      patch((current) => dmOverride(current, "玩家不能操作非本人气骰。"));
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
    if (session.identity === "player" && die.ownerId !== playerActorId) {
      setSlotHint("玩家只能操作自己的气骰");
      setPrompt({ title: "权限不足", message: "玩家只能操作自己的气骰。" });
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

  function commitRollResults(results: DiceRollResult[]) {
    patch((current) => commitDiceRollResults(current, results));
  }

  function pickFirstSeaDie(ownerId: string) {
    return state.dice.find((die) => die.ownerId === ownerId && die.zone === "QI_SEA")?.id;
  }

  function declareFor(actorId: string, targetId: string, moveId: string) {
    if (session.identity === "player" && actorId !== playerActorId) {
      patch((current) => dmOverride(current, "玩家只能宣言自己的角色。"));
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
      patch((current) => dmOverride(current, `宣言不可用：${availability.reasons.join("、")}`));
      return;
    }
    if (diceToUse.length === 0) {
      setPrompt({ title: "需要气骰", message: "需要先选择或拖入至少一枚可用气骰。" });
      patch((current) => dmOverride(current, "需要先选择至少一枚可用气骰。"));
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
    const response = responder?.responses.find((item) => item.responseType === "截击");
    const dieId = responder ? pickFirstSeaDie(responder.id) : undefined;
    if (!responder || !response || !dieId) {
      patch((current) => dmOverride(current, "当前没有可用截击挂载或气骰。"));
      return;
    }
    patch((current) => resolveInterceptSuccess(current, responder.id, response.id, [dieId]));
  }

  function reactPending() {
    const pending = state.pendingAction;
    if (!pending) return;
    const responder = state.actors.find((actor) => actor.id === pending.targetId);
    const response = responder?.responses.find((item) => item.responseType === "应招");
    const dieId = responder ? pickFirstSeaDie(responder.id) : undefined;
    if (!responder || !response || !dieId) {
      patch((current) => dmOverride(current, "当前没有可用应招挂载或气骰。"));
      return;
    }
    patch((current) => resolveReact(current, responder.id, response.id, [dieId]));
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
    removeDieFromSlot,
    commitRollResults,
    setRollDice,
    declareFor,
    patch,
    go,
    resetAll,
    selectedCombatantId,
    setSelectedCombatantId,
    setPrompt,
    actedActorIds,
  };

  const isDeskRoute =
    session.route === "playerScene" || session.route === "playerCombat" || session.route === "player" ||
    session.route === "dmScene" || session.route === "dmCombat" || session.route === "dm";

  const isDM = session.identity === "dm";

  // ---- Combat routes: each desk renders its own CombatShell ----
  if (isDeskRoute) {
    const displayState = debugView && session.developerMode ? state : playerState;
    return (
      <>
        {session.route === "playerScene" ? (
          <PlayerSceneDesk
            {...common}
            state={displayState}
            rawState={state}
            actorId={playerActorId}
            onEnterCombat={() => go("playerCombat", { gameMode: "combat" })}
            onStartScene={() => patch((current) => enterScene(current))}
          />
        ) : null}
        {(session.route === "playerCombat" || session.route === "player") ? (
          <PlayerCombatDesk
            {...common}
            state={displayState}
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
            onEnterCombat={() => go("dmCombat", { gameMode: "combat" })}
            onOverride={() => patch((current) => dmOverride(current, dmNote, true))}
          />
        ) : null}
        {(session.route === "dmCombat" || session.route === "dm") ? (
          <DmCombatDesk
            {...common}
            dmNote={dmNote}
            setDmNote={setDmNote}
            onStartScene={() => patch((current) => enterScene(current))}
            onIntercept={interceptPending}
            onForm={() => patch((current) => formMove(current))}
            onReact={reactPending}
            onOutcome={() => patch((current) => applyOutcome(current))}
            onEndRound={() => patch((current) => endRound(current))}
            onMomentum={(actorId, momentum) => patch((current) => changeMomentum(current, actorId, momentum))}
            onRegulateBreath={() => regulateFirstRestDie(patch, state, playerActorId)}
            onReflection={() => patch((current) => useReflection(current, playerActorId))}
            onExpireSource={() => patch((current) => expireSource(current, "短兵客·雨步"))}
            onOverride={() => patch((current) => dmOverride(current, dmNote, true))}
          />
        ) : null}
        {rollDice ? (
          <QiDiceRollOverlay
            dice={rollDice}
            onClose={() => setRollDice(null)}
            onConfirm={(results: DiceRollResult[]) => {
              patch((current) => commitDiceRollResults(current, results));
              setRollDice(null);
            }}
          />
        ) : null}
        {prompt ? <PromptModal title={prompt.title} message={prompt.message} onClose={() => setPrompt(null)} /> : null}
        <DebugPanel state={state} session={session} debugView={debugView} setDebugView={setDebugView} />
      </>
    );
  }

  // ---- Non-combat routes: keep original app-shell ----
  return (
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
        {session.route === "library" || session.route === "packs" || session.route === "settings" ? (
          <PlaceholderPage session={session} go={go} />
        ) : null}
      </div>
    </div>
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
        {session.developerMode ? (
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
            开始游戏
          </button>
          <button type="button" onClick={() => go(session.identity === "dm" ? "dmScene" : session.identity ? "playerScene" : "roomWaiting")}>
            继续上次
          </button>
          <button type="button" onClick={() => go("createRoom", { identity: undefined })}>
            创建房间
          </button>
          <button type="button" onClick={() => go("joinRoom", { identity: "player" })}>
            加入房间
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
    setSession((current) => ({ ...current, room: { ...current.room, [key]: value } }));
  }

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
        <button className="primary-action" type="button" onClick={() => go("roomWaiting", { identity: "dm" })}>
          以 DM 身份开房
        </button>
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
          <button type="button" onClick={startLanRoom}>开启局域网房间</button>
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
          <button className="primary-action" type="button" onClick={() => enterAs("player")}>以玩家身份进入</button>
          <button type="button" onClick={() => enterAs("spectator")} disabled={!session.room.allowSpectators}>旁观</button>
        </div>
        <div className="lan-box">
          <h3>局域网加入</h3>
          <label>
            房主 WebSocket 地址
            <input value={lanUrl} onChange={(event) => setLanUrl(event.target.value)} />
          </label>
          <p>连接状态：{lanStatus}{lanDetail ? ` · ${lanDetail}` : ""}</p>
          <button type="button" onClick={joinLanRoom}>连接局域网房间</button>
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
          <input checked={session.room.allowSpectators} type="checkbox" onChange={(event) => setSession((current) => ({ ...current, room: { ...current.room, allowSpectators: event.target.checked } }))} />
          允许旁观
        </label>
        <div className="split-actions">
          <button type="button" onClick={() => go("home")}>返回首页</button>
          <button type="button" onClick={() => go("characterAssign")}>角色分配</button>
          <button className="primary-action" type="button" onClick={() => go("dmScene", { identity: "dm", gameMode: "scene" })}>开始情景</button>
          <button type="button" onClick={() => go("dmCombat", { identity: "dm", gameMode: "combat" })}>直接进入交锋</button>
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
  return (
    <section className="room-grid">
      <div className="panel">
        <h2>角色分配</h2>
        <label>
          玩家角色
          <select value={session.selectedActorId} onChange={(event) => setSession((current) => ({ ...current, selectedActorId: event.target.value }))}>
            {state.actors.filter((actor) => actor.side === "player").map((actor) => <option key={actor.id} value={actor.id}>{actor.name}</option>)}
          </select>
        </label>
        <p className="hint">未分配角色不能进入玩家桌面。当前样例默认分配沈青。</p>
      </div>
      <div className="panel">
        <h2>进入桌面</h2>
        <div className="split-actions">
          <button type="button" onClick={() => go("roomWaiting")}>返回房间</button>
          <button className="primary-action" type="button" onClick={() => enterAs("player")} disabled={!session.selectedActorId}>以玩家身份进入</button>
          <button type="button" onClick={() => enterAs("dm")}>以 DM 身份进入</button>
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
              <button type="button" onClick={props.onStartScene}>开始/刷新当前场景</button>
              <button className="primary-action" type="button" onClick={props.onEnterCombat}>进入交锋</button>
            </div>
          }
        />
      }
      bottom={
        <>
          <PlayerPromptBar state={props.state} />
          <PhaseActionBar state={props.state} isDM={false} />
        </>
      }
      drawer={props.activeDrawer ? <DrawerLayer {...props} actor={actor} role="player" /> : null}
    />
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
  const enemies = props.state.actors.filter((item) => item.side !== "player");
  const selectedEnemy = props.selectedCombatantId
    ? enemies.find((e) => e.id === props.selectedCombatantId)
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
      left={<LeftCombatPanel actor={actor} state={props.state} />}
      center={
        <CenterCombatPanel
          stage={<CombatStage state={props.state} selectedId={props.selectedCombatantId} onSelect={props.setSelectedCombatantId} />}
          qiZone={
            <QiDiceDock
              state={props.state}
              actorDice={props.state.dice.filter((die) => die.ownerId === actor.id)}
              selectedMove={actor.moves.find((m) => m.id === props.selectedMoveId)}
              hasSelectedTarget={Boolean(props.selectedTargetId)}
              onRollToSea={() => props.patch((current) => enterScene(current))}
              onConfirm={(yinIds, yangIds) => {
                const move = actor.moves.find((m) => m.id === props.selectedMoveId);
                if (!move || !props.selectedTargetId) return;
                const diceToUse = [...yinIds, ...yangIds];
                if (diceToUse.length === 0) {
                  props.setPrompt({ title: "需要气骰", message: "至少需要投入一枚气骰。" });
                  return;
                }
                const availability = canDeclareAction(props.state, actor.id, move.id, {
                  yinSlotDiceIds: yinIds,
                  yangSlotDiceIds: yangIds,
                });
                if (!availability.allowed) {
                  props.setPrompt({ title: "宣言不可用", message: availability.reasons.join("、") });
                  return;
                }
                props.patch((current) =>
                  declareAction(current, actor.id, props.selectedTargetId, move.id, diceToUse, {
                    yinSlotDiceIds: yinIds,
                    yangSlotDiceIds: yangIds,
                  }),
                );
              }}
            />
          }
        />
      }
      right={
        <RightCombatPanel
          actions={<ActionPanel {...props} actor={actor} enemies={enemies} />}
          enemies={
            selectedEnemy ? (
              <EnemyPublicDrawer
                actor={selectedEnemy}
                mode="player"
                onClose={() => props.setSelectedCombatantId(undefined)}
              />
            ) : (
              <EnemyRoster actors={enemies} mode="public" />
            )
          }
          flowButtons={
            <PlayerFlowPanel
              onStartScene={props.onStartScene}
              onForm={props.onForm}
              onReact={props.onReact}
              onOutcome={props.onOutcome}
              hasPending={Boolean(props.rawState.pendingAction)}
            />
          }
        />
      }
      bottom={
        <>
          <PlayerPromptBar state={props.state} />
          <PhaseActionBar
            state={props.state}
            isDM={false}
            onStartScene={props.onStartScene}
            onEnterDeclaration={props.onStartScene}
            onResolveResult={props.onOutcome}
          />
        </>
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
  onForm: () => void;
  onReact: () => void;
  onOutcome: () => void;
  onEndRound: () => void;
  onMomentum: (actorId: string, momentum: Actor["momentum"]) => void;
  onRegulateBreath: () => void;
  onReflection: () => void;
  onExpireSource: () => void;
  onOverride: () => void;
}) {
  const players = props.state.actors.filter((actor) => actor.side === "player");
  const enemies = props.state.actors.filter((actor) => actor.side !== "player");
  const selectedEnemy = props.selectedCombatantId
    ? enemies.find((e) => e.id === props.selectedCombatantId)
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
      left={<LeftCombatPanel actor={players[0] ?? props.state.actors[0]} state={props.state} isDM />}
      center={
        <CenterCombatPanel
          stage={<CombatStage state={props.state} selectedId={props.selectedCombatantId} onSelect={props.setSelectedCombatantId} />}
          qiZone={
            (() => {
              const dmActorId = props.session.selectedActorId ?? props.state.activeActorId;
              const dmActor = props.state.actors.find((a) => a.id === dmActorId) ?? props.state.actors[0];
              return (
                <QiDiceDock
                  state={props.state}
                  actorDice={props.state.dice.filter((die) => die.ownerId === dmActorId)}
                  selectedMove={dmActor?.moves.find((m) => m.id === props.selectedMoveId)}
                  hasSelectedTarget={Boolean(props.selectedTargetId)}
                  onRollToSea={() => props.patch((current) => enterScene(current))}
                  onConfirm={(yinIds, yangIds) => {
                    const move = dmActor?.moves.find((m) => m.id === props.selectedMoveId);
                    if (!move || !props.selectedTargetId) return;
                    const diceToUse = [...yinIds, ...yangIds];
                    if (diceToUse.length === 0) {
                      props.setPrompt({ title: "需要气骰", message: "至少需要投入一枚气骰。" });
                      return;
                    }
                    props.patch((current) =>
                      declareAction(current, dmActorId, props.selectedTargetId, move.id, diceToUse, {
                        yinSlotDiceIds: yinIds,
                        yangSlotDiceIds: yangIds,
                      }),
                    );
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
            <DmControlPanel
              state={props.state}
              dmNote={props.dmNote}
              setDmNote={props.setDmNote}
              onStartScene={props.onStartScene}
              onIntercept={props.onIntercept}
              onForm={props.onForm}
              onReact={props.onReact}
              onOutcome={props.onOutcome}
              onEndRound={props.onEndRound}
              onRegulateBreath={props.onRegulateBreath}
              onReflection={props.onReflection}
              onExpireSource={props.onExpireSource}
              onMomentum={props.onMomentum}
              onOverride={props.onOverride}
            />
          }
          enemies={
            selectedEnemy ? (
              <EnemyPublicDrawer
                actor={selectedEnemy}
                mode="dm"
                onClose={() => props.setSelectedCombatantId(undefined)}
              />
            ) : (
              <BroadcastPreview state={props.state} />
            )
          }
          flowButtons={
            <section className="panel">
              <h2>敌人库</h2>
              <div className="actor-list">
                {enemies.map((enemy) => <UnitCard actor={enemy} mode="enemyDm" key={enemy.id} />)}
              </div>
            </section>
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
          onSkipResponse={props.onForm}
          onResolveResult={props.onOutcome}
          onNextRound={props.onEndRound}
          onApplyMomentum={() => {
            const active = props.state.actors.find((a) => a.id === props.state.activeActorId);
            if (active) props.onMomentum(active.id, active.momentum);
          }}
        />
      }
      drawer={props.activeDrawer ? <DrawerLayer {...props} actor={players[0] ?? props.state.actors[0]} role="dm" /> : null}
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
  setRollDice: (dice: QiDie[]) => void;
  commitRollResults: (results: DiceRollResult[]) => void;
  toggleDie: (id: string) => void;
  assignDieToSlot: (id: string, slot: "yin" | "yang") => boolean;
  removeDieFromSlot: (id: string) => void;
  declareFor: (actorId: string, targetId: string, moveId: string) => void;
  patch: (updater: (current: CombatState) => CombatState) => void;
  go: (route: AppSession["route"], patchSession?: Partial<AppSession>) => void;
  resetAll: () => void;
  selectedCombatantId: string | undefined;
  setSelectedCombatantId: (id: string | undefined) => void;
  setPrompt: (p: { title: string; message: string } | null) => void;
  actedActorIds: Set<string>;
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

function ActionPanel(props: DeskProps & { actor: Actor; enemies: Actor[] }) {
  const actorDice = props.state.dice.filter((die) => die.ownerId === props.actor.id && (die.zone === "QI_SEA" || die.zone === "TEMP_QI"));
  const selectedMove = props.actor.moves.find((move) => move.id === props.selectedMoveId) ?? props.actor.moves[0];
  const availability = selectedMove
    ? canDeclareAction(props.state, props.actor.id, selectedMove.id, {
        yinSlotDiceIds: props.slotDice.yin,
        yangSlotDiceIds: props.slotDice.yang,
      })
    : { allowed: false, reasons: ["未选择行动"] };

  return (
    <section className="panel">
      <div className="panel-title">
        <img src={iconMap.response} alt="" />
        <h2>招式与宣言</h2>
      </div>
      <div className="form-grid">
        <label>
          目标
          <select value={props.selectedTargetId} onChange={(event) => props.setSelectedTargetId(event.target.value)}>
            {props.enemies.map((enemy) => (
              <option key={enemy.id} value={enemy.id}>{enemy.name}</option>
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
      <div className="action-card-grid">
        {props.actor.moves.map((move) => {
          const selected = props.selectedMoveId === move.id;
          const moveAvailability = canDeclareAction(props.state, props.actor.id, move.id, {
            yinSlotDiceIds: props.slotDice.yin,
            yangSlotDiceIds: props.slotDice.yang,
          });
          const disabledReason = moveAvailability.reasons.join("、");
          return (
            <button
              className={`action-card ${selected ? "selected" : ""} ${disabledReason ? "warn" : ""}`}
              type="button"
              key={move.id}
              onClick={() => props.setSelectedMoveId(move.id)}
            >
              <strong>{move.name}</strong>
              <span>{move.timing === "正式出手" ? "招式卡 · 至少一阴一阳" : `${move.category} · ${move.timing}`}</span>
              <small>{disabledReason || "可选择"}</small>
            </button>
          );
        })}
        <button className="action-card" type="button" onClick={() => props.patch((current) => dmOverride(current, "玩家选择基础动作：调息。"))}>
          <strong>调息</strong>
          <span>基础动作卡</span>
          <small>按规则从息库回气海</small>
        </button>
        <button className="action-card" type="button" onClick={() => props.patch((current) => dmOverride(current, "玩家选择基础动作：返照。"))}>
          <strong>返照</strong>
          <span>基础动作卡</span>
          <small>气海为空时可用</small>
        </button>
      </div>
      <p className="hint">{selectedMove?.baseEffect}</p>
      <div className="mini-dice-list">
        {actorDice.map((die) => (
          <button className={props.selectedDice.includes(die.id) ? "die selected" : "die"} type="button" key={die.id} onClick={() => props.toggleDie(die.id)}>
            {dieLabel(die)}
          </button>
        ))}
      </div>
      {actorDice.length === 0 ? <p className="empty-state">气海/临气区没有可用气骰。先开始场景或调息。</p> : null}
      <button className="primary-action" type="button" disabled={!availability.allowed} onClick={() => props.declareFor(props.actor.id, props.selectedTargetId, props.selectedMoveId)}>
        确认宣言并锁气
      </button>
      {!availability.allowed ? <p className="hint">不可宣言：{availability.reasons.join("、")}</p> : null}
    </section>
  );
}

function CombatStage({ state, selectedId, onSelect }: {
  state: CombatState;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const stageData = buildStageData(state);
  return (
    <TacticalCombatStage
      data={stageData}
      selectedId={selectedId}
      onSelectCombatant={onSelect}
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

function PromptModal({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <section className="panel prompt-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="panel-title">
          <h2>{title}</h2>
          <button className="icon-button close-button" type="button" onClick={onClose} aria-label="关闭提示">×</button>
        </div>
        <p>{message}</p>
        <button className="primary-action" type="button" onClick={onClose}>明白</button>
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
        <button className="icon-button close-button" type="button" onClick={() => props.setActiveDrawer(null)} aria-label="关闭抽屉">×</button>
      </div>
      <DrawerContent {...props} />
    </aside>
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

  if (drawer === "library" || drawer === "settings") {
    return <p className="empty-state">{drawer === "library" ? "资料库抽屉占位：规则词条、招式、内功、状态、装备、世界观。" : "设置抽屉占位：窗口、本地保存、开发模式等。"}</p>;
  }

  if (drawer === "dmEnemies" && props.role === "dm") {
    return <EnemyRoster actors={enemies} mode="dm" />;
  }

  if (drawer === "dmDistance" && props.role === "dm") {
    return (
      <div className="drawer-content">
        <DistanceLines state={props.state} />
        <div className="flow-buttons">
          {["贴身", "近身", "短距", "中距", "远距", "离场", "纠缠", "解纠缠"].map((item) => <button type="button" key={item} onClick={() => props.patch((current) => dmOverride(current, `距离调整预览：${item}`))}>{item}</button>)}
        </div>
      </div>
    );
  }

  if (drawer === "dmRuling" && props.role === "dm") {
    return (
      <div className="drawer-content">
        <p>当前时点：{phaseLabel(props.state.phase)}</p>
        <p>当前行动：{props.state.pendingAction ? "有待结算宣言" : "暂无待结算宣言"}</p>
        <div className="flow-buttons">
          {["成招", "失败", "修改效阶", "修改伤害", "添加状态", "修改势", "修改距离"].map((item) => (
            <button type="button" key={item} onClick={() => props.patch((current) => dmOverride(current, `DM裁定抽屉：${item}`))}>{item}</button>
          ))}
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

function PlayerFlowPanel({
  onStartScene,
  onForm,
  onReact,
  onOutcome,
  hasPending,
}: {
  onStartScene: () => void;
  onForm: () => void;
  onReact: () => void;
  onOutcome: () => void;
  hasPending: boolean;
}) {
  return (
    <section className="panel">
      <h2>玩家阶段操作</h2>
      <div className="flow-buttons">
        <button type="button" onClick={onStartScene}>开始场景</button>
        <button type="button" onClick={onForm} disabled={!hasPending}>确认成招</button>
        <button type="button" onClick={onReact} disabled={!hasPending}>应招</button>
        <button type="button" onClick={onOutcome} disabled={!hasPending}>查看落果</button>
      </div>
    </section>
  );
}

function BroadcastPreview({ state }: { state: CombatState }) {
  return (
    <section className="panel">
      <h2>广播结算预览</h2>
      <p>{state.logs.find((log) => log.public)?.message ?? "暂无公开结算。"}</p>
      <p className="hint">DM 可在裁定面板修改落果、势变化、退场和公开信息；每次裁定写入日志。</p>
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

function PlaceholderPage({ session, go }: { session: AppSession; go: (route: AppSession["route"]) => void }) {
  const title = session.route === "packs" ? "团包管理" : session.route === "library" ? "资料库" : "设置";
  return (
    <section className="home-screen">
      <div className="panel home-hero">
        <h2>{title}</h2>
        <p>本轮先建立入口和页面层级；后续再接 xlsx 导入、规则资料检索和正式设置项。</p>
        <button type="button" onClick={() => go("home")}>返回首页</button>
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
    patch((current) => dmOverride(current, "息库没有可调息气骰。"));
    return;
  }
  patch((current) => regulateBreath(current, actorId, [die.id]));
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
