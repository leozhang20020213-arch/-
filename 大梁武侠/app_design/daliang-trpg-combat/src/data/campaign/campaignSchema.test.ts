import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloneCampaignPack, validateCampaignPack } from "./campaignSchema";
import { tutorialCampaignPack } from "./tutorialPack";

describe("campaign pack schema", () => {
  it("validates the complete 白蘋渡 tutorial, all play modes and four endings", () => {
    assert.deepEqual(validateCampaignPack(tutorialCampaignPack), []);
    assert.deepEqual(
      [...new Set(tutorialCampaignPack.scenes.map((scene) => scene.mode))],
      ["SCENE_FREE", "SCENE_STRUCTURED", "COMBAT"],
    );
    assert.equal(tutorialCampaignPack.catalogVersion, "2026-07-16");
    assert.deepEqual(tutorialCampaignPack.tutorial?.steps.map((step) => step.id), ["T0", "T1", "T2", "T3", "T4", "T5", "T6", "T7"]);
    assert.equal(tutorialCampaignPack.endings?.length, 4);
    assert.equal(tutorialCampaignPack.quickStartCharacters?.length, 4);
    assert.equal(tutorialCampaignPack.scenes.some((scene) => scene.elements.some((element) => element.ruleReferenceIds?.includes("MED-001"))), true);
  });

  it("rejects duplicated and malformed rule-text references", () => {
    const broken = cloneCampaignPack(tutorialCampaignPack);
    broken.scenes[0].elements[0].ruleReferenceIds = ["MED-001", "MED-001", "not valid"];
    const issues = validateCampaignPack(broken);
    assert.ok(issues.some((issue) => issue.message.includes("不能重复")));
    assert.ok(issues.some((issue) => issue.message.includes("格式非法")));
  });

  it("rejects missing scene links without mutating the authored pack", () => {
    const broken = cloneCampaignPack(tutorialCampaignPack);
    broken.scenes[0].nextSceneIds = ["missing-scene"];
    const issues = validateCampaignPack(broken);
    assert.equal(issues.some((issue) => issue.severity === "error" && /不存在/.test(issue.message)), true);
    assert.equal(tutorialCampaignPack.scenes[0].nextSceneIds.includes("missing-scene"), false);
  });

  it("rejects broken chapter, reward, participant and tutorial references", () => {
    const broken = cloneCampaignPack(tutorialCampaignPack);
    broken.chapters[0].sceneIds.push("missing-chapter-scene");
    broken.scenes[0].rewardIds.push("missing-reward");
    broken.scenes.at(-1)!.combat!.participantIds.push("missing-actor");
    broken.tutorial!.steps[1].prerequisites = ["missing-step"];
    const messages = validateCampaignPack(broken).map((issue) => issue.message);
    assert.ok(messages.some((message) => message.includes("章节引用")));
    assert.ok(messages.some((message) => message.includes("场景奖励")));
    assert.ok(messages.some((message) => message.includes("参战者")));
    assert.ok(messages.some((message) => message.includes("前置教学步骤")));
  });
});
