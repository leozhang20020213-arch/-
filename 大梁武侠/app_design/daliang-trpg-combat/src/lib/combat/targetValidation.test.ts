import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSeedState } from "../../data/seed";
import {
  deriveTargetState,
  isDistanceValidForMove,
} from "./targetValidation";

describe("short-range target validation", () => {
  it("recognises 短距 in free-form move range text", () => {
    assert.deepEqual(
      isDistanceValidForMove("短距", "短距人物目标；可用暗器"),
      { valid: true },
    );
  });

  it("treats 近身 and 短距 as the same close-range validation bucket", () => {
    assert.equal(isDistanceValidForMove("近身", "短距人物目标").valid, true);
    assert.equal(isDistanceValidForMove("短距", "近身人物目标").valid, true);
  });

  it("rejects a non-close target and preserves 短距 in the reason", () => {
    const result = isDistanceValidForMove("中距", "短距人物目标");
    assert.equal(result.valid, false);
    assert.match(result.reason ?? "", /当前中距/);
    assert.match(result.reason ?? "", /招式需要短距/);
  });
});

describe("target state source actor", () => {
  it("can validate an explicit source actor for multi-target stage lines", () => {
    const state = createSeedState();
    const sourceActorId = "pc-wei";
    const targetActorId = "enemy-porter";
    const move = {
      ...state.actors[0].moves[0],
      targetRange: "近身人物目标",
    };

    // 沈青 → 黑衣脚夫 is 中距 in the seed, while 魏无咎 → 黑衣脚夫 is 近身.
    assert.equal(deriveTargetState(state, targetActorId, move).isRangeValid, false);
    assert.equal(
      deriveTargetState(state, targetActorId, move, sourceActorId).isRangeValid,
      true,
    );
  });

  it("retains the exact 短距 band for visible target-line labels", () => {
    const state = createSeedState();
    const targetState = deriveTargetState(
      state,
      "enemy-porter",
      undefined,
      "enemy-short-blade",
    );

    assert.equal(targetState.distanceBand, "close");
    assert.equal(targetState.actualDistanceBand, "短距");
  });
});
