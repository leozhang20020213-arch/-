export const RUNTIME_SCHEMA_VERSION = 2 as const;

export type WorkspaceMode = "SCENE_FREE" | "SCENE_STRUCTURED" | "COMBAT";
export type SceneWorkspaceMode = Exclude<WorkspaceMode, "COMBAT">;

export type CombatPhaseSnapshot =
  | "setup"
  | "initiative"
  | "declare"
  | "intercept_window"
  | "react_window"
  | "outcome"
  | "round_end";

export interface TurnSequenceState {
  round: number;
  activeActorId?: string;
  initiativeOrder: string[];
  actedActorIds: string[];
  paused: boolean;
}

export interface SceneSessionState {
  sceneId: string;
  mode: SceneWorkspaceMode;
  sceneSerial: number;
  sequence?: TurnSequenceState;
  lastCombatSummary?: string;
}

export interface CombatEncounterState {
  id: string;
  sceneId: string;
  round: number;
  phase: CombatPhaseSnapshot;
  activeActorId?: string;
  initiativeOrder: string[];
  actedActorIds: string[];
  paused: boolean;
  startedAt: number;
}

export interface RuntimeSessionState {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION;
  mode: WorkspaceMode;
  scene: SceneSessionState;
  combat?: CombatEncounterState;
}

export type ResponseBudgetKind = "proactive" | "self_defense";

export interface ResponseBudget {
  proactiveUsed: number;
  maxProactive: number;
  selfDefenseUsed: number;
  maxSelfDefense: number;
}

export interface LegacyRuntimeSnapshot {
  sceneId: string;
  encounterMode?: "scene" | "combat";
  round?: number;
  phase?: string;
  activeActorId?: string;
  initiativeOrder?: string[];
  actedActorIds?: string[];
  turnPaused?: boolean;
}

function cleanIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

function isSceneMode(value: unknown): value is SceneWorkspaceMode {
  return value === "SCENE_FREE" || value === "SCENE_STRUCTURED";
}

function isWorkspaceMode(value: unknown): value is WorkspaceMode {
  return isSceneMode(value) || value === "COMBAT";
}

function isCombatPhase(value: unknown): value is CombatPhaseSnapshot {
  return value === "setup"
    || value === "initiative"
    || value === "declare"
    || value === "intercept_window"
    || value === "react_window"
    || value === "outcome"
    || value === "round_end";
}

export function createRuntimeSession(
  sceneId: string,
  mode: SceneWorkspaceMode = "SCENE_FREE",
): RuntimeSessionState {
  return {
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    mode,
    scene: {
      sceneId,
      mode,
      sceneSerial: 1,
      sequence: mode === "SCENE_STRUCTURED"
        ? { round: 1, initiativeOrder: [], actedActorIds: [], paused: false }
        : undefined,
    },
  };
}

/**
 * Old scene saves had an implicit queue, so they migrate to SCENE_STRUCTURED.
 * Newly created sessions use createRuntimeSession and therefore default free.
 */
