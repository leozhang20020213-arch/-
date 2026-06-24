// ==========================================================================
// Mock Combat Data — Tactical Stage Adapter
// Converts existing CombatState / Actor data into StageData for the
// new HTML/SVG tactical stage component.
// ==========================================================================

import type { Actor, CombatState, DistanceRelation } from "../combat/types";
import type { Combatant, DistanceEdge, SceneObjective, StageData } from "../types/combat";

/** Default scene tags for the bridge-rain campaign */
const DEFAULT_SCENE_TAGS = ["雨夜", "仓门", "堤岸", "货堆"];

/**
 * Position presets for combatants on the tactical stage.
 * Players cluster on the left side, enemies on the right.
 * With horizontal cards (~170px), up to 5 combatants can fit per side
 * without overlapping when spread across y: 15%–85%.
 */
function positionFor(index: number, total: number, side: "player" | "enemy" | "neutral"): { x: number; y: number } {
  // Distribute vertically to fit up to 5 cards without overlap
  const yMin = 18;
  const yMax = 82;
  const step = total > 1 ? (yMax - yMin) / (total - 1) : 0;
  const y = total === 1 ? 50 : yMin + index * step;

  switch (side) {
    case "player":
      // Players on left side, spread slightly for readability
      return { x: 12 + (index % 3) * 6, y };
    case "enemy":
      // Enemies on right side, spread slightly
      return { x: 80 + (index % 3) * 6, y };
    case "neutral":
      return { x: 45 + index * 5, y };
  }
}

/** Map an Actor's statuses to a string array (public names only) */
function mapStatuses(actor: Actor): string[] {
  return actor.statuses
    .filter((s) => s.public)
    .map((s) => s.name);
}

/** Map Actor.side → Combatant.side ("pressure" falls to "enemy") */
function normalizeSide(side: Actor["side"]): Combatant["side"] {
  if (side === "pressure") return "enemy";
  return side as Combatant["side"];
}

/** Map a single Actor to a Combatant */
export function actorToCombatant(actor: Actor, index: number, total: number): Combatant {
  const pos = positionFor(index, total, normalizeSide(actor.side));
  return {
    id: actor.id,
    name: actor.name,
    side: normalizeSide(actor.side),
    hp: actor.hp,
    maxHp: actor.maxHp,
    momentum: actor.momentum,
    statuses: mapStatuses(actor),
    x: pos.x,
    y: pos.y,
  };
}

/** Map an array of Actors to Combatants with side-grouped positioning */
export function actorsToCombatants(actors: Actor[]): Combatant[] {
  const players = actors.filter((a) => a.side === "player");
  const enemies = actors.filter((a) => a.side === "enemy" || a.side === "pressure");

  return [
    ...players.map((a, i) => actorToCombatant(a, i, players.length)),
    ...enemies.map((a, i) => actorToCombatant(a, i, enemies.length)),
  ];
}

/** Map DistanceRelation[] to DistanceEdge[] */
export function distancesToEdges(distances: DistanceRelation[]): DistanceEdge[] {
  return distances
    .filter((d) => d.public !== false) // keep public + undefined (default public)
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
 * This is the primary adapter — call it from your combat desk.
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

/**
 * Static mock data for standalone development / testing
 * without a running CombatState.
 */
export const MOCK_STAGE_DATA: StageData = {
  sceneName: "旧堤仓",
  sceneTags: ["雨夜", "仓门", "堤岸", "货堆"],
  combatants: [
    {
      id: "pc-shen-qing",
      name: "沈青",
      side: "player",
      hp: 32,
      maxHp: 40,
      momentum: "阴盛",
      statuses: [],
      x: 12,
      y: 35,
    },
    {
      id: "pc-wei",
      name: "魏长兴",
      side: "player",
      hp: 38,
      maxHp: 45,
      momentum: "阳盛",
      statuses: [],
      x: 18,
      y: 65,
    },
    {
      id: "enemy-short-blade",
      name: "短兵客",
      side: "enemy",
      hp: 28,
      maxHp: 45,
      momentum: "阳盛",
      statuses: ["破口"],
      x: 80,
      y: 18,
    },
    {
      id: "enemy-porter",
      name: "黑衣脚夫",
      side: "enemy",
      hp: 20,
      maxHp: 30,
      momentum: "失势",
      statuses: ["流血"],
      x: 86,
      y: 42,
    },
    {
      id: "enemy-lookout",
      name: "望风探子",
      side: "enemy",
      hp: 24,
      maxHp: 35,
      momentum: "阴盛",
      statuses: ["迟滞"],
      x: 83,
      y: 66,
    },
    {
      id: "enemy-archer",
      name: "暗处弓手",
      side: "enemy",
      hp: 18,
      maxHp: 25,
      momentum: "合势",
      statuses: [],
      x: 89,
      y: 84,
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
