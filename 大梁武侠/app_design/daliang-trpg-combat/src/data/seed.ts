import type {
  Actor,
  CombatState,
  QiDie,
  SceneTrack,
  SceneRuntimeState,
  Move,
  ResponseAttachment,
  QuickAction,
  InnerArt,
  StatusEffect,
  InventoryItem,
  SixRoots,
  TableAttrs,
  MoveCategory,
  MoveSubCategory,
  FormPosition,
  MoveTiming,
} from "../combat/types";
import { projectCampaignScene } from "./campaign/campaignRuntime";
import { tutorialCampaignPack } from "./campaign/tutorialPack";
import { createResponseBudget, createRuntimeSession } from "../domain/session/runtime";

// ============================================================
// MOVES (from rulebook 04_招式库_统一版_修复版.md)
// ============================================================

// Engine compat: moves need `actionType` for legacy slot checks.
// `timing` is the canonical field; `actionType` is a bridge.
interface SeedMove extends Move {
  actionType?: string;
  trackDelta?: number;
  baseDamage?: number;
}

const WG001: SeedMove = {
  id: "WG001",
  name: "破浪横刀",
  category: "外功" as MoveCategory,
  subCategory: "主攻" as MoveSubCategory,
  tier: "俗家",
  designGrade: "C",
  yinYangLabel: "少阳",
  timing: "正式出手" as MoveTiming,
  formPosition: "起式" as FormPosition,
  minDice: 2,
  qiNatureThreshold: "至少1阳",
  shiCondition: "宽势",
  allowedShi: ["阴盛", "阳盛", "合势", "失势"],
  targetRange: "近身人物目标；主手刀或同类短兵",
  equipPermission: "主手刀",
  baseEffect: "造成气血4点",
  triggers: [
    { type: "主槽", condition: "阳值≥7", effect: "追加气血3点" },
    { type: "合值", condition: "合值≥10", effect: "目标退距1档" },
    { type: "差值/风险", condition: "阴阳差≥5", effect: "自身破口1层" },
  ],
  postShi: "阳盛",
  resourceDestination: "已用常规气骰入息库",
  hasIntercept: true,
  hasReact: true,
  actionType: "formal",
  baseDamage: 4,
};

const WG002: SeedMove = {
  id: "WG002",
  name: "回潮压刃",
  category: "外功" as MoveCategory,
  subCategory: "主攻" as MoveSubCategory,
  tier: "俗家",
  designGrade: "B",
  yinYangLabel: "少阳",
  timing: "正式出手" as MoveTiming,
  formPosition: "承式" as FormPosition,
  minDice: 3,
  qiNatureThreshold: "至少1阴1阳",
  shiCondition: "宽势",
  allowedShi: ["阳盛", "合势", "圆融"],
  targetRange: "近身人物目标；主手刀",
  equipPermission: "主手刀",
  baseEffect: "造成气血5点",
  triggers: [
    { type: "主槽", condition: "阳值≥8", effect: "追加气血3点" },
    { type: "合值", condition: "合值≥12", effect: "目标迟滞1层" },
    { type: "差值/风险", condition: "阴阳差≥5", effect: "自身转入失势" },
  ],
  postShi: "合势",
  resourceDestination: "已用常规气骰入息库",
  hasIntercept: true,
  hasReact: false,
  actionType: "formal",
  baseDamage: 5,
};

const WG006: SeedMove = {
  id: "WG006",
  name: "燕回侧步",
  category: "外功" as MoveCategory,
  subCategory: "身法" as MoveSubCategory,
  tier: "俗家",
  designGrade: "C",
  yinYangLabel: "少阴",
  timing: "正式出手" as MoveTiming,
  formPosition: "起式" as FormPosition,
  minDice: 2,
  qiNatureThreshold: "至少1阴",
  shiCondition: "宽势",
  allowedShi: ["阴盛", "合势", "失势", "圆融"],
  targetRange: "自己；近身或相邻距离",
  equipPermission: "无",
  baseEffect: "移步1档或取得遮蔽",
  triggers: [
    { type: "主槽", condition: "阴值≥7", effect: "不触发普通追身机会" },
    { type: "合值", condition: "合值≥10", effect: "关闭一条普通目标线到本动作结束" },
    { type: "差值/风险", condition: "阴阳差≥5", effect: "自身迟滞1层" },
  ],
  postShi: "阴盛",
  resourceDestination: "已用常规气骰入息库",
  hasIntercept: true,
  hasReact: true,
  actionType: "formal",
};

