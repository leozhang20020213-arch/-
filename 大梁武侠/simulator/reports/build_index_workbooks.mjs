import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const reportDir = path.dirname(fileURLToPath(import.meta.url));
const rawPath = path.join(reportDir, "raw_logs", "00_extraction_index.json");
const data = JSON.parse(await fs.readFile(rawPath, "utf8"));

function fit(sheet, rangeA1, colCount) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.getRange(rangeA1).format = {
    borders: { preset: "all", style: "thin", color: "#D9E2F3" },
    wrapText: true,
  };
  const header = sheet.getRangeByIndexes(0, 0, 1, colCount);
  header.format = {
    fill: "#1F4E79",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
  };
  for (let i = 0; i < colCount; i += 1) {
    const width = i === 0 ? 90 : i >= colCount - 2 ? 300 : 170;
    sheet.getRangeByIndexes(0, i, 1000, 1).format.columnWidthPx = width;
  }
}

function writeSheet(workbook, name, headers, rows, tableName) {
  const sheet = workbook.worksheets.add(name);
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  if (rows.length) {
    sheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
  }
  const lastRow = Math.max(1, rows.length + 1);
  const lastCol = String.fromCharCode(64 + headers.length);
  sheet.tables.add(`A1:${lastCol}${lastRow}`, true, tableName);
  fit(sheet, `A1:${lastCol}${lastRow}`, headers.length);
}

async function save(workbook, fileName) {
  const out = await SpreadsheetFile.exportXlsx(workbook);
  await out.save(path.join(reportDir, fileName));
}

const ruleWb = Workbook.create();
writeSheet(
  ruleWb,
  "规则索引",
  [
    "规则编号",
    "规则名称",
    "来源",
    "所属章节",
    "分类",
    "适用场景",
    "输入条件",
    "结算方式",
    "影响资源",
    "关联数据库",
    "是否需要DM裁定",
    "是否存在歧义",
    "原文摘录",
  ],
  data.rules.map((r) => [
    r.rule_id,
    r.rule_name,
    r.source,
    r.chapter,
    r.category,
    r.applicable_scene,
    r.input_conditions,
    r.resolution,
    r.affected_resources,
    r.linked_database,
    r.needs_dm_judgment,
    r.ambiguity,
    r.excerpt,
  ]),
  "RuleIndex",
);
writeSheet(
  ruleWb,
  "术语索引",
  ["术语", "来源", "出现次数", "首次章节", "首次上下文", "是否需定义复核"],
  data.terms.map((t) => [t.term, t.source, t.occurrences, t.first_chapter, t.first_context, t.needs_definition_check]),
  "TermIndex",
);
writeSheet(
  ruleWb,
  "输入文件状态",
  ["预期文件", "找到路径", "状态", "备注"],
  data.sources.map((s) => [s.expected_name, s.found_path ?? "", s.status, s.note]),
  "SourceStatus",
);
await save(ruleWb, "01_规则索引表.xlsx");

const dbWb = Workbook.create();
writeSheet(
  dbWb,
  "数据库索引",
  ["工作簿", "表名", "主键猜测", "条目数量", "字段数量", "核心字段", "被哪些规则调用", "缺解释字段", "可能未使用字段"],
  data.databases.map((d) => [
    d.workbook,
    d.sheet_name,
    d.primary_key_guess,
    d.row_count,
    d.column_count,
    d.core_fields,
    d.called_by_rules,
    d.fields_without_explanation,
    d.possibly_unused_fields,
  ]),
  "DatabaseIndex",
);
writeSheet(
  dbWb,
  "缺口摘要",
  ["类型", "对象", "说明", "建议"],
  [
    ...data.sources.filter((s) => s.status === "missing").map((s) => ["缺失输入文件", s.expected_name, s.note, "补入文件后重新运行解析与索引生成"]),
    ...data.databases.filter((d) => d.called_by_rules === "未匹配").map((d) => ["规则调用未匹配", `${d.workbook}/${d.sheet_name}`, "自动索引未发现规则书显式调用该表名或核心字段", "人工复核是否为数据库冗余、隐式调用或规则缺写"]),
  ],
  "GapSummary",
);
await save(dbWb, "02_数据库索引与缺口报告.xlsx");

console.log(JSON.stringify({ rules: data.rules.length, terms: data.terms.length, dbSheets: data.databases.length }));
