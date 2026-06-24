// ==========================================================================
// QiDiceToolbar — Toolbar for Qi Dice operations
// Phase 1: Init, Roll, Reset buttons.
// ==========================================================================

import { type FC } from "react";
import "./dice.css";

export interface QiDiceToolbarProps {
  /** Whether dice have been initialized */
  hasDice: boolean;
  /** Whether dice are currently rolling */
  isRolling: boolean;
  /** Called when user clicks "初始化气骰" */
  onInit: () => void;
  /** Called when user clicks "投掷气海" */
  onRoll: () => void;
  /** Called when user clicks "全部回气海" */
  onReset: () => void;
}

/**
 * Toolbar with three action buttons for qi dice management.
 */
export const QiDiceToolbar: FC<QiDiceToolbarProps> = ({
  hasDice,
  isRolling,
  onInit,
  onRoll,
  onReset,
}) => {
  return (
    <div className="qi-dice-toolbar">
      <button
        type="button"
        className="qi-dice-toolbar__btn qi-dice-toolbar__btn--init"
        disabled={hasDice}
        onClick={onInit}
      >
        🎲 初始化气骰
      </button>

      <button
        type="button"
        className="qi-dice-toolbar__btn qi-dice-toolbar__btn--roll"
        disabled={!hasDice || isRolling}
        onClick={onRoll}
      >
        {isRolling ? "🎯 投掷中..." : "🎯 投掷气海"}
      </button>

      <button
        type="button"
        className="qi-dice-toolbar__btn qi-dice-toolbar__btn--reset"
        disabled={!hasDice}
        onClick={onReset}
      >
        ↩ 全部回气海
      </button>
    </div>
  );
};
