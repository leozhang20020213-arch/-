// ==========================================================================
// QiDeclarationSummary — Shows the locked declaration summary.
// Phase 3: display after lock, before/after resolution.
// ==========================================================================

import { type FC } from "react";
import type { LockedQiDeclaration, QiDeclarationStatus } from "../../types/dice";
import { getDeclarationSummary } from "../../lib/dice/qiDeclaration";
import "./dice.css";

export interface QiDeclarationSummaryProps {
  declaration: LockedQiDeclaration;
  status: QiDeclarationStatus;
  /** Called when user clicks "模拟结算" */
  onResolve?: () => void;
  /** Called when user clicks "重置宣言" */
  onReset?: () => void;
}

/**
 * Shows the current declaration state and provides action buttons.
 */
export const QiDeclarationSummary: FC<QiDeclarationSummaryProps> = ({
  declaration,
  status,
  onResolve,
  onReset,
}) => {
  const summary = getDeclarationSummary(declaration);

  return (
    <div className={`qi-decl-summary qi-decl-summary--${status}`}>
      {/* Header */}
      <div className="qi-decl-summary__header">
        <span className="qi-decl-summary__badge">
          {status === "locked" ? "🔒 已锁气" : status === "resolved" ? "✅ 已结算" : ""}
        </span>
        <span className="qi-decl-summary__move">
          {summary.moveName} → {summary.targetName}
        </span>
      </div>

      {/* Dice detail */}
      <div className="qi-decl-summary__detail">
        <span className="qi-decl-summary__slot-detail">
          阴槽 {summary.yinCount} 枚：{summary.yinDetail}
          {summary.yinCount > 0 && `（合${summary.yinTotal}）`}
        </span>
        <span className="qi-decl-summary__slot-detail">
          阳槽 {summary.yangCount} 枚：{summary.yangDetail}
          {summary.yangCount > 0 && `（合${summary.yangTotal}）`}
        </span>
        <span className="qi-decl-summary__time">
          {new Date(declaration.createdAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Action buttons */}
      <div className="qi-decl-summary__actions">
        {status === "locked" && onResolve && (
          <button
            type="button"
            className="qi-decl-summary__btn qi-decl-summary__btn--resolve"
            onClick={onResolve}
          >
            模拟结算：气骰入息库
          </button>
        )}
        {(status === "locked" || status === "resolved") && onReset && (
          <button
            type="button"
            className="qi-decl-summary__btn qi-decl-summary__btn--reset"
            onClick={onReset}
          >
            重置宣言
          </button>
        )}
      </div>
    </div>
  );
};
