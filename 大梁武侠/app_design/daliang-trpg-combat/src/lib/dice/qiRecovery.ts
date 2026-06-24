// ==========================================================================
// Qi Recovery — 大梁江湖 TRPG 调息与返照
// Phase 4: regulate breath (调息) and return light (返照) actions.
// MVP implementation — simplified from full rulebook for flow testing.
// ==========================================================================

import type { QiDieData, DieSides } from "../../types/dice";
import { rollQiDie } from "./diceRoll";

// ---- Regulate Breath (调息) ----

export interface RegulateBreathResult {
  /** Updated dice array */
  dice: QiDieData[];
  /** Number of dice moved from rest pool to sea */
  movedCount: number;
  /** Human-readable message */
  message: string;
}

/**
 * MVP: Move ALL dice from rest pool to qi sea and re-roll them.
 *
 * Full rule: player may choose which dice to recover, limited by 回气 attr.
 * This MVP implementation moves everything for simple flow testing.
 */
export function recoverFromRestPool(dice: QiDieData[]): RegulateBreathResult {
  const restDice = dice.filter((d) => d.location === "restPool");

  if (restDice.length === 0) {
    return { dice, movedCount: 0, message: "息库为空，无需调息。" };
  }

  const moved = dice.map((d) => {
    if (d.location === "restPool") {
      return rollQiDie({ ...d, location: "qiSea" as const });
    }
    return d;
  });

  return {
    dice: moved,
    movedCount: restDice.length,
    message: `调息完成：${restDice.length} 枚气骰回到气海，已重新投掷。`,
  };
}

// ---- Return Light (返照) ----

export interface ReturnLightCheck {
  allowed: boolean;
  reasons: string[];
}

export interface ReturnLightResult {
  /** Updated dice array */
  dice: QiDieData[];
  /** The die that was recovered (null if none) */
  recoveredDie: QiDieData | null;
  /** Human-readable message */
  message: string;
}

/**
 * Check whether return light can be used right now.
 *
 * Conditions:
 * 1. Qi sea must be empty
 * 2. Rest pool must have at least 1 die
 * 3. Has NOT been used yet this combat
 */
export function canUseReturnLight(params: {
  qiSeaDice: QiDieData[];
  restPoolDice: QiDieData[];
  hasUsedReturnLight: boolean;
}): ReturnLightCheck {
  const reasons: string[] = [];

  if (params.qiSeaDice.length > 0) {
    reasons.push("气海不为空，不需要返照");
  }
  if (params.restPoolDice.length === 0) {
    reasons.push("息库为空，无骰可取");
  }
  if (params.hasUsedReturnLight) {
    reasons.push("本场交锋已返照（限一次）");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

/**
 * MVP: Take the lowest-sides die from rest pool, move to qi sea, re-roll it.
 *
 * Full rule: more complex conditions and may access qi pool etc.
 * This is a simplified MVP for flow testing.
 */
export function useReturnLight(dice: QiDieData[]): ReturnLightResult {
  const restDice = dice.filter((d) => d.location === "restPool");

  if (restDice.length === 0) {
    return { dice, recoveredDie: null, message: "息库为空，无法返照。" };
  }

  // Pick the die with the smallest sides
  const sorted = [...restDice].sort((a, b) => a.sides - b.sides);
  const chosen = sorted[0];

  const updated = dice.map((d) => {
    if (d.id === chosen.id) {
      return rollQiDie({ ...d, location: "qiSea" as const });
    }
    return d;
  });

  const recovered = updated.find((d) => d.id === chosen.id) ?? null;

  return {
    dice: updated,
    recoveredDie: recovered,
    message: `返照：${chosen.face}D${chosen.sides}（点数${recovered?.value ?? "?"}）从息库回到气海。`,
  };
}

/**
 * Count dice by location for zone display.
 */
export interface ZoneCounts {
  qiSea: number;
  locked: number;
  restPool: number;
  tempQi: number;
  total: number;
}

export function getZoneCounts(dice: QiDieData[]): ZoneCounts {
  return {
    qiSea: dice.filter((d) => d.location === "qiSea").length,
    locked: dice.filter((d) => d.locked || d.location === "lockedYin" || d.location === "lockedYang").length,
    restPool: dice.filter((d) => d.location === "restPool").length,
    tempQi: dice.filter((d) => d.location === "tempQi").length,
    total: dice.length,
  };
}
