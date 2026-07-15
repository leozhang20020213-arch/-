import { useMemo, type FC } from "react";
import type { AppSession, CombatState } from "../../combat/types";
import type { DrawerId } from "../layouts/MainToolbar";
import { identityLabel } from "../utils/labels";
import { deriveTurnState, type TurnOrderEntry } from "../../lib/combat/turnOrder";
import { WindowControls } from "../components/WindowControls";
import { normalizeResponseBudget } from "../../domain/session/runtime";

export interface TopCombatBarProps {
  session: AppSession;
  state: CombatState;
  activeDrawer: DrawerId | null;
  setActiveDrawer: (id: DrawerId | null) => void;
  debugView: boolean;
  setDebugView: (v: boolean) => void;
  onHome: () => void;
  onReset: () => void;
  /** Set of actor IDs who have already acted this round */
  actedActorIds?: Set<string>;
}

interface NavBtn {
  id: DrawerId;
  label: string;
  icon: string;
}

const PLAYER_NAV: NavBtn[] = [
  { id: "character", label: "人物", icon: "侠" },
  { id: "inventory", label: "背包", icon: "囊" },
  { id: "moves", label: "招式", icon: "式" },
  { id: "statuses", label: "状态", icon: "态" },
  { id: "logs", label: "日志", icon: "录" },
  { id: "library", label: "资料", icon: "典" },
  { id: "settings", label: "设置", icon: "设" },
];

const DM_NAV: NavBtn[] = [
  { id: "character", label: "玩家", icon: "侠" },
  { id: "dmEnemies", label: "敌人", icon: "敌" },
  { id: "dmDistance", label: "距离", icon: "距" },
  { id: "dmHidden", label: "隐藏", icon: "隐" },
  { id: "dmRuling", label: "裁定", icon: "裁" },
  { id: "dmScene", label: "场景", icon: "景" },
  { id: "dmLog", label: "日志", icon: "录" },
  { id: "library", label: "资料", icon: "典" },
  { id: "settings", label: "设置", icon: "设" },
];

const MOMENTUM_CLASS: Record<string, string> = {
  "阴盛": "mom-yin",
  "阳盛": "mom-yang",
  "合势": "mom-he",
  "圆融": "mom-harmony",
  "崩势": "mom-collapse",
  "失势": "mom-lost",
};

/**
 * A single actor chip in the turn order queue.
 */
const TurnChip: FC<{ entry: TurnOrderEntry }> = ({ entry }) => {
  let chipClass = "turn-chip";
  if (entry.isCurrent) chipClass += " current";
  if (entry.hasActed) chipClass += " acted";
  if (entry.canRespond) chipClass += " can-respond";
  if (entry.isDying) chipClass += " dying";

  return (
    <span
      className={chipClass}
      title={`${entry.name} · 先后${entry.initiative} · 势${entry.momentum}${entry.hasActed ? " · 已行动" : ""}${entry.canRespond ? " · 可响应" : ""}${entry.isDying ? " · 濒死" : ""}`}
    >
      <span className="turn-chip-avatar">
        {entry.name.charAt(0)}
      </span>
      <span className="turn-chip-name">{entry.name}</span>
      <span className="turn-chip-init">{entry.initiative}</span>
      {entry.hasActed && <span className="turn-chip-check">✓</span>}
      {entry.canRespond && <span className="turn-chip-respond-dot" />}
    </span>
  );
};

/**
 * Top combat bar (56px).
 * Layout: [Game Name] | [Round + Phase] | [Turn Queue Chips] | [Nav] | [Identity + Controls]
 *
 * The turn queue is the centerpiece — it shows every actor in initiative order
 * with current/acted/responding status visible at a glance.
 */
