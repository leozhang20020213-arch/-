import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { QiDie } from "../../../combat/types";
import { resolveQiDieActivation } from "./diceInteraction";
import {
  qiDieAriaLabel,
  shortQiSourceName,
  sortQiDiceForPool,
} from "./dicePresentation";

function makeDie(overrides: Partial<QiDie> = {}): QiDie {
  return {
    id: "die-default",
    label: "d6",
    sourceId: "source-default",
    sourceName: "沈青·小周天养息功·顶门",
    nature: "raw",
    sides: 6,
    value: 3,
    zone: "QI_SEA",
    ownerId: "pc-shen-qing",
    ...overrides,
  };
}

describe("qi pool presentation", () => {
  it("sorts by sides, nature, descending value, then id without mutating input", () => {
    const dice = [
      makeDie({ id: "d20-yin", sides: 20, nature: "yin", value: 20 }),
      makeDie({ id: "d4-raw", sides: 4, nature: "raw", value: 4 }),
      makeDie({ id: "d4-yin-low", sides: 4, nature: "yin", value: 2 }),
      makeDie({ id: "d4-yang", sides: 4, nature: "yang", value: 4 }),
      makeDie({ id: "d6-yin", sides: 6, nature: "yin", value: 6 }),
      makeDie({ id: "d4-yin-b", sides: 4, nature: "yin", value: 7 }),
      makeDie({ id: "d4-yin-a", sides: 4, nature: "yin", value: 7 }),
      makeDie({ id: "d4-yin-unrolled", sides: 4, nature: "yin", value: null }),
    ];
    const originalIds = dice.map((die) => die.id);

    assert.deepEqual(sortQiDiceForPool(dice).map((die) => die.id), [
      "d4-yin-a",
      "d4-yin-b",
      "d4-yin-low",
      "d4-yin-unrolled",
      "d4-yang",
      "d4-raw",
      "d6-yin",
      "d20-yin",
    ]);
    assert.deepEqual(dice.map((die) => die.id), originalIds);
  });

  it("builds a short visible source while preserving useful trailing detail", () => {
    assert.equal(shortQiSourceName("沈青·小周天养息功·顶门"), "小周天养息功·顶门");
    assert.equal(shortQiSourceName("短兵客·雨步"), "短兵客·雨步");
    assert.equal(shortQiSourceName("角色·非常非常非常长的内功名称·丹田"), "非常非常非常…·丹田");
    assert.equal(shortQiSourceName("  "), "未知来源");
  });

  it("keeps the complete untruncated source and current state in aria-label", () => {
    const die = makeDie({
      sourceName: "沈青·一段非常完整且不可截断的来源名称·目窍",
      nature: "yin",
      sides: 8,
      value: 7,
      zone: "TEMP_QI",
      temporary: true,
    });
    const label = qiDieAriaLabel(die, true);

    assert.match(label, /阴骰 D8/);
    assert.match(label, /点数7/);
    assert.match(label, /沈青·一段非常完整且不可截断的来源名称·目窍/);
    assert.match(label, /区域：临气区/);
    assert.match(label, /临时气骰/);
    assert.match(label, /已投入招式槽/);
  });
});

describe("qi die activation", () => {
  it("keeps yin/yang one-click assignment and requires an explicit raw decision", () => {
    assert.equal(resolveQiDieActivation(makeDie({ nature: "yin" }), false, true), "assign-yin");
    assert.equal(resolveQiDieActivation(makeDie({ nature: "yang" }), false, true), "assign-yang");
    assert.equal(resolveQiDieActivation(makeDie({ nature: "raw" }), false, true), "choose-raw-slot");
    assert.equal(resolveQiDieActivation(makeDie({ nature: "raw" }), true, true), "remove");
  });

  it("does nothing when declaration assignment is disabled", () => {
    assert.equal(resolveQiDieActivation(makeDie({ nature: "raw" }), false, false), "none");
    assert.equal(resolveQiDieActivation(makeDie({ nature: "yin" }), true, false), "none");
  });
});
