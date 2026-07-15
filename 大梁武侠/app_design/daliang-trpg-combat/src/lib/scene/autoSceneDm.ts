import type {
  CombatLogEntry,
  CombatState,
  SceneActionRequest,
  SceneActionResolution,
  SceneActionType,
  SceneFact,
} from "../../combat/types";

export interface SceneActionDefinition {
  id: SceneActionType;
  name: string;
  shortDescription: string;
  ruleEntry: string;
  risk: string;
}

export interface NarrationInput {
  actionName: string;
  targetName: string;
  approach: string;
  baseNarration: string;
  changes: string[];
}

export interface NarrationProvider {
  narrate(input: NarrationInput): Promise<string | undefined>;
}

export interface ResolveSceneOptions {
  now?: () => number;
  narrationProvider?: NarrationProvider;
}

export type DmSceneRuling = "approved" | "modified" | "rejected";

export const SCENE_ACTIONS: SceneActionDefinition[] = [
  { id: "observe", name: "观察", shortDescription: "先看清局势，不制造额外声响。", ruleEntry: "情景行动·观照", risk: "低" },
  { id: "negotiate", name: "交涉", shortDescription: "以身份、利益或证据改变人物立场。", ruleEntry: "情景行动·交涉", risk: "中" },
  { id: "investigate", name: "搜查", shortDescription: "深入检查痕迹并推进解密。", ruleEntry: "情景行动·查探", risk: "中" },
  { id: "move", name: "移步", shortDescription: "改变所处位置，取得新的行动入口。", ruleEntry: "出手便行·移步", risk: "中" },
  { id: "take", name: "取物", shortDescription: "取得可及且未被争夺的场景物件。", ruleEntry: "出手便行·取物", risk: "低" },
  { id: "use-item", name: "使用物品", shortDescription: "调用行囊中的器具、药物或信物。", ruleEntry: "条目指定动作", risk: "依物品" },
];

function uniqueFact(facts: SceneFact[], fact: SceneFact): SceneFact[] {
  return facts.some((entry) => entry.id === fact.id) ? facts : [...facts, fact];
}

function appendSceneLog(state: CombatState, message: string, createdAt: number, isPublic = true): CombatState {
  const log: CombatLogEntry = {
    id: `SCENE_ACTION-${createdAt}-${state.scene.turn}`,
    type: "SCENE_ACTION",
    round: state.round,
    message,
    public: isPublic,
    createdAt,
  };
  return { ...state, logs: [log, ...state.logs] };
}

function withTrackDelta(state: CombatState, id: string, delta: number): CombatState {
  return {
    ...state,
    tracks: state.tracks.map((track) => track.id === id
      ? { ...track, value: Math.max(0, Math.min(track.max, track.value + delta)) }
      : track),
  };
}

function commitApprovedSceneAction(
  state: CombatState,
  request: SceneActionRequest,
  definition: SceneActionDefinition,
  narration: string,
  changes: string[],
  nextPrompt: string,
  now: number,
): CombatState {
  const resolution = createResolution(request, "approved", narration, definition.ruleEntry, changes, nextPrompt, now);
  const next = {
    ...state,
    scene: {
      ...state.scene,
      narration,
      turn: state.scene.turn + 1,
      pendingRequest: undefined,
      lastResolution: resolution,
    },
  };
  return appendSceneLog(next, `${definition.name}｜${narration}｜${changes.join("；")}`, now, request.audience !== "dm");
}

function createResolution(
  request: SceneActionRequest,
  ruling: SceneActionResolution["ruling"],
  narration: string,
  ruleBasis: string,
  changes: string[],
  nextPrompt: string,
  resolvedAt: number,
): SceneActionResolution {
  return { requestId: request.id, ruling, narration, ruleBasis, changes, nextPrompt, resolvedAt };
}

