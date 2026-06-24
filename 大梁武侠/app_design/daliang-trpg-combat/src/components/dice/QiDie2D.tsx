// ==========================================================================
// QiDie2D — Single 2D Qi Die Card
// Phase 1: visible card-style die with clear value, face, and sides.
// ==========================================================================

import { type FC } from "react";
import type { QiDieData } from "../../types/dice";
import { DIE_SIDES_LABEL, DIE_KIND_LABEL, DIE_SIZE_SCALE } from "../../types/dice";
import "./dice.css";

export interface QiDie2DProps {
  die: QiDieData;
  /** Is this die currently selected? */
  selected?: boolean;
  /** Show a rolling animation */
  rolling?: boolean;
  /** Temporary display value during rolling (overrides die.value when provided) */
  displayValue?: number;
  /** Click handler */
  onClick?: (dieId: string) => void;
}

/** CSS class per kind */
const KIND_CLASS: Record<string, string> = {
  yin: "qi-die-2d--yin",
  yang: "qi-die-2d--yang",
  raw: "qi-die-2d--raw",
};

/**
 * A single 2D qi die card.
 * Shows:
 *   - 左上角: 阴/阳/原
 *   - 中央: 大点数
 *   - 右下角: D6/D8/etc.
 * Size scales with sides.
 * Color/border varies by kind.
 */
export const QiDie2D: FC<QiDie2DProps> = ({
  die,
  selected = false,
  rolling = false,
  displayValue,
  onClick,
}) => {
  const kindCls = KIND_CLASS[die.kind] ?? "";
  const scale = DIE_SIZE_SCALE[die.sides] ?? 1.0;
  const sidesLabel = DIE_SIDES_LABEL[die.sides] ?? `D${die.sides}`;
  const kindLabel = DIE_KIND_LABEL[die.kind] ?? "?";

  const baseSize = 64; // px base for D6
  const size = Math.round(baseSize * scale);

  // Use displayValue during rolling, fall back to die.value
  const shownValue = rolling && displayValue !== undefined ? displayValue : die.value;
  const isAnimating = rolling && displayValue !== undefined && displayValue !== die.value;

  function handleClick() {
    onClick?.(die.id);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(die.id);
    }
  }

  return (
    <button
      type="button"
      className={`qi-die-2d ${kindCls}${selected ? " qi-die-2d--selected" : ""}${rolling ? " qi-die-2d--rolling" : ""}${isAnimating ? " qi-die-2d--animating" : ""}`}
      style={{ width: size, height: Math.round(size * 1.15) }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`${kindLabel}骰 ${sidesLabel} 点数 ${shownValue}`}
      title={`${kindLabel}骰 ${sidesLabel} · ${die.source ?? "气海"}${die.temporary ? " · 临时" : ""}`}
    >
      {/* 左上角：性质标识 */}
      <span className="qi-die-2d__face qi-die-kind-mark">{kindLabel}</span>

      {/* 中央大数字 */}
      <span className={`qi-die-2d__value qi-die-face-value${isAnimating ? " qi-die-face-value--spinning" : ""}`}>{shownValue}</span>

      {/* 右下角：骰阶 */}
      <span className="qi-die-2d__sides qi-die-sides-mark">{sidesLabel}</span>

      {/* 临时标记 */}
      {die.temporary && <span className="qi-die-2d__temp-mark">临</span>}

      {/* 锁定标记 */}
      {die.locked && <span className="qi-die-2d__lock-mark">锁</span>}
    </button>
  );
};
