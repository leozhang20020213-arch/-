import { useMemo, type FC } from "react";
import type { Actor, CombatState } from "../../combat/types";
import { getSceneClocks } from "../../combat/sceneClock";
import { GamePanel } from "../components/GamePanel";
import { CombatBriefCard } from "../components/CombatBriefCard";
import { UnitCard } from "../components/UnitCard";
import { SceneClockCompact } from "./SceneClockCompact";

export interface LeftCombatPanelProps {
  actor: Actor;
  state: CombatState;
  isDM?: boolean;
}

/**
 * Left combat panel (320px fixed width).
 * Stacks: My combat brief card → Scene clocks → Enemy overview → Recent log.
 *
 * Scene tracks are now unified as SceneClocks — compact progress bars
 * with detail moved into expandable toggles instead of wall-of-text.
 */
export const LeftCombatPanel: FC<LeftCombatPanelProps> = ({
  actor,
  state,
  isDM = false,
}) => {
  const teammates = state.actors.filter(
    (a) => a.side === "player" && a.id !== actor.id,
  );

  const clocks = useMemo(() => {
    const allClocks = getSceneClocks(state.tracks);
    return isDM ? allClocks : allClocks.filter((c) => !c.hidden);
  }, [state.tracks, isDM]);

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

      {/* Scene clocks — unified progress tracks */}
      <GamePanel title="场景进度" variant="parchment">
        <SceneClockCompact clocks={clocks} />
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
          {state.logs.filter((l) => l.public).length === 0 && (
            <span>暂无动态</span>
          )}
        </div>
      </GamePanel>
    </div>
  );
};
