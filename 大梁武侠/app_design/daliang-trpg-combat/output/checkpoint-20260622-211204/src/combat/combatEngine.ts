import type {
  Actor,
  CombatLogEntry,
  CombatState,
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

export type RollFn = (sides: number) => number;

export const defaultRoll: RollFn = (sides) => Math.floor(Math.random() * sides) + 1;

export interface ActionAvailability {
  allowed: boolean;
  reasons: string[];
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
export function parseBaseEffect(effect: string): ParsedEffect {
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
function extractDamage(effect: string): number {
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
  allowedShi: ShiState[],
): { valid: boolean; reason?: string } {
  // 无势: any momentum is allowed
  if (shiCondition === "无势") {
    return { valid: true };
  }

  // 崩势 special rule: cannot declare formal actions or strong responses
  if (actor.momentum === "崩势") {
    return { valid: false, reason: `角色处于崩势状态，不能声明正式出手或强响应` };
  }

  // Check if current momentum is in the allowed range
  if (!allowedShi.includes(actor.momentum)) {
    return {
      valid: false,
      reason: `势条件不满足：当前为「${actor.momentum}」，需要「${allowedShi.join("、")}」`,
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
  threshold: string,
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
    return { allowed: false, reasons: ["未找到行动或角色"] };
  }

  if (state.activeActorId !== actorId) {
    reasons.push("不是当前行动者");
  }

  if (state.phase !== "scene" && state.phase !== "declare") {
    reasons.push("当前时点不允许宣言");
  }

  // Response quota check
  if (actor.responseQuotaUsed >= actor.maxResponseQuota) {
    reasons.push("本轮响应额度已用完");
  }

  // Momentum validation
  const momentumCheck = validateMomentum(actor, move.shiCondition, move.allowedShi);
  if (!momentumCheck.valid && momentumCheck.reason) {
    reasons.push(momentumCheck.reason);
  }

  // Equipment validation
  const equipCheck = validateEquipPermission(actor, move.equipPermission);
  if (!equipCheck.valid && equipCheck.reason) {
    reasons.push(equipCheck.reason);
  }

  // Formal move (正式出手) requires both yin and yang slot dice
  if (move.timing === "正式出手") {
    if ((slotDice.yinSlotDiceIds?.length ?? 0) === 0) {
      reasons.push("缺少阴槽气骰（正式出手必须配置阴槽和阳槽）");
    }
    if ((slotDice.yangSlotDiceIds?.length ?? 0) === 0) {
      reasons.push("缺少阳槽气骰（正式出手必须配置阴槽和阳槽）");
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
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

// ============================================================================
// CORE ENGINE FUNCTIONS
// ============================================================================

export function prepareCombatRound(state: CombatState): CombatState {
  let next = cloneState(state);
  next.phase = "initiative";
  next.pendingAction = undefined;
  next.dice = next.dice.map((die) => (
    die.temporary ? die : { ...die, zone: "QI_POOL" as QiZone, value: null }
  ));
  next = appendLog(next, "phase_changed", "交锋轮开始：进入先后确认，常规气骰回到气池。");
  return next;
}

export function confirmInitiative(state: CombatState): CombatState {
  let next = cloneState(state);
  const ordered = [...next.actors].sort((a, b) => {
    const aScore = a.tableAttrs.观照 + a.tableAttrs.身势;
    const bScore = b.tableAttrs.观照 + b.tableAttrs.身势;
    if (bScore !== aScore) return bScore - aScore;
    if (a.side !== b.side) return a.side === "player" ? -1 : 1;
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });
  const firstActor = ordered[0];
  if (firstActor) next.activeActorId = firstActor.id;
  next.phase = "scene";
  next.pendingAction = undefined;
  next.actors = next.actors.map((actor) => ({ ...actor, responseQuotaUsed: 0 }));
  next.dice = next.dice.map((die) => (
    die.temporary ? die : { ...die, zone: "QI_POOL" as QiZone, value: null }
  ));
  next = appendLog(
    next,
    "phase_changed",
    `先后确认：${firstActor?.name ?? "待定"} 先行动。常规气骰等待整体投掷入气海。`,
  );
  return next;
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
  next.phase = "scene";
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
    // Reset response quota
    return { ...actor, responseQuotaUsed: 0 };
  });

  // Decay statuses with "每轮结束-1层" rule
  next = decayStatusesInternal(next, "每轮结束-1层");

  return appendLog(next, "ENTER_SCENE", "DM开始新场景：常规气骰从气池投出并进入气海。");
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

  // Validate phase
  if (next.phase !== "scene" && next.phase !== "declare") {
    throw new Error(`当前时点「${next.phase}」不允许宣言招式。`);
  }

  // Validate response quota
  if (actor.responseQuotaUsed >= actor.maxResponseQuota) {
    throw new Error(`${actor.name} 本轮响应额度已用完（${actor.responseQuotaUsed}/${actor.maxResponseQuota}）。`);
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

  return appendLog(
    next,
    "DECLARE_ACTION",
    `${actor.name} 宣言「${move.name}」指向 ${target.name}，锁气 ${usableDice.length} 枚（阴槽 ${yinSlotIds.length} / 阳槽 ${yangSlotIds.length}），打开截击窗口。`,
  );
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
): CombatState {
  let next = cloneState(state);
  const action = requirePendingAction(next);
  const responder = requireActor(next, responderId);
  const response = requireResponseByType(responder, responseId, "截击");

  // Validate shi condition / allowed momentum
  const momentumCheck = validateMomentum(responder, response.shiCondition, response.allowedShi);
  if (!momentumCheck.valid) {
    throw new Error(momentumCheck.reason ?? "截击势条件不满足");
  }

  // Validate and increment response quota
  if (responder.responseQuotaUsed >= responder.maxResponseQuota) {
    throw new Error(`${responder.name} 本轮响应额度已用完。`);
  }
  next.actors = next.actors.map((a) =>
    a.id === responderId
      ? { ...a, responseQuotaUsed: a.responseQuotaUsed + 1 }
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

  // Move responder's dice + action's dice to QI_REST
  next.dice = moveDice(next.dice, [...responderDice, ...action.diceIds], "QI_REST");
  next.phase = "outcome";
  next.pendingAction = undefined;

  // Apply responder's postShi from the response
  if (response.postShi !== "不改势") {
    next.actors = next.actors.map((a) =>
      a.id === responderId ? { ...a, momentum: response.postShi as ShiState } : a,
    );
  }

  return appendLog(
    next,
    "INTERCEPT",
    `${responder.name} 使用截击「${response.moveName}」，本次宣言不合法；双方已用气骰进入息库。${response.postShi !== "不改势" ? `势变更为「${response.postShi}」。` : ""}`,
  );
}

/**
 * formMove: Form the move — move dice into yin/yang slots, calculate slot values,
 * resolve triggers. If dice count < minDice, the action fails.
 */
export function formMove(state: CombatState): CombatState {
  let next = cloneState(state);
  const action = requirePendingAction(next);
  const actor = requireActor(next, action.actorId);
  const target = requireActor(next, action.targetId);
  const move = requireMove(actor, action.moveId);
  const diceCount = action.diceIds.length;

  // Check minimum dice
  if (diceCount < move.minDice) {
    next.dice = moveDice(next.dice, action.diceIds, "QI_REST");
    next.pendingAction = undefined;
    next.phase = "outcome";
    return appendLog(
      next,
      "FORM_MOVE",
      `${actor.name} 的「${move.name}」最低投入不足（${diceCount}/${move.minDice}），未成招，锁气进入息库。`,
    );
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

  return appendLog(
    next,
    "FORM_MOVE",
    `${actor.name} 的「${move.name}」成招（阴值 ${slotValues.阴值} / 阳值 ${slotValues.阳值} / 合值 ${slotValues.合值} / 阴阳差 ${slotValues.阴阳差}）。${triggerLog}。目标 ${target.name} 可在落果前应招。`,
  );
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
): CombatState {
  let next = cloneState(state);
  const action = requirePendingAction(next);
  const responder = requireActor(next, responderId);
  const response = requireResponseByType(responder, responseId, "应招");

  // Validate shi condition / allowed momentum
  const momentumCheck = validateMomentum(responder, response.shiCondition, response.allowedShi);
  if (!momentumCheck.valid) {
    throw new Error(momentumCheck.reason ?? "应招势条件不满足");
  }

  // Validate and increment response quota
  if (responder.responseQuotaUsed >= responder.maxResponseQuota) {
    throw new Error(`${responder.name} 本轮响应额度已用完。`);
  }
  next.actors = next.actors.map((a) =>
    a.id === responderId
      ? { ...a, responseQuotaUsed: a.responseQuotaUsed + 1 }
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
  next.dice = moveDice(next.dice, responderDice, "QI_REST");

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

  // Resolve response triggers against current slot values
  const currentSlotValues = action.slotValues ?? { 阴值: 0, 阳值: 0, 合值: 0, 阴阳差: 0 };
  const resolvedTriggers = resolveSlotTriggers(response.triggers, currentSlotValues);
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

  return appendLog(
    next,
    "REACT",
    `${responder.name} 使用应招「${response.moveName}」，${reactLogExtra || `落果减轻 ${additionalPrevent}`}。当前共抵消 ${totalPrevented} 点。${finalResponderMomentum ? `势变更为「${finalResponderMomentum}」。` : ""}`,
  );
}

/**
 * applyOutcome: Calculate and apply final damage, status effects, postShi change.
 * Move all action dice to QI_REST, clear pendingAction, increment round.
 */
export function applyOutcome(state: CombatState): CombatState {
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
  next.dice = moveDice(next.dice, uniqueDice, "QI_REST");

  next.pendingAction = undefined;
  next.phase = "outcome";
  next.round += 1;

  const damageMsg =
    damage > 0
      ? `${target.name} 气血-${damage}（基础 ${extractDamage(move.baseEffect)} + 触发 ${triggerDamage} - 抵消 ${action.preventedDamage ?? 0}）`
      : "未造成气血损失";

  return appendLog(
    next,
    "APPLY_OUTCOME",
    `${actor.name} 的「${move.name}」落果：${damageMsg}。`,
  );
}

// ============================================================================
// RECOVERY FUNCTIONS
// ============================================================================

/**
 * regulateBreath: Move dice from QI_REST to QI_SEA.
 *   active=true (主动调息): WITH reroll
 *   active=false (被动流转): WITHOUT reroll
 */
export function regulateBreath(
  state: CombatState,
  actorId: string,
  diceIds: string[],
  active = false,
  roll: RollFn = defaultRoll,
): CombatState {
  let next = cloneState(state);
  const actor = requireActor(next, actorId);

  const restDice = diceIds.filter((id) =>
    next.dice.some(
      (die) => die.id === id && die.ownerId === actorId && die.zone === "QI_REST",
    ),
  );

  if (active) {
    // 主动调息: reroll dice values before moving to QI_SEA
    next.dice = next.dice.map((die) => {
      if (!restDice.includes(die.id)) return die;
      return { ...die, value: roll(die.sides), zone: "QI_SEA" as QiZone };
    });
  } else {
    // 被动流转: move without reroll
    next.dice = moveDice(next.dice, restDice, "QI_SEA");
  }

  next.phase = "scene";

  const mode = active ? "主动调息（重掷入气海）" : "被动流转（不重掷入气海）";
  return appendLog(
    next,
    "REGULATE_BREATH",
    `${actor.name} ${mode}，${restDice.length} 枚气骰从息库回气海。`,
  );
}

/**
 * useReflection: 返照 — take the lowest-value die from QI_REST and move it to QI_SEA.
 * Only allowed when QI_SEA is empty for that actor (断气条件).
 * Does NOT reroll — keeps the original value.
 */
export function useReflection(state: CombatState, actorId: string): CombatState {
  let next = cloneState(state);
  const actor = requireActor(next, actorId);

  // Check 断气条件: QI_SEA is empty
  const hasSea = next.dice.some(
    (die) => die.ownerId === actorId && die.zone === "QI_SEA",
  );
  if (hasSea) {
    return appendLog(
      next,
      "REFLECTION",
      `${actor.name} 尝试返照失败：气海仍有可用气骰。`,
    );
  }

  // Find the lowest-value die in QI_REST
  const candidate = next.dice
    .filter(
      (die) =>
        die.ownerId === actorId &&
        die.zone === "QI_REST" &&
        die.value !== null &&
        !die.temporary,
    )
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];

  if (!candidate) {
    return appendLog(
      next,
      "REFLECTION",
      `${actor.name} 尝试返照失败：息库没有可取回气骰。`,
    );
  }

  // Move to QI_SEA WITHOUT reroll (keep original value)
  next.dice = moveDice(next.dice, [candidate.id], "QI_SEA");

  return appendLog(
    next,
    "REFLECTION",
    `${actor.name} 返照，取回最低可用气骰 ${candidate.sourceName}（${candidate.value}点），不重掷。`,
  );
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
 * endRound: End the current round.
 * Decay statuses, reset response quotas, increment round, set phase to "round_end".
 */
export function endRound(state: CombatState): CombatState {
  let next = cloneState(state);
  next.pendingAction = undefined;

  // Decay all statuses
  next = decayStatuses(next);

  // Reset response quotas
  next.actors = next.actors.map((actor) => ({
    ...actor,
    responseQuotaUsed: 0,
  }));

  next.phase = "round_end";
  next.round += 1;

  return appendLog(
    next,
    "ROUND_ENDED",
    `第 ${next.round - 1} 轮结束，进入第 ${next.round} 轮准备。`,
  );
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
        { itemId, actorId, eventType: "use" as const, createdAt: Date.now() },
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

  // Apply healing if item grants it
  if (item.attrBonus?.气血) {
    next.actors = next.actors.map((a) =>
      a.id === actorId
        ? { ...a, hp: Math.min(a.maxHp, a.hp + (item.attrBonus?.气血 ?? 0)) }
        : a,
    );
  }

  return appendLog(next, "USE_ITEM", `${actor.name} 使用「${item.name}」。`);
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

function moveDice(dice: QiDie[], diceIds: string[], zone: QiZone): QiDie[] {
  return dice.map((die) =>
    diceIds.includes(die.id) ? { ...die, zone } : die,
  );
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
