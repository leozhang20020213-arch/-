import type {
  ActiveSceneElement,
  Actor,
  CampaignFlagValue,
  CombatState,
  DistanceBand,
  SceneActionRequest,
  SceneActionResolution,
  SceneActionType,
  SceneFact,
  SceneRuntimeState,
  SceneTrack,
} from "../../combat/types";
import { beginNewScene, createRuntimeSession, setSceneMode } from "../../domain/session/runtime";
import type { CampaignEvent, CampaignPack, CampaignScene, SceneElementKind, TriggerCondition } from "./campaignSchema";

const ACTION_IDS = new Set<SceneActionType>([
  "observe",
  "negotiate",
  "investigate",
  "move",
  "take",
  "use-item",
]);

function runtimeKind(kind: SceneElementKind): ActiveSceneElement["kind"] {
  if (kind === "npc" || kind === "enemy" || kind === "companion") return "person";
  if (kind === "area" || kind === "door" || kind === "obstacle" || kind === "hazard" || kind === "dynamic") return "environment";
  return "object";
}

function runtimeAction(value: string): SceneActionType | undefined {
  const normalized = value === "use_item" ? "use-item" : value;
  return ACTION_IDS.has(normalized as SceneActionType) ? normalized as SceneActionType : undefined;
}

export function projectCampaignElements(scene: CampaignScene): ActiveSceneElement[] {
  return scene.elements.map((element) => ({
    id: element.id,
    name: element.name,
    kind: runtimeKind(element.kind),
    description: element.description,
    public: element.public,
    interactionIds: [...new Set(element.interactionUsageIds.map(runtimeAction).filter((value): value is SceneActionType => Boolean(value)))],
  }));
}

export function projectCampaignTracks(scene: CampaignScene): SceneTrack[] {
  return scene.tracks.map((track) => ({
    id: track.id,
    name: track.name,
    kind: track.kind === "crisis" ? "crisis" : "insight",
    value: 0,
    max: track.max,
    hidden: !track.public,
    description: track.description,
    growthConditions: track.growthConditions ? [...track.growthConditions] : undefined,
    reductionConditions: track.reductionConditions ? [...track.reductionConditions] : undefined,
    triggerOutcome: track.thresholdOutcome,
    insightLayers: track.insightLayers ? structuredClone(track.insightLayers) : undefined,
  }));
}

const ACTION_LABELS: Record<SceneActionType, string> = {
  observe: "观察",
  negotiate: "交涉",
  investigate: "搜查",
  move: "移步",
  take: "取物",
  "use-item": "使用物品",
};

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueFact(facts: SceneFact[], fact: SceneFact): SceneFact[] {
  return facts.some((entry) => entry.id === fact.id) ? facts : [...facts, fact];
}

export function applyCampaignActorProfiles(actors: Actor[], pack: CampaignPack): Actor[] {
  const profiles = new Map((pack.actorProfiles ?? []).map((profile) => [profile.actorId, profile]));
  return actors.map((actor) => {
    const profile = profiles.get(actor.id);
    if (!profile) return actor;
    return {
      ...actor,
      hiddenGoal: profile.hiddenGoal ?? actor.hiddenGoal,
      behaviorHint: profile.behaviorHint ?? actor.behaviorHint,
      aiProfile: profile.aiProfile ? structuredClone(profile.aiProfile) : actor.aiProfile,
    };
  });
}

function makeProgress(pack: CampaignPack, sceneId: string, now: number, activeActorIds: string[] = []): CombatState["campaign"] {
  return {
    packId: pack.id,
    packVersion: pack.version,
    currentSceneId: sceneId,
    completedSceneIds: [],
    completedEventIds: [],
    earnedRewardIds: [],
    partyActorIds: activeActorIds.slice(0, 1),
    activeActorIds,
    flags: {},
    startedAt: now,
    updatedAt: now,
  };
}

