import type {
  Actor,
  CombatLogEntry,
  CombatFeedbackEvent,
  CombatState,
  DistanceBand,
  InventoryItem,
  Move,
  MoveTrigger,
  QiDie,
  QiZone,
  ResponseAttachment,
  SlotValues,
  StatusEffect,
  ShiState,
  ShiCondition,
} from "./types";
import { deriveTargetState } from "../lib/combat/targetValidation";
import { createAvailabilityResult, type AvailabilityCheck, type AvailabilityResult } from "../data/schema/availability";
import { computeTurnOrder } from "../lib/combat/turnOrder";
import {
  beginCombatEncounter,
  beginNewScene,
  canSpendResponseBudget,
  confirmCombatInitiative,
  normalizeResponseBudget,
  resetResponseBudget,
  setSceneMode,
  spendResponseBudget,
  syncActiveSequence,
  type ResponseBudgetKind,
} from "../domain/session/runtime";

export type RollFn = (sides: number) => number;

export const defaultRoll: RollFn = (sides) => Math.floor(Math.random() * sides) + 1;

export interface ActionAvailability {
  allowed: boolean;
  reasons: string[];
  availability: AvailabilityResult;
}

// ============================================================================
// PARSE HELPERS
// ============================================================================

/**
 * Parse a trigger condition string against slot values.
 * Handles: "阳值≥N", "阴值≥N", "合值≥N", "阴阳差≥N"
 */
export function parseCondition(condition: string, slotValues: SlotValues): boolean {
  const trimmed = condition.trim();

  if (trimmed.startsWith("阳值≥")) {
    const n = parseInt(trimmed.slice(3), 10);
    if (isNaN(n)) return false;
    return slotValues.阳值 >= n;
  }

  if (trimmed.startsWith("阴值≥")) {
    const n = parseInt(trimmed.slice(3), 10);
    if (isNaN(n)) return false;
    return slotValues.阴值 >= n;
  }

  if (trimmed.startsWith("合值≥")) {
    const n = parseInt(trimmed.slice(3), 10);
    if (isNaN(n)) return false;
    return slotValues.合值 >= n;
  }

  if (trimmed.startsWith("阴阳差≥")) {
    const n = parseInt(trimmed.slice(4), 10);
    if (isNaN(n)) return false;
    return slotValues.阴阳差 >= n;
  }

  // Also handle "阳值≤N" and other variants
  if (trimmed.startsWith("阳值≤")) {
    const n = parseInt(trimmed.slice(3), 10);
    if (isNaN(n)) return false;
    return slotValues.阳值 <= n;
  }

  if (trimmed.startsWith("阴值≤")) {
    const n = parseInt(trimmed.slice(3), 10);
    if (isNaN(n)) return false;
    return slotValues.阴值 <= n;
  }

  if (trimmed.startsWith("合值≤")) {
    const n = parseInt(trimmed.slice(3), 10);
    if (isNaN(n)) return false;
    return slotValues.合值 <= n;
  }

  if (trimmed.startsWith("阴阳差≤")) {
    const n = parseInt(trimmed.slice(4), 10);
    if (isNaN(n)) return false;
    return slotValues.阴阳差 <= n;
  }

  return false;
}

export interface ParsedEffect {
  damage?: number;
  heal?: number;
  preventDamage?: number;
  /** Momentum change from trigger (e.g., "自身转入失势" → "失势") */
  momentumChange?: ShiState;
  statuses?: Array<{ name: string; layers: number; target: "self" | "target" }>;
  effects?: string[];
}

/**
 * Parse a base effect string into structured data.
 * Handles:
 *   "造成气血N点" → { damage: N }
 *   "抵消气血N点" → { preventDamage: N }
 *   "目标XXN层" → { statuses: [{ name: "XX", layers: N, target: "target" }] }
 *   "自身XXN层" → { statuses: [{ name: "XX", layers: N, target: "self" }] }
 */
export function parseBaseEffect(effect = ""): ParsedEffect {
  const result: ParsedEffect = {};

  const trimmed = effect.trim();

  // "造成气血N点"
  const damageMatch = trimmed.match(/造成气血(\d+)点/);
  if (damageMatch) {
    result.damage = parseInt(damageMatch[1], 10);
  }

  // "抵消气血N点" or "气血结果-N"
  const preventMatch = trimmed.match(/抵消气血(\d+)点|气血结果-(\d+)/);
  if (preventMatch) {
    const n = parseInt(preventMatch[1] || preventMatch[2], 10);
    result.preventDamage = (result.preventDamage ?? 0) + n;
  }

  // "目标XXN层"
  const targetStatusMatch = trimmed.match(/目标(\S+?)(\d+)层/g);
  if (targetStatusMatch) {
    result.statuses = result.statuses ?? [];
    for (const m of targetStatusMatch) {
      const parsed = m.match(/目标(\S+?)(\d+)层/);
      if (parsed) {
        result.statuses.push({ name: parsed[1], layers: parseInt(parsed[2], 10), target: "target" });
      }
    }
  }

  // "自身XXN层"
  const selfStatusMatch = trimmed.match(/自身(\S+?)(\d+)层/g);
  if (selfStatusMatch) {
    result.statuses = result.statuses ?? [];
    for (const m of selfStatusMatch) {
      const parsed = m.match(/自身(\S+?)(\d+)层/);
      if (parsed) {
        result.statuses.push({ name: parsed[1], layers: parseInt(parsed[2], 10), target: "self" });
      }
    }
  }

  // "自身转入失势" / "自身崩势" / "自身失势" — momentum change triggers
  const momentumMatch = trimmed.match(/自身(?:转入)?(失势|崩势|阴盛|阳盛|合势|圆融)/);
  if (momentumMatch) {
    result.momentumChange = momentumMatch[1] as ShiState;
  }

  // "气血+N"
  const healMatch = trimmed.match(/气血\+(\d+)/);
  if (healMatch) {
    result.heal = parseInt(healMatch[1], 10);
  }

  // Clean remaining text
  const cleaned = trimmed
    .replace(/造成气血\d+点/g, "")
    .replace(/抵消气血\d+点/g, "")
    .replace(/气血结果-\d+/g, "")
    .replace(/目标\S+?\d+层/g, "")
    .replace(/自身\S+?\d+层/g, "")
    .replace(/自身(?:转入)?(失势|崩势|阴盛|阳盛|合势|圆融)/g, "")
    .replace(/气血\+\d+/g, "")
    .trim();

  if (cleaned.length > 0) {
    result.effects = [cleaned];
  }

  return result;
}

/**
 * Extract numeric damage from a base effect string.
 * Parses "造成气血N点" → N. Returns 0 if no damage found.
 */