const WG008: SeedMove = {
  id: "WG008",
  name: "截腕挑锋",
  category: "外功" as MoveCategory,
  subCategory: "拆招" as MoveSubCategory,
  tier: "俗家",
  designGrade: "B",
  yinYangLabel: "少阴",
  timing: "正式出手" as MoveTiming,
  formPosition: "转式" as FormPosition,
  minDice: 2,
  qiNatureThreshold: "至少1阴",
  shiCondition: "宽势",
  allowedShi: ["阴盛", "合势", "失势"],
  targetRange: "近身目标；空手、短兵或副手兵器",
  equipPermission: "短兵",
  baseEffect: "目标本轮持械许可受扰：下一次持械招最低投入+1枚气骰",
  triggers: [
    { type: "主槽", condition: "阴值≥7", effect: "目标破口1层" },
    { type: "合值", condition: "合值≥10", effect: "目标副手许可关闭至本轮结束" },
    { type: "差值/风险", condition: "阴阳差≥5", effect: "自身破口1层" },
  ],
  postShi: "阴盛",
  resourceDestination: "已用常规气骰入息库",
  hasIntercept: true,
  hasReact: false,
  actionType: "formal",
};

const WG009: SeedMove = {
  id: "WG009",
  name: "夺器压腕",
  category: "外功" as MoveCategory,
  subCategory: "拆招" as MoveSubCategory,
  tier: "行家",
  designGrade: "B",
  yinYangLabel: "少阴",
  timing: "正式出手" as MoveTiming,
  formPosition: "转式" as FormPosition,
  minDice: 4,
  qiNatureThreshold: "至少2阴",
  shiCondition: "中势",
  allowedShi: ["阴盛", "圆融"],
  targetRange: "近身；空手、短兵或软兵；目标持械",
  equipPermission: "短兵",
  baseEffect: "目标武器进入脱手威胁；下一次依赖该武器的动作需额外投入1枚气骰",
  triggers: [
    { type: "主槽", condition: "阴值≥9", effect: "目标武器脱手落在近身区域" },
    { type: "合值", condition: "合值≥14", effect: "同时关闭目标本轮持械许可" },
    { type: "差值/风险", condition: "阴阳差≥6", effect: "自身破口1层" },
  ],
  postShi: "阴盛",
  resourceDestination: "已用常规气骰入息库",
  hasIntercept: true,
  hasReact: false,
  actionType: "formal",
};

const FM001: SeedMove = {
  id: "FM001",
  name: "听痕辨路",
  category: "法门" as MoveCategory,
  subCategory: "查探" as MoveSubCategory,
  tier: "俗家",
  designGrade: "C",
  yinYangLabel: "少阴",
  timing: "正式出手" as MoveTiming,
  formPosition: "无" as FormPosition,
  minDice: 2,
  qiNatureThreshold: "至少1阴",
  shiCondition: "无势",
  allowedShi: ["阴盛", "阳盛", "合势", "圆融", "崩势", "失势"],
  targetRange: "道路、房间、尸身周边或机关痕迹",
  equipPermission: "无",
  baseEffect: "取得1条明确痕迹；解密+1",
  triggers: [
    { type: "主槽", condition: "阴值≥7", effect: "确认痕迹方向或新旧" },
    { type: "合值", condition: "合值≥10", effect: "危机-1" },
    { type: "差值/风险", condition: "阴阳差≥5", effect: "危机+1，并记录误判线索名" },
  ],
  postShi: "不改势",
  resourceDestination: "已用常规气骰入息库",
  hasIntercept: true,
  hasReact: false,
  actionType: "scene",
  trackDelta: 1,
};

// Sample-pack NPC actions. These are authored scene entries expressed through
// the same 2026-06-20 move schema; they do not introduce a second NPC-only
// resolution system. This lets the automated host demonstrate allies,
// objectives and ranged pressure instead of silently skipping empty turns.
const SCN_GUARD: SeedMove = {
  id: "SCN-GUARD-01",
  name: "护主断路",
  category: "外功",
  subCategory: "护人",
  tier: "俗家",
  designGrade: "C",
  yinYangLabel: "中平",
  timing: "正式出手",
  formPosition: "起式",
  minDice: 2,
  qiNatureThreshold: "至少1阴1阳",
  shiCondition: "宽势",
  allowedShi: ["阴盛", "阳盛", "合势", "失势"],
  targetRange: "近身人物目标",
  equipPermission: "无",
  baseEffect: "造成气血3点",
  triggers: [
    { type: "合值", condition: "合值≥9", effect: "目标迟滞1层" },
  ],
  postShi: "合势",
  resourceDestination: "已用常规气骰入息库",
  hasIntercept: true,
  hasReact: true,
  actionType: "formal",
  baseDamage: 3,
};

const SCN_PORTER: SeedMove = {
  id: "SCN-PORTER-01",
  name: "拖箱转运",
  category: "便行",
  subCategory: "整备",
  tier: "俗家",
  designGrade: "D",
  yinYangLabel: "中平",
  timing: "出手便行",
  formPosition: "无",
  minDice: 1,
  qiNatureThreshold: "任意气性",
  shiCondition: "无势",
  allowedShi: ["阴盛", "阳盛", "合势", "圆融", "崩势", "失势"],
  targetRange: "场景中可见人物或可及物件",
  equipPermission: "无",
  baseEffect: "危机+1",
  triggers: [],
  postShi: "不改势",
  resourceDestination: "已用常规气骰入息库",
  hasIntercept: false,
  hasReact: false,
  actionType: "quick",
};

