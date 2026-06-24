import type { CombatPhase, DistanceBand, QiZone } from "../combat/types";

// ========== Local type (was in types.ts, kept here for schema self-containment) ==========
export type CombatEventType =
  | "ENTER_SCENE" | "DECLARE_ACTION" | "LOCK_QI" | "INTERCEPT" | "FORM_MOVE"
  | "REACT" | "APPLY_OUTCOME" | "REGULATE_BREATH" | "REFLECTION" | "EXPIRE_SOURCE"
  | "DM_OVERRIDE" | "USE_ITEM" | "EQUIP_ITEM" | "UNEQUIP_ITEM" | "ITEM_SOURCE_EXPIRED"
  | "TEMP_QI_GRANTED" | "MOMENTUM_CHANGED" | "ROUND_ENDED"
  | "mode_changed" | "phase_changed" | "dice_locked" | "skill_declared" | "target_selected"
  | "effect_rank_resolved" | "damage_applied" | "status_added" | "stance_changed"
  | "distance_changed" | "entangle_changed" | "source_expired" | "item_used"
  | "dm_override" | "dice_rolled" | "qi_entered_sea";

// ========== Term Constants ==========
export const QI_ZONES = ["QI_POOL", "QI_SEA", "QI_LOCK", "QI_REST", "TEMP_QI", "YIN_SLOT", "YANG_SLOT"] as const satisfies readonly QiZone[];
export const QI_ZONE_TERMS = ["气池", "气海", "锁气", "息库", "临气区", "阴槽", "阳槽"] as const;
export const MOMENTUM_TERMS = ["阴盛", "阳盛", "合势", "圆融", "崩势", "失势"] as const;
export const SIX_ROOT_TERMS = ["顶门", "目窍", "心口", "丹田", "命门", "步根"] as const;
export const DISTANCE_BANDS = ["贴身", "近身", "短距", "中距", "远距", "离场"] as const satisfies readonly DistanceBand[];
export const COMBAT_PHASES = ["setup", "initiative", "scene", "declare", "intercept_window", "react_window", "outcome", "round_end"] as const satisfies readonly CombatPhase[];

export const SHI_CONDITIONS = ["无势", "宽势", "中势", "单势"] as const;
export const FORM_POSITIONS = ["起式", "承式", "转式", "收式", "绝式", "无"] as const;
export const STATUS_NAMES = ["迟滞", "破口", "失衡", "流血", "中毒", "燃烧", "冻结", "眩晕", "封穴"] as const;

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

export const LAN_PAYLOAD_FIELDS = {
  room_created: ["room", "seats", "publicState"],
  room_joined: ["playerName", "actorId"],
  seat_assigned: ["seatId", "playerName", "actorId", "ready"],
  public_state_synced: ["publicState"],
  combat_event_committed: ["event"],
  dm_broadcast: ["message", "level"],
  client_error: ["message"],
} as const satisfies Record<(typeof LAN_MESSAGE_TYPES)[number], readonly string[]>;

export const ROOM_SETTING_FIELDS = ["roomName", "hostName", "campaignId", "mode", "allowSpectators", "maxPlayers"] as const;
export const ROOM_SEAT_FIELDS = ["id", "label", "playerName", "actorId", "ready"] as const;
export const COMBAT_LOG_FIELDS = ["id", "type", "round", "message", "public", "createdAt"] as const;

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
  "subCategory",
  "tier",
  "designGrade",
  "yinYangLabel",
  "timing",
  "formPosition",
  "minimumDice",
  "qiRequirement",
  "momentumRequirement",
  "allowedMomentum",
  "hardPrerequisite",
  "rangeAndEquipment",
  "baseEffect",
  "slotTriggers",
  "afterMomentum",
  "resourceFlow",
  "hasIntercept",
  "hasReact",
] as const;

export const RESPONSE_ATTACHMENT_FIELDS = [
  "id",
  "moveId",
  "name",
  "responseType",
  "canCallIndependently",
  "timing",
  "minimumDice",
  "qiRequirement",
  "momentumRequirement",
  "allowedMomentum",
  "rangeAndEquipment",
  "baseEffect",
  "slotTriggers",
  "afterMomentum",
  "resourceFlow",
  "constraints",
] as const;

