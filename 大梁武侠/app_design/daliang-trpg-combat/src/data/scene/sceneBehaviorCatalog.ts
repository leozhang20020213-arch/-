import type { ActiveSceneElement, CombatState, SceneActionType } from "../../combat/types";
import type { MoveUsage, MoveUsageMode } from "../schema/moves";

export type SceneBehaviorCategory =
  | "investigate"
  | "negotiate"
  | "infiltrate"
  | "chase"
  | "prepare"
  | "jianghu";

export interface SceneBehaviorCategoryDefinition {
  id: SceneBehaviorCategory;
  name: string;
  seal: string;
  hint: string;
}

export interface SceneBehaviorUsage extends MoveUsage {
  category: SceneBehaviorCategory;
  name: string;
  summary: string;
  sceneActionType: SceneActionType;
  riskLabel: string;
}

export const SCENE_BEHAVIOR_CATEGORIES: SceneBehaviorCategoryDefinition[] = [
  { id: "investigate", name: "查探", seal: "察", hint: "观察、搜证与辨认痕迹" },
  { id: "negotiate", name: "交涉", seal: "言", hint: "说服、试探与交换条件" },
  { id: "infiltrate", name: "潜入", seal: "隐", hint: "避开耳目并取得位置" },
  { id: "chase", name: "追逐", seal: "逐", hint: "追踪、拦截与抢占路线" },
  { id: "prepare", name: "整备", seal: "备", hint: "取物、用具与临场准备" },
  { id: "jianghu", name: "江湖事务", seal: "侠", hint: "身份、人情与门路往来" },
];

const sceneModes: MoveUsageMode[] = ["SCENE_FREE", "SCENE_STRUCTURED"];

function usage(
  id: string,
  category: SceneBehaviorCategory,
  name: string,
  sceneActionType: SceneActionType,
  summary: string,
  riskLabel: string,
  targetRule: string,
): SceneBehaviorUsage {
  return {
    id,
    moveId: id,
    scope: "SCENE_ONLY",
    modes: sceneModes,
    actionKind: "formal",
    timepoint: "情景行为",
    targetRule,
    distanceRule: "场景可及",
    equipmentRule: "依述意与目标裁定",
    momentumRule: { condition: "无固定势要求", allowed: ["阴盛", "阳盛", "合势", "圆融", "崩势", "失势"] },
    minimumQi: sceneActionType === "observe" ? 0 : 1,
    qiNatureRule: "结构化对抗时由具体用法决定",
    baseEffect: summary,
    triggers: [],
    availability: [],
    resourceFlow: "依裁定进入气海、息库或场景记录",
    category,
    name,
    summary,
    sceneActionType,
    riskLabel,
  };
}

export const SCENE_BEHAVIOR_USAGES: SceneBehaviorUsage[] = [
  usage("scene.observe.careful", "investigate", "敛息观形", "observe", "看清公开痕迹，不贸然触动现场。", "低", "人物、物件或环境"),
  usage("scene.investigate.trace", "investigate", "循痕搜证", "investigate", "深入查验目标，可能推进危机。", "中", "可调查的物件或环境"),
  usage("scene.negotiate.sound", "negotiate", "探口风", "negotiate", "以身份或话术试探对方立场。", "中", "可交涉人物"),
  usage("scene.negotiate.exchange", "negotiate", "摆条件", "negotiate", "拿证据、人情或利益交换许可。", "中", "可交涉人物"),
  usage("scene.infiltrate.quiet", "infiltrate", "掩迹移步", "move", "避开耳目，悄然取得新的位置。", "中", "可进入的地点或人物"),
  usage("scene.infiltrate.shadow", "infiltrate", "借景藏形", "move", "借环境遮蔽行动意图与去向。", "中", "可进入的环境"),
  usage("scene.chase.follow", "chase", "循迹紧随", "move", "沿现有踪迹逼近正在离开的目标。", "中", "人物或路线"),
  usage("scene.chase.intercept", "chase", "抢路截前", "move", "抢占路线，迫使目标改变去向。", "高", "人物或路线"),
  usage("scene.prepare.take", "prepare", "取用在手", "take", "取得可及且未被争夺的场景物件。", "低", "可取得物件"),
  usage("scene.prepare.tool", "prepare", "因物制宜", "use-item", "调用行囊器具解决眼前问题。", "依物品", "人物、物件或环境"),
  usage("scene.jianghu.name", "jianghu", "亮明门路", "negotiate", "以江湖身份、人情或规矩打开局面。", "中", "人物"),
  usage("scene.jianghu.message", "jianghu", "传话递帖", "negotiate", "向场中人物传达立场或约定。", "低", "人物"),
];

export function visibleTargetsForUsage(
  state: CombatState,
  selectedUsage: SceneBehaviorUsage,
): ActiveSceneElement[] {
  return state.scene.elements.filter((element) =>
    element.public && element.interactionIds.includes(selectedUsage.sceneActionType));
}

export function usagesForSceneCategory(
  state: CombatState,
  category: SceneBehaviorCategory,
): SceneBehaviorUsage[] {
  const mode = state.runtime.mode === "SCENE_STRUCTURED" ? "SCENE_STRUCTURED" : "SCENE_FREE";
  return SCENE_BEHAVIOR_USAGES.filter((entry) =>
    entry.category === category
      && entry.modes.includes(mode)
      && visibleTargetsForUsage(state, entry).length > 0);
}

export function findSceneUsage(id: string): SceneBehaviorUsage | undefined {
  return SCENE_BEHAVIOR_USAGES.find((entry) => entry.id === id);
}
