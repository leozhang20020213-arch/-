import { confirmInitiative, prepareCombatRound } from "../../combat/combatEngine";
import type { CombatState } from "../../combat/types";

/**
 * Create a combat encounter from the current scene. prepareCombatRound is the
 * only compatibility bridge; it preserves shared qi and scene records while
 * resetting combat round/order inside RuntimeSessionState.
 */
export function startCombatFromScene(state: CombatState): CombatState {
  return prepareCombatRound(state);
}

export function confirmCombatOrder(state: CombatState): CombatState {
  return confirmInitiative(state);
}