export const QUICK_ACTION_FIELDS = [
  "id",
  "name",
  "type",
  "timing",
  "minimumDice",
  "qiRequirement",
  "momentumRequirement",
  "permission",
  "effect",
  "limit",
  "resourceFlow",
] as const;

// ========== Interfaces ==========

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface RuleMove {
  id: string;
  name: string;
  category: string;
  subCategory: string;
  tier: string;
  designGrade: string;
  yinYangLabel: string;
  timing: string;
  formPosition: string;
  minimumDice: number;
  qiRequirement: string;
  momentumRequirement: (typeof SHI_CONDITIONS)[number];
  allowedMomentum: Array<(typeof MOMENTUM_TERMS)[number]>;
  hardPrerequisite?: string;
  rangeAndEquipment: string;
  baseEffect: string;
  slotTriggers: string[];
  afterMomentum: string;
  resourceFlow: string;
  hasIntercept: boolean;
  hasReact: boolean;
}

export interface ResponseAttachmentRule {
  id: string;
  moveId: string;
  name: string;
  responseType: "截击" | "应招";
  canCallIndependently: boolean;
  timing: string;
  minimumDice: number;
  qiRequirement: string;
  momentumRequirement?: (typeof SHI_CONDITIONS)[number];
  allowedMomentum: Array<(typeof MOMENTUM_TERMS)[number]>;
  rangeAndEquipment: string;
  baseEffect: string;
  slotTriggers: string[];
  afterMomentum: string;
  resourceFlow: string;
  constraints: string;
}

