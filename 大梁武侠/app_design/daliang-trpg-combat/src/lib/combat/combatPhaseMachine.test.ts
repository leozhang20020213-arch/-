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
  it("maps intercept_window → 截击窗口", () => {
    assert.equal(toDisplayPhase("intercept_window"), "截击窗口");
  });
  it("maps react_window → 应招窗口", () => {
    assert.equal(toDisplayPhase("react_window"), "应招窗口");
  });
  it("maps outcome → 落果", () => {
    assert.equal(toDisplayPhase("outcome"), "落果");
  });
  it("maps the legacy round_end sentinel to the end of one actor's action", () => {
    assert.equal(toDisplayPhase("round_end"), "出手结束");
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

  it("shows response context but disables it for a non-target player", () => {
    const actions = getAvailablePhaseActions({
      ...base,
      phase: "intercept_window",
      hasPendingAction: true,
      isDM: false,
    });
    const visible = actions.filter((a) => a.visibleTo === "both" || a.visibleTo === "player");
    const intercept = visible.find((a) => a.type === "DECLARE_INTERCEPT");
    assert.ok(intercept);
    assert.equal(intercept.enabled, false);
  });

  it("lets the targeted player handle the response window", () => {
    const actions = getAvailablePhaseActions({
      ...base,
      phase: "intercept_window",
      hasPendingAction: true,
      canCurrentUserRespond: true,
    });
    const intercept = actions.find((a) => a.type === "DECLARE_INTERCEPT");
    const earlyReact = actions.find((a) => a.type === "DECLARE_RESPONSE");
    assert.equal(intercept?.enabled, true);
    assert.equal(earlyReact, undefined);
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

  it("keeps outcome read-only for players", () => {
    const actions = getAvailablePhaseActions({
      ...base,
      phase: "outcome",
      hasPendingAction: true,
    });
    const playerVisible = actions.filter((a) => a.visibleTo === "both" || a.visibleTo === "player");
    assert.equal(playerVisible.some((a) => a.type === "RESOLVE_RESULT"), false);
  });

  it("shows the enabled outcome action to DM when an action is pending", () => {
    const actions = getAvailablePhaseActions({
      ...base,
      phase: "outcome",
      hasPendingAction: true,
      isDM: true,
    });
    const resolve = actions.find((a) => a.type === "RESOLVE_RESULT");
    assert.ok(resolve);
    assert.equal(resolve.visibleTo, "dm");
    assert.equal(resolve.enabled, true);
  });

  it("shows only NEXT_ROUND to DM at round end", () => {
    const dmActions = getAvailablePhaseActions({ ...base, phase: "round_end", isDM: true });
    assert.deepEqual(dmActions.map((a) => a.type), ["NEXT_ROUND"]);
    assert.equal(dmActions[0].enabled, true);

    const playerActions = getAvailablePhaseActions({ ...base, phase: "round_end" });
    const playerVisible = playerActions.filter((a) => a.visibleTo === "both" || a.visibleTo === "player");
    assert.equal(playerVisible.length, 0);
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

  it("allows outcome resolution only with a pending action", () => {
    assert.equal(canTransition("outcome", "RESOLVE_RESULT", true), true);
    assert.equal(canTransition("outcome", "RESOLVE_RESULT", false), false);
    assert.equal(canTransition("react_window", "RESOLVE_RESULT", true), false);
  });

  it("allows an应招 only from the react window", () => {
    assert.equal(canTransition("intercept_window", "DECLARE_RESPONSE", true), false);
    assert.equal(canTransition("react_window", "DECLARE_RESPONSE", true), true);
  });

  it("rejects NEXT_ROUND from declare", () => {
    assert.equal(canTransition("declare", "NEXT_ROUND", false), false);
  });
});
