import type { CombatEventType, CombatPhase, DistanceBand, QiZone } from "../combat/types";

export const QI_ZONES = ["QI_POOL", "QI_SEA", "QI_LOCK", "QI_REST", "TEMP_QI"] as const satisfies readonly QiZone[];
export const QI_ZONE_TERMS = ["气池", "气海", "锁气", "息库", "临气区"] as const;
export const MOMENTUM_TERMS = ["阴盛", "阳盛", "合势", "圆融", "崩溃", "失势"] as const;
export const SIX_ROOT_TERMS = ["头部/顶门", "眼", "心", "丹田", "腰", "腿"] as const;
export const DISTANCE_BANDS = ["贴身", "近身", "短距", "中距", "远距", "离场"] as const satisfies readonly DistanceBand[];
export const COMBAT_PHASES = ["setup", "initiative", "scene", "declare", "intercept_window", "react_window", "outcome", "round_end"] as const satisfies readonly CombatPhase[];

export const COMBAT_EVENTS = [
  "ENTER_SCENE",
  "DECLARE_ACTION",
  "LOCK_QI",
  "INTERCEPT",
  "FORM_MOVE",
  "REACT",
  "APPLY_OUTCOME",
  "REGULATE_BREATH",
  "REFLECTION",
  "EXPIRE_SOURCE",
  "DM_OVERRIDE",
  "USE_ITEM",
  "EQUIP_ITEM",
  "UNEQUIP_ITEM",
  "ITEM_SOURCE_EXPIRED",
  "TEMP_QI_GRANTED",
  "MOMENTUM_CHANGED",
  "ROUND_ENDED",
  "mode_changed",
  "phase_changed",
  "dice_locked",
  "skill_declared",
  "target_selected",
  "effect_rank_resolved",
  "damage_applied",
  "status_added",
  "stance_changed",
  "distance_changed",
  "entangle_changed",
  "source_expired",
  "item_used",
  "dm_override",
  "dice_rolled",
  "qi_entered_sea",
] as const satisfies readonly CombatEventType[];

export const LAN_MESSAGE_TYPES = [
  "room_created",
  "room_joined",
  "seat_assigned",
  "public_state_synced",
  "combat_event_committed",
  "dm_broadcast",
  "client_error",
] as const;

export const STATUS_FIELDS = [
  "name",
  "type",
  "stacks",
  "durationRounds",
  "source",
  "public",
  "affectsSixRoots",
  "affectsQi",
  "affectsDistance",
  "settlesAtRoundEnd",
] as const;

export const MOVE_FIELDS = [
  "id",
  "name",
  "category",
  "subtype",
  "timing",
  "minimumDice",
  "qiRequirement",
  "momentumRequirement",
  "allowedMomentum",
  "rangeAndEquipment",
  "baseEffect",
  "slotTriggers",
] as const;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface RuleMove {
  id: string;
  name: string;
  category: string;
  subtype: string;
  timing: string;
  minimumDice: number;
  qiRequirement: string;
  momentumRequirement: "无势" | "宽势" | "中势" | "单势";
  allowedMomentum: Array<(typeof MOMENTUM_TERMS)[number]>;
  rangeAndEquipment: string;
  baseEffect: string;
  slotTriggers: string[];
}

export interface ResponseAttachmentRule {
  id: string;
  moveId: string;
  name: string;
  responseType: "截击" | "应招";
  timing: string;
  minimumDice: number;
  qiRequirement: string;
  allowedMomentum: Array<(typeof MOMENTUM_TERMS)[number]>;
  baseEffect: string;
  afterMomentum: string;
}

export interface QuickActionRule {
  id: string;
  name: string;
  type: "出手便行" | "随手便行";
  timing: string;
  minimumDice: number;
  qiRequirement: string;
  permission: string;
  effect: string;
  limit: string;
  resourceFlow: string;
}

export interface RuleCatalog {
  moves: RuleMove[];
  responses: ResponseAttachmentRule[];
  quickActions: QuickActionRule[];
}

export interface LanMessage {
  type: (typeof LAN_MESSAGE_TYPES)[number];
  roomCode: string;
  senderId: string;
  payload: unknown;
}

export function validateCombatEventType(type: string): ValidationResult {
  return includes(COMBAT_EVENTS, type) ? ok() : fail(`非法事件类型：${type}`);
}

export function validateRuleCatalog(catalog: RuleCatalog): ValidationResult {
  const errors: string[] = [];
  for (const move of catalog.moves) {
    errors.push(...unknownKeys(move, MOVE_FIELDS, `招式 ${move.id}`));
    if (!move.id || !move.name) errors.push("招式必须有 id 和 name");
    if (!["无势", "宽势", "中势", "单势"].includes(move.momentumRequirement)) errors.push(`非法势条件类型：${move.momentumRequirement}`);
    for (const momentum of move.allowedMomentum) {
      if (!includes(MOMENTUM_TERMS, momentum)) errors.push(`非法势：${momentum}`);
    }
  }
  for (const response of catalog.responses) {
    if (response.responseType !== "截击" && response.responseType !== "应招") errors.push(`非法响应类型：${response.responseType}`);
    for (const momentum of response.allowedMomentum) {
      if (!includes(MOMENTUM_TERMS, momentum)) errors.push(`非法响应势：${momentum}`);
    }
  }
  for (const quick of catalog.quickActions) {
    if (quick.type !== "出手便行" && quick.type !== "随手便行") errors.push(`非法便行类型：${quick.type}`);
  }
  return errors.length ? { ok: false, errors } : ok();
}

export function validateLanMessage(value: unknown): ValidationResult {
  if (!isRecord(value)) return fail("LAN 消息必须是对象");
  const allowed = ["type", "roomCode", "senderId", "payload"] as const;
  const errors = unknownKeys(value, allowed, "LAN消息");
  if (!includes(LAN_MESSAGE_TYPES, String(value.type))) errors.push(`非法 LAN 消息类型：${String(value.type)}`);
  if (typeof value.roomCode !== "string" || !/^LAN-[A-Z0-9]{4}$/.test(value.roomCode)) errors.push("房间码必须是 LAN-XXXX");
  if (typeof value.senderId !== "string" || value.senderId.length === 0) errors.push("senderId 必须存在");
  return errors.length ? { ok: false, errors } : ok();
}

export function validateStatusRecord(value: unknown): ValidationResult {
  if (!isRecord(value)) return fail("状态必须是对象");
  const errors = unknownKeys(value, STATUS_FIELDS, "状态");
  if (typeof value.name !== "string" || value.name.length === 0) errors.push("状态名必须存在");
  if (typeof value.public !== "boolean") errors.push("状态必须声明是否公开");
  return errors.length ? { ok: false, errors } : ok();
}

function ok(): ValidationResult {
  return { ok: true, errors: [] };
}

function fail(message: string): ValidationResult {
  return { ok: false, errors: [message] };
}

function includes<T extends readonly string[]>(items: T, value: string): value is T[number] {
  return (items as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unknownKeys(value: object, allowed: readonly string[], label: string): string[] {
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => `${label} 含非法字段：${key}`);
}
