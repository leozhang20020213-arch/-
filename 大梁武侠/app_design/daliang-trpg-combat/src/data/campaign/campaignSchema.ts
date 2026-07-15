import type { MoveUsageMode } from "../schema/moves";
import type { Actor } from "../../combat/types";

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
  operator: "equals" | "at_least" | "at_most" | "contains" | "changed" | "present" | "manual";
  value?: string | number | boolean;
}

export interface TutorialStep {
  id: string;
  sceneId: string;
  title: string;
  shortPrompt: string;
  detail: string;
  targetComponentId: string;
  prerequisites: string[];
  completion: TriggerCondition[];
  skipAllowed: boolean;
  blocking: boolean;
  ruleReferenceIds?: string[];
}

export interface TutorialDefinition {
  id: string;
  title: string;
  skippable: boolean;
  steps: TutorialStep[];
  completionRewardId: string;
}

export interface QuickStartCharacter {
  actorId: string;
  name: string;
  role: string;
  runtimeMoveIds: string[];
  catalogReferenceIds: string[];
  teachingFocus: string[];
}

export interface CampaignEnding {
  id: string;
  name: string;
  conditions: TriggerCondition[];
  publicText: string;
  records: string[];
}

/**
 * Story-specific intent layered over the reusable actor registry. Combat
 * statistics and learned moves stay authoritative in the actor database;
 * only narrative purpose and automatic-DM preferences belong to the pack.
 */
export interface CampaignActorProfile {
  actorId: string;
  hiddenGoal?: string;
  behaviorHint?: string;
  aiProfile?: Actor["aiProfile"];
}

