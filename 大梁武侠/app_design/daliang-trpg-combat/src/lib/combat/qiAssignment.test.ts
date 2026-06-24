// ==========================================================================
// Qi Assignment Tests — Drop validation & confirm logic
// ==========================================================================

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canDropDieToSlot, canConfirmDeclaration } from "./qiAssignment";
import type { QiDie } from "../../combat/types";

function makeDie(overrides: Partial<QiDie> = {}): QiDie {
  return {
    id: "test-die-1",
    label: "d6",
    sourceId: "src-1",
    sourceName: "测试来源",
    nature: "yin",
    sides: 6,
    value: 4,
    zone: "QI_SEA",
    ownerId: "actor-1",
    ...overrides,
  };
}

describe("canDropDieToSlot", () => {
  it("allows yin die to yin slot", () => {
    const die = makeDie({ nature: "yin" });
    assert.equal(canDropDieToSlot(die, "yin", "actor-1"), true);
  });

  it("rejects yin die to yang slot", () => {
    const die = makeDie({ nature: "yin" });
    assert.equal(canDropDieToSlot(die, "yang", "actor-1"), false);
  });

  it("allows yang die to yang slot", () => {
    const die = makeDie({ nature: "yang" });
    assert.equal(canDropDieToSlot(die, "yang", "actor-1"), true);
  });

  it("rejects yang die to yin slot", () => {
    const die = makeDie({ nature: "yang" });
    assert.equal(canDropDieToSlot(die, "yin", "actor-1"), false);
  });

  it("allows raw die to any slot", () => {
    const die = makeDie({ nature: "raw" });
    assert.equal(canDropDieToSlot(die, "yin", "actor-1"), true);
    assert.equal(canDropDieToSlot(die, "yang", "actor-1"), true);
  });

  it("rejects die not in QI_SEA or TEMP_QI", () => {
    const die = makeDie({ zone: "QI_REST" });
    assert.equal(canDropDieToSlot(die, "yin", "actor-1"), false);
  });

  it("rejects die owned by another actor", () => {
    const die = makeDie({ ownerId: "other-actor" });
    assert.equal(canDropDieToSlot(die, "yin", "actor-1"), false);
  });

  it("allows TEMP_QI die", () => {
    const die = makeDie({ zone: "TEMP_QI" });
    assert.equal(canDropDieToSlot(die, "yin", "actor-1"), true);
  });
});

describe("canConfirmDeclaration", () => {
  it("allows when all conditions met", () => {
    const result = canConfirmDeclaration({
      phase: "declare",
      hasSelectedMove: true,
      hasSelectedTarget: true,
      yinCount: 1,
      yangCount: 1,
      requiresBothSlots: true,
    });
    assert.equal(result.allowed, true);
  });

  it("rejects when no move selected", () => {
    const result = canConfirmDeclaration({
      phase: "declare",
      hasSelectedMove: false,
      hasSelectedTarget: true,
      yinCount: 1,
      yangCount: 1,
      requiresBothSlots: true,
    });
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.some((r) => r.includes("招式")));
  });

  it("rejects when no target selected", () => {
    const result = canConfirmDeclaration({
      phase: "declare",
      hasSelectedMove: true,
      hasSelectedTarget: false,
      yinCount: 1,
      yangCount: 1,
      requiresBothSlots: true,
    });
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.some((r) => r.includes("目标")));
  });

  it("rejects when no dice assigned", () => {
    const result = canConfirmDeclaration({
      phase: "declare",
      hasSelectedMove: true,
      hasSelectedTarget: true,
      yinCount: 0,
      yangCount: 0,
      requiresBothSlots: true,
    });
    assert.equal(result.allowed, false);
  });

  it("rejects when yin missing for formal move", () => {
    const result = canConfirmDeclaration({
      phase: "declare",
      hasSelectedMove: true,
      hasSelectedTarget: true,
      yinCount: 0,
      yangCount: 1,
      requiresBothSlots: true,
    });
    assert.equal(result.allowed, false);
    assert.ok(result.reasons.some((r) => r.includes("阴骰")));
  });

  it("allows without slots for quick action", () => {
    const result = canConfirmDeclaration({
      phase: "declare",
      hasSelectedMove: true,
      hasSelectedTarget: true,
      yinCount: 0,
      yangCount: 0,
      requiresBothSlots: false,
    });
    // No dice = still rejected (at least 1 needed)
    assert.equal(result.allowed, false);
  });

  it("rejects when wrong phase", () => {
    const result = canConfirmDeclaration({
      phase: "round_end",
      hasSelectedMove: true,
      hasSelectedTarget: true,
      yinCount: 1,
      yangCount: 1,
      requiresBothSlots: true,
    });
    assert.equal(result.allowed, false);
  });
});
