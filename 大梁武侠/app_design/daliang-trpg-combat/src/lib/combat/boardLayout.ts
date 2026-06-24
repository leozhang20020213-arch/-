// ==========================================================================
// Board Layout — Slot-based combatant positioning for the tactical stage.
//
// Each side (player / enemy / ally / neutral) has a predefined grid of
// BoardSlots. Actors are assigned to the first available slot for their side.
// New actors automatically fill the next empty slot — no hardcoded positions.
// ==========================================================================

import type { BoardSlot, CombatSide, ActorPlacement } from "../../types/combat";

// ==========================================================================
// Slot Definitions
// ==========================================================================

/**
 * Player side slots (left side of battlefield).
 *
 * Layout:
 *   主位 (Main) — front row, 3 columns
 *   后位 (Rear)  — back row, 2 columns
 */
const PLAYER_SLOTS: BoardSlot[] = [
  // Front row — 主位
  { id: "player-main-0", side: "player", row: 0, col: 0, x: 14, y: 28, label: "主位1" },
  { id: "player-main-1", side: "player", row: 0, col: 1, x: 14, y: 50, label: "主位2" },
  { id: "player-main-2", side: "player", row: 0, col: 2, x: 14, y: 72, label: "主位3" },
  // Back row — 后位
  { id: "player-rear-0", side: "player", row: 1, col: 0, x: 6,  y: 39, label: "后位1" },
  { id: "player-rear-1", side: "player", row: 1, col: 1, x: 6,  y: 61, label: "后位2" },
];

/**
 * Enemy side slots (right side of battlefield).
 *
 * Layout:
 *   前排 (Front) — up to 4 columns
 *   后排 (Rear)  — up to 3 columns
 */
const ENEMY_SLOTS: BoardSlot[] = [
  // Front row — 前排
  { id: "enemy-front-0", side: "enemy", row: 0, col: 0, x: 86, y: 20, label: "前排1" },
  { id: "enemy-front-1", side: "enemy", row: 0, col: 1, x: 86, y: 38, label: "前排2" },
  { id: "enemy-front-2", side: "enemy", row: 0, col: 2, x: 86, y: 56, label: "前排3" },
  { id: "enemy-front-3", side: "enemy", row: 0, col: 3, x: 86, y: 74, label: "前排4" },
  // Back row — 后排
  { id: "enemy-rear-0", side: "enemy", row: 1, col: 0, x: 94, y: 29, label: "后排1" },
  { id: "enemy-rear-1", side: "enemy", row: 1, col: 1, x: 94, y: 50, label: "后排2" },
  { id: "enemy-rear-2", side: "enemy", row: 1, col: 2, x: 94, y: 71, label: "后排3" },
];

/**
 * Ally / support side slots (lower-left area, behind player).
 */
const ALLY_SLOTS: BoardSlot[] = [
  { id: "ally-0", side: "ally", row: 2, col: 0, x: 32, y: 78, label: "援位1" },
  { id: "ally-1", side: "ally", row: 2, col: 1, x: 32, y: 88, label: "援位2" },
];

/**
 * Neutral / special object slots (center-bottom area).
 */
const NEUTRAL_SLOTS: BoardSlot[] = [
  { id: "neutral-0", side: "neutral", row: 2, col: 0, x: 50, y: 84, label: "中立1" },
  { id: "neutral-1", side: "neutral", row: 2, col: 1, x: 62, y: 84, label: "中立2" },
];

/** All slots indexed by side */
const SLOTS_BY_SIDE: Record<CombatSide, BoardSlot[]> = {
  player: PLAYER_SLOTS,
  enemy: ENEMY_SLOTS,
  ally: ALLY_SLOTS,
  neutral: NEUTRAL_SLOTS,
};

// ==========================================================================
// Public API
// ==========================================================================

/**
 * Get all predefined BoardSlots for a given side.
 * Slots are returned in priority order (front row first, then rear).
 */
export function getBoardSlotsBySide(side: CombatSide): BoardSlot[] {
  return SLOTS_BY_SIDE[side] ?? [];
}

/**
 * Get all slots across all sides.
 */
export function getAllSlots(): BoardSlot[] {
  return [
    ...PLAYER_SLOTS,
    ...ENEMY_SLOTS,
    ...ALLY_SLOTS,
    ...NEUTRAL_SLOTS,
  ];
}

/**
 * Auto-assign actors to slots by side.
 *
 * For each actor, finds the first unoccupied slot on their side.
 * Actors are assigned in the order they appear in the input array.
 *
 * @returns Array of ActorPlacement (actorId → slotId) for successfully placed actors.
 *          Actors that can't be placed (no free slot) are omitted.
 */
export function assignActorsToSlots(
  actorIds: Array<{ id: string; side: CombatSide }>,
  occupiedSlotIds?: Set<string>,
): ActorPlacement[] {
  const occupied = new Set(occupiedSlotIds ?? []);
  const placements: ActorPlacement[] = [];

  for (const actor of actorIds) {
    const slots = getBoardSlotsBySide(actor.side);
    const freeSlot = slots.find((s) => !occupied.has(s.id));
    if (freeSlot) {
      occupied.add(freeSlot.id);
      placements.push({ actorId: actor.id, slotId: freeSlot.id });
    }
  }

  return placements;
}

/**
 * Get the BoardSlot for a given ActorPlacement.
 */
export function getSlotForPlacement(
  placement: ActorPlacement,
): BoardSlot | undefined {
  return getAllSlots().find((s) => s.id === placement.slotId);
}

/**
 * Get the position (x, y) for an actor by its placement.
 */
export function getActorPosition(
  actorId: string,
  placements: ActorPlacement[],
): { x: number; y: number } | undefined {
  const placement = placements.find((p) => p.actorId === actorId);
  if (!placement) return undefined;
  const slot = getSlotForPlacement(placement);
  return slot ? { x: slot.x, y: slot.y } : undefined;
}

/**
 * Get the anchor positions for a target line between two actors.
 */
export function getTargetLineAnchors(
  sourceActorId: string,
  targetActorId: string,
  placements: ActorPlacement[],
): { x1: number; y1: number; x2: number; y2: number } | undefined {
  const sourcePos = getActorPosition(sourceActorId, placements);
  const targetPos = getActorPosition(targetActorId, placements);
  if (!sourcePos || !targetPos) return undefined;
  return { x1: sourcePos.x, y1: sourcePos.y, x2: targetPos.x, y2: targetPos.y };
}

/**
 * Summary stats for a side — how many slots are occupied vs available.
 */
export function getSlotOccupancy(
  side: CombatSide,
  occupiedSlotIds: Set<string>,
): { total: number; occupied: number; free: number } {
  const slots = getBoardSlotsBySide(side);
  const occupied = slots.filter((s) => occupiedSlotIds.has(s.id)).length;
  return { total: slots.length, occupied, free: slots.length - occupied };
}
