import type { FC } from "react";
import type { CombatState } from "../../combat/types";
import { phaseLabel } from "../utils/labels";

export interface RoundStatusBarProps {
  state: CombatState;
  isDM?: boolean;
}

const PHASE_HINTS: Record<string, { player: string; dm: string }> = {
  setup: { player: "等待 DM 开局", dm: "配置场景与敌人" },
  initiative: { player: "等待先攻判定", dm: "判定先攻顺序" },
  scene: { player: "可宣言或执行便行", dm: "等待玩家宣言或便行" },
  declare: { player: "选择招式和目标并宣言", dm: "等待宣言" },
  intercept_window: { player: "等待 DM 裁定截击", dm: "可裁定截击" },
  react_window: { player: "等待应招裁定", dm: "可裁定应招" },
  outcome: { player: "等待落果", dm: "结算伤害与效果" },
  round_end: { player: "等待下一轮", dm: "判定轮次结束" },
};

/**
 * Round / Status bar (64px).
 * Five info blocks:
 *   第X轮 (12%) | 当前行动者 (18%) | 阶段 (22%) | 响应状态 (18%) | 规则提示 (30%)
 *
 * Player sees natural-language phase hints.
 * DM sees more detailed flow control info.
 */
export const RoundStatusBar: FC<RoundStatusBarProps> = ({ state, isDM = false }) => {
  const activeActor = state.actors.find((a) => a.id === state.activeActorId);
  const actorName = activeActor?.name ?? "—";
  const phase = state.phase;
  const hints = PHASE_HINTS[phase] ?? { player: "", dm: "" };
  const hint = isDM ? hints.dm : hints.player;

  const hasPending = Boolean(state.pendingAction);
  const pendingLabel = hasPending ? "有未成招宣言" : "";

  return (
    <div className="round-status-bar">
      <div className="round-status-bar__round">
        <span className="round-num">第{state.round}轮</span>
      </div>

      <div className="round-status-bar__actor">
        <span className="arrow">→</span>
        <span>{actorName}</span>
      </div>

      <div className="round-status-bar__phase">
        <span className={`phase-dot${phase !== "setup" ? " active" : ""}`} />
        <span>{phaseLabel(phase)}</span>
      </div>

      <div className="round-status-bar__response">
        {pendingLabel || (isDM ? "由 DM 裁定" : "等待 DM 裁定")}
      </div>

      <div className="round-status-bar__hint">{hint}</div>
    </div>
  );
};