/** Queue a legal room-player request without letting the player resolve authority state. */
export function queueSceneActionRequest(state: CombatState, request: SceneActionRequest): CombatState {
  if (state.scene.pendingRequest) return state;
  const actor = state.actors.find((entry) => entry.id === request.actorId);
  const target = state.scene.elements.find((entry) => entry.id === request.targetId);
  const definition = SCENE_ACTIONS.find((entry) => entry.id === request.actionType);
  if (!actor || !target?.public || !definition || !target.interactionIds.includes(request.actionType)) {
    return resolveSceneAction(state, request, { now: () => request.createdAt });
  }
  const approach = request.approach?.trim();
  const log: CombatLogEntry = {
    id: `SCENE_REQUEST-${request.id}`,
    type: "SCENE_REQUEST",
    round: state.round,
    message: `${actor.name}请求${definition.name}｜目标：${target.name}${approach ? `｜办法：${approach}` : ""}`,
    public: request.audience !== "dm",
    createdAt: request.createdAt,
  };
  return {
    ...state,
    scene: { ...state.scene, pendingRequest: request },
    logs: [log, ...state.logs],
  };
}

/** Resolve the queued request from the真人 DM desk, with every ruling written to the log. */
export function resolveQueuedSceneRequest(
  state: CombatState,
  ruling: DmSceneRuling,
  note = "",
  options: ResolveSceneOptions = {},
): CombatState {
  const request = state.scene.pendingRequest;
  if (!request) return state;
  const now = options.now?.() ?? Date.now();
  const actor = state.actors.find((entry) => entry.id === request.actorId);
  const target = state.scene.elements.find((entry) => entry.id === request.targetId);
  const definition = SCENE_ACTIONS.find((entry) => entry.id === request.actionType);
  const trimmedNote = note.trim();

  if (ruling === "rejected") {
    const narration = trimmedNote || "主持判定这个办法暂时不能成立；场景状态没有变化。";
    const resolution = createResolution(
      request,
      "rejected",
      narration,
      definition?.ruleEntry ?? "真人 DM 裁定",
      [],
      "请根据主持说明调整目标或办法后重新提交。",
      now,
    );
    const log: CombatLogEntry = {
      id: `DM_RULING-${now}-${request.id}`,
      type: "DM_RULING",
      round: state.round,
      message: `驳回｜${actor?.name ?? request.actorId}｜${target?.name ?? request.targetId ?? "无目标"}｜${narration}`,
      public: request.audience !== "dm",
      createdAt: now,
    };
    return {
      ...state,
      scene: { ...state.scene, pendingRequest: undefined, lastResolution: resolution },
      logs: [log, ...state.logs],
    };
  }

  const adjustedRequest = ruling === "modified" && trimmedNote
    ? { ...request, approach: trimmedNote }
    : request;
  const resolved = resolveSceneAction(state, adjustedRequest, { ...options, now: () => now });
  const resolution = resolved.scene.lastResolution;
  const finalResolution = resolution && ruling === "modified"
    ? { ...resolution, requestId: request.id, ruling: "modified" as const }
    : resolution;
  const log: CombatLogEntry = {
    id: `DM_RULING-${now}-${request.id}`,
    type: "DM_RULING",
    round: state.round,
    message: `${ruling === "modified" ? "修改后批准" : "批准"}｜${actor?.name ?? request.actorId}｜${target?.name ?? request.targetId ?? "无目标"}${trimmedNote ? `｜主持备注：${trimmedNote}` : ""}`,
    public: request.audience !== "dm",
    createdAt: now,
  };
  return {
    ...resolved,
    scene: { ...resolved.scene, pendingRequest: undefined, lastResolution: finalResolution },
    logs: [log, ...resolved.logs],
  };
}

export function previewSceneAction(state: CombatState, actionType: SceneActionType, targetId?: string): string[] {
  const definition = SCENE_ACTIONS.find((action) => action.id === actionType);
  const target = state.scene.elements.find((element) => element.id === targetId);
  const notes = [`规则入口：${definition?.ruleEntry ?? "情景行动"}`, `风险：${definition?.risk ?? "待裁定"}`];
  if (!targetId) notes.push("需要选择目标");
  else if (!target) notes.push("目标不存在或当前不可见");
  else if (!target.interactionIds.includes(actionType)) notes.push(`${target.name}不支持此行动入口`);
  else notes.push(`目标：${target.name}`);
  return notes;
}

