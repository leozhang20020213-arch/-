// ==========================================================================
// QiRecoveryActions — 调息与返照按钮
// Phase 4: regulate breath and return light actions.
// ==========================================================================

import { type FC, useState, useCallback } from "react";
import { canUseReturnLight } from "../../lib/dice/qiRecovery";
import "./dice.css";

export interface QiRecoveryActionsProps {
  /** Number of dice in rest pool */
  restPoolCount: number;
  /** Number of dice in qi sea */
  qiSeaCount: number;
  /** Whether return light has been used this combat */
  hasUsedReturnLight: boolean;
  /** Called when user clicks 调息 */
  onRegulateBreath: () => void;
  /** Called when user clicks 返照 */
  onReturnLight: () => void;
}

/**
 * Two action buttons: 调息 (regulate breath) and 返照 (return light).
 * Each shows disabled reason inline via toast when clicked while unavailable.
 */
export const QiRecoveryActions: FC<QiRecoveryActionsProps> = ({
  restPoolCount,
  qiSeaCount,
  hasUsedReturnLight,
  onRegulateBreath,
  onReturnLight,
}) => {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleBreath = useCallback(() => {
    if (restPoolCount === 0) {
      showToast("息库为空，无需调息。");
      return;
    }
    onRegulateBreath();
    showToast(`调息完成：${restPoolCount} 枚气骰回到气海。`);
  }, [restPoolCount, onRegulateBreath, showToast]);

  const returnCheck = canUseReturnLight({
    qiSeaDice: [],
    restPoolDice: [],
    hasUsedReturnLight,
  });
  // We can't pass actual dice here since we only have counts — use local check
  const handleReturnLight = useCallback(() => {
    if (qiSeaCount > 0) {
      showToast("气海不为空，不需要返照。");
      return;
    }
    if (restPoolCount === 0) {
      showToast("息库为空，无骰可取。");
      return;
    }
    if (hasUsedReturnLight) {
      showToast("本场交锋已返照（限一次）。");
      return;
    }
    onReturnLight();
    showToast("返照完成：已从息库取回一枚气骰。");
  }, [qiSeaCount, restPoolCount, hasUsedReturnLight, onReturnLight, showToast]);

  const breathDisabled = restPoolCount === 0;
  const lightDisabled = qiSeaCount > 0 || restPoolCount === 0 || hasUsedReturnLight;

  return (
    <div className="qi-recovery-actions">
      <button
        type="button"
        className={`qi-recovery-actions__btn qi-recovery-actions__btn--breath${breathDisabled ? " disabled" : ""}`}
        disabled={breathDisabled}
        onClick={handleBreath}
        title={breathDisabled ? "息库为空" : "将息库全部骰子回到气海并重新投掷"}
      >
        🫁 调息
      </button>

      <button
        type="button"
        className={`qi-recovery-actions__btn qi-recovery-actions__btn--light${lightDisabled ? " disabled" : ""}`}
        disabled={lightDisabled}
        onClick={handleReturnLight}
        title={
          qiSeaCount > 0 ? "气海不为空"
          : restPoolCount === 0 ? "息库为空"
          : hasUsedReturnLight ? "已返照（限一次）"
          : "从息库取最低骰阶一枚回到气海"
        }
      >
        ☀ 返照
        {hasUsedReturnLight && <span className="qi-recovery-actions__used-mark">已用</span>}
      </button>

      {toast && (
        <div className="qi-recovery-actions__toast">{toast}</div>
      )}
    </div>
  );
};
