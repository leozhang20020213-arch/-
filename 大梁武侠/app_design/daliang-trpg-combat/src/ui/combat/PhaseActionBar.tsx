import type { FC } from "react";
import type { CombatState } from "../../combat/types";
import {
  getAvailablePhaseActions,
  getPhaseHint,
  toDisplayPhase,
} from "../../lib/combat/combatPhaseMachine";

export interface PhaseActionBarProps {
  state: CombatState;
  /** Whether current user is DM */
  isDM: boolean;
  /** Whether move + target + slotted dice are ready */
  hasSelectedMove?: boolean;
  hasSelectedTarget?: boolean;
  hasSlottedDice?: boolean;
  /** Action callbacks — called when a phase button is clicked */
  onStartScene?: () => void;
  onEnterDeclaration?: () => void;
  onConfirmDeclaration?: () => void;
  onOpenResponse?: () => void;
  onIntercept?: () => void;
  onReact?: () => void;
  onSkipResponse?: () => void;
  onResolveResult?: () => void;
  onApplyMomentum?: () => void;
  onNextRound?: () => void;
}

/**
 * Phase action bar (48px bottom bar) — state-machine driven.
 *
 * Shows ONLY the buttons available for the current phase.
 * Disabled reasons go into a unified hint label, NOT on the buttons.
 * Player/DM labels differ where appropriate.
 */
export const PhaseActionBar: FC<PhaseActionBarProps> = ({
  state,
  isDM,
  hasSelectedMove,
  hasSelectedTarget,
  hasSlottedDice,
  onStartScene,
  onEnterDeclaration,
  onConfirmDeclaration,
  onOpenResponse,
  onIntercept,
  onReact,
  onSkipResponse,
  onResolveResult,
  onApplyMomentum,
  onNextRound,
}) => {
  const displayPhase = toDisplayPhase(state.phase);
  const hasPending = Boolean(state.pendingAction);

  const actions = getAvailablePhaseActions({
    phase: state.phase,
    hasPendingAction: hasPending,
    hasSelectedMove: hasSelectedMove ?? false,
    hasSelectedTarget: hasSelectedTarget ?? false,
    hasSlottedDice: hasSlottedDice ?? false,
    isDM,
    round: state.round,
  });

  // Filter to only visible actions for current role
  const visibleActions = actions.filter(
    (a) => a.visibleTo === "both" || a.visibleTo === (isDM ? "dm" : "player"),
  );

  const hint = getPhaseHint(state.phase, isDM, hasPending);

  // Map action type to click handler
  function handleClick(type: string) {
    switch (type) {
      case "START_SCENE": onStartScene?.(); break;
      case "START_DECLARATION": onEnterDeclaration?.(); break;
      case "CONFIRM_DECLARATION": onConfirmDeclaration?.(); break;
      case "OPEN_RESPONSE_WINDOW": onOpenResponse?.(); break;
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

  // Collect disabled reasons for display
  const disabledHints = visibleActions
    .filter((a) => !a.enabled && a.disabledReason)
    .map((a) => a.disabledReason);

  return (
    <div className="combat-phasebar">
      <span className="combat-phasebar__label">{displayPhase}</span>

      <div className="combat-phasebar__actions">
        {visibleActions.map((a) => (
          <button
            key={a.type}
            className={`combat-phasebar__btn${a.enabled ? "" : " disabled"}`}
            type="button"
            disabled={!a.enabled}
            onClick={() => handleClick(a.type)}
          >
            {actionLabel(a)}
          </button>
        ))}
      </div>

      <span className="combat-phasebar__hint">
        {disabledHints.length > 0 ? disabledHints.join(" · ") : hint}
      </span>
    </div>
  );
};
