// ==========================================================================
// Turn Order — Pure functions for action queue and turn state.
// Reads CombatState, computes initiative-based actor order and turn metadata.
// ==========================================================================

import type { Actor, CombatState, ShiState } from "../../combat/types";
import { canSpendResponseBudget, normalizeResponseBudget } from "../../domain/session/runtime";

// ---- Data Types ----

export interface TurnOrderEntry {
  actorId: string;
  name: string;
  /** Initiative score = approved attribute + highest usable qi die + modifier */
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

/** The normal initiative attribute, or 观照 when the DM has approved it. */
export type InitiativeAttribute = "身势" | "观照";

/**
 * Per-encounter initiative rulings that are not represented directly on Actor.
 * Missing entries deliberately fall back to 身势 and the standard status rules.
 */
export interface InitiativeOptions {
  /** Actors explicitly approved to use 观照 may be mapped to it here. */
  approvedAttributeByActorId?: Readonly<Record<string, InitiativeAttribute>>;
  /**
   * Total status/scene modifier for an actor. When omitted, known standard
   * status modifiers are derived from the actor's current statuses.
   */
  statusModifierByActorId?: Readonly<Record<string, number>>;
}

export interface InitiativeBreakdown {
  attribute: InitiativeAttribute;
  attributeValue: number;
  highestUsableQi: number;
  statusModifier: number;
  total: number;
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
  round_end: "出手结束",
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
 *   1. Sort by initiative descending
 *      (approved 身势/观照 + highest currently usable qi die + modifier)
 *   2. Tie-break: player side before enemy side
 *   3. Tie-break: name alphabetical (zh-CN)
 */
export function computeTurnOrder(
  state: CombatState,
  actedActorIds: ReadonlySet<string> = new Set(),
  options: InitiativeOptions = {},
): TurnOrderEntry[] {
  const actors = [...state.actors];
  const initiativeByActorId = new Map(
    actors.map((actor) => [
      actor.id,
      calculateInitiativeForActor(state, actor, options).total,
    ]),
  );

  // Sort by initiative descending
  actors.sort((a, b) => {
    const aInit = initiativeByActorId.get(a.id) ?? 0;
    const bInit = initiativeByActorId.get(b.id) ?? 0;
    if (bInit !== aInit) return bInit - aInit;
    // Player side first on tie
    if (a.side !== b.side) return a.side === "player" ? -1 : 1;
    // Name alphabetical
    return a.name.localeCompare(b.name, "zh-Hans-CN");
  });

  const isResponseWindow =
    state.phase === "intercept_window" || state.phase === "react_window";

  return actors.map((actor) => {
    const initiative = initiativeByActorId.get(actor.id) ?? 0;
    const isCurrent = actor.id === state.activeActorId;
    const hasActed = actedActorIds.has(actor.id);

    // Acting earlier in the round does not spend or remove response eligibility.
    const responseBudget = normalizeResponseBudget(
      actor.responseBudget,
      actor.responseQuotaUsed,
      actor.maxResponseQuota,
    );
    const canRespond =
      isResponseWindow &&
      !isCurrent &&
      actor.hp > 0 &&
      (canSpendResponseBudget(responseBudget, "proactive")
        || canSpendResponseBudget(responseBudget, "self_defense"));

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
 * Calculate one actor's initiative and expose the components for UI/audit use.
 */
export function calculateInitiative(
  state: CombatState,
  actorId: string,
  options: InitiativeOptions = {},
): InitiativeBreakdown {
  const actor = state.actors.find((candidate) => candidate.id === actorId);
  if (!actor) {
    throw new Error(`Unknown actor for initiative: ${actorId}`);
  }
  return calculateInitiativeForActor(state, actor, options);
}

function calculateInitiativeForActor(
  state: CombatState,
  actor: Actor,
  options: InitiativeOptions,
): InitiativeBreakdown {
  const attribute = options.approvedAttributeByActorId?.[actor.id] ?? "身势";
  const attributeValue = actor.tableAttrs[attribute];
  const highestUsableQi = state.dice.reduce((highest, die) => {
    const isCurrentlyUsable = die.zone === "QI_SEA" || die.zone === "TEMP_QI";
    if (
      die.ownerId !== actor.id ||
      !isCurrentlyUsable ||
      die.value === null
    ) {
      return highest;
    }
    return Math.max(highest, die.value);
  }, 0);

  const configuredModifier = options.statusModifierByActorId?.[actor.id];
  const statusModifier = typeof configuredModifier === "number" && Number.isFinite(configuredModifier)
    ? configuredModifier
    : standardStatusModifier(actor);

  return {
    attribute,
    attributeValue,
    highestUsableQi,
    statusModifier,
    total: attributeValue + highestUsableQi + statusModifier,
  };
}

/** Known numeric initiative effects from the current rulebook. */
function standardStatusModifier(actor: Actor): number {
  const statuses = [...actor.statuses, ...(actor.hiddenStatuses ?? [])];
  return statuses.some((status) => status.name === "迟滞" && status.layers >= 3)
    ? -2
    : 0;
}

/**
 * Derive full TurnState from CombatState + optional acted-set.
 */
export function deriveTurnState(
  state: CombatState,
  actedActorIds: ReadonlySet<string> = new Set(),
  options: InitiativeOptions = {},
): TurnState {
  return {
    round: state.round,
    phase: state.phase,
    shortPhase: shortPhaseLabel(state.phase),
    currentActorId: state.activeActorId,
    order: computeTurnOrder(state, actedActorIds, options),
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
