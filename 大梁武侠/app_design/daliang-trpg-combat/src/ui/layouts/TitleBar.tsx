import type { FC } from "react";
import type { AppSession } from "../../combat/types";
import { identityLabel } from "../utils/labels";

export interface TitleBarProps {
  session: AppSession;
  debugView: boolean;
  setDebugView: (value: boolean) => void;
  onHome: () => void;
  onReset: () => void;
}

/**
 * Desktop window title bar (48px).
 * Layout: App name (35%) | Scene/Mode info (35%) | Identity + window controls (30%)
 */
export const TitleBar: FC<TitleBarProps> = ({
  session,
  debugView,
  setDebugView,
  onHome,
  onReset,
}) => {
  const identity = session.identity;
  const roomCode = session.roomCode || "本地";

  const sceneLabel =
    session.route === "playerCombat" || session.route === "dmCombat"
      ? "交锋中"
      : session.route === "playerScene" || session.route === "dmScene"
        ? "情景中"
        : "";

  return (
    <header className="title-bar">
      <div className="title-bar__left">
        <span className="app-name">大梁江湖 TRPG</span>
        <span className="room-code">{roomCode}</span>
      </div>

      <div className="title-bar__center">
        {sceneLabel && `${sceneLabel}`}
      </div>

      <div className="title-bar__right">
        <span className={`identity-badge ${identity === "dm" ? "dm" : "player"}`}>
          {identityLabel(identity)}
        </span>

        {identity === "dm" && session.developerMode && (
          <button
            className="window-btn"
            title={debugView ? "关闭调试视图" : "开发调试视图"}
            onClick={() => setDebugView(!debugView)}
            type="button"
          >
            🐛
          </button>
        )}

        <button className="window-btn" title="返回首页" onClick={onHome} type="button">
          ↩
        </button>

        <button className="window-btn" title="进度会自动保存在本机" aria-label="进度已自动保存" disabled type="button">
          💾
        </button>

        <button className="window-btn" title="清空本地存档" aria-label="清空本地存档" onClick={onReset} type="button">
          ⟲
        </button>
      </div>
    </header>
  );
};
