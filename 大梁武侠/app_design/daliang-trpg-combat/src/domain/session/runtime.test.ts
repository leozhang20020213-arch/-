import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  beginCombatEncounter,
  canSpendResponseBudget,
  confirmCombatInitiative,
  createResponseBudget,
  createRuntimeSession,
  finishCombatEncounter,
  normalizeRuntimeSession,
  spendResponseBudget,
} from "./runtime";

describe("dual-mode runtime session", () => {
  it("defaults a newly authored scene to free flow", () => {
    const runtime = createRuntimeSession("scene-tutorial-01");
    assert.equal(runtime.mode, "SCENE_FREE");
    assert.equal(runtime.scene.sequence, undefined);
    assert.equal(runtime.combat, undefined);
  });

  it("creates an independent combat encounter at round one", () => {
    const scene = createRuntimeSession("scene-tutorial-01", "SCENE_STRUCTURED");
    const withSceneRound = {
      ...scene,
      scene: {
        ...scene.scene,
        sequence: {
          round: 4,
          activeActorId: "pc-a",
          initiativeOrder: ["pc-a", "npc-a"],
          actedActorIds: ["pc-a"],
          paused: false,
        },
      },
    };
    const combat = beginCombatEncounter(withSceneRound, "encounter-01", 100);
    assert.equal(combat.mode, "COMBAT");
    assert.equal(combat.combat?.round, 1);
    assert.deepEqual(combat.combat?.initiativeOrder, []);
    assert.equal(combat.scene.sequence?.round, 4);
    const ordered = confirmCombatInitiative(combat, ["npc-a", "pc-a"]);
    assert.deepEqual(ordered.combat?.initiativeOrder, ["npc-a", "pc-a"]);
    assert.equal(ordered.combat?.activeActorId, "npc-a");
  });

  it("closes combat back into the original scene controller", () => {
    const runtime = beginCombatEncounter(
      createRuntimeSession("scene-tutorial-01", "SCENE_STRUCTURED"),
      "encounter-01",
      100,
    );
    const closed = finishCombatEncounter(runtime, "对手退走，药匣仍在场景中。");
    assert.equal(closed.mode, "SCENE_STRUCTURED");
    assert.equal(closed.combat, undefined);
    assert.equal(closed.scene.lastCombatSummary, "对手退走，药匣仍在场景中。");
  });

  it("migrates an old scene save to structured mode without inventing combat", () => {
    const migrated = normalizeRuntimeSession(undefined, {
      sceneId: "legacy-scene",
      encounterMode: "scene",
      round: 3,
      phase: "declare",
      activeActorId: "pc-a",
      initiativeOrder: ["pc-a", "npc-a"],
      actedActorIds: ["pc-a"],
    });
    assert.equal(migrated.mode, "SCENE_STRUCTURED");
    assert.equal(migrated.scene.sequence?.round, 3);
    assert.deepEqual(migrated.scene.sequence?.actedActorIds, ["pc-a"]);
  });
});

describe("split response budgets", () => {
  it("spends proactive intervention without consuming target self-defense", () => {
    const initial = createResponseBudget(1, 1);
    const afterIntercept = spendResponseBudget(initial, "proactive");
    assert.equal(canSpendResponseBudget(afterIntercept, "proactive"), false);
    assert.equal(canSpendResponseBudget(afterIntercept, "self_defense"), true);
    const afterReact = spendResponseBudget(afterIntercept, "self_defense");
    assert.equal(canSpendResponseBudget(afterReact, "self_defense"), false);
  });
});