/** Project authored campaign data into the legacy-compatible runtime shell. */
export function projectCampaignScene(
  pack: CampaignPack,
  sceneId: string,
  act = 1,
): { scene: SceneRuntimeState; tracks: SceneTrack[]; campaignScene: CampaignScene } {
  const campaignScene = pack.scenes.find((entry) => entry.id === sceneId);
  if (!campaignScene) throw new Error(`团包 ${pack.name} 不包含场景 ${sceneId}。`);
  return {
    campaignScene,
    tracks: projectCampaignTracks(campaignScene),
    scene: {
      id: campaignScene.id,
      act,
      location: campaignScene.name,
      timeWindow: campaignScene.timeWindow ?? "由DM根据场景推进",
      boundary: campaignScene.boundary,
      narration: campaignScene.description,
      turn: 1,
      permissions: [],
      resources: [],
      elements: projectCampaignElements(campaignScene),
      combatUnlocked: campaignScene.mode === "COMBAT",
      completed: false,
    },
  };
}

/** Build a clean outing from a reviewed campaign pack and an actor/rule seed. */
export function initializeCampaignState(
  base: CombatState,
  pack: CampaignPack,
  options: { playerActorId?: string; now?: number } = {},
): CombatState {
  const now = options.now ?? Date.now();
  const projected = projectCampaignScene(pack, pack.startSceneId, 1);
  const playerActorId = options.playerActorId
    && base.actors.some((actor) => actor.id === options.playerActorId && actor.side === "player")
    ? options.playerActorId
    : base.actors.find((actor) => actor.side === "player")?.id ?? base.activeActorId;
  const mode = projected.campaignScene.mode === "SCENE_STRUCTURED" ? "SCENE_STRUCTURED" : "SCENE_FREE";
  const openingActorIds = uniqueStrings([
    playerActorId,
    ...(projected.campaignScene.sequenceActorIds ?? []).map((id) => id === "pc-shen-qing" ? playerActorId : id),
  ]).filter((id) => base.actors.some((actor) => actor.id === id));
  const progress = makeProgress(pack, projected.scene.id, now, openingActorIds);
  progress.partyActorIds = [playerActorId];
  progress.flags.playerActorId = playerActorId;
  return {
    ...structuredClone(base),
    actors: applyCampaignActorProfiles(structuredClone(base.actors), pack),
    runtime: createRuntimeSession(projected.scene.id, mode),
    campaign: progress,
    campaignName: pack.name,
    sceneName: projected.campaignScene.name,
    sceneGoal: projected.campaignScene.objective,
    round: 1,
    phase: mode === "SCENE_STRUCTURED" ? "declare" : "setup",
    activeActorId: playerActorId,
    initiativeOrder: [],
    actedActorIds: [],
    encounterMode: "scene",
    turnPaused: false,
    scene: projected.scene,
    tracks: projected.tracks,
    pendingAction: undefined,
    dice: base.dice
      .filter((die) => !die.temporary)
      .map((die) => ({ ...die, zone: "QI_POOL", value: null })),
    feedback: [],
    logs: [{
      id: `CAMPAIGN_STARTED-${pack.id}-${now}`,
      type: "CAMPAIGN_STARTED",
      round: 1,
      message: `团包开始｜${pack.name}｜${projected.campaignScene.name}`,
      public: true,
      createdAt: now,
    }],
  };
}

/**
 * Bind the occupied room seats to the campaign without mutating the authored
 * pack. Only living player-side registry actors may become party members.
 */
export function configureCampaignParty(
  state: CombatState,
  actorIds: string[],
  now = Date.now(),
): CombatState {
  const valid = uniqueStrings(actorIds).filter((id) => {
    const actor = state.actors.find((entry) => entry.id === id);
    return actor?.side === "player" && actor.hp > 0;
  });
  if (valid.length === 0) return state;
  const previousParty = new Set(state.campaign.partyActorIds);
  const activeNonPlayers = state.campaign.activeActorIds.filter((id) => !previousParty.has(id));
  return {
    ...state,
    activeActorId: valid.includes(state.activeActorId) ? state.activeActorId : valid[0],
    campaign: {
      ...state.campaign,
      partyActorIds: valid,
      activeActorIds: uniqueStrings([...valid, ...activeNonPlayers]),
      flags: { ...state.campaign.flags, playerActorId: valid[0], partySize: valid.length },
      updatedAt: now,
    },
  };
}

