import type { FC } from "react";
import type { Actor, CombatState } from "../../combat/types";
import { GamePanel } from "../components/GamePanel";
import { CombatBriefCard } from "../components/CombatBriefCard";
import { UnitCard } from "../components/UnitCard";

export interface LeftInfoPanelProps {
  actor: Actor;
  state: CombatState;
  /** Whether to show DM view (scene state, player list) or player view */
  isDM?: boolean;
}

/**
 * Left info panel (18% of workspace width).
 * Player view: 我的战斗简卡 (35%) | 队友 (25%) | 场景目标 (25%) | 小日志 (15%)
 * DM view: 场景状态 | 玩家列表 | 轮次摘要
 */
export const LeftInfoPanel: FC<LeftInfoPanelProps> = ({ actor, state, isDM = false }) => {
  const teammates = state.actors.filter(
    (a) => a.side === "player" && a.id !== actor.id,
  );
  const visibleTracks = isDM
    ? state.tracks
    : state.tracks.filter((t) => !t.hidden);

  return (
    <>
      {/* My combat brief card */}
      <GamePanel title="我的战斗简卡" variant="parchment">
        <CombatBriefCard actor={actor} />
      </GamePanel>

      {/* Teammates */}
      {teammates.length > 0 && (
        <GamePanel title="队友" variant="parchment">
          {teammates.map((tm) => (
            <UnitCard key={tm.id} actor={tm} mode="teammate" />
          ))}
        </GamePanel>
      )}

      {/* Scene goal / tracks */}
      <GamePanel title="场景目标" variant="parchment">
        <p>{state.sceneGoal || "—"}</p>
        {visibleTracks.map((track) => (
          <div key={track.id} style={{ marginTop: 8 }}>
            <span>
              {track.name}{track.hidden ? "（隐藏）" : ""}
            </span>
            <meter
              min={0}
              max={track.max}
              value={track.value}
              style={{ width: "100%", marginTop: 4 }}
            />
            <small>
              {track.value}/{track.max}
            </small>
          </div>
        ))}
      </GamePanel>

      {/* Recent log */}
      <GamePanel title="最近动态" variant="subtle">
        <div style={{ fontSize: "var(--fs-helper)", color: "var(--ink-subtle)", maxHeight: 80, overflowY: "auto" }}>
          {state.logs
            .filter((l) => l.public)
            .slice(0, 3)
            .map((l) => (
              <div key={l.id} style={{ marginBottom: 4 }}>
                {l.message}
              </div>
            ))}
        </div>
      </GamePanel>
    </>
  );
};
