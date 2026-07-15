import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { projectCampaignScene, transitionToCampaignScene } from "./campaignRuntime";
import { tutorialCampaignPack } from "./tutorialPack";
import { createSeedState } from "../seed";

describe("campaign runtime projection", () => {
  it("uses the authored tutorial scene as the real opening runtime", () => {
    const projected = projectCampaignScene(tutorialCampaignPack, tutorialCampaignPack.startSceneId);
    assert.equal(projected.scene.id, "white-duckweed-ferry");
    assert.equal(projected.scene.location, "白蘋渡·西栈");
    assert.equal(projected.scene.elements.length, 8);
    assert.deepEqual(projected.tracks.map((track) => [track.id, track.max]), [
      ["track-clue", 4],
      ["track-patrol", 4],
    ]);
    assert.equal(projected.scene.elements.find((element) => element.id === "ferry-manifest")?.interactionIds.includes("use-item"), true);
  });

  it("never exposes hidden authored elements while projecting their identity", () => {
    const projected = projectCampaignScene(tutorialCampaignPack, tutorialCampaignPack.startSceneId);
    const hidden = projected.scene.elements.filter((element) => !element.public);
    assert.deepEqual(hidden.map((element) => element.id).sort(), ["old-boathouse-route", "porter-shadow"]);
  });

  it("moves into the structured pursuit without rerolling or relocating qi", () => {
    const state = createSeedState();
    state.dice[0] = { ...state.dice[0], zone: "QI_SEA", value: 5 };
    const next = transitionToCampaignScene(state, tutorialCampaignPack, "pier-pursuit", ["pc-shen-qing", "pc-wei"]);
    assert.equal(next.runtime.mode, "SCENE_STRUCTURED");
    assert.equal(next.scene.id, "pier-pursuit");
    assert.equal(next.dice[0]?.zone, "QI_SEA");
    assert.equal(next.dice[0]?.value, 5);
    assert.deepEqual(next.tracks.map((track) => [track.id, track.max]), [["pursuit-progress", 3], ["pursuit-risk", 3]]);
  });
});
