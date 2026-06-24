import { useState, type FC } from "react";
import type { CombatState, AppSession } from "../../combat/types";

export interface DebugPanelProps {
  state: CombatState;
  session: AppSession;
  debugView: boolean;
  setDebugView: (v: boolean) => void;
}

/**
 * Development debug panel — only shown when:
 *   - `import.meta.env.DEV` is true, OR
 *   - `debugView` is manually enabled
 *
 * Hidden entirely in production builds unless manually toggled.
 */
export const DebugPanel: FC<DebugPanelProps> = ({
  state,
  session,
  debugView,
  setDebugView,
}) => {
  const [tab, setTab] = useState<"state" | "logs" | "perf">("state");
  const isDev = import.meta.env.DEV;
  const visible = isDev || debugView;

  if (!visible) return null;

  return (
    <div className="debug-panel">
      <div className="debug-panel-header">
        <span className="debug-panel-title">
          🐛 调试面板{isDev ? " (DEV)" : ""}
        </span>
        <button
          className="debug-panel-close"
          type="button"
          onClick={() => setDebugView(false)}
        >
          关闭
        </button>
      </div>

      <div className="debug-panel-tabs">
        {(["state", "logs", "perf"] as const).map((t) => (
          <button
            key={t}
            className={`debug-tab${tab === t ? " active" : ""}`}
            type="button"
            onClick={() => setTab(t)}
          >
            {t === "state" ? "状态" : t === "logs" ? "日志" : "性能"}
          </button>
        ))}
      </div>

      <div className="debug-panel-body">
        {tab === "state" && (
          <DebugStateView state={state} session={session} />
        )}
        {tab === "logs" && <DebugLogView state={state} />}
        {tab === "perf" && <DebugPerfView />}
      </div>
    </div>
  );
};

// ---- Sub-views ----

const DebugStateView: FC<{ state: CombatState; session: AppSession }> = ({
  state,
  session,
}) => (
  <div className="debug-state">
    <table>
      <tbody>
        <tr><td>路由</td><td>{session.route}</td></tr>
        <tr><td>身份</td><td>{session.identity ?? "—"}</td></tr>
        <tr><td>轮次</td><td>第{state.round}轮</td></tr>
        <tr><td>阶段</td><td>{state.phase}</td></tr>
        <tr><td>行动者</td><td>{state.activeActorId}</td></tr>
        <tr><td>待结算</td><td>{state.pendingAction ? "是" : "否"}</td></tr>
        <tr><td>角色数</td><td>{state.actors.length}</td></tr>
        <tr><td>骰子数</td><td>{state.dice.length}</td></tr>
        <tr><td>距离数</td><td>{state.distances.length}</td></tr>
        <tr><td>日志数</td><td>{state.logs.length}</td></tr>
        <tr><td>保存时间</td><td>{state.lastSavedAt ? new Date(state.lastSavedAt).toLocaleTimeString() : "—"}</td></tr>
      </tbody>
    </table>
  </div>
);

const DebugLogView: FC<{ state: CombatState }> = ({ state }) => (
  <div className="debug-logs">
    {state.logs.length === 0 ? (
      <p className="empty-state">暂无日志</p>
    ) : (
      state.logs.map((log) => (
        <div key={log.id} className="debug-log-entry">
          <span className={`debug-log-type ${log.public ? "" : "dm-only"}`}>
            {log.type}
          </span>
          <span>{log.message}</span>
          <small>第{log.round}轮</small>
        </div>
      ))
    )}
  </div>
);

const DebugPerfView: FC = () => (
  <div className="debug-perf">
    <p>React 渲染性能面板占位。</p>
    <p>可在后续版本接入 React DevTools Profiler API。</p>
  </div>
);
