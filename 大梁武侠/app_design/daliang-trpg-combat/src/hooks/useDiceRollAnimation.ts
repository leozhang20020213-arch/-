// ==========================================================================
// useDiceRollAnimation — Phase 5: per-die 2D roll animation hook
// 大梁江湖 TRPG · 气骰投掷动画
// ==========================================================================

import { useCallback, useRef } from "react";
import type { QiDieData } from "../types/dice";
import { rollQiDie } from "../lib/dice/diceRoll";
import { useDiceStore } from "../store/diceStore";

/** Min/max animation duration per die (ms) */
const MIN_DURATION = 500;
const MAX_DURATION = 900;

/** Interval for display value refresh during roll (ms) */
const TICK_MS = 80;

/**
 * Generate a random integer in [1, sides].
 */
function randomFace(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Generate a random duration between min and max (ms).
 */
function randomDuration(): number {
  return MIN_DURATION + Math.floor(Math.random() * (MAX_DURATION - MIN_DURATION));
}

export interface UseDiceRollAnimationReturn {
  /** Whether any die is currently animating */
  isAnyRolling: boolean;
  /** Set of die IDs currently in animation */
  rollingDieIds: Set<string>;
  /** Get the current display value for a die (final value if not rolling, random if rolling) */
  getDisplayValue: (dieId: string, finalValue: number) => number;
  /**
   * Start the roll animation for the given dice.
   * Pre-computes final values, animates random numbers, then commits final values to store.
   */
  startRollAnimation: (dice: QiDieData[]) => void;
}

/**
 * Hook that manages per-die 2D rolling animation.
 *
 * Each die animates independently for 500–900ms.
 * During animation, display values rapidly cycle through random numbers.
 * After animation, the final pre-rolled value is shown and committed to store.
 *
 * Usage:
 * ```ts
 * const { isAnyRolling, getDisplayValue, startRollAnimation } = useDiceRollAnimation();
 * // In render:
 * <QiDie2D die={die} rolling={isAnyRolling} displayValue={getDisplayValue(die.id, die.value)} />
 * ```
 */
export function useDiceRollAnimation(): UseDiceRollAnimationReturn {
  const { state, dispatch } = useDiceStore();
  const timersRef = useRef<ReturnType<typeof setInterval>[]>([]);

  /** Clean up all pending timers */
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => {
      clearInterval(id);
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    });
    timersRef.current = [];
  }, []);

  const startRollAnimation = useCallback(
    (dice: QiDieData[]) => {
      if (dice.length === 0) return;

      // Clean up any stale timers
      clearAllTimers();

      // 1. Pre-compute final values
      const finalValues = dice.map((die) => ({
        dieId: die.id,
        rolled: rollQiDie(die),
      }));
      const finalValueMap = new Map(finalValues.map((v) => [v.dieId, v.rolled.value]));

      // 2. Mark rolling started
      dispatch({ type: "START_ROLLING" });

      // 3. Start the tick interval for random display values
      const tickInterval = setInterval(() => {
        const currentRollingIds = new Set(
          dice.map((d) => d.id),
        );
        // Only update dice that haven't finished yet
        const updates: Record<string, number> = {};
        currentRollingIds.forEach((id) => {
          const die = dice.find((d) => d.id === id);
          if (die) {
            updates[id] = randomFace(die.sides);
          }
        });
        dispatch({ type: "UPDATE_ROLLING_DISPLAY", displayValues: updates });
      }, TICK_MS);
      timersRef.current.push(tickInterval);

      // 4. Per-die animation timeouts
      const finishedIds = new Set<string>();

      dice.forEach((die) => {
        const duration = randomDuration();
        const timerId = setTimeout(() => {
          finishedIds.add(die.id);

          // Update display to show final value
          dispatch({
            type: "UPDATE_ROLLING_DISPLAY",
            displayValues: { [die.id]: finalValueMap.get(die.id) ?? die.value },
          });

          // If all dice finished, wrap up
          if (finishedIds.size >= dice.length) {
            clearInterval(tickInterval);

            // Small delay so user can see the final values before we clear rolling state
            setTimeout(() => {
              dispatch({
                type: "FINISH_ROLLING",
                values: finalValues.map((v) => ({
                  dieId: v.dieId,
                  value: v.rolled.value,
                })),
              });
              // Clean up timers
              timersRef.current = timersRef.current.filter(
                (id) => id !== tickInterval && id !== (timerId as unknown as ReturnType<typeof setInterval>),
              );
            }, 150);
          }
        }, duration);
        timersRef.current.push(timerId as unknown as ReturnType<typeof setInterval>);
      });
    },
    [dispatch, clearAllTimers],
  );

  const getDisplayValue = useCallback(
    (dieId: string, finalValue: number): number => {
      if (!state.isRolling) return finalValue;
      return state.rollingDisplayValues[dieId] ?? finalValue;
    },
    [state.isRolling, state.rollingDisplayValues],
  );

  const rollingDieIds: Set<string> = state.isRolling
    ? new Set(Object.keys(state.rollingDisplayValues))
    : new Set();

  return {
    isAnyRolling: state.isRolling,
    rollingDieIds,
    getDisplayValue,
    startRollAnimation,
  };
}
