import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { CombatState, QiDie, StatusEffect } from "../../combat/types";
import { createSeedState } from "../../data/seed";
import {
  calculateInitiative,
  computeTurnOrder,
  deriveTurnState,
} from "./turnOrder";

function die(
  id: string,
  ownerId: string,
  zone: QiDie["zone"],
  value: number | null,
): QiDie {
  return {
    id,
    label: "d12",
    sourceId: "test-source",
    sourceName: "测试来源",
    nature: "raw",
    sides: 12,
    value,
    zone,
    ownerId,
  };
}

function withActorAttrs(
  state: CombatState,
  actorId: string,
  attrs: { 身势: number; 观照: number },
): CombatState {
  return {
    ...state,
    actors: state.actors.map((actor) => actor.id === actorId
      ? {
          ...actor,
          tableAttrs: { ...actor.tableAttrs, ...attrs },
          statuses: [],
          hiddenStatuses: [],
        }
      : actor),
  };
}

describe("initiative rule", () => {
  it("uses 身势 by default and only the highest currently usable qi die", () => {
    let state = createSeedState();
    const actorId = state.activeActorId;
    const otherId = state.actors.find((actor) => actor.id !== actorId)!.id;
    state = withActorAttrs(state, actorId, { 身势: 4, 观照: 99 });
    state = {
      ...state,
      dice: [
        die("sea-6", actorId, "QI_SEA", 6),
        die("temp-4", actorId, "TEMP_QI", 4),
        die("rest-12", actorId, "QI_REST", 12),
        die("lock-11", actorId, "QI_LOCK", 11),
        die("yin-10", actorId, "YIN_SLOT", 10),
        die("pool-with-value", actorId, "QI_POOL", 9),
        die("sea-unrolled", actorId, "QI_SEA", null),
        die("other-owner", otherId, "QI_SEA", 12),
      ],
    };

    assert.deepEqual(calculateInitiative(state, actorId), {
      attribute: "身势",
      attributeValue: 4,
      highestUsableQi: 6,
      statusModifier: 0,
      total: 10,
    });
  });

  it("uses DM-approved 观照 and applies an explicit status/scene modifier", () => {
    let state = createSeedState();
    const actorId = state.activeActorId;
    state = withActorAttrs(state, actorId, { 身势: 3, 观照: 8 });
    state = { ...state, dice: [die("sea-5", actorId, "QI_SEA", 5)] };

    assert.deepEqual(calculateInitiative(state, actorId, {
      approvedAttributeByActorId: { [actorId]: "观照" },
      statusModifierByActorId: { [actorId]: 2 },
    }), {
      attribute: "观照",
      attributeValue: 8,
      highestUsableQi: 5,
      statusModifier: 2,
      total: 15,
    });
  });

  it("derives the rulebook's -2 penalty from 3+ layers of 迟滞", () => {
    let state = createSeedState();
    const actorId = state.activeActorId;
    const sluggish: StatusEffect = {
      id: "test-sluggish",
      name: "迟滞",
      layers: 3,
      source: "测试",
      ownerId: actorId,
      public: true,
      effects: [],
      removalEntries: [],
    };
    state = withActorAttrs(state, actorId, { 身势: 7, 观照: 1 });
    state = {
      ...state,
      dice: [die("sea-4", actorId, "QI_SEA", 4)],
      actors: state.actors.map((actor) => actor.id === actorId
        ? { ...actor, statuses: [sluggish] }
        : actor),
    };

    assert.equal(calculateInitiative(state, actorId).statusModifier, -2);
    assert.equal(calculateInitiative(state, actorId).total, 9);
  });

  it("sorts by the complete calculated value and passes options through deriveTurnState", () => {
    let state = createSeedState();
    const first = state.actors[0];
    const second = state.actors[1];
    state = {
      ...state,
      actors: [
        { ...first, tableAttrs: { ...first.tableAttrs, 身势: 8, 观照: 1 }, statuses: [] },
        { ...second, tableAttrs: { ...second.tableAttrs, 身势: 3, 观照: 10 }, statuses: [] },
      ],
      dice: [
        die("first-sea", first.id, "QI_SEA", 1),
        die("second-sea", second.id, "QI_SEA", 2),
      ],
    };
    const options = {
      approvedAttributeByActorId: { [second.id]: "观照" as const },
    };

    assert.deepEqual(
      computeTurnOrder(state, new Set(), options).map((entry) => [entry.actorId, entry.initiative]),
      [[second.id, 12], [first.id, 9]],
    );
    assert.equal(deriveTurnState(state, new Set(), options).order[0].actorId, second.id);
  });
});

describe("response eligibility", () => {
  it("keeps an already-acted actor eligible while enforcing actor, hp, and quota gates", () => {
    const seed = createSeedState();
    const current = seed.actors[0];
    const alreadyActed = seed.actors[1];
    const dying = seed.actors[2];
    const exhausted = seed.actors[3];
    const state: CombatState = {
      ...seed,
      phase: "intercept_window",
      activeActorId: current.id,
      actors: [
        { ...current, hp: 1, responseQuotaUsed: 0, maxResponseQuota: 1 },
        { ...alreadyActed, hp: 1, responseQuotaUsed: 0, maxResponseQuota: 1 },
        { ...dying, hp: 0, responseQuotaUsed: 0, maxResponseQuota: 1 },
        { ...exhausted, hp: 1, responseQuotaUsed: 1, maxResponseQuota: 1 },
      ],
    };
    const entries = computeTurnOrder(state, new Set([alreadyActed.id]));
    const byId = new Map(entries.map((entry) => [entry.actorId, entry]));

    assert.equal(byId.get(alreadyActed.id)?.hasActed, true);
    assert.equal(byId.get(alreadyActed.id)?.canRespond, true);
    assert.equal(byId.get(current.id)?.canRespond, false);
    assert.equal(byId.get(dying.id)?.canRespond, false);
    assert.equal(byId.get(exhausted.id)?.canRespond, false);
  });
});
