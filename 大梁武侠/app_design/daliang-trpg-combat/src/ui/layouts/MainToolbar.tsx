import type { FC } from "react";
import type { AppSession } from "../../combat/types";

export type DrawerId =
  | "character" | "sixRoots" | "innerArt" | "inventory" | "moves"
  | "statuses" | "logs" | "library" | "settings"
  | "dmEnemies" | "dmDistance" | "dmRuling" | "dmHidden" | "dmScene" | "dmLog";

export interface MainToolbarProps {
  session: AppSession;
  activeDrawer: DrawerId | null;
  setActiveDrawer: (id: DrawerId | null) => void;
  className?: string;
}

interface ToolbarBtn {
  id: DrawerId;
  label: string;
  icon: string;
}

const PLAYER_BTNS: ToolbarBtn[] = [
  { id: "character", label: "人物", icon: "👤" },
  { id: "sixRoots", label: "六根", icon: "🔮" },
  { id: "innerArt", label: "内功", icon: "☯" },
  { id: "inventory", label: "背包", icon: "🎒" },
  { id: "moves", label: "招式", icon: "⚔" },
  { id: "statuses", label: "状态", icon: "🏷" },
  { id: "logs", label: "日志", icon: "📜" },
  { id: "library", label: "资料", icon: "📖" },
  { id: "settings", label: "设置", icon: "⚙" },
];

const DM_BTNS: ToolbarBtn[] = [
  { id: "dmScene", label: "场景", icon: "🗺" },
  { id: "character", label: "玩家", icon: "👥" },
  { id: "dmEnemies", label: "敌人", icon: "👹" },
  { id: "dmDistance", label: "距离", icon: "📏" },
  { id: "dmHidden", label: "隐藏", icon: "👁" },
  { id: "dmRuling", label: "裁定", icon: "⚖" },
  { id: "dmLog", label: "日志", icon: "📜" },
  { id: "library", label: "资料", icon: "📖" },
  { id: "settings", label: "设置", icon: "⚙" },
];

/**
 * Game HUD-style main toolbar (56px).
 * Player toolbar: 人物 六根 内功 背包 招式 状态 日志 资料 设置
 * DM toolbar: 场景 玩家 敌人 距离 隐藏 裁定 日志 资料 设置
 *
 * Each button opens a right-side drawer. Only one drawer at a time.
 */
export const MainToolbar: FC<MainToolbarProps> = ({
  session,
  activeDrawer,
  setActiveDrawer,
  className = "",
}) => {
  const isDM = session.identity === "dm";
  const buttons = isDM ? DM_BTNS : PLAYER_BTNS;

  return (
    <nav className={`main-toolbar ${className}`} role="toolbar" aria-label="游戏工具栏">
      {buttons.map((btn) => {
        const isActive = activeDrawer === btn.id;
        return (
          <button
            key={btn.id}
            className={`main-toolbar__btn${isActive ? " active" : ""}`}
            type="button"
            onClick={() => setActiveDrawer(isActive ? null : btn.id)}
            title={btn.label}
          >
            <span className="btn-icon" aria-hidden="true">{btn.icon}</span>
            <span>{btn.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