export interface SceneElement {
  id: string;
  kind: SceneElementKind;
  name: string;
  description: string;
  public: boolean;
  areaId?: string;
  interactionUsageIds: string[];
  /** Read-only links into the versioned rule-text catalog. They never execute by themselves. */
  ruleReferenceIds?: string[];
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
    kind: "reveal" | "track" | "permission" | "resource" | "relationship" | "flag" | "start_combat" | "end_scene" | "reward";
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
  tracks: Array<{
    id: string;
    name: string;
    kind: "crisis" | "insight" | "progress";
    max: number;
    public: boolean;
    description: string;
    growthConditions?: string[];
    reductionConditions?: string[];
    thresholdOutcome?: string;
    insightLayers?: Array<{ level: number; summary: string; dmContent?: string }>;
  }>;
  events: CampaignEvent[];
  /** Explicit lightweight queue for structured scenes; never inferred from every actor in the registry. */
  sequenceActorIds?: string[];
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
  catalogVersion?: string;
  description: string;
  startSceneId: string;
  chapters: Array<{ id: string; name: string; summary: string; sceneIds: string[] }>;
  scenes: CampaignScene[];
  rewards: RewardDefinition[];
  quickStartCharacters?: QuickStartCharacter[];
  tutorial?: TutorialDefinition;
  endings?: CampaignEnding[];
  actorProfiles?: CampaignActorProfile[];
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
  pack.rewards.forEach((reward, index) => addId(reward.id, `rewards[${index}].id`));
  pack.endings?.forEach((ending, index) => addId(ending.id, `endings[${index}].id`));
  pack.scenes.forEach((scene, sceneIndex) => {
    addId(scene.id, `scenes[${sceneIndex}].id`);
    if (!scene.objective.trim()) issues.push({ severity: "warning", path: `scenes[${sceneIndex}].objective`, message: "场景没有可读目标。" });
    if (!scene.boundary.trim()) issues.push({ severity: "error", path: `scenes[${sceneIndex}].boundary`, message: "场景必须声明边界。" });
    scene.elements.forEach((element, elementIndex) => {
      addId(element.id, `scenes[${sceneIndex}].elements[${elementIndex}].id`);
      const referenceIds = element.ruleReferenceIds ?? [];
      if (new Set(referenceIds).size !== referenceIds.length) {
        issues.push({ severity: "error", path: `scenes[${sceneIndex}].elements[${elementIndex}].ruleReferenceIds`, message: "规则资料引用不能重复。" });
      }
      referenceIds.forEach((id) => {
        if (!/^[A-Z][A-Z0-9-]+$/.test(id)) {
          issues.push({ severity: "error", path: `scenes[${sceneIndex}].elements[${elementIndex}].ruleReferenceIds`, message: `规则资料标识 ${id} 格式非法。` });
        }
      });
    });
    scene.tracks.forEach((track, trackIndex) => {
      addId(track.id, `scenes[${sceneIndex}].tracks[${trackIndex}].id`);
      if (!Number.isInteger(track.max) || track.max < 1) {
        issues.push({ severity: "error", path: `scenes[${sceneIndex}].tracks[${trackIndex}].max`, message: "场景轨上限必须是正整数。" });
      }
      if (!track.description.trim()) {
        issues.push({ severity: "warning", path: `scenes[${sceneIndex}].tracks[${trackIndex}].description`, message: "场景轨缺少玩家可读说明。" });
      }
    });
    scene.events.forEach((event, eventIndex) => {
      addId(event.id, `scenes[${sceneIndex}].events[${eventIndex}].id`);
      if (event.conditions.length === 0) issues.push({ severity: "warning", path: `scenes[${sceneIndex}].events[${eventIndex}]`, message: "事件没有触发条件，只能由DM手动触发。" });
    });
    if (scene.mode === "COMBAT" && !scene.combat) issues.push({ severity: "error", path: `scenes[${sceneIndex}].combat`, message: "战斗场景缺少交锋配置。" });
  });
  const sceneIds = new Set(pack.scenes.map((scene) => scene.id));
  const rewardIds = new Set(pack.rewards.map((reward) => reward.id));
  const actorIds = new Set(pack.referencedActorIds);
  const actorProfileIds = new Set<string>();
  pack.actorProfiles?.forEach((profile, index) => {
    if (!actorIds.has(profile.actorId)) {
      issues.push({ severity: "error", path: `actorProfiles[${index}].actorId`, message: `行为档案人物 ${profile.actorId} 未列入团包人物引用。` });
    }
    if (actorProfileIds.has(profile.actorId)) {
      issues.push({ severity: "error", path: `actorProfiles[${index}].actorId`, message: `人物 ${profile.actorId} 的团包行为档案重复。` });
    }
    actorProfileIds.add(profile.actorId);
  });
  if (!sceneIds.has(pack.startSceneId)) issues.push({ severity: "error", path: "startSceneId", message: "起始场景不存在。" });
  pack.chapters.forEach((chapter, chapterIndex) => chapter.sceneIds.forEach((id) => {
    if (!sceneIds.has(id)) issues.push({ severity: "error", path: `chapters[${chapterIndex}].sceneIds`, message: `章节引用的场景 ${id} 不存在。` });
  }));
  pack.scenes.forEach((scene, index) => scene.nextSceneIds.forEach((id) => {
    if (!sceneIds.has(id)) issues.push({ severity: "error", path: `scenes[${index}].nextSceneIds`, message: `后继场景 ${id} 不存在。` });
  }));
  pack.scenes.forEach((scene, sceneIndex) => {
    scene.rewardIds.forEach((id) => {
      if (!rewardIds.has(id)) issues.push({ severity: "error", path: `scenes[${sceneIndex}].rewardIds`, message: `场景奖励 ${id} 不存在。` });
    });
    const localIds = new Set([...scene.elements.map((element) => element.id), ...scene.tracks.map((track) => track.id)]);
    scene.events.forEach((event, eventIndex) => {
      event.conditions.forEach((condition, conditionIndex) => {
        if (
          condition.sourceId
          && ["interaction", "track_threshold", "distance"].includes(condition.kind)
          && !localIds.has(condition.sourceId)
        ) {
          issues.push({ severity: "error", path: `scenes[${sceneIndex}].events[${eventIndex}].conditions[${conditionIndex}]`, message: `触发来源 ${condition.sourceId} 不在当前场景。` });
        }
      });
      event.effects.forEach((effect, effectIndex) => {
        const validTarget = effect.kind === "end_scene" || effect.kind === "start_combat"
          ? sceneIds.has(effect.targetId) || scene.combat?.id === effect.targetId
          : effect.kind === "reward"
            ? rewardIds.has(effect.targetId)
            : effect.kind === "permission" || effect.kind === "resource" || effect.kind === "relationship" || effect.kind === "flag"
              ? Boolean(effect.targetId.trim())
              : localIds.has(effect.targetId);
        if (!validTarget) issues.push({ severity: "error", path: `scenes[${sceneIndex}].events[${eventIndex}].effects[${effectIndex}]`, message: `事件效果目标 ${effect.targetId} 不存在或类型不匹配。` });
      });
    });
    scene.combat?.participantIds.forEach((id) => {
      if (!actorIds.has(id)) issues.push({ severity: "error", path: `scenes[${sceneIndex}].combat.participantIds`, message: `参战者 ${id} 未列入团包人物引用。` });
    });
    scene.sequenceActorIds?.forEach((id) => {
      if (!actorIds.has(id)) issues.push({ severity: "error", path: `scenes[${sceneIndex}].sequenceActorIds`, message: `结构化情景角色 ${id} 未列入团包人物引用。` });
    });
  });

