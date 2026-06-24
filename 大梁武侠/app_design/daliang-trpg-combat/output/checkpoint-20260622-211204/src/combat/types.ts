// === Qi System (7 zones matching rulebook 气骰七区) ===
export type QiZone = "QI_POOL" | "QI_SEA" | "QI_LOCK" | "QI_REST" | "TEMP_QI" | "YIN_SLOT" | "YANG_SLOT";
// 气池 | 气海 | 锁气 | 息库 | 临气区 | 阴槽 | 阳槽

export type QiNature = "yin" | "yang" | "raw";
// 阴 | 阳 | 原始 (原始可入任意槽，但在"至少1阴+1阳"门槛中只满足一侧)

// === Event Types (kept for backward compat; canonical definition in schema.ts) ===
export type CombatEventType =
  | "ENTER_SCENE" | "DECLARE_ACTION" | "LOCK_QI" | "INTERCEPT" | "FORM_MOVE"
  | "REACT" | "APPLY_OUTCOME" | "REGULATE_BREATH" | "REFLECTION" | "EXPIRE_SOURCE"
  | "DM_OVERRIDE" | "USE_ITEM" | "EQUIP_ITEM" | "UNEQUIP_ITEM" | "ITEM_SOURCE_EXPIRED"
  | "TEMP_QI_GRANTED" | "MOMENTUM_CHANGED" | "ROUND_ENDED"
  | "mode_changed" | "phase_changed" | "dice_locked" | "skill_declared" | "target_selected"
  | "effect_rank_resolved" | "damage_applied" | "status_added" | "stance_changed"
  | "distance_changed" | "entangle_changed" | "source_expired" | "item_used"
  | "dm_override" | "dice_rolled" | "qi_entered_sea";

export interface QiDie {
  id: string;
  label: string;           // e.g. "d6"
  sourceId: string;        // 来源追溯
  sourceName: string;      // 来源名称
  nature: QiNature;
  sides: number;           // 骰阶 (4/6/8/10/12/20)
  value: number | null;    // 当前点数
  zone: QiZone;
  ownerId: string;
  temporary?: boolean;     // 临时骰
}

// === Six Roots (六根) ===
export type SixRootName = "顶门" | "目窍" | "心口" | "丹田" | "命门" | "步根";

export interface SixRoots {
  顶门: number;  // 1-9
  目窍: number;
  心口: number;
  丹田: number;
  命门: number;
  步根: number;
}

// === Table Attributes (表属性) ===
export type TableAttrName = "气血" | "护体" | "爆发" | "回气" | "观照" | "身势";

export interface TableAttrs {
  气血: number;   // HP, reaches 0 = 濒死
  护体: number;   // Damage reduction/protection
  爆发: number;   // Burst damage modifier
  回气: number;   // Qi recovery efficiency
  观照: number;   // Perception/initiative
  身势: number;   // Movement/initiative
}

// === Inner Art (内功盘) ===
export type InnerArtTier = "俗家" | "行家" | "神功" | "禁功";
export type AcupointName = "顶门" | "目窍" | "心口" | "丹田" | "命门" | "步根";

export interface InnerArt {
  id: string;
  name: string;
  tier: InnerArtTier;
  occupiedAcupoints: AcupointName[];  // 占窍
  readRoots: SixRootName[];           // 读取六根组
  currentLevel: number;               // 当前重数
  maxLevel: number;                   // 重数上限
  attrContributions: AttrContribution[];  // 表属性运算
  qiGeneration: QiGeneration[];       // 取气运算
  passive: string;                    // 被动
  disperseRules: string;              // 散功处理
  parallelRestriction?: string;       // 并行限制
}

export interface AttrContribution {
  level: number;
  root: SixRootName;
  targetAttr: TableAttrName;
  multiplier: number;   // 乘数
  bonus: number;        // 加值
  // result = rootValue × multiplier + bonus
}

export interface QiGeneration {
  level: number;
  root: SixRootName;
  nature: QiNature;
  multiplier: number;
  bonus: number;
  diceSides: number;    // 产出骰阶
  diceCount: number;    // 产出数量
}

