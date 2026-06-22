export type QiZone = "QI_POOL" | "QI_SEA" | "QI_LOCK" | "QI_REST" | "TEMP_QI";

export type QiNature = "yin" | "yang" | "neutral" | "raw";

export type ActorSide = "player" | "enemy" | "pressure";

export type CombatPhase =
  | "setup"
  | "initiative"
  | "scene"
  | "declare"
  | "intercept_window"
  | "react_window"
  | "outcome"
  | "round_end";

export type CombatEventType =
  | "ENTER_SCENE"
  | "DECLARE_ACTION"
  | "LOCK_QI"
  | "INTERCEPT"
  | "FORM_MOVE"
  | "REACT"
  | "APPLY_OUTCOME"
  | "REGULATE_BREATH"
  | "REFLECTION"
  | "EXPIRE_SOURCE"
  | "DM_OVERRIDE"
  | "USE_ITEM"
  | "EQUIP_ITEM"
  | "UNEQUIP_ITEM"
  | "ITEM_SOURCE_EXPIRED"
  | "TEMP_QI_GRANTED"
  | "MOMENTUM_CHANGED"
  | "ROUND_ENDED"
  | "mode_changed"
  | "phase_changed"
  | "dice_locked"
  | "skill_declared"
  | "target_selected"
  | "effect_rank_resolved"
  | "damage_applied"
  | "status_added"
  | "stance_changed"
  | "distance_changed"
  | "entangle_changed"
  | "source_expired"
  | "item_used"
  | "dm_override"
  | "dice_rolled"
  | "qi_entered_sea";

export type UserIdentity = "dm" | "player" | "spectator";

export interface RoomSettings {
  roomName: string;
  hostName: string;
  campaignId: string;
  mode: "local";
  allowSpectators: boolean;
  maxPlayers: number;
}

export interface AppSession {
  route:
    | "home"
    | "createRoom"
    | "joinRoom"
    | "roomWaiting"
    | "characterAssign"
    | "playerScene"
    | "playerCombat"
    | "dmScene"
    | "dmCombat"
    | "library"
    | "packs"
    | "settings"
    | "room"
    | "player"
    | "dm";
  identity?: UserIdentity;
  gameMode: "scene" | "combat";
  developerMode: boolean;
  roomCode: string;
  playerName: string;
  selectedActorId?: string;
  seats: Array<{
    id: string;
    label: string;
    playerName?: string;
    actorId?: string;
    ready: boolean;
  }>;
  room: RoomSettings;
}

export interface QiDie {
  id: string;
  label: string;
  sourceId: string;
  sourceName: string;
  nature: QiNature;
  sides: number;
  value: number | null;
  zone: QiZone;
  ownerId: string;
  temporary?: boolean;
}

export interface Stats {
  qiBlood: number;
  guard: number;
  burst: number;
  recovery: number;
  insight: number;
  movement: number;
}

export interface SixRoots {
  head: number;
  eyes: number;
  heart: number;
  dantian: number;
  waist: number;
  legs: number;
}

export interface ActiveNeigong {
  name: string;
  acupoint: "顶门" | "眼" | "心" | "丹田" | "腰" | "腿";
  passiveSummary: string;
}

export interface Move {
  id: string;
  name: string;
  actionType: "formal" | "quick" | "minor" | "scene";
  minDice: number;
  baseDamage?: number;
  trackDelta?: number;
  summary: string;
}

export interface ResponseMount {
  id: string;
  name: string;
  window: "intercept" | "react";
  minDice: number;
  summary: string;
  cancelsAction?: boolean;
  preventDamage?: number;
}

export type InventoryCategory = "equipment" | "medicine" | "tool" | "misc" | "temporary_source";

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  equipped?: boolean;
  sourceId?: string;
  grantsTempQi?: {
    nature: QiNature;
    sides: number;
    count: number;
  };
  expiresSourceId?: string;
  publicNote: string;
  dmNote?: string;
}

export interface InventoryEvent {
  itemId: string;
  actorId: string;
  eventType: "use" | "equip" | "unequip" | "expire_source";
  createdAt: number;
}

export interface Actor {
  id: string;
  name: string;
  side: ActorSide;
  momentum?: CombatState["momentum"];
  maxHp: number;
  hp: number;
  stats: Stats;
  sixRoots: SixRoots;
  activeNeigong?: ActiveNeigong;
  statuses: string[];
  publicStatuses?: string[];
  hiddenStatuses?: string[];
  moves: Move[];
  responses: ResponseMount[];
  inventory: InventoryItem[];
  inventoryEvents?: InventoryEvent[];
  publicWeakness?: string;
  hiddenGoal?: string;
  behaviorHint?: string;
  entryCondition?: string;
  lootOrClue?: string;
  publicNote: string;
  dmNote?: string;
}

export interface SceneTrack {
  id: string;
  name: string;
  value: number;
  max: number;
  hidden?: boolean;
  description: string;
}

export interface PendingAction {
  actorId: string;
  targetId: string;
  moveId: string;
  diceIds: string[];
  yinSlotDiceIds?: string[];
  yangSlotDiceIds?: string[];
  formed?: boolean;
  preventedDamage?: number;
}

export type DistanceBand = "贴身" | "近身" | "短距" | "中距" | "远距" | "离场";

export interface DistanceRelation {
  id: string;
  fromActorId: string;
  toActorId: string;
  band: DistanceBand;
  entangled?: boolean;
  public: boolean;
}

export interface CombatLogEntry {
  id: string;
  type: CombatEventType;
  round: number;
  message: string;
  public: boolean;
  createdAt: number;
}

export interface CombatState {
  campaignName: string;
  sceneName: string;
  sceneGoal: string;
  round: number;
  phase: CombatPhase;
  momentum: "阴盛" | "阳盛" | "合势" | "圆融" | "崩溃" | "失势";
  activeActorId: string;
  actors: Actor[];
  dice: QiDie[];
  tracks: SceneTrack[];
  distances: DistanceRelation[];
  pendingAction?: PendingAction;
  logs: CombatLogEntry[];
  lastSavedAt?: number;
}
