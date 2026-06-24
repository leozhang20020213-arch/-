// ==========================================================================
// Combat Stage Display Types — Daliang TRPG
// Lightweight types for the tactical combat stage (HTML/SVG).
// Distinct from src/combat/types.ts which holds the rule-engine types.
// ==========================================================================

/** Distance band between two combatants */
export type DistanceBand = "贴身" | "近身" | "短距" | "中距" | "远距" | "离场";

/** Momentum / Shi face shown on combatant node */
export type MomentumFace =
  | "阴盛"
  | "阳盛"
  | "合势"
  | "圆融"
  | "崩势"
  | "失势";

/** A combatant node rendered on the tactical stage */
export interface Combatant {
  id: string;
  name: string;
  side: "player" | "enemy" | "neutral";
  hp: number;
  maxHp: number;
  momentum: MomentumFace;
  statuses: string[];
  /** Optional avatar icon path */
  avatar?: string;
  /** X position on stage (0–100 percentage) */
  x: number;
  /** Y position on stage (0–100 percentage) */
  y: number;
}

/** A distance edge connecting two combatants */
export interface DistanceEdge {
  from: string; // combatant id
  to: string;   // combatant id
  band: DistanceBand;
}

/** A scene objective / progress track shown on the stage */
export interface SceneObjective {
  id: string;
  title: string;
  current: number;
  target: number;
}

/** Full tactical stage data for one scene */
export interface StageData {
  sceneName: string;
  sceneTags: string[];
  combatants: Combatant[];
  distances: DistanceEdge[];
  objectives: SceneObjective[];
  selectedCombatantId?: string;
}
