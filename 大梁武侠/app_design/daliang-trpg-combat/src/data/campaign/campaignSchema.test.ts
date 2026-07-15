import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloneCampaignPack, validateCampaignPack } from "./campaignSchema";
import { tutorialCampaignPack } from "./tutorialPack";

describe("campaign pack schema", () => {
  it("validates the 白蘋渡 tutorial pack and its three play modes", () => {
    assert.deepEqual(validateCampaignPack(tutorialCampaignPack), []);
    assert.deepEqual(
      tutorialCampaignPack.scenes.map((scene) => scene.mode),
      ["SCENE_FREE", "SCENE_STRUCTURED", "COMBAT"],
    );
  });

  it("rejects missing scene links without mutating the authored pack", () => {
    const broken = cloneCampaignPack(tutorialCampaignPack);
    broken.scenes[0].nextSceneIds = ["missing-scene"];
    const issues = validateCampaignPack(broken);
    assert.equal(issues.some((issue) => issue.severity === "error" && /不存在/.test(issue.message)), true);
    assert.equal(tutorialCampaignPack.scenes[0].nextSceneIds.includes("missing-scene"), false);
  });
});
