import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  declareAction,
  enterScene,
  formMove,
} from "../../combat/combatEngine";
import type { CombatState } from "../../combat/types";
import { createSeedState } from "../../data/seed";
import { advanceAutoDm } from "./autoDm";

const PLAYER_ID = "pc-shen-qing";
const ENEMY_ID = "enemy-short-blade";
const fixedRoll = () => 4;

function playerDeclaration(round = 1): CombatState {
  let state = enterScene(createSeedState(), fixedRoll);
  state = { ...state, round };
  return declareAction(
    state,
    PLAYER_ID,
    ENEMY_ID,
    "WG001",
    ["pc-d1", "pc-d2"],
    {
      yinSlotDiceIds: ["pc-d1"],
      yangSlotDiceIds: ["pc-d2"],
    },
  );
}

function enemyDeclaration(): CombatState {
  const state = enterScene(createSeedState(), fixedRoll);
  return declareAction(
    state,
    ENEMY_ID,
    PLAYER_ID,
    "WG002",
    ["sb-d1", "sb-d2", "sb-d3"],
    {
      yinSlotDiceIds: ["sb-d1"],
      yangSlotDiceIds: ["sb-d2", "sb-d3"],
    },
  );
}

describe("test auto DM", () => {
  it("advances the first-round main line one step at a time", () => {
    const declared = playerDeclaration();

    const formed = advanceAutoDm(declared, PLAYER_ID);
    assert.equal(formed.decision, "skip_intercept");
    assert.equal(formed.state.phase, "react_window");
    assert.equal(formed.state.pendingAction?.formed, true);
    assert.equal(formed.state.round, 1);

    const reacted = advanceAutoDm(formed.state, PLAYER_ID);
    assert.ok(
      reacted.decision === "react" || reacted.decision === "skip_react",
      `unexpected reaction decision: ${reacted.decision}`,
    );
    assert.equal(reacted.state.phase, "outcome");
    assert.ok(reacted.state.pendingAction, "outcome must retain the formed action");
    assert.equal(reacted.state.round, 1);

    const outcome = advanceAutoDm(reacted.state, PLAYER_ID);
    assert.equal(outcome.decision, "apply_outcome");
    assert.equal(outcome.state.phase, "round_end");
    assert.equal(outcome.state.pendingAction, undefined);
    assert.equal(outcome.state.round, 1);

    const nextRound = advanceAutoDm(outcome.state, PLAYER_ID);
    assert.equal(nextRound.decision, "end_round");
    assert.equal(nextRound.state.phase, "declare");
    assert.equal(nextRound.state.round, 2);
    assert.notEqual(nextRound.state.activeActorId, PLAYER_ID);

    const enemyTurn = advanceAutoDm(nextRound.state, PLAYER_ID);
    assert.equal(enemyTurn.decision, "enemy_declare");
    assert.equal(enemyTurn.state.phase, "intercept_window");
    assert.equal(enemyTurn.state.pendingAction?.targetId, PLAYER_ID);

    const waiting = advanceAutoDm(enemyTurn.state, PLAYER_ID);
    assert.equal(waiting.decision, "waiting_player");
    assert.strictEqual(waiting.state, enemyTurn.state);
  });

  it("uses a legal enemy intercept after the default first-round grace period", () => {
    const declared = playerDeclaration(2);
    const result = advanceAutoDm(declared, PLAYER_ID);

    assert.equal(result.decision, "intercept");
    assert.equal(result.state.phase, "round_end");
    assert.equal(result.state.pendingAction, undefined);
    assert.ok(
      result.state.dice.some(
        (die) => die.ownerId === ENEMY_ID && die.zone === "QI_REST",
      ),
    );
    assert.equal(
      result.state.actors.find((actor) => actor.id === ENEMY_ID)?.responseQuotaUsed,
      1,
    );
  });

  it("falls back safely when the enemy has no usable response dice", () => {
    const declared = playerDeclaration(2);
    const noEnemyDice: CombatState = {
      ...declared,
      dice: declared.dice.map((die) =>
        die.ownerId === ENEMY_ID ? { ...die, zone: "QI_REST" as const } : die,
      ),
    };

    const formed = advanceAutoDm(noEnemyDice, PLAYER_ID);
    assert.equal(formed.decision, "skip_intercept");
    assert.equal(formed.state.phase, "react_window");

    const skipped = advanceAutoDm(formed.state, PLAYER_ID);
    assert.equal(skipped.decision, "skip_react");
    assert.equal(skipped.state.phase, "outcome");
  });

  it("never handles a response window on behalf of a player target", () => {
    const interceptWindow = enemyDeclaration();
    const waitingIntercept = advanceAutoDm(interceptWindow, PLAYER_ID);

    assert.equal(waitingIntercept.decision, "waiting_player");
    assert.strictEqual(waitingIntercept.state, interceptWindow);
    assert.equal(waitingIntercept.state.phase, "intercept_window");

    const reactWindow = formMove(interceptWindow);
    const waitingReact = advanceAutoDm(reactWindow, PLAYER_ID);

    assert.equal(waitingReact.decision, "waiting_player");
    assert.strictEqual(waitingReact.state, reactWindow);
    assert.equal(waitingReact.state.phase, "react_window");
    assert.equal(
      waitingReact.state.actors.find((actor) => actor.id === PLAYER_ID)?.responseQuotaUsed,
      0,
    );
  });

  it("does not throw or jump phases for stale and repeated calls", () => {
    const declared = playerDeclaration();
    const formed = advanceAutoDm(declared, PLAYER_ID);
    assert.equal(formed.state.phase, "react_window");

    const staleOutcome: CombatState = {
      ...formed.state,
      phase: "outcome",
      pendingAction: undefined,
    };
    const safe = advanceAutoDm(staleOutcome, PLAYER_ID);
    assert.equal(safe.decision, "idle");
    assert.strictEqual(safe.state, staleOutcome);

    const setup = createSeedState();
    const idle = advanceAutoDm(setup, PLAYER_ID);
    assert.equal(idle.decision, "idle");
    assert.strictEqual(idle.state, setup);

    const missingPlayer = advanceAutoDm(
      { ...staleOutcome, phase: "round_end" },
      "missing-player",
    );
    assert.equal(missingPlayer.decision, "idle");
    assert.equal(missingPlayer.state.phase, "round_end");
  });
});
