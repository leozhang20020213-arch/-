import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSeedState } from "../data/seed";
import {
  applyOutcome,
  canDeclareAction,
  changeMomentum,
  commitDiceRollResults,
  declareAction,
  endRound,
  enterScene,
  equipItem,
  expireSource,
  formMove,
  regulateBreath,
  resolveInterceptSuccess,
  resolveReact,
  unequipItem,
  useInventoryItem,
  useReflection,
  visibleForPlayer,
} from "./combatEngine";
import { assertRuleCatalogValid } from "../rules/ruleCatalog";
import { validateLanMessage, validateStatusRecord } from "../rules/schema";

const fixedRoll = () => 4;

describe("combat engine", () => {
  it("enters scene and rolls pool dice into qi sea", () => {
    const state = enterScene(createSeedState(), fixedRoll);
    assert.equal(state.dice.filter((die) => die.zone === "QI_SEA").length, state.dice.length);
    assert.equal(state.dice.every((die) => die.value === 4), true);
  });

  it("declares an action and locks selected qi", () => {
    const state = enterScene(createSeedState(), fixedRoll);
    const next = declareAction(state, "pc-shen-qing", "enemy-short-blade", "move-rain-step-cut", ["pc-d1", "pc-d2"]);
    assert.equal(next.phase, "intercept_window");
    assert.equal(next.dice.filter((die) => die.zone === "QI_LOCK").length, 2);
  });

  it("keeps yin and yang slot ownership while preserving diceIds compatibility", () => {
    const state = enterScene(createSeedState(), fixedRoll);
    const next = declareAction(
      state,
      "pc-shen-qing",
      "enemy-short-blade",
      "move-rain-step-cut",
      ["pc-d1", "pc-d2"],
      { yinSlotDiceIds: ["pc-d1"], yangSlotDiceIds: ["pc-d2"] },
    );
    assert.deepEqual(next.pendingAction?.diceIds, ["pc-d1", "pc-d2"]);
    assert.deepEqual(next.pendingAction?.yinSlotDiceIds, ["pc-d1"]);
    assert.deepEqual(next.pendingAction?.yangSlotDiceIds, ["pc-d2"]);
  });

  it("moves action dice to rest when intercept cancels declaration", () => {
    let state = enterScene(createSeedState(), fixedRoll);
    state = declareAction(state, "pc-shen-qing", "enemy-short-blade", "move-rain-step-cut", ["pc-d1", "pc-d2"]);
    state = resolveInterceptSuccess(state, "enemy-short-blade", "intercept-wrist-pick", ["sb-d1"]);
    assert.equal(state.pendingAction, undefined);
    assert.equal(state.dice.find((die) => die.id === "pc-d1")?.zone, "QI_REST");
    assert.equal(state.dice.find((die) => die.id === "sb-d1")?.zone, "QI_REST");
  });

  it("forms, reacts, and applies outcome", () => {
    let state = enterScene(createSeedState(), fixedRoll);
    state = declareAction(state, "pc-shen-qing", "enemy-short-blade", "move-rain-step-cut", ["pc-d1", "pc-d2"]);
    state = formMove(state);
    state = resolveReact(state, "enemy-short-blade", "react-side-slip", ["sb-d1"]);
    state = applyOutcome(state);
    assert.equal(state.actors.find((actor) => actor.id === "enemy-short-blade")?.hp, 12);
    assert.equal(state.pendingAction, undefined);
  });

  it("regulates breath without rerolling", () => {
    let state = enterScene(createSeedState(), fixedRoll);
    state = declareAction(state, "pc-shen-qing", "enemy-short-blade", "move-rain-step-cut", ["pc-d1", "pc-d2"]);
    state = resolveInterceptSuccess(state, "enemy-short-blade", "intercept-wrist-pick", ["sb-d1"]);
    state = regulateBreath(state, "pc-shen-qing", ["pc-d1"]);
    const die = state.dice.find((item) => item.id === "pc-d1");
    assert.equal(die?.zone, "QI_SEA");
    assert.equal(die?.value, 4);
  });

  it("reflection only works when qi sea is empty", () => {
    let state = enterScene(createSeedState(), fixedRoll);
    state = useReflection(state, "pc-shen-qing");
    assert.match(state.logs[0].message, /失败/);
  });

  it("expires unlocked source dice and hides DM-only data from player view", () => {
    let state = enterScene(createSeedState(), fixedRoll);
    state = expireSource(state, "短兵客·雨步");
    assert.equal(state.dice.some((die) => die.sourceId === "短兵客·雨步"), false);
    const playerView = visibleForPlayer(state);
    assert.equal(playerView.actors.some((actor) => actor.dmNote), false);
    assert.equal(playerView.actors.some((actor) => actor.hiddenGoal), false);
    assert.equal(playerView.dice.every((die) => die.ownerId === "pc-shen-qing"), true);
    assert.equal(playerView.tracks.some((track) => track.hidden), false);
    assert.equal(playerView.actors.find((actor) => actor.id === "enemy-short-blade")?.responses.some((response) => response.window === "intercept"), false);
  });

  it("requires yin and yang slots for formal moves but not quick actions", () => {
    let state = enterScene(createSeedState(), fixedRoll);
    let availability = canDeclareAction(state, "pc-shen-qing", "move-rain-step-cut", { yinSlotDiceIds: ["pc-d1"] });
    assert.equal(availability.allowed, false);
    assert.equal(availability.reasons.includes("缺少阳骰"), true);

    availability = canDeclareAction(state, "pc-shen-qing", "move-rain-step-cut", {
      yinSlotDiceIds: ["pc-d1"],
      yangSlotDiceIds: ["pc-d2"],
    });
    assert.equal(availability.allowed, true);

    state = {
      ...state,
      actors: state.actors.map((actor) =>
        actor.id === "pc-shen-qing"
          ? { ...actor, moves: [...actor.moves, { id: "move-quick", name: "出手便行", actionType: "quick", minDice: 1, summary: "便行动作。" }] }
          : actor,
      ),
    };
    availability = canDeclareAction(state, "pc-shen-qing", "move-quick", {});
    assert.equal(availability.allowed, true);
  });

  it("uses medicine to grant temporary qi and logs inventory event", () => {
    let state = enterScene(createSeedState(), fixedRoll);
    state = useInventoryItem(state, "pc-shen-qing", "item-breath-pill");
    const actor = state.actors.find((item) => item.id === "pc-shen-qing");
    assert.equal(actor?.inventory.find((item) => item.id === "item-breath-pill")?.quantity, 1);
    assert.equal(state.dice.some((die) => die.ownerId === "pc-shen-qing" && die.zone === "TEMP_QI"), true);
    assert.equal(state.logs.some((log) => log.type === "TEMP_QI_GRANTED"), true);
  });

  it("equips and unequips items", () => {
    let state = createSeedState();
    state = unequipItem(state, "pc-shen-qing", "item-bamboo-sword");
    assert.equal(state.actors[0].inventory.find((item) => item.id === "item-bamboo-sword")?.equipped, false);
    state = equipItem(state, "pc-shen-qing", "item-bamboo-sword");
    assert.equal(state.actors[0].inventory.find((item) => item.id === "item-bamboo-sword")?.equipped, true);
  });

  it("updates momentum and ends round", () => {
    let state = createSeedState();
    state = changeMomentum(state, "合势");
    assert.equal(state.momentum, "合势");
    state = endRound(state);
    assert.equal(state.phase, "round_end");
    assert.equal(state.round, 2);
  });

  it("commits confirmed 3D qi dice rolls through the rule engine", () => {
    const state = createSeedState();
    const next = commitDiceRollResults(state, [
      { id: "pc-d1", value: 6 },
      { id: "pc-d2", value: 3 },
    ]);
    assert.equal(next.dice.find((die) => die.id === "pc-d1")?.zone, "QI_SEA");
    assert.equal(next.dice.find((die) => die.id === "pc-d1")?.value, 6);
    assert.equal(next.logs.some((log) => log.type === "dice_rolled"), true);
    assert.equal(next.logs.some((log) => log.type === "qi_entered_sea"), true);
  });

  it("validates strict rule catalog and rejects unknown LAN/status fields", () => {
    assert.doesNotThrow(() => assertRuleCatalogValid());
    assert.equal(
      validateLanMessage({ type: "room_created", roomCode: "LAN-AB12", senderId: "dm", payload: {}, extra: true }).ok,
      false,
    );
    assert.equal(validateLanMessage({ type: "unknown", roomCode: "LAN-AB12", senderId: "dm", payload: {} }).ok, false);
    assert.equal(validateStatusRecord({ name: "status", public: true, illegal: true }).ok, false);
  });

  it("inventory item can trigger source expiration", () => {
    let state = enterScene(createSeedState(), fixedRoll);
    state = useInventoryItem(state, "pc-shen-qing", "item-expire-demo");
    assert.equal(state.dice.some((die) => die.sourceId === "短兵客·雨步"), false);
    assert.equal(state.logs.some((log) => log.type === "ITEM_SOURCE_EXPIRED" || log.type === "EXPIRE_SOURCE"), true);
  });
});