const SCN_ALARM: SeedMove = {
  id: "SCN-LOOKOUT-01",
  name: "扬声示警",
  category: "法门",
  subCategory: "交涉",
  tier: "俗家",
  designGrade: "D",
  yinYangLabel: "中平",
  timing: "出手便行",
  formPosition: "无",
  minDice: 1,
  qiNatureThreshold: "任意气性",
  shiCondition: "无势",
  allowedShi: ["阴盛", "阳盛", "合势", "圆融", "崩势", "失势"],
  targetRange: "场景中可见人物",
  equipPermission: "无",
  baseEffect: "危机+1",
  triggers: [],
  postShi: "阳盛",
  resourceDestination: "已用常规气骰入息库",
  hasIntercept: false,
  hasReact: false,
  actionType: "quick",
};

const SCN_ARROW: SeedMove = {
  id: "SCN-ARCHER-01",
  name: "暗箭逼身",
  category: "外功",
  subCategory: "主攻",
  tier: "俗家",
  designGrade: "C",
  yinYangLabel: "少阴",
  timing: "出手便行",
  formPosition: "起式",
  minDice: 1,
  qiNatureThreshold: "任意气性",
  shiCondition: "无势",
  allowedShi: ["阴盛", "阳盛", "合势", "圆融", "失势"],
  targetRange: "中距或远距人物目标",
  equipPermission: "无",
  baseEffect: "造成气血2点",
  triggers: [],
  postShi: "阴盛",
  resourceDestination: "已用常规气骰入息库",
  hasIntercept: true,
  hasReact: true,
  actionType: "quick",
  baseDamage: 2,
};

// ============================================================
// RESPONSE ATTACHMENTS (from rulebook, mounted on moves)
// ============================================================

export const RG001: ResponseAttachment = {
  id: "RG001",
  moveId: "WG001",
  moveName: "破浪横刀",
  responseType: "截击",
  timing: "宣言后、配置前",
  minDice: 2,
  qiNatureThreshold: "至少1阳",
  shiCondition: "宽势",
  allowedShi: ["阳盛", "合势", "失势"],
  equipPermission: "主手刀",
  baseEffect: "目标1枚锁气本次不能进入阳槽",
  triggers: [
    { type: "主槽", condition: "阳值≥7", effect: "该锁气改入息库" },
    { type: "合值", condition: "合值≥10", effect: "目标本次基础效果-2气血" },
    { type: "差值/风险", condition: "阴阳差≥5", effect: "自身破口1层" },
  ],
  postShi: "阳盛",
  resourceDestination: "截击气骰入息库",
  constraints: "只处理锁气与基础效果，不自动造成主用法伤害",
};

export const RG002: ResponseAttachment = {
  id: "RG002",
  moveId: "WG001",
  moveName: "破浪横刀",
  responseType: "应招",
  timing: "成招后、落果前",
  minDice: 2,
  qiNatureThreshold: "至少1阳",
  shiCondition: "宽势",
  allowedShi: ["阳盛", "合势", "圆融"],
  equipPermission: "主手刀或副手刀",
  baseEffect: "抵消气血3点",
  triggers: [
    { type: "主槽", condition: "阳值≥7", effect: "额外抵消气血2点" },
    { type: "合值", condition: "合值≥10", effect: "可将自己退距1档" },
    { type: "差值/风险", condition: "阴阳差≥5", effect: "自身迟滞1层" },
  ],
  postShi: "不改势",
  resourceDestination: "应招气骰入息库",
  constraints: "应招只处理自身目标线",
};

const RG003: ResponseAttachment = {
  id: "RG003",
  moveId: "WG002",
  moveName: "回潮压刃",
  responseType: "截击",
  timing: "宣言后、配置前",
  minDice: 3,
  qiNatureThreshold: "至少1阴1阳",
  shiCondition: "中势",
  allowedShi: ["阳盛", "合势"],
  equipPermission: "主手刀",
  baseEffect: "关闭目标本次退距附加效果",
  triggers: [
    { type: "主槽", condition: "阳值≥8", effect: "目标迟滞1层" },
    { type: "合值", condition: "合值≥12", effect: "目标锁气中1枚最低点气骰入息库" },
    { type: "差值/风险", condition: "阴阳差≥5", effect: "自身失势" },
  ],
  postShi: "合势",
  resourceDestination: "截击气骰入息库",
  constraints: "中级截击要求较窄势范围",
};

export const RG009: ResponseAttachment = {
  id: "RG009",
  moveId: "WG008",
  moveName: "截腕挑锋",
  responseType: "截击",
  timing: "宣言后、配置前",
  minDice: 2,
  qiNatureThreshold: "至少1阴",
  shiCondition: "宽势",
  allowedShi: ["阴盛", "合势", "失势"],
  equipPermission: "短兵",
  baseEffect: "目标1枚锁气本次不能进入阳槽",
  triggers: [
    { type: "主槽", condition: "阴值≥7", effect: "该气骰改入息库" },
    { type: "合值", condition: "合值≥10", effect: "目标本次失去持械许可" },
    { type: "差值/风险", condition: "阴阳差≥5", effect: "自身破口1层" },
  ],
  postShi: "阴盛",
  resourceDestination: "截击气骰入息库",
  constraints: "典型挂载截击，处理装备许可",
};

