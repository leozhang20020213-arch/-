// ==========================================================================
// QiDropSlot — A droppable zone for yin or yang slot.
// Phase 2: accepts draggable dice, validates kind, shows assigned dice.
// ==========================================================================

import { type FC } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { QiDieData, QiSlotType, CurrentMoveQiRequirement } from "../../types/dice";
import { slotColorClass, slotLabel, hasEnoughDiceForMove } from "../../lib/dice/diceAssignment";
import { AssignedDiceRow } from "./AssignedDiceRow";

export interface QiDropSlotProps {
  /** Slot type */
  type: QiSlotType;
  /** Currently assigned dice in this slot */
  dice: QiDieData[];
  /** Current move requirement (for display) */
  requirement: CurrentMoveQiRequirement | null;
  /** Called when user clicks a die to return it to qi sea */
  onReturnDie: (dieId: string) => void;
  /** Whether drops are accepted right now */
  canDrop: boolean;
  /** Is this slot currently highlighted as a valid drop target? */
  isOver?: boolean;
}

/**
 * A droppable slot zone.
 * Visual: bordered box with header (title + requirement badge) and dice row.
 */
export const QiDropSlot: FC<QiDropSlotProps> = ({
  type,
  dice,
  requirement,
  onReturnDie,
  canDrop,
  isOver = false,
}) => {
  const { setNodeRef, isOver: isOverDnd } = useDroppable({
    id: `slot-${type}`,
    data: { slot: type },
    disabled: !canDrop,
  });

  const activeOver = isOver || isOverDnd;
  const colorCls = slotColorClass(type);
  const label = slotLabel(type);
  const requiredMin = type === "yinSlot"
    ? (requirement?.minYin ?? 0)
    : (requirement?.minYang ?? 0);

  const satisfied = requiredMin > 0 && dice.length >= requiredMin;

  return (
    <div
      ref={setNodeRef}
      className={`qi-drop-slot ${colorCls}${activeOver ? " qi-drop-slot--over" : ""}${satisfied ? " qi-drop-slot--satisfied" : ""}${!canDrop ? " qi-drop-slot--disabled" : ""}`}
    >
      <div className="qi-drop-slot__header">
        <span className="qi-drop-slot__title">{label}</span>
        {requirement && requirement.moveId ? (
          <span className={`qi-drop-slot__requirement${satisfied ? " met" : ""}`}>
            {satisfied ? "✓ " : ""}至少 {requiredMin} 枚
          </span>
        ) : (
          <span className="qi-drop-slot__requirement qi-drop-slot__requirement--none">
            未选招式
          </span>
        )}
        {dice.length > 0 && (
          <span className="qi-drop-slot__total">
            合值 {dice.reduce((s, d) => s + d.value, 0)}
          </span>
        )}
      </div>

      <AssignedDiceRow
        dice={dice}
        onReturnToSea={onReturnDie}
        canInteract={canDrop}
      />

      {!canDrop && (
        <div className="qi-drop-slot__disabled-hint">
          请先选择招式和目标
        </div>
      )}
    </div>
  );
};
