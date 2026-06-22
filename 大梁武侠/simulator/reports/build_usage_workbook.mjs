import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reportDir = path.join(root, "reports");
const summary = JSON.parse(await fs.readFile(path.join(reportDir, "raw_logs", "sample_short_campaign_summary.json"), "utf8"));

function fit(sheet, rangeA1, colCount) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.getRange(rangeA1).format = {
    borders: { preset: "all", style: "thin", color: "#D9E2F3" },
    wrapText: true,
  };
  sheet.getRangeByIndexes(0, 0, 1, colCount).format = {
    fill: "#1F4E79",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
  };
  for (let i = 0; i < colCount; i += 1) {
    sheet.getRangeByIndexes(0, i, 500, 1).format.columnWidthPx = i === colCount - 1 ? 320 : 150;
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

const headers = [
  "rule_id",
  "rule_name",
  "chapter",
  "category",
  "opportunities",
  "triggered_count",
  "player_initiated_count",
  "dm_initiated_count",
  "changed_outcome_count",
  "ignored_count",
  "ambiguity_count",
  "average_resolution_time",
  "notes",
];

const usageRows = summary.usage.map((r) => headers.map((h) => r[h] ?? ""));
const wb = Workbook.create();
writeSheet(wb, "规则总使用率表", headers, usageRows, "RuleUsageTotal");
writeSheet(
  wb,
  "高歧义规则表",
  headers,
  summary.usage.filter((r) => r.ambiguity_count > 0).map((r) => headers.map((h) => r[h] ?? "")),
  "AmbiguousRules",
);
writeSheet(
  wb,
  "高频规则表",
  headers,
  summary.usage.filter((r) => r.triggered_count >= 3).map((r) => headers.map((h) => r[h] ?? "")),
  "HighFrequencyRules",
);
writeSheet(
  wb,
  "样例问题",
  ["issue_id", "tag", "scene", "text", "severity", "recommendation"],
  summary.issues.map((i) => [i.issue_id, i.tag, i.scene, i.text, i.severity, i.recommendation]),
  "SampleIssues",
);

const out = await SpreadsheetFile.exportXlsx(wb);
await out.save(path.join(reportDir, "07_规则使用率统计.xlsx"));