export interface QuickActionRule {
  id: string;
  name: string;
  type: "出手便行" | "随手便行" | "随手便行·特殊";
  timing: string;
  minimumDice: number;
  qiRequirement: string;
  momentumRequirement?: string;
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

// ========== Standalone Validation Functions ==========

export function validateMove(move: unknown): ValidationResult {
  if (!isRecord(move)) return fail("招式必须是对象");
  const errors = unknownKeys(move, MOVE_FIELDS, `招式`);
  if (typeof move.id !== "string" || move.id.length === 0) errors.push("招式必须有 id");
  if (typeof move.name !== "string" || move.name.length === 0) errors.push("招式必须有 name");
  if (typeof move.category !== "string") errors.push("招式必须有 category");
  if (typeof move.minimumDice !== "number" || move.minimumDice < 0) errors.push("招式 minimumDice 必须是非负整数");
  if (typeof move.qiRequirement !== "string" || move.qiRequirement.length === 0) errors.push("招式必须有 qiRequirement");
  if (typeof move.momentumRequirement !== "string" || !includes(SHI_CONDITIONS, move.momentumRequirement)) {
    errors.push(`非法势条件类型：${String(move.momentumRequirement)}`);
  }
  if (!Array.isArray(move.allowedMomentum)) {
    errors.push("招式 allowedMomentum 必须是数组");
  } else {
    for (const momentum of move.allowedMomentum) {
      if (typeof momentum !== "string" || !includes(MOMENTUM_TERMS, momentum)) {
        errors.push(`非法势：${String(momentum)}`);
      }
    }
  }
  if (typeof move.baseEffect !== "string" || move.baseEffect.length === 0) errors.push("招式必须有 baseEffect");
  if (typeof move.resourceFlow !== "string" || move.resourceFlow.length === 0) errors.push("招式必须有 resourceFlow");
  if (typeof move.hasIntercept !== "boolean") errors.push("招式 hasIntercept 必须是 boolean");
  if (typeof move.hasReact !== "boolean") errors.push("招式 hasReact 必须是 boolean");
  return errors.length ? { ok: false, errors } : ok();
}

export function validateResponse(response: unknown): ValidationResult {
  if (!isRecord(response)) return fail("响应挂载必须是对象");
  const errors = unknownKeys(response, RESPONSE_ATTACHMENT_FIELDS, `响应挂载`);
  if (typeof response.id !== "string" || response.id.length === 0) errors.push("响应挂载必须有 id");
  if (typeof response.moveId !== "string" || response.moveId.length === 0) errors.push("响应挂载必须有 moveId");
  if (typeof response.name !== "string" || response.name.length === 0) errors.push("响应挂载必须有 name");
  if (response.responseType !== "截击" && response.responseType !== "应招") {
    errors.push(`非法响应类型：${String(response.responseType)}`);
  }
  if (typeof response.minimumDice !== "number" || response.minimumDice < 0) errors.push("响应挂载 minimumDice 必须是非负整数");
  if (typeof response.qiRequirement !== "string" || response.qiRequirement.length === 0) errors.push("响应挂载必须有 qiRequirement");
  if (!Array.isArray(response.allowedMomentum)) {
    errors.push("响应挂载 allowedMomentum 必须是数组");
  } else {
    for (const momentum of response.allowedMomentum) {
      if (typeof momentum !== "string" || !includes(MOMENTUM_TERMS, momentum)) {
        errors.push(`非法响应势：${String(momentum)}`);
      }
    }
  }
  if (typeof response.baseEffect !== "string" || response.baseEffect.length === 0) errors.push("响应挂载必须有 baseEffect");
  if (typeof response.resourceFlow !== "string" || response.resourceFlow.length === 0) errors.push("响应挂载必须有 resourceFlow");
  if (typeof response.constraints !== "string") errors.push("响应挂载必须有 constraints");
  return errors.length ? { ok: false, errors } : ok();
}

export function validateQuickAction(qa: unknown): ValidationResult {
  if (!isRecord(qa)) return fail("便行必须是对象");
  const errors = unknownKeys(qa, QUICK_ACTION_FIELDS, `便行`);
  if (typeof qa.id !== "string" || qa.id.length === 0) errors.push("便行必须有 id");
  if (typeof qa.name !== "string" || qa.name.length === 0) errors.push("便行必须有 name");
  if (qa.type !== "出手便行" && qa.type !== "随手便行" && qa.type !== "随手便行·特殊") {
    errors.push(`非法便行类型：${String(qa.type)}`);
  }
  if (typeof qa.minimumDice !== "number" || qa.minimumDice < 0) errors.push("便行 minimumDice 必须是非负整数");
  if (typeof qa.effect !== "string" || qa.effect.length === 0) errors.push("便行必须有 effect");
  if (typeof qa.limit !== "string") errors.push("便行必须有 limit");
  if (typeof qa.resourceFlow !== "string") errors.push("便行必须有 resourceFlow");
  return errors.length ? { ok: false, errors } : ok();
}

// ========== Existing Validation Functions ==========

export function validateCombatEventType(type: string): ValidationResult {
  return includes(COMBAT_EVENTS, type) ? ok() : fail(`非法事件类型：${type}`);
}

export function validateCombatEvent(value: unknown): ValidationResult {
  if (!isRecord(value)) return fail("Combat event must be an object");
  const errors = unknownKeys(value, COMBAT_LOG_FIELDS, "combat_event");
  if (typeof value.type !== "string" || !includes(COMBAT_EVENTS, value.type)) {
    errors.push("combat_event.type is not allowed");
  }
  if (typeof value.id !== "string" || value.id.length === 0) errors.push("combat_event.id is required");
  if (typeof value.round !== "number") errors.push("combat_event.round must be a number");
  if (typeof value.message !== "string") errors.push("combat_event.message is required");
  if (typeof value.public !== "boolean") errors.push("combat_event.public must be boolean");
  if (typeof value.createdAt !== "number") errors.push("combat_event.createdAt must be a number");
  return errors.length ? { ok: false, errors } : ok();
}

export function validateRuleCatalog(catalog: RuleCatalog): ValidationResult {
  const errors: string[] = [];
  for (const move of catalog.moves) {
    const result = validateMove(move);
    errors.push(...result.errors);
  }
  for (const response of catalog.responses) {
    const result = validateResponse(response);
    errors.push(...result.errors);
  }
  for (const quick of catalog.quickActions) {
    const result = validateQuickAction(quick);
    errors.push(...result.errors);
  }
  return errors.length ? { ok: false, errors } : ok();
}

export function validateLanMessage(value: unknown): ValidationResult {
  if (!isRecord(value)) return fail("LAN 消息必须是对象");
  const allowed = ["type", "roomCode", "senderId", "payload"] as const;
  const errors = unknownKeys(value, allowed, "LAN消息");
  const messageType = String(value.type);
  if (!includes(LAN_MESSAGE_TYPES, messageType)) errors.push(`非法 LAN 消息类型：${String(value.type)}`);
  if (typeof value.roomCode !== "string" || !/^LAN-[A-Z0-9]{4}$/.test(value.roomCode)) errors.push("房间码必须是 LAN-XXXX");
  if (typeof value.senderId !== "string" || value.senderId.length === 0) errors.push("senderId 必须存在");
  if (includes(LAN_MESSAGE_TYPES, messageType)) {
    errors.push(...validateLanPayload(messageType, value.payload));
  }
  return errors.length ? { ok: false, errors } : ok();
}

export function validateStatusRecord(value: unknown): ValidationResult {
  if (!isRecord(value)) return fail("状态必须是对象");
  const errors = unknownKeys(value, STATUS_FIELDS, "状态");
  if (typeof value.name !== "string" || value.name.length === 0) errors.push("状态名必须存在");
  if (typeof value.public !== "boolean") errors.push("状态必须声明是否公开");
  return errors.length ? { ok: false, errors } : ok();
}

// ========== Helpers ==========

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

function validateLanPayload(type: (typeof LAN_MESSAGE_TYPES)[number], payload: unknown): string[] {
  if (!isRecord(payload)) return [`${type}.payload must be an object`];
  const errors = unknownKeys(payload, LAN_PAYLOAD_FIELDS[type], `${type}.payload`);

  if (type === "room_created") {
    if (!isRecord(payload.room)) {
      errors.push("room_created.payload.room is required");
    } else {
      errors.push(...unknownKeys(payload.room, ROOM_SETTING_FIELDS, "room_created.payload.room"));
    }
    if (!Array.isArray(payload.seats)) {
      errors.push("room_created.payload.seats must be an array");
    } else {
      payload.seats.forEach((seat, index) => {
        if (!isRecord(seat)) {
          errors.push(`room_created.payload.seats[${index}] must be an object`);
          return;
        }
        errors.push(...unknownKeys(seat, ROOM_SEAT_FIELDS, `room_created.payload.seats[${index}]`));
      });
    }
  }

  if (type === "room_joined") {
    if (typeof payload.playerName !== "string" || payload.playerName.length === 0) errors.push("room_joined.payload.playerName is required");
    if ("actorId" in payload && typeof payload.actorId !== "string") errors.push("room_joined.payload.actorId must be a string");
  }

  if (type === "seat_assigned") {
    if (typeof payload.seatId !== "string" || payload.seatId.length === 0) errors.push("seat_assigned.payload.seatId is required");
    if ("playerName" in payload && typeof payload.playerName !== "string") errors.push("seat_assigned.payload.playerName must be a string");
    if ("actorId" in payload && typeof payload.actorId !== "string") errors.push("seat_assigned.payload.actorId must be a string");
    if ("ready" in payload && typeof payload.ready !== "boolean") errors.push("seat_assigned.payload.ready must be boolean");
  }

  if (type === "public_state_synced" && !("publicState" in payload)) {
    errors.push("public_state_synced.payload.publicState is required");
  }

  if (type === "combat_event_committed") {
    errors.push(...validateCombatEvent(payload.event).errors);
  }

  if (type === "dm_broadcast") {
    if (typeof payload.message !== "string" || payload.message.length === 0) errors.push("dm_broadcast.payload.message is required");
    if ("level" in payload && !["info", "warning", "danger"].includes(String(payload.level))) errors.push("dm_broadcast.payload.level is not allowed");
  }

  if (type === "client_error" && (typeof payload.message !== "string" || payload.message.length === 0)) {
    errors.push("client_error.payload.message is required");
  }

  return errors;
}