const RG010: ResponseAttachment = {
  id: "RG010",
  moveId: "WG009",
  moveName: "夺器压腕",
  responseType: "截击",
  timing: "宣言后、配置前",
  minDice: 4,
  qiNatureThreshold: "至少2阴",
  shiCondition: "中势",
  allowedShi: ["阴盛", "圆融"],
  equipPermission: "短兵",
  baseEffect: "目标装备许可关闭至本次动作结束",
  triggers: [
    { type: "主槽", condition: "阴值≥9", effect: "目标武器脱手落在近身区域" },
    { type: "合值", condition: "合值≥14", effect: "目标本次动作不成招" },
    { type: "差值/风险", condition: "阴阳差≥6", effect: "自身破口1层" },
  ],
  postShi: "阴盛",
  resourceDestination: "截击气骰入息库",
  constraints: "强缴械截击要求势和高投入",
};

// Legacy react response for backward-compatible test (短兵客 应招)
const reactSideSlip: ResponseAttachment = {
  id: "react-side-slip",
  moveId: "WG002",
  moveName: "侧身卸力",
  responseType: "应招",
  timing: "成招后、落果前",
  minDice: 1,
  qiNatureThreshold: "任意",
  shiCondition: "无势",
  allowedShi: ["阴盛", "阳盛", "合势", "圆融", "崩势", "失势"],
  equipPermission: "无",
  baseEffect: "抵消气血2点",
  triggers: [],
  postShi: "不改势",
  resourceDestination: "应招气骰入息库",
  constraints: "落果前减轻气血损失2点",
};

// ============================================================
// QUICK ACTIONS (便行 BX001-BX006)
// ============================================================

const BX001: QuickAction = {
  id: "BX001",
  name: "移步",
  type: "出手便行",
  timing: "自己回合",
  minDice: 1,
  qiNatureThreshold: "任意",
  shiCondition: "无势",
  permission: "自己；合法空间",
  effect: "改变1档位置或取得明确站位",
  limit: "不能穿越强封锁；不能稳定脱离纠缠",
  resourceDestination: "已用气骰入息库",
};

const BX002: QuickAction = {
  id: "BX002",
  name: "整身",
  type: "出手便行",
  timing: "自己回合",
  minDice: 1,
  qiNatureThreshold: "任意",
  shiCondition: "无势",
  permission: "自己；姿态散乱、倒地、迟滞或轻破口",
  effect: "起身，或迟滞-1，或关闭轻破口（二选一）",
  limit: "不能清强状态",
  resourceDestination: "已用气骰入息库",
};

const BX004: QuickAction = {
  id: "BX004",
  name: "取物",
  type: "出手便行",
  timing: "自己回合",
  minDice: 1,
  qiNatureThreshold: "任意",
  shiCondition: "无势",
  permission: "可及且未被争夺的物件",
  effect: "取出或拾起一件可及物",
  limit: "有人争夺时改正式出手",
  resourceDestination: "已用气骰入息库",
};

const BX005: QuickAction = {
  id: "BX005",
  name: "闭息",
  type: "出手便行",
  timing: "自己回合",
  minDice: 1,
  qiNatureThreshold: "任意",
  shiCondition: "无势",
  permission: "烟尘、毒雾、水压等短压力",
  effect: "本轮抵抗一次轻环境压力",
  limit: "不能解毒，不能治疗",
  resourceDestination: "已用气骰入息库",
};

const BX006: QuickAction = {
  id: "BX006",
  name: "调息",
  type: "出手便行",
  timing: "自己回合",
  minDice: 1,
  qiNatureThreshold: "任意",
  shiCondition: "无势",
  permission: "息库有可回收常规气骰",
  effect: "按规则或条目从息库取回常规气骰，保持原点数入气海",
  limit: "只回气骰，不治疗、不清状态、不改势",
  resourceDestination: "息引入息库；取回气骰入气海",
};

// Quick action wrappers as SeedMove (for engine compat)
function quickAsMove(qa: QuickAction, actionType: string): SeedMove {
  return {
    id: qa.id,
    name: qa.name,
    category: "便行" as MoveCategory,
    subCategory: "" as MoveSubCategory,
    tier: "俗家",
    designGrade: "D",
    yinYangLabel: "中平",
    timing: actionType === "quick" ? "出手便行" as MoveTiming : "随手便行" as MoveTiming,
    formPosition: "无" as FormPosition,
    minDice: qa.minDice,
    qiNatureThreshold: qa.qiNatureThreshold === "任意" ? "任意气性" : qa.qiNatureThreshold,
    shiCondition: "无势",
    allowedShi: ["阴盛", "阳盛", "合势", "圆融", "崩势", "失势"],
    targetRange: qa.permission,
    equipPermission: "无",
    baseEffect: qa.effect,
    triggers: [],
    postShi: "不改势",
    resourceDestination: qa.resourceDestination,
    hasIntercept: false,
    hasReact: false,
    actionType,
  };
}

