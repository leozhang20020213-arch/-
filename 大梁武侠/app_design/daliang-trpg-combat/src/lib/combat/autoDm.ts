import {
  applyOutcome,
  declareAction,
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
  | "enemy_declare"
  | "enemy_skip"
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

interface LegalDeclaration {
  state: CombatState;
  actor: Actor;
  target: Actor;
  moveName: string;
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
  let fallback: LegalResponse | undefined;

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
          const legal = { state: next, response, diceIds: candidate };
          fallback ??= legal;

          // Enemy AI preserves a legal main action when an equally legal
          // response can be paid with different dice (DM rule priority: main
          // action before response preference).
          if (actor.side === "enemy") {
            const playerTarget = state.pendingAction
              ? state.actors.find((entry) => entry.id === state.pendingAction?.actorId && entry.side === "player")
              : undefined;
            const updatedActor = next.actors.find((entry) => entry.id === actor.id);
            if (playerTarget && updatedActor) {
              const futureState: CombatState = {
                ...next,
                phase: "declare",
                activeActorId: actor.id,
                pendingAction: undefined,
              };
              if (findEnemyDeclaration(futureState, updatedActor, playerTarget)) return legal;
              continue;
            }
          }

          return legal;
        } catch {
          // This candidate is not legal under the canonical engine. Try the
          // next deterministic combination without changing the real state.
        }
      }
    }
  }

  return fallback;
}

function interceptStartRound(options: AutoDmOptions): number {
  const configured = options.interceptFromRound;
  if (configured === undefined || !Number.isFinite(configured)) {
    return DEFAULT_INTERCEPT_FROM_ROUND;
  }
  return Math.max(1, Math.ceil(configured));
}

function findEnemyDeclaration(
  state: CombatState,
  actor: Actor,
  target: Actor,
): LegalDeclaration | undefined {
  const diceIds = usableDiceIds(state, actor.id);
  const diceById = new Map(state.dice.map((die) => [die.id, die]));
  const moves = [...actor.moves].sort((left, right) =>
    left.minDice - right.minDice || compareIds(left.id, right.id));

  for (const move of moves) {
    for (let size = Math.max(1, Math.ceil(move.minDice)); size <= diceIds.length; size += 1) {
      for (const candidate of combinations(diceIds, size)) {
        const yinFixed = candidate.filter((id) => diceById.get(id)?.nature === "yin");
        const yangFixed = candidate.filter((id) => diceById.get(id)?.nature === "yang");
        const raw = candidate.filter((id) => diceById.get(id)?.nature === "raw");
        const allocations = 2 ** raw.length;

        for (let mask = 0; mask < allocations; mask += 1) {
          const yin = [...yinFixed];
          const yang = [...yangFixed];
          raw.forEach((id, index) => ((mask >> index) & 1 ? yang : yin).push(id));
          try {
            const next = declareAction(state, actor.id, target.id, move.id, candidate, {
              yinSlotDiceIds: yin,
              yangSlotDiceIds: yang,
            });
            return { state: next, actor, target, moveName: move.name, diceIds: candidate };
          } catch {
            // Try the next deterministic move, resource set, or raw allocation.
          }
        }
      }
    }
  }

  return undefined;
}

/**
 * Advance exactly one automatic DM step.
 *
 * Player declarations and player response choices remain manual. This helper
 * controls enemy responses, one enemy main action, settlement, and handoff so
 * a solo player can exercise both attacking and defending.
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

      const currentActor = state.actors.find((actor) => actor.id === state.activeActorId);
      const next = endRound(state);
      if (currentActor?.side === "player") {
        const livingEnemies = next.actors.filter((actor) => actor.side === "enemy" && actor.hp > 0);
        const enemy = livingEnemies.find((actor) => Boolean(findEnemyDeclaration(next, actor, player)))
          ?? livingEnemies[0];
        if (enemy) {
          return result(
            { ...next, activeActorId: enemy.id },
            "end_round",
            `玩家行动结算完毕；由自动 DM 控制 ${enemy.name} 开始第 ${next.round} 轮主行动。`,
          );
        }
      }
      return result(
        { ...next, activeActorId: playerActorId },
        "end_round",
        `敌方行动结算完毕；交还玩家 ${player.name} 开始第 ${next.round} 轮宣言。`,
      );
    }

    if (state.phase === "scene" || state.phase === "declare") {
      const active = state.actors.find((actor) => actor.id === state.activeActorId);
      const player = state.actors.find((actor) => actor.id === playerActorId && actor.side === "player");
      if (active?.side === "enemy" && player && player.hp > 0) {
        const declaration = findEnemyDeclaration(state, active, player);
        if (declaration) {
          return result(
            declaration.state,
            "enemy_declare",
            `${active.name} 自动宣言「${declaration.moveName}」攻击 ${player.name}，投入 ${declaration.diceIds.length} 枚气骰；等待玩家处理响应窗口。`,
          );
        }
        return result(
          { ...state, phase: "round_end", pendingAction: undefined },
          "enemy_skip",
          `${active.name} 当前没有合法主动作与气骰配置，本轮放弃并进入轮末。`,
        );
      }
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
