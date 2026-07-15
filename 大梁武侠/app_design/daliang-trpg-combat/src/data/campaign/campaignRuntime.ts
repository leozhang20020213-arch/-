import type {
  ActiveSceneElement,
  CombatState,
  SceneActionType,
  SceneRuntimeState,
  SceneTrack,
} from "../../combat/types";
import { beginNewScene, setSceneMode } from "../../domain/session/runtime";
import type { CampaignPack, CampaignScene, SceneElementKind } from "./campaignSchema";

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
  return {
    ...state,
    runtime,
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
