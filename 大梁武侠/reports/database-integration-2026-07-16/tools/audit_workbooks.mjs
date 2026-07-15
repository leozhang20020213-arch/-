import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workspace = process.argv[2];
if (!workspace) throw new Error("workspace path is required");

const sources = [
  "D:/trpg/大梁武侠/规则书/大梁武侠_规则文字库详设包_2026年7月16日/大梁武侠_规则文字库详设_2026年7月16日.xlsx",
  "D:/trpg/大梁武侠/规则书/大梁江湖TRPG_内测第一版文件包_回填修订_2026年6月20日/03_数据库/01_大小样库.xlsx",
  "D:/trpg/大梁武侠/规则书/大梁江湖TRPG_内测第一版文件包_回填修订_2026年6月20日/03_数据库/02_招式库小样本_响应挂载与势前置修订.xlsx",
];

const outDir = path.join(workspace, "reports", "database-integration-2026-07-16", "extracted");
await fs.mkdir(outDir, { recursive: true });

function cellText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function summarizeSheet(sheet) {
  const used = sheet.getUsedRange();
  if (!used) return { name: sheet.name, rows: 0, columns: 0, headers: [] };
  const values = used.values ?? [];
  const formulas = used.formulas ?? [];
  const rows = values.length;
  const columns = Math.max(0, ...values.map((row) => row.length));
  const headers = (values[0] ?? []).map(cellText);
  // Spreadsheet formatting often extends to row 200. Only rows containing a
  // real value belong to the data grain; styled blank rows must not inflate
  // counts or be reported as missing identifiers.
  const meaningfulRows = values.slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row.some((value) => cellText(value)));
  const ids = meaningfulRows.map(({ row }) => cellText(row[0])).filter(Boolean);
  const idCounts = new Map();
  for (const id of ids) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
  const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1);
  const blankIdRows = meaningfulRows.filter(({ row }) => !cellText(row[0])).map(({ rowNumber }) => rowNumber);
  const formulaCount = formulas.flat().filter((formula) => cellText(formula)).length;
  const errorCells = [];
  const rawTokenCells = [];
  const objectObjectCells = [];
  const tokenPattern = /\b(?:[A-Z][A-Z0-9_]{2,}|[a-z]+_[a-z_]+)\b/g;
  const errorPattern = /#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A)/;
  values.forEach((row, r) => row.forEach((value, c) => {
    const text = cellText(value);
    if (errorPattern.test(text)) errorCells.push({ row: r + 1, column: c + 1, value: text });
    if (/\[object Object\]/i.test(text)) objectObjectCells.push({ row: r + 1, column: c + 1, value: text });
    const matches = text.match(tokenPattern) ?? [];
    const suspicious = [...new Set(matches)].filter((token) =>
      token.includes("_") || ["TURN_READY", "SCENE_ACTION", "FORM_CHECK", "ROUND_END", "SCENE_EXIT", "PENDING_OUTCOME"].includes(token),
    );
    if (suspicious.length) rawTokenCells.push({ row: r + 1, column: c + 1, tokens: suspicious });
  }));
  return {
    name: sheet.name,
    rows,
    columns,
    dataRows: meaningfulRows.length,
    formattedBlankRows: Math.max(0, rows - 1 - meaningfulRows.length),
    headers,
    duplicateIds,
    blankIdRows,
    formulaCount,
    errorCells,
    objectObjectCells,
    rawTokenCellCount: rawTokenCells.length,
    rawTokenSamples: rawTokenCells.slice(0, 20),
  };
}

const raw = [];
const summary = [];

for (const source of sources) {
  const input = await FileBlob.load(source);
  const workbook = await SpreadsheetFile.importXlsx(input);
  const sheets = [];
  const sheetSummaries = [];
  for (const sheet of workbook.worksheets.items) {
    const used = sheet.getUsedRange();
    const values = used?.values ?? [];
    const formulas = used?.formulas ?? [];
    sheets.push({ name: sheet.name, values, formulas });
    sheetSummaries.push(summarizeSheet(sheet));
  }
  raw.push({ source, sheets });
  summary.push({ source, sheets: sheetSummaries });
}

await fs.writeFile(path.join(outDir, "workbooks.raw.json"), JSON.stringify(raw, null, 2), "utf8");
await fs.writeFile(path.join(outDir, "workbooks.summary.json"), JSON.stringify(summary, null, 2), "utf8");
process.stdout.write(JSON.stringify(summary, null, 2));