export const TopCombatBar: FC<TopCombatBarProps> = ({
  session,
  state,
  activeDrawer,
  setActiveDrawer,
  debugView,
  setDebugView,
  onHome,
  onReset,
  actedActorIds,
}) => {
  const isDM = session.identity === "dm";
  const navItems = isDM ? DM_NAV : PLAYER_NAV;

  const turnState = useMemo(
    () => deriveTurnState(state, actedActorIds ?? new Set()),
    [state, actedActorIds],
  );

  // Scene desks must use the authored scene sequence, not the combat roster.
  // Free scenes intentionally have no queue. This prevents unrevealed enemies
  // from leaking into the top bar before the encounter begins.
  const sceneSequence = state.runtime.mode === "SCENE_STRUCTURED"
    ? state.runtime.scene.sequence
    : undefined;
  const isFreeScene = state.runtime.mode === "SCENE_FREE";
  const turnEntries = useMemo(() => {
    if (isFreeScene) return [];
    if (!sceneSequence) return turnState.order;
    const byId = new Map(turnState.order.map((entry) => [entry.actorId, entry]));
    return sceneSequence.initiativeOrder.flatMap((actorId) => {
      const entry = byId.get(actorId);
      if (!entry) return [];
      return [{
        ...entry,
        isCurrent: actorId === sceneSequence.activeActorId,
        hasActed: sceneSequence.actedActorIds.includes(actorId),
      }];
    });
  }, [isFreeScene, sceneSequence, turnState.order]);
  const roundLabel = isFreeScene
    ? "自由情景"
    : `第${sceneSequence?.round ?? turnState.round}轮`;
  const phaseLabel = isFreeScene
    ? "无固定轮次"
    : sceneSequence
      ? (sceneSequence.activeActorId
        ? `${state.actors.find((actor) => actor.id === sceneSequence.activeActorId)?.name ?? "当前人物"}行动`
        : "轮次结束")
      : turnState.shortPhase;
  const budgetActor = state.actors.find((actor) => actor.id === (session.selectedActorId ?? state.activeActorId));
  const responseBudget = budgetActor
    ? normalizeResponseBudget(budgetActor.responseBudget, budgetActor.responseQuotaUsed, budgetActor.maxResponseQuota)
    : undefined;

  return (
    <header className="combat-topbar" role="banner" aria-label="交锋顶栏">
      {/* Left: App name (compact) */}
      <div className="combat-topbar__left">
        <span className="app-name" title="大梁武侠">大梁武侠</span>
      </div>

      {/* Center-left: Round + phase. Current actor is the highlighted queue chip. */}
      <div className="combat-topbar__round-phase">
        <span className="scene-badge" title={state.sceneName}>{state.sceneName}</span>
        <span className="round-badge">{roundLabel}</span>
        <span className="phase-badge">{phaseLabel}</span>
      </div>

      {/* Center: Turn order queue */}
      <div
        className="combat-topbar__queue"
        role="list"
        aria-label={turnEntries.length > 0 ? `行动顺序：${turnEntries.map((e) => e.name).join(" → ")}` : "自由情景：无固定行动顺序"}
      >
        {turnEntries.map((entry, i) => (
          <span key={entry.actorId} className="turn-chip-wrapper" role="listitem">
            <TurnChip entry={entry} />
            {i < turnEntries.length - 1 && (
              <span className="turn-arrow" aria-hidden="true">→</span>
            )}
          </span>
        ))}
      </div>

      {/* Right: Nav + Identity + Controls */}
      <div className="combat-topbar__right">
        <nav className="combat-topbar__nav" aria-label="主导航">
          {navItems.map((btn) => (
            <button
              key={btn.id}
              className={`combat-topbar__nav-btn${activeDrawer === btn.id ? " active" : ""}`}
              type="button"
              aria-label={btn.label}
              title={btn.label}
              onClick={() => setActiveDrawer(activeDrawer === btn.id ? null : btn.id)}
            >
              <span className="combat-nav-icon" aria-hidden="true">{btn.icon}</span>
              <span className="combat-nav-label">{btn.label}</span>
            </button>
          ))}
        </nav>

        <span className="combat-topbar__divider" />

        <span className={`identity-badge ${isDM ? "dm" : "player"}`}>
          {identityLabel(session.identity)}
        </span>
        {responseBudget ? <span className="response-budget-badge" title="主动响应 / 自保应招额度">响 {responseBudget.proactiveUsed}/{responseBudget.maxProactive} · 守 {responseBudget.selfDefenseUsed}/{responseBudget.maxSelfDefense}</span> : null}
        {session.autoDmEnabled ? <span className="auto-dm-badge" title="本地规则主持已启用">规则主持</span> : null}

        {isDM && session.developerMode && (
          <button
            className="combat-topbar__win-btn"
            title={debugView ? "关闭调试视图" : "开发调试视图"}
            onClick={() => setDebugView(!debugView)}
            type="button"
          >
            🐛
          </button>
        )}

        <button className="combat-topbar__win-btn" title="返回首页" onClick={onHome} type="button">
          ↩
        </button>

        <WindowControls />
      </div>
    </header>
  );
};
