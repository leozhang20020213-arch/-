import type {
  Actor,
  CombatEventType,
  CombatLogEntry,
  CombatState,
  InventoryItem,
  Move,
  QiDie,
  QiZone,
  ResponseMount,
} from "./types";

export type RollFn = (sides: number) => number;

export const defaultRoll: RollFn = (sides) => Math.floor(Math.random() * sides) + 1;

export interface ActionAvailability {
  allowed: boolean;
  reasons: string[];
}

export function canDeclareAction(
  state: CombatState,
  actorId: string,
  moveId: string,
  slotDice: { yinSlotDiceIds?: string[]; yangSlotDiceIds?: string[] },
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

  if (move.actionType === "formal") {
    if ((slotDice.yinSlotDiceIds?.length ?? 0) === 0) {
      reasons.push("缺少阴骰");
    }
    if ((slotDice.yangSlotDiceIds?.length ?? 0) === 0) {
      reasons.push("缺少阳骰");
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

export function enterScene(state: CombatState, roll: RollFn = defaultRoll): CombatState {
  const next = cloneState(state);
  next.phase = "scene";
  next.pendingAction = undefined;
  next.dice = next.dice.map((die) => {
    if (die.zone !== "QI_POOL" || die.temporary) {
      return die;
    }
    return { ...die, zone: "QI_SEA", value: roll(die.sides) };
  });
  return appendLog(next, "ENTER_SCENE", "DM开始新场景：常规气骰从气池投出并进入气海。");
}

export function commitDiceRollResults(state: CombatState, results: Array<{ id: string; value: number }>): CombatState {
  let next = cloneState(state);
  const resultIds = results.map((result) => result.id);
  next.dice = next.dice.map((die) => {
    const result = results.find((item) => item.id === die.id);
    if (!result) return die;
    return {
      ...die,
      value: Math.max(1, Math.min(die.sides, result.value)),
      zone: die.zone === "QI_POOL" ? "QI_SEA" : die.zone,
    };
  });
  next = appendLog(next, "dice_rolled", `投掷气骰 ${resultIds.length} 枚，结果已写入。`);
  if (results.some((result) => state.dice.find((die) => die.id === result.id)?.zone === "QI_POOL")) {
    next = appendLog(next, "qi_entered_sea", "气池中的已投气骰进入气海。");
  }
  return next;
}

export function declareAction(
  state: CombatState,
  actorId: string,
  targetId: string,
  moveId: string,
  diceIds: string[],
  slotDice?: { yinSlotDiceIds?: string[]; yangSlotDiceIds?: string[] },
): CombatState {
  const next = cloneState(state);
  const actor = requireActor(next, actorId);
  const target = requireActor(next, targetId);
  const move = requireMove(actor, moveId);
  const usableDice = diceIds.filter((id) => {
    const die = next.dice.find((item) => item.id === id);
    return die?.ownerId === actorId && (die.zone === "QI_SEA" || die.zone === "TEMP_QI");
  });

  next.dice = moveDice(next.dice, usableDice, "QI_LOCK");
  next.pendingAction = {
    actorId,
    targetId,
    moveId,
    diceIds: usableDice,
    yinSlotDiceIds: slotDice?.yinSlotDiceIds?.filter((id) => usableDice.includes(id)) ?? [],
    yangSlotDiceIds: slotDice?.yangSlotDiceIds?.filter((id) => usableDice.includes(id)) ?? [],
  };
  next.phase = "intercept_window";
  next.activeActorId = actorId;

  return appendLog(
    next,
    "DECLARE_ACTION",
    `${actor.name} 宣言「${move.name}」指向 ${target.name}，锁气 ${usableDice.length} 枚，打开截击窗口。`,
  );
}

export function resolveInterceptSuccess(
  state: CombatState,
  responderId: string,
  responseId: string,
  diceIds: string[],
): CombatState {
  const next = cloneState(state);
  const action = requirePendingAction(next);
  const responder = requireActor(next, responderId);
  const response = requireResponse(responder, responseId, "intercept");
  const spent = validDiceForOwner(next, responderId, diceIds);
  next.dice = moveDice(next.dice, [...spent, ...action.diceIds], "QI_REST");
  next.phase = "outcome";
  next.pendingAction = undefined;

  return appendLog(
    next,
    "INTERCEPT",
    `${responder.name} 使用截击「${response.name}」，本次宣言不合法；双方已用气骰进入息库。`,
  );
}

export function formMove(state: CombatState): CombatState {
  const next = cloneState(state);
  const action = requirePendingAction(next);
  const actor = requireActor(next, action.actorId);
  const target = requireActor(next, action.targetId);
  const move = requireMove(actor, action.moveId);
  const diceCount = action.diceIds.length;

  if (diceCount < move.minDice) {
    next.dice = moveDice(next.dice, action.diceIds, "QI_REST");
    next.pendingAction = undefined;
    next.phase = "outcome";
    return appendLog(next, "FORM_MOVE", `${actor.name} 的「${move.name}」最低投入不足，未成招，锁气进入息库。`);
  }

  next.pendingAction = { ...action, formed: true, preventedDamage: 0 };
  next.phase = "react_window";
  return appendLog(next, "FORM_MOVE", `${actor.name} 的「${move.name}」成招，目标 ${target.name} 可在落果前应招。`);
}

export function resolveReact(
  state: CombatState,
  responderId: string,
  responseId: string,
  diceIds: string[],
): CombatState {
  const next = cloneState(state);
  const action = requirePendingAction(next);
  const responder = requireActor(next, responderId);
  const response = requireResponse(responder, responseId, "react");
  const spent = validDiceForOwner(next, responderId, diceIds);
  next.dice = moveDice(next.dice, spent, "QI_REST");
  next.pendingAction = {
    ...action,
    preventedDamage: (action.preventedDamage ?? 0) + (response.preventDamage ?? 0),
  };

  return appendLog(next, "REACT", `${responder.name} 使用应招「${response.name}」，落果减轻 ${response.preventDamage ?? 0}。`);
}

export function applyOutcome(state: CombatState): CombatState {
  const next = cloneState(state);
  const action = requirePendingAction(next);
  const actor = requireActor(next, action.actorId);
  const target = requireActor(next, action.targetId);
  const move = requireMove(actor, action.moveId);
  const rawDamage = move.baseDamage ?? 0;
  const damage = Math.max(0, rawDamage - (action.preventedDamage ?? 0));

  next.actors = next.actors.map((item) => {
    if (item.id !== target.id || damage <= 0) {
      return item;
    }
    return { ...item, hp: Math.max(0, item.hp - damage) };
  });

  if (move.trackDelta) {
    next.tracks = next.tracks.map((track) =>
      track.id === "track-clue" ? { ...track, value: Math.min(track.max, track.value + move.trackDelta!) } : track,
    );
  }

  next.dice = moveDice(next.dice, action.diceIds, "QI_REST");
  next.pendingAction = undefined;
  next.phase = "outcome";
  next.round += 1;

  return appendLog(
    next,
    "APPLY_OUTCOME",
    `${actor.name} 的「${move.name}」落果：${damage > 0 ? `${target.name} 气血-${damage}` : "未造成气血损失"}。`,
  );
}

export function regulateBreath(state: CombatState, actorId: string, diceIds: string[]): CombatState {
  const next = cloneState(state);
  const actor = requireActor(next, actorId);
  const restDice = diceIds.filter((id) => next.dice.some((die) => die.id === id && die.ownerId === actorId && die.zone === "QI_REST"));
  next.dice = moveDice(next.dice, restDice, "QI_SEA");
  next.phase = "scene";
  return appendLog(next, "REGULATE_BREATH", `${actor.name} 调息，${restDice.length} 枚气骰从息库回气海，不重投。`);
}

export function useReflection(state: CombatState, actorId: string): CombatState {
  const next = cloneState(state);
  const actor = requireActor(next, actorId);
  const hasSea = next.dice.some((die) => die.ownerId === actorId && die.zone === "QI_SEA");
  if (hasSea) {
    return appendLog(next, "REFLECTION", `${actor.name} 尝试返照失败：气海仍有可用气骰。`);
  }

  const candidate = next.dice
    .filter((die) => die.ownerId === actorId && die.zone === "QI_REST" && die.value !== null)
    .sort((a, b) => (a.value ?? 0) - (b.value ?? 0))[0];

  if (!candidate) {
    return appendLog(next, "REFLECTION", `${actor.name} 尝试返照失败：息库没有可取回气骰。`);
  }

  next.dice = moveDice(next.dice, [candidate.id], "QI_SEA");
  return appendLog(next, "REFLECTION", `${actor.name} 返照，取回最低可用气骰 ${candidate.sourceName}，不重投。`);
}

export function expireSource(state: CombatState, sourceId: string): CombatState {
  const next = cloneState(state);
  const expiredUnlocked = next.dice.filter(
    (die) => die.sourceId === sourceId && (die.zone === "QI_SEA" || die.zone === "TEMP_QI"),
  );
  next.dice = next.dice.filter((die) => !expiredUnlocked.some((expired) => expired.id === die.id));

  if (next.pendingAction) {
    const lockedFromSource = next.dice.filter(
      (die) => die.sourceId === sourceId && die.zone === "QI_LOCK" && next.pendingAction?.diceIds.includes(die.id),
    );
    if (lockedFromSource.length > 0) {
      next.dice = moveDice(next.dice, next.pendingAction.diceIds, "QI_REST");
      next.pendingAction = undefined;
      next.phase = "outcome";
      return appendLog(next, "EXPIRE_SOURCE", `来源「${sourceId}」失效，锁气宣言需重检且本次行动取消。`);
    }
  }

  return appendLog(next, "EXPIRE_SOURCE", `来源「${sourceId}」失效，移除未锁定气骰 ${expiredUnlocked.length} 枚。`);
}

export function dmOverride(state: CombatState, message: string, isPublic = true): CombatState {
  const next = cloneState(state);
  return appendLog(next, "DM_OVERRIDE", `DM裁定：${message}`, isPublic);
}

export function useInventoryItem(state: CombatState, actorId: string, itemId: string): CombatState {
  let next = cloneState(state);
  const actor = requireActor(next, actorId);
  const item = requireItem(actor, itemId);

  if (item.quantity <= 0) {
    return appendLog(next, "USE_ITEM", `${actor.name} 尝试使用「${item.name}」，但数量不足。`);
  }

  next.actors = next.actors.map((entry) => {
    if (entry.id !== actorId) {
      return entry;
    }
    return {
      ...entry,
      inventory: entry.inventory.map((stored) =>
        stored.id === itemId && stored.category !== "equipment"
          ? { ...stored, quantity: Math.max(0, stored.quantity - 1) }
          : stored,
      ),
      inventoryEvents: [
        { itemId, actorId, eventType: "use", createdAt: Date.now() },
        ...(entry.inventoryEvents ?? []),
      ],
    };
  });

  if (item.grantsTempQi) {
    next = grantTemporaryQi(next, actorId, item);
  }

  if (item.expiresSourceId) {
    next = expireSource(next, item.expiresSourceId);
    next = appendLog(next, "ITEM_SOURCE_EXPIRED", `${actor.name} 使用「${item.name}」，触发来源失效：${item.expiresSourceId}。`);
    return appendLog(next, "USE_ITEM", `${actor.name} 使用「${item.name}」。`);
  }

  return appendLog(next, "USE_ITEM", `${actor.name} 使用「${item.name}」。`);
}

export function equipItem(state: CombatState, actorId: string, itemId: string): CombatState {
  const next = cloneState(state);
  const actor = requireActor(next, actorId);
  const item = requireItem(actor, itemId);
  next.actors = next.actors.map((entry) =>
    entry.id === actorId
      ? {
          ...entry,
          inventory: entry.inventory.map((stored) =>
            stored.id === itemId ? { ...stored, equipped: true } : stored,
          ),
          inventoryEvents: [
            { itemId, actorId, eventType: "equip", createdAt: Date.now() },
            ...(entry.inventoryEvents ?? []),
          ],
        }
      : entry,
  );
  return appendLog(next, "EQUIP_ITEM", `${actor.name} 装备「${item.name}」。`);
}

export function unequipItem(state: CombatState, actorId: string, itemId: string): CombatState {
  const next = cloneState(state);
  const actor = requireActor(next, actorId);
  const item = requireItem(actor, itemId);
  next.actors = next.actors.map((entry) =>
    entry.id === actorId
      ? {
          ...entry,
          inventory: entry.inventory.map((stored) =>
            stored.id === itemId ? { ...stored, equipped: false } : stored,
          ),
          inventoryEvents: [
            { itemId, actorId, eventType: "unequip", createdAt: Date.now() },
            ...(entry.inventoryEvents ?? []),
          ],
        }
      : entry,
  );
  return appendLog(next, "UNEQUIP_ITEM", `${actor.name} 卸下「${item.name}」。`);
}

export function changeMomentum(state: CombatState, momentum: CombatState["momentum"]): CombatState {
  const next = cloneState(state);
  next.momentum = momentum;
  return appendLog(next, "MOMENTUM_CHANGED", `当前势改为「${momentum}」。`);
}

export function endRound(state: CombatState): CombatState {
  const next = cloneState(state);
  next.phase = "round_end";
  next.pendingAction = undefined;
  next.round += 1;
  return appendLog(next, "ROUND_ENDED", `第 ${next.round - 1} 轮结束，进入第 ${next.round} 轮准备。`);
}

export function visibleForPlayer(state: CombatState, viewerActorId = "pc-shen-qing"): CombatState {
  return {
    ...state,
    actors: state.actors.map((actor) => ({
      ...actor,
      dmNote: undefined,
      hiddenGoal: undefined,
      behaviorHint: undefined,
      entryCondition: undefined,
      lootOrClue: undefined,
      hiddenStatuses: undefined,
      statuses: actor.publicStatuses ?? actor.statuses,
      inventory: actor.side === "enemy" ? [] : actor.inventory.map((item) => ({ ...item, dmNote: undefined })),
      responses: actor.side === "enemy" ? actor.responses.filter((response) => response.window === "react") : actor.responses,
    })),
    tracks: state.tracks.filter((track) => !track.hidden),
    dice: state.dice.filter((die) => die.ownerId === viewerActorId),
    distances: (state.distances ?? []).filter((distance) => distance.public),
    logs: state.logs.filter((log) => log.public),
  };
}

function cloneState(state: CombatState): CombatState {
  return structuredClone(state);
}

function appendLog(state: CombatState, type: CombatEventType, message: string, isPublic = true): CombatState {
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
  return dice.map((die) => (diceIds.includes(die.id) ? { ...die, zone } : die));
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

function requireResponse(actor: Actor, responseId: string, window: ResponseMount["window"]): ResponseMount {
  const response = actor.responses.find((item) => item.id === responseId && item.window === window);
  if (!response) {
    throw new Error(`找不到响应挂载：${responseId}`);
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

function validDiceForOwner(state: CombatState, ownerId: string, diceIds: string[]): string[] {
  return diceIds.filter((id) => {
    const die = state.dice.find((item) => item.id === id);
    return die?.ownerId === ownerId && (die.zone === "QI_SEA" || die.zone === "TEMP_QI");
  });
}

function grantTemporaryQi(state: CombatState, actorId: string, item: InventoryItem): CombatState {
  if (!item.grantsTempQi) {
    return state;
  }

  const dice: QiDie[] = Array.from({ length: item.grantsTempQi.count }, (_, index) => ({
    id: `temp-${item.id}-${Date.now()}-${index}`,
    label: `d${item.grantsTempQi!.sides}`,
    sourceId: item.sourceId ?? item.id,
    sourceName: item.name,
    nature: item.grantsTempQi!.nature,
    sides: item.grantsTempQi!.sides,
    value: defaultRoll(item.grantsTempQi!.sides),
    zone: "TEMP_QI",
    ownerId: actorId,
    temporary: true,
  }));

  return appendLog({ ...state, dice: [...state.dice, ...dice] }, "TEMP_QI_GRANTED", `「${item.name}」生成临时气骰 ${dice.length} 枚。`);
}