function compareValue(actual: CampaignFlagValue | undefined, condition: TriggerCondition): boolean {
  if (condition.operator === "present") return actual !== undefined && actual !== false;
  if (condition.operator === "equals") return actual === condition.value;
  if (condition.operator === "contains") return String(actual ?? "").includes(String(condition.value ?? ""));
  if (condition.operator === "at_least") return Number(actual ?? 0) >= Number(condition.value ?? 0);
  if (condition.operator === "at_most") return Number(actual ?? 0) <= Number(condition.value ?? 0);
  if (condition.operator === "changed") return actual !== undefined;
  return false;
}

function conditionMatches(
  state: CombatState,
  condition: TriggerCondition,
  request?: SceneActionRequest,
): boolean {
  if (condition.kind === "dm") return false;
  if (condition.kind === "interaction") {
    if (!request || condition.sourceId !== request.targetId) return false;
    return condition.operator === "present"
      || condition.operator === "changed"
      || condition.value === request.actionType
      || condition.value === request.sourceId;
  }
  if (condition.kind === "track_threshold") {
    const track = state.tracks.find((entry) => entry.id === condition.sourceId);
    return compareValue(track?.value, condition);
  }
  if (condition.kind === "round") return compareValue(state.scene.turn, condition);
  if (condition.kind === "distance") {
    const relation = state.distances.find((entry) => entry.id === condition.sourceId);
    return compareValue(relation?.band, condition);
  }
  if (condition.kind === "state") {
    const fact = [...state.scene.permissions, ...state.scene.resources].find((entry) => entry.id === condition.sourceId && !entry.consumed);
    const actual = fact ? true : state.campaign.flags[condition.sourceId ?? ""];
    return compareValue(actual, condition);
  }
  return false;
}

function eventMatches(state: CombatState, event: CampaignEvent, request?: SceneActionRequest): boolean {
  if (event.once && state.campaign.completedEventIds.includes(event.id)) return false;
  return event.conditions.length > 0 && event.conditions.every((condition) => conditionMatches(state, condition, request));
}

function applyEvent(
  state: CombatState,
  pack: CampaignPack,
  event: CampaignEvent,
  changes: string[],
  now: number,
): CombatState {
  let next = structuredClone(state);
  const scene = pack.scenes.find((entry) => entry.id === state.scene.id);
  for (const effect of event.effects) {
    if (effect.kind === "track") {
      next.tracks = next.tracks.map((track) => {
        if (track.id !== effect.targetId) return track;
        const value = Math.max(0, Math.min(track.max, track.value + Number(effect.value ?? 0)));
        changes.push(`${track.name} ${value >= track.value ? "+" : ""}${value - track.value}`);
        return { ...track, value };
      });
    }
    if (effect.kind === "reveal") {
      const target = next.scene.elements.find((element) => element.id === effect.targetId);
      next.scene.elements = next.scene.elements.map((element) => element.id === effect.targetId ? { ...element, public: effect.value !== false } : element);
      if (target) changes.push(`公开：${target.name}`);
    }
    if (effect.kind === "permission" || effect.kind === "resource" || effect.kind === "relationship") {
      const fact: SceneFact = {
        id: effect.targetId,
        name: typeof effect.value === "string" ? effect.value : event.name,
        description: event.publicText,
        public: true,
      };
      if (effect.kind === "permission") next.scene.permissions = uniqueFact(next.scene.permissions, fact);
      else next.scene.resources = uniqueFact(next.scene.resources, fact);
      next.campaign.flags[effect.targetId] = typeof effect.value === "string" ? effect.value : true;
      changes.push(`${effect.kind === "permission" ? "许可" : effect.kind === "relationship" ? "关系" : "资源"}：${fact.name}`);
    }
    if (effect.kind === "flag") {
      next.campaign.flags[effect.targetId] = effect.value ?? true;
      changes.push(`记录：${event.name}`);
    }
    if (effect.kind === "reward") {
      const reward = pack.rewards.find((entry) => entry.id === effect.targetId);
      next.campaign.earnedRewardIds = uniqueStrings([...next.campaign.earnedRewardIds, effect.targetId]);
      next.campaign.flags[effect.targetId] = true;
      if (reward) changes.push(`取得：${reward.name}`);
      if (reward?.kind === "ending") {
        const authoredEnding = pack.endings?.find((ending) => ending.conditions.every((condition) => conditionMatches(next, condition)));
        next.campaign.endingId = authoredEnding?.id ?? reward.id;
        next.campaign.completedSceneIds = uniqueStrings([...next.campaign.completedSceneIds, next.scene.id]);
        next.scene.completed = true;
        next.scene.ending = authoredEnding?.publicText ? `${reward.publicText} ${authoredEnding.publicText}` : reward.publicText;
      }
    }
    if (effect.kind === "start_combat") {
      next.scene.combatUnlocked = true;
      next.campaign.pendingCombatSceneId = effect.targetId;
      next.campaign.flags[`combat:${effect.targetId}`] = "pending";
      changes.push("交锋条件成立");
    }
    if (effect.kind === "end_scene" && !next.campaign.pendingCombatSceneId) {
      next.scene.completed = true;
      next.campaign.pendingSceneId = effect.targetId;
      next.campaign.completedSceneIds = uniqueStrings([...next.campaign.completedSceneIds, next.scene.id]);
      changes.push(`场景收束：${scene?.name ?? next.scene.location}`);
    }
  }
  if (event.once) next.campaign.completedEventIds = uniqueStrings([...next.campaign.completedEventIds, event.id]);
  next.campaign.updatedAt = now;
  return next;
}

