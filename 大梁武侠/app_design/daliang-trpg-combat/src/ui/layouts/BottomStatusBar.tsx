import type { FC } from "react";

export interface BottomStatusBarProps {
  connectionStatus?: string;
  lastSaved?: string;
}

/**
 * Optional bottom status bar (28px).
 * Shows connection status, save indicator, clock.
 * Can be merged into toolbar if space is tight.
 */
export const BottomStatusBar: FC<BottomStatusBarProps> = ({
  connectionStatus,
  lastSaved,
}) => {
  return (
    <div className="bottom-bar">
      <span>{connectionStatus ?? "本地模式"}</span>
      <span>{lastSaved ? `上次保存：${lastSaved}` : "未保存"}</span>
    </div>
  );
};