  if (pack.tutorial) {
    addId(pack.tutorial.id, "tutorial.id");
    if (!rewardIds.has(pack.tutorial.completionRewardId)) {
      issues.push({ severity: "error", path: "tutorial.completionRewardId", message: "教学完成奖励不存在。" });
    }
    const stepIds = new Set(pack.tutorial.steps.map((step) => step.id));
    pack.tutorial.steps.forEach((step, stepIndex) => {
      addId(step.id, `tutorial.steps[${stepIndex}].id`);
      if (!sceneIds.has(step.sceneId)) issues.push({ severity: "error", path: `tutorial.steps[${stepIndex}].sceneId`, message: `教学步骤引用的场景 ${step.sceneId} 不存在。` });
      if (!step.targetComponentId.trim()) issues.push({ severity: "error", path: `tutorial.steps[${stepIndex}].targetComponentId`, message: "教学步骤必须绑定稳定组件标识。" });
      if (!step.shortPrompt.trim() || step.shortPrompt.length > 12) issues.push({ severity: "warning", path: `tutorial.steps[${stepIndex}].shortPrompt`, message: "教学短提示应为1至12个字符。" });
      if (step.completion.length === 0) issues.push({ severity: "error", path: `tutorial.steps[${stepIndex}].completion`, message: "教学步骤缺少可判定完成条件。" });
      step.prerequisites.forEach((id) => {
        if (!stepIds.has(id)) issues.push({ severity: "error", path: `tutorial.steps[${stepIndex}].prerequisites`, message: `前置教学步骤 ${id} 不存在。` });
      });
    });
  }

  pack.quickStartCharacters?.forEach((character, index) => {
    if (!actorIds.has(character.actorId)) issues.push({ severity: "error", path: `quickStartCharacters[${index}].actorId`, message: `快速角色 ${character.actorId} 未列入团包人物引用。` });
    if (character.runtimeMoveIds.length < 3) issues.push({ severity: "warning", path: `quickStartCharacters[${index}].runtimeMoveIds`, message: "快速角色少于3条可用武艺，可能缺少情景或应对入口。" });
    if (character.catalogReferenceIds.length === 0) issues.push({ severity: "warning", path: `quickStartCharacters[${index}].catalogReferenceIds`, message: "快速角色没有连接7月16日文字库参考。" });
  });
  return issues;
}

export function cloneCampaignPack(pack: CampaignPack): CampaignPack {
  return structuredClone(pack);
}
