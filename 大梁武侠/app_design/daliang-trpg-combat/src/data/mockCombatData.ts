// ==========================================================================
// Mock Combat Data — Tactical Stage Adapter
// Converts existing CombatState / Actor data into StageData.
//
// Uses dynamic slot-based positioning: actors are auto-assigned to
// single-column slots whose Y positions are calculated from actor count
// to guarantee zero overlap between cards.
// ==========================================================================

import type { Actor, CombatState, DistanceRelation } from "../combat/types";
import type { Combatant, CombatSide, DistanceEdge, SceneObjective, StageData } from "../types/combat";
import { assignActorsToSlots, getAllSlots } from "../lib/combat/boardLayout";

function sceneTags(state: CombatState): string[] {
  const elementTags = state.scene.elements
    .filter((element) => element.public)
    .map((element) => element.name.trim())
    .filter(Boolean);
  const tags = [state.scene.timeWindow.trim(), ...elementTags]
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, 4);
  return tags.length > 0 ? tags : state.tracks.filter((track) => !track.hidden).slice(0, 4).map((track) => track.name);
}

// ==========================================================================
// Side normalization
// ==========================================================================

function normalizeSide(side: Actor["side"]): CombatSide {
  if (side === "pressure") return "enemy";
  if (side === "player") return "player";
  return "enemy";
}

function mapStatuses(actor: Actor): string[] {
  return actor.statuses.filter((s) => s.public).map((s) => s.name);
}

// ==========================================================================
// Actor → Combatant (slot-based, dynamic spacing)
// ==========================================================================

export function actorsToCombatants(actors: Actor[]): Combatant[] {
  // Build actor list with normalized sides
  const entries = actors.map((a) => ({ id: a.id, side: normalizeSide(a.side) }));

  // Side-grouped counts determine Y spacing
  const counts: Partial<Record<CombatSide, number>> = {};
  for (const e of entries) {
    counts[e.side] = (counts[e.side] ?? 0) + 1;
  }

  // Generate all slots from the final counts
  const allSlots = getAllSlots(counts as Record<CombatSide, number>);

  // Assign actors to slots
  const placements = assignActorsToSlots(entries);
  const placementMap = new Map(placements.map((p) => [p.actorId, p]));
  const slotMap = new Map(allSlots.map((s) => [s.id, s]));

  return actors.map((actor) => {
    const placement = placementMap.get(actor.id);
    const slot = placement ? slotMap.get(placement.slotId) : undefined;
    return {
      id: actor.id,
      name: actor.name,
      side: normalizeSide(actor.side),
      hp: actor.hp,
      maxHp: actor.maxHp,
      momentum: actor.momentum,
      statuses: mapStatuses(actor),
      x: slot?.x ?? 50,
      y: slot?.y ?? 50,
      slotId: slot?.id,
    };
  });
}

// ==========================================================================
// Distance / Objective mappers
// ==========================================================================

export function distancesToEdges(distances: DistanceRelation[]): DistanceEdge[] {
  return distances
    .filter((d) => d.public !== false)
    .map((d) => ({ from: d.fromActorId, to: d.toActorId, band: d.band }));
}

export function tracksToObjectives(tracks: CombatState["tracks"]): SceneObjective[] {
  return tracks
    .filter((t) => !t.hidden)
    .map((t) => ({ id: t.id, title: t.name, current: t.value, target: t.max }));
}

export function buildStageData(state: CombatState): StageData {
  const activeActorIds = new Set(state.campaign.activeActorIds);
  const actors = state.encounterMode === "combat" && activeActorIds.size > 0
    ? state.actors.filter((actor) => activeActorIds.has(actor.id))
    : state.actors;
  const actorIdSet = new Set(actors.map((actor) => actor.id));
  return {
    sceneName: state.sceneName,
    sceneTags: sceneTags(state),
    combatants: actorsToCombatants(actors),
    distances: distancesToEdges(state.distances.filter((relation) => actorIdSet.has(relation.fromActorId) && actorIdSet.has(relation.toActorId))),
    objectives: tracksToObjectives(state.tracks),
  };
}

// ==========================================================================
// Static mock data (positions match dynamic slot calculation)
// ==========================================================================

export const MOCK_STAGE_DATA: StageData = {
  sceneName: "旧船棚",
  sceneTags: ["夜雨", "旧船棚", "水门", "药匣"],
  combatants: [
    // Player side — 2 actors → y=[44, 56] (CARD_V_UNITS=12)
    {
      id: "pc-shen-qing", name: "沈青", side: "player",
      hp: 32, maxHp: 40, momentum: "阴盛", statuses: [],
      x: 15, y: 44, slotId: "player-slot-0",
    },
    {
      id: "pc-wei", name: "魏长兴", side: "player",
      hp: 38, maxHp: 45, momentum: "阳盛", statuses: [],
      x: 15, y: 56, slotId: "player-slot-1",
    },
    // Enemy side — 4 actors → y=[32, 44, 56, 68]
    {
      id: "enemy-short-blade", name: "短兵客", side: "enemy",
      hp: 28, maxHp: 45, momentum: "阳盛", statuses: ["破口"],
      x: 85, y: 32, slotId: "enemy-slot-0",
    },
    {
      id: "enemy-porter", name: "黑衣脚夫", side: "enemy",
      hp: 20, maxHp: 30, momentum: "失势", statuses: ["流血"],
      x: 85, y: 44, slotId: "enemy-slot-1",
    },
    {
      id: "enemy-lookout", name: "望风探子", side: "enemy",
      hp: 24, maxHp: 35, momentum: "阴盛", statuses: ["迟滞"],
      x: 85, y: 56, slotId: "enemy-slot-2",
    },
    {
      id: "enemy-archer", name: "暗处弓手", side: "enemy",
      hp: 18, maxHp: 25, momentum: "合势", statuses: [],
      x: 85, y: 68, slotId: "enemy-slot-3",
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
    { id: "obj-medicine-case", title: "保住失匣", current: 1, target: 3 },
  ],
};
