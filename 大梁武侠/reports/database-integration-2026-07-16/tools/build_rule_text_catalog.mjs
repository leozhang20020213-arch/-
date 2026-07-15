import fs from "node:fs/promises";
import path from "node:path";

const workspace = process.argv[2];
if (!workspace) throw new Error("workspace path is required");

const inputPath = path.join(
  workspace,
  "reports",
  "database-integration-2026-07-16",
  "extracted",
  "workbooks.raw.json",
);
const appPublicDir = path.join(
  workspace,
  "app_design",
  "daliang-trpg-combat",
  "public",
  "data",
  "rules",
);
const reportDir = path.join(workspace, "reports", "database-integration-2026-07-16");

const books = JSON.parse(await fs.readFile(inputPath, "utf8"));
const sourceBook = books.find((book) => book.source.includes("2026年7月16日"));
if (!sourceBook) throw new Error("2026-07-16 rule text workbook was not extracted");

const sheetDefinitions = {
  "01_外功招式详设": {
    kind: "external_move",
    label: "外功",
    idField: "招式ID",
    nameField: "名称",
    categoryField: "门类",
    tierField: "层级",
    summaryField: "基础效果",
    playerField: "玩家卡面长文",
    dmField: "DM裁定提示",
  },
  "02_内功详设": {
    kind: "inner_art",
    label: "内功",
    idField: "内功ID",
    nameField: "名称",
    categoryField: "类别",
    tierField: "层级",
    summaryField: "被动与循环",
    playerField: "玩家规则说明",
    dmField: "DM投放建议",
  },
  "03_情景法门详设": {
    kind: "scene_method",
    label: "情景法门",
    idField: "法门ID",
    nameField: "名称",
    categoryField: "类别",
    tierField: "层级",
    summaryField: "基础效果",
    playerField: "玩家卡面长文",
    dmField: "DM裁定提示",
  },
  "04_装备详设": {
    kind: "equipment",
    label: "装备",
    idField: "装备ID",
    nameField: "名称",
    categoryField: "大类",
    subCategoryField: "小类",
    tierField: "层级",
    summaryField: "数值与表属性",
    playerField: "玩家说明长文",
    dmField: "DM裁定提示",
  },
  "05_药物详设": {
    kind: "medicine",
    label: "药物",
    idField: "药物ID",
    nameField: "名称",
    categoryField: "类别",
    tierField: "层级",
    summaryField: "明确效果",
    playerField: "玩家说明长文",
    dmField: "DM裁定提示",
  },
  "06_状态详设": {
    kind: "status",
    label: "状态",
    idField: "状态ID",
    nameField: "名称",
    categoryField: "分组",
    summaryField: "明确规则效果",
    playerField: "玩家说明长文",
    dmField: "DM裁定提示",
  },
  "07_谱本详设": {
    kind: "manual",
    label: "谱本",
    idField: "谱本ID",
    nameField: "名称",
    categoryField: "门类",
    tierField: "层级",
    summaryField: "明确收录条目",
    playerField: "玩家说明长文",
    dmField: "DM投放提示",
  },
  "08_坐骑载具详设": {
    kind: "mount",
    label: "坐骑载具",
    idField: "资源ID",
    nameField: "名称",
    categoryField: "类别",
    tierField: "层级",
    summaryField: "旅行/追逐规则",
    playerField: "玩家说明长文",
    dmField: "DM裁定提示",
  },
  "09_文书资源详设": {
    kind: "document",
    label: "文书资源",
    idField: "物品ID",
    nameField: "名称",
    categoryField: "类别",
    tierField: "层级",
    summaryField: "明确效果",
    playerField: "玩家说明长文",
    dmField: "DM裁定提示",
  },
};

const tokenLabels = new Map(Object.entries({
  TURN_READY: "正式出手准备",
  SCENE_ACTION: "情景行动",
  SCENE_FREE: "自由情景",
  SCENE_STRUCTURED: "结构化情景",
  COMBAT: "战斗",
  BOTH: "情景与战斗",
  OUTCOME_COMMIT: "落果写入",
  ROUND_END: "轮末",
  PASSIVE: "被动检查",
  FORM_CHECK: "成招合法性复核",
  PENDING_OUTCOME: "待落果",
  STATUS_ADD: "写入状态",
  SCENE_EXIT: "离开场景",
  RELATION_FACT: "关系事实",
  regular_qi: "常规气骰",
  temporary_qi: "临时气骰",
  status_id: "状态标识",
  aperture_slots: "窍位数量",
  time_units: "时间单位",
  teacher_or_annotation: "师承或注本",
  permission_required: "需要许可",
  on_complete: "完成后",
  one_status_or_distance_change: "一项状态或距离变化",
  side_effects: "副作用",
}));

