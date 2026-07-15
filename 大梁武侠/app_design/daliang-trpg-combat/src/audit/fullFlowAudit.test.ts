import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  confirmInitiative,
  formMove,
  passMainAction,
  prepareCombatRound,
  skipReact,
} from "../combat/combatEngine";
import type { AppSession, CombatState } from "../combat/types";
import { initializeCampaignState, resolveCampaignSceneAction, transitionToCampaignScene } from "../data/campaign/campaignRuntime";
import { standardCampaignPack } from "../data/campaign/standardCampaignPack";
import { tutorialCampaignPack } from "../data/campaign/tutorialPack";
import { createSeedState } from "../data/seed";
import { advanceAutoDm } from "../lib/combat/autoDm";
import { evaluateRoomReadiness } from "../lib/room/roomRules";
import { resolveSceneAction } from "../lib/scene/autoSceneDm";

function rolledState(seed: number): CombatState {
  const state = createSeedState();
  state.dice = state.dice.map((die, index) => ({
    ...die,
    zone: "QI_SEA",
    value: 1 + ((seed + index * 3) % die.sides),
  }));
  return state;
}

describe("large audit simulations", () => {
  it("runs twelve normal-story outings across four protagonists and three endings", () => {
    const protagonists = ["pc-shen-qing", "pc-tang-he", "pc-xu-zhou", "pc-ye-wen"];
    const endingActions = [
      ["msl-final-ledger", "take"],
      ["msl-final-clerk", "negotiate"],
      ["msl-final-households", "use-item"],
    ] as const;
    for (let run = 0; run < 12; run += 1) {
      const actorId = protagonists[run % protagonists.length];
      let state = initializeCampaignState(rolledState(run), standardCampaignPack, { playerActorId: actorId, now: 5_000 + run });
      state.dice = state.dice.map((die, index) => die.ownerId === actorId ? { ...die, zone: "QI_SEA", value: 1 + ((run + index) % die.sides) } : die);
      const faces = new Map(state.dice.filter((die) => die.ownerId === actorId).map((die) => [die.id, die.value]));
      let action = 0;
      const doAction = (targetId: string, actionType: "observe" | "investigate" | "move" | "use-item" | "negotiate" | "take") => {
        action += 1;
        state = resolveCampaignSceneAction(state, standardCampaignPack, { id: `audit-normal-${run}-${action}`, actorId, targetId, actionType, audience: "all", createdAt: 6_000 + run * 20 + action });
      };
      doAction("msl-gate-permits", "observe");
      doAction("msl-broken-cart", "investigate");
      state = transitionToCampaignScene(state, standardCampaignPack, "msl-reed-road", [actorId, "pc-wei", "enemy-porter"]);
      doAction("msl-witness-lin", "use-item");
      doAction("msl-broken-bridge", "move");
      doAction("msl-mist-bells", "observe");
      state = transitionToCampaignScene(state, standardCampaignPack, "msl-salt-yard-parley");
      doAction("msl-salt-ledger", "investigate");
      doAction("msl-household-roll", "investigate");
      doAction("msl-deputy-zhou", "negotiate");
      doAction("msl-deputy-zhou", "negotiate");
      doAction("msl-deputy-zhou", "negotiate");
      state = transitionToCampaignScene(state, standardCampaignPack, "msl-county-ledger");
      doAction(endingActions[run % endingActions.length][0], endingActions[run % endingActions.length][1]);
      assert.equal(state.scene.completed, true, `run ${run}: normal story did not settle`);
      assert.ok(state.campaign.endingId, `run ${run}: missing ending id`);
      for (const [dieId, face] of faces) assert.equal(state.dice.find((die) => die.id === dieId)?.value, face, `run ${run}: ${dieId} rerolled`);
    }
  });

  it("runs the complete authored scene path twenty times without rerolling or exceeding tracks", () => {
    for (let run = 0; run < 20; run += 1) {
      let state = rolledState(run);
      const faces = new Map(state.dice.map((die) => [die.id, die.value]));
      const request = (id: string, actionType: "observe" | "investigate" | "take" | "move", targetId: string) => ({
        id: `${id}-${run}`,
        actorId: "pc-shen-qing",
        actionType,
        targetId,
        createdAt: run * 100 + id.length,
      });
      state = resolveSceneAction(state, request("observe", "observe", "warehouse-door"));
      state = resolveSceneAction(state, request("investigate", "investigate", "warehouse-door"));
      state = resolveSceneAction(state, request("take", "take", "blood-seal"));
      assert.equal(state.tracks.find((track) => track.id === "track-clue")?.value, 4);
      state = transitionToCampaignScene(state, tutorialCampaignPack, "pier-pursuit", ["pc-shen-qing", "pc-wei", "enemy-porter"]);
      for (let step = 0; step < 3; step += 1) {
        state = resolveSceneAction(state, request(`pursuit-${step}`, "move", "pursuit-runner"));
      }
      assert.equal(state.scene.combatUnlocked, true);
      state = transitionToCampaignScene(state, tutorialCampaignPack, "old-boathouse-standoff");
      state = resolveSceneAction(state, request("standoff", "take", "medicine-case"));
      assert.equal(state.scene.combatUnlocked, true);
      for (const die of state.dice) assert.equal(die.value, faces.get(die.id), `run ${run}: ${die.id} changed during scene transition`);
      assert.ok(state.tracks.every((track) => track.value >= 0 && track.value <= track.max));
    }
  });

  it("runs thirty three-round combat loops with automatic actors and no repeated-state deadlock", () => {
    for (let run = 0; run < 30; run += 1) {
      let state = confirmInitiative(prepareCombatRound(rolledState(run)));
      let staleSteps = 0;
      let steps = 0;
      while (state.round < 3 && steps < 180) {
        const before = JSON.stringify([state.round, state.phase, state.activeActorId, state.actedActorIds, state.pendingAction, state.dice.map((die) => [die.id, die.zone])]);
        if ((state.phase === "scene" || state.phase === "declare") && state.activeActorId === "pc-shen-qing") {
          state = passMainAction(state, "pc-shen-qing");
        } else if (state.phase === "intercept_window" && state.pendingAction?.targetId === "pc-shen-qing") {
          state = formMove(state);
        } else if (state.phase === "react_window" && state.pendingAction?.targetId === "pc-shen-qing") {
          state = skipReact(state);
        } else {
          const advanced = advanceAutoDm(state, "pc-shen-qing", { interceptFromRound: 2 });
          state = advanced.state;
        }
        const after = JSON.stringify([state.round, state.phase, state.activeActorId, state.actedActorIds, state.pendingAction, state.dice.map((die) => [die.id, die.zone])]);
        staleSteps = before === after ? staleSteps + 1 : 0;
        assert.ok(staleSteps < 3, `run ${run}: automatic flow stalled at ${state.phase}/${state.activeActorId}`);
        steps += 1;
      }
      assert.ok(state.round >= 3, `run ${run}: only reached round ${state.round} in ${steps} steps`);
      assert.ok(steps < 180, `run ${run}: exceeded bounded automatic steps`);
    }
  });

  it("checks one hundred room-seat combinations without accepting conflict or unready seats", () => {
    type Seat = AppSession["seats"][number];
    for (let run = 0; run < 100; run += 1) {
      const duplicate = run % 4 === 0;
      const unready = run % 5 === 0;
      const seats: Seat[] = [
        { id: "seat-dm", label: "DM", playerName: "主持", ready: true, connectionStatus: "connected" },
        { id: "seat-1", label: "玩家1", playerName: "甲", actorId: "pc-shen-qing", ready: !unready, connectionStatus: "connected" },
        { id: "seat-2", label: "玩家2", playerName: "乙", actorId: duplicate ? "pc-shen-qing" : "pc-wei", ready: true, connectionStatus: "connected" },
      ];
      const result = evaluateRoomReadiness(seats);
      assert.equal(result.canStart, !duplicate && !unready);
      if (duplicate) assert.match(result.reason, /不能分配/);
      else if (unready) assert.match(result.reason, /未准备/);
    }
  });
});