function extractDamage(effect = ""): number {
  const match = effect.match(/造成气血(\d+)点/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if the actor's current momentum is allowed for this shi condition + range.
 */
export function validateMomentum(
  actor: Actor,
  shiCondition: ShiCondition,
  allowedShi: ShiState[] | undefined,
): { valid: boolean; reason?: string } {
  // 无势: any momentum is allowed
  if (shiCondition === "无势") {
    return { valid: true };
  }

  // 崩势 special rule: cannot declare formal actions or strong responses
  if (actor.momentum === "崩势") {
    return { valid: false, reason: `角色处于崩势状态，不能声明正式出手或强响应` };
  }

  // Older saved sessions predate the explicit allowedShi field. Treat a
  // missing range as an unexpressed restriction instead of crashing the UI.
  const allowed = Array.isArray(allowedShi) ? allowedShi : [];
  if (allowed.length === 0) {
    return { valid: true };
  }

  // Check if current momentum is in the allowed range
  if (!allowed.includes(actor.momentum)) {
    return {
      valid: false,
      reason: `势条件不满足：当前为「${actor.momentum}」，需要「${allowed.join("、")}」`,
    };
  }

  return { valid: true };
}

/**
 * Validate that selected dice satisfy the qi nature threshold.
 * Rules:
 *   - "至少1阳": need at least 1 yang die
 *   - "至少1阴": need at least 1 yin die
 *   - "至少1阴1阳": need at least 1 yin AND 1 yang
 *   - "任意气性": any natures allowed
 *   - Raw qi can enter either slot, but in "至少1阴+1阳" thresholds,
 *     raw dice only satisfy one side
 */
export function validateQiNature(
  dice: QiDie[],
  threshold = "",
): { valid: boolean; reason?: string } {
  const trimmed = threshold.trim();

  if (trimmed === "任意气性" || trimmed === "任意" || trimmed === "") {
    return { valid: true };
  }

  const yinCount = dice.filter((d) => d.nature === "yin").length;
  const yangCount = dice.filter((d) => d.nature === "yang").length;
  const rawCount = dice.filter((d) => d.nature === "raw").length;

  if (trimmed === "至少1阳") {
    if (yangCount >= 1 || rawCount >= 1) return { valid: true };
    return { valid: false, reason: "需要至少1枚阳气骰，原始气骰也可满足" };
  }

  if (trimmed === "至少1阴") {
    if (yinCount >= 1 || rawCount >= 1) return { valid: true };
    return { valid: false, reason: "需要至少1枚阴气骰，原始气骰也可满足" };
  }

  if (trimmed === "至少1阴1阳" || trimmed === "至少1阴+1阳") {
    // Raw dice can only satisfy one side
    const yinSatisfied = yinCount >= 1;
    const yangSatisfied = yangCount >= 1;

    if (yinSatisfied && yangSatisfied) return { valid: true };
    if (yinSatisfied && !yangSatisfied && rawCount >= 1) return { valid: true };
    if (!yinSatisfied && yangSatisfied && rawCount >= 1) return { valid: true };
    if (!yinSatisfied && !yangSatisfied && rawCount >= 2) return { valid: true };

    return { valid: false, reason: "需要至少1枚阴气骰和1枚阳气骰；原始气骰只能满足其中一侧" };
  }

  // "至少1原始" or "至少1原始，或阴阳各1"
  if (trimmed.includes("至少1原始")) {
    if (rawCount >= 1) return { valid: true };
    // Also allow "阴阳各1" as alternative
    if (yinCount >= 1 && yangCount >= 1) return { valid: true };
    return { valid: false, reason: "需要至少1枚原始气骰，或阴气阳气各1枚" };
  }

  // "至少2阴"
  const multiYinMatch = trimmed.match(/至少(\d+)阴/);
  if (multiYinMatch) {
    const need = parseInt(multiYinMatch[1], 10);
    const totalYin = yinCount + rawCount;
    if (totalYin >= need) return { valid: true };
    return { valid: false, reason: `需要至少${need}枚阴气骰（原始气骰可计入）` };
  }

  // "至少N阳"
  const multiYangMatch = trimmed.match(/至少(\d+)阳/);
  if (multiYangMatch) {
    const need = parseInt(multiYangMatch[1], 10);
    const totalYang = yangCount + rawCount;
    if (totalYang >= need) return { valid: true };
    return { valid: false, reason: `需要至少${need}枚阳气骰（原始气骰可计入）` };
  }

  // If threshold mentions specific numbers like "至少3阳2阴"
  const combinedMatch = trimmed.match(/至少(\d+)阳(\d+)阴/);
  if (combinedMatch) {
    const yangNeed = parseInt(combinedMatch[1], 10);
    const yinNeed = parseInt(combinedMatch[2], 10);

    // Allocate raw dice optimally: raw can serve as either yin or yang but not both
    let yinCovered = yinCount;
    let yangCovered = yangCount;
    let rawRemaining = rawCount;

    // First, try to satisfy yin gap with raw
    const yinGap = Math.max(0, yinNeed - yinCovered);
    const yinFromRaw = Math.min(yinGap, rawRemaining);
    yinCovered += yinFromRaw;
    rawRemaining -= yinFromRaw;

    // Then, try to satisfy yang gap with remaining raw
    const yangGap = Math.max(0, yangNeed - yangCovered);
    const yangFromRaw = Math.min(yangGap, rawRemaining);
    yangCovered += yangFromRaw;

    if (yinCovered >= yinNeed && yangCovered >= yangNeed) return { valid: true };
    return { valid: false, reason: `需要至少${yangNeed}阳${yinNeed}阴的骰子配置` };
  }

  // Default: allow if we can't parse
  return { valid: true };
}

/**
 * Check if the actor has the required equipment.
 * The permission string describes what's needed.
 */
export function validateEquipPermission(
  actor: Actor,
  permission?: string,
): { valid: boolean; reason?: string } {
  if (!permission || permission.trim() === "" || permission.trim() === "无") {
    return { valid: true };
  }

  const perm = permission.trim();

  // Check if actor has a weapon equipped
  const hasWeapon = !!actor.equippedWeapon;

  // Find the equipped weapon item
  const weaponItem = hasWeapon
    ? actor.inventory.find((item) => item.id === actor.equippedWeapon)
    : undefined;

  // Check for specific weapon types
  if (perm.includes("主手刀") || perm.includes("刀")) {
    if (!hasWeapon) return { valid: false, reason: "需要装备主手刀" };
    // Check if weapon name or category contains 刀
    const weaponName = weaponItem?.name ?? "";
    if (!weaponName.includes("刀")) {
      return { valid: false, reason: `需要刀类武器，当前装备「${weaponName}」` };
    }
  }

  if (perm.includes("剑")) {
    if (!hasWeapon) return { valid: false, reason: "需要装备剑" };
    const weaponName = weaponItem?.name ?? "";
    if (!weaponName.includes("剑")) {
      return { valid: false, reason: `需要剑类武器，当前装备「${weaponName}」` };
    }
  }

  if (perm.includes("短兵")) {
    if (!hasWeapon) return { valid: false, reason: "需要装备短兵" };
  }

  if (perm.includes("空手")) {
    // 空手 means bare-handed; if they have a weapon, it's ok for 空手 too
    // (空手 can mean "unarmed or light weapon")
  }

  if (perm.includes("持械") && !hasWeapon) {
    return { valid: false, reason: "需要持有武器" };
  }

  if (perm.includes("主手") || perm.includes("副手")) {
    if (!hasWeapon) return { valid: false, reason: "需要装备武器" };
  }

  // If the permission is met by any inventory item's grantsPermission
  const hasItemPermission = actor.inventory.some(
    (item) => item.equipped && item.grantsPermission && item.grantsPermission.includes(perm),
  );

  if (hasItemPermission) {
    return { valid: true };
  }

  // If we couldn't validate specifically, but actor has something relevant
  if (hasWeapon && (perm.includes("刀") || perm.includes("剑") || perm.includes("持械") || perm.includes("主手") || perm.includes("短兵"))) {
    return { valid: true };
  }

  // Check for "可收束姿态" or similar - always available
  if (perm.includes("可收束姿态")) {
    return { valid: true };
  }

  // "有药物、布条或可替代材料" - check inventory
  if (perm.includes("药物") || perm.includes("材料")) {
    const hasMaterial = actor.inventory.some(
      (item) =>
        item.category === "medicine" ||
        item.category === "tool" ||
        item.name.includes("药") ||
        item.name.includes("布"),
    );
    if (hasMaterial) return { valid: true };
    // Don't fail here — DM might allow it
  }

  // If the permission just describes the target (e.g., "近身人物目标"), it's not an equipment check
  if (
    perm.startsWith("近身") ||
    perm.startsWith("自己") ||
    perm.startsWith("相邻") ||
    perm.startsWith("同一")
  ) {
    return { valid: true };
  }

  return { valid: true }; // Default: allow; DM can override
}

// ============================================================================
// SLOT VALUE CALCULATION
// ============================================================================

/**
 * Calculate slot values from the current pending action's dice.
 * Pure function — does not mutate state.
 */
export function calculateSlotValues(state: CombatState): SlotValues {
  const action = state.pendingAction;
  if (!action) {
    return { 阴值: 0, 阳值: 0, 合值: 0, 阴阳差: 0 };
  }

  const yinDice = state.dice.filter((d) => action.yinSlotDiceIds.includes(d.id) && d.zone === "YIN_SLOT");
  const yangDice = state.dice.filter((d) => action.yangSlotDiceIds.includes(d.id) && d.zone === "YANG_SLOT");

  const 阴值 = yinDice.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const 阳值 = yangDice.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const 合值 = 阴值 + 阳值;
  const 阴阳差 = Math.abs(阴值 - 阳值);

  return { 阴值, 阳值, 合值, 阴阳差 };
}

function resetActorResponseBudgets(actor: Actor): Actor {
  const budget = normalizeResponseBudget(
    actor.responseBudget,
    actor.responseQuotaUsed,
    actor.maxResponseQuota,
  );
  return {
    ...actor,
    responseQuotaUsed: 0,
    responseBudget: resetResponseBudget(budget),
  };
}

function spendActorResponseBudget(
  actor: Actor,
  kind: ResponseBudgetKind,
): Actor {
  const budget = normalizeResponseBudget(
    actor.responseBudget,
    actor.responseQuotaUsed,
    actor.maxResponseQuota,
  );
  if (!canSpendResponseBudget(budget, kind)) {
    throw new Error(kind === "proactive"
      ? `${actor.name} 本轮主动响应额度已用完。`
      : `${actor.name} 本轮自保应招额度已用完。`);
  }
  const nextBudget = spendResponseBudget(budget, kind);
  return {
    ...actor,
    // Legacy UI only represented proactive intervention. Keep it as a mirror
    // until the embedded response dock lands in phase 3.
    responseQuotaUsed: kind === "proactive" ? nextBudget.proactiveUsed : actor.responseQuotaUsed,
    responseBudget: nextBudget,
  };
}

function syncRuntimeSequence(state: CombatState): CombatState {
  return {
    ...state,
    runtime: syncActiveSequence(state.runtime, {
      round: state.round,
      phase: state.phase === "scene" ? undefined : state.phase,
      activeActorId: state.activeActorId,
      initiativeOrder: state.initiativeOrder,
      actedActorIds: state.actedActorIds,
      paused: state.turnPaused,
    }),
  };
}

/**
 * Response attachments use their own dice for trigger values. Until the UI
 * gains a full two-slot response editor, fixed-nature dice go to their matching
 * slot and raw dice are assigned one-by-one to the currently lower total. This
 * is deterministic, visible in the log, and never reuses the attacker's slots.
 */
export function calculateResponseSlotValues(
  dice: QiDie[],
  slots?: { yinSlotDiceIds?: string[]; yangSlotDiceIds?: string[] },
): SlotValues {
  if (slots) {
    const yinIds = new Set(slots.yinSlotDiceIds ?? []);
    const yangIds = new Set(slots.yangSlotDiceIds ?? []);
    const 阴值 = dice.filter((die) => yinIds.has(die.id)).reduce((sum, die) => sum + (die.value ?? 0), 0);
    const 阳值 = dice.filter((die) => yangIds.has(die.id)).reduce((sum, die) => sum + (die.value ?? 0), 0);
    const 合值 = 阴值 + 阳值;
    return { 阴值, 阳值, 合值, 阴阳差: Math.abs(阴值 - 阳值) };
  }
  let 阴值 = dice
    .filter((die) => die.nature === "yin")
    .reduce((sum, die) => sum + (die.value ?? 0), 0);
  let 阳值 = dice
    .filter((die) => die.nature === "yang")
    .reduce((sum, die) => sum + (die.value ?? 0), 0);

  const rawDice = dice
    .filter((die) => die.nature === "raw")
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0) || left.id.localeCompare(right.id));
  for (const die of rawDice) {
    if (阴值 <= 阳值) 阴值 += die.value ?? 0;
    else 阳值 += die.value ?? 0;
  }

  const 合值 = 阴值 + 阳值;
  return { 阴值, 阳值, 合值, 阴阳差: Math.abs(阴值 - 阳值) };
}

function validateResponseSlotAllocation(
  dice: QiDie[],
  slots?: { yinSlotDiceIds?: string[]; yangSlotDiceIds?: string[] },
): void {
  if (!slots) return;
  const yinIds = slots.yinSlotDiceIds ?? [];
  const yangIds = slots.yangSlotDiceIds ?? [];
  const allIds = [...yinIds, ...yangIds];
  const spentIds = dice.map((die) => die.id);
  if (new Set(allIds).size !== allIds.length
    || allIds.length !== spentIds.length
    || spentIds.some((id) => !allIds.includes(id))) {
    throw new Error("响应气骰必须各自明确分配到一个阴槽或阳槽。");
  }
  if (dice.some((die) => yinIds.includes(die.id) && die.nature === "yang")) {
    throw new Error("阳气骰不能投入响应阴槽。");
  }
  if (dice.some((die) => yangIds.includes(die.id) && die.nature === "yin")) {
    throw new Error("阴气骰不能投入响应阳槽。");
  }
}

// ============================================================================
// TRIGGER RESOLUTION
// ============================================================================

export interface ResolvedTrigger {
  type: MoveTrigger["type"];
  condition: string;
  effect: string;
  triggered: boolean;
  parsedEffect?: ParsedEffect;
}

/**
 * Evaluate all triggers of a move/response against slot values.
 * Returns the list of triggered effects.
 */
export function resolveSlotTriggers(
  triggers: MoveTrigger[],
  slotValues: SlotValues,
): ResolvedTrigger[] {
  return triggers.map((trigger) => {
    const triggered = parseCondition(trigger.condition, slotValues);
    const parsedEffect = triggered ? parseBaseEffect(trigger.effect) : undefined;
    return {
      type: trigger.type,
      condition: trigger.condition,
      effect: trigger.effect,
      triggered,
      parsedEffect,
    };
  });
}

// ============================================================================
// ACTION AVAILABILITY CHECK
// ============================================================================

