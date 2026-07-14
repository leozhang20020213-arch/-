import { useEffect, useState } from "react";

export function WindowControls() {
  const [state, setState] = useState<DesktopWindowState>({ maximized: false, fullScreen: false });
  const desktop = window.daliangDesktop;

  useEffect(() => {
    if (!desktop) return undefined;
    void desktop.getWindowState().then(setState);
    return desktop.onWindowState(setState);
  }, [desktop]);

  function toggleFullScreen() {
    if (desktop) {
      desktop.toggleFullScreen();
      return;
    }
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }

  return (
    <div className="window-controls" aria-label="窗口控制">
      <button type="button" className="window-control" title="全屏 (F11)" aria-label="切换全屏" onClick={toggleFullScreen}>
        {state.fullScreen ? "▣" : "⛶"}
      </button>
      {desktop ? (
        <>
          <button type="button" className="window-control" title="最小化" aria-label="最小化窗口" onClick={desktop.minimize}>—</button>
          <button type="button" className="window-control" title={state.maximized ? "还原" : "最大化"} aria-label={state.maximized ? "还原窗口" : "最大化窗口"} onClick={desktop.toggleMaximize}>
            {state.maximized ? "❐" : "□"}
          </button>
          <button type="button" className="window-control window-control--close" title="关闭" aria-label="关闭应用" onClick={desktop.close}>×</button>
        </>
      ) : null}
    </div>
  );
}
