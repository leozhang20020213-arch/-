import type { FC } from "react";
import type { Actor, CombatState } from "../../combat/types";
import { GamePanel } from "../components/GamePanel";
import { CombatBriefCard } from "../components/CombatBriefCard";
import { UnitCard } from "../components/UnitCard";

export interface LeftCombatPanelProps {
  actor: Actor;
  state: CombatState;
  isDM?: boolean;
}

/**
 * Left combat panel (320px fixed width).
 * Stacks: My combat brief card → Scene goals → Enemy overview → Recent log.
 * Reuses existing GamePanel and CombatBriefCard components.
 */
export const LeftCombatPanel: FC<LeftCombatPanelProps> = ({
  actor,
  state,
  isDM = false,
}) => {
  const teammates = state.actors.filter(
    (a) => a.side === "player" && a.id !== actor.id,
  );
  const enemies = state.actors.filter((a) => a.side !== "player");
  const visibleTracks = isDM
    ? state.tracks
    : state.tracks.filter((t) => !t.hidden);

  return (
    <div className="combat-left-panel">
      {/* My combat brief card */}
      <GamePanel title="我的战斗简卡" variant="parchment">
        <CombatBriefCard actor={actor} />
      </GamePanel>

      {/* Teammates (if any) */}
      {teammates.length > 0 && (
        <GamePanel title="队友" variant="parchment">
          {teammates.map((tm) => (
            <UnitCard key={tm.id} actor={tm} mode="teammate" />
          ))}
        </GamePanel>
      )}

      {/* Scene goal / tracks */}
      <GamePanel title="场景目标" variant="parchment">
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-dark)" }}>
          {state.sceneGoal || "—"}
        </p>
        {visibleTracks.map((track) => (
          <div key={track.id} style={{ marginTop: 8 }}>
            <span style={{ fontSize: 12, color: "var(--ink-dark)", fontWeight: 600 }}>
              {track.name}{track.hidden ? "（隐藏）" : ""}
            </span>
            <meter min={0} max={track.max} value={track.value} style={{ width: "100%", marginTop: 4 }} />
            <small style={{ color: "var(--ink-subtle)" }}>
              {track.value}/{track.max}
            </small>
          </div>
        ))}
      </GamePanel>

      {/* Enemy overview (compact chips) */}
      {enemies.length > 0 && (
        <GamePanel title="敌方概览" variant="parchment">
          <div className="enemy-roster-compact">
            {enemies.map((enemy) => (
              <div className="enemy-chip" key={enemy.id}>
                <span className="enemy-name">{enemy.name}</span>
                <span className="enemy-momentum">{enemy.momentum}</span>
                <span className="enemy-hp">
                  {enemy.hp}/{enemy.maxHp}
                </span>
              </div>
            ))}
          </div>
        </GamePanel>
      )}

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
          {state.logs.filter((l) => l.public).length === 0 && (
            <span>暂无动态</span>
          )}
        </div>
      </GamePanel>
    </div>
  );
};
