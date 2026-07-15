export type AvailabilityDimension =
  | "mode" | "timepoint" | "distance" | "target" | "equipment"
  | "momentum" | "qi" | "response_budget" | "permission";

export interface AvailabilityCheck {
  dimension: AvailabilityDimension;
  status: "pass" | "fail" | "not_applicable" | "not_evaluated";
  reason?: string;
}

/** Shared engine/UI contract for explaining why an action can or cannot run. */
export interface AvailabilityResult {
  available: boolean;
  checks: AvailabilityCheck[];
  reasons: string[];
}

export function createAvailabilityResult(checks: AvailabilityCheck[]): AvailabilityResult {
  const reasons = checks
    .filter((check) => check.status === "fail" && check.reason)
    .map((check) => check.reason as string);
  return { available: reasons.length === 0, checks, reasons };
}
