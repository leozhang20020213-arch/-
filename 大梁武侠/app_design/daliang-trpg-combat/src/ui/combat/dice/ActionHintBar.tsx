// ==========================================================================
// ActionHintBar — Unified hint bar for move/dice declaration status
// Phase 7: shows a single consolidated hint instead of verbose error messages.
// ==========================================================================

import { type FC } from "react";

export interface ActionHintBarProps {
  /** Whether a move is selected */
  hasMove: boolean;
  /** Move name if selected */
  moveName?: string;
  /** Whether a target is selected */
  hasTarget: boolean;
  /** Target name if selected */
  targetName?: string;
  /** Whether yin slot requirement is met */
  yinMet: boolean;
  /** Whether yang slot requirement is met */
  yangMet: boolean;
  /** Current yin dice count */
  yinCount: number;
  /** Current yang dice count */
  yangCount: number;
  /** Whether dice are rolling */
  isRolling: boolean;
  /** Whether already locked */
  isLocked: boolean;
}

/**
 * Compact hint bar that shows the current declaration status.
 *
 * Shows ONE line summarizing what the player needs to do next.
 * Example outputs:
 *   "请选择招式并指定目标"
 *   "雨步斩 · 目标：短兵客 ｜ 还需 阴1 阳1"
 *   "雨步斩 · 目标：短兵客 ｜ 阴✓ 阳✓ 可锁气"
 *   "🎯 投掷中…"
 */
export const ActionHintBar: FC<ActionHintBarProps> = ({
  hasMove,
  moveName,
  hasTarget,
  targetName,
  yinMet,
  yangMet,
  yinCount,
  yangCount,
  isRolling,
  isLocked,
}) => {
  // Rolling takes priority
  if (isRolling) {
    return (
      <div className="action-hint-bar action-hint-bar--rolling">
        <span className="action-hint-bar__icon">🎯</span>
        <span>气骰投掷中，请等待动画结束…</span>
      </div>
    );
  }

  // Locked
  if (isLocked) {
    return (
      <div className="action-hint-bar action-hint-bar--locked">
        <span className="action-hint-bar__icon">🔒</span>
        <span>已锁气，等待响应窗口或结算</span>
      </div>
    );
  }

  // No move selected
  if (!hasMove) {
    return (
      <div className="action-hint-bar action-hint-bar--idle">
        <span>请选择招式并指定目标</span>
      </div>
    );
  }

  // Has move but no target
  if (!hasTarget) {
    return (
      <div className="action-hint-bar action-hint-bar--idle">
        <span className="action-hint-bar__move">{moveName}</span>
        <span className="action-hint-bar__sep">·</span>
        <span className="action-hint-bar__warn">请选择目标（点击战场敌人）</span>
      </div>
    );
  }

  // Has move + target, check slots
  const parts: string[] = [];
  if (yinMet) {
    parts.push(`阴✓`);
  } else {
    parts.push(`阴${yinCount}/?`);
  }
  if (yangMet) {
    parts.push(`阳✓`);
  } else {
    parts.push(`阳${yangCount}/?`);
  }

  const allMet = yinMet && yangMet;
  const statusLabel = allMet ? "可锁气" : parts.join(" ");

  return (
    <div className={`action-hint-bar${allMet ? " action-hint-bar--ready" : ""}`}>
      <span className="action-hint-bar__move">{moveName}</span>
      {targetName && (
        <>
          <span className="action-hint-bar__sep">·</span>
          <span className="action-hint-bar__target">目标：{targetName}</span>
        </>
      )}
      <span className="action-hint-bar__sep">｜</span>
      <span className={allMet ? "action-hint-bar__ready-label" : "action-hint-bar__status"}>
        {statusLabel}
      </span>
    </div>
  );
};
