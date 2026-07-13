import type { QiDie, QiNature, QiZone } from "../../../combat/types";

const NATURE_ORDER: Record<QiNature, number> = {
  yin: 0,
  yang: 1,
  raw: 2,
};

const NATURE_LABEL: Record<QiNature, string> = {
  yin: "阴",
  yang: "阳",
  raw: "原始",
};

const ZONE_LABEL: Record<QiZone, string> = {
  QI_POOL: "气池",
  QI_SEA: "气海",
  QI_LOCK: "锁气",
  QI_REST: "息库",
  TEMP_QI: "临气区",
  YIN_SLOT: "阴槽",
  YANG_SLOT: "阳槽",
};

/** Deterministic display order for available qi dice. */
export function compareQiDiceForPool(a: QiDie, b: QiDie): number {
  if (a.sides !== b.sides) return a.sides - b.sides;

  const natureDifference = NATURE_ORDER[a.nature] - NATURE_ORDER[b.nature];
  if (natureDifference !== 0) return natureDifference;

  const aValue = a.value ?? Number.NEGATIVE_INFINITY;
  const bValue = b.value ?? Number.NEGATIVE_INFINITY;
  if (aValue !== bValue) return bValue - aValue;

  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/** Sort without mutating the authoritative dice array supplied by the caller. */
export function sortQiDiceForPool(dice: readonly QiDie[]): QiDie[] {
  return [...dice].sort(compareQiDiceForPool);
}

/**
 * Compact a source for the always-visible card label while preserving its most
 * useful trailing detail (usually the inner art/equipment and root/effect).
 */
export function shortQiSourceName(sourceName: string, maxLength = 10): string {
  const normalized = sourceName.trim() || "未知来源";
  const parts = normalized.split("·").map((part) => part.trim()).filter(Boolean);
  const meaningfulParts = parts.length >= 3 ? parts.slice(-2) : parts;
  const candidate = meaningfulParts.join("·") || normalized;
  const characters = Array.from(candidate);

  if (characters.length <= maxLength) return candidate;

  const candidateParts = candidate.split("·");
  if (candidateParts.length >= 2) {
    const suffix = candidateParts.at(-1) ?? "";
    const prefix = candidateParts.slice(0, -1).join("·");
    const suffixLength = Array.from(suffix).length;
    const prefixBudget = maxLength - suffixLength - 2; // ellipsis + separator
    if (prefixBudget > 0) {
      return `${Array.from(prefix).slice(0, prefixBudget).join("")}…·${suffix}`;
    }
  }

  return `${characters.slice(0, Math.max(1, maxLength - 1)).join("")}…`;
}

/** Full accessible description; unlike the visible source label, it never truncates. */
export function qiDieAriaLabel(die: QiDie, isAssigned: boolean): string {
  const states = [
    die.temporary === true || die.zone === "TEMP_QI" ? "临时气骰" : undefined,
    die.zone === "QI_LOCK" ? "已锁" : undefined,
    isAssigned ? "已投入招式槽" : undefined,
  ].filter(Boolean);

  return [
    `${NATURE_LABEL[die.nature]}骰 D${die.sides}`,
    `点数${die.value ?? "未投"}`,
    `来源：${die.sourceName || "未知来源"}`,
    `区域：${ZONE_LABEL[die.zone]}`,
    ...states,
  ].join("，");
}