// === Shi State Machine (势) ===
export type ShiState = "阴盛" | "阳盛" | "合势" | "圆融" | "崩势" | "失势";
export type ShiCondition = "无势" | "宽势" | "中势" | "单势";

// 崩势规则: 本轮不能声明正式出手和强响应; 不能护人/承接; 目标线全开放
// 下轮开始时未濒死→自动转入失势; 已濒死→保持崩势

// === Slot Values (槽值) ===
export interface SlotValues {
  阴值: number;    // sum of YIN_SLOT dice values
  阳值: number;    // sum of YANG_SLOT dice values
  合值: number;    // 阴值 + 阳值
  阴阳差: number;  // |阴值 - 阳值|
}

// === Move System (招式) ===
export type MoveCategory = "外功" | "法门" | "便行";
export type MoveSubCategory = "主攻" | "身法" | "护人" | "拆招" | "查探" | "交涉" | "医药" | "行气" | "读谱" | "机关" | "隐匿" | "整备" | "";
export type FormPosition = "起式" | "承式" | "转式" | "收式" | "绝式" | "无";
export type MoveTiming = "正式出手" | "出手便行" | "随手便行" | "截击" | "应招" | "整备/情景";

export interface MoveTrigger {
  type: "主槽" | "合值" | "差值/风险";   // 触发类型
  condition: string;                      // e.g. "阳值≥7"
  effect: string;                         // e.g. "追加气血3点"
  readsTableAttr?: boolean;               // 是否读取表属性
  tableAttr?: TableAttrName;
}

export interface Move {
  id: string;
  name: string;
  category: MoveCategory;
  subCategory: MoveSubCategory;
  tier: string;                    // 俗家/行家/神功/禁功
  designGrade: string;             // S/A/B/C/D
  yinYangLabel: string;            // 阴阳路数标签 (极阳/少阳/中平/少阴/极阴/混元)
  timing: MoveTiming;
  formPosition: FormPosition;      // 式位
  minDice: number;                 // 最低投入
  qiNatureThreshold: string;       // 气性门槛 e.g. "至少1阳" "至少1阴1阳" "任意气性"
  shiCondition: ShiCondition;      // 势条件类型
  allowedShi: ShiState[];          // 允许势范围
  hardPrerequisite?: string;       // 硬前置 (默认无)
  targetRange: string;             // 对象/距离
  equipPermission: string;         // 装备许可
  baseEffect: string;              // 基础效果
  triggers: MoveTrigger[];         // 槽值触发
  postShi: ShiState | "不改势";   // 成招后转势
  resourceDestination: string;     // 资源去向
  hasIntercept: boolean;           // 是否挂载截击
  hasReact: boolean;               // 是否挂载应招
}

// === Response Attachment (响应挂载) ===
export interface ResponseAttachment {
  id: string;
  moveId: string;                  // 挂载在哪条招式上
  moveName: string;
  responseType: "截击" | "应招";
  timing: string;                  // "宣言后、配置前" | "成招后、落果前"
  minDice: number;
  qiNatureThreshold: string;
  shiCondition: ShiCondition;
  allowedShi: ShiState[];
  equipPermission: string;
  baseEffect: string;
  triggers: MoveTrigger[];
  postShi: ShiState | "不改势";
  resourceDestination: string;
  constraints: string;             // 限制说明
}

// === Quick Actions (便行) ===
export interface QuickAction {
  id: string;
  name: string;
  type: "出手便行" | "随手便行" | "随手便行·特殊";
  timing: string;
  minDice: number;
  qiNatureThreshold: string;
  shiCondition: ShiCondition;
  permission: string;
  effect: string;
  limit: string;
  resourceDestination: string;
}

// === Status Effects (状态) ===
export type StatusName = "迟滞" | "破口" | "失衡" | "流血" | "中毒" | "燃烧" | "冻结" | "眩晕" | "封穴";

