import type { FC } from "react";
import type { CombatState } from "../../../combat/types";
import { toDisplayPhase } from "../../../lib/combat/combatPhaseMachine";

export interface PlayerPromptBarProps {
  state: CombatState;
}

/**
 * Natural-language prompt bar for the player view.
 * Replaces system-language "等待 DM 裁定截击" etc. with
 * player-friendly guidance text.
 */
export const PlayerPromptBar: FC<PlayerPromptBarProps> = ({ state }) => {
  const displayPhase = toDisplayPhase(state.phase);
  const activeActor = state.actors.find((a) => a.id === state.activeActorId);
  const actorName = activeActor?.name ?? "—";
  const hasPending = Boolean(state.pendingAction);

  function prompt(): string {
    switch (displayPhase) {
      case "未开始":
        return "等待主持人开始场景。";

      case "准备":
        return `第${state.round}轮，${actorName}行动中。请选择招式与目标。`;

      case "宣言":
        if (hasPending) {
          return "宣言已提交，等待主持人确认。";
        }
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
    <div className="player-prompt-bar">
      <span className="player-prompt-icon">⚔</span>
      <span className="player-prompt-text">{prompt()}</span>
    </div>
  );
};
