// ==========================================================================
// Qi Dice Assignment Rules — 大梁江湖 TRPG 气骰投入规则
// Phase 2: validate drop legality for yin/yang slots.
// ==========================================================================

import type { QiDieData, QiSlotType, CurrentMoveQiRequirement } from "../../types/dice";

/**
 * Can this die be dropped into this slot?
 * - 阴骰 → 阴槽
 * - 阳骰 → 阳槽
 * - 原始骰 → 任意槽
 * - 已锁定骰 → 不可
 */
export function canDropDieToSlot(
  die: QiDieData,
  slot: QiSlotType,
): boolean {
  if (die.locked) return false;
  if (die.kind === "raw") return true;
  if (slot === "yinSlot") return die.kind === "yin";
  if (slot === "yangSlot") return die.kind === "yang";
  return false;
}

/**
 * Human-readable reason why a die can't be dropped.
 * Returns null if the drop is legal.
 */
export function getDropRejectReason(
  die: QiDieData,
  slot: QiSlotType,
): string | null {
  if (die.locked) return "该气骰已锁定";
  if (die.kind === "raw") return null;
  if (slot === "yinSlot" && die.kind !== "yin") return "阳骰不能投入阴槽";
  if (slot === "yangSlot" && die.kind !== "yang") return "阴骰不能投入阳槽";
  return null;
}

/**
 * Check whether the current assignment satisfies the move requirement.
 */
export function hasEnoughDiceForMove(
  yinCount: number,
  yangCount: number,
  requirement: CurrentMoveQiRequirement | null,
): { satisfied: boolean; missingYin: number; missingYang: number } {
  if (!requirement) {
    return { satisfied: false, missingYin: 0, missingYang: 0 };
  }
  const missingYin = Math.max(0, requirement.minYin - yinCount);
  const missingYang = Math.max(0, requirement.minYang - yangCount);
  return {
    satisfied: missingYin === 0 && missingYang === 0,
    missingYin,
    missingYang,
  };
}

/**
 * Default move requirement when no move is selected.
 */
export const NO_MOVE_SELECTED: CurrentMoveQiRequirement = {
  moveId: "",
  moveName: "",
  minYin: 0,
  minYang: 0,
};

/**
 * Calculate the sum of dice values in an array.
 */
export function sumDiceValues(dice: QiDieData[]): number {
  return dice.reduce((sum, d) => sum + d.value, 0);
}

/**
 * Get slot color based on type.
 */
export function slotColorClass(slot: QiSlotType): string {
  return slot === "yinSlot" ? "slot--yin" : "slot--yang";
}

/**
 * Get slot Chinese label.
 */
export function slotLabel(slot: QiSlotType): string {
  return slot === "yinSlot" ? "阴槽" : "阳槽";
}
