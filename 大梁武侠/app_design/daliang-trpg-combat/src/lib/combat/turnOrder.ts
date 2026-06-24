// ==========================================================================
// Turn Order — Pure functions for action queue and turn state.
// Reads CombatState, computes initiative-based actor order and turn metadata.
// ==========================================================================

import type { CombatState, ShiState } from "../../combat/types";

// ---- Data Types ----

export interface TurnOrderEntry {
  actorId: string;
  name: string;
  /** Initiative score = 观照 + 身势 */
  initiative: number;
  /** Has this actor already taken their action this round? */
  hasActed: boolean;
  /** Is this the currently active actor? */
  isCurrent: boolean;
  /** Can this actor respond (intercept/react) in the current window? */
  canRespond: boolean;
  /** Current momentum state */
  momentum: ShiState;
  /** Is the actor dying (hp <= 0)? */
  isDying: boolean;
  /** Side: player or enemy */
  side: "player" | "enemy";
  /** Short status tags for display */
  statusTags: string[];
}

export interface TurnState {
  round: number;
  phase: CombatState["phase"];
  /** 12-char max short phase label */
  shortPhase: string;
  currentActorId: string;
  /** Initiative-ordered actor queue */
  order: TurnOrderEntry[];
  /** Whether we're in a response window (intercept or react) */
  isResponseWindow: boolean;
}

// ---- Short phase labels (≤12 chars) ----

const SHORT_PHASE_MAP: Record<CombatState["phase"], string> = {
  setup: "准备开始",
  initiative: "先后确认",
  scene: "可宣言",
  declare: "宣言中",
  intercept_window: "等待截击",
  react_window: "等待应招",
  outcome: "结算中",
  round_end: "轮次结束",
};

/**
 * Get a compact phase label (≤12 chars).
 */
export function shortPhaseLabel(phase: CombatState["phase"]): string {
  return SHORT_PHASE_MAP[phase] ?? phase;
}

// ---- Turn Order Computation ----

/**
 * Compute initiative-ordered turn queue from CombatState.
 *
 * Ordering rules:
 *   1. Sort by initiative descending (观照 + 身势)
 *   2. Tie-break: player side before enemy side
 *   3. Tie-break: name alphabetical (zh-CN)
 */
export function computeTurnOrder(
  state: CombatState,
  actedActorIds: Set<string> = new Set(),
): TurnOrderEntry[] {
  const actors = [...state.actors];

  // Sort by initiative descending
  actors.sort((a, b) => {
    const aInit = a.tableAttrs.观照 + a.tableAttrs.身势;
    const bInit = b.tableAttrs.观照 + b.tableAttrs.身势;
    if (bInit !== aInit) return bInit - aInit;
    // Player side first on tie
    if (a.side !== b.side) return a.side === "player" ? -1 : 1;
    // Name alphabetical
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });

  const isResponseWindow =
    state.phase === "intercept_window" || state.phase === "react_window";

  return actors.map((actor) => {
    const initiative = actor.tableAttrs.观照 + actor.tableAttrs.身势;
    const isCurrent = actor.id === state.activeActorId;
    const hasActed = actedActorIds.has(actor.id);

    // Can respond: in response window, not the declarer, not dying, has quota remaining
    const canRespond =
      isResponseWindow &&
      !isCurrent &&
      actor.hp > 0 &&
      actor.responseQuotaUsed < actor.maxResponseQuota &&
      !hasActed;

    return {
      actorId: actor.id,
      name: actor.name,
      initiative,
      hasActed,
      isCurrent,
      canRespond,
      momentum: actor.momentum,
      isDying: actor.hp <= 0,
      side: actor.side === "player" ? "player" : "enemy",
      statusTags: actor.statuses
        .filter((s) => s.public)
        .map((s) => s.name),
    };
  });
}

/**
 * Derive full TurnState from CombatState + optional acted-set.
 */
export function deriveTurnState(
  state: CombatState,
  actedActorIds: Set<string> = new Set(),
): TurnState {
  return {
    round: state.round,
    phase: state.phase,
    shortPhase: shortPhaseLabel(state.phase),
    currentActorId: state.activeActorId,
    order: computeTurnOrder(state, actedActorIds),
    isResponseWindow:
      state.phase === "intercept_window" || state.phase === "react_window",
  };
}

/**
 * Get the index of the next actor in the turn order who hasn't acted.
 * Returns -1 if all have acted.
 */
export function findNextActorIndex(
  order: TurnOrderEntry[],
  currentIndex: number,
): number {
  const len = order.length;
  for (let i = 1; i <= len; i++) {
    const idx = (currentIndex + i) % len;
    if (!order[idx].hasActed && !order[idx].isDying) {
      return idx;
    }
  }
  return -1; // All acted
}

/**
 * Get the current actor's index in the turn order.
 */
export function getCurrentActorIndex(order: TurnOrderEntry[]): number {
  return order.findIndex((e) => e.isCurrent);
}

/**
 * Human-readable turn order for screen-reader / alt text.
 * e.g. "沈青 → 短兵客 → 黑衣脚夫"
 */
export function turnOrderAria(order: TurnOrderEntry[]): string {
  return order
    .map((e) => {
      let label = e.name;
      if (e.isCurrent) label += "（当前行动）";
      if (e.hasActed) label += "（已行动）";
      if (e.isDying) label += "（濒死）";
      return label;
    })
    .join(" → ");
}
