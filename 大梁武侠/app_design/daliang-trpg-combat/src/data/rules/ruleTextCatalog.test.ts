import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isEntrySafeForCampaign, validateRuleTextCatalog, type RuleTextCatalog } from "./ruleTextCatalog";

const catalogUrl = new URL("../../../public/data/rules/rule-text-catalog-v2026-07-16.json", import.meta.url);

test("7月16日规则文字库完整载入1004条并保持唯一标识", async () => {
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8")) as RuleTextCatalog;
  const result = validateRuleTextCatalog(catalog);
  assert.deepEqual(result.errors, []);
  assert.equal(catalog.entryCount, 1004);
  assert.equal(new Set(catalog.entries.map((entry) => entry.id)).size, 1004);
  assert.deepEqual(catalog.countsByKind, {
    external_move: 240,
    inner_art: 120,
    scene_method: 120,
    equipment: 180,
    medicine: 60,
    status: 64,
    manual: 60,
    mount: 40,
    document: 120,
  });
});

test("审校异常条目不会被当作自动DM可执行数据", async () => {
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8")) as RuleTextCatalog;
  const blocked = catalog.entries.filter((entry) => entry.review.status !== "REFERENCE");
  assert.ok(blocked.length > 0);
  assert.equal(blocked.every((entry) => !isEntrySafeForCampaign(entry)), true);
  assert.equal(catalog.entries.every((entry) => entry.runtimeSupport === "CATALOG_ONLY"), true);
  assert.equal(catalog.countsByStatus.QUARANTINED, 40);
  assert.ok(catalog.issueCounts.ALWAYS_ON_TOTAL_TRIGGER >= 1);
});

test("玩家显示文本已经去除原始开发令牌与对象占位", async () => {
  const catalog = JSON.parse(await readFile(catalogUrl, "utf8")) as RuleTextCatalog;
  const visibleText = catalog.entries.map((entry) => `${entry.playerText} ${entry.summary}`).join("\n");
  assert.equal(visibleText.includes("[object Object]"), false);
  assert.equal(visibleText.includes("TURN_READY"), false);
  assert.equal(visibleText.includes("regular_qi"), false);
});
