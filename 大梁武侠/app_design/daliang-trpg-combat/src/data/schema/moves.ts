import type {
  FormPosition,
  Move,
  MoveCategory,
  MoveSubCategory,
  MoveTrigger as LegacyMoveTrigger,
  QiNature,
  ShiState,
} from "../../combat/types";
import type { WorkspaceMode } from "../../domain/session/runtime";

export type MoveUsageScope =
  | "SCENE_ONLY"
  | "COMBAT_ONLY"
  | "BOTH"
  | "TRANSITION"
  | "DM_ONLY"
  | "PASSIVE";

export type MoveUsageMode = "SCENE_FREE" | "SCENE_STRUCTURED" | "COMBAT";
export type ActionKind = "formal" | "turn_quick" | "free_quick" | "response" | "passive" | "dm";
export type ResponseType = "INTERCEPT" | "REACT" | "PROTECT";
export type ResponseQuotaType = "PROACTIVE" | "SELF_DEFENSE";

export interface ArtBinding {
  resourceId: string;
  fallbackResourceId?: string;
  crop?: "cover" | "contain" | "portrait";
  focalPoint?: { x: number; y: number };
}

export interface AvailabilityRule {
  id: string;
  kind: "distance" | "equipment" | "momentum" | "status" | "permission" | "resource" | "timepoint";
  operator: "includes" | "excludes" | "minimum" | "maximum" | "equals" | "present";
  value?: string | number | string[];
  failureReason: string;
}

export interface MoveTrigger {
  id: string;
  reads: "YIN" | "YANG" | "TOTAL" | "DIFFERENCE" | "STATE" | "SCENE_TRACK";
  condition: string;
  effect: string;
  risk?: string;
}

export interface MoveDefinition {
  id: string;
  name: string;
  category: MoveCategory;
  subCategory: MoveSubCategory;
  styleId?: string;
  tier: string;
  designGrade: string;
  yinYangLabel: string;
  formPosition: FormPosition;
  description: string;
  learnedFrom?: string;
  art?: ArtBinding;
}

export interface MoveUsage {
  id: string;
  moveId: string;
  scope: MoveUsageScope;
  modes: MoveUsageMode[];
  actionKind: ActionKind;
  timepoint: string;
  targetRule: string;
  distanceRule: string;
  equipmentRule: string;
  momentumRule: { condition: string; allowed: ShiState[] };
  minimumQi: number;
  qiNatureRule: string;
  baseEffect: string;
  triggers: MoveTrigger[];
  availability: AvailabilityRule[];
  risk?: string;
  resourceFlow: string;
}

export interface ResponseUsage {
  id: string;
  usageId: string;
  responseType: ResponseType;
  quotaType: ResponseQuotaType;
  allowedResponders: "TARGET" | "THIRD_PARTY" | "SOURCE" | "ANY_LEGAL";
  affectsPendingFields: Array<"target" | "distance" | "equipment" | "momentum" | "locked_qi" | "damage" | "status" | "resource_flow">;
}

export interface MoveCatalog {
  definitions: MoveDefinition[];
  usages: MoveUsage[];
  responses: ResponseUsage[];
}

function mapLegacyTrigger(trigger: LegacyMoveTrigger, index: number, usageId: string): MoveTrigger {
  const reads = trigger.type === "主槽"
    ? trigger.condition.includes("阴") ? "YIN" : "YANG"
    : trigger.type === "合值"
      ? "TOTAL"
      : "DIFFERENCE";
  return {
    id: `${usageId}:trigger:${index + 1}`,
    reads,
    condition: trigger.condition,
    effect: trigger.effect,
    risk: trigger.type === "差值/风险" ? trigger.effect : undefined,
  };
}

export function inferLegacyUsageScope(move: Move): MoveUsageScope {
  if (move.actionType === "scene") return "SCENE_ONLY";
  if (move.timing === "整备/情景") return "SCENE_ONLY";
  if (move.timing === "截击" || move.timing === "应招" || move.timing === "正式出手") return "COMBAT_ONLY";
  if (move.category === "法门") return "BOTH";
  return "BOTH";
}

export function legacyMoveToDefinitionAndUsage(move: Move): {
  definition: MoveDefinition;
  usage: MoveUsage;
} {
  const scope = inferLegacyUsageScope(move);
  const modes: MoveUsageMode[] = scope === "SCENE_ONLY"
    ? ["SCENE_FREE", "SCENE_STRUCTURED"]
    : scope === "COMBAT_ONLY"
      ? ["COMBAT"]
      : ["SCENE_FREE", "SCENE_STRUCTURED", "COMBAT"];
  const usageId = `${move.id}:legacy-main`;
  return {
    definition: {
      id: move.id,
      name: move.name,
      category: move.category,
      subCategory: move.subCategory,
      tier: move.tier,
      designGrade: move.designGrade,
      yinYangLabel: move.yinYangLabel,
      formPosition: move.formPosition,
      description: move.baseEffect,
      art: { resourceId: `move.${move.id.toLowerCase()}`, fallbackResourceId: "frame.card.scene" },
    },
    usage: {
      id: usageId,
      moveId: move.id,
      scope,
      modes,
      actionKind: move.timing === "正式出手"
        ? "formal"
        : move.timing === "随手便行"
          ? "free_quick"
          : move.timing === "截击" || move.timing === "应招"
            ? "response"
            : "turn_quick",
      timepoint: move.timing,
      targetRule: move.targetRange,
      distanceRule: move.targetRange,
      equipmentRule: move.equipPermission,
      momentumRule: { condition: move.shiCondition, allowed: [...move.allowedShi] },
      minimumQi: move.minDice,
      qiNatureRule: move.qiNatureThreshold,
      baseEffect: move.baseEffect,
      triggers: move.triggers.map((trigger, index) => mapLegacyTrigger(trigger, index, usageId)),
      availability: [],
      resourceFlow: move.resourceDestination,
    },
  };
}

export function isUsageAvailableInMode(
  usage: MoveUsage,
  mode: WorkspaceMode,
  options: { isDm?: boolean } = {},
): boolean {
  if (usage.scope === "PASSIVE") return false;
  if (usage.scope === "DM_ONLY" && !options.isDm) return false;
  if (mode === "COMBAT") return usage.modes.includes("COMBAT");
  return usage.modes.includes(mode);
}

export function usagesForMode(
  catalog: MoveCatalog,
  mode: WorkspaceMode,
  options: { isDm?: boolean; moveIds?: string[] } = {},
): MoveUsage[] {
  const allowedMoves = options.moveIds ? new Set(options.moveIds) : undefined;
  return catalog.usages.filter((usage) =>
    (!allowedMoves || allowedMoves.has(usage.moveId))
      && isUsageAvailableInMode(usage, mode, options));
}

export function qiNatureLabel(nature: QiNature): string {
  if (nature === "yin") return "阴";
  if (nature === "yang") return "阳";
  return "原始";
}