export function resolveSceneAction(
  state: CombatState,
  request: SceneActionRequest,
  options: ResolveSceneOptions = {},
): CombatState {
  const now = options.now?.() ?? Date.now();
  const definition = SCENE_ACTIONS.find((action) => action.id === request.actionType);
  const actor = state.actors.find((entry) => entry.id === request.actorId);
  const target = state.scene.elements.find((element) => element.id === request.targetId);

  if (!definition || !actor || !target || !target.public || !target.interactionIds.includes(request.actionType)) {
    const resolution = createResolution(
      request,
      "rejected",
      "这个办法暂时找不到可执行的规则入口。河风仍从西栈穿过，局势没有改变。",
      "情景行动必须有合法行动者、公开目标与互动入口。",
      [],
      "请改选高亮的行动或目标。",
      now,
    );
    return appendSceneLog(
      { ...state, scene: { ...state.scene, pendingRequest: undefined, lastResolution: resolution } },
      resolution.narration,
      now,
      request.audience !== "dm",
    );
  }

  let next = structuredClone(state);
  const changes: string[] = [];
  let narration = "";
  let nextPrompt = "继续查验西栈，拼合药匣去向。";

  if (state.scene.id === "pier-pursuit") {
    const progressDelta = request.actionType === "investigate" ? 1 : ["move", "negotiate", "observe", "use-item"].includes(request.actionType) ? 1 : 0;
    const riskDelta = request.actionType === "investigate" ? 1 : 0;
    next = withTrackDelta(next, "pursuit-progress", progressDelta);
    next = withTrackDelta(next, "pursuit-risk", riskDelta);
    if (progressDelta) changes.push("追及 +1");
    if (riskDelta) changes.push("药匣受险 +1");
    narration = request.actionType === "negotiate"
      ? `${actor.name}越过人群喊明利害，胡五脚步一滞，追兵趁机缩短了距离。`
      : request.actionType === "observe"
        ? `${actor.name}看准湿板、鱼篓与人流之间的空隙，提前截向胡五的必经之路。`
        : request.actionType === "use-item"
          ? `${actor.name}借手边器物封住一段栈桥，迫使胡五改道。`
          : request.actionType === "investigate"
            ? `${actor.name}停步辨认胡五留下的湿痕，找准了去路，但这片刻拖延让药匣更靠近桥沿。`
            : `${actor.name}沿栈桥追身，绕过倾倒鱼篓，把胡五逼向旧船棚门前。`;
    const progress = next.tracks.find((track) => track.id === "pursuit-progress")?.value ?? 0;
    const expires = next.scene.turn >= 3;
    if (progress >= 3 || expires) {
      next.scene.combatUnlocked = true;
      changes.push(progress >= 3 ? "追及完成：截住胡五" : "三轮到期：抵达旧船棚");
      nextPrompt = "追逐已经收束，转入旧船棚对峙；气骰保持原点数。";
    } else {
      nextPrompt = `还需 ${3 - progress} 点追及；避免把胡五逼向桥沿。`;
    }
    return commitApprovedSceneAction(next, request, definition, narration, changes, nextPrompt, now);
  }

  if (state.scene.id === "old-boathouse-standoff") {
    const trustDelta = ["negotiate", "investigate", "observe", "use-item"].includes(request.actionType) ? 1 : 0;
    next = withTrackDelta(next, "standoff-trust", trustDelta);
    if (trustDelta) changes.push("交匣意愿 +1");
    narration = request.actionType === "negotiate"
      ? `${actor.name}没有亮兵刃，而是把药钱、巡检和伤者的后果一一说清。胡五抱匣的手略微松开。`
      : request.actionType === "investigate"
        ? `${actor.name}核对欠药账页与药匣封绳，确认胡五偷匣是为家中急病，并非受雇劫货。`
        : request.actionType === "use-item"
          ? `${actor.name}取出药物先处理胡五的伤口，用实际行动换来片刻信任。`
          : request.actionType === "observe"
            ? `${actor.name}看出袁葫芦只守水门、不主动逼近；他们想脱身，不想杀人。`
            : `${actor.name}逼近药匣，袁葫芦横刀封路，谈判转为非致命交锋。`;
    const trust = next.tracks.find((track) => track.id === "standoff-trust")?.value ?? 0;
    if (trust >= 3) {
      next.scene.completed = true;
      next.scene.ending = "胡五接受作保，主动交还药匣；无需进入战斗。";
      changes.push("非战斗收束：私下作保");
      nextPrompt = "药匣已经交还，记录人物关系与后续债务。";
    } else if (["move", "take"].includes(request.actionType)) {
      next.scene.combatUnlocked = true;
      changes.push("DM确认：进入非致命交锋");
      nextPrompt = "对峙升级；沿用当前气骰与状态进入战斗。";
    } else {
      nextPrompt = `还需 ${3 - trust} 点交匣意愿；也可由DM确认转入交锋。`;
    }
    return commitApprovedSceneAction(next, request, definition, narration, changes, nextPrompt, now);
  }

  if (request.actionType === "observe") {
    next = withTrackDelta(next, "track-clue", 1);
    next.scene.permissions = uniqueFact(next.scene.permissions, {
      id: "permission-follow-water-marks",
      name: "循湿痕查验",
      description: "可沿水棚木板的拖痕直接比对空车位。",
      public: true,
    });
    changes.push("解密值 +1", "获得场景许可：循湿痕查验");
    narration = `${actor.name}压低身形辨认水棚木板上的湿痕，发现药匣被拖向空车位，再由窄轮车运走。`;
  }

  if (request.actionType === "investigate") {
    next = withTrackDelta(next, "track-clue", 2);
    next = withTrackDelta(next, "track-patrol", 1);
    next.scene.resources = uniqueFact(next.scene.resources, {
      id: "resource-wheel-rubbing",
      name: "窄轮车辙拓印",
      description: "可用于比对渡口空车位和旧船棚使用的货车。",
      public: true,
    });
    changes.push("解密值 +2", "巡检注意 +1", "取得资源：窄轮车辙拓印");
    narration = `${actor.name}拨开湿泥细查轮辙，确认药匣先被拖出水棚，再经栈桥窄车转运；查验的响动也让巡检火把靠近了一分。`;
  }

  if (request.actionType === "negotiate") {
    next = withTrackDelta(next, "track-clue", 1);
    next = withTrackDelta(next, "track-patrol", -1);
    next.scene.permissions = uniqueFact(next.scene.permissions, {
      id: "permission-wei-cover",
      name: "魏长兴稳住巡检",
      description: "下一次接近栈桥入口不会增加巡检封渡。",
      public: true,
    });
    changes.push("解密值 +1", "巡检注意 -1", "获得场景许可：魏长兴声东击西");
    narration = `${actor.name}借回春堂文书稳住岸边脚夫，魏长兴顺势向巡检解释交接差错，栈桥入口暂时空了出来。`;
  }

  if (request.actionType === "move") {
    const hasCover = next.scene.permissions.some((fact) => fact.id === "permission-wei-cover" && !fact.consumed);
    if (hasCover) {
      next.scene.permissions = next.scene.permissions.map((fact) => fact.id === "permission-wei-cover" ? { ...fact, consumed: true } : fact);
      changes.push("消耗许可：魏长兴声东击西");
    } else {
      next = withTrackDelta(next, "track-patrol", 1);
      changes.push("巡检注意 +1");
    }
    next.scene.permissions = uniqueFact(next.scene.permissions, {
      id: "permission-enter-warehouse",
      name: "抵近栈桥",
      description: "可以看清抱匣人影，并由DM确认建立追逐序列。",
      public: true,
    });
    changes.push("获得场景许可：抵近栈桥");
    narration = `${actor.name}借水棚阴影贴近栈桥，已经能看清抱匣人影和通往旧船棚的退路。`;
  }

  if (request.actionType === "take") {
    next = withTrackDelta(next, "track-clue", 1);
    next.scene.resources = uniqueFact(next.scene.resources, {
      id: "resource-blood-seal",
      name: "染血封条",
      description: "药匣封绳残片；血迹和切口可以证明药匣曾在西栈被调换。",
      public: true,
    });
    changes.push("解密值 +1", "取得资源：染血封条");
    narration = `${actor.name}用刀鞘挑起封条残片，朱砂印记尚未被雨水冲净，切口却明显来自仓外。`;
  }

  if (request.actionType === "use-item") {
    next = withTrackDelta(next, "track-patrol", -1);
    next.scene.permissions = uniqueFact(next.scene.permissions, {
      id: "permission-controlled-light",
      name: "遮光查验",
      description: "可检查水棚近处物件，不引来巡检火把。",
      public: true,
    });
    changes.push("巡检注意 -1", "获得场景许可：暗光照明");
    narration = `${actor.name}用遮住大半的火折贴地照明，既看清了封绳纤维，也没有让亮光越过水棚。`;
  }

  const clue = next.tracks.find((track) => track.id === "track-clue")?.value ?? 0;
  if (clue >= 2) {
    next.scene.elements = next.scene.elements.map((element) => ["porter-shadow", "old-boathouse-route"].includes(element.id)
      ? { ...element, public: true }
      : element);
  }
  if (clue >= 4) {
    next.scene.permissions = uniqueFact(next.scene.permissions, {
      id: "permission-old-boathouse",
      name: "旧船棚去向",
      description: "证据已经闭合，可由DM确认转入栈桥追逐。",
      public: true,
    });
    next.scene.combatUnlocked = true;
    nextPrompt = "证据已经闭合；转入栈桥追逐，不直接跳到战斗。";
    if (!changes.includes("解锁：栈桥追逐")) changes.push("解锁：栈桥追逐");
  }
  return commitApprovedSceneAction(next, request, definition, narration, changes, nextPrompt, now);
}

