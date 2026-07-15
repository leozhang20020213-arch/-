export type RuleTextKind =
  | "external_move"
  | "inner_art"
  | "scene_method"
  | "equipment"
  | "medicine"
  | "status"
  | "manual"
  | "mount"
  | "document";

export type RuleReviewStatus = "REFERENCE" | "REVIEW_REQUIRED" | "QUARANTINED";
export type RuleRiskLevel = "low" | "medium" | "high";

export interface RuleTextSection {
  label: string;
  value: string;
  scope: "player" | "dm" | "developer";
}

export interface RuleReviewIssue {
  code: string;
  severity: "warning" | "error";
  message: string;
}

export interface RuleTextEntry {
  id: string;
  name: string;
  kind: RuleTextKind;
  kindLabel: string;
  category: string;
  subCategory: string;
  tier: string;
  summary: string;
  playerText: string;
  dmText: string;
  sections: RuleTextSection[];
  runtimeSupport: "CATALOG_ONLY";
  review: {
    status: RuleReviewStatus;
    risk: RuleRiskLevel;
    minimumQi?: number;
    declarationTotal?: number;
    triggerTotal?: number;
    damage?: number;
    healing?: number;
    issues: RuleReviewIssue[];
  };
  source: { sheet: string; row: number };
}

export interface RuleCatalogManifest {
  schemaVersion: 1;
  catalogVersion: string;
  rulesVersion: string;
  source: string;
  generatedAt: string;
  entryCount: number;
  countsByKind: Record<RuleTextKind, number>;
  countsByStatus: Record<RuleReviewStatus, number>;
  issueCounts: Record<string, number>;
  precedence: string[];
}

export interface RuleTextCatalog extends RuleCatalogManifest {
  entries: RuleTextEntry[];
}

export interface RuleCatalogValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const CATALOG_FILE = "data/rules/rule-text-catalog-v2026-07-16.json";
let cachedCatalog: Promise<RuleTextCatalog> | undefined;

function catalogUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env;
  const base = env?.BASE_URL ?? "./";
  return `${base}${CATALOG_FILE}`;
}

export function loadRuleTextCatalog(): Promise<RuleTextCatalog> {
  cachedCatalog ??= fetch(catalogUrl())
    .then(async (response) => {
      if (!response.ok) throw new Error(`规则文字库读取失败（HTTP ${response.status}）`);
      return response.json() as Promise<unknown>;
    })
    .then((value) => {
      const result = validateRuleTextCatalog(value);
      if (!result.ok) throw new Error(result.errors.join("；"));
      return value as RuleTextCatalog;
    });
  return cachedCatalog;
}

export function clearRuleTextCatalogCacheForTests(): void {
  cachedCatalog = undefined;
}

export function validateRuleTextCatalog(value: unknown): RuleCatalogValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ["规则文字库根节点必须是对象。"], warnings };
  if (value.schemaVersion !== 1) errors.push("规则文字库 schemaVersion 必须为 1。");
  if (typeof value.catalogVersion !== "string" || !value.catalogVersion) errors.push("规则文字库缺少 catalogVersion。");
  if (!Array.isArray(value.entries)) return { ok: false, errors: [...errors, "规则文字库 entries 必须是数组。"], warnings };
  if (value.entryCount !== value.entries.length) errors.push(`目录声明 ${String(value.entryCount)} 条，但实际载入 ${value.entries.length} 条。`);

  const ids = new Set<string>();
  value.entries.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`entries[${index}] 不是对象。`);
      return;
    }
    const id = typeof entry.id === "string" ? entry.id : "";
    if (!id) errors.push(`entries[${index}] 缺少 id。`);
    else if (ids.has(id)) errors.push(`条目标识 ${id} 重复。`);
    else ids.add(id);
    if (typeof entry.name !== "string" || !entry.name.trim()) errors.push(`${id || `entries[${index}]`} 缺少名称。`);
    if (!isRuleTextKind(entry.kind)) errors.push(`${id || `entries[${index}]`} 的 kind 非法。`);
    if (!isRecord(entry.review) || !isReviewStatus(entry.review.status)) errors.push(`${id || `entries[${index}]`} 缺少审校状态。`);
    if (entry.runtimeSupport !== "CATALOG_ONLY") warnings.push(`${id || `entries[${index}]`} 宣称可直接执行，需单独核验适配器。`);
  });
  return { ok: errors.length === 0, errors, warnings };
}

export function isEntrySafeForCampaign(entry: RuleTextEntry): boolean {
  return entry.review.status === "REFERENCE" && entry.runtimeSupport === "CATALOG_ONLY";
}

export function reviewStatusLabel(status: RuleReviewStatus): string {
  if (status === "REFERENCE") return "资料可用";
  if (status === "REVIEW_REQUIRED") return "需要复核";
  return "暂不接入";
}

export function reviewStatusDescription(status: RuleReviewStatus): string {
  if (status === "REFERENCE") return "文字资料通过自动审计；尚未转换为可执行规则。";
  if (status === "REVIEW_REQUIRED") return "存在数值、门槛或结构冲突，不能直接进入权威结算。";
  return "源数据关键参数缺失，已从团包选择和自动结算中隔离。";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRuleTextKind(value: unknown): value is RuleTextKind {
  return ["external_move", "inner_art", "scene_method", "equipment", "medicine", "status", "manual", "mount", "document"].includes(String(value));
}

function isReviewStatus(value: unknown): value is RuleReviewStatus {
  return value === "REFERENCE" || value === "REVIEW_REQUIRED" || value === "QUARANTINED";
}
