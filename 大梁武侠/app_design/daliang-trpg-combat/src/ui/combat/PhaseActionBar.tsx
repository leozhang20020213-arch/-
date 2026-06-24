import type { FC } from "react";
import type { CombatState } from "../../combat/types";
import { phaseLabel } from "../utils/labels";

export interface PhaseActionBarProps {
  state: CombatState;
}

interface PhaseStep {
  phase: CombatState["phase"] | "momentum";
  label: string;
}

const COMBAT_FLOW: PhaseStep[] = [
  { phase: "declare", label: "宣言" },
  { phase: "intercept_window", label: "截击" },
  { phase: "react_window", label: "成招/应招" },
  { phase: "outcome", label: "落果" },
  { phase: "momentum", label: "势变化" },
  { phase: "round_end", label: "轮次结束" },
];

/**
 * Phase action bar (48px bottom bar).
 * Shows the combat phase flow as a sequence of steps.
 * Active phase is highlighted in gold; past phases in green.
 * This is currently a READ-ONLY indicator — Phase 2+ will add clickable buttons.
 */
export const PhaseActionBar: FC<PhaseActionBarProps> = ({ state }) => {
  const currentIdx = COMBAT_FLOW.findIndex((s) => s.phase === state.phase);
  const hasPending = Boolean(state.pendingAction);

  return (
    <div className="combat-phasebar">
      <span className="combat-phasebar__label">交锋阶段</span>

      <div className="combat-phasebar__steps">
        {COMBAT_FLOW.map((step, idx) => {
          const isActive = step.phase === state.phase;
          const isDone =
            currentIdx >= 0 && idx < currentIdx;
          return (
            <span key={step.phase}>
              {idx > 0 && <span className="combat-phasebar__arrow">→</span>}
              <span
                className={`combat-phasebar__step${isActive ? " active" : ""}${isDone ? " done" : ""}`}
              >
                {step.label}
              </span>
            </span>
          );
        })}
      </div>

      <span className="combat-phasebar__hint">
        {hasPending
          ? "有待结算宣言"
          : `当前阶段：${phaseLabel(state.phase)}`}
      </span>
    </div>
  );
};
