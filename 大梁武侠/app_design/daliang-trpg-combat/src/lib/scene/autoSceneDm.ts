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
      "这个办法暂时找不到可执行的规则入口。雨声仍压在仓檐上，局势没有改变。",
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
  let nextPrompt = "继续调查，或在证据足够后逼近仓内黑影。";

  if (request.actionType === "observe") {
    next = withTrackDelta(next, "track-clue", 1);
    next.scene.permissions = uniqueFact(next.scene.permissions, {
      id: "permission-follow-water-marks",
      name: "循水痕追查",
      description: "可沿窄轮水痕直接搜查仓门后方。",
      public: true,
    });
    changes.push("解密值 +1", "获得场景许可：循水痕追查");
    narration = `${actor.name}压低身形辨认雨水走向，发现门边水痕并非自然流淌，而是窄轮车刚刚碾过。`;
  }

  if (request.actionType === "investigate") {
    next = withTrackDelta(next, "track-clue", 2);
    next = withTrackDelta(next, "track-patrol", 1);
    next.scene.resources = uniqueFact(next.scene.resources, {
      id: "resource-wheel-rubbing",
      name: "窄轮车辙拓印",
      description: "可用于比对渡口和镖局后门使用的货车。",
      public: true,
    });
    changes.push("解密值 +2", "巡检注意 +1", "取得资源：窄轮车辙拓印");
    narration = `${actor.name}拨开湿泥细查轮辙，确认镖箱先被拖向后门，再经堤岸小车转运；搜查的响动也让桥头火把靠近了一分。`;
  }

  if (request.actionType === "negotiate") {
    next = withTrackDelta(next, "track-clue", 1);
    next = withTrackDelta(next, "track-patrol", -1);
    next.scene.permissions = uniqueFact(next.scene.permissions, {
      id: "permission-wei-cover",
      name: "魏长兴声东击西",
      description: "下一次接近仓门不会增加巡检注意。",
      public: true,
    });
    changes.push("解密值 +1", "巡检注意 -1", "获得场景许可：魏长兴声东击西");
    narration = `${actor.name}借镖局信物稳住同伴与岸边脚夫，魏长兴顺势把巡检的目光引向桥头，仓门前短暂空了出来。`;
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
      name: "抵近仓门",
      description: "可以直接截住搬箱黑影，或进一步搜查仓内。",
      public: true,
    });
    changes.push("获得场景许可：抵近仓门");
    narration = `${actor.name}借雨幕贴近仓门，已经能看清搬箱者腰间的短兵和后门外接应的小船。`;
  }

  if (request.actionType === "take") {
    next = withTrackDelta(next, "track-clue", 1);
    next.scene.resources = uniqueFact(next.scene.resources, {
      id: "resource-blood-seal",
      name: "染血封条",
      description: "镖箱封条残片；血迹和切口可以证明箱子曾在仓外被开启。",
      public: true,
    });
    changes.push("解密值 +1", "取得资源：染血封条");
    narration = `${actor.name}用刀鞘挑起封条残片，朱砂印记尚未被雨水冲净，切口却明显来自仓外。`;
  }

  if (request.actionType === "use-item") {
    next = withTrackDelta(next, "track-patrol", -1);
    next.scene.permissions = uniqueFact(next.scene.permissions, {
      id: "permission-controlled-light",
      name: "暗光照明",
      description: "可检查仓内近处物件，不暴露在桥头火把视线中。",
      public: true,
    });
    changes.push("巡检注意 -1", "获得场景许可：暗光照明");
    narration = `${actor.name}用遮住大半的火折贴地照明，既看清了麻绳纤维，也没有让亮光越过仓门。`;
  }

  const clue = next.tracks.find((track) => track.id === "track-clue")?.value ?? 0;
  const hasEntry = next.scene.permissions.some((fact) => fact.id === "permission-enter-warehouse");
  if (clue >= 3 || hasEntry) {
    next.scene.combatUnlocked = true;
    nextPrompt = "证据与位置已经足够。你可以继续追查，也可以截住搬箱者并进入交锋。";
    if (!changes.includes("解锁：进入交锋")) changes.push("解锁：进入交锋");
  }

  const resolution = createResolution(request, "approved", narration, definition.ruleEntry, changes, nextPrompt, now);
  next.scene = {
    ...next.scene,
    narration,
    turn: next.scene.turn + 1,
    pendingRequest: undefined,
    lastResolution: resolution,
  };
  return appendSceneLog(
    next,
    `${definition.name}｜${narration}｜${changes.join("；")}`,
    now,
    request.audience !== "dm",
  );
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
  const ending = "失镖已经夺回，染血封条与车辙指向同一个内应。雨势渐缓，桥头巡检尚未封仓。";
  return appendSceneLog({
    ...state,
    scene: { ...state.scene, completed: true, ending, narration: ending },
  }, `场景收束｜${ending}`, Date.now());
}
