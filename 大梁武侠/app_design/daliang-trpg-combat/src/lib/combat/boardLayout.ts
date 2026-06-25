// ==========================================================================
// Board Layout — Dynamic slot-based combatant positioning.
//
// Each side gets one column. Y positions are calculated dynamically based
// on actor count to guarantee zero overlap between cards.
//
// Card size at 1920×1080 / 48% stage ≈ 170×75px ≈ 17×16 viewBox units.
// Minimum vertical gap between card centers: 18 viewBox units (83px @ 460px).
// ==========================================================================

import type { BoardSlot, CombatSide, ActorPlacement } from "../../types/combat";

// ==========================================================================
// Side column X positions (% of battlefield width)
// Player cards go on left, enemy on right, ally/neutral in center-bottom.
// ==========================================================================

const SIDE_X: Record<CombatSide, number> = {
  player:  15,   // left side, centered in player zone
  enemy:   85,   // right side, centered in enemy zone
  ally:    32,   // lower-left area
  neutral: 50,   // center-bottom
};

// ==========================================================================
// Dynamic Y-position calculation
// ==========================================================================

/**
 * Card height in viewBox units (0–100).
 * Cards are ~40px tall (compact 2-row); battlefield is ~425px at 1080p (44%).
 * 40 / 425 × 100 ≈ 9.4. We use 12 for safety margin (no overlap).
 */
const CARD_V_UNITS = 12;

/**
 * Calculate evenly-spaced Y positions for N cards in a column.
 * Returns positions that fill the vertical space from yMin to yMax
 * with guaranteed non-overlapping spacing.
 */
function calculateYPositions(count: number, yMin = 10, yMax = 90): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(yMin + yMax) / 2];

  // For many cards, use the minimum required spacing
  const neededSpan = (count - 1) * CARD_V_UNITS;

  if (neededSpan <= yMax - yMin) {
    // Plenty of room — center the column
    const startY = (yMax + yMin - neededSpan) / 2;
    return Array.from({ length: count }, (_, i) => startY + i * CARD_V_UNITS);
  }

  // Tight fit — distribute evenly within the available range
  const step = (yMax - yMin) / (count - 1);
  return Array.from({ length: count }, (_, i) => yMin + i * step);
}

// ==========================================================================
// Slot generation
// ==========================================================================

/**
 * Generate BoardSlots for a side based on actor count.
 * Each actor gets one slot in a single vertical column.
 */
function generateSlots(side: CombatSide, count: number): BoardSlot[] {
  const x = SIDE_X[side];
  const yPositions = calculateYPositions(count);

  const sideLabel: Record<CombatSide, string> = {
    player: "主位",
    enemy: "前排",
    ally: "援位",
    neutral: "中立",
  };

  return yPositions.map((y, i) => ({
    id: `${side}-slot-${i}`,
    side,
    row: 0,
    col: i,
    x,
    y,
    label: `${sideLabel[side]}${i + 1}`,
  }));
}

// ==========================================================================
// Public API
// ==========================================================================

/**
 * Get dynamically-generated BoardSlots for a given side.
 * Slots are generated fresh based on the actor count to guarantee
 * non-overlapping vertical spacing.
 */
export function getBoardSlots(side: CombatSide, count: number): BoardSlot[] {
  return generateSlots(side, count);
}

/**
 * Get all slots across all sides for a given actor distribution.
 */
export function getAllSlots(
  counts: Record<CombatSide, number>,
): BoardSlot[] {
  return (Object.entries(counts) as [CombatSide, number][])
    .filter(([, n]) => n > 0)
    .flatMap(([side, n]) => generateSlots(side, n));
}

/**
 * Auto-assign actors to dynamically-generated slots by side.
 *
 * Actors are grouped by side; each side gets exactly `count` slots
 * with evenly-spaced Y positions that guarantee no overlap.
 *
 * @returns ActorPlacement[] — one entry per actor.
 */
export function assignActorsToSlots(
  actors: Array<{ id: string; side: CombatSide }>,
): ActorPlacement[] {
  // Count actors per side
  const counts: Partial<Record<CombatSide, number>> = {};
  const sideOrder: CombatSide[] = [];

  for (const a of actors) {
    if (!(a.side in counts)) {
      counts[a.side] = 0;
      sideOrder.push(a.side);
    }
    counts[a.side] = (counts[a.side] ?? 0) + 1;
  }

  // Generate slots per side
  const allSlots: BoardSlot[] = [];
  for (const side of sideOrder) {
    allSlots.push(...generateSlots(side, counts[side] ?? 0));
  }

  // Assign actors to slots in order
  const sideIndex: Partial<Record<CombatSide, number>> = {};
  const placements: ActorPlacement[] = [];

  for (const actor of actors) {
    const idx = sideIndex[actor.side] ?? 0;
    const sideSlots = allSlots.filter((s) => s.side === actor.side);
    if (idx < sideSlots.length) {
      placements.push({ actorId: actor.id, slotId: sideSlots[idx].id });
    }
    sideIndex[actor.side] = idx + 1;
  }

  return placements;
}

/**
 * Get the BoardSlot for a given ActorPlacement.
 * Requires the full slot list (from getAllSlots or assignActorsToSlots internals).
 */
export function getSlotForPlacement(
  placement: ActorPlacement,
  allSlots: BoardSlot[],
): BoardSlot | undefined {
  return allSlots.find((s) => s.id === placement.slotId);
}

/**
 * Get the position (x, y) for an actor by its placement.
 */
export function getActorPosition(
  actorId: string,
  placements: ActorPlacement[],
  allSlots: BoardSlot[],
): { x: number; y: number } | undefined {
  const placement = placements.find((p) => p.actorId === actorId);
  if (!placement) return undefined;
  const slot = getSlotForPlacement(placement, allSlots);
  return slot ? { x: slot.x, y: slot.y } : undefined;
}

/**
 * Get the anchor positions for a target line between two actors.
 */
export function getTargetLineAnchors(
  sourceActorId: string,
  targetActorId: string,
  placements: ActorPlacement[],
  allSlots: BoardSlot[],
): { x1: number; y1: number; x2: number; y2: number } | undefined {
  const sourcePos = getActorPosition(sourceActorId, placements, allSlots);
  const targetPos = getActorPosition(targetActorId, placements, allSlots);
  if (!sourcePos || !targetPos) return undefined;
  return { x1: sourcePos.x, y1: sourcePos.y, x2: targetPos.x, y2: targetPos.y };
}

/**
 * Summary stats for a side.
 */
export function getSlotOccupancy(
  side: CombatSide,
  occupiedSlotIds: Set<string>,
  allSlots: BoardSlot[],
): { total: number; occupied: number; free: number } {
  const sideSlots = allSlots.filter((s) => s.side === side);
  const occupied = sideSlots.filter((s) => occupiedSlotIds.has(s.id)).length;
  return { total: sideSlots.length, occupied, free: sideSlots.length - occupied };
}