/**
 * Resolve a scene action exclusively from authored elements/events. This is
 * the normal-play path; legacy tutorial prose remains isolated in autoSceneDm.
 */
export function resolveCampaignSceneAction(
  state: CombatState,
  pack: CampaignPack,
  request: SceneActionRequest,
  now = Date.now(),
): CombatState {
  const campaignScene = pack.scenes.find((entry) => entry.id === state.scene.id);
  const actor = state.actors.find((entry) => entry.id === request.actorId);
  const target = state.scene.elements.find((entry) => entry.id === request.targetId);
  if (!campaignScene || state.campaign.packId !== pack.id || !actor || !target?.public || !target.interactionIds.includes(request.actionType)) {
    const resolution: SceneActionResolution = {
      requestId: request.id,
      ruling: "rejected",
      narration: "当前团包没有为这个目标开放相应规则入口，场景状态保持不变。",
      ruleBasis: "团包元素、行动类型与公开权限必须同时匹配。",
      changes: [],
      nextPrompt: "请改选高亮的行动牌或场景目标。",
      resolvedAt: now,
    };
    return {
      ...state,
      scene: { ...state.scene, pendingRequest: undefined, lastResolution: resolution },
      logs: [{ id: `CAMPAIGN_ACTION_REJECTED-${request.id}`, type: "SCENE_ACTION", round: state.round, message: resolution.narration, public: request.audience !== "dm", createdAt: now }, ...state.logs],
    };
  }

  let next = structuredClone(state);
  const changes: string[] = [];
  const narrations: string[] = [];
  const interactionEvents = campaignScene.events.filter((event) => event.conditions.some((condition) => condition.kind === "interaction"));
  for (const event of interactionEvents) {
    if (!eventMatches(next, event, request)) continue;
    next = applyEvent(next, pack, event, changes, now);
    narrations.push(event.publicText);
  }

  // Threshold/state events can chain after the action changed tracks or facts.
  // A combat transition takes priority over peaceful threshold transitions.
  let progressed = true;
  let guard = 0;
  while (progressed && guard < campaignScene.events.length + 1 && !next.campaign.pendingCombatSceneId) {
    progressed = false;
    guard += 1;
    for (const event of campaignScene.events.filter((entry) => !entry.conditions.some((condition) => condition.kind === "interaction" || condition.kind === "dm"))) {
      if (!eventMatches(next, event)) continue;
      const before = next.campaign.completedEventIds.length;
      next = applyEvent(next, pack, event, changes, now);
      narrations.push(event.publicText);
      progressed = progressed || !event.once || next.campaign.completedEventIds.length > before;
      if (!event.once) progressed = false;
      if (next.campaign.pendingCombatSceneId || next.campaign.pendingSceneId || next.campaign.endingId) break;
    }
  }

  const narration = narrations.length
    ? uniqueStrings(narrations).join(" ")
    : `${actor.name}对${target.name}进行了${ACTION_LABELS[request.actionType]}；未触发新的结构化结果。`;
  const resolution: SceneActionResolution = {
    requestId: request.id,
    ruling: "approved",
    narration,
    ruleBasis: `团包事件 · ${campaignScene.name}`,
    changes,
    nextPrompt: next.campaign.endingId
      ? "本次团档已经形成结局，可查看记录或返回首页。"
      : next.campaign.pendingCombatSceneId
        ? "对质已经升级，沿用当前气骰进入交锋。"
        : next.campaign.pendingSceneId
          ? "场景条件已经完成，即将揭开下一幕。"
          : campaignScene.objective,
    resolvedAt: now,
  };
  next.scene = {
    ...next.scene,
    narration,
    turn: next.scene.turn + 1,
    pendingRequest: undefined,
    lastResolution: resolution,
  };
  next.logs = [{
    id: `CAMPAIGN_ACTION-${request.id}`,
    type: "SCENE_ACTION",
    round: next.round,
    message: `${ACTION_LABELS[request.actionType]}｜${target.name}｜${narration}${changes.length ? `｜${changes.join("；")}` : ""}`,
    public: request.audience !== "dm",
    createdAt: now,
  }, ...next.logs];
  return next;
}