export function normalizeRuntimeSession(
  value: unknown,
  legacy: LegacyRuntimeSnapshot,
): RuntimeSessionState {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : undefined;
  const rawScene = raw?.scene && typeof raw.scene === "object"
    ? raw.scene as Record<string, unknown>
    : undefined;
  const storedMode = isWorkspaceMode(raw?.mode) ? raw.mode : undefined;
  const sceneMode = isSceneMode(rawScene?.mode)
    ? rawScene.mode
    : storedMode === "SCENE_FREE" || storedMode === "SCENE_STRUCTURED"
      ? storedMode
      : "SCENE_STRUCTURED";
  const sceneId = typeof rawScene?.sceneId === "string" && rawScene.sceneId
    ? rawScene.sceneId
    : legacy.sceneId;
  const rawSequence = rawScene?.sequence && typeof rawScene.sequence === "object"
    ? rawScene.sequence as Record<string, unknown>
    : undefined;
  const legacySequence: TurnSequenceState = {
    round: positiveInt(legacy.round, 1) || 1,
    activeActorId: legacy.activeActorId,
    initiativeOrder: cleanIds(legacy.initiativeOrder),
    actedActorIds: cleanIds(legacy.actedActorIds),
    paused: Boolean(legacy.turnPaused),
  };
  const sequence = sceneMode === "SCENE_STRUCTURED"
    ? {
        round: positiveInt(rawSequence?.round, legacySequence.round) || 1,
        activeActorId: typeof rawSequence?.activeActorId === "string"
          ? rawSequence.activeActorId
          : legacySequence.activeActorId,
        initiativeOrder: cleanIds(rawSequence?.initiativeOrder).length
          ? cleanIds(rawSequence?.initiativeOrder)
          : legacySequence.initiativeOrder,
        actedActorIds: cleanIds(rawSequence?.actedActorIds).length
          ? cleanIds(rawSequence?.actedActorIds)
          : legacySequence.actedActorIds,
        paused: typeof rawSequence?.paused === "boolean" ? rawSequence.paused : legacySequence.paused,
      }
    : undefined;
  const scene: SceneSessionState = {
    sceneId,
    mode: sceneMode,
    sceneSerial: positiveInt(rawScene?.sceneSerial, 1) || 1,
    sequence,
    lastCombatSummary: typeof rawScene?.lastCombatSummary === "string"
      ? rawScene.lastCombatSummary
      : undefined,
  };

  const shouldHaveCombat = storedMode === "COMBAT" || (!storedMode && legacy.encounterMode === "combat");
  if (!shouldHaveCombat) {
    return { schemaVersion: RUNTIME_SCHEMA_VERSION, mode: sceneMode, scene };
  }

  const rawCombat = raw?.combat && typeof raw.combat === "object"
    ? raw.combat as Record<string, unknown>
    : undefined;
  const combat: CombatEncounterState = {
    id: typeof rawCombat?.id === "string" && rawCombat.id
      ? rawCombat.id
      : `legacy-combat-${sceneId}`,
    sceneId,
    round: positiveInt(rawCombat?.round, legacy.round ?? 1) || 1,
    phase: isCombatPhase(rawCombat?.phase)
      ? rawCombat.phase
      : isCombatPhase(legacy.phase) && legacy.phase !== "setup"
        ? legacy.phase
        : "declare",
    activeActorId: typeof rawCombat?.activeActorId === "string"
      ? rawCombat.activeActorId
      : legacy.activeActorId,
    initiativeOrder: cleanIds(rawCombat?.initiativeOrder).length
      ? cleanIds(rawCombat?.initiativeOrder)
      : cleanIds(legacy.initiativeOrder),
    actedActorIds: cleanIds(rawCombat?.actedActorIds).length
      ? cleanIds(rawCombat?.actedActorIds)
      : cleanIds(legacy.actedActorIds),
    paused: typeof rawCombat?.paused === "boolean" ? rawCombat.paused : Boolean(legacy.turnPaused),
    startedAt: positiveInt(rawCombat?.startedAt, 0),
  };
  return { schemaVersion: RUNTIME_SCHEMA_VERSION, mode: "COMBAT", scene, combat };
}

export function beginNewScene(
  runtime: RuntimeSessionState,
  sceneId: string,
  mode: SceneWorkspaceMode = "SCENE_FREE",
): RuntimeSessionState {
  return {
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    mode,
    scene: {
      sceneId,
      mode,
      sceneSerial: runtime.scene.sceneSerial + 1,
      sequence: mode === "SCENE_STRUCTURED"
        ? { round: 1, initiativeOrder: [], actedActorIds: [], paused: false }
        : undefined,
    },
  };
}

export function setSceneMode(
  runtime: RuntimeSessionState,
  mode: SceneWorkspaceMode,
  sequence?: Partial<TurnSequenceState>,
): RuntimeSessionState {
  if (runtime.mode === "COMBAT") {
    throw new Error("战斗进行中不能直接切换情景队列；请先收束战斗 encounter。");
  }
  const nextSequence = mode === "SCENE_STRUCTURED"
    ? {
        round: Math.max(1, sequence?.round ?? runtime.scene.sequence?.round ?? 1),
        activeActorId: sequence?.activeActorId ?? runtime.scene.sequence?.activeActorId,
        initiativeOrder: cleanIds(sequence?.initiativeOrder ?? runtime.scene.sequence?.initiativeOrder),
        actedActorIds: cleanIds(sequence?.actedActorIds ?? runtime.scene.sequence?.actedActorIds),
        paused: sequence?.paused ?? runtime.scene.sequence?.paused ?? false,
      }
    : undefined;
  return {
    ...runtime,
    mode,
    scene: { ...runtime.scene, mode, sequence: nextSequence },
    combat: undefined,
  };
}