export function canDeclareAction(
  state: CombatState,
  actorId: string,
  moveId: string,
  slotDice: { yinSlotDiceIds?: string[]; yangSlotDiceIds?: string[] },
  diceIds?: string[],
): ActionAvailability {
  const actor = state.actors.find((item) => item.id === actorId);
  const move = actor?.moves.find((item) => item.id === moveId);
  const reasons: string[] = [];

  if (!actor || !move) {
    const availability = createAvailabilityResult([{ dimension: "target", status: "fail", reason: "未找到行动或角色" }]);
    return { allowed: false, reasons: availability.reasons, availability };
  }

  const checks: AvailabilityCheck[] = [
    { dimension: "mode", status: "pass" },
    { dimension: "distance", status: "not_evaluated", reason: "选择目标后检查距离" },
    { dimension: "target", status: "not_evaluated", reason: "选择目标后检查对象" },
    { dimension: "response_budget", status: "not_applicable" },
  ];

  if (state.activeActorId !== actorId) {
    reasons.push("不是当前行动者");
    checks.push({ dimension: "timepoint", status: "fail", reason: "不是当前行动者" });
  }

  if (state.phase !== "scene" && state.phase !== "declare") {
    reasons.push("当前时点不允许宣言");
    checks.push({ dimension: "timepoint", status: "fail", reason: "当前时点不允许宣言" });
  } else if (state.activeActorId === actorId) {
    checks.push({ dimension: "timepoint", status: "pass" });
  }

  // Momentum validation
  const momentumCheck = validateMomentum(actor, move.shiCondition, move.allowedShi);
  if (!momentumCheck.valid && momentumCheck.reason) {
    reasons.push(momentumCheck.reason);
    checks.push({ dimension: "momentum", status: "fail", reason: momentumCheck.reason });
  } else {
    checks.push({ dimension: "momentum", status: "pass" });
  }

  // Equipment validation
  const equipCheck = validateEquipPermission(actor, move.equipPermission);
  if (!equipCheck.valid && equipCheck.reason) {
    reasons.push(equipCheck.reason);
    checks.push({ dimension: "equipment", status: "fail", reason: equipCheck.reason });
  } else {
    checks.push({ dimension: "equipment", status: "pass" });
  }

  // Formal move (正式出手) requires both yin and yang slot dice
  if (move.timing === "正式出手") {
    if ((slotDice.yinSlotDiceIds?.length ?? 0) === 0) {
      reasons.push("缺少阴槽气骰（正式出手必须配置阴槽和阳槽）");
      checks.push({ dimension: "qi", status: "fail", reason: "缺少阴槽气骰" });
    }
    if ((slotDice.yangSlotDiceIds?.length ?? 0) === 0) {
      reasons.push("缺少阳槽气骰（正式出手必须配置阴槽和阳槽）");
      checks.push({ dimension: "qi", status: "fail", reason: "缺少阳槽气骰" });
    }
  }

  // Qi nature threshold check (if diceIds provided)
  if (diceIds && diceIds.length > 0) {
    const selectedDice = diceIds
      .map((id) => state.dice.find((d) => d.id === id))
      .filter((d): d is QiDie => !!d);

    const qiCheck = validateQiNature(selectedDice, move.qiNatureThreshold);
    if (!qiCheck.valid && qiCheck.reason) {
      reasons.push(qiCheck.reason);
      checks.push({ dimension: "qi", status: "fail", reason: qiCheck.reason });
    }
  }
  if (!checks.some((check) => check.dimension === "qi" && check.status === "fail")) {
    checks.push({ dimension: "qi", status: "pass" });
  }
  const availability = createAvailabilityResult(checks);
  return { allowed: availability.available, reasons: availability.reasons, availability };
}

// ============================================================================
// CORE ENGINE FUNCTIONS
// ============================================================================

export function prepareCombatRound(state: CombatState): CombatState {
  let next = cloneState(state);
  const encounterNumber = next.logs.filter((entry) => entry.type === "COMBAT_ENCOUNTER_STARTED").length + 1;
  next.runtime = beginCombatEncounter(
    next.runtime,
    `${next.scene.id}:combat:${encounterNumber}`,
  );
  next.phase = "initiative";
  next.encounterMode = "combat";
  next.round = 1;
  next.initiativeOrder = [];
  next.actedActorIds = [];
  next.pendingAction = undefined;
  next = appendLog(next, "COMBAT_ENCOUNTER_STARTED", "交锋轮开始：建立独立战斗先后与第1轮；沿用当前气海、息库与骰值，不重投常规气骰。");
  return next;
}

export function confirmInitiative(state: CombatState): CombatState {
  let next = cloneState(state);
  const ordered = computeTurnOrder(next).filter((entry) => !entry.isDying);
  const firstActor = ordered[0];
  next.initiativeOrder = ordered.map((entry) => entry.actorId);
  next.actedActorIds = [];
  if (firstActor) next.activeActorId = firstActor.actorId;
  next.phase = "declare";
  next.pendingAction = undefined;
  next.actors = next.actors.map(resetActorResponseBudgets);
  next.runtime = next.runtime.mode === "COMBAT"
    ? confirmCombatInitiative(
        next.runtime,
        next.initiativeOrder,
        firstActor?.actorId,
      )
    : setSceneMode(next.runtime, "SCENE_STRUCTURED", {
        round: next.round,
        activeActorId: firstActor?.actorId,
        initiativeOrder: next.initiativeOrder,
        actedActorIds: [],
        paused: false,
      });
  next = appendLog(
    next,
    "phase_changed",
    `先后确认：${firstActor?.name ?? "待定"} 先行动。先后值读取身势（经DM许可可改观照）与当前最高可用常规骰；气骰位置和值保持不变。`,
  );
  return appendFeedback(next, {
    kind: "turn",
    actorId: firstActor?.actorId,
    title: `轮到 ${firstActor?.name ?? "待定"}`,
    detail: "先后序已锁定",
  });
}

/**
 * enterScene: Move all QI_POOL dice to QI_SEA with rolled values.
 * Clear pendingAction, set phase to "scene".
 * Apply 崩势→失勢 auto-transition.
 * Decay statuses with "每轮结束-1层" rule.
 * Reset response quotas.
 */
export function enterScene(state: CombatState, roll: RollFn = defaultRoll): CombatState {
  let next = cloneState(state);
  next.runtime = beginNewScene(next.runtime, next.scene.id, "SCENE_STRUCTURED");
  next.phase = "scene";
  next.encounterMode = "scene";
  next.round = 1;
  next.actedActorIds = [];
  next.turnPaused = false;
  next.pendingAction = undefined;

  // Move all QI_POOL dice (non-temporary) to QI_SEA with rolled values
  next.dice = next.dice.map((die) => {
    if (die.zone !== "QI_POOL" || die.temporary) {
      return die;
    }
    return { ...die, zone: "QI_SEA" as QiZone, value: roll(die.sides) };
  });

  // Apply 崩势→失势 auto-transition
  next.actors = next.actors.map((actor) => {
    if (actor.momentum === "崩势" && actor.hp > 0) {
      return { ...actor, momentum: "失势" as ShiState };
    }
    // Reset both response budgets on the new scene boundary.
    return resetActorResponseBudgets(actor);
  });

  // Decay statuses with "每轮结束-1层" rule
  next = decayStatusesInternal(next, "每轮结束-1层");

  const order = computeTurnOrder(next).filter((entry) => !entry.isDying);
  next.initiativeOrder = order.map((entry) => entry.actorId);
  if (order[0]) next.activeActorId = order[0].actorId;
  next.phase = "declare";
  next.runtime = setSceneMode(next.runtime, "SCENE_STRUCTURED", {
    round: 1,
    activeActorId: next.activeActorId,
    initiativeOrder: next.initiativeOrder,
    actedActorIds: [],
    paused: false,
  });
  next = appendLog(next, "ENTER_SCENE", "DM开始新场景：常规气骰从气池投出并进入气海；情景交锋先后序已建立。");
  return appendFeedback(next, {
    kind: "round",
    actorId: next.activeActorId,
    title: "新场景开局",
    detail: "气海已生成，进入情景交锋",
  });
}

/**
 * commitDiceRollResults: Apply external dice roll results.
 * Kept as-is — works correctly.
 */
export function commitDiceRollResults(
  state: CombatState,
  results: Array<{ id: string; value: number }>,
): CombatState {
  let next = cloneState(state);
  const resultIds = results.map((result) => result.id);
  next.dice = next.dice.map((die) => {
    const result = results.find((item) => item.id === die.id);
    if (!result) return die;
    return {
      ...die,
      value: Math.max(1, Math.min(die.sides, result.value)),
      zone: die.zone === "QI_POOL" ? ("QI_SEA" as QiZone) : die.zone,
    };
  });
  next = appendLog(next, "dice_rolled", `投掷气骰 ${resultIds.length} 枚，结果已写入。`);
  if (
    results.some(
      (result) => state.dice.find((die) => die.id === result.id)?.zone === "QI_POOL",
    )
  ) {
    next = appendLog(next, "qi_entered_sea", "气池中的已投气骰进入气海。");
  }
  return next;
}

/**
 * declareAction: Actor declares a move against a target.
 * Validates momentum, qi nature threshold, equipment, and slot configuration.
 */
export function declareAction(
  state: CombatState,
  actorId: string,
  targetId: string,
  moveId: string,
  diceIds: string[],
  slotDice?: { yinSlotDiceIds?: string[]; yangSlotDiceIds?: string[] },
): CombatState {
  let next = cloneState(state);
  const actor = requireActor(next, actorId);
  const target = requireActor(next, targetId);
  const move = requireMove(actor, moveId);

  // The confrontation order is authoritative in both scene and combat modes.
  // UI guards are not sufficient because auto-DM and LAN callers use this
  // function directly as well.
  if (next.activeActorId !== actorId) {
    throw new Error(`${actor.name}不是当前行动者。`);
  }
  if (next.actedActorIds.includes(actorId)) {
    throw new Error(`${actor.name}本轮已经完成主行动。`);
  }

  const targetState = deriveTargetState(next, target.id, move, actor.id);
  if (!targetState.isRangeValid) {
    throw new Error(targetState.invalidReason ?? "目标不在招式允许距离内");
  }

  // Validate phase
  if (next.phase !== "scene" && next.phase !== "declare") {
    throw new Error(`当前时点「${next.phase}」不允许宣言招式。`);
  }

  // Validate momentum
  const momentumCheck = validateMomentum(actor, move.shiCondition, move.allowedShi);
  if (!momentumCheck.valid) {
    throw new Error(momentumCheck.reason ?? "势条件不满足");
  }

  // Filter usable dice: must belong to actor and be in QI_SEA or TEMP_QI
  const usableDice = diceIds.filter((id) => {
    const die = next.dice.find((item) => item.id === id);
    return die?.ownerId === actorId && (die.zone === "QI_SEA" || die.zone === "TEMP_QI");
  });

  // Validate qi nature threshold
  const selectedDice = usableDice
    .map((id) => next.dice.find((d) => d.id === id))
    .filter((d): d is QiDie => !!d);

  const qiCheck = validateQiNature(selectedDice, move.qiNatureThreshold);
  if (!qiCheck.valid) {
    throw new Error(qiCheck.reason ?? "气性门槛不满足");
  }

  // Validate equipment
  const equipCheck = validateEquipPermission(actor, move.equipPermission);
  if (!equipCheck.valid) {
    throw new Error(equipCheck.reason ?? "装备许可不满足");
  }

  // Formal move (正式出手) requires both yin AND yang slot dice
  const yinSlotIds = slotDice?.yinSlotDiceIds?.filter((id) => usableDice.includes(id)) ?? [];
  const yangSlotIds = slotDice?.yangSlotDiceIds?.filter((id) => usableDice.includes(id)) ?? [];

  if (move.timing === "正式出手") {
    if (yinSlotIds.length === 0) {
      throw new Error("正式出手必须配置阴槽气骰。");
    }
    if (yangSlotIds.length === 0) {
      throw new Error("正式出手必须配置阳槽气骰。");
    }
  }

  // Move dice from QI_SEA/TEMP_QI to QI_LOCK
  next.dice = moveDice(next.dice, usableDice, "QI_LOCK");

  next.pendingAction = {
    actorId,
    targetId,
    targetIds: [targetId],
    moveId,
    diceIds: usableDice,
    yinSlotDiceIds: yinSlotIds,
    yangSlotDiceIds: yangSlotIds,
  };
  next.phase = "intercept_window";
  next.activeActorId = actorId;

  next = appendLog(
    next,
    "DECLARE_ACTION",
    `${actor.name} 宣言「${move.name}」指向 ${target.name}，锁气 ${usableDice.length} 枚（阴槽 ${yinSlotIds.length} / 阳槽 ${yangSlotIds.length}），打开截击窗口。`,
  );
  return appendFeedback(next, {
    kind: "declare",
    actorId,
    targetId,
    title: move.name,
    detail: `锁气 ${usableDice.length} 枚`,
  });
}

/**
 * resolveInterceptSuccess: A responder successfully intercepts, canceling the pending action.
 * Validates responder's shi condition, quota, qi nature, and equipment.
 */