function validNarration(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 8 && value.trim().length <= 480;
}

export function createHttpNarrationProvider(endpoint: string): NarrationProvider | undefined {
  if (!/^https?:\/\//i.test(endpoint.trim())) return undefined;
  return {
    async narrate(input) {
      const controller = new AbortController();
      const timer = globalThis.setTimeout(() => controller.abort(), 2500);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ task: "daliang-scene-narration", input }),
          signal: controller.signal,
        });
        if (!response.ok) return undefined;
        const data = await response.json() as { narration?: unknown };
        return validNarration(data.narration) ? data.narration.trim() : undefined;
      } catch {
        return undefined;
      } finally {
        globalThis.clearTimeout(timer);
      }
    },
  };
}

export async function resolveSceneActionWithNarration(
  state: CombatState,
  request: SceneActionRequest,
  options: ResolveSceneOptions = {},
): Promise<CombatState> {
  const resolved = resolveSceneAction(state, request, options);
  const resolution = resolved.scene.lastResolution;
  const target = state.scene.elements.find((entry) => entry.id === request.targetId);
  const definition = SCENE_ACTIONS.find((entry) => entry.id === request.actionType);
  if (!options.narrationProvider || !resolution || resolution.ruling === "rejected" || !target || !definition) return resolved;

  const narration = await options.narrationProvider.narrate({
    actionName: definition.name,
    targetName: target.name,
    approach: request.approach?.trim() || "依照选定用法直接行动",
    baseNarration: resolution.narration,
    changes: resolution.changes,
  });
  if (!validNarration(narration)) return resolved;
  return {
    ...resolved,
    scene: {
      ...resolved.scene,
      narration,
      lastResolution: { ...resolution, narration },
    },
  };
}

export function closeSceneAfterCombat(state: CombatState): CombatState {
  const livingEnemies = state.actors.some((actor) => actor.side === "enemy" && actor.hp > 0);
  if (livingEnemies || state.scene.completed) return state;
  const ending = "药匣已经夺回，破封绳、湿脚印与货单指向同一条偷运路线。河风渐缓，西栈巡检尚未封渡。";
  return appendSceneLog({
    ...state,
    scene: { ...state.scene, completed: true, ending, narration: ending },
  }, `场景收束｜${ending}`, Date.now());
}