export type CombatConclusion = "victory" | "defeat" | "retreat" | "surrender" | "noncombat";

export function evaluateCampaignCombatConclusion(
  state: CombatState,
  pack: CampaignPack,
): CombatConclusion | undefined {
  if (state.encounterMode !== "combat" || state.runtime.mode !== "COMBAT") return undefined;
  const scene = pack.scenes.find((entry) => entry.id === state.scene.id);
  if (!scene?.combat) return undefined;
  // Runtime participants may replace the pack's quick-start protagonist with
  // the player-created/selected party. The authoritative active list is the
  // only safe source after that substitution.
  const participants = new Set(state.campaign.activeActorIds);
  const playerActors = state.actors.filter((actor) => participants.has(actor.id) && actor.side === "player");
  const opponents = state.actors.filter((actor) => participants.has(actor.id) && actor.side !== "player");
  if (playerActors.length > 0 && playerActors.every((actor) => actor.hp <= 0)) return "defeat";
  if (opponents.length > 0 && opponents.every((actor) => actor.hp <= 0)) return "victory";
  const livingOpponents = opponents.filter((actor) => actor.hp > 0);
  if (
    livingOpponents.length > 0
    && scene.combat.retreatConditions.length > 0
    && livingOpponents.every((actor) => actor.hp / Math.max(1, actor.maxHp) <= (actor.aiProfile?.retreatHpRatio ?? 0.25))
  ) return "retreat";
  return undefined;
}

export function settleCampaignCombat(
  state: CombatState,
  pack: CampaignPack,
  conclusion: CombatConclusion,
  note = "",
  now = Date.now(),
): CombatState {
  const scene = pack.scenes.find((entry) => entry.id === state.scene.id);
  if (!scene?.combat) return state;
  const labels: Record<CombatConclusion, string> = {
    victory: "玩家控制了目标，敌方失去继续争夺能力。",
    defeat: "玩家一方失去继续行动能力，场景按失败条件收束。",
    retreat: "敌方依照保命与任务目标撤出交锋。",
    surrender: "敌方接受停手条件并交出当前争夺目标。",
    noncombat: "双方停止出招，改以场景条件完成收束。",
  };
  const summary = note.trim() || labels[conclusion];
  const nextSceneId = scene.nextSceneIds[0];
  return {
    ...state,
    scene: { ...state.scene, completed: true, ending: summary, narration: summary },
    pendingAction: undefined,
    turnPaused: true,
    campaign: {
      ...state.campaign,
      completedSceneIds: uniqueStrings([...state.campaign.completedSceneIds, scene.id]),
      flags: { ...state.campaign.flags, [`combat:${scene.id}`]: conclusion },
      pendingSceneId: nextSceneId,
      pendingCombatSceneId: undefined,
      updatedAt: now,
    },
    logs: [{ id: `CAMPAIGN_COMBAT_SETTLED-${now}`, type: "COMBAT_SETTLED", round: state.round, message: `交锋收束｜${summary}`, public: true, createdAt: now }, ...state.logs],
  };
}