export function resolveInterceptSuccess(
  state: CombatState,
  responderId: string,
  responseId: string,
  diceIds: string[],
  slotDice?: { yinSlotDiceIds?: string[]; yangSlotDiceIds?: string[] },
): CombatState {
  if (state.phase !== "intercept_window") {
    throw new Error(`当前时点「${state.phase}」不允许截击。`);
  }

  let next = cloneState(state);
  const action = requirePendingAction(next);
  const responder = requireActor(next, responderId);
  const response = requireResponseByType(responder, responseId, "截击");

  // Validate shi condition / allowed momentum
  const momentumCheck = validateMomentum(responder, response.shiCondition, response.allowedShi);
  if (!momentumCheck.valid) {
    throw new Error(momentumCheck.reason ?? "截击势条件不满足");
  }

  // 截击和第三方护人读取主动响应额度。
  next.actors = next.actors.map((a) =>
    a.id === responderId
      ? spendActorResponseBudget(a, "proactive")
      : a,
  );

  // Validate qi nature threshold
  const responderDice = validDiceForOwner(next, responderId, diceIds);
  const spentDice = responderDice
    .map((id) => next.dice.find((d) => d.id === id))
    .filter((d): d is QiDie => !!d);
  const qiCheck = validateQiNature(spentDice, response.qiNatureThreshold);
  if (!qiCheck.valid) {
    throw new Error(qiCheck.reason ?? "截击气性门槛不满足");
  }

  // Validate equipment
  const equipCheck = validateEquipPermission(responder, response.equipPermission);
  if (!equipCheck.valid) {
    throw new Error(equipCheck.reason ?? "截击装备许可不满足");
  }

  validateResponseSlotAllocation(spentDice, slotDice);
  const responseSlotValues = calculateResponseSlotValues(spentDice, slotDice);
  const triggeredEffects = resolveSlotTriggers(response.triggers, responseSlotValues)
    .filter((trigger) => trigger.triggered)
    .map((trigger) => trigger.effect);
  const moveActor = requireActor(next, action.actorId);
  const move = requireMove(moveActor, action.moveId);

  let updatedAction = { ...action };
  let cancelAction = false;
  let interceptEffect = response.baseEffect;

  // A light weapon-line intercept closes one assigned yang die. It does not
  // automatically erase the whole action when another legal yang die remains.
  if (response.baseEffect.includes("不能进入阳槽")) {
    const blockedDieId = [...updatedAction.yangSlotDiceIds]
      .sort((leftId, rightId) => {
        const left = next.dice.find((die) => die.id === leftId)?.value ?? 0;
        const right = next.dice.find((die) => die.id === rightId)?.value ?? 0;
        return left - right || leftId.localeCompare(rightId);
      })[0];
    if (blockedDieId) {
      updatedAction.yangSlotDiceIds = updatedAction.yangSlotDiceIds.filter((id) => id !== blockedDieId);
      next.dice = moveDice(next.dice, [blockedDieId], "QI_LOCK");
      interceptEffect += `；锁气 ${blockedDieId} 被关闭阳槽许可`;
    }
  }

  if (response.baseEffect.includes("势条件视为不满足") && move.shiCondition !== "无势") {
    cancelAction = true;
  }
  if (response.baseEffect.includes("装备许可关闭") && !/无|徒手|不限/.test(move.equipPermission)) {
    cancelAction = true;
  }
  if (triggeredEffects.some((effect) => effect.includes("动作不成招") || effect.includes("失去持械许可"))) {
    cancelAction = true;
  }

  const damageReductionText = triggeredEffects.find((effect) => /基础效果-\d+气血/.test(effect));
  const damageReduction = damageReductionText
    ? Number(damageReductionText.match(/基础效果-(\d+)气血/)?.[1] ?? 0)
    : 0;
  updatedAction.preventedDamage = (updatedAction.preventedDamage ?? 0) + damageReduction;

  next.dice = settleSpentDice(next.dice, responderDice);
  if (cancelAction) {
    next.dice = settleSpentDice(next.dice, action.diceIds);
    next.phase = "round_end";
    next.pendingAction = undefined;
  } else {
    next.phase = "intercept_window";
    next.pendingAction = updatedAction;
  }

  // Apply responder's postShi from the response
  if (response.postShi !== "不改势") {
    next.actors = next.actors.map((a) =>
      a.id === responderId ? { ...a, momentum: response.postShi as ShiState } : a,
    );
  }

  let intercepted = appendLog(
    next,
    "INTERCEPT",
    `${responder.name} 使用截击「${response.moveName}」：${interceptEffect}。响应槽值 阴${responseSlotValues.阴值}/阳${responseSlotValues.阳值}/合${responseSlotValues.合值}。${cancelAction ? "声明前置被关闭，本次动作不成招；行动气骰结算。" : "声明仍合法，继续进入成招检查。"}${damageReduction > 0 ? `基础气血效果减轻 ${damageReduction} 点。` : ""}${response.postShi !== "不改势" ? `势变更为「${response.postShi}」。` : ""}`,
  );
  intercepted = appendFeedback(intercepted, {
    kind: "intercept",
    actorId: responderId,
    targetId: action.actorId,
    title: response.moveName,
    detail: cancelAction ? "截断宣言" : "改变成招条件",
  });
  return cancelAction ? intercepted : formMove(intercepted);
}

/**
 * formMove: Form the move — move dice into yin/yang slots, calculate slot values,
 * resolve triggers. If dice count < minDice, the action fails.
 */
export function formMove(state: CombatState): CombatState {
  if (state.phase !== "intercept_window") {
    throw new Error(`当前时点「${state.phase}」不允许成招。`);
  }

  let next = cloneState(state);
  const action = requirePendingAction(next);
  const actor = requireActor(next, action.actorId);
  const target = requireActor(next, action.targetId);
  const move = requireMove(actor, action.moveId);
  const diceCount = action.diceIds.length;

  // Check minimum dice and re-check slot legality after any intercept changed
  // a lock/slot permission.
  const missingFormalSlot = move.timing === "正式出手"
    && (action.yinSlotDiceIds.length === 0 || action.yangSlotDiceIds.length === 0);
  if (diceCount < move.minDice || missingFormalSlot) {
    next.dice = settleSpentDice(next.dice, action.diceIds);
    next.pendingAction = undefined;
    next.phase = "round_end";
    next = appendLog(
      next,
      "FORM_MOVE",
      `${actor.name} 的「${move.name}」${missingFormalSlot ? "经截击后缺少合法阴/阳槽" : `最低投入不足（${diceCount}/${move.minDice}）`}，未成招，已用常规气骰进入息库，临时气骰消失。`,
    );
    return appendFeedback(next, {
      kind: "outcome",
      actorId: actor.id,
      targetId: target.id,
      title: "未成招",
      detail: move.name,
    });
  }

  // Move yin slot dice from QI_LOCK to YIN_SLOT
  if (action.yinSlotDiceIds.length > 0) {
    next.dice = moveDice(next.dice, action.yinSlotDiceIds, "YIN_SLOT");
  }

  // Move yang slot dice from QI_LOCK to YANG_SLOT
  if (action.yangSlotDiceIds.length > 0) {
    next.dice = moveDice(next.dice, action.yangSlotDiceIds, "YANG_SLOT");
  }

  // Calculate slot values
  const slotValues = calculateSlotValues(next);

  // Resolve triggers
  const resolvedTriggers = resolveSlotTriggers(move.triggers, slotValues);
  const triggeredEffects = resolvedTriggers.filter((t) => t.triggered);

  // Store results on pendingAction
  next.pendingAction = {
    ...action,
    formed: true,
    preventedDamage: action.preventedDamage ?? 0,
    slotValues,
  };
  next.phase = "react_window";

  const triggerLog =
    triggeredEffects.length > 0
      ? `触发效果：${triggeredEffects.map((t) => `「${t.condition}」→ ${t.effect}`).join("；")}`
      : "无槽值触发";

  next = appendLog(
    next,
    "FORM_MOVE",
    `${actor.name} 的「${move.name}」成招（阴值 ${slotValues.阴值} / 阳值 ${slotValues.阳值} / 合值 ${slotValues.合值} / 阴阳差 ${slotValues.阴阳差}）。${triggerLog}。目标 ${target.name} 可在落果前应招。`,
  );
  return appendFeedback(next, {
    kind: "formed",
    actorId: actor.id,
    targetId: target.id,
    title: "成招",
    detail: move.name,
  });
}

/**
 * resolveReact: A responder uses a react response to mitigate the pending action's outcome.
 * Parses baseEffect for preventDamage, resolves triggers.
 */
export function resolveReact(
  state: CombatState,
  responderId: string,
  responseId: string,
  diceIds: string[],
  slotDice?: { yinSlotDiceIds?: string[]; yangSlotDiceIds?: string[] },
): CombatState {
  if (state.phase !== "react_window") {
    throw new Error(`当前时点「${state.phase}」不允许应招。`);
  }

  let next = cloneState(state);
  const action = requirePendingAction(next);
  const responder = requireActor(next, responderId);
  const response = requireResponseByType(responder, responseId, "应招");

  // Validate shi condition / allowed momentum
  const momentumCheck = validateMomentum(responder, response.shiCondition, response.allowedShi);
  if (!momentumCheck.valid) {
    throw new Error(momentumCheck.reason ?? "应招势条件不满足");
  }

  // 目标本人使用自保应招额度；第三方承接仍消耗主动响应额度。
  const budgetKind: ResponseBudgetKind = responderId === action.targetId ? "self_defense" : "proactive";
  next.actors = next.actors.map((a) =>
    a.id === responderId
      ? spendActorResponseBudget(a, budgetKind)
      : a,
  );

  // Validate qi nature threshold
  const responderDice = validDiceForOwner(next, responderId, diceIds);
  const spentDice = responderDice
    .map((id) => next.dice.find((d) => d.id === id))
    .filter((d): d is QiDie => !!d);
  const qiCheck = validateQiNature(spentDice, response.qiNatureThreshold);
  if (!qiCheck.valid) {
    throw new Error(qiCheck.reason ?? "应招气性门槛不满足");
  }

  // Validate equipment
  const equipCheck = validateEquipPermission(responder, response.equipPermission);
  if (!equipCheck.valid) {
    throw new Error(equipCheck.reason ?? "应招装备许可不满足");
  }

  // Move responder's dice to QI_REST
  next.dice = settleSpentDice(next.dice, responderDice);

  // Parse base effect for prevent damage
  let additionalPrevent = 0;
  let reactLogExtra = "";
  let responseMomentumChange: ShiState | undefined = undefined;

  if (response.baseEffect) {
    const parsed = parseBaseEffect(response.baseEffect);
    if (parsed.preventDamage) {
      additionalPrevent += parsed.preventDamage;
      reactLogExtra += `抵消气血${parsed.preventDamage}点`;
    }
    if (parsed.damage) {
      reactLogExtra += (reactLogExtra ? "，" : "") + `造成气血${parsed.damage}点`;
    }
  }

  // Response triggers read the responder's own dice, never the attacker's
  // already-formed slot values.
  validateResponseSlotAllocation(spentDice, slotDice);
  const responseSlotValues = calculateResponseSlotValues(spentDice, slotDice);
  const resolvedTriggers = resolveSlotTriggers(response.triggers, responseSlotValues);
  const triggeredEffects = resolvedTriggers.filter((t) => t.triggered);

  for (const trigger of triggeredEffects) {
    if (trigger.parsedEffect) {
      if (trigger.parsedEffect.preventDamage) {
        additionalPrevent += trigger.parsedEffect.preventDamage;
        reactLogExtra += (reactLogExtra ? "；" : "") + `触发「${trigger.condition}」→ 额外抵消气血${trigger.parsedEffect.preventDamage}点`;
      }
      if (trigger.parsedEffect.damage) {
        reactLogExtra += (reactLogExtra ? "；" : "") + `触发「${trigger.condition}」→ 额外造成气血${trigger.parsedEffect.damage}点`;
      }
      // Risk trigger momentum change overrides postShi
      if (trigger.parsedEffect.momentumChange && trigger.type === "差值/风险") {
        responseMomentumChange = trigger.parsedEffect.momentumChange;
      }
    }
  }

  // Apply responder's postShi (risk trigger momentum overrides)
  const finalResponderMomentum = responseMomentumChange ?? (response.postShi !== "不改势" ? response.postShi : undefined);
  if (finalResponderMomentum) {
    next.actors = next.actors.map((a) =>
      a.id === responderId ? { ...a, momentum: finalResponderMomentum as ShiState } : a,
    );
  }

  // Apply prevent damage
  const totalPrevented = (action.preventedDamage ?? 0) + additionalPrevent;
  next.pendingAction = {
    ...action,
    preventedDamage: totalPrevented,
  };
  next.phase = "outcome";

  next = appendLog(
    next,
    "REACT",
    `${responder.name} 使用应招「${response.moveName}」，响应槽值 阴${responseSlotValues.阴值}/阳${responseSlotValues.阳值}/合${responseSlotValues.合值}；${reactLogExtra || `落果减轻 ${additionalPrevent}`}。当前共抵消 ${totalPrevented} 点。${finalResponderMomentum ? `势变更为「${finalResponderMomentum}」。` : ""}`,
  );
  return appendFeedback(next, {
    kind: "react",
    actorId: responderId,
    targetId: action.actorId,
    title: response.moveName,
    detail: `抵消 ${totalPrevented} 点`,
  });
}