function text(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeDisplay(value) {
  let result = text(value)
    .replace(/。。+/g, "。")
    .replace(/；。/g, "。")
    .replace(/\.。/g, "。")
    .replace(/\[object Object\]/g, "维护参数缺失（待审校）");
  for (const [token, label] of tokenLabels) {
    result = result.replace(new RegExp(`\\b${token}\\b`, "g"), label);
  }
  result = result
    .replace(/\{'time_units':\s*(\d+),\s*'teacher_or_annotation':\s*(True|False),\s*'permission_required':\s*(True|False)\}/g, (_, units, teacher, permission) =>
      `时间单位${units}；师承或注本：${teacher === "True" ? "需要" : "不需要"}；额外许可：${permission === "True" ? "需要" : "不需要"}`)
    .replace(/\{'max':\s*(\d+),\s*'on_complete':\s*'([^']+)'\}/g, (_, max, complete) =>
      `进度上限${max}；完成后：${complete}`)
    .replace(/\{'resource':\s*'([^']+)',\s*'cost_per_scene':\s*(\d+)\}/g, (_, resource, cost) =>
      `维护资源：${resource}；每场景消耗${cost}`);
  return result;
}

function headerScope(header) {
  if (/DM|裁定|投放/.test(header)) return "dm";
  if (/规则边界|开发|风险与并行限制/.test(header)) return "developer";
  return "player";
}

function parseNumber(pattern, value) {
  const match = text(value).match(pattern);
  return match ? Number(match[1]) : undefined;
}

function allText(record) {
  return Object.values(record).map(text).join(" ");
}

function inspectEntry(record, definition) {
  const issues = [];
  const declaration = text(record["宣言条件"] ?? record["使用条件"]);
  const combined = allText(record);
  const minimumQi = parseNumber(/最低投入[：:]?(\d+)枚/, declaration);
  const declarationTotal = parseNumber(/合值(?:至少|不低于|≥)[：:]?(\d+)/, declaration);
  const triggerTotal = parseNumber(/合值(?:触发)?\s*[：:]?\s*合值≥(\d+)/, combined)
    ?? parseNumber(/合值≥(\d+)/, text(record["合值触发"]));
  const damage = parseNumber(/(?:气血-|造成气血)(\d+)/, text(record["基础效果"]))
    ?? parseNumber(/造成[^；。]*?(\d+)点气血/, text(record["基础效果"]));
  const healing = parseNumber(/气血\+(\d+)/, text(record["明确效果"] ?? record["基础效果"]));

  if (combined.includes("[object Object]")) {
    issues.push({ code: "UNSERIALIZED_OBJECT", severity: "error", message: "源表含 [object Object] 占位，真实参数已经丢失。" });
  }
  if (/\{'[^']+'\s*:/.test(combined)) {
    issues.push({ code: "RAW_STRUCTURED_LITERAL", severity: "warning", message: "源表把结构化参数以 Python 字典文字写入，需要转换后才能交给玩家。" });
  }
  if (declarationTotal !== undefined && triggerTotal !== undefined && triggerTotal <= declarationTotal) {
    issues.push({
      code: "ALWAYS_ON_TOTAL_TRIGGER",
      severity: "error",
      message: `宣言已要求合值≥${declarationTotal}，但附加触发仅要求合值≥${triggerTotal}，成招后将恒定触发。`,
    });
  }
  if (minimumQi !== undefined && minimumQi >= 10) {
    issues.push({ code: "EXTREME_QI_DEMAND", severity: "error", message: `最低投入${minimumQi}枚，超过当前教学角色6枚常规气骰规模。` });
  } else if (minimumQi !== undefined && minimumQi >= 7) {
    issues.push({ code: "HIGH_QI_DEMAND", severity: "warning", message: `最低投入${minimumQi}枚，只适合明确的高阶气骰池。` });
  }
  if (damage !== undefined && damage >= 14) {
    issues.push({ code: "LETHAL_BASE_DAMAGE", severity: "error", message: `基础气血落果${damage}点，已达到当前样例敌人完整气血量级。` });
  } else if (damage !== undefined && damage >= 10) {
    issues.push({ code: "HIGH_BASE_DAMAGE", severity: "warning", message: `基础气血落果${damage}点，需要按人物阶段限制投放。` });
  }
  if (healing !== undefined && healing >= 8) {
    issues.push({ code: "HIGH_HEALING", severity: "warning", message: `单次恢复${healing}点气血，需限制稀有度与重复使用。` });
  }
  if (definition.kind === "scene_method" && /危机[+-]\d+/.test(combined) && !/(危机轨|轨道|名为|指定危机)/.test(combined)) {
    issues.push({ code: "GENERIC_SCENE_TRACK", severity: "warning", message: "写入了泛称“危机”，运行时必须绑定当前场景的具体危机轨。" });
  }

  const status = issues.some((issue) => issue.code === "UNSERIALIZED_OBJECT")
    ? "QUARANTINED"
    : issues.some((issue) => issue.severity === "error")
      ? "REVIEW_REQUIRED"
      : "REFERENCE";
  const risk = issues.some((issue) => issue.severity === "error")
    ? "high"
    : issues.some((issue) => issue.severity === "warning")
      ? "medium"
      : "low";
  return { status, risk, minimumQi, declarationTotal, triggerTotal, damage, healing, issues };
}