/**
 * Load another authored scene segment without touching any die face or zone.
 * Tutorial segments are one continuous outing: changing the canvas must not
 * secretly perform a new-scene roll or recover resources.
 */
export function transitionToCampaignScene(
  state: CombatState,
  pack: CampaignPack,
  sceneId: string,
  initiativeOrder: string[] = [],
): CombatState {
  const projected = projectCampaignScene(pack, sceneId, state.scene.act + 1);
  const authoredMode = projected.campaignScene.mode;
  const sceneMode = authoredMode === "SCENE_STRUCTURED" ? "SCENE_STRUCTURED" : "SCENE_FREE";
  let runtime = beginNewScene(state.runtime, sceneId, sceneMode);
  if (sceneMode === "SCENE_STRUCTURED") {
    runtime = setSceneMode(runtime, sceneMode, {
      round: 1,
      activeActorId: initiativeOrder[0],
      initiativeOrder,
      actedActorIds: [],
      paused: false,
    });
  }
  const createdAt = Date.now();
  const completedSceneIds = state.scene.id === sceneId
    ? state.campaign.completedSceneIds
    : uniqueStrings([...state.campaign.completedSceneIds, state.scene.id]);
  const storedPlayerActorId = typeof state.campaign.flags.playerActorId === "string"
    ? state.campaign.flags.playerActorId
    : state.actors.find((actor) => actor.side === "player")?.id ?? "pc-shen-qing";
  const partyActorIds = state.campaign.partyActorIds.length ? state.campaign.partyActorIds : [storedPlayerActorId];
  const leadActorId = partyActorIds[0] ?? storedPlayerActorId;
  const mapAuthoredActor = (id: string) => id === "pc-shen-qing" && !partyActorIds.includes(id) ? leadActorId : id;
  const distanceRelations = projected.campaignScene.combat?.distanceRelations
    .filter((relation) => ["贴身", "近身", "短距", "中距", "远距", "离场"].includes(relation.band))
    .map((relation, index) => ({
      id: `${projected.campaignScene.id}-distance-${index + 1}`,
      fromActorId: mapAuthoredActor(relation.fromId),
      toActorId: mapAuthoredActor(relation.toId),
      band: relation.band as DistanceBand,
      public: true,
    }));
  const authoredActorIds = projected.campaignScene.combat?.participantIds
    ?? projected.campaignScene.sequenceActorIds
    ?? [];
  const mappedAuthoredActors = authoredActorIds.map(mapAuthoredActor);
  const activeActorIds = uniqueStrings([...partyActorIds, ...mappedAuthoredActors])
    .filter((id) => state.actors.some((actor) => actor.id === id));
  return {
    ...state,
    runtime,
    campaign: {
      ...(state.campaign.packId === pack.id ? state.campaign : makeProgress(pack, sceneId, createdAt, activeActorIds)),
      packId: pack.id,
      packVersion: pack.version,
      currentSceneId: sceneId,
      completedSceneIds,
      activeActorIds,
      pendingSceneId: undefined,
      pendingCombatSceneId: undefined,
      updatedAt: createdAt,
    },
    sceneName: projected.campaignScene.name,
    sceneGoal: projected.campaignScene.objective,
    scene: {
      ...projected.scene,
      permissions: [...state.scene.permissions],
      resources: [...state.scene.resources],
      combatUnlocked: authoredMode === "COMBAT",
    },
    tracks: projected.tracks,
    encounterMode: "scene",
    round: 1,
    phase: sceneMode === "SCENE_STRUCTURED" ? "declare" : "scene",
    activeActorId: initiativeOrder[0] ?? state.activeActorId,
    initiativeOrder: sceneMode === "SCENE_STRUCTURED" ? [...initiativeOrder] : [],
    actedActorIds: [],
    pendingAction: undefined,
    distances: distanceRelations?.length ? distanceRelations : state.distances,
    logs: [{
      id: `SCENE_TRANSITION-${sceneId}-${createdAt}`,
      type: "SCENE_TRANSITION",
      round: 1,
      message: `转场｜${projected.campaignScene.name}｜气海、息库、临气与状态保持不变。`,
      public: true,
      createdAt,
    }, ...state.logs],
  };
}