/**
 * skipReact: Close the react window without spending response dice.
 * The formed action stays pending so applyOutcome can resolve it exactly once.
 */
export function skipReact(state: CombatState): CombatState {
  if (state.phase !== "react_window") {
    throw new Error(`当前时点「${state.phase}」不允许跳过应招。`);
  }

  const next = cloneState(state);
  const action = requirePendingAction(next);
  if (!action.formed) {
    throw new Error("当前宣言尚未成招，不能跳过应招。");
  }

  next.phase = "outcome";
  return appendLog(next, "REACT", "目标放弃应招，进入落果结算。", true);
}

/**
 * applyOutcome: Calculate and apply final damage, status effects, postShi change.
 * Move all action dice to QI_REST, clear pendingAction, and enter round end.
 */
export function applyOutcome(state: CombatState): CombatState {
  if (state.phase !== "outcome") {
    throw new Error(`当前时点「${state.phase}」不允许结算落果。`);
  }

  let next = cloneState(state);
  const action = requirePendingAction(next);
  const actor = requireActor(next, action.actorId);
  const target = requireActor(next, action.targetId);
  const move = requireMove(actor, action.moveId);

  const slotValues = action.slotValues ?? { 阴值: 0, 阳值: 0, 合值: 0, 阴阳差: 0 };

  // Calculate trigger effects from move triggers
  let triggerDamage = 0;
  const triggerStatusesSelf: Array<{ name: string; layers: number }> = [];
  const triggerStatusesTarget: Array<{ name: string; layers: number }> = [];
  let riskMomentumChange: ShiState | undefined = undefined; // Risk trigger momentum override

  const resolvedTriggers = resolveSlotTriggers(move.triggers, slotValues);
  for (const trigger of resolvedTriggers) {
    if (!trigger.triggered || !trigger.parsedEffect) continue;
    const pe = trigger.parsedEffect;
    if (pe.damage) {
      triggerDamage += pe.damage;
    }
    if (pe.statuses) {
      for (const s of pe.statuses) {
        if (s.target === "self") {
          triggerStatusesSelf.push({ name: s.name, layers: s.layers });
        } else {
          triggerStatusesTarget.push({ name: s.name, layers: s.layers });
        }
      }
    }
    // Risk triggers (差值/风险) that change momentum override postShi
    if (pe.momentumChange && trigger.type === "差值/风险") {
      riskMomentumChange = pe.momentumChange;
    }
  }

  // Calculate final damage
  const rawDamage = extractDamage(move.baseEffect) + triggerDamage;
  const damage = Math.max(0, rawDamage - (action.preventedDamage ?? 0));

  // Apply damage to target hp
  if (damage > 0) {
    next.actors = next.actors.map((a) =>
      a.id === target.id ? { ...a, hp: Math.max(0, a.hp - damage) } : a,
    );
  }

  // Apply status effects to self (actor)
  for (const status of triggerStatusesSelf) {
    next = applyStatusEffectByName(next, action.actorId, status.name, status.layers);
  }

  // Apply status effects to target
  for (const status of triggerStatusesTarget) {
    next = applyStatusEffectByName(next, action.targetId, status.name, status.layers);
  }

  // Scene confrontations use the same declaration/response/outcome pipeline.
  // Rule-authored scene deltas are applied only after the move has legally
  // formed, so investigation and combat never need separate turn machinery.
  if (next.encounterMode === "scene") {
    const explicitTrackDelta = (move as Move & { trackDelta?: number }).trackDelta ?? 0;
    const trackChanges = new Map<string, number>();
    if (explicitTrackDelta !== 0 && !/(危机|解密|调查)[+-]\d+/.test(move.baseEffect)) {
      const insightTrack = next.tracks.find((track) => track.kind === "insight" || /解密|调查/.test(track.name));
      if (insightTrack) trackChanges.set(insightTrack.id, explicitTrackDelta);
    }
    const effectTexts = [move.baseEffect, ...resolvedTriggers.filter((trigger) => trigger.triggered).map((trigger) => trigger.effect)];
    for (const effectText of effectTexts) {
      for (const match of effectText.matchAll(/(危机|解密|调查)([+-])(\d+)/g)) {
        const track = next.tracks.find((candidate) =>
          match[1] === "危机"
            ? candidate.kind === "crisis" || candidate.name.includes("危机")
            : candidate.kind === "insight" || /解密|调查/.test(candidate.name));
        if (!track) continue;
        const delta = Number(match[3]) * (match[2] === "+" ? 1 : -1);
        trackChanges.set(track.id, (trackChanges.get(track.id) ?? 0) + delta);
      }
    }
    if (trackChanges.size > 0) {
      next.tracks = next.tracks.map((track) => {
        const delta = trackChanges.get(track.id);
        return delta === undefined ? track : { ...track, value: Math.max(0, Math.min(track.max, track.value + delta)) };
      });
      const detail = [...trackChanges].map(([trackId, delta]) => `${next.tracks.find((track) => track.id === trackId)?.name ?? trackId}${delta >= 0 ? "+" : ""}${delta}`).join("、");
      next = appendLog(next, "SCENE_TRACK_CHANGED", `情景落果：${detail}。`);
      next = appendFeedback(next, { kind: "status", actorId: actor.id, targetId: target.id, title: "场景推进", detail });
    }
  }

  // Apply postShi change (risk trigger momentum change overrides move.postShi)
  const finalMomentum = riskMomentumChange ?? (move.postShi !== "不改势" ? move.postShi : undefined);
  if (finalMomentum) {
    next.actors = next.actors.map((a) =>
      a.id === action.actorId ? { ...a, momentum: finalMomentum as ShiState } : a,
    );
    next = appendLog(
      next,
      "MOMENTUM_CHANGED",
      `${actor.name} 势变更为「${finalMomentum}」${riskMomentumChange ? "（风险触发）" : ""}。`,
    );
  }

  // Move all action dice to QI_REST (QI_LOCK + YIN_SLOT + YANG_SLOT)
  const allActionDice = [
    ...action.diceIds,
    ...action.yinSlotDiceIds,
    ...action.yangSlotDiceIds,
  ];
  // Deduplicate
  const uniqueDice = [...new Set(allActionDice)];
  next.dice = settleSpentDice(next.dice, uniqueDice);

  next.pendingAction = undefined;
  next.phase = "round_end";

  const damageMsg =
    damage > 0
      ? `${target.name} 气血-${damage}（基础 ${extractDamage(move.baseEffect)} + 触发 ${triggerDamage} - 抵消 ${action.preventedDamage ?? 0}）`
      : "未造成气血损失";

  next = appendLog(
    next,
    "APPLY_OUTCOME",
    `${actor.name} 的「${move.name}」落果：${damageMsg}。`,
  );
  next = appendFeedback(next, {
    kind: "outcome",
    actorId: actor.id,
    targetId: target.id,
    title: "落果",
    detail: move.name,
  });
  if (damage > 0) {
    next = appendFeedback(next, {
      kind: "damage",
      actorId: actor.id,
      targetId: target.id,
      title: `${target.name} 受击`,
      detail: `气血 -${damage}`,
      delta: -damage,
    });
  }
  return next;
}

// ============================================================================
// RECOVERY FUNCTIONS
// ============================================================================

/**
 * regulateBreath: Move dice from QI_REST to QI_SEA without changing faces.
 * Active regulation spends one guide die and the actor's main action. Passive
 * circulation is used only by explicit entries and does not consume an action.
 */
export function regulateBreath(
  state: CombatState,
  actorId: string,
  diceIds: string[],
  active = false,
  _roll: RollFn = defaultRoll,
  guideDieId?: string,
): CombatState {
  let next = cloneState(state);
  const actor = requireActor(next, actorId);

  const restDice = [...new Set(diceIds)].filter((id) =>
    next.dice.some(
      (die) => die.id === id
        && die.ownerId === actorId
        && die.zone === "QI_REST"
        && !die.temporary,
    ),
  );

  if (restDice.length === 0) {
    throw new Error("息库中没有选中的可取回常规气骰。");
  }

  if (active) {
    if ((next.phase !== "scene" && next.phase !== "declare") || next.activeActorId !== actorId) {
      throw new Error("主动调息只能由当前行动者在场景/声明时点执行。");
    }
    const guideDie = next.dice.find((die) =>
      die.id === guideDieId
      && die.ownerId === actorId
      && (die.zone === "QI_SEA" || die.zone === "TEMP_QI"));
    if (!guideDie) {
      throw new Error("主动调息需要从气海或临气区明确选择1枚气骰作为息引。");
    }
    const recoveryLimit = 1 + actor.innerArts
      .filter((art) => art.currentLevel > 0)
      .reduce((total, art) => total + Math.max(0, art.regulateBreathBonus ?? 0), 0);
    if (restDice.length > recoveryLimit) {
      throw new Error(`本次调息最多取回 ${recoveryLimit} 枚常规气骰。`);
    }
    // 2026-06-20 rule package: recovery preserves every die face.
    next.dice = moveDice(next.dice, restDice, "QI_SEA");
    next.dice = settleSpentDice(next.dice, [guideDie.id]);
    next.phase = "round_end";
  } else {
    // 被动流转: move without reroll
    next.dice = moveDice(next.dice, restDice, "QI_SEA");
  }

  const mode = active ? "主动调息" : "被动流转";
  next = appendLog(
    next,
    "REGULATE_BREATH",
    `${actor.name} ${mode}，${restDice.length} 枚常规气骰保持原点数从息库回气海。${active ? "息引气骰已结算，本次主行动结束。" : ""}`,
  );
  return appendFeedback(next, {
    kind: "resource",
    actorId,
    title: active ? "调息" : "气机流转",
    detail: `取回 ${restDice.length} 枚，不重掷`,
  });
}

/**
 * 返照：断气时取回最低阶本命骰并重投。它是每轮一次的特殊
 * 随手便行，因此不会消耗角色原本的正式出手机会。
 */
