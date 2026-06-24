// ==========================================================================
// QiRequirementStatus — Shows move requirements vs current assignment.
// Phase 3: compact status indicator for yin/yang slot requirements.
// ==========================================================================

import { type FC } from "react";
import type { CurrentMoveQiRequirement } from "../../types/dice";
import "./dice.css";

export interface QiRequirementStatusProps {
  requirement: CurrentMoveQiRequirement | null;
  yinCount: number;
  yangCount: number;
  yinTotal: number;
  yangTotal: number;
}

/**
 * Compact requirement-status line.
 * Shows move name, target, and per-slot fill status.
 */
export const QiRequirementStatus: FC<QiRequirementStatusProps> = ({
  requirement,
  yinCount,
  yangCount,
  yinTotal,
  yangTotal,
}) => {
  if (!requirement || !requirement.moveId) {
    return (
      <div className="qi-req-status qi-req-status--empty">
        <span>尚未选择招式</span>
      </div>
    );
  }

  const yinMet = yinCount >= requirement.minYin;
  const yangMet = yangCount >= requirement.minYang;

  return (
    <div className="qi-req-status">
      <span className="qi-req-status__move">{requirement.moveName}</span>

      <span className={`qi-req-status__slot ${yinMet ? "met" : ""}`}>
        阴槽：{yinCount}/{requirement.minYin}
        {yinMet ? " ✓" : requirement.minYin > 0 ? " ✗" : ""}
        {yinCount > 0 && ` (合${yinTotal})`}
      </span>

      <span className={`qi-req-status__slot ${yangMet ? "met" : ""}`}>
        阳槽：{yangCount}/{requirement.minYang}
        {yangMet ? " ✓" : requirement.minYang > 0 ? " ✗" : ""}
        {yangCount > 0 && ` (合${yangTotal})`}
      </span>
    </div>
  );
};
