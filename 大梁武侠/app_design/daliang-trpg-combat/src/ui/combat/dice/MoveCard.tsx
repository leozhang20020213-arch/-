// ==========================================================================
// MoveCard — Simplified move card for right panel
// Phase 7: only shows name, kind, requirement, baseEffect, short tags.
// Unavailable reasons are shown as short labels, not verbose text.
// ==========================================================================

import { type FC } from "react";
import type { MoveCardData, MoveUnavailableReason } from "../../../types/move";
import { MOVE_UNAVAILABLE_LABELS, classifyUnavailableReason } from "../../../types/move";

export interface MoveCardProps {
  move: MoveCardData;
  /** Whether this move is currently selected */
  selected?: boolean;
  /** Whether this move is currently available to use */
  available?: boolean;
  /** Short reason codes if unavailable (e.g. ["缺阴骰", "目标未选"]) */
  unavailableReasons?: MoveUnavailableReason[];
  /** Raw verbose reasons (fallback, classified to short labels) */
  rawReasons?: string[];
  /** Click handler */
  onClick?: (moveId: string) => void;
}

/**
 * A single move card for the right panel.
 *
 * Layout:
 * ┌──────────────────────────┐
 * │ 雨步斩  外功          起手│
 * │ 阴1 阳1                  │
 * │ 突进短距劈斩…            │
 * │ [主攻] [S级]             │
 * │ ⚠ 缺阴骰                 │ ← only shown when !available
 * └──────────────────────────┘
 */
export const MoveCard: FC<MoveCardProps> = ({
  move,
  selected = false,
  available = true,
  unavailableReasons,
  rawReasons,
  onClick,
}) => {
  // Derive short reasons: explicit list, or classify from raw
  const shortReasons: string[] = unavailableReasons
    ? unavailableReasons.map((r) => MOVE_UNAVAILABLE_LABELS[r] ?? r)
    : rawReasons
      ? rawReasons.map(classifyUnavailableReason)
      : [];

  const reqText = [
    move.requirement.minYin > 0 ? `阴${move.requirement.minYin}` : "",
    move.requirement.minYang > 0 ? `阳${move.requirement.minYang}` : "",
    move.requirement.minYin === 0 && move.requirement.minYang === 0 ? "任意" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={`move-card${selected ? " move-card--selected" : ""}${!available ? " move-card--unavailable" : ""}`}
      onClick={() => onClick?.(move.id)}
      title={move.description ?? move.baseEffect}
    >
      {/* Row 1: Name + Kind */}
      <div className="move-card__header">
        <span className="move-card__name">{move.name}</span>
        <span className="move-card__kind">{move.kind}</span>
      </div>

      {/* Row 2: Requirement */}
      <div className="move-card__requirement">
        <span className="move-card__req-text">{reqText}</span>
      </div>

      {/* Row 3: Base effect (truncated) */}
      <div className="move-card__effect">{move.baseEffect}</div>

      {/* Row 4: Tags */}
      {move.tags && move.tags.length > 0 && (
        <div className="move-card__tags">
          {move.tags.map((tag) => (
            <span key={tag} className="move-card__tag">{tag}</span>
          ))}
        </div>
      )}

      {/* Unavailable reason (compact) */}
      {!available && shortReasons.length > 0 && (
        <div className="move-card__reasons">
          {shortReasons.map((r) => (
            <span key={r} className="move-card__reason-tag">⚠ {r}</span>
          ))}
        </div>
      )}
    </button>
  );
};