export function beginCombatEncounter(
  runtime: RuntimeSessionState,
  encounterId: string,
  startedAt = Date.now(),
): RuntimeSessionState {
  if (!encounterId.trim()) throw new Error("战斗 encounter 必须有稳定标识。");
  return {
    ...runtime,
    mode: "COMBAT",
    combat: {
      id: encounterId,
      sceneId: runtime.scene.sceneId,
      round: 1,
      phase: "initiative",
      initiativeOrder: [],
      actedActorIds: [],
      paused: false,
      startedAt,
    },
  };
}

export function confirmCombatInitiative(
  runtime: RuntimeSessionState,
  initiativeOrder: string[],
  activeActorId?: string,
): RuntimeSessionState {
  if (runtime.mode !== "COMBAT" || !runtime.combat) {
    throw new Error("没有正在准备的战斗 encounter。");
  }
  const cleanOrder = cleanIds(initiativeOrder);
  return {
    ...runtime,
    combat: {
      ...runtime.combat,
      phase: "declare",
      activeActorId: activeActorId ?? cleanOrder[0],
      initiativeOrder: cleanOrder,
      actedActorIds: [],
    },
  };
}

export function syncActiveSequence(
  runtime: RuntimeSessionState,
  sequence: TurnSequenceState & { phase?: CombatPhaseSnapshot },
): RuntimeSessionState {
  if (runtime.mode === "COMBAT" && runtime.combat) {
    return {
      ...runtime,
      combat: {
        ...runtime.combat,
        round: Math.max(1, sequence.round),
        phase: sequence.phase ?? runtime.combat.phase,
        activeActorId: sequence.activeActorId,
        initiativeOrder: cleanIds(sequence.initiativeOrder),
        actedActorIds: cleanIds(sequence.actedActorIds),
        paused: sequence.paused,
      },
    };
  }
  if (runtime.mode === "SCENE_STRUCTURED") {
    return {
      ...runtime,
      scene: {
        ...runtime.scene,
        sequence: {
          round: Math.max(1, sequence.round),
          activeActorId: sequence.activeActorId,
          initiativeOrder: cleanIds(sequence.initiativeOrder),
          actedActorIds: cleanIds(sequence.actedActorIds),
          paused: sequence.paused,
        },
      },
    };
  }
  return runtime;
}

export function finishCombatEncounter(
  runtime: RuntimeSessionState,
  summary: string,
): RuntimeSessionState {
  if (runtime.mode !== "COMBAT" || !runtime.combat) {
    throw new Error("当前没有可收束的战斗 encounter。");
  }
  return {
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    mode: runtime.scene.mode,
    scene: { ...runtime.scene, lastCombatSummary: summary },
  };
}

export function createResponseBudget(
  maxProactive = 1,
  maxSelfDefense = 1,
): ResponseBudget {
  return {
    proactiveUsed: 0,
    maxProactive: Math.max(0, Math.floor(maxProactive)),
    selfDefenseUsed: 0,
    maxSelfDefense: Math.max(0, Math.floor(maxSelfDefense)),
  };
}

export function normalizeResponseBudget(
  value: unknown,
  legacyUsed = 0,
  legacyMax = 1,
): ResponseBudget {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : undefined;
  return {
    proactiveUsed: Math.max(
      positiveInt(raw?.proactiveUsed, legacyUsed),
      Math.max(0, Math.floor(legacyUsed)),
    ),
    maxProactive: positiveInt(raw?.maxProactive, legacyMax),
    selfDefenseUsed: positiveInt(raw?.selfDefenseUsed, 0),
    maxSelfDefense: positiveInt(raw?.maxSelfDefense, legacyMax),
  };
}

export function canSpendResponseBudget(
  budget: ResponseBudget,
  kind: ResponseBudgetKind,
): boolean {
  return kind === "proactive"
    ? budget.proactiveUsed < budget.maxProactive
    : budget.selfDefenseUsed < budget.maxSelfDefense;
}

export function spendResponseBudget(
  budget: ResponseBudget,
  kind: ResponseBudgetKind,
): ResponseBudget {
  if (!canSpendResponseBudget(budget, kind)) {
    throw new Error(kind === "proactive" ? "本轮主动响应额度已用完。" : "本轮自保应招额度已用完。");
  }
  return kind === "proactive"
    ? { ...budget, proactiveUsed: budget.proactiveUsed + 1 }
    : { ...budget, selfDefenseUsed: budget.selfDefenseUsed + 1 };
}

export function resetResponseBudget(budget: ResponseBudget): ResponseBudget {
  return { ...budget, proactiveUsed: 0, selfDefenseUsed: 0 };
}