// ============================================================
// ACTORS
// ============================================================

const innerArtShenQing: InnerArt = {
  id: "neigong-xiao-zhoutian",
  name: "小周天养息功",
  tier: "俗家",
  occupiedAcupoints: ["丹田"],
  readRoots: ["顶门", "目窍", "心口", "丹田", "命门", "步根"],
  currentLevel: 1,
  maxLevel: 5,
  attrContributions: [
    { level: 1, root: "顶门", targetAttr: "观照", multiplier: 1, bonus: 4 },
    { level: 1, root: "丹田", targetAttr: "回气", multiplier: 1, bonus: 0 },
    { level: 1, root: "命门", targetAttr: "气血", multiplier: 1, bonus: 1 },
    { level: 1, root: "步根", targetAttr: "身势", multiplier: 1, bonus: 0 },
    { level: 1, root: "心口", targetAttr: "爆发", multiplier: 1, bonus: 0 },
    { level: 1, root: "目窍", targetAttr: "观照", multiplier: 1, bonus: 0 },
  ],
  qiGeneration: [
    { level: 1, root: "顶门", nature: "raw", multiplier: 1, bonus: 0, diceSides: 6, diceCount: 1 },
    { level: 1, root: "丹田", nature: "raw", multiplier: 1, bonus: 0, diceSides: 6, diceCount: 1 },
    { level: 1, root: "命门", nature: "yang", multiplier: 1, bonus: 0, diceSides: 6, diceCount: 1 },
    { level: 1, root: "心口", nature: "yang", multiplier: 1, bonus: 0, diceSides: 4, diceCount: 1 },
    { level: 1, root: "目窍", nature: "yin", multiplier: 1, bonus: 0, diceSides: 6, diceCount: 1 },
    { level: 1, root: "步根", nature: "yin", multiplier: 1, bonus: 0, diceSides: 6, diceCount: 1 },
  ],
  passive: "读全六根，一重。",
  regulateBreathBonus: 1,
  disperseRules: "散功：失去所有气骰与属性贡献，内功等级归零。",
};

const innerArtShortBlade: InnerArt = {
  id: "neigong-tieyi-fuhu",
  name: "铁衣伏虎劲",
  tier: "行家",
  occupiedAcupoints: ["命门"],
  readRoots: ["丹田", "命门", "心口"],
  currentLevel: 1,
  maxLevel: 5,
  attrContributions: [
    { level: 1, root: "丹田", targetAttr: "气血", multiplier: 1, bonus: 5 },
    { level: 1, root: "命门", targetAttr: "护体", multiplier: 1, bonus: 1 },
    { level: 1, root: "心口", targetAttr: "爆发", multiplier: 1, bonus: 0 },
  ],
  qiGeneration: [
    { level: 1, root: "丹田", nature: "raw", multiplier: 1, bonus: 0, diceSides: 6, diceCount: 1 },
    { level: 1, root: "命门", nature: "yang", multiplier: 1, bonus: 0, diceSides: 6, diceCount: 1 },
    { level: 1, root: "心口", nature: "yang", multiplier: 1, bonus: 0, diceSides: 6, diceCount: 1 },
  ],
  passive: "读丹田/命门/心口，一重。",
  disperseRules: "散功：失去所有气骰与属性贡献，内功等级归零。",
};

const actorShenQing: Actor = {
  id: "pc-shen-qing",
  name: "沈青",
  side: "player",
  sixRoots: { 顶门: 5, 目窍: 4, 心口: 3, 丹田: 4, 命门: 5, 步根: 4 },
  innerArts: [innerArtShenQing],
  tableAttrs: { 气血: 6, 护体: 1, 爆发: 3, 回气: 4, 观照: 9, 身势: 4 },
  maxHp: 18,
  hp: 18,
  momentum: "合势",
  moves: [WG001, WG006, FM001] as Move[],
  responses: [RG001, RG002],
  quickActions: [BX001, BX002, BX004, BX006],
  inventory: [
    { id: "item-ring-saber", name: "环首刀", category: "weapon", quantity: 1, equipped: true, sourceId: "沈青·环首刀", catalogId: "EQ-W-001", publicNote: "提供刀与持握许可；武器基础伤害修正+2，普通招架修正+1。" },
    { id: "item-thick-shirt", name: "厚布短褂", category: "armor", quantity: 1, equipped: true, sourceId: "沈青·厚布短褂", catalogId: "EQ-AU-001", publicNote: "上装护甲值1，护体+1。磨损或损坏时关闭对应许可。" },
    { id: "item-golden-ointment", name: "金疮药", category: "medicine", quantity: 2, sourceId: "金疮药", catalogId: "MED-001", healHp: 4, repeatUseStatus: "药性冲突", publicNote: "自己或接触同伴使用，消耗1份并恢复4点气血；同场景再次使用会产生药性冲突。" },
    { id: "item-fire-starter", name: "火折", category: "tool", quantity: 1, sourceId: "火折", catalogId: "EQ-T-001", publicNote: "提供点火与照明许可；本身不直接产生伤害落果。" },
    { id: "item-bureau-token", name: "镖局信物", category: "tool", quantity: 1, sourceId: "镖局信物", publicNote: "可用于情景交涉，向镖局或水会证明身份。" },
  ] as InventoryItem[],
  equippedWeapon: "item-ring-saber",
  equippedArmorUpper: "item-thick-shirt",
  responseQuotaUsed: 0,
  maxResponseQuota: 1,
  statuses: [] as StatusEffect[],
  aiProfile: { role: "assault", preferredRange: "近身", retreatHpRatio: 0.2, objective: "保住失匣并查明偷匣缘由" },
  publicWeakness: "擅长刀法，但在拥挤场地需要明确目标线。",
  publicNote: "玩家预设角色。镖局刀客，适合测试气骰、宣言和应招。",
};

