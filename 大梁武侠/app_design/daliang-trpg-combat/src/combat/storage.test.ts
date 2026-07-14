import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAppSession, normalizeCombatState } from "./storage";

test("旧玩家路由迁移到独立交锋桌面并补齐自动DM设置", () => {
  const migrated = normalizeAppSession({ route: "player" as never, autoDmEnabled: true });
  assert.equal(migrated.route, "playerCombat");
  assert.equal(migrated.playMode, "solo");
  assert.equal(migrated.aiNarrationEnabled, false);
});

test("旧存档缺少情景运行态时补齐完整情景", () => {
  const migrated = normalizeCombatState({ sceneName: "旧场景" });
  assert.equal(migrated.sceneName, "旧场景");
  assert.ok(migrated.scene.elements.length >= 3);
  assert.equal(typeof migrated.scene.combatUnlocked, "boolean");
});
