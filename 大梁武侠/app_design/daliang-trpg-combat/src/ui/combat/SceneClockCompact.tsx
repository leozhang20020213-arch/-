import { useState, type FC } from "react";
import type { SceneClock } from "../../combat/sceneClock";
import { clockIcon, clockTypeLabel, clockPercent, getVisibleClocks } from "../../combat/sceneClock";

export interface SceneClockCompactProps {
  clocks: SceneClock[];
  /** Whether to hide non-primary clocks (default: collapse them) */
  maxVisible?: number;
}

/**
 * Compact scene clock display — replaces the old verbose track displays.
 *
 * Primary clock is expanded (name + progress bar + trigger).
 * Others are collapsed into a small row of mini-bars.
 * Click "详情" to see the full description in an inline popover.
 */
export const SceneClockCompact: FC<SceneClockCompactProps> = ({
  clocks,
  maxVisible = 1,
}) => {
  const [showAll, setShowAll] = useState(false);
  const visible = getVisibleClocks(clocks);
  if (visible.length === 0) return null;

  const primary = visible[0];
  const rest = visible.slice(1, showAll ? visible.length : maxVisible);
  const hidden = showAll ? [] : visible.slice(maxVisible);

  return (
    <div className="scene-clock-compact">
      {/* Primary clock — expanded */}
      <ClockRow clock={primary} expanded />

      {/* Secondary clocks — collapsed */}
      {rest.map((c) => (
        <ClockRow key={c.id} clock={c} expanded={false} />
      ))}

      {/* Hidden count */}
      {hidden.length > 0 ? (
        <button
          className="clock-hidden-count"
          type="button"
          aria-expanded={false}
          onClick={() => setShowAll(true)}
        >
          展开其余 {hidden.length} 条轨
        </button>
      ) : showAll && visible.length > maxVisible ? (
        <button
          className="clock-hidden-count"
          type="button"
          aria-expanded="true"
          onClick={() => setShowAll(false)}
        >
          收起次要轨
        </button>
      ) : null}
    </div>
  );
};

/** Individual clock row */
const ClockRow: FC<{ clock: SceneClock; expanded: boolean }> = ({
  clock,
  expanded,
}) => {
  const [showDetail, setShowDetail] = useState(false);
  const pct = clockPercent(clock);
  const isHigh = pct >= 75;
  const isCritical = pct >= 90;
  const barColor = isCritical
    ? "var(--hp-red)"
    : isHigh
      ? "var(--yang-die)"
      : "var(--shield-green)";

  return (
    <div className={`clock-row${expanded ? " expanded" : " collapsed"}`}>
      <div className="clock-row-header">
        <span className="clock-name">
          <span className="clock-icon">{clockIcon(clock.type)}</span>
          {clock.name}
        </span>
        <span className="clock-value">
          {clock.value}/{clock.max}
        </span>
        <span className="clock-type-label">{clockTypeLabel(clock.type)}</span>
      </div>

      {/* Progress bar */}
      <div className="clock-bar-track">
        <div
          className="clock-bar-fill"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>

      {/* Expanded: trigger + consequence + detail toggle */}
      {expanded && (
        <div className="clock-expanded-info">
          {clock.triggerSummary && (
            <span className="clock-trigger">{clock.triggerSummary}</span>
          )}
          {clock.consequenceSummary && (
            <span className="clock-consequence">
              后果：{clock.consequenceSummary}
            </span>
          )}
          {clock.detail && (
            <>
              <button
                className="clock-detail-btn"
                type="button"
                onClick={() => setShowDetail(!showDetail)}
              >
                {showDetail ? "收起" : "详情"}
              </button>
              {showDetail && (
                <p className="clock-detail-text">{clock.detail}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