const actorShortBlade: Actor = {
  id: "enemy-short-blade",
  name: "短兵客",
  side: "enemy",
  sixRoots: { 顶门: 4, 目窍: 5, 心口: 4, 丹田: 3, 命门: 4, 步根: 5 },
  innerArts: [innerArtShortBlade],
  tableAttrs: { 气血: 8, 护体: 5, 爆发: 4, 回气: 2, 观照: 3, 身势: 3 },
  maxHp: 14,
  hp: 14,
  momentum: "合势",
  moves: [WG002, WG008] as Move[],
  responses: [RG003, RG009, reactSideSlip],
  quickActions: [BX001, BX005],
  inventory: [
    { id: "enemy-short-blade-weapon", name: "短刀", category: "weapon", quantity: 1, equipped: true, sourceId: "短兵客·阴刃", publicNote: "公开可见：短兵客依赖此刀近身。", dmNote: "失去短刀后主动作关闭。" },
    { id: "enemy-soft-leather", name: "软皮上甲", category: "armor", quantity: 1, equipped: true, sourceId: "短兵客·软皮上甲", publicNote: "轻便皮甲。", dmNote: "提供基础护体。" },
    { id: "enemy-sleeve-arrow", name: "袖箭", category: "weapon", quantity: 1, equipped: true, sourceId: "短兵客·袖箭", publicNote: "副手暗器。", dmNote: "副手装备，可打断追击。" },
  ] as InventoryItem[],
  equippedWeapon: "enemy-short-blade-weapon",
  equippedArmorUpper: "enemy-soft-leather",
  responseQuotaUsed: 0,
  maxResponseQuota: 1,
  statuses: [] as StatusEffect[],
  hiddenStatuses: [] as StatusEffect[],
  publicWeakness: "怕被长兵封距；失去短刀后威胁下降。",
  hiddenGoal: "拖延时间，让同伙把药匣送上接应船",
  behaviorHint: "优先截击持刀者；气血低于5时尝试逃跑",
  aiProfile: { role: "skirmish", preferredRange: "近身", retreatHpRatio: 0.25, conserveResponsesBelowDice: 2, objective: "拖住追兵并保护药匣撤离路线" },
  entryCondition: "玩家接近旧船棚时从暗处现身",
  lootOrClue: "可掉落买主线索、短刀、带泥的布条。",
  publicNote: "样例敌人。怕长兵封距，若失去短刀主动作关闭。",
  dmNote: "隐藏弱点：被缴械后不再能使用短刀近身；优先拖到巡检注意升高。",
};

const actorPorter: Actor = {
  id: "enemy-porter",
  name: "黑衣脚夫",
  side: "enemy",
  sixRoots: { 顶门: 3, 目窍: 3, 心口: 3, 丹田: 4, 命门: 4, 步根: 3 },
  innerArts: [],
  tableAttrs: { 气血: 4, 护体: 1, 爆发: 2, 回气: 2, 观照: 2, 身势: 4 },
  maxHp: 9,
  hp: 9,
  momentum: "失势",
  moves: [SCN_PORTER, WG009] as Move[],
  responses: [RG010],
  quickActions: [BX001, BX004],
  inventory: [
    { id: "enemy-rope", name: "绳索", category: "tool", quantity: 1, sourceId: "脚夫·绳索", publicNote: "腰间有粗麻绳。", dmNote: "用于捆绑药匣或绊索截击。" },
    { id: "enemy-sack", name: "麻袋", category: "tool", quantity: 1, sourceId: "脚夫·麻袋", publicNote: "可装运散落物品。", dmNote: "用于快速打包转移。" },
  ] as InventoryItem[],
  responseQuotaUsed: 0,
  maxResponseQuota: 1,
  statuses: [] as StatusEffect[],
  hiddenStatuses: [] as StatusEffect[],
  publicWeakness: "气血低，受伤后优先逃跑。",
  hiddenGoal: "趁乱将药匣搬上船",
  behaviorHint: "不主动攻击；有人接近药匣时才出手；药匣上船后立即撤退",
  aiProfile: { role: "objective", preferredRange: "中距", retreatHpRatio: 0.45, objective: "把药匣送往水门接应船" },
  entryCondition: "玩家进入旧船棚时已在场",
  lootOrClue: "水会香口记号、湿脚印方向。",
  publicNote: "低气血集群敌人。不主动攻击，优先完成搬运目标。",
  dmNote: "隐藏目标：趁乱将药匣搬上船；药匣上船后立即撤退。3人集群共享气血。",
};

