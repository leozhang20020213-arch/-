// ==========================================================================
// TargetSummary — Compact target info in right panel
// Phase 8: replaces full EnemyPublicCard with one-line summary.
// ==========================================================================

import { type FC, useState } from "react";
import type { Actor } from "../../../combat/types";

const MOMENTUM_CLASS: Record<string, string> = {
  "阴盛": "shi-yin",
  "阳盛": "shi-yang",
  "合势": "shi-he",
  "圆融": "shi-harmony",
  "崩势": "shi-collapse",
  "失势": "shi-lost",
};

export interface TargetSummaryProps {
  /** The targeted enemy actor, or null if no target selected */
  actor: Actor | undefined;
  /** Called when "详情" is clicked to expand the full card */
  onShowDetail?: (actorId: string) => void;
  /** Called to deselect target */
  onClear?: () => void;
}

/**
 * Compact target summary for the right panel.
 * Shows: name, HP, momentum badge, statuses, weakness (one line).
 * Click "详情" to expand full enemy card.
 */
export const TargetSummary: FC<TargetSummaryProps> = ({
  actor,
  onShowDetail,
  onClear,
}) => {
  if (!actor) {
    return (
      <div className="target-summary__empty">
        未选择目标 · 点击战场上的敌人
      </div>
    );
  }

  const hpPct = actor.maxHp > 0 ? Math.round((actor.hp / actor.maxHp) * 100) : 0;
  const hpColor =
    actor.hp <= 0 ? "var(--hp-red)"
    : hpPct <= 25 ? "var(--hp-red)"
    : hpPct <= 50 ? "var(--yang-die)"
    : "var(--shield-green)";
  const statusNames = actor.statuses.filter((s) => s.public).map((s) => s.name);

  return (
    <div className="target-summary">
      {/* Header: Name + HP + Detail btn */}
      <div className="target-summary__header">
        <span className="target-summary__name">
          {actor.name}
          {actor.hp <= 0 && " 濒死"}
        </span>
        <span className="target-summary__hp" style={{ color: hpColor }}>
          {actor.hp}/{actor.maxHp}
        </span>
        {onShowDetail && (
          <button
            type="button"
            className="target-summary__detail-btn"
            onClick={() => onShowDetail(actor.id)}
          >
            详情
          </button>
        )}
        {onClear && (
          <button
            type="button"
            className="target-summary__detail-btn"
            onClick={onClear}
            style={{ marginLeft: 4 }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Row: Momentum + Statuses */}
      <div className="target-summary__row">
        <span className={`target-summary__momentum ${MOMENTUM_CLASS[actor.momentum] ?? ""}`}>
          {actor.momentum}
        </span>
        {statusNames.length > 0 && (
          <div className="target-summary__statuses">
            {statusNames.map((s) => (
              <span key={s} className="target-summary__status">{s}</span>
            ))}
          </div>
        )}
      </div>

      {/* Weakness (one line) */}
      {actor.publicWeakness && (
        <div className="target-summary__weakness">
          弱点：{actor.publicWeakness}
        </div>
      )}
    </div>
  );
};
