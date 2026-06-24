// ==========================================================================
// Target Validation — Distance-based target legality checks.
// Pure functions that determine whether a selected target is valid for a move.
// ==========================================================================

import type { CombatState, DistanceBand, Move } from "../../combat/types";

// ---- Data Types ----

export interface TargetState {
  actingActorId: string;
  selectedTargetId?: string;
  distanceBand?: DistanceBand;
  isRangeValid: boolean;
  invalidReason?: string;
}

export interface BoardPosition {
  actorId: string;
  x: number; // percentage 0–100
  y: number; // percentage 0–100
}

// ---- Distance band ordering (closest → furthest) ----

const DISTANCE_ORDER: DistanceBand[] = [
  "贴身", "近身", "短距", "中距", "远距", "离场",
];

/**
 * Find the distance band between two actors from the state's distance relations.
 * Returns undefined if no relation is defined.
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
 * Target range strings in moves are free-form text like:
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
    return { valid: true }; // No range restriction
  }

  const range = targetRangeText.trim();

  // "贴身" or "近身" — these specific bands
  const bandsMentioned = DISTANCE_ORDER.filter((b) => range.includes(b));

  if (bandsMentioned.length > 0) {
    // Check if the actual band is in the mentioned set
    // "近身" usually means "近身 and closer" in fighting context
    // "中距" means "中距 and closer" for ranged attacks
    // But let's keep it simple: check exact match + "相邻" for adjacent
    if (bandsMentioned.includes(actualBand)) {
      return { valid: true };
    }

    // "相邻" means the next band closer or further
    if (range.includes("相邻")) {
      const actualIdx = DISTANCE_ORDER.indexOf(actualBand);
      for (const b of bandsMentioned) {
        const bandIdx = DISTANCE_ORDER.indexOf(b);
        if (Math.abs(actualIdx - bandIdx) <= 1) {
          return { valid: true };
        }
      }
    }

    return {
      valid: false,
      reason: `距离过远：当前${actualBand}，招式需要${bandsMentioned.join("、")}`,
    };
  }

  // "道路" "房间" "尸身周边" "机关痕迹" — scene-based targeting, always valid
  if (
    range.includes("道路") ||
    range.includes("房间") ||
    range.includes("尸身") ||
    range.includes("机关") ||
    range.includes("痕迹") ||
    range.includes("自己") ||
    range.includes("可及")
  ) {
    return { valid: true };
  }

  // "同一" — same actor
  if (range.includes("同一")) {
    return { valid: true };
  }

  // Default: if we can't parse, assume valid (let DM decide)
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
    distanceBand: band,
    isRangeValid: rangeCheck.valid,
    invalidReason: rangeCheck.reason,
  };
}

/**
 * Get a human-friendly tooltip for the target line.
 */
export function targetLineTooltip(
  fromName: string,
  toName: string,
  band: DistanceBand | undefined,
  moveName: string | undefined,
  isValid: boolean,
): string {
  const parts = [`${fromName} → ${toName}`];
  if (band) parts.push(`｜${band}`);
  if (moveName) parts.push(`｜${moveName}${isValid ? "可用" : "不可用"}`);
  if (!isValid) parts.push("｜距离不合法");
  return parts.join("");
}