export interface StatusEffect {
  id: string;
  name: StatusName;
  layers: number;                  // 层数
  source: string;                  // 来源
  durationRounds?: number;         // 持续轮数 (undefined=永久直到解除)
  ownerId: string;
  public: boolean;
  effects: string[];               // 每层的效果描述
  decayRule?: string;              // 衰减方式 e.g. "每轮结束-1层"
  removalEntries: string[];        // 解除入口
}

// === Distance ===
export type DistanceBand = "贴身" | "近身" | "短距" | "中距" | "远距" | "离场";

export interface DistanceRelation {
  id: string;
  fromActorId: string;
  toActorId: string;
  band: DistanceBand;
  height?: "同层" | "高处" | "低处";
  entangled?: boolean;
  public: boolean;
}

// === Actor ===
export interface Actor {
  id: string;
  name: string;
  side: "player" | "enemy" | "pressure";
  // 底层
  sixRoots: SixRoots;
  innerArts: InnerArt[];
  // 表层
  tableAttrs: TableAttrs;
  maxHp: number;
  hp: number;
  // 势
  momentum: ShiState;
  // 武艺
  moves: Move[];
  responses: ResponseAttachment[];
  quickActions: QuickAction[];
  // 装备
  inventory: InventoryItem[];
  inventoryEvents?: InventoryEvent[];
  equippedWeapon?: string;         // 当前持握武器ID
  equippedArmorUpper?: string;     // 上装
  equippedArmorLower?: string;     // 下装
  equippedAccessory?: string;      // 佩饰 (最多1件)
  // 响应额度
  responseQuotaUsed: number;       // 本轮已用响应次数
  maxResponseQuota: number;        // 每轮最大响应次数 (默认1)
  // 状态与隐藏信息
  statuses: StatusEffect[];
  hiddenStatuses?: StatusEffect[];
  publicWeakness?: string;
  hiddenGoal?: string;
  behaviorHint?: string;
  entryCondition?: string;
  lootOrClue?: string;
  publicNote: string;
  dmNote?: string;
}

// === Inventory ===
export type InventoryCategory = "weapon" | "armor" | "accessory" | "tool" | "medicine" | "mount" | "document" | "misc";

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  equipped?: boolean;
  sourceId?: string;
  grantsTempQi?: { nature: QiNature; sides: number; count: number };
  attrBonus?: Partial<TableAttrs>;
  qiDice?: { nature: QiNature; sides: number; count: number; zone: "QI_POOL" | "TEMP_QI" };
  grantsPermission?: string;       // 装备许可文本
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

// === Combat State ===
export type CombatPhase = "setup" | "initiative" | "scene" | "declare" | "intercept_window" | "react_window" | "outcome" | "round_end";

export interface PendingAction {
  actorId: string;
  targetId: string;
  targetIds?: string[];        // reserved for later multi-target cards
  moveId: string;
  diceIds: string[];           // all locked dice
  yinSlotDiceIds: string[];
  yangSlotDiceIds: string[];
  formed?: boolean;
  preventedDamage?: number;
  slotValues?: SlotValues;     // calculated on form
}

export interface SceneTrack {
  id: string;
  name: string;
  value: number;
  max: number;
  hidden?: boolean;
  description: string;
}

export interface CombatLogEntry {
  id: string;
  type: string;
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
  activeActorId: string;
  actors: Actor[];
  dice: QiDie[];
  tracks: SceneTrack[];
  distances: DistanceRelation[];
  pendingAction?: PendingAction;
  logs: CombatLogEntry[];
  lastSavedAt?: number;
}

// === App Session ===
export interface AppSession {
  route: string;
  identity?: "dm" | "player" | "spectator";
  gameMode: "scene" | "combat";
  developerMode: boolean;
  roomCode: string;
  playerName: string;
  selectedActorId?: string;
  seats: Array<{ id: string; label: string; playerName?: string; actorId?: string; ready: boolean }>;
  room: {
    roomName: string;
    hostName: string;
    campaignId: string;
    mode: "local";
    allowSpectators: boolean;
    maxPlayers: number;
  };
}
