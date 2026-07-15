import assert from "node:assert/strict";
import test from "node:test";
import { combatStorageKey, normalizeAppSession, normalizeCombatState } from "./storage";
import { createSeedState } from "../data/seed";
import { transitionToCampaignScene } from "../data/campaign/campaignRuntime";
import { tutorialCampaignPack } from "../data/campaign/tutorialPack";

test("旧玩家路由迁移到独立交锋桌面并补齐自动DM设置", () => {
  const migrated = normalizeAppSession({ route: "player" as never, autoDmEnabled: true });
  assert.equal(migrated.route, "playerCombat");
  assert.equal(migrated.playMode, "solo");
});

test("单人故事与真人DM房间使用独立权威存档槽", () => {
  assert.notEqual(combatStorageKey("solo"), combatStorageKey("room"));
  assert.match(combatStorageKey("solo"), /solo$/);
  assert.match(combatStorageKey("room"), /room$/);
});

test("旧存档缺少情景运行态时补齐完整情景", () => {
  const migrated = normalizeCombatState({ sceneName: "旧场景" });
  assert.equal(migrated.sceneName, "旧场景");
  assert.ok(migrated.scene.elements.length >= 3);
  assert.equal(typeof migrated.scene.combatUnlocked, "boolean");
});

test("结构化情景存档不会把未参演敌人追加进行动序列", () => {
  const pursuit = transitionToCampaignScene(createSeedState(), tutorialCampaignPack, "pier-pursuit", ["pc-shen-qing", "pc-wei", "enemy-porter"]);
  const migrated = normalizeCombatState(pursuit);
  assert.deepEqual(migrated.initiativeOrder, ["pc-shen-qing", "pc-wei", "enemy-porter"]);
  assert.deepEqual(migrated.runtime.scene.sequence?.initiativeOrder, migrated.initiativeOrder);
  assert.equal(migrated.initiativeOrder.includes("enemy-archer"), false);
  const stale = normalizeCombatState({ ...pursuit, activeActorId: "enemy-archer" });
  assert.equal(stale.activeActorId, "pc-shen-qing");
  assert.equal(stale.runtime.scene.sequence?.activeActorId, "pc-shen-qing");
});

test("旧存档的重复装备标志以权威装备槽为准", () => {
  const seed = createSeedState();
  const migrated = normalizeCombatState({
    ...seed,
    actors: seed.actors.map((actor) => actor.id === "pc-shen-qing" ? {
      ...actor,
      equippedWeapon: "item-ring-saber",
      inventory: actor.inventory.map((item) => item.category === "weapon" ? { ...item, equipped: true } : item),
    } : actor),
  });
  const actor = migrated.actors.find((entry) => entry.id === "pc-shen-qing")!;
  assert.deepEqual(
    actor.inventory.filter((item) => item.category === "weapon" && item.equipped).map((item) => item.id),
    ["item-ring-saber"],
  );
});

test("内容更新按稳定角色标识迁移并补入新增预设角色与气骰", () => {
  const seed = createSeedState();
  const legacyActorIds = new Set(["pc-shen-qing", "pc-wei", "enemy-short-blade", "enemy-porter", "enemy-lookout", "enemy-archer"]);
  const legacyActors = seed.actors.filter((actor) => legacyActorIds.has(actor.id));
  const legacyDice = seed.dice.filter((die) => legacyActorIds.has(die.ownerId));
  const migrated = normalizeCombatState({ ...seed, actors: legacyActors, dice: legacyDice });
  assert.equal(migrated.actors.find((actor) => actor.id === "pc-wei")?.name, "魏长兴");
  assert.equal(migrated.actors.find((actor) => actor.id === "pc-tang-he")?.name, "唐禾");
  assert.ok(migrated.dice.some((die) => die.ownerId === "pc-tang-he"));
  assert.equal(new Set(migrated.actors.map((actor) => actor.id)).size, migrated.actors.length);
});