export function useReflection(
  state: CombatState,
  actorId: string,
  roll: RollFn = defaultRoll,
): CombatState {
  let next = cloneState(state);
  const actor = requireActor(next, actorId);

  if ((next.phase !== "scene" && next.phase !== "declare") || next.activeActorId !== actorId) {
    throw new Error("返照只能由当前行动者在场景/声明时点执行。");
  }

  // 断气 checks the usable sea only. QI_POOL is the unrolled reservoir and
  // must not make a valid mid-scene reflection illegal.
  const hasUsableRegularDie = next.dice.some(
    (die) => die.ownerId === actorId
      && !die.temporary
      && die.zone === "QI_SEA",
  );
  if (hasUsableRegularDie) {
    return appendLog(
      next,
      "REFLECTION",
      `${actor.name} 尝试返照失败：气海仍有可用气骰。`,
    );
  }

  if (actor.reflectionUsedRound === next.round) {
    return appendLog(
      next,
      "REFLECTION",
      `${actor.name} 尝试返照失败：本轮已经返照一次。`,
    );
  }

  // Find the lowest-rank innate die in QI_REST; value and id are stable ties.
  const candidate = next.dice
    .filter(
      (die) =>
        die.ownerId === actorId &&
        die.zone === "QI_REST" &&
        die.value !== null &&
        !die.temporary,
    )
    .sort((a, b) => a.sides - b.sides || (a.value ?? 0) - (b.value ?? 0) || a.id.localeCompare(b.id))[0];

  if (!candidate) {
    return appendLog(
      next,
      "REFLECTION",
      `${actor.name} 尝试返照失败：息库没有可取回气骰。`,
    );
  }

  // 返照与调息不同：最低阶本命骰必须重新投掷后进入气海。
  const rerolledValue = Math.max(1, Math.min(candidate.sides, roll(candidate.sides)));
  next.dice = next.dice.map((die) => die.id === candidate.id
    ? { ...die, zone: "QI_SEA" as QiZone, value: rerolledValue }
    : die);
  next.actors = next.actors.map((entry) => entry.id === actorId
    ? { ...entry, reflectionUsedRound: next.round }
    : entry);

  next = appendLog(
    next,
    "REFLECTION",
    `${actor.name} 返照，取回最低阶本命气骰 ${candidate.sourceName}（D${candidate.sides}），重投为 ${rerolledValue} 点；本轮返照次数已用，正式出手机会保留。`,
  );
  return appendFeedback(next, {
    kind: "resource",
    actorId,
    title: "返照",
    detail: `D${candidate.sides}·${rerolledValue} 回到气海`,
  });
}

// ============================================================================
// BASIC ACTION AVAILABILITY (调息 / 返照)
// ============================================================================

/** Supported basic action types (self-targeting, no enemy target needed). */
export type BasicActionType = "regulateBreath" | "fanzhao" | "pass";

/** Unified availability result with short tags for UI badges */
export interface SkillAvailability {
  usable: boolean;
  reasonTags: string[];
  detailReasons: string[];
}

/**
 * Check whether a basic action (调息 / 返照 / 放弃出手) is available.
 *
 * Rules:
 *   调息: self, no enemy target, no distance, needs rest pool non-empty, needs scene/declare phase
 *   返照: self, no enemy target, no distance, needs qi sea empty, needs scene/declare phase
 */
export function getBasicActionAvailability(
  state: CombatState,
  actorId: string,
  actionType: BasicActionType,
  _reflectionUsedCount = 0,
): SkillAvailability {
  const actor = state.actors.find((a) => a.id === actorId);
  const detailReasons: string[] = [];
  const reasonTags: string[] = [];

  if (!actor) {
    return { usable: false, reasonTags: ["未知角色"], detailReasons: ["未找到角色"] };
  }

  // Phase check — both actions require scene or declare phase
  const isActionablePhase = state.phase === "scene" || state.phase === "declare";
  if (!isActionablePhase) {
    detailReasons.push("当前时点不允许此动作（仅场景/宣言阶段可用）");
    reasonTags.push("非当前时点");
  }

  // Current actor check
  if (state.activeActorId !== actorId) {
    detailReasons.push("不是当前行动者");
    reasonTags.push("非当前行动者");
  }

  if (actionType === "regulateBreath") {
    const hasRestDice = state.dice.some(
      (d) => d.ownerId === actorId && d.zone === "QI_REST",
    );
    if (!hasRestDice) {
      detailReasons.push("息库没有可调息的气骰");
      reasonTags.push("息库为空");
    }
    const hasGuideDie = state.dice.some(
      (d) => d.ownerId === actorId && (d.zone === "QI_SEA" || d.zone === "TEMP_QI"),
    );
    if (!hasGuideDie) {
      detailReasons.push("气海或临气区没有可作为息引的气骰");
      reasonTags.push("缺少息引");
    }
  }

  if (actionType === "fanzhao") {
    const hasAvailableRegularDice = state.dice.some(
      (d) => d.ownerId === actorId
        && !d.temporary
        && d.zone === "QI_SEA",
    );
    if (hasAvailableRegularDice) {
      detailReasons.push("气海仍有可用常规气骰，尚未满足断气条件");
      reasonTags.push("尚未断气");
    }
    const hasInnateRestDie = state.dice.some(
      (d) => d.ownerId === actorId && d.zone === "QI_REST" && !d.temporary,
    );
    if (!hasInnateRestDie) {
      detailReasons.push("息库没有可返照的先天气骰");
      reasonTags.push("息库为空");
    }
    if (actor.reflectionUsedRound === state.round) {
      detailReasons.push("本轮已经使用过返照");
      reasonTags.push("本轮已返照");
    }
  }

  const usable = detailReasons.length === 0;
  if (usable) {
    reasonTags.push("可用");
  }

  return { usable, reasonTags, detailReasons };
}

/**
 * End the current actor's formal action without creating a declaration.
 * This is the guaranteed escape hatch for an empty hand or an invalidated
 * board state. Turn advancement remains centralized in advanceTurn().
 */
export function passMainAction(
  state: CombatState,
  actorId: string,
  reason = "主动放弃出手",
): CombatState {
  const availability = getBasicActionAvailability(state, actorId, "pass");
  if (!availability.usable) {
    throw new Error(availability.detailReasons.join("、") || "当前不能放弃出手。");
  }
  let next = cloneState(state);
  const actor = requireActor(next, actorId);
  next.pendingAction = undefined;
  next.phase = "round_end";
  next = appendLog(next, "PASS_ACTION", `${actor.name} ${reason}，行动序列安全推进。`);
  return appendFeedback(next, {
    kind: "resource",
    actorId,
    title: "放弃出手",
    detail: "未消耗气骰",
  });
}

/**
 * expireSource: Remove dice from a source that has expired.
 * - Remove unlocked source dice from QI_SEA and TEMP_QI
 * - If locked dice from the source exist in pendingAction, cancel the action
 * - If source is an inventory item, also remove its attr bonuses and qi dice
 */
export function expireSource(state: CombatState, sourceId: string): CombatState {
  let next = cloneState(state);

  // Remove unlocked dice from QI_SEA and TEMP_QI
  const expiredUnlocked = next.dice.filter(
    (die) =>
      die.sourceId === sourceId &&
      (die.zone === "QI_SEA" || die.zone === "TEMP_QI"),
  );
  next.dice = next.dice.filter(
    (die) => !expiredUnlocked.some((expired) => expired.id === die.id),
  );

  // Check if locked dice from source exist in pendingAction
  if (next.pendingAction) {
    const lockedFromSource = next.dice.filter(
      (die) =>
        die.sourceId === sourceId &&
        die.zone === "QI_LOCK" &&
        next.pendingAction!.diceIds.includes(die.id),
    );
    if (lockedFromSource.length > 0) {
      next.dice = moveDice(next.dice, next.pendingAction.diceIds, "QI_REST");
      next.pendingAction = undefined;
      next.phase = "outcome";
      return appendLog(
        next,
        "EXPIRE_SOURCE",
        `来源「${sourceId}」失效，锁气宣言需重检且本次行动取消。`,
      );
    }
  }

  // NEW: If source is equipment/medicine, remove its attr bonuses, qi dice, and unequip
  let bonusRemovalLog = "";
  next.actors = next.actors.map((actor) => {
    let updatedActor = { ...actor };
    let actorHadBonus = false;

    for (const item of actor.inventory) {
      if (item.sourceId === sourceId || item.id === sourceId) {
        // Remove attr bonuses
        if (item.attrBonus) {
          updatedActor = {
            ...updatedActor,
            tableAttrs: {
              气血: updatedActor.tableAttrs.气血 - (item.attrBonus.气血 ?? 0),
              护体: updatedActor.tableAttrs.护体 - (item.attrBonus.护体 ?? 0),
              爆发: updatedActor.tableAttrs.爆发 - (item.attrBonus.爆发 ?? 0),
              回气: updatedActor.tableAttrs.回气 - (item.attrBonus.回气 ?? 0),
              观照: updatedActor.tableAttrs.观照 - (item.attrBonus.观照 ?? 0),
              身势: updatedActor.tableAttrs.身势 - (item.attrBonus.身势 ?? 0),
            },
          };
          actorHadBonus = true;
        }

        // Remove permanent qi dice provided by this item from QI_POOL
        if (item.qiDice && item.qiDice.zone === "QI_POOL") {
          next.dice = next.dice.filter(
            (die) =>
              !(die.sourceId === (item.sourceId ?? item.id) && die.zone === "QI_POOL"),
          );
        }

        // Unequip if this was the equipped weapon
        if (updatedActor.equippedWeapon === item.id) {
          updatedActor = {
            ...updatedActor,
            equippedWeapon: undefined,
            inventory: updatedActor.inventory.map((inv) =>
              inv.id === item.id ? { ...inv, equipped: false } : inv,
            ),
          };
        }

        // Add inventory event
        updatedActor = {
          ...updatedActor,
          inventoryEvents: [
            {
              itemId: item.id,
              actorId: actor.id,
              eventType: "expire_source" as const,
              createdAt: Date.now(),
            },
            ...(updatedActor.inventoryEvents ?? []),
          ],
        };

        if (actorHadBonus) {
          bonusRemovalLog += bonusRemovalLog ? `；` : "";
          bonusRemovalLog += `${actor.name}失去「${item.name}」属性加成`;
        }
      }
    }

    return updatedActor;
  });

  if (bonusRemovalLog) {
    next = appendLog(next, "EXPIRE_SOURCE", `来源「${sourceId}」失效，${bonusRemovalLog}。`);
  }

  return appendLog(
    next,
    "EXPIRE_SOURCE",
    `来源「${sourceId}」失效，移除未锁定气骰 ${expiredUnlocked.length} 枚。`,
  );
}

// ============================================================================
// STATUS EFFECT FUNCTIONS
// ============================================================================

/**
 * applyStatusEffect: Add or modify a status effect on an actor.
 * If a status with the same name exists, increase layers.
 */
export function applyStatusEffect(
  state: CombatState,
  actorId: string,
  status: StatusEffect,
): CombatState {
  let next = cloneState(state);

  next.actors = next.actors.map((actor) => {
    if (actor.id !== actorId) return actor;

    const existingIndex = actor.statuses.findIndex((s) => s.name === status.name);

    if (existingIndex >= 0) {
      // Increase layers on existing status
      const updatedStatuses = [...actor.statuses];
      const existing = updatedStatuses[existingIndex];
      updatedStatuses[existingIndex] = {
        ...existing,
        layers: existing.layers + status.layers,
        durationRounds: status.durationRounds !== undefined && status.durationRounds > 0
          ? status.durationRounds
          : existing.durationRounds,
      };
      return { ...actor, statuses: updatedStatuses };
    } else {
      // Add new status
      return {
        ...actor,
        statuses: [...actor.statuses, { ...status, ownerId: actorId }],
      };
    }
  });

  return appendLog(
    next,
    "STATUS_APPLIED",
    `对 ${next.actors.find((a) => a.id === actorId)?.name ?? actorId} 施加「${status.name}」${status.layers}层。`,
  );
}

/**
 * Convenience helper: apply a status by name and layers.
 * Creates a default StatusEffect with indefinite duration.
 */
