// ==========================================================================
// Scene Clock — Unified scene progress tracks.
// Replaces the old separate 危机值 / 解密值 / 巡检注意 system.
// ==========================================================================

import type { SceneTrack } from "./types";

// ---- Clock Types ----

export type SceneClockType =
  | "crisis"       // 危机 — e.g., fire spreading, enemies closing in
  | "investigation" // 调查/解密 — e.g., discovering clues
  | "chase"        // 追逐 — e.g., catching or escaping
  | "alarm"        // 警戒 — e.g., patrol awareness
  | "ritual"       // 仪式 — e.g., ritual progress
  | "custom";      // 自定义

export interface SceneClock {
  id: string;
  name: string;
  type: SceneClockType;
  value: number;
  max: number;
  /** One-line trigger summary (≤20 chars if possible) */
  triggerSummary: string;
  /** One-line consequence when max is reached */
  consequenceSummary: string;
  /** Full detail (moved to drawer / tooltip) */
  detail?: string;
  /** Is this the primary clock shown expanded? Others are collapsed. */
  isPrimary: boolean;
  /** Whether hidden from players */
  hidden?: boolean;
}

// ---- Display helpers ----

const CLOCK_TYPE_ICONS: Record<SceneClockType, string> = {
  crisis: "🔥",
  investigation: "🔍",
  chase: "🏃",
  alarm: "🔔",
  ritual: "✨",
  custom: "📋",
};

const CLOCK_TYPE_LABELS: Record<SceneClockType, string> = {
  crisis: "危机",
  investigation: "调查",
  chase: "追逐",
  alarm: "警戒",
  ritual: "仪式",
  custom: "进度",
};

export function clockIcon(type: SceneClockType): string {
  return CLOCK_TYPE_ICONS[type] ?? "📋";
}

export function clockTypeLabel(type: SceneClockType): string {
  return CLOCK_TYPE_LABELS[type] ?? "进度";
}

/**
 * Compact summary line for a clock (≤60 chars total).
 * Format: 🔔 巡检注意 3/10 ｜ 大声喧哗 +1
 */
export function clockCompactLine(clock: SceneClock): string {
  const trigger = clock.triggerSummary ? ` ｜ ${clock.triggerSummary}` : "";
  return `${clockIcon(clock.type)} ${clock.name} ${clock.value}/${clock.max}${trigger}`;
}

/**
 * Percentage filled.
 */
export function clockPercent(clock: SceneClock): number {
  if (clock.max <= 0) return 0;
  return Math.round((clock.value / clock.max) * 100);
}

// ---- Migration: old SceneTrack → SceneClock ----

const TYPE_MAP: Record<string, SceneClockType> = {
  "解密值": "investigation",
  "危机值": "crisis",
  "巡检注意": "alarm",
  "逃离危机": "crisis",
};

const TRIGGER_MAP: Record<string, string> = {
  "track-clue": "调查现场、读取痕迹 +1",
  "track-patrol": "大声喧哗、亮出兵刃 +1",
  "track-escape": "拖延时间、被发现 +1",
};

const CONSEQUENCE_MAP: Record<string, string> = {
  "track-clue": "达到8时查明全部线索",
  "track-patrol": "达到10时官府介入",
  "track-escape": "达到8时敌人撤离或局势失控",
};

/**
 * Migrate old SceneTrack[] to SceneClock[].
 * Preserves all existing data, maps track names to clock types.
 */
export function migrateTracksToClocks(tracks: SceneTrack[]): SceneClock[] {
  return tracks.map((track, index) => {
    const clockType = TYPE_MAP[track.name] ?? "custom";
    return {
      id: track.id,
      name: track.name,
      type: clockType,
      value: track.value,
      max: track.max,
      triggerSummary: TRIGGER_MAP[track.id] ?? "",
      consequenceSummary: CONSEQUENCE_MAP[track.id] ?? "",
      detail: track.description,
      isPrimary: index === 0, // First track is primary
      hidden: track.hidden ?? false,
    };
  });
}

/**
 * Build clocks from CombatState tracks.
 */
export function getSceneClocks(tracks: SceneTrack[]): SceneClock[] {
  return migrateTracksToClocks(tracks);
}

/**
 * Get only visible clocks (non-hidden).
 */
export function getVisibleClocks(clocks: SceneClock[]): SceneClock[] {
  return clocks.filter((c) => !c.hidden);
}

/**
 * Get the primary (expanded) clock, or the first visible one.
 */
export function getPrimaryClock(clocks: SceneClock[]): SceneClock | undefined {
  return clocks.find((c) => c.isPrimary) ?? clocks[0];
}
