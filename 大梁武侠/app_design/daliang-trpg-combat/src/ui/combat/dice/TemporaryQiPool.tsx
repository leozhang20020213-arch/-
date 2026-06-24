import type { FC } from "react";
import type { QiDie as QiDieType } from "../../../combat/types";
import { QiDie } from "./QiDie";

export interface TemporaryQiPoolProps {
  dice: QiDieType[];
  assignedIds: Set<string>;
  canDrag: boolean;
  onDragStart: (dieId: string) => void;
  onClickDie: (dieId: string) => void;
}

/**
 * Temporary Qi pool — compact row above the main qi area.
 * Shows dice from items/effects that expire.
 */
export const TemporaryQiPool: FC<TemporaryQiPoolProps> = ({
  dice,
  assignedIds,
  canDrag,
  onDragStart,
  onClickDie,
}) => {
  if (dice.length === 0) return null;

  return (
    <div className="temp-qi-area">
      <span className="temp-qi-label">临气</span>
      <div className="temp-qi-dice">
        {dice.map((d) => (
          <QiDie
            key={d.id}
            die={d}
            isAssigned={assignedIds.has(d.id)}
            draggable={canDrag && !assignedIds.has(d.id)}
            onDragStart={onDragStart}
            onClick={onClickDie}
          />
        ))}
      </div>
    </div>
  );
};
