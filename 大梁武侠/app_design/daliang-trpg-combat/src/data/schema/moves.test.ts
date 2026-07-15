import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Move } from "../../combat/types";
import {
  isUsageAvailableInMode,
  legacyMoveToDefinitionAndUsage,
  type MoveUsage,
} from "./moves";

function usage(scope: MoveUsage["scope"], modes: MoveUsage["modes"]): MoveUsage {
  return {
    id: `usage-${scope}`,
    moveId: `move-${scope}`,
    scope,
    modes,
    actionKind: "formal",
    timepoint: "测试",
    targetRule: "对象",
    distanceRule: "近身",
    equipmentRule: "无",
    momentumRule: { condition: "无势", allowed: ["阴盛", "阳盛", "合势"] },
    minimumQi: 1,
    qiNatureRule: "任意气性",
    baseEffect: "测试效果",
    triggers: [],
    availability: [],
    resourceFlow: "常规气骰入息库",
  };
}

describe("move usage scope", () => {
  it("does not leak scene-only or combat-only usages across workspaces", () => {
    const sceneOnly = usage("SCENE_ONLY", ["SCENE_FREE", "SCENE_STRUCTURED"]);
    const combatOnly = usage("COMBAT_ONLY", ["COMBAT"]);
    assert.equal(isUsageAvailableInMode(sceneOnly, "SCENE_FREE"), true);
    assert.equal(isUsageAvailableInMode(sceneOnly, "COMBAT"), false);
    assert.equal(isUsageAvailableInMode(combatOnly, "SCENE_STRUCTURED"), false);
    assert.equal(isUsageAvailableInMode(combatOnly, "COMBAT"), true);
  });

  it("keeps one move identity while creating a legacy main usage", () => {
    const move: Move = {
      id: "FM-TEST",
      name: "听潮辨声",
      category: "法门",
      subCategory: "查探",
      tier: "俗家",
      designGrade: "C",
      yinYangLabel: "少阴",
      timing: "整备/情景",
      formPosition: "无",
      minDice: 1,
      qiNatureThreshold: "至少1阴",
      shiCondition: "无势",
      allowedShi: ["阴盛", "阳盛", "合势", "圆融", "失势"],
      targetRange: "场景对象",
      equipPermission: "无",
      baseEffect: "确认一处声源",
      triggers: [],
      postShi: "不改势",
      resourceDestination: "已用常规气骰入息库",
      hasIntercept: false,
      hasReact: false,
    };
    const converted = legacyMoveToDefinitionAndUsage(move);
    assert.equal(converted.definition.id, move.id);
    assert.equal(converted.usage.moveId, move.id);
    assert.equal(converted.usage.scope, "SCENE_ONLY");
  });

  it("honors an authored scene discriminator even with a formal timing label", () => {
    const move: Move = {
      id: "FM-SCENE",
      name: "听痕辨路",
      category: "法门",
      subCategory: "查探",
      tier: "俗家",
      designGrade: "C",
      yinYangLabel: "少阴",
      timing: "正式出手",
      formPosition: "无",
      minDice: 2,
      qiNatureThreshold: "至少1阴",
      shiCondition: "无势",
      allowedShi: ["阴盛", "阳盛", "合势", "圆融", "失势"],
      targetRange: "道路或机关痕迹",
      equipPermission: "无",
      baseEffect: "确认一处痕迹",
      triggers: [],
      postShi: "不改势",
      resourceDestination: "已用常规气骰入息库",
      hasIntercept: false,
      hasReact: false,
      actionType: "scene",
    };
    const converted = legacyMoveToDefinitionAndUsage(move);
    assert.equal(converted.usage.scope, "SCENE_ONLY");
    assert.deepEqual(converted.usage.modes, ["SCENE_FREE", "SCENE_STRUCTURED"]);
  });
});
