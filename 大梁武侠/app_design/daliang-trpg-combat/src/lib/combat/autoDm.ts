import {
  applyOutcome,
  endRound,
  formMove,
  resolveInterceptSuccess,
  resolveReact,
  skipReact,
} from "../../combat/combatEngine";
import type {
  Actor,
  CombatState,
  ResponseAttachment,
} from "../../combat/types";

export type AutoDmDecision =
  | "waiting_player"
  | "intercept"
  | "skip_intercept"
  | "react"
  | "skip_react"
  | "apply_outcome"
  | "end_round"
  | "idle";

export interface AutoDmOptions {
  /** The first round in which an enemy may spend resources on an intercept. */
  interceptFromRound?: number;
}

export interface AutoDmResult {
  state: CombatState;
  decision: AutoDmDecision;
  message: string;
}

interface LegalResponse {
  state: CombatState;
  response: ResponseAttachment;
  diceIds: string[];
}

const DEFAULT_INTERCEPT_FROM_ROUND = 2;

function result(
  state: CombatState,
  decision: AutoDmDecision,
  message: string,
): AutoDmResult {
  return { state, decision, message };
}

function compareIds(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function* combinations(
  items: string[],
  size: number,
  start = 0,
  selected: string[] = [],
): Generator<string[]> {
  if (selected.length === size) {
    yield [...selected];
    return;
  }

  const stillNeeded = size - selected.length;
  for (let index = start; index <= items.length - stillNeeded; index += 1) {
    selected.push(items[index]);
    yield* combinations(items, size, index + 1, selected);
    selected.pop();
  }
}

function usableDiceIds(state: CombatState, actorId: string): string[] {
  return [...new Set(
    state.dice
      .filter(
        (die) =>
          die.ownerId === actorId &&
          (die.zone === "QI_SEA" || die.zone === "TEMP_QI"),
      )
      .map((die) => die.id),
  )].sort(compareIds);
}

function responseMinimum(response: ResponseAttachment): number {
  if (!Number.isFinite(response.minDice)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.ceil(response.minDice));
}

/**
 * Ask the existing engine whether a response and dice combination is legal.
 * Failed trials are discarded; the engine clones the supplied state before it
 * validates or mutates anything.
 */
function findLegalResponse(
  state: CombatState,
  actor: Actor,
  responseType: "截击" | "应招",
): LegalResponse | undefined {
  if (actor.responseQuotaUsed >= actor.maxResponseQuota) return undefined;

  const diceIds = usableDiceIds(state, actor.id);
  const responses = [...(actor.responses ?? [])]
    .filter((response) => response.responseType === responseType)
    .sort((left, right) => {
      const minimumDifference = responseMinimum(left) - responseMinimum(right);
      return minimumDifference || compareIds(left.id, right.id);
    });

  for (const response of responses) {
    const minimum = responseMinimum(response);
    if (!Number.isFinite(minimum) || minimum > diceIds.length) continue;

    // Start with the least resource-intensive legal choice, then widen the
    // combination only when qi-nature or other engine validation requires it.
    for (let size = minimum; size <= diceIds.length; size += 1) {
      for (const candidate of combinations(diceIds, size)) {
        try {
          const next = responseType === "截击"
            ? resolveInterceptSuccess(state, actor.id, response.id, candidate)
            : resolveReact(state, actor.id, response.id, candidate);

          return { state: next, response, diceIds: candidate };
        } catch {
          // This candidate is not legal under the canonical engine. Try the
          // next deterministic combination without changing the real state.
        }
      }
    }
  }

  return undefined;
}

function interceptStartRound(options: AutoDmOptions): number {
  const configured = options.interceptFromRound;
  if (configured === undefined || !Number.isFinite(configured)) {
    return DEFAULT_INTERCEPT_FROM_ROUND;
  }
  return Math.max(1, Math.ceil(configured));
}

/**
 * Advance exactly one automatic DM step.
 *
 * Declaration remains a player action. During response windows this helper
 * only controls a pending target whose side is `enemy`; a player target always
 * returns `waiting_player` and no state is changed.
 */
export function advanceAutoDm(
  state: CombatState,
  playerActorId: string,
  options: AutoDmOptions = {},
): AutoDmResult {
  try {
    if (!state || !Array.isArray(state.actors) || !Array.isArray(state.dice)) {
      return result(state, "idle", "自动 DM 收到的交锋状态不完整，未推进。");
    }

    if (state.phase === "intercept_window" || state.phase === "react_window") {
      const pending = state.pendingAction;
      if (!pending) {
        return result(state, "idle", "响应窗口缺少待结算宣言，未推进。");
      }

      const target = state.actors.find((actor) => actor.id === pending.targetId);
      if (!target) {
        return result(state, "idle", "待结算宣言的目标不存在，未推进。");
      }

      if (target.id === playerActorId || target.side === "player") {
        return result(
          state,
          "waiting_player",
          `等待玩家 ${target.name} 处理${state.phase === "intercept_window" ? "截击" : "应招"}窗口。`,
        );
      }

      if (target.side !== "enemy") {
        return result(state, "waiting_player", `目标 ${target.name} 不是自动 DM 控制的敌人。`);
      }

      if (state.phase === "intercept_window") {
        if (state.round >= interceptStartRound(options)) {
          const legalIntercept = findLegalResponse(state, target, "截击");
          if (legalIntercept) {
            return result(
              legalIntercept.state,
              "intercept",
              `${target.name} 自动截击「${legalIntercept.response.moveName}」，投入 ${legalIntercept.diceIds.length} 枚气骰。`,
            );
          }
        }

        const next = formMove(state);
        return result(
          next,
          "skip_intercept",
          state.round < interceptStartRound(options)
            ? `第 ${state.round} 轮按测试策略跳过截击，宣言进入成招。`
            : `${target.name} 没有合法截击，宣言进入成招。`,
        );
      }

      const legalReact = findLegalResponse(state, target, "应招");
      if (legalReact) {
        return result(
          legalReact.state,
          "react",
          `${target.name} 自动应招「${legalReact.response.moveName}」，投入 ${legalReact.diceIds.length} 枚气骰。`,
        );
      }

      return result(
        skipReact(state),
        "skip_react",
        `${target.name} 没有合法应招，安全跳过应招。`,
      );
    }

    if (state.phase === "outcome") {
      return result(applyOutcome(state), "apply_outcome", "自动 DM 已结算落果。");
    }

    if (state.phase === "round_end") {
      const player = state.actors.find(
        (actor) => actor.id === playerActorId && actor.side === "player",
      );
      if (!player) {
        return result(state, "idle", "找不到指定玩家，轮末未推进。");
      }

      const next = endRound(state);
      return result(
        { ...next, activeActorId: playerActorId },
        "end_round",
        `轮末处理完成，由玩家 ${player.name} 开始第 ${next.round} 轮宣言。`,
      );
    }

    if (state.phase === "scene" || state.phase === "declare") {
      return result(state, "waiting_player", "等待玩家宣言。");
    }

    if (state.phase === "setup") {
      return result(state, "idle", "请先点击“进入宣言”完成本场景整体投骰。");
    }

    return result(state, "idle", `当前阶段 ${state.phase} 没有自动 DM 步骤。`);
  } catch {
    // Malformed or stale state must never break the solo-test loop. Returning
    // the exact input state also prevents an accidental multi-step advance.
    return result(state, "idle", "自动 DM 无法合法推进，状态保持不变。");
  }
}