const actorWei: Actor = {
  id: "pc-wei",
  name: "魏长兴",
  side: "player",
  sixRoots: { 顶门: 4, 目窍: 5, 心口: 4, 丹田: 3, 命门: 4, 步根: 5 },
  innerArts: [],
  tableAttrs: { 气血: 7, 护体: 3, 爆发: 3, 回气: 3, 观照: 4, 身势: 5 },
  maxHp: 20,
  hp: 20,
  momentum: "阳盛",
  moves: [SCN_GUARD] as Move[],
  responses: [],
  quickActions: [] as QuickAction[],
  inventory: [] as InventoryItem[],
  responseQuotaUsed: 0,
  maxResponseQuota: 1,
  statuses: [] as StatusEffect[],
  aiProfile: { role: "guard", preferredRange: "近身", protectActorIds: ["pc-shen-qing"], retreatHpRatio: 0.15, objective: "护住沈青并保住失匣" },
  publicNote: "预设队友。",
};

const actorLookout: Actor = {
  id: "enemy-lookout",
  name: "望风探子",
  side: "enemy",
  sixRoots: { 顶门: 3, 目窍: 5, 心口: 3, 丹田: 3, 命门: 3, 步根: 4 },
  innerArts: [],
  tableAttrs: { 气血: 5, 护体: 1, 爆发: 2, 回气: 2, 观照: 5, 身势: 3 },
  maxHp: 10,
  hp: 10,
  momentum: "阴盛",
  moves: [SCN_ALARM] as Move[],
  responses: [],
  quickActions: [] as QuickAction[],
  inventory: [] as InventoryItem[],
  responseQuotaUsed: 0,
  maxResponseQuota: 1,
  statuses: [] as StatusEffect[],
  hiddenStatuses: [] as StatusEffect[],
  publicWeakness: "单独放哨，被近身后慌乱。",
  hiddenGoal: "发现异常时吹哨报信",
  behaviorHint: "优先维持距离，被发现后尝试逃跑报信",
  aiProfile: { role: "support", preferredRange: "中距", retreatHpRatio: 0.5, objective: "提高危机并为同伴示警" },
  entryCondition: "旧船棚屋顶或高处",
  publicNote: "集群敌人。单独放哨，被近身后慌乱。",
  dmNote: "吹哨会触发巡检注意+3。",
};

const actorArcher: Actor = {
  id: "enemy-archer",
  name: "暗处弓手",
  side: "enemy",
  sixRoots: { 顶门: 4, 目窍: 5, 心口: 3, 丹田: 4, 命门: 3, 步根: 3 },
  innerArts: [],
  tableAttrs: { 气血: 4, 护体: 1, 爆发: 3, 回气: 2, 观照: 4, 身势: 2 },
  maxHp: 8,
  hp: 8,
  momentum: "合势",
  moves: [SCN_ARROW] as Move[],
  responses: [],
  quickActions: [] as QuickAction[],
  inventory: [] as InventoryItem[],
  responseQuotaUsed: 0,
  maxResponseQuota: 1,
  statuses: [] as StatusEffect[],
  hiddenStatuses: [] as StatusEffect[],
  publicWeakness: "近战极弱，被近身即失去威胁。",
  hiddenGoal: "掩护同伙撤离时放冷箭",
  behaviorHint: "始终保持中远距，优先射击接近药匣者",
  aiProfile: { role: "skirmish", preferredRange: "远距", retreatHpRatio: 0.3, objective: "从高处掩护药匣撤离" },
  entryCondition: "玩家进入旧船棚后2轮登场",
  lootOrClue: "箭筒上有水会标记",
  publicNote: "远程敌人。近战极弱，被近身即失去威胁。",
  dmNote: "2轮后从暗处出现，优先射击接近药匣的玩家。",
};

// The default runtime opening is projected from the authored campaign pack.
// This prevents the tutorial editor and actual player scene from drifting into
// two different versions of 白蘋渡.
const authoredOpening = projectCampaignScene(tutorialCampaignPack, tutorialCampaignPack.startSceneId);
const initialScene: SceneRuntimeState = authoredOpening.scene;
const tutorialTracks: SceneTrack[] = authoredOpening.tracks;

// ============================================================
// QI DICE (12 total)
// ============================================================

function die(id: string, sourceName: string, ownerId: string, nature: QiDie["nature"], sides: number): QiDie {
  return { id, label: `d${sides}`, sourceId: sourceName, sourceName, nature, sides, value: null, zone: "QI_POOL", ownerId };
}

