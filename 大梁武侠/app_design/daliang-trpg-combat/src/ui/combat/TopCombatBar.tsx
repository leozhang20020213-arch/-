import type { FC } from "react";
import type { AppSession, CombatState } from "../../combat/types";
import type { DrawerId } from "../layouts/MainToolbar";
import { identityLabel, phaseLabel } from "../utils/labels";

export interface TopCombatBarProps {
  session: AppSession;
  state: CombatState;
  activeDrawer: DrawerId | null;
  setActiveDrawer: (id: DrawerId | null) => void;
  debugView: boolean;
  setDebugView: (v: boolean) => void;
  onHome: () => void;
  onReset: () => void;
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

/**
 * Top combat bar (56px).
 * Merges TitleBar + MainToolbar + RoundStatusBar into one compact row.
 *
 * Layout: [Game Name] | [Round | Actor | Phase] | [Nav buttons | Identity | Save/Home]
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
}) => {
  const isDM = session.identity === "dm";
  const navItems = isDM ? DM_NAV : PLAYER_NAV;
  const activeActor = state.actors.find((a) => a.id === state.activeActorId);
  const roomCode = session.roomCode || "本地";

  return (
    <header className="combat-topbar">
      {/* Left: App name */}
      <div className="combat-topbar__left">
        <span className="app-name">大梁江湖 TRPG</span>
      </div>

      {/* Center: Round · Actor · Phase */}
      <div className="combat-topbar__center">
        <span className="round-badge">第{state.round}轮</span>
        <span className="arrow">→</span>
        <span className="actor-name">{activeActor?.name ?? "—"}</span>
        <span className="phase-badge">{phaseLabel(state.phase)}</span>
      </div>

      {/* Right: Nav + Identity + Window controls */}
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
