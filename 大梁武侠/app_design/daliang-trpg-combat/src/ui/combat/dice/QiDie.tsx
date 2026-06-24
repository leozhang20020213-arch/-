import type { FC } from "react";
import type { QiDie as QiDieType } from "../../../combat/types";

export interface QiDieProps {
  die: QiDieType;
  /** Is this die currently assigned to a slot? */
  isAssigned: boolean;
  /** Can this die be dragged right now? */
  draggable: boolean;
  /** Called when the user starts dragging */
  onDragStart: (dieId: string) => void;
  /** Called on click (for selection toggle / remove from slot) */
  onClick: (dieId: string) => void;
}

const NATURE_LABELS: Record<string, string> = {
  yin: "阴",
  yang: "阳",
  raw: "原",
};

const NATURE_CLASS: Record<string, string> = {
  yin: "die-yin",
  yang: "die-yang",
  raw: "die-raw",
};

/**
 * A single Qi die card — the core visual unit of the dice system.
 *
 * Layout (top → bottom):
 *   ┌──────────┐
 *   │ D6        │  ← sides label (small, top-left)
 *   │           │
 *   │    5      │  ← value (large, centered)
 *   │           │
 *   │ 阴  ◇ 临  │  ← nature + temp marker (bottom)
 *   └──────────┘
 *
 * Border-left color: yin = blue-tinted, yang = amber-tinted, raw = stone/grey.
 * Temp dice get a dashed border.
 * Assigned dice get reduced opacity but remain clickable (to remove from slot).
 */
export const QiDie: FC<QiDieProps> = ({
  die,
  isAssigned,
  draggable,
  onDragStart,
  onClick,
}) => {
  const natureLabel = NATURE_LABELS[die.nature] ?? "?";
  const natureCls = NATURE_CLASS[die.nature] ?? "";

  const isTemp = die.temporary === true;
  const isLocked = die.zone === "QI_LOCK";

  function handleDragStart(e: React.DragEvent) {
    if (!draggable) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", die.id);
    e.dataTransfer.effectAllowed = "move";
    onDragStart(die.id);
  }

  return (
    <button
      type="button"
      className={
        `qi-die-card ${natureCls}` +
        (isAssigned ? " assigned" : "") +
        (isTemp ? " temp" : "") +
        (isLocked ? " locked" : "")
      }
      draggable={draggable}
      onClick={() => onClick(die.id)}
      onDragStart={handleDragStart}
      title={`${natureLabel}骰 ${die.label} 点数${die.value ?? "?"} · ${die.sourceName}${isTemp ? "（临气）" : ""}${isLocked ? "（已锁）" : ""}`}
      aria-label={`${natureLabel}骰 D${die.sides} 点数${die.value ?? "?"}`}
    >
      {/* Top row: sides label */}
      <span className="qi-die-sides">D{die.sides}</span>

      {/* Center: value */}
      <span className="qi-die-value">{die.value ?? "?"}</span>

      {/* Bottom row: nature + temp indicator */}
      <span className="qi-die-footer">
        <span className="qi-die-nature">{natureLabel}</span>
        {isTemp && <span className="qi-die-temp-mark">临</span>}
        {isLocked && <span className="qi-die-lock-mark">锁</span>}
      </span>
    </button>
  );
};
