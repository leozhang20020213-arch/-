import type { FC } from "react";
import type { Actor } from "../../../combat/types";
import type { AppMode, EnemyPublicInfo } from "../../../types/combat";
import { EnemyPublicCard } from "./EnemyPublicCard";

export interface EnemyPublicDrawerProps {
  /** The selected enemy actor (from CombatState.actors) */
  actor: Actor;
  /** Current app mode: player or dm */
  mode: AppMode;
  /** Called to deselect / close the card */
  onClose: () => void;
}

/**
 * Build EnemyPublicInfo from an Actor data row.
 * Separates public fields from DM-only fields based on mode.
 */
export function buildEnemyPublicInfo(actor: Actor): EnemyPublicInfo {
  return {
    id: actor.id,
    name: actor.name,
    hp: actor.hp,
    maxHp: actor.maxHp,
    momentum: actor.momentum,
    statuses: actor.statuses.filter((s) => s.public).map((s) => s.name),
    description: actor.publicNote ?? "",
    publicWeaknesses: actor.publicWeakness
      ? actor.publicWeakness.split("\n").filter(Boolean)
      : [],
    behaviorHint: actor.behaviorHint ?? "",
    knownMoves: actor.moves.map((m) => m.name),
    // DM-only
    hiddenGoal: actor.hiddenGoal,
    hiddenStatuses: actor.hiddenStatuses?.map((s) => s.name),
    lootOrClue: actor.lootOrClue,
    dmNote: actor.dmNote,
  };
}

/**
 * Enemy public info drawer — shown in the right panel when an enemy
 * combatant is selected on the tactical stage.
 *
 * Player mode: shows only public fields (name, HP, momentum, statuses,
 *   description, weaknesses, behavior, known moves).
 * DM mode: additionally shows hidden goal, hidden statuses, loot/clue, DM note.
 */
export const EnemyPublicDrawer: FC<EnemyPublicDrawerProps> = ({
  actor,
  mode,
  onClose,
}) => {
  const info = buildEnemyPublicInfo(actor);

  return (
    <div className="enemy-public-drawer">
      <EnemyPublicCard info={info} mode={mode} onClose={onClose} />
    </div>
  );
};
