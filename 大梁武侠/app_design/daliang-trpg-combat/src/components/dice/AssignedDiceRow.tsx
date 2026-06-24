// ==========================================================================
// AssignedDiceRow — Shows dice currently assigned to a slot.
// Phase 2: compact row of dice that can be clicked to return to qi sea.
// ==========================================================================

import { type FC } from "react";
import type { QiDieData } from "../../types/dice";
import { QiDie2D } from "./QiDie2D";

export interface AssignedDiceRowProps {
  /** Dice assigned to this slot */
  dice: QiDieData[];
  /** Click a die to return it to qi sea */
  onReturnToSea: (dieId: string) => void;
  /** Is the slot currently accepting drops? */
  canInteract: boolean;
}

/**
 * A horizontal row of assigned dice with a "click to return" label.
 */
export const AssignedDiceRow: FC<AssignedDiceRowProps> = ({
  dice,
  onReturnToSea,
  canInteract,
}) => {
  if (dice.length === 0) {
    return (
      <div className="assigned-dice-row assigned-dice-row--empty">
        {canInteract
          ? "拖入气骰"
          : "请先选择招式"}
      </div>
    );
  }

  return (
    <div className="assigned-dice-row">
      {dice.map((die) => (
        <div
          key={die.id}
          className="assigned-dice-row__item"
          onClick={() => onReturnToSea(die.id)}
          title="点击取回气海"
        >
          <QiDie2D die={die} />
          <span className="assigned-dice-row__remove-hint">↩</span>
        </div>
      ))}
    </div>
  );
};
