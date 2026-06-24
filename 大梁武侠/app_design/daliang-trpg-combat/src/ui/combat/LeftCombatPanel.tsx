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
      {/* My combat brief card — compact */}
      <GamePanel title="我的战斗简卡" variant="parchment">
        <CombatBriefCard actor={actor} />
      </GamePanel>

      {/* Selected target — compact */}
      <GamePanel title="当前目标" variant="parchment">
        {enemies.length > 0 ? (
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
        ) : (
          <p style={{ margin: 0, fontSize: 11, color: "var(--ink-subtle)" }}>暂无敌方</p>
        )}
      </GamePanel>

      {/* Teammates (if any) — compact */}
      {teammates.length > 0 && (
        <GamePanel title="队友" variant="parchment">
          {teammates.map((tm) => (
            <UnitCard key={tm.id} actor={tm} mode="teammate" />
          ))}
        </GamePanel>
      )}

      {/* Scene tracks — compact */}
      {visibleTracks.length > 0 && (
        <GamePanel title="场景" variant="parchment">
          {visibleTracks.map((track) => (
            <div key={track.id} style={{ marginBottom: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ fontWeight: 600, color: "var(--ink-dark)" }}>
                  {track.name}{track.hidden ? "（隐藏）" : ""}
                </span>
                <small style={{ color: "var(--ink-subtle)" }}>
                  {track.value}/{track.max}
                </small>
              </div>
              <meter min={0} max={track.max} value={track.value} style={{ width: "100%", height: 6 }} />
            </div>
          ))}
        </GamePanel>
      )}

      {/* Recent log — brighter */}
      <GamePanel title="最近动态" variant="subtle">
        <div className="recent-log">
          {state.logs
            .filter((l) => l.public)
            .slice(0, 3)
            .map((l) => (
              <div key={l.id} style={{ marginBottom: 3 }}>
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
