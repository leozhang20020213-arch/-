// ==========================================================================
// diceFlow — Coordinate combat phase machine with qi dice store
// Phase 9: bridges CombatState (engine) and DiceStoreState (UI).
// ==========================================================================

import type { CombatState } from "../../combat/types";
import { enterScene, applyOutcome, endRound } from "../../combat/combatEngine";

/**
 * Combined result of a start-scene operation.
 * The caller must apply the combatState patch and dice store operations.
 */
export interface StartSceneResult {
  /** Updated combat state (caller should patch) */
  combatState: CombatState;
  /** Whether starter dice should be initialized */
  shouldInitStarterDice: boolean;
  /** Whether qi sea dice should be rolled */
  shouldRollQiSea: boolean;
}

/**
 * Prepare the start-scene transition.
 *
 * Side effects to coordinate:
 *   1. Combat engine: enterScene() → phase="scene", rolls QI_POOL dice to QI_SEA
 *   2. Dice store: if qi sea empty, initStarterDice() then rollAllQiSeaDice()
 *
 * Returns the new combat state and flags for dice store operations.
 */
export function prepareStartScene(state: CombatState): StartSceneResult {
  const next = enterScene(state);

  // Check if qi sea has dice (in the dice store sense — we check the engine dice)
  const seaDice = next.dice.filter((d) => d.zone === "QI_SEA");
  const shouldInit = seaDice.length === 0;

  return {
    combatState: next,
    shouldInitStarterDice: shouldInit,
    shouldRollQiSea: true,
  };
}

/**
 * Result of resolving the current declaration.
 */
export interface ResolveResult {
  combatState: CombatState;
  /** Whether to move locked dice to rest pool (in the dice store) */
  shouldResolveDeclaration: boolean;
}

/**
 * Prepare the resolve-outcome transition.
 * Moves locked dice to rest pool in both systems.
 */
export function prepareResolve(state: CombatState): ResolveResult {
  const hasPending = Boolean(state.pendingAction);
  const next = applyOutcome(state);

  return {
    combatState: next,
    shouldResolveDeclaration: hasPending,
  };
}

/**
 * Result of advancing to next round.
 */
export interface NextRoundResult {
  combatState: CombatState;
}

/**
 * Prepare the next-round transition.
 * Preserves qi sea dice, increments round.
 */
export function prepareNextRound(state: CombatState): NextRoundResult {
  const next = endRound(state);
  return { combatState: next };
}
