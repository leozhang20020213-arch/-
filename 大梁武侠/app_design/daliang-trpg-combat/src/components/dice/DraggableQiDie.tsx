// ==========================================================================
// DraggableQiDie — Wraps QiDie2D with @dnd-kit draggable behavior.
// Phase 2: each die in the qi sea is independently draggable.
// ==========================================================================

import { type FC } from "react";
import { useDraggable } from "@dnd-kit/core";
import type { QiDieData } from "../../types/dice";
import { QiDie2D } from "./QiDie2D";

export interface DraggableQiDieProps {
  die: QiDieData;
  /** Is the die currently selected? */
  selected?: boolean;
  /** Can this die be dragged right now? */
  disabled?: boolean;
}

/**
 * A draggable qi die card.
 * Uses @dnd-kit useDraggable — the DndContext must be provided by a parent.
 * When disabled, the card is still visible but can't be picked up.
 */
export const DraggableQiDie: FC<DraggableQiDieProps> = ({
  die,
  selected = false,
  disabled = false,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `die-${die.id}`,
      data: { dieId: die.id, die },
      disabled,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 1000 : undefined,
        opacity: isDragging ? 0.5 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      <QiDie2D
        die={die}
        selected={selected}
      />
    </div>
  );
};
