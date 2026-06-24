import type { FC } from "react";
import type { Actor } from "../../combat/types";
import { SixRootsSummary } from "./SixRootsSummary";

export interface UnitCardProps {
  actor: Actor;
  mode: "self" | "teammate" | "enemyPublic" | "enemyDm";
}

function publicStatuses(actor: Actor) {
  return actor.statuses.filter((s) => !("hidden" in s));
}

/**
 * Unit display card. Shows name, momentum, HP bar, statuses, and optional Six Roots.
 * Mode variants:
 * - self: full display with Six Roots
 * - teammate: compact, limited statuses
 * - enemyPublic: player-visible enemy info only
 * - enemyDm: DM full view including hidden statuses
 */
export const UnitCard: FC<UnitCardProps> = ({ actor, mode }) => {
  const statuses =
    mode === "enemyDm"
      ? [...actor.statuses, ...(actor.hiddenStatuses ?? [])]
      : publicStatuses(actor).length > 0
        ? publicStatuses(actor)
        : actor.statuses;
  const visibleStatuses = statuses.slice(
    0,
    mode === "self" || mode === "enemyDm" ? 6 : 4,
  );
  const momentum = actor.momentum;

  return (
    <article className={`unit-card ${mode}`}>
      <div className="unit-head">
        <div>
          <div className="unit-name-row">
            <strong>{actor.name}</strong>
            <span className="unit-momentum">{momentum}</span>
          </div>
          <div className="status-bar" aria-label="状态栏">
            {visibleStatuses.length > 0
              ? visibleStatuses.map((status) => (
                  <span key={status.id}>{status.name}</span>
                ))
              : <span>无状态</span>}
          </div>
        </div>
      </div>
      <meter min={0} max={actor.maxHp} value={actor.hp} />
      <p className="unit-hp">
        气血 {actor.hp}/{actor.maxHp}
      </p>
      {mode === "self" ? <SixRootsSummary actor={actor} /> : null}
      {mode === "enemyDm" && actor.hiddenStatuses?.length ? (
        <p className="hint">
          隐藏状态：
          {actor.hiddenStatuses.map((s) => s.name).join("、")}
        </p>
      ) : null}
    </article>
  );
};
