import type { MoveUsageMode } from "../schema/moves";

export const CAMPAIGN_PACK_SCHEMA_VERSION = 1 as const;

export type SceneElementKind =
  | "area" | "npc" | "enemy" | "companion" | "object" | "container"
  | "door" | "obstacle" | "hazard" | "clue" | "document" | "dynamic";

export interface MediaAssetRef {
  id: string;
  kind: "image" | "background_music" | "ambient_sound" | "sound_effect";
  uri: string;
  title: string;
  optional: boolean;
}

export interface TriggerCondition {
  id: string;
  kind: "interaction" | "track_threshold" | "state" | "round" | "distance" | "dm";
  sourceId?: string;
  operator: "equals" | "at_least" | "at_most" | "contains" | "changed" | "manual";
  value?: string | number | boolean;
}

export interface SceneElement {
  id: string;
  kind: SceneElementKind;
  name: string;
  description: string;
  public: boolean;
  areaId?: string;
  interactionUsageIds: string[];
  blocksMovement?: boolean;
  blocksSight?: boolean;
  destructible?: boolean;
  hiddenNote?: string;
  art?: MediaAssetRef;
}

export interface RewardDefinition {
  id: string;
  name: string;
  kind: "item" | "clue" | "permission" | "relationship" | "resource" | "ending";
  referenceId?: string;
  amount?: number;
  publicText: string;
  dmNote?: string;
}

export interface CombatSetup {
  id: string;
  participantIds: string[];
  distanceRelations: Array<{ fromId: string; toId: string; band: string; blocked?: boolean }>;
  victoryConditions: string[];
  defeatConditions: string[];
  retreatConditions: string[];
  surrenderConditions: string[];
  nonCombatResolutions: string[];
}

export interface CampaignEvent {
  id: string;
  name: string;
  conditions: TriggerCondition[];
  effects: Array<{
    kind: "reveal" | "track" | "permission" | "resource" | "relationship" | "start_combat" | "end_scene" | "reward";
    targetId: string;
    value?: string | number | boolean;
  }>;
  once: boolean;
  publicText: string;
  dmNote?: string;
}

export interface CampaignScene {
  id: string;
  chapterId: string;
  name: string;
  mode: MoveUsageMode;
  description: string;
  objective: string;
  boundary: string;
  timeWindow?: string;
  weather?: string;
  light?: string;
  media: MediaAssetRef[];
  elements: SceneElement[];
  tracks: Array<{ id: string; name: string; kind: "crisis" | "insight" | "progress"; max: number; public: boolean }>;
  events: CampaignEvent[];
  combat?: CombatSetup;
  rewardIds: string[];
  nextSceneIds: string[];
}

export interface CampaignPack {
  schemaVersion: typeof CAMPAIGN_PACK_SCHEMA_VERSION;
  id: string;
  name: string;
  version: string;
  rulesVersion: string;
  description: string;
  startSceneId: string;
  chapters: Array<{ id: string; name: string; summary: string; sceneIds: string[] }>;
  scenes: CampaignScene[];
  rewards: RewardDefinition[];
  referencedMoveIds: string[];
  referencedActorIds: string[];
  updatedAt: string;
}

export interface CampaignValidationIssue {
  severity: "error" | "warning";
  path: string;
  message: string;
}

export function validateCampaignPack(pack: CampaignPack): CampaignValidationIssue[] {
  const issues: CampaignValidationIssue[] = [];
  const ids = new Set<string>();
  const addId = (id: string, path: string) => {
    if (!id.trim()) issues.push({ severity: "error", path, message: "缺少稳定标识。" });
    else if (ids.has(id)) issues.push({ severity: "error", path, message: `标识 ${id} 重复。` });
    else ids.add(id);
  };
  addId(pack.id, "pack.id");
  pack.chapters.forEach((chapter, index) => addId(chapter.id, `chapters[${index}].id`));
  pack.scenes.forEach((scene, sceneIndex) => {
    addId(scene.id, `scenes[${sceneIndex}].id`);
    if (!scene.objective.trim()) issues.push({ severity: "warning", path: `scenes[${sceneIndex}].objective`, message: "场景没有可读目标。" });
    if (!scene.boundary.trim()) issues.push({ severity: "error", path: `scenes[${sceneIndex}].boundary`, message: "场景必须声明边界。" });
    scene.elements.forEach((element, elementIndex) => addId(element.id, `scenes[${sceneIndex}].elements[${elementIndex}].id`));
    scene.events.forEach((event, eventIndex) => {
      addId(event.id, `scenes[${sceneIndex}].events[${eventIndex}].id`);
      if (event.conditions.length === 0) issues.push({ severity: "warning", path: `scenes[${sceneIndex}].events[${eventIndex}]`, message: "事件没有触发条件，只能由DM手动触发。" });
    });
    if (scene.mode === "COMBAT" && !scene.combat) issues.push({ severity: "error", path: `scenes[${sceneIndex}].combat`, message: "战斗场景缺少交锋配置。" });
  });
  const sceneIds = new Set(pack.scenes.map((scene) => scene.id));
  if (!sceneIds.has(pack.startSceneId)) issues.push({ severity: "error", path: "startSceneId", message: "起始场景不存在。" });
  pack.scenes.forEach((scene, index) => scene.nextSceneIds.forEach((id) => {
    if (!sceneIds.has(id)) issues.push({ severity: "error", path: `scenes[${index}].nextSceneIds`, message: `后继场景 ${id} 不存在。` });
  }));
  return issues;
}

export function cloneCampaignPack(pack: CampaignPack): CampaignPack {
  return structuredClone(pack);
}
