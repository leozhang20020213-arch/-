import type { FC } from "react";
import type { Actor } from "../../combat/types";
import { UnitCard } from "./UnitCard";

export interface CombatBriefCardProps {
  actor: Actor;
}

/**
 * Compact combat summary card for an actor.
 * Shows UnitCard + key table attributes (护体 爆发 回气 身势).
 */
export const CombatBriefCard: FC<CombatBriefCardProps> = ({ actor }) => {
  return (
    <article className="combat-brief-card">
      <UnitCard
        actor={actor}
        mode={actor.side === "player" ? "teammate" : "enemyPublic"}
      />
      <div className="stat-grid">
        <span>护体 {actor.tableAttrs.护体}</span>
        <span>爆发 {actor.tableAttrs.爆发}</span>
        <span>回气 {actor.tableAttrs.回气}</span>
        <span>身势 {actor.tableAttrs.身势}</span>
      </div>
    </article>
  );
};
