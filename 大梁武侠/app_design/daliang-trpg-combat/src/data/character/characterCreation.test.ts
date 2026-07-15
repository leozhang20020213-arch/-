import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Move, ResponseAttachment } from "../../combat/types";
import { createSeedState } from "../seed";
import {
  CHARACTER_CREATION_LIMITS,
  cloneDistanceRelationsForActor,
  createStarterQiDice,
  responsesForMoveIds,
  validateCharacterCreation,
  type StarterQiSource,
} from "./characterCreation";

const seed = createSeedState();
const shen = seed.actors.find((actor) => actor.id === "pc-shen-qing")!;
const starterQi: StarterQiSource[] = [{ label: "本命", nature: "raw", sides: 6, count: 6 }];

describe("character creation rules", () => {
  it("accepts the frozen 24-point roots, 3-5 moves, response and 5-8 dice", () => {
    assert.deepEqual(validateCharacterCreation({
      roots: { 顶门: 6, 目窍: 5, 心口: 4, 丹田: 4, 命门: 3, 步根: 2 },
      moves: shen.moves,
      responses: shen.responses,
      starterQi,
    }), []);
  });

  it("reports every independent opening-card defect instead of failing at the first one", () => {
    const onlyExternal = [shen.moves.find((move) => move.category === "外功")!] as Move[];
    const issues = validateCharacterCreation({
      roots: { 顶门: 7, 目窍: 4, 心口: 4, 丹田: 4, 命门: 4, 步根: 4 },
      moves: onlyExternal,
      responses: [],
      starterQi: [{ label: "不足", nature: "raw", sides: 4, count: 4 }],
    });
    assert.deepEqual(new Set(issues.map((issue) => issue.code)), new Set([
      "ROOT_TOTAL", "ROOT_RANGE", "MOVE_COUNT", "MISSING_SCENE", "MISSING_RESPONSE", "QI_COUNT",
    ]));
  });

  it("creates bounded unique QI_POOL dice and preserves source, nature and die size", () => {
    const dice = createStarterQiDice("pc-test", "测试侠客", [
      { label: "阴行功", nature: "yin", sides: 6, count: 2 },
      { label: "本命", nature: "raw", sides: 4, count: 3 },
    ]);
    assert.equal(dice.length, CHARACTER_CREATION_LIMITS.minimumStarterDice);
    assert.equal(new Set(dice.map((die) => die.id)).size, dice.length);
    assert.equal(dice.every((die) => die.zone === "QI_POOL" && die.value === null && die.ownerId === "pc-test"), true);
    assert.deepEqual(dice.map((die) => [die.nature, die.sides]), [["yin", 6], ["yin", 6], ["raw", 4], ["raw", 4], ["raw", 4]]);
  });

  it("mounts only responses belonging to selected moves", () => {
    const catalog = shen.responses as ResponseAttachment[];
    assert.deepEqual(responsesForMoveIds(["WG001"], catalog).map((response) => response.id).sort(), ["RG001", "RG002"]);
    assert.deepEqual(responsesForMoveIds(["FM001"], catalog), []);
  });

  it("gives a custom protagonist the authored distance graph instead of an unknown target range", () => {
    const relations = cloneDistanceRelationsForActor("pc-custom", "pc-shen-qing", seed.distances);
    assert.ok(relations.some((relation) => [relation.fromActorId, relation.toActorId].includes("enemy-short-blade") && relation.band === "近身"));
    assert.ok(relations.some((relation) => [relation.fromActorId, relation.toActorId].includes("enemy-porter") && relation.band === "中距"));
    assert.equal(relations.every((relation) => [relation.fromActorId, relation.toActorId].includes("pc-custom")), true);
  });
});
