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
  state = { ...state, round, activeActorId: PLAYER_ID };
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
  const state = { ...enterScene(createSeedState(), fixedRoll), activeActorId: ENEMY_ID };
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
  it("never asks a player to intercept or react to their own self-targeted declaration", () => {
    let state = enterScene(createSeedState(), fixedRoll);
    const actor = state.actors.find((entry) => entry.id === PLAYER_ID)!;
    const move = actor.moves.find((entry) => entry.id === "WG001") ?? actor.moves[0];
    const seaDice = state.dice.filter((die) => die.ownerId === actor.id && die.zone === "QI_SEA").slice(0, 2);
    state = {
      ...state,
      phase: "intercept_window",
      activeActorId: actor.id,
      pendingAction: {
        actorId: actor.id,
        targetId: actor.id,
        moveId: move.id,
        diceIds: seaDice.map((die) => die.id),
        yinSlotDiceIds: seaDice.filter((die) => die.nature !== "yang").map((die) => die.id),
        yangSlotDiceIds: seaDice.filter((die) => die.nature === "yang").map((die) => die.id),
      },
    };

    const intercept = advanceAutoDm(state, PLAYER_ID);
    assert.equal(intercept.decision, "skip_intercept");
    assert.notEqual(intercept.decision, "waiting_player");
    if (intercept.state.phase === "react_window") {
      const react = advanceAutoDm(intercept.state, PLAYER_ID);
      assert.equal(react.decision, "skip_react");
      assert.notEqual(react.decision, "waiting_player");
    }
  });
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

    const nextActor = advanceAutoDm(outcome.state, PLAYER_ID);
    assert.equal(nextActor.decision, "end_round");
    assert.equal(nextActor.state.phase, "scene");
    assert.equal(nextActor.state.round, 1);
    assert.notEqual(nextActor.state.activeActorId, PLAYER_ID);
    assert.deepEqual(nextActor.state.actedActorIds, [PLAYER_ID]);

    const automaticTurn = advanceAutoDm(nextActor.state, PLAYER_ID);
    assert.equal(automaticTurn.decision, "enemy_declare");
    assert.equal(automaticTurn.state.phase, "intercept_window");
    assert.ok(automaticTurn.state.pendingAction);

    // The porter's objective action is a quick scene entry with no response
    // attachment; auto-DM must not create a fake player prompt for it.
    const formedObjective = advanceAutoDm(automaticTurn.state, PLAYER_ID);
    assert.equal(formedObjective.decision, "skip_intercept");
    assert.equal(formedObjective.state.phase, "react_window");
    const readyForOutcome = advanceAutoDm(formedObjective.state, PLAYER_ID);
    assert.equal(readyForOutcome.decision, "skip_react");
    assert.equal(readyForOutcome.state.phase, "outcome");
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

  it("pauses for every authored player response window", () => {
    const interceptWindow = enemyDeclaration();
    const waitingIntercept = advanceAutoDm(interceptWindow, PLAYER_ID);

    assert.equal(waitingIntercept.decision, "waiting_player");
    assert.strictEqual(waitingIntercept.state, interceptWindow);
    assert.equal(waitingIntercept.state.phase, "intercept_window");

    const reactWindow = formMove(interceptWindow);
    const authoredReactWindow: CombatState = {
      ...reactWindow,
      actors: reactWindow.actors.map((actor) => actor.id === ENEMY_ID
        ? { ...actor, moves: actor.moves.map((move) => move.id === "WG002" ? { ...move, hasReact: true } : move) }
        : actor),
    };
    const waitingReact = advanceAutoDm(authoredReactWindow, PLAYER_ID);

    assert.equal(waitingReact.decision, "waiting_player");
    assert.strictEqual(waitingReact.state, authoredReactWindow);
    assert.equal(waitingReact.state.phase, "react_window");
    assert.equal(
      waitingReact.state.actors.find((actor) => actor.id === PLAYER_ID)?.responseQuotaUsed,
      0,
    );
  });

  it("does not pause on a player response window after the response quota is spent", () => {
    const interceptWindow = enemyDeclaration();
    const exhausted: CombatState = {
      ...interceptWindow,
      actors: interceptWindow.actors.map((actor) => actor.id === PLAYER_ID
        ? { ...actor, responseQuotaUsed: actor.maxResponseQuota }
        : actor),
    };

    const result = advanceAutoDm(exhausted, PLAYER_ID);

    assert.equal(result.decision, "skip_intercept");
    assert.equal(result.state.phase, "react_window");
    assert.match(result.message, /没有合法截击或响应额度/);
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
