import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSeedState } from "../../data/seed";
import { confirmInitiative, enterScene } from "../../combat/combatEngine";
import { confirmCombatOrder, startCombatFromScene } from "../combat/combatController";
import { changeSceneMode, closeCombatToScene, startNewScene } from "./sceneController";

const fixedRoll = (sides: number) => Math.min(4, sides);

function qiSnapshot(state: ReturnType<typeof createSeedState>) {
  return state.dice.map((die) => ({ id: die.id, value: die.value, zone: die.zone }));
}

describe("scene and combat controllers", () => {
  it("keeps the legacy scene-roll confirmation on the structured scene controller", () => {
    const rolled = enterScene(createSeedState(), fixedRoll);
    const confirmed = confirmInitiative(rolled);
    assert.equal(confirmed.runtime.mode, "SCENE_STRUCTURED");
    assert.equal(confirmed.runtime.combat, undefined);
    assert.deepEqual(confirmed.runtime.scene.sequence?.initiativeOrder, confirmed.initiativeOrder);
  });

  it("keeps free scene unqueued and changes to structured scene without reroll", () => {
    const free = startNewScene(createSeedState(), "SCENE_FREE", fixedRoll);
    assert.equal(free.runtime.mode, "SCENE_FREE");
    assert.deepEqual(free.initiativeOrder, []);
    const faces = qiSnapshot(free);
    const structured = changeSceneMode(free, "SCENE_STRUCTURED", ["pc-shen-qing", "enemy-short-blade"]);
    assert.equal(structured.runtime.mode, "SCENE_STRUCTURED");
    assert.deepEqual(structured.initiativeOrder, ["pc-shen-qing", "enemy-short-blade"]);
    assert.deepEqual(qiSnapshot(structured), faces);
  });

  it("starts combat at round one while preserving scene qi and returns without recovery", () => {
    const free = startNewScene(createSeedState(), "SCENE_FREE", fixedRoll);
    const sceneFaces = qiSnapshot(free);
    const prepared = startCombatFromScene({ ...free, round: 6 });
    assert.equal(prepared.runtime.mode, "COMBAT");
    assert.equal(prepared.round, 1);
    assert.equal(prepared.runtime.combat?.round, 1);
    assert.deepEqual(qiSnapshot(prepared), sceneFaces);
    const combat = confirmCombatOrder(prepared);
    assert.ok(combat.runtime.combat?.initiativeOrder.length);
    const combatFaces = qiSnapshot(combat);
    const scene = closeCombatToScene(combat, "对手退走");
    assert.equal(scene.runtime.mode, "SCENE_FREE");
    assert.equal(scene.runtime.combat, undefined);
    assert.deepEqual(qiSnapshot(scene), combatFaces);
  });
});
