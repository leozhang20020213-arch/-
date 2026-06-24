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
 * Qi Sea pool — the primary source of draggable dice.
 *
 * Shows each die as a QiDie card. When empty, prompts the user to
 * roll dice into the sea or use 调息/返照 to recover dice.
 */
export const QiPool: FC<QiPoolProps> = ({
  dice,
  assignedIds,
  canDrag,
  onDragStart,
  onClickDie,
  onRoll,
}) => {
  const yinCount = dice.filter((d) => d.nature === "yin").length;
  const yangCount = dice.filter((d) => d.nature === "yang").length;
  const rawCount = dice.filter((d) => d.nature === "raw").length;
  const totalValue = dice.reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <div className="qi-pool-area">
      <div className="qi-pool-header">
        <span className="qi-pool-label">
          气海{" "}
          <span className="qi-pool-count">{dice.length} 枚</span>
          {dice.length > 0 && (
            <span className="qi-pool-sum">
              {" "}· 合计 {totalValue} 点 · 阴{yinCount} 阳{yangCount} 原{rawCount}
            </span>
          )}
        </span>
        {onRoll && (
          <button
            className="qi-pool-roll-btn"
            type="button"
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
          <div className="qi-pool-empty">
            <span className="qi-pool-empty-icon">🎲</span>
            <span>气海无骰</span>
            {onRoll && (
              <button
                className="qi-pool-empty-btn"
                type="button"
                onClick={onRoll}
              >
                点击投掷入海
              </button>
            )}
            <span className="qi-pool-empty-hint">
              或使用调息 / 返照从息库回收气骰
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
