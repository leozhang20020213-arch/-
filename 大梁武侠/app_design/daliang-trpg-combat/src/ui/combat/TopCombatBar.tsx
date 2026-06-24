import { useMemo, type FC } from "react";
import type { AppSession, CombatState } from "../../combat/types";
import type { DrawerId } from "../layouts/MainToolbar";
import { identityLabel } from "../utils/labels";
import { deriveTurnState, type TurnOrderEntry } from "../../lib/combat/turnOrder";

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
}

const PLAYER_NAV: NavBtn[] = [
  { id: "character", label: "人物" },
  { id: "inventory", label: "背包" },
  { id: "moves", label: "招式" },
  { id: "statuses", label: "状态" },
  { id: "logs", label: "日志" },
  { id: "library", label: "资料" },
  { id: "settings", label: "设置" },
];

const DM_NAV: NavBtn[] = [
  { id: "character", label: "玩家" },
  { id: "dmEnemies", label: "敌人" },
  { id: "dmDistance", label: "距离" },
  { id: "dmRuling", label: "裁定" },
  { id: "dmLog", label: "日志" },
  { id: "library", label: "资料" },
  { id: "settings", label: "设置" },
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

  // Current actor name for the prominent badge
  const currentActorName = useMemo(() => {
    const actor = state.actors.find((a) => a.id === state.activeActorId);
    return actor?.name ?? null;
  }, [state.actors, state.activeActorId]);

  // Separator dots between turn chips (not after the last one)
  const turnEntries = turnState.order;

  return (
    <header className="combat-topbar" role="banner" aria-label="交锋顶栏">
      {/* Left: App name (compact) */}
      <div className="combat-topbar__left">
        <span className="app-name" title="大梁江湖 TRPG">大梁江湖</span>
      </div>

      {/* Center-left: Round + Phase + Current Actor */}
      <div className="combat-topbar__round-phase">
        <span className="round-badge">第{turnState.round}轮</span>
        <span className="phase-badge">{turnState.shortPhase}</span>
        {currentActorName && (
          <span className="current-actor-badge" title={`当前行动者：${currentActorName}`}>
            当前：{currentActorName}
          </span>
        )}
      </div>

      {/* Center: Turn order queue */}
      <div
        className="combat-topbar__queue"
        role="list"
        aria-label={`行动顺序：${turnEntries.map((e) => e.name).join(" → ")}`}
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
              onClick={() => setActiveDrawer(activeDrawer === btn.id ? null : btn.id)}
            >
              {btn.label}
            </button>
          ))}
        </nav>

        <span className="combat-topbar__divider" />

        <span className={`identity-badge ${isDM ? "dm" : "player"}`}>
          {identityLabel(session.identity)}
        </span>

        {session.developerMode && (
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

        <button className="combat-topbar__win-btn" title="重置" onClick={onReset} type="button">
          ⚙
        </button>
      </div>
    </header>
  );
};
