import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  configureCampaignParty,
  evaluateCampaignCombatConclusion,
  initializeCampaignState,
  projectCampaignScene,
  resolveCampaignSceneAction,
  settleCampaignCombat,
  transitionToCampaignScene,
} from "./campaignRuntime";
import { tutorialCampaignPack } from "./tutorialPack";
import { standardCampaignPack } from "./standardCampaignPack";
import { createSeedState } from "../seed";
import type { SceneActionType } from "../../combat/types";
import { advanceTurn, confirmInitiative, passMainAction, prepareCombatRound } from "../../combat/combatEngine";

function act(state: ReturnType<typeof createSeedState>, targetId: string, actionType: SceneActionType, index: number) {
  return resolveCampaignSceneAction(state, standardCampaignPack, {
    id: `normal-action-${index}`,
    actorId: state.campaign.partyActorIds[0] ?? "pc-shen-qing",
    targetId,
    actionType,
    sourceId: `normal-usage-${actionType}`,
    audience: "all",
    createdAt: 1_000 + index,
  }, 1_000 + index);
}

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

  it("runs a normal story from evidence through a peaceful authored ending", () => {
    let state = initializeCampaignState(createSeedState(), standardCampaignPack, { playerActorId: "pc-tang-he", now: 100 });
    assert.equal(state.campaign.packId, standardCampaignPack.id);
    assert.deepEqual(state.campaign.partyActorIds, ["pc-tang-he"]);
    assert.deepEqual(state.campaign.activeActorIds, ["pc-tang-he"]);
    assert.equal(state.scene.id, "msl-yanhui-inn");

    state = act(state, "msl-gate-permits", "observe", 1);
    state = act(state, "msl-broken-cart", "investigate", 2);
    assert.equal(state.scene.elements.find((element) => element.id === "msl-seal-scrap")?.public, true);
    assert.equal(state.campaign.pendingSceneId, "msl-reed-road");

    const rolledFace = 5;
    state.dice = state.dice.map((die) => die.ownerId === "pc-tang-he" ? { ...die, zone: "QI_SEA", value: rolledFace } : die);
    state = transitionToCampaignScene(state, standardCampaignPack, "msl-reed-road", ["pc-tang-he", "pc-wei", "enemy-porter"]);
    assert.equal(state.runtime.mode, "SCENE_STRUCTURED");
    assert.deepEqual(state.campaign.activeActorIds, ["pc-tang-he", "pc-wei", "enemy-porter"]);
    assert.equal(state.dice.find((die) => die.ownerId === "pc-tang-he")?.value, rolledFace);

    state = act(state, "msl-witness-lin", "use-item", 3);
    state = act(state, "msl-broken-bridge", "move", 4);
    state = act(state, "msl-mist-bells", "observe", 5);
    assert.equal(state.campaign.pendingSceneId, "msl-salt-yard-parley");

    state = transitionToCampaignScene(state, standardCampaignPack, "msl-salt-yard-parley");
    state = act(state, "msl-salt-ledger", "investigate", 6);
    state = act(state, "msl-household-roll", "investigate", 7);
    state = act(state, "msl-deputy-zhou", "negotiate", 8);
    state = act(state, "msl-deputy-zhou", "negotiate", 9);
    state = act(state, "msl-deputy-zhou", "negotiate", 10);
    assert.equal(state.campaign.flags["msl-resolution"], "joint-seal");
    assert.equal(state.campaign.pendingSceneId, "msl-county-ledger");

    state = transitionToCampaignScene(state, standardCampaignPack, "msl-county-ledger");
    state = act(state, "msl-final-clerk", "negotiate", 11);
    assert.equal(state.scene.completed, true);
    assert.equal(state.campaign.endingId, "msl-joint-seal");
    assert.ok(state.campaign.completedSceneIds.includes("msl-county-ledger"));
    assert.ok(state.scene.ending?.includes("三方"));
  });

  it("substitutes a selected party into combat distances and settlement", () => {
    let state = initializeCampaignState(createSeedState(), standardCampaignPack, { playerActorId: "pc-ye-wen", now: 200 });
    state = configureCampaignParty(state, ["pc-ye-wen", "pc-tang-he"], 201);
    state = transitionToCampaignScene(state, standardCampaignPack, "msl-salt-yard-combat");
    assert.deepEqual(state.campaign.partyActorIds, ["pc-ye-wen", "pc-tang-he"]);
    assert.ok(state.campaign.activeActorIds.includes("pc-ye-wen"));
    assert.ok(state.campaign.activeActorIds.includes("pc-wei"));
    assert.equal(state.campaign.activeActorIds.includes("pc-shen-qing"), false);
    assert.equal(state.distances.some((relation) => relation.fromActorId === "pc-ye-wen" && relation.toActorId === "enemy-short-blade"), true);

    state.encounterMode = "combat";
    state.runtime = { ...state.runtime, mode: "COMBAT", combat: { id: "test-combat", sceneId: state.scene.id, round: 1, phase: "declare", activeActorId: "pc-ye-wen", initiativeOrder: state.campaign.activeActorIds, actedActorIds: [], paused: false, startedAt: 201 } };
    state.actors = state.actors.map((actor) => actor.side === "enemy" && state.campaign.activeActorIds.includes(actor.id) ? { ...actor, hp: 0 } : actor);
    assert.equal(evaluateCampaignCombatConclusion(state, standardCampaignPack), "victory");
    const settled = settleCampaignCombat(state, standardCampaignPack, "victory", "账册已受控", 202);
    assert.equal(settled.campaign.pendingSceneId, "msl-county-ledger");
    assert.equal(settled.scene.completed, true);
  });

  it("keeps every normal quick-start card aligned with the executable actor registry", () => {
    const seed = createSeedState();
    for (const quickStart of standardCampaignPack.quickStartCharacters ?? []) {
      const actor = seed.actors.find((entry) => entry.id === quickStart.actorId);
      assert.ok(actor, `missing quick-start actor ${quickStart.actorId}`);
      const executableIds = new Set([...(actor?.moves ?? []), ...(actor?.quickActions ?? [])].map((entry) => entry.id));
      assert.deepEqual(quickStart.runtimeMoveIds.filter((id) => !executableIds.has(id)), []);
      assert.ok(seed.dice.filter((die) => die.ownerId === quickStart.actorId).length >= 2);
    }
  });

  it("layers normal-story intent onto reusable enemies without leaking tutorial objectives", () => {
    const state = initializeCampaignState(createSeedState(), standardCampaignPack, { playerActorId: "pc-tang-he", now: 250 });
    const porter = state.actors.find((actor) => actor.id === "enemy-porter");
    const guard = state.actors.find((actor) => actor.id === "enemy-short-blade");
    assert.match(porter?.hiddenGoal ?? "", /真账/);
    assert.match(porter?.aiProfile?.objective ?? "", /水门/);
    assert.equal((porter?.hiddenGoal ?? "").includes("药匣"), false);
    assert.equal((guard?.behaviorHint ?? "").includes("接应船"), false);
  });

  it("never appends inactive registry actors while advancing an authored combat", () => {
    let state = initializeCampaignState(createSeedState(), standardCampaignPack, { playerActorId: "pc-tang-he", now: 300 });
    state = transitionToCampaignScene(state, standardCampaignPack, "msl-salt-yard-combat");
    state.dice = state.dice.map((die) => state.campaign.activeActorIds.includes(die.ownerId) ? { ...die, zone: "QI_SEA", value: 3 } : die);
    state = confirmInitiative(prepareCombatRound(state));
    const active = new Set(state.campaign.activeActorIds);
    assert.ok(state.initiativeOrder.every((id) => active.has(id)));
    for (let step = 0; step < state.campaign.activeActorIds.length; step += 1) {
      state = passMainAction(state, state.activeActorId);
      state = advanceTurn(state);
      assert.ok(state.initiativeOrder.every((id) => active.has(id)));
    }
    assert.equal(state.round, 2);
  });
});
