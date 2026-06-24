// ==========================================================================
// Combat Phase Machine Tests
// ==========================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  toDisplayPhase,
  getAvailablePhaseActions,
  getPhaseHint,
  canTransition,
} from "./combatPhaseMachine";

describe("toDisplayPhase", () => {
  it("maps setup → 准备", () => {
    assert.equal(toDisplayPhase("setup"), "准备");
  });
  it("maps declare → 宣言", () => {
    assert.equal(toDisplayPhase("declare"), "宣言");
  });
  it("maps intercept_window → 响应", () => {
    assert.equal(toDisplayPhase("intercept_window"), "响应");
  });
  it("maps react_window → 计算", () => {
    assert.equal(toDisplayPhase("react_window"), "计算");
  });
  it("maps outcome → 结算", () => {
    assert.equal(toDisplayPhase("outcome"), "结算");
  });
  it("maps round_end → 势变化", () => {
    assert.equal(toDisplayPhase("round_end"), "势变化");
  });
});

describe("getAvailablePhaseActions", () => {
  const base = {
    hasPendingAction: false,
    hasSelectedMove: false,
    hasSelectedTarget: false,
    hasSlottedDice: false,
    isDM: false,
    round: 1,
  };

  it("shows START_DECLARATION in setup", () => {
    const actions = getAvailablePhaseActions({ ...base, phase: "setup" });
    assert.ok(actions.some((a) => a.type === "START_DECLARATION"));
  });

  it("hides DM-only actions from player", () => {
    const actions = getAvailablePhaseActions({
      ...base,
      phase: "intercept_window",
      hasPendingAction: true,
      isDM: false,
    });
    const visible = actions.filter((a) => a.visibleTo === "both" || a.visibleTo === "player");
    assert.equal(visible.some((a) => a.type === "DECLARE_INTERCEPT"), false);
  });

  it("shows DM actions to DM", () => {
    const actions = getAvailablePhaseActions({
      ...base,
      phase: "intercept_window",
      hasPendingAction: true,
      isDM: true,
    });
    const visible = actions.filter((a) => a.visibleTo === "both" || a.visibleTo === "dm");
    assert.ok(visible.some((a) => a.type === "DECLARE_INTERCEPT"));
  });

  it("disables CONFIRM_DECLARATION when missing move", () => {
    const actions = getAvailablePhaseActions({ ...base, phase: "declare" });
    const confirm = actions.find((a) => a.type === "CONFIRM_DECLARATION");
    assert.ok(confirm);
    assert.equal(confirm.enabled, false);
  });

  it("enables RESOLVE_RESULT in outcome", () => {
    const actions = getAvailablePhaseActions({ ...base, phase: "outcome" });
    const resolve = actions.find((a) => a.type === "RESOLVE_RESULT");
    assert.ok(resolve);
    assert.equal(resolve.enabled, true);
  });
});

describe("getPhaseHint", () => {
  it("shows player-friendly hint for declare", () => {
    const hint = getPhaseHint("declare", false, false);
    assert.ok(hint.includes("选择招式"));
  });

  it("shows DM hint for declare with pending", () => {
    const hint = getPhaseHint("declare", true, true);
    assert.ok(hint.includes("截击") || hint.includes("响应"));
  });

  it("shows waiting hint for player in intercept_window", () => {
    const hint = getPhaseHint("intercept_window", false, false);
    assert.ok(hint.includes("等待"));
  });
});

describe("canTransition", () => {
  it("allows START_SCENE from setup", () => {
    assert.equal(canTransition("setup", "START_SCENE", false), true);
  });

  it("allows DECLARE_INTERCEPT from intercept_window with pending", () => {
    assert.equal(canTransition("intercept_window", "DECLARE_INTERCEPT", true), true);
  });

  it("rejects DECLARE_INTERCEPT without pending", () => {
    assert.equal(canTransition("intercept_window", "DECLARE_INTERCEPT", false), false);
  });

  it("allows NEXT_ROUND from round_end", () => {
    assert.equal(canTransition("round_end", "NEXT_ROUND", false), true);
  });

  it("rejects NEXT_ROUND from declare", () => {
    assert.equal(canTransition("declare", "NEXT_ROUND", false), false);
  });
});
