import {
  advanceTurn,
  applyOutcome,
  declareAction,
  formMove,
  getBasicActionAvailability,
  regulateBreath,
  resolveInterceptSuccess,
  resolveReact,
  skipReact,
  useReflection,
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

function chooseAutomaticTarget(
  state: CombatState,
  actor: Actor,
  playerActorId: string,
): Actor | undefined {
  const candidates = state.actors.filter((target) => {
    if (target.id === actor.id || target.hp <= 0) return false;
    if (actor.side === "player") return target.side === "enemy" || target.side === "pressure";
    return target.side === "player";
  });
  if (candidates.length === 0) return undefined;

  const protectedIds = new Set(actor.aiProfile?.protectActorIds ?? []);
  return [...candidates].sort((left, right) => {
    if (actor.side !== "player") {
      const leftPlayer = left.id === playerActorId ? 0 : 1;
      const rightPlayer = right.id === playerActorId ? 0 : 1;
      if (leftPlayer !== rightPlayer) return leftPlayer - rightPlayer;
    }
    const leftProtected = protectedIds.has(left.id) ? 0 : 1;
    const rightProtected = protectedIds.has(right.id) ? 0 : 1;
    if (leftProtected !== rightProtected) return leftProtected - rightProtected;
    const leftRatio = left.maxHp > 0 ? left.hp / left.maxHp : 1;
    const rightRatio = right.maxHp > 0 ? right.hp / right.maxHp : 1;
    return leftRatio - rightRatio || compareIds(left.id, right.id);
  })[0];
}

function tryAutomaticRecovery(state: CombatState, actor: Actor): AutoDmResult | undefined {
  const reflection = getBasicActionAvailability(state, actor.id, "fanzhao");
  if (reflection.usable) {
    return result(
      useReflection(state, actor.id),
      "enemy_skip",
      `${actor.name} 无合法招式，按策略执行返照并结束主行动。`,
    );
  }

  const breath = getBasicActionAvailability(state, actor.id, "regulateBreath");
  if (!breath.usable) return undefined;
  const guide = state.dice.find(
    (die) => die.ownerId === actor.id && (die.zone === "QI_SEA" || die.zone === "TEMP_QI"),
  );
  const limit = 1 + actor.innerArts
    .filter((art) => art.currentLevel > 0)
    .reduce((total, art) => total + Math.max(0, art.regulateBreathBonus ?? 0), 0);
  const restDice = state.dice
    .filter((die) => die.ownerId === actor.id && die.zone === "QI_REST" && !die.temporary)
    .sort((left, right) => left.sides - right.sides || compareIds(left.id, right.id))
    .slice(0, limit)
    .map((die) => die.id);
  if (!guide || restDice.length === 0) return undefined;
  return result(
    regulateBreath(state, actor.id, restDice, true, undefined, guide.id),
    "enemy_skip",
    `${actor.name} 无合法招式，支付息引并调息取回 ${restDice.length} 枚气骰。`,
  );
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
      return result(state, "idle", "规则主持收到的交锋状态不完整，未推进。");
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

      const source = state.actors.find((actor) => actor.id === pending.actorId);
      const move = source?.moves.find((entry) => entry.id === pending.moveId);
      if (state.phase === "intercept_window" && move && !move.hasIntercept) {
        return result(
          formMove(state),
          "skip_intercept",
          `「${move.name}」没有截击窗口，直接进入成招。`,
        );
      }
      if (state.phase === "react_window" && move && !move.hasReact) {
        return result(
          skipReact(state),
          "skip_react",
          `「${move.name}」没有应招窗口，直接进入落果。`,
        );
      }

      if (source?.id === target.id) {
        return state.phase === "intercept_window"
          ? result(formMove(state), "skip_intercept", `${target.name}不能截击自己的宣言，自动进入成招。`)
          : result(skipReact(state), "skip_react", `${target.name}不能应招自己的宣言，自动进入落果。`);
      }

      if (target.id === playerActorId) {
        const responseType = state.phase === "intercept_window" ? "截击" : "应招";
        const legalPlayerResponse = findLegalResponse(state, target, responseType);
        if (!legalPlayerResponse) {
          return state.phase === "intercept_window"
            ? result(
              formMove(state),
              "skip_intercept",
              `${target.name} 没有合法截击或响应额度，宣言自动进入成招。`,
            )
            : result(
              skipReact(state),
              "skip_react",
              `${target.name} 没有合法应招或响应额度，自动进入落果。`,
            );
        }
        return result(
          state,
          "waiting_player",
          `等待玩家 ${target.name} 处理${state.phase === "intercept_window" ? "截击" : "应招"}窗口。`,
        );
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
      return result(applyOutcome(state), "apply_outcome", "规则主持已结算落果。");
    }

    if (state.phase === "round_end") {
      const player = state.actors.find((actor) => actor.id === playerActorId && actor.side === "player");
      if (!player) {
        return result(state, "idle", "找不到指定玩家，轮末未推进。");
      }
      const next = advanceTurn(state);
      const nextActor = next.actors.find((actor) => actor.id === next.activeActorId);
      return result(
        next,
        "end_round",
        `行动序列推进；轮到 ${nextActor?.name ?? "下一位"}。`,
      );
    }

    if (state.phase === "scene" || state.phase === "declare") {
      const active = state.actors.find((actor) => actor.id === state.activeActorId);
      if (!active || active.hp <= 0) {
        return result({ ...state, phase: "round_end" }, "enemy_skip", "当前角色已离场，推进行动序列。");
      }
      if (active.id !== playerActorId) {
        const target = chooseAutomaticTarget(state, active, playerActorId);
        const declaration = target ? findEnemyDeclaration(state, active, target) : undefined;
        if (declaration) {
          return result(
            declaration.state,
            "enemy_declare",
            `${active.name} 自动宣言「${declaration.moveName}」指向 ${declaration.target.name}，投入 ${declaration.diceIds.length} 枚气骰。`,
          );
        }
        const recovery = tryAutomaticRecovery(state, active);
        if (recovery) return recovery;
        return result(
          { ...state, phase: "round_end", pendingAction: undefined },
          "enemy_skip",
          `${active.name} 当前没有合法招式、便行或恢复动作，本轮放弃出手。`,
        );
      }
      return result(state, "waiting_player", "等待玩家宣言。");
    }

    if (state.phase === "setup") {
      return result(state, "idle", "请先点击“进入宣言”完成本场景整体投骰。");
    }

    return result(state, "idle", `当前阶段 ${state.phase} 没有规则主持步骤。`);
  } catch {
    // Malformed or stale state must never break the solo-test loop. Returning
    // the exact input state also prevents an accidental multi-step advance.
    return result(state, "idle", "规则主持无法合法推进，状态保持不变。");
  }
}
