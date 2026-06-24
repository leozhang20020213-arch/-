// ==========================================================================
// Target Validation — Distance-based target legality checks.
// Pure functions that determine whether a selected target is valid for a move.
// ==========================================================================

import type { CombatState, DistanceBand, Move } from "../../combat/types";

// ---- User-facing distance keys (English, per spec) ----

export type TargetDistanceKey = "touch" | "close" | "mid" | "far" | "extreme";

// ---- Data Types ----

export interface TargetState {
  actingActorId: string;
  selectedTargetId?: string;
  distanceBand?: TargetDistanceKey;
  isRangeValid: boolean;
  invalidReason?: string;
}

export interface BoardActorPosition {
  actorId: string;
  x: number; // percentage 0–100
  y: number; // percentage 0–100
}

// ---- Internal DistanceBand → user-facing key mapping ----

const BAND_TO_KEY: Record<DistanceBand, TargetDistanceKey> = {
  "贴身": "touch",
  "近身": "close",
  "短距": "close",   // "短距" ≈ close range for validation purposes
  "中距": "mid",
  "远距": "far",
  "离场": "extreme", // "离场" ≈ extreme range
};

/** Chinese display label for each user-facing key */
const KEY_DISPLAY: Record<TargetDistanceKey, string> = {
  touch: "贴身",
  close: "近身",
  mid: "中距",
  far: "远距",
  extreme: "超距",
};

/** Distance keys ordered closest → furthest */
const KEY_ORDER: TargetDistanceKey[] = [
  "touch", "close", "mid", "far", "extreme",
];

export function bandToKey(band: DistanceBand): TargetDistanceKey {
  return BAND_TO_KEY[band] ?? "mid";
}

export function keyToDisplay(key: TargetDistanceKey): string {
  return KEY_DISPLAY[key] ?? key;
}

// ---- Core functions ----

/**
 * Find the distance band between two actors from the state's distance relations.
 */
export function getDistanceBetween(
  state: CombatState,
  fromId: string,
  toId: string,
): DistanceBand | undefined {
  const rel = state.distances.find(
    (d) =>
      (d.fromActorId === fromId && d.toActorId === toId) ||
      (d.fromActorId === toId && d.toActorId === fromId),
  );
  return rel?.band;
}

/**
 * Check if a distance band is within a move's target range.
 *
 * Target range strings are free-form text like:
 *   "近身人物目标；主手刀或同类短兵"
 *   "近身或相邻距离"
 *   "道路、房间、尸身周边或机关痕迹"
 *
 * We parse the distance portion and check against the actual band.
 */
export function isDistanceValidForMove(
  actualBand: DistanceBand | undefined,
  targetRangeText: string,
): { valid: boolean; reason?: string } {
  if (!actualBand) {
    return { valid: false, reason: "目标距离未知" };
  }
  if (!targetRangeText) {
    return { valid: true };
  }

  const range = targetRangeText.trim();
  const actualKey = bandToKey(actualBand);
  const actualDisplay = keyToDisplay(actualKey);

  // "贴身" or "近身" — these specific bands mentioned in the range text
  const bandsMentioned = KEY_ORDER.filter((k) => range.includes(keyToDisplay(k)));

  if (bandsMentioned.length > 0) {
    if (bandsMentioned.includes(actualKey)) {
      return { valid: true };
    }

    // "相邻" means ±1 band
    if (range.includes("相邻")) {
      const actualIdx = KEY_ORDER.indexOf(actualKey);
      for (const k of bandsMentioned) {
        const kIdx = KEY_ORDER.indexOf(k);
        if (Math.abs(actualIdx - kIdx) <= 1) {
          return { valid: true };
        }
      }
    }

    return {
      valid: false,
      reason: `距离过远：当前${actualDisplay}，招式需要${bandsMentioned.map(keyToDisplay).join("、")}`,
    };
  }

  // Scene-based targeting — always valid
  if (
    range.includes("道路") ||
    range.includes("房间") ||
    range.includes("尸身") ||
    range.includes("机关") ||
    range.includes("痕迹") ||
    range.includes("自己") ||
    range.includes("可及") ||
    range.includes("同一")
  ) {
    return { valid: true };
  }

  // Can't parse — let DM decide
  return { valid: true };
}

/**
 * Derive full TargetState from combat state + selected target.
 */
export function deriveTargetState(
  state: CombatState,
  selectedTargetId: string | undefined,
  selectedMove: Move | undefined,
): TargetState {
  const actingActorId = state.activeActorId;

  if (!selectedTargetId) {
    return {
      actingActorId,
      selectedTargetId: undefined,
      isRangeValid: true,
    };
  }

  const band = getDistanceBetween(state, actingActorId, selectedTargetId);

  let rangeCheck: { valid: boolean; reason?: string } = { valid: true };
  if (selectedMove?.targetRange) {
    rangeCheck = isDistanceValidForMove(band, selectedMove.targetRange);
  }

  return {
    actingActorId,
    selectedTargetId,
    distanceBand: band ? bandToKey(band) : undefined,
    isRangeValid: rangeCheck.valid,
    invalidReason: rangeCheck.reason,
  };
}

/**
 * Get a human-friendly tooltip for the target line.
 * Format: 沈青 → 短兵客｜近身｜破浪横刀可用
 */
export function targetLineTooltip(
  fromName: string,
  toName: string,
  key: TargetDistanceKey | undefined,
  moveName: string | undefined,
  isValid: boolean,
): string {
  const parts = [`${fromName} → ${toName}`];
  if (key) parts.push(`｜${keyToDisplay(key)}`);
  if (moveName) parts.push(`｜${moveName}${isValid ? "可用" : "不可用"}`);
  if (!isValid) parts.push("｜距离不合法");
  return parts.join("");
}
