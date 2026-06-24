// ==========================================================================
// Mock Combat Data — Tactical Stage Adapter
// Converts existing CombatState / Actor data into StageData for the
// new HTML/SVG tactical stage component.
//
// Refactored (2025-06): Slot-based positioning replaces hardcoded x/y.
// Actors are auto-assigned to predefined BoardSlots by side.
// ==========================================================================

import type { Actor, CombatState, DistanceRelation } from "../combat/types";
import type { ActorPlacement, Combatant, CombatSide, DistanceEdge, SceneObjective, StageData } from "../types/combat";
import {
  assignActorsToSlots,
  getSlotForPlacement,
} from "../lib/combat/boardLayout";

/** Default scene tags for the bridge-rain campaign */
const DEFAULT_SCENE_TAGS = ["雨夜", "仓门", "堤岸", "货堆"];

// ==========================================================================
// Side normalization
// ==========================================================================

/** Map Actor.side → CombatSide ("pressure" falls to "enemy") */
function normalizeSide(side: Actor["side"]): CombatSide {
  if (side === "pressure") return "enemy";
  if (side === "player") return "player";
  return "enemy";
}

// ==========================================================================
// Slot-based actor → Combatant conversion
// ==========================================================================

/** Map an Actor's statuses to a string array (public names only) */
function mapStatuses(actor: Actor): string[] {
  return actor.statuses
    .filter((s) => s.public)
    .map((s) => s.name);
}

/**
 * Convert a list of Actors to Combatants using slot-based positioning.
 *
 * Actors are grouped by side, then auto-assigned to the first available
 * BoardSlot on their side. If a side runs out of slots, actors overflow
 * with a fallback position (stacked at the last slot + offset).
 */
export function actorsToCombatants(actors: Actor[]): Combatant[] {
  // Group actors by normalized side
  const actorsBySide = new Map<CombatSide, Actor[]>();
  for (const a of actors) {
    const side = normalizeSide(a.side);
    if (!actorsBySide.has(side)) actorsBySide.set(side, []);
    actorsBySide.get(side)!.push(a);
  }

  // Assign slots side by side
  const allPlacements: ActorPlacement[] = [];
  for (const [side, sideActors] of actorsBySide) {
    const actorIds = sideActors.map((a) => ({ id: a.id, side }));
    const placements = assignActorsToSlots(actorIds);
    allPlacements.push(...placements);
  }

  // Map actors to combatants with slot positions
  const placementMap = new Map(allPlacements.map((p) => [p.actorId, p]));

  return actors.map((actor) => {
    const placement = placementMap.get(actor.id);
    let x: number;
    let y: number;
    let slotId: string | undefined;

    if (placement) {
      const slot = getSlotForPlacement(placement);
      if (slot) {
        x = slot.x;
        y = slot.y;
        slotId = slot.id;
      } else {
        // Fallback: should not happen
        x = 50;
        y = 50;
      }
    } else {
      // No slot available — stack at bottom of side with offset
      const side = normalizeSide(actor.side);
      x = side === "player" ? 6 : side === "enemy" ? 94 : 50;
      y = 88;
    }

    return {
      id: actor.id,
      name: actor.name,
      side: normalizeSide(actor.side),
      hp: actor.hp,
      maxHp: actor.maxHp,
      momentum: actor.momentum,
      statuses: mapStatuses(actor),
      x,
      y,
      slotId,
    };
  });
}

/** Map DistanceRelation[] to DistanceEdge[] */
export function distancesToEdges(distances: DistanceRelation[]): DistanceEdge[] {
  return distances
    .filter((d) => d.public !== false)
    .map((d) => ({
      from: d.fromActorId,
      to: d.toActorId,
      band: d.band,
    }));
}

/** Map SceneTrack[] to SceneObjective[] */
export function tracksToObjectives(
  tracks: CombatState["tracks"],
): SceneObjective[] {
  return tracks
    .filter((t) => !t.hidden)
    .map((t) => ({
      id: t.id,
      title: t.name,
      current: t.value,
      target: t.max,
    }));
}

/**
 * Build full StageData from a CombatState.
 * Uses slot-based positioning via actorsToCombatants().
 */
export function buildStageData(state: CombatState): StageData {
  return {
    sceneName: state.sceneName,
    sceneTags: DEFAULT_SCENE_TAGS,
    combatants: actorsToCombatants(state.actors),
    distances: distancesToEdges(state.distances),
    objectives: tracksToObjectives(state.tracks),
  };
}

// ==========================================================================
// Static mock data for standalone development / testing
// Positions use the same slot grid as the runtime system.
// ==========================================================================

export const MOCK_STAGE_DATA: StageData = {
  sceneName: "旧堤仓",
  sceneTags: ["雨夜", "仓门", "堤岸", "货堆"],
  combatants: [
    // ---- Player side (left, slots: player-main-*) ----
    {
      id: "pc-shen-qing",
      name: "沈青",
      side: "player",
      hp: 32,
      maxHp: 40,
      momentum: "阴盛",
      statuses: [],
      x: 14,  // player-main-0
      y: 28,
      slotId: "player-main-0",
    },
    {
      id: "pc-wei",
      name: "魏长兴",
      side: "player",
      hp: 38,
      maxHp: 45,
      momentum: "阳盛",
      statuses: [],
      x: 14,  // player-main-1
      y: 50,
      slotId: "player-main-1",
    },
    // ---- Enemy side (right, slots: enemy-front-*) ----
    {
      id: "enemy-short-blade",
      name: "短兵客",
      side: "enemy",
      hp: 28,
      maxHp: 45,
      momentum: "阳盛",
      statuses: ["破口"],
      x: 86,  // enemy-front-0
      y: 20,
      slotId: "enemy-front-0",
    },
    {
      id: "enemy-porter",
      name: "黑衣脚夫",
      side: "enemy",
      hp: 20,
      maxHp: 30,
      momentum: "失势",
      statuses: ["流血"],
      x: 86,  // enemy-front-1
      y: 38,
      slotId: "enemy-front-1",
    },
    {
      id: "enemy-lookout",
      name: "望风探子",
      side: "enemy",
      hp: 24,
      maxHp: 35,
      momentum: "阴盛",
      statuses: ["迟滞"],
      x: 86,  // enemy-front-2
      y: 56,
      slotId: "enemy-front-2",
    },
    {
      id: "enemy-archer",
      name: "暗处弓手",
      side: "enemy",
      hp: 18,
      maxHp: 25,
      momentum: "合势",
      statuses: [],
      x: 86,  // enemy-front-3
      y: 74,
      slotId: "enemy-front-3",
    },
  ],
  distances: [
    { from: "pc-shen-qing", to: "enemy-short-blade", band: "近身" },
    { from: "pc-shen-qing", to: "enemy-porter", band: "中距" },
    { from: "pc-shen-qing", to: "enemy-lookout", band: "中距" },
    { from: "pc-shen-qing", to: "enemy-archer", band: "远距" },
    { from: "pc-wei", to: "enemy-short-blade", band: "中距" },
    { from: "pc-wei", to: "enemy-porter", band: "近身" },
    { from: "pc-wei", to: "enemy-lookout", band: "中距" },
    { from: "pc-wei", to: "enemy-archer", band: "远距" },
  ],
  objectives: [
    { id: "obj-blood-chest", title: "找到血镖箱", current: 1, target: 3 },
  ],
};
