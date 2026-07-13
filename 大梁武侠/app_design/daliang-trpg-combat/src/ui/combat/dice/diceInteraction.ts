import type { QiDie } from "../../../combat/types";

export type QiDieActivation =
  | "none"
  | "remove"
  | "assign-yin"
  | "assign-yang"
  | "choose-raw-slot";

/** Resolve click/keyboard activation without mutating declaration state. */
export function resolveQiDieActivation(
  die: QiDie,
  isAssigned: boolean,
  canAssign: boolean,
): QiDieActivation {
  if (!canAssign) return "none";
  if (isAssigned) return "remove";
  if (die.nature === "yin") return "assign-yin";
  if (die.nature === "yang") return "assign-yang";
  return "choose-raw-slot";
}
