// ==========================================================================
// Combat Phase State Machine — Pure functions for phase transitions.
// Maps engine CombatState.phase to display phases and available actions.
// ==========================================================================

import type { CombatState } from "../../combat/types";

// ---- Display-phase mapping ----
// Engine phases (CombatState["phase"]):
//   "setup" | "initiative" | "scene" | "declare" | "intercept_window"
//   | "react_window" | "outcome" | "round_end"
//
// Display phases — grouped for UI simplicity:
export type DisplayPhase =
  | "未开始"
  | "准备"
  | "宣言"
  | "计算"
  | "响应"
  | "结算"
  | "势变化"
  | "结束";

/** Map engine phase → display phase */
export function toDisplayPhase(phase: CombatState["phase"]): DisplayPhase {
  switch (phase) {
    case "setup":
    case "initiative":
      return "准备";
    case "scene":
    case "declare":
      return "宣言";
    case "intercept_window":
      return "响应";
    case "react_window":
      return "计算";
    case "outcome":
      return "结算";
    case "round_end":
      return "势变化";
    default:
      return "未开始";
  }
}

// ---- Action Types ----

export type PhaseActionType =
  | "START_SCENE"
  | "START_DECLARATION"
  | "CONFIRM_DECLARATION"
  | "OPEN_RESPONSE_WINDOW"
  | "DECLARE_INTERCEPT"
  | "DECLARE_RESPONSE"
  | "SKIP_RESPONSE"
  | "RESOLVE_RESULT"
  | "APPLY_MOMENTUM"
  | "NEXT_ROUND"
  | "END_SCENE";

// ---- Action Definition ----

export interface PhaseAction {
  type: PhaseActionType;
  label: string;
  /** Player-facing label */
  playerLabel?: string;
  /** DM-facing label */
  dmLabel?: string;
  /** Who can see this action? */
  visibleTo: "player" | "dm" | "both";
  /** Is this action currently available? */
  enabled: boolean;
  /** Reason why it's disabled (empty if enabled) */
  disabledReason: string;
}

// ---- Action availability per phase ----

interface ActionCheckInput {
  phase: CombatState["phase"];
  hasPendingAction: boolean;
  hasSelectedMove: boolean;
  hasSelectedTarget: boolean;
  hasSlottedDice: boolean;  // at least 1 yin + 1 yang
  isDM: boolean;
  round: number;
}

/**
 * Get all actions that COULD be available in this phase.
 * Each action carries its own enabled/disabled state.
 */
