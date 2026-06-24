import type { FC } from "react";
import type { QiDie as QiDieType } from "../../../combat/types";
import { QiDie } from "./QiDie";

export interface QiPoolProps {
  /** Dice currently in QI_SEA (available for assignment) */
  dice: QiDieType[];
  /** Which dice are already assigned to slots (show as dimmed) */
  assignedIds: Set<string>;
  /** Can dice be dragged from this pool? */
  canDrag: boolean;
  /** Drag start callback */
  onDragStart: (dieId: string) => void;
  /** Click callback */
  onClickDie: (dieId: string) => void;
  /** Roll pool dice into sea */
  onRoll?: () => void;
}

/**
 * Qi Sea pool — horizontal row of draggable dice cards.
 * The primary source of dice for move assignment.
 */
export const QiPool: FC<QiPoolProps> = ({
  dice,
  assignedIds,
  canDrag,
  onDragStart,
  onClickDie,
  onRoll,
}) => {
  return (
    <div className="qi-pool-area">
      <div className="qi-pool-header">
        <span className="qi-pool-label">
          气海 <span className="qi-pool-count">{dice.length}</span>
        </span>
        {onRoll && (
          <button
            className="qi-pool-roll-btn"
            type="button"
            disabled={dice.length === 0}
            onClick={onRoll}
          >
            投掷入海
          </button>
        )}
      </div>
      <div className="qi-pool-dice">
        {dice.length > 0 ? (
          dice.map((d) => (
            <QiDie
              key={d.id}
              die={d}
              isAssigned={assignedIds.has(d.id)}
              draggable={canDrag && !assignedIds.has(d.id)}
              onDragStart={onDragStart}
              onClick={onClickDie}
            />
          ))
        ) : (
          <span className="qi-pool-empty">气海无骰 · 请调息或投掷</span>
        )}
      </div>
    </div>
  );
};