const shenQingDice: QiDie[] = [
  die("pc-d1", "沈青·小周天养息功·顶门", "pc-shen-qing", "raw", 6),
  die("pc-d2", "沈青·小周天养息功·丹田", "pc-shen-qing", "raw", 6),
  die("pc-d3", "沈青·小周天养息功·命门", "pc-shen-qing", "yang", 6),
  die("pc-d4", "沈青·小周天养息功·心口", "pc-shen-qing", "yang", 4),
  die("pc-d5", "沈青·小周天养息功·目窍", "pc-shen-qing", "yin", 6),
  die("pc-d6", "沈青·小周天养息功·步根", "pc-shen-qing", "yin", 6),
];

const shortBladeDice: QiDie[] = [
  die("sb-d1", "短兵客·铁衣伏虎劲·丹田", "enemy-short-blade", "raw", 6),
  die("sb-d2", "短兵客·雨步", "enemy-short-blade", "yang", 6),
  die("sb-d3", "短兵客·铁衣伏虎劲·心口", "enemy-short-blade", "yang", 6),
];

const porterDice: QiDie[] = [
  die("bp-d1", "黑衣脚夫·本命·阴", "enemy-porter", "yin", 6),
  die("bp-d2", "黑衣脚夫·本命·中", "enemy-porter", "raw", 6),
  die("bp-d3", "黑衣脚夫·本命·阳", "enemy-porter", "yang", 6),
];

const weiDice: QiDie[] = [
  die("wei-d1", "魏长兴·本命·阴", "pc-wei", "yin", 6),
  die("wei-d2", "魏长兴·本命·阳", "pc-wei", "yang", 6),
];

const lookoutDice: QiDie[] = [
  die("lo-d1", "望风探子·本命·中", "enemy-lookout", "raw", 6),
];

const archerDice: QiDie[] = [
  die("ar-d1", "暗处弓手·本命·中", "enemy-archer", "raw", 6),
];

// ============================================================
// DISTANCE RELATIONS
// ============================================================

const distances = [
  { id: "dist-shen-short-blade", fromActorId: "pc-shen-qing", toActorId: "enemy-short-blade", band: "近身" as const, height: "同层" as const, entangled: false, public: true },
  { id: "dist-shen-porter", fromActorId: "pc-shen-qing", toActorId: "enemy-porter", band: "中距" as const, height: "同层" as const, entangled: false, public: true },
  { id: "dist-shen-lookout", fromActorId: "pc-shen-qing", toActorId: "enemy-lookout", band: "中距" as const, height: "同层" as const, entangled: false, public: true },
  { id: "dist-shen-archer", fromActorId: "pc-shen-qing", toActorId: "enemy-archer", band: "远距" as const, height: "高处" as const, entangled: false, public: true },
  { id: "dist-wei-short-blade", fromActorId: "pc-wei", toActorId: "enemy-short-blade", band: "中距" as const, height: "同层" as const, entangled: false, public: true },
  { id: "dist-wei-porter", fromActorId: "pc-wei", toActorId: "enemy-porter", band: "近身" as const, height: "同层" as const, entangled: false, public: true },
  { id: "dist-short-blade-porter", fromActorId: "enemy-short-blade", toActorId: "enemy-porter", band: "短距" as const, height: "同层" as const, entangled: false, public: false },
];

// ============================================================
// CREATE SEED STATE
// ============================================================

export function createSeedState(): CombatState {
  const actors = structuredClone([actorShenQing, actorWei, actorShortBlade, actorPorter, actorLookout, actorArcher] as Actor[])
    .map((actor) => ({
      ...actor,
      responseBudget: createResponseBudget(actor.maxResponseQuota, actor.maxResponseQuota),
    }));
  return {
    runtime: createRuntimeSession(initialScene.id, "SCENE_FREE"),
    campaignName: tutorialCampaignPack.name,
    sceneName: authoredOpening.campaignScene.name,
    sceneGoal: authoredOpening.campaignScene.objective,
    round: 1,
    phase: "setup",
    activeActorId: "pc-shen-qing",
    initiativeOrder: ["pc-shen-qing", "pc-wei", "enemy-short-blade", "enemy-porter", "enemy-lookout", "enemy-archer"],
    actedActorIds: [],
    encounterMode: "scene",
    turnPaused: false,
    actors,
    dice: structuredClone([...shenQingDice, ...shortBladeDice, ...porterDice, ...weiDice, ...lookoutDice, ...archerDice]),
    tracks: structuredClone(tutorialTracks),
    scene: structuredClone(initialScene),
    distances: structuredClone(distances),
    pendingAction: undefined,
    logs: [],
    feedback: [],
    lastSavedAt: undefined,
  };
}

/**
 * Initial UI state starts before the scene roll. The player/DM must confirm the
 * 3D whole-pool throw; cancelling that overlay leaves this state untouched.
 */
export function createInitialCombatState(): CombatState {
  return createSeedState();
}

export { quickAsMove };