export function getAvailablePhaseActions(input: ActionCheckInput): PhaseAction[] {
  const displayPhase = toDisplayPhase(input.phase);
  const actions: PhaseAction[] = [];

  switch (displayPhase) {
    case "未开始":
      actions.push({
        type: "START_SCENE",
        label: "开始场景",
        visibleTo: "both",
        enabled: true,
        disabledReason: "",
      });
      break;

    case "准备":
      actions.push({
        type: "START_DECLARATION",
        label: "进入宣言",
        dmLabel: "进入宣言阶段",
        visibleTo: "both",
        enabled: true,
        disabledReason: "",
      });
      break;

    case "宣言":
      actions.push({
        type: "CONFIRM_DECLARATION",
        label: "确认宣言并锁气",
        visibleTo: "both",
        enabled: input.hasSelectedMove && input.hasSelectedTarget && input.hasSlottedDice,
        disabledReason: [
          !input.hasSelectedMove && "未选择招式",
          !input.hasSelectedTarget && "未选择目标",
          !input.hasSlottedDice && "阴槽/阳槽未满足需求",
        ].filter(Boolean).join("、"),
      });
      actions.push({
        type: "OPEN_RESPONSE_WINDOW",
        label: "截击窗口",
        dmLabel: "开启截击窗口",
        playerLabel: "等待确认截击",
        visibleTo: "both",
        enabled: input.hasPendingAction && input.isDM,
        disabledReason: !input.hasPendingAction
          ? "没有待结算宣言"
          : !input.isDM
            ? "等待主持人确认截击窗口"
            : "",
      });
      break;

    case "响应":
      actions.push({
        type: "DECLARE_INTERCEPT",
        label: "截击",
        visibleTo: "dm",
        enabled: input.hasPendingAction && input.isDM,
        disabledReason: !input.hasPendingAction ? "没有待结算宣言" : "",
      });
      actions.push({
        type: "SKIP_RESPONSE",
        label: "放弃响应",
        visibleTo: "dm",
        enabled: input.isDM,
        disabledReason: "",
      });
      actions.push({
        type: "DECLARE_RESPONSE",
        label: "应招",
        visibleTo: "dm",
        enabled: input.hasPendingAction && input.isDM,
        disabledReason: !input.hasPendingAction ? "没有待结算宣言" : "",
      });
      break;

    case "计算":
      actions.push({
        type: "DECLARE_RESPONSE",
        label: "应招",
        visibleTo: "dm",
        enabled: input.hasPendingAction && input.isDM,
        disabledReason: !input.hasPendingAction ? "没有待结算宣言" : "",
      });
      actions.push({
        type: "SKIP_RESPONSE",
        label: "跳过应招",
        visibleTo: "dm",
        enabled: input.isDM,
        disabledReason: "",
      });
      break;

    case "结算":
      actions.push({
        type: "RESOLVE_RESULT",
        label: "查看落果",
        visibleTo: "both",
        enabled: true,
        disabledReason: "",
      });
      break;

    case "势变化":
      actions.push({
        type: "APPLY_MOMENTUM",
        label: "结算势变化",
        visibleTo: "dm",
        enabled: input.isDM,
        disabledReason: !input.isDM ? "由 DM 操作" : "",
      });
      actions.push({
        type: "NEXT_ROUND",
        label: "进入下一轮",
        visibleTo: "dm",
        enabled: input.isDM,
        disabledReason: !input.isDM ? "由 DM 操作" : "",
      });
      break;

    case "结束":
      actions.push({
        type: "END_SCENE",
        label: "结束场景",
        visibleTo: "both",
        enabled: true,
        disabledReason: "",
      });
      break;
  }

  return actions;
}

// ---- Natural-language hints ----

export function getPhaseHint(
  phase: CombatState["phase"],
  isDM: boolean,
  hasPending: boolean,
): string {
  if (isDM) {
    switch (phase) {
      case "scene":
      case "declare":
        return hasPending ? "宣言已提交，请确认是否开启截击/应招窗口" : "等待玩家选择招式并宣言";
      case "intercept_window":
        return "请选择是否开启截击或放弃响应";
      case "react_window":
        return "请裁定应招结果";
      case "outcome":
        return "结算伤害与效果";
      case "round_end":
        return "请确认势变化并推进轮次";
      default:
        return "准备开始";
    }
  }

  // Player hints
  switch (phase) {
    case "scene":
    case "declare":
      return "选择招式、目标，拖骰入槽，点击确认宣言";
    case "intercept_window":
      return "等待主持人确认响应窗口";
    case "react_window":
      return "等待主持人裁定应招";
    case "outcome":
      return "查看落果结算";
    case "round_end":
      return "等待主持人推进下一轮";
    default:
      return "等待主持人推进";
  }
}

// ---- Can transition check ----

export function canTransition(
  from: CombatState["phase"],
  action: PhaseActionType,
  hasPendingAction: boolean,
): boolean {
  switch (action) {
    case "START_SCENE":
      return from === "setup" || from === "initiative";
    case "START_DECLARATION":
      return from === "scene" || from === "setup" || from === "initiative";
    case "CONFIRM_DECLARATION":
      return from === "declare" || from === "scene";
    case "OPEN_RESPONSE_WINDOW":
      return hasPendingAction && (from === "declare" || from === "scene");
    case "DECLARE_INTERCEPT":
      return hasPendingAction && from === "intercept_window";
    case "DECLARE_RESPONSE":
      return hasPendingAction && (from === "react_window" || from === "intercept_window");
    case "SKIP_RESPONSE":
      return from === "intercept_window" || from === "react_window";
    case "RESOLVE_RESULT":
      return from === "outcome" || from === "react_window";
    case "APPLY_MOMENTUM":
      return from === "round_end" || from === "outcome";
    case "NEXT_ROUND":
      return from === "round_end";
    case "END_SCENE":
      return true;
    default:
      return false;
  }
}