function applyStatusEffectByName(
  state: CombatState,
  actorId: string,
  name: string,
  layers: number,
): CombatState {
  const status: StatusEffect = {
    id: `status-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: name as StatusEffect["name"],
    layers,
    source: "trigger",
    durationRounds: -1,
    ownerId: actorId,
    public: true,
    effects: [],
    removalEntries: [],
  };
  return applyStatusEffect(state, actorId, status);
}

/**
 * decayStatuses: Process all actors' statuses with decayRule matching the given rule.
 * Typically called at round end with "每轮结束-1层".
 */
export function decayStatuses(state: CombatState): CombatState {
  return decayStatusesInternal(state, undefined);
}

/**
 * Internal decay function. If decayRuleFilter is specified, only decay matching rules.
 * If undefined, decay all statuses with any decayRule.
 */
function decayStatusesInternal(
  state: CombatState,
  decayRuleFilter?: string,
): CombatState {
  let next = cloneState(state);
  const decayed: string[] = [];

  next.actors = next.actors.map((actor) => {
    let updatedStatuses = [...actor.statuses];

    updatedStatuses = updatedStatuses
      .map((status) => {
        // Only process statuses with matching decay rule
        if (decayRuleFilter && status.decayRule !== decayRuleFilter) {
          return status;
        }
        if (!status.decayRule) return status;

        // Parse "每轮结束-1层" → reduce by 1
        const match = status.decayRule.match(/每轮结束-(\d+)层/);
        if (match) {
          const reduction = parseInt(match[1], 10);
          const newLayers = status.layers - reduction;
          decayed.push(`${actor.name}「${status.name}」${status.layers}→${Math.max(0, newLayers)}层`);
          return { ...status, layers: newLayers, durationRounds: Math.max(0, (status.durationRounds ?? 0) - 1) };
        }

        // Generic duration-based decay
        if ((status.durationRounds ?? -1) > 0) {
          const newDuration = status.durationRounds! - 1;
          decayed.push(`${actor.name}「${status.name}」剩余轮数 ${status.durationRounds}→${Math.max(0, newDuration)}`);
          return { ...status, durationRounds: Math.max(0, newDuration) };
        }

        return status;
      })
      // Remove statuses with layers <= 0
      .filter((status) => {
        if (status.layers <= 0) {
          decayed.push(`${actor.name}「${status.name}」层数耗尽，已移除`);
          return false;
        }
        return true;
      });

    return { ...actor, statuses: updatedStatuses };
  });

  if (decayed.length > 0) {
    next = appendLog(next, "STATUS_DECAY", `状态衰减：${decayed.join("；")}`);
  }

  return next;
}

// ============================================================================
// MOMENTUM & ROUND MANAGEMENT
// ============================================================================

/**
 * changeMomentum: Change a specific actor's momentum state.
 * Validates legal transitions.
 */
export function changeMomentum(
  state: CombatState,
  actorId: string,
  momentum: ShiState,
): CombatState {
  let next = cloneState(state);
  const actor = requireActor(next, actorId);

  // Validate legal transition
  // 崩势 can only transition to 失势 (and only via auto-transition)
  if (actor.momentum === "崩势" && momentum !== "失势") {
    throw new Error(`崩势只能自动转入失势，不能直接变为「${momentum}」。`);
  }

  // Cannot set to 崩势 unless through risk triggers
  if (momentum === "崩势") {
    // Allow via DM override — this is a design choice
  }

  next.actors = next.actors.map((a) =>
    a.id === actorId ? { ...a, momentum } : a,
  );

  return appendLog(
    next,
    "MOMENTUM_CHANGED",
    `${actor.name} 势变更：${actor.momentum} → 「${momentum}」。`,
  );
}

/**
 * endRound: Finish round-end maintenance and begin the next declaration phase.
 * Can only be called once from round_end.
 */
export function endRound(state: CombatState): CombatState {
  if (state.phase !== "round_end") {
    throw new Error(`当前时点「${state.phase}」不允许进入下一轮。`);
  }

  let next = cloneState(state);
  next.pendingAction = undefined;

  // Decay all statuses
  next = decayStatuses(next);

  // Reset response quotas
  next.actors = next.actors.map(resetActorResponseBudgets);

  next.phase = "declare";
  next.round += 1;
  next.actedActorIds = [];
  next.turnPaused = false;
  const livingOrder = next.initiativeOrder.filter((actorId) =>
    next.actors.some((actor) => actor.id === actorId && actor.hp > 0));
  const missingLiving = next.actors
    .filter((actor) => actor.hp > 0 && !livingOrder.includes(actor.id))
    .map((actor) => actor.id);
  next.initiativeOrder = [...livingOrder, ...missingLiving];
  next.activeActorId = next.initiativeOrder[0] ?? next.activeActorId;

  next = appendLog(
    next,
    "ROUND_ENDED",
    `第 ${next.round - 1} 轮结束，进入第 ${next.round} 轮宣言。`,
  );
  next = appendFeedback(next, {
    kind: "round",
    actorId: next.activeActorId,
    title: `第 ${next.round} 轮`,
    detail: "全员响应次数已重置",
  });
  return syncRuntimeSequence(next);
}

/**
 * Complete the active actor's main action and pass control to the next living
 * actor. Round maintenance runs only after everyone in the fixed initiative
 * order has acted, never after every individual action.
 */
export function advanceTurn(state: CombatState): CombatState {
  if (state.phase !== "round_end") {
    throw new Error(`当前时点「${state.phase}」不允许推进角色顺序。`);
  }

  let next = cloneState(state);
  const livingOrder = next.initiativeOrder.filter((actorId) =>
    next.actors.some((actor) => actor.id === actorId && actor.hp > 0));
  const missingLiving = next.actors
    .filter((actor) => actor.hp > 0 && !livingOrder.includes(actor.id))
    .map((actor) => actor.id);
  next.initiativeOrder = [...livingOrder, ...missingLiving];

  const acted = new Set(next.actedActorIds);
  if (next.activeActorId) acted.add(next.activeActorId);
  next.actedActorIds = [...acted];

  const currentIndex = Math.max(0, next.initiativeOrder.indexOf(next.activeActorId));
  const rotated = [
    ...next.initiativeOrder.slice(currentIndex + 1),
    ...next.initiativeOrder.slice(0, currentIndex + 1),
  ];
  const nextActorId = rotated.find((actorId) => !acted.has(actorId));
  if (!nextActorId) return endRound(next);

  next.activeActorId = nextActorId;
  next.phase = next.encounterMode === "scene" ? "scene" : "declare";
  next.pendingAction = undefined;
  next.turnPaused = false;
  const actor = next.actors.find((entry) => entry.id === nextActorId);
  next = appendLog(next, "TURN_ADVANCED", `行动序列推进：轮到 ${actor?.name ?? nextActorId}。`, true);
  next = appendFeedback(next, {
    kind: "round",
    actorId: nextActorId,
    title: `轮到 ${actor?.name ?? "下一位"}`,
    detail: `第 ${next.round} 轮`,
  });
  return syncRuntimeSequence(next);
}

// ============================================================================
// INVENTORY & EQUIPMENT FUNCTIONS
// ============================================================================

/**
 * useInventoryItem: Use a consumable item from inventory.
 * Handles temp qi grants, source expiration, and quantity reduction.
 */
export function useInventoryItem(
  state: CombatState,
  actorId: string,
  itemId: string,
): CombatState {
  let next = cloneState(state);
  const actor = requireActor(next, actorId);
  const item = requireItem(actor, itemId);
  const repeatedMedicineUse = item.category === "medicine" && (actor.inventoryEvents ?? []).some(
    (event) => event.eventType === "use" && event.itemId === itemId && event.sceneId === state.scene.id,
  );

  if (item.quantity <= 0) {
    return appendLog(
      next,
      "USE_ITEM",
      `${actor.name} 尝试使用「${item.name}」，但数量不足。`,
    );
  }

  // Reduce quantity (non-equipment items)
  next.actors = next.actors.map((entry) => {
    if (entry.id !== actorId) return entry;
    return {
      ...entry,
      inventory: entry.inventory.map((stored) =>
        stored.id === itemId && stored.category !== "weapon" && stored.category !== "armor" && stored.category !== "accessory"
          ? { ...stored, quantity: Math.max(0, stored.quantity - 1) }
          : stored,
      ),
      inventoryEvents: [
        { itemId, actorId, eventType: "use" as const, sceneId: next.scene.id, createdAt: Date.now() },
        ...(entry.inventoryEvents ?? []),
      ],
    };
  });

  // Grant temporary qi if applicable
  if (item.grantsTempQi) {
    next = grantTemporaryQi(next, actorId, item);
  }

  // Expire linked source if applicable
  if (item.expiresSourceId) {
    next = expireSource(next, item.expiresSourceId);
    return appendLog(
      next,
      "ITEM_SOURCE_EXPIRED",
      `${actor.name} 使用「${item.name}」，触发来源失效：${item.expiresSourceId}。`,
    );
  }

  // Healing is an explicit consumable effect. attrBonus.气血 remains a
  // migration fallback for older saves, but new data uses healHp so equipment
  // attributes and immediate healing cannot be confused.
  const healAmount = Math.max(0, item.healHp ?? item.attrBonus?.气血 ?? 0);
  if (healAmount > 0) {
    next.actors = next.actors.map((a) =>
      a.id === actorId
        ? { ...a, hp: Math.min(a.maxHp, a.hp + healAmount) }
        : a,
    );
  }

  if (repeatedMedicineUse && item.repeatUseStatus) {
    next = applyStatusEffect(next, actorId, {
      id: `status-medicine-conflict-${actorId}-${next.scene.id}`,
      name: item.repeatUseStatus,
      layers: 1,
      source: item.name,
      ownerId: actorId,
      public: true,
      effects: ["再次使用药物时，按药物条目增加副作用。"],
      removalEntries: ["场景结束", "医理法门"],
    });
  }

  const resultText = [
    healAmount > 0 ? `恢复${Math.min(healAmount, Math.max(0, actor.maxHp - actor.hp))}点气血` : "",
    repeatedMedicineUse && item.repeatUseStatus ? `获得「${item.repeatUseStatus}」` : "",
  ].filter(Boolean).join("，");
  return appendLog(next, "USE_ITEM", `${actor.name} 使用「${item.name}」${resultText ? `，${resultText}` : ""}。`);
}

/**
 * equipItem: Equip an item from inventory.
 * Updates equipped status and applies attr bonuses.
 */
export function equipItem(
  state: CombatState,
  actorId: string,
  itemId: string,
): CombatState {
  let next = cloneState(state);
  const actor = requireActor(next, actorId);
  const item = requireItem(actor, itemId);

  next.actors = next.actors.map((entry) => {
    if (entry.id !== actorId) return entry;

    let updatedEntry = {
      ...entry,
      inventory: entry.inventory.map((stored) =>
        stored.id === itemId ? { ...stored, equipped: true } : stored,
      ),
      inventoryEvents: [
        { itemId, actorId, eventType: "equip" as const, createdAt: Date.now() },
        ...(entry.inventoryEvents ?? []),
      ],
    };

    // Set as equipped weapon if it's a weapon
    if (item.category === "weapon") {
      updatedEntry = { ...updatedEntry, equippedWeapon: itemId };
    }

    // Apply attr bonuses
    if (item.attrBonus) {
      updatedEntry = {
        ...updatedEntry,
        tableAttrs: {
          气血: updatedEntry.tableAttrs.气血 + (item.attrBonus.气血 ?? 0),
          护体: updatedEntry.tableAttrs.护体 + (item.attrBonus.护体 ?? 0),
          爆发: updatedEntry.tableAttrs.爆发 + (item.attrBonus.爆发 ?? 0),
          回气: updatedEntry.tableAttrs.回气 + (item.attrBonus.回气 ?? 0),
          观照: updatedEntry.tableAttrs.观照 + (item.attrBonus.观照 ?? 0),
          身势: updatedEntry.tableAttrs.身势 + (item.attrBonus.身势 ?? 0),
        },
      };
    }

    // Add qi dice from equipment to QI_POOL
    if (item.qiDice && item.qiDice.zone === "QI_POOL") {
      const newDice: QiDie[] = Array.from(
        { length: item.qiDice.count },
        (_, index) => ({
          id: `equip-${itemId}-${Date.now()}-${index}`,
          label: `d${item.qiDice!.sides}`,
          sourceId: item.sourceId ?? itemId,
          sourceName: item.name,
          nature: item.qiDice!.nature,
          sides: item.qiDice!.sides,
          value: null,
          zone: "QI_POOL" as QiZone,
          ownerId: actorId,
          temporary: false,
        }),
      );
      next.dice = [...next.dice, ...newDice];
    }

    return updatedEntry;
  });

  return appendLog(next, "EQUIP_ITEM", `${actor.name} 装备「${item.name}」。`);
}

/**
 * unequipItem: Unequip an item from inventory.
 * Updates equipped status and removes attr bonuses.
 */
export function unequipItem(
  state: CombatState,
  actorId: string,
  itemId: string,
): CombatState {
  let next = cloneState(state);
  const actor = requireActor(next, actorId);
  const item = requireItem(actor, itemId);

  next.actors = next.actors.map((entry) => {
    if (entry.id !== actorId) return entry;

    let updatedEntry = {
      ...entry,
      inventory: entry.inventory.map((stored) =>
        stored.id === itemId ? { ...stored, equipped: false } : stored,
      ),
      inventoryEvents: [
        { itemId, actorId, eventType: "unequip" as const, createdAt: Date.now() },
        ...(entry.inventoryEvents ?? []),
      ],
    };

    // Clear equipped weapon if this was it
    if (entry.equippedWeapon === itemId) {
      updatedEntry = { ...updatedEntry, equippedWeapon: undefined };
    }

    // Remove attr bonuses
    if (item.attrBonus) {
      updatedEntry = {
        ...updatedEntry,
        tableAttrs: {
          气血: Math.max(0, updatedEntry.tableAttrs.气血 - (item.attrBonus.气血 ?? 0)),
          护体: Math.max(0, updatedEntry.tableAttrs.护体 - (item.attrBonus.护体 ?? 0)),
          爆发: Math.max(0, updatedEntry.tableAttrs.爆发 - (item.attrBonus.爆发 ?? 0)),
          回气: Math.max(0, updatedEntry.tableAttrs.回气 - (item.attrBonus.回气 ?? 0)),
          观照: Math.max(0, updatedEntry.tableAttrs.观照 - (item.attrBonus.观照 ?? 0)),
          身势: Math.max(0, updatedEntry.tableAttrs.身势 - (item.attrBonus.身势 ?? 0)),
        },
      };
    }

    // Remove qi dice provided by this equipment
    if (item.qiDice) {
      next.dice = next.dice.filter(
        (die) => !(die.sourceId === (item.sourceId ?? itemId) && die.zone === "QI_POOL"),
      );
    }

    return updatedEntry;
  });

  return appendLog(next, "UNEQUIP_ITEM", `${actor.name} 卸下「${item.name}」。`);
}

// ============================================================================
// DM & VISIBILITY FUNCTIONS
// ============================================================================

/**
 * dmOverride: DM makes a manual ruling.
 */
export function dmOverride(
  state: CombatState,
  message: string,
  isPublic = true,
): CombatState {
  let next = cloneState(state);
  return appendLog(next, "DM_OVERRIDE", `DM裁定：${message}`, isPublic);
}

/**
 * Authoritative DM distance edit used by the distance drawer. The relation is
 * direction-agnostic for validation, so an existing reverse relation is
 * updated instead of creating a duplicate edge.
 */
export function dmSetDistance(
  state: CombatState,
  fromActorId: string,
  toActorId: string,
  band: DistanceBand,
  entangled?: boolean,
): CombatState {
  if (fromActorId === toActorId) throw new Error("不能设置角色与自身的距离。");
  const from = state.actors.find((actor) => actor.id === fromActorId);
  const to = state.actors.find((actor) => actor.id === toActorId);
  if (!from || !to) throw new Error("距离关系中的角色不存在。");

  const next = cloneState(state);
  const relationIndex = next.distances.findIndex((relation) =>
    (relation.fromActorId === fromActorId && relation.toActorId === toActorId)
      || (relation.fromActorId === toActorId && relation.toActorId === fromActorId));
  const previous = relationIndex >= 0 ? next.distances[relationIndex] : undefined;
  const updated = {
    id: previous?.id ?? `distance-${fromActorId}-${toActorId}`,
    fromActorId: previous?.fromActorId ?? fromActorId,
    toActorId: previous?.toActorId ?? toActorId,
    band,
    height: previous?.height ?? "同层" as const,
    entangled: entangled ?? previous?.entangled ?? false,
    public: previous?.public ?? true,
  };

  if (relationIndex >= 0) next.distances[relationIndex] = updated;
  else next.distances.push(updated);

  return appendLog(
    next,
    "DISTANCE_CHANGED",
    `DM调整距离：${from.name}与${to.name}为${band}${updated.entangled ? "，处于纠缠" : ""}。`,
  );
}

/**
 * visibleForPlayer: Filter state to what a specific player can see.
 * Updated to handle StatusEffect[] filtering.
 */
export function visibleForPlayer(
  state: CombatState,
  viewerActorId = "pc-shen-qing",
): CombatState {
  return {
    ...state,
    actors: state.actors.map((actor) => {
      // Determine visible statuses
      const visibleStatuses: StatusEffect[] = actor.statuses.filter((s) => s.public !== false);

      return {
        ...actor,
        dmNote: undefined,
        hiddenGoal: undefined,
        behaviorHint: undefined,
        entryCondition: undefined,
        lootOrClue: undefined,
        hiddenStatuses: undefined,
        statuses: visibleStatuses,
        inventory:
          actor.side === "enemy"
            ? []
            : actor.inventory.map((item) => ({ ...item, dmNote: undefined })),
        responses:
          actor.side === "enemy"
            ? actor.responses.filter((response) => response.responseType === "应招")
            : actor.responses,
      };
    }),
    tracks: state.tracks.filter((track) => !track.hidden),
    scene: {
      ...state.scene,
      elements: state.scene.elements.filter((element) => element.public),
      permissions: state.scene.permissions.filter((fact) => fact.public),
      resources: state.scene.resources.filter((fact) => fact.public),
      pendingRequest: undefined,
      lastResolution: state.scene.lastResolution,
    },
    dice: state.dice.filter((die) => die.ownerId === viewerActorId),
    distances: (state.distances ?? []).filter((distance) => distance.public),
    logs: state.logs.filter((log) => log.public),
  };
}

/**
 * visibleForLanPublic: Filter state for public broadcast (no dice visibility).
 */
export function visibleForLanPublic(state: CombatState): CombatState {
  const publicState = visibleForPlayer(state, "__lan_public__");
  return {
    ...publicState,
    dice: [],
    pendingAction: publicState.pendingAction
      ? {
          ...publicState.pendingAction,
          diceIds: [],
          yinSlotDiceIds: [],
          yangSlotDiceIds: [],
        }
      : undefined,
  };
}

// ============================================================================
// INTERNAL UTILITY FUNCTIONS
// ============================================================================

function cloneState(state: CombatState): CombatState {
  return structuredClone(state);
}

function appendLog(
  state: CombatState,
  type: string,
  message: string,
  isPublic = true,
): CombatState {
  const entry: CombatLogEntry = {
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    round: state.round,
    message,
    public: isPublic,
    createdAt: Date.now(),
  };
  return { ...state, logs: [entry, ...state.logs] };
}

function appendFeedback(
  state: CombatState,
  event: Omit<CombatFeedbackEvent, "id" | "createdAt">,
): CombatState {
  const createdAt = Date.now();
  const feedback: CombatFeedbackEvent = {
    ...event,
    id: `${event.kind}-${createdAt}-${Math.random().toString(16).slice(2)}`,
    createdAt,
  };
  return { ...state, feedback: [feedback, ...(state.feedback ?? [])].slice(0, 24) };
}

function moveDice(dice: QiDie[], diceIds: string[], zone: QiZone): QiDie[] {
  return dice.map((die) =>
    diceIds.includes(die.id) ? { ...die, zone } : die,
  );
}

/**
 * Complete a spend according to the seven-zone qi flow. Regular dice enter
 * QI_REST; temporary dice are one-shot resources and leave the state instead
 * of becoming recoverable dice.
 */
function settleSpentDice(dice: QiDie[], diceIds: string[]): QiDie[] {
  const spent = new Set(diceIds);
  return dice
    .filter((die) => !(spent.has(die.id) && die.temporary))
    .map((die) => spent.has(die.id) ? { ...die, zone: "QI_REST" as QiZone } : die);
}

function requirePendingAction(state: CombatState) {
  if (!state.pendingAction) {
    throw new Error("当前没有待结算宣言。");
  }
  return state.pendingAction;
}

function requireActor(state: CombatState, actorId: string): Actor {
  const actor = state.actors.find((item) => item.id === actorId);
  if (!actor) {
    throw new Error(`找不到角色：${actorId}`);
  }
  return actor;
}

function requireMove(actor: Actor, moveId: string): Move {
  const move = actor.moves.find((item) => item.id === moveId);
  if (!move) {
    throw new Error(`找不到招式：${moveId}`);
  }
  return move;
}

/**
 * Find a response by ID and responseType (截击/应招).
 */
function requireResponseByType(
  actor: Actor,
  responseId: string,
  responseType: "截击" | "应招",
): ResponseAttachment {
  const response = actor.responses.find(
    (item) => item.id === responseId && item.responseType === responseType,
  );
  if (!response) {
    throw new Error(`找不到响应挂载：${responseId}（类型：${responseType}）`);
  }
  return response;
}

function requireItem(actor: Actor, itemId: string): InventoryItem {
  const item = actor.inventory.find((entry) => entry.id === itemId);
  if (!item) {
    throw new Error(`找不到物品：${itemId}`);
  }
  return item;
}

function validDiceForOwner(
  state: CombatState,
  ownerId: string,
  diceIds: string[],
): string[] {
  return diceIds.filter((id) => {
    const die = state.dice.find((item) => item.id === id);
    return (
      die?.ownerId === ownerId &&
      (die.zone === "QI_SEA" || die.zone === "TEMP_QI")
    );
  });
}

/**
 * grantTemporaryQi: Create temporary qi dice from an item and add them to TEMP_QI.
 */
export function grantTemporaryQi(
  state: CombatState,
  actorId: string,
  item: InventoryItem,
): CombatState {
  if (!item.grantsTempQi) {
    return state;
  }

  const dice: QiDie[] = Array.from(
    { length: item.grantsTempQi.count },
    (_, index) => ({
      id: `temp-${item.id}-${Date.now()}-${index}`,
      label: `d${item.grantsTempQi!.sides}`,
      sourceId: item.sourceId ?? item.id,
      sourceName: item.name,
      nature: item.grantsTempQi!.nature,
      sides: item.grantsTempQi!.sides,
      value: defaultRoll(item.grantsTempQi!.sides),
      zone: "TEMP_QI" as QiZone,
      ownerId: actorId,
      temporary: true,
    }),
  );

  return appendLog(
    { ...state, dice: [...state.dice, ...dice] },
    "TEMP_QI_GRANTED",
    `「${item.name}」生成临时气骰 ${dice.length} 枚。`,
  );
}
