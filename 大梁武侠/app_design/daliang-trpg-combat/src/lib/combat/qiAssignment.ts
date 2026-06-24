// ==========================================================================
// Qi Assignment — Pure validation functions for dice drag-and-drop flow.
// No side effects, no state mutation. Used by QiDiceDock and CurrentMoveSlots.
// ==========================================================================

import type { QiDie, CombatState } from "../../combat/types";

// ---- Drop validation ----

export type SlotKind = "yin" | "yang";

/**
 * Can this die be dragged to this slot?
 * - 阴骰 → 阴槽
 * - 阳骰 → 阳槽
 * - 原始骰 → 任意槽
 * - Die must be in QI_SEA or TEMP_QI zone
 * - Die must belong to the active actor
 */
export function canDropDieToSlot(
  die: QiDie,
  slot: SlotKind,
  activeActorId: string,
): boolean {
  // Must be the active actor's die
  if (die.ownerId !== activeActorId) return false;
  // Must be in sea or temp
  if (die.zone !== "QI_SEA" && die.zone !== "TEMP_QI") return false;

  if (die.nature === "raw") return true;
  if (die.nature === "yin" && slot === "yin") return true;
  if (die.nature === "yang" && slot === "yang") return true;
  return false;
}

/**
 * Can the player start dragging dice at all?
 * Requires: active move selected, active target selected, valid phase.
 */
export function canStartDragging(
  state: CombatState,
  hasSelectedMove: boolean,
  hasSelectedTarget: boolean,
): boolean {
  if (!hasSelectedMove) return false;
  if (!hasSelectedTarget) return false;
  if (state.phase !== "declare" && state.phase !== "scene") return false;
  return true;
}

// ---- Confirmation validation ----

export interface ConfirmCheck {
  allowed: boolean;
  reasons: string[];
}

/**
 * Can the player confirm declaration and lock qi?
 * Conditions:
 *   1. Phase is declare (or scene with pending action)
 *   2. Move is selected
 *   3. Target is selected
 *   4. Yin slot has at least 1 die (for formal moves)
 *   5. Yang slot has at least 1 die (for formal moves)
 *   6. At least one die assigned total
 */
export function canConfirmDeclaration(params: {
  phase: CombatState["phase"];
  hasSelectedMove: boolean;
  hasSelectedTarget: boolean;
  yinCount: number;
  yangCount: number;
  requiresBothSlots: boolean; // true for formal moves, false for quick actions
}): ConfirmCheck {
  const reasons: string[] = [];

  if (!params.hasSelectedMove) {
    reasons.push("未选择招式");
  }
  if (!params.hasSelectedTarget) {
    reasons.push("未选择目标");
  }
  if (params.phase !== "declare" && params.phase !== "scene") {
    reasons.push("当前阶段不可宣言");
  }

  const totalAssigned = params.yinCount + params.yangCount;
  if (totalAssigned === 0) {
    reasons.push("至少需要投入一枚气骰");
  }

  if (params.requiresBothSlots) {
    if (params.yinCount === 0) {
      reasons.push("正式出手至少需要一枚阴骰");
    }
    if (params.yangCount === 0) {
      reasons.push("正式出手至少需要一枚阳骰");
    }
  }

  return {
    allowed: reasons.length === 0,
    reasons,
  };
}

// ---- Drag hint text ----

export function getDropHint(
  die: QiDie,
  slot: SlotKind,
  hasSelectedMove: boolean,
  hasSelectedTarget: boolean,
): string | null {
  if (!hasSelectedMove) return "请先选择招式";
  if (!hasSelectedTarget) return "请先选择目标";
  if (die.ownerId === "") return "";
  if (die.zone !== "QI_SEA" && die.zone !== "TEMP_QI") return "此骰不在气海或临气区";
  if (die.nature === "raw") return null; // always valid
  if (slot === "yin" && die.nature !== "yin") return "阴槽只能投入阴骰或原始骰";
  if (slot === "yang" && die.nature !== "yang") return "阳槽只能投入阳骰或原始骰";
  return null; // valid
}
