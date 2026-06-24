// ==========================================================================
// PhasePromptBar — Unified bottom prompt & action bar
// Phase 8: merges PlayerPromptBar + PhaseActionBar into a single bar.
// ==========================================================================

import { type FC } from "react";
import type { CombatState } from "../../../combat/types";
import {
  getAvailablePhaseActions,
  getPhaseHint,
  toDisplayPhase,
} from "../../../lib/combat/combatPhaseMachine";

export interface PhasePromptBarProps {
  state: CombatState;
  isDM: boolean;
  /** Action callbacks */
  onStartScene?: () => void;
  onEnterDeclaration?: () => void;
  onConfirmDeclaration?: () => void;
  onIntercept?: () => void;
  onReact?: () => void;
  onSkipResponse?: () => void;
  onResolveResult?: () => void;
  onApplyMomentum?: () => void;
  onNextRound?: () => void;
}

/**
 * Unified bottom bar (60px) showing:
 *   Left: natural-language prompt ("第1轮，沈青行动中。请选择招式、目标，并投入气骰。")
 *   Right: phase-specific action buttons
 */
export const PhasePromptBar: FC<PhasePromptBarProps> = ({
  state,
  isDM,
  onStartScene,
  onEnterDeclaration,
  onConfirmDeclaration,
  onIntercept,
  onReact,
  onSkipResponse,
  onResolveResult,
  onApplyMomentum,
  onNextRound,
}) => {
  const displayPhase = toDisplayPhase(state.phase);
  const hasPending = Boolean(state.pendingAction);
  const activeActor = state.actors.find((a) => a.id === state.activeActorId);
  const actorName = activeActor?.name ?? "—";

  const actions = getAvailablePhaseActions({
    phase: state.phase,
    hasPendingAction: hasPending,
    hasSelectedMove: false,
    hasSelectedTarget: false,
    hasSlottedDice: false,
    isDM,
    round: state.round,
  });

  const visibleActions = actions.filter(
    (a) => a.visibleTo === "both" || a.visibleTo === (isDM ? "dm" : "player"),
  );

  function handleClick(type: string) {
    switch (type) {
      case "START_SCENE": onStartScene?.(); break;
      case "START_DECLARATION": onEnterDeclaration?.(); break;
      case "CONFIRM_DECLARATION": onConfirmDeclaration?.(); break;
      case "DECLARE_INTERCEPT": onIntercept?.(); break;
      case "DECLARE_RESPONSE": onReact?.(); break;
      case "SKIP_RESPONSE": onSkipResponse?.(); break;
      case "RESOLVE_RESULT": onResolveResult?.(); break;
      case "APPLY_MOMENTUM": onApplyMomentum?.(); break;
      case "NEXT_ROUND": onNextRound?.(); break;
    }
  }

  function actionLabel(a: typeof visibleActions[0]): string {
    if (isDM && a.dmLabel) return a.dmLabel;
    if (!isDM && a.playerLabel) return a.playerLabel;
    return a.label;
  }

  /** Natural-language prompt */
  function promptText(): string {
    switch (displayPhase) {
      case "未开始":
        return isDM ? "等待开始场景。" : "等待主持人开始场景。";
      case "准备":
        return `第${state.round}轮，${actorName}行动中。请选择招式与目标。`;
      case "宣言":
        if (hasPending) return "宣言已提交，等待主持人确认。";
        return `第${state.round}轮，${actorName}行动中。请选择招式、目标，并投入气骰。`;
      case "响应":
        return "等待主持人确认响应窗口。";
      case "计算":
        return "等待主持人裁定应招结果。";
      case "结算":
        return "本轮结算完成，请查看结果。";
      case "势变化":
        return "等待主持人推进下一轮。";
      case "结束":
        return "场景已结束。";
      default:
        return "等待主持人推进。";
    }
  }

  return (
    <div className="phase-prompt-bar">
      {/* Left: prompt icon + text */}
      <div className="phase-prompt-bar__prompt">
        <span className="phase-prompt-bar__icon">⚔</span>
        <span className="phase-prompt-bar__text">{promptText()}</span>
      </div>

      {/* Center spacer */}
      <div style={{ flex: 1 }} />

      {/* Right: action buttons */}
      <div className="phase-prompt-bar__actions">
        {visibleActions.map((a) => (
          <button
            key={a.type}
            className={`phase-prompt-bar__btn${a.enabled ? "" : " disabled"}`}
            type="button"
            disabled={!a.enabled}
            onClick={() => handleClick(a.type)}
          >
            {actionLabel(a)}
          </button>
        ))}
      </div>

      {/* Phase label */}
      <span className="phase-prompt-bar__phase">{displayPhase}</span>
    </div>
  );
};
