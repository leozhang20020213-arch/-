import type { CombatState, QiZone } from "../../combat/types";
import {
  beginNewScene,
  finishCombatEncounter,
  normalizeResponseBudget,
  resetResponseBudget,
  setSceneMode,
  syncActiveSequence,
  type SceneWorkspaceMode,
} from "../../domain/session/runtime";

export type SceneRoll = (sides: number) => number;

function clampFace(value: number, sides: number): number {
  return Math.max(1, Math.min(sides, Math.floor(value)));
}

function withSceneLog(state: CombatState, type: string, message: string): CombatState {
  return {
    ...state,
    logs: [{
      id: `${type}-${Date.now()}-${state.logs.length}`,
      type,
      round: state.round,
      message,
      public: true,
      createdAt: Date.now(),
    }, ...state.logs],
  };
}

/** Start a genuinely new scene. This is the only scene-controller operation that rolls QI_POOL. */
export function startNewScene(
  state: CombatState,
  mode: SceneWorkspaceMode,
  roll: SceneRoll,
): CombatState {
  let next = structuredClone(state);
  next.runtime = beginNewScene(next.runtime, next.scene.id, mode);
  next.encounterMode = "scene";
  next.phase = mode === "SCENE_FREE" ? "scene" : "declare";
  next.round = 1;
  next.pendingAction = undefined;
  next.turnPaused = false;
  next.actedActorIds = [];
  next.initiativeOrder = [];
  next.dice = next.dice.map((die) => die.zone === "QI_POOL" && !die.temporary
    ? { ...die, zone: "QI_SEA" as QiZone, value: clampFace(roll(die.sides), die.sides) }
    : die);
  next.actors = next.actors.map((actor) => ({
    ...actor,
    responseQuotaUsed: 0,
    responseBudget: resetResponseBudget(normalizeResponseBudget(
      actor.responseBudget,
      actor.responseQuotaUsed,
      actor.maxResponseQuota,
    )),
  }));
  return withSceneLog(
    next,
    "SCENE_SESSION_STARTED",
    mode === "SCENE_FREE"
      ? "新场景开始：常规气骰整体投出；进入自由情景，不建立强制行动队列。"
      : "新场景开始：常规气骰整体投出；进入结构化情景，等待确认情景行动序列。",
  );
}

/** Switch free/structured scene presentation inside one scene without touching dice faces. */
export function changeSceneMode(
  state: CombatState,
  mode: SceneWorkspaceMode,
  initiativeOrder: string[] = [],
): CombatState {
  if (state.runtime.mode === "COMBAT") {
    throw new Error("战斗进行中不能直接切换情景模式。");
  }
  let next = structuredClone(state);
  next.runtime = setSceneMode(next.runtime, mode, mode === "SCENE_STRUCTURED"
    ? {
        round: next.runtime.scene.sequence?.round ?? 1,
        activeActorId: initiativeOrder[0],
        initiativeOrder,
        actedActorIds: [],
        paused: false,
      }
    : undefined);
  next.encounterMode = "scene";
  next.phase = mode === "SCENE_FREE" ? "scene" : "declare";
  next.round = mode === "SCENE_STRUCTURED" ? next.runtime.scene.sequence?.round ?? 1 : 1;
  next.activeActorId = mode === "SCENE_STRUCTURED"
    ? initiativeOrder[0] ?? next.activeActorId
    : next.activeActorId;
  next.initiativeOrder = mode === "SCENE_STRUCTURED" ? [...initiativeOrder] : [];
  next.actedActorIds = [];
  next.pendingAction = undefined;
  return withSceneLog(
    next,
    "SCENE_MODE_CHANGED",
    mode === "SCENE_FREE" ? "切换为自由情景；气骰和值保持不变。" : "切换为结构化情景；气骰和值保持不变。",
  );
}

/** Close combat and restore the scene controller. No recovery, reroll, or implicit maintenance occurs. */
export function closeCombatToScene(
  state: CombatState,
  summary: string,
): CombatState {
  if (state.runtime.mode !== "COMBAT" || !state.runtime.combat) {
    throw new Error("当前没有可收束的战斗 encounter。");
  }
  let next = structuredClone(state);
  next.runtime = finishCombatEncounter(next.runtime, summary);
  next.encounterMode = "scene";
  next.pendingAction = undefined;
  next.turnPaused = false;
  if (next.runtime.scene.mode === "SCENE_STRUCTURED" && next.runtime.scene.sequence) {
    const sequence = next.runtime.scene.sequence;
    next.phase = "declare";
    next.round = sequence.round;
    next.activeActorId = sequence.activeActorId ?? next.activeActorId;
    next.initiativeOrder = [...sequence.initiativeOrder];
    next.actedActorIds = [...sequence.actedActorIds];
    next.runtime = syncActiveSequence(next.runtime, sequence);
  } else {
    next.phase = "scene";
    next.round = 1;
    next.initiativeOrder = [];
    next.actedActorIds = [];
  }
  return withSceneLog(next, "COMBAT_ENCOUNTER_CLOSED", `战斗收束：${summary}`);
}