const entries = [];
for (const sheet of sourceBook.sheets) {
  const definition = sheetDefinitions[sheet.name];
  if (!definition) continue;
  const [headers, ...rows] = sheet.values;
  rows.forEach((row, index) => {
    const record = Object.fromEntries(headers.map((header, column) => [text(header), row[column]]));
    const id = text(record[definition.idField]);
    if (!id) return;
    const review = inspectEntry(record, definition);
    const sections = headers
      .map((header) => text(header))
      .filter((header) => header && ![definition.idField, definition.nameField, definition.playerField, definition.dmField].includes(header))
      .map((header) => ({ label: header, value: normalizeDisplay(record[header]), scope: headerScope(header) }))
      .filter((section) => section.value);
    entries.push({
      id,
      name: normalizeDisplay(record[definition.nameField]),
      kind: definition.kind,
      kindLabel: definition.label,
      category: normalizeDisplay(record[definition.categoryField]),
      subCategory: definition.subCategoryField ? normalizeDisplay(record[definition.subCategoryField]) : "",
      tier: definition.tierField ? normalizeDisplay(record[definition.tierField]) : "",
      summary: normalizeDisplay(record[definition.summaryField]),
      playerText: normalizeDisplay(record[definition.playerField]),
      dmText: normalizeDisplay(record[definition.dmField]),
      sections,
      runtimeSupport: "CATALOG_ONLY",
      review,
      source: { sheet: sheet.name, row: index + 2 },
    });
  });
}

const duplicateIds = [...entries.reduce((map, entry) => map.set(entry.id, [...(map.get(entry.id) ?? []), entry]), new Map())]
  .filter(([, matches]) => matches.length > 1)
  .map(([id, matches]) => ({ id, kinds: matches.map((entry) => entry.kind) }));
if (duplicateIds.length) throw new Error(`duplicate catalog ids: ${JSON.stringify(duplicateIds)}`);

const countsByKind = Object.fromEntries(Object.values(sheetDefinitions).map((definition) => [definition.kind, 0]));
const countsByStatus = { REFERENCE: 0, REVIEW_REQUIRED: 0, QUARANTINED: 0 };
const issueCounts = {};
for (const entry of entries) {
  countsByKind[entry.kind] += 1;
  countsByStatus[entry.review.status] += 1;
  for (const issue of entry.review.issues) issueCounts[issue.code] = (issueCounts[issue.code] ?? 0) + 1;
}

const manifest = {
  schemaVersion: 1,
  catalogVersion: "2026-07-16",
  rulesVersion: "2026-07-15+text-2026-07-16",
  source: "大梁武侠_规则文字库详设_2026年7月16日.xlsx",
  generatedAt: new Date().toISOString(),
  entryCount: entries.length,
  countsByKind,
  countsByStatus,
  issueCounts,
  precedence: [
    "2026-07-15 冻结口径（交锋、调息、返照与响应）",
    "2026-07-16 规则文字库（条目正文与资源资料）",
    "2026-06-20 对齐规则包（稳定基础口径）",
    "程序内置样例（仅作可执行回归基线）",
  ],
};

const catalog = { ...manifest, entries };
await fs.mkdir(appPublicDir, { recursive: true });
await fs.mkdir(reportDir, { recursive: true });
await fs.writeFile(path.join(appPublicDir, "rule-text-catalog-v2026-07-16.json"), JSON.stringify(catalog), "utf8");
await fs.writeFile(path.join(appPublicDir, "catalog-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
await fs.writeFile(path.join(reportDir, "catalog-audit.json"), JSON.stringify({ manifest, flaggedEntries: entries.filter((entry) => entry.review.issues.length).map((entry) => ({ id: entry.id, name: entry.name, kind: entry.kind, review: entry.review })) }, null, 2), "utf8");
process.stdout.write(JSON.stringify(manifest, null, 2));
