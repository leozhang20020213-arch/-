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

/** Combat side for slot assignment */
export type CombatSide = "player" | "enemy" | "ally" | "neutral";

/** A board slot — a predefined anchor position on the tactical stage */
export interface BoardSlot {
  id: string;
  side: CombatSide;
  /** Row index (0 = front row) */
  row: number;
  /** Column index (0 = leftmost) */
  col: number;
  /** X position on stage (0–100 percentage) */
  x: number;
  /** Y position on stage (0–100 percentage) */
  y: number;
  /** Slot label (e.g. "主位1", "前排3") */
  label: string;
}

/** Maps an actor to a board slot */
export interface ActorPlacement {
  actorId: string;
  slotId: string;
}

/** A combatant node rendered on the tactical stage */
export interface Combatant {
  id: string;
  name: string;
  side: CombatSide;
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
  /** ID of the BoardSlot this combatant occupies (for layout tracking) */
  slotId?: string;
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

// ==========================================================================
// Enemy Public Info — shown in right panel when an enemy is selected
// ==========================================================================

/** Application mode (drives visibility of DM-only fields) */
export type AppMode = "player" | "dm";

/** Public-facing enemy info shown when a combatant node is clicked */
export interface EnemyPublicInfo {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  momentum: string;
  statuses: string[];
  /** Flavor / scene description */
  description: string;
  /** Public weaknesses (short bullet list) */
  publicWeaknesses: string[];
  /** General behavior tendency (short text) */
  behaviorHint: string;
  /** Known moves (names only) */
  knownMoves: string[];
  /** DM-only: hidden goal */
  hiddenGoal?: string;
  /** DM-only: hidden statuses */
  hiddenStatuses?: string[];
  /** DM-only: loot or clue on defeat */
  lootOrClue?: string;
  /** DM-only: private note */
  dmNote?: string;
}
