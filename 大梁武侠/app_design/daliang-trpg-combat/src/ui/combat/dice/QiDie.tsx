import type { FC } from "react";
import type { QiDie as QiDieType } from "../../../combat/types";

export interface QiDieProps {
  die: QiDieType;
  /** Is this die currently selected (in a slot)? */
  isAssigned: boolean;
  /** Can this die be dragged right now? */
  draggable: boolean;
  /** Called when the user starts dragging */
  onDragStart: (dieId: string) => void;
  /** Called on click (for selection toggle) */
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
 * A single Qi die card.
 * Shows: nature label | die sides (D6/D8/etc.) | current value | source name.
 * Drags via HTML5 native DnD.
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
      className={`qi-die-card ${natureCls}${isAssigned ? " assigned" : ""}${die.temporary ? " temp" : ""}`}
      draggable={draggable}
      onClick={() => onClick(die.id)}
      onDragStart={handleDragStart}
      title={die.sourceName}
      aria-label={`${natureLabel}骰 ${die.label} 点数${die.value ?? "?"}`}
    >
      <span className="qi-die-nature">{natureLabel}</span>
      <span className="qi-die-sides">{die.label}</span>
      <span className="qi-die-value">{die.value ?? "?"}</span>
      {die.temporary && <span className="qi-die-temp-mark">临</span>}
    </button>
  );
};
