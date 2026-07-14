import { useMemo, type FC } from "react";
import type { Actor, CombatState } from "../../combat/types";
import { getSceneClocks } from "../../combat/sceneClock";
import { GamePanel } from "../components/GamePanel";
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

  function renderCrewRow(member: Actor, current = false) {
    const publicStatus = member.statuses[0]?.name ?? "无状态";
    return (
      <article className={`crew-summary-row${current ? " is-self" : ""}`} key={member.id}>
        <div className="crew-summary-row__identity">
          <span className="crew-summary-row__avatar">{member.name.charAt(0)}</span>
          <strong>{member.name}</strong>
          <span className="crew-summary-row__momentum">{member.momentum}</span>
          <b>{member.hp}/{member.maxHp}</b>
        </div>
        <meter min={0} max={member.maxHp} value={member.hp} />
        <small>
          {current
            ? `护${member.tableAttrs.护体} · 爆${member.tableAttrs.爆发} · 回${member.tableAttrs.回气} · 身${member.tableAttrs.身势}`
            : publicStatus}
        </small>
      </article>
    );
  }

  return (
    <div className="combat-left-panel">
      {/* One compact crew ledger replaces the old stack of repeated full cards. */}
      <GamePanel title="队伍简况" variant="parchment" className="crew-summary-panel">
        <div className="crew-summary-list">
          {renderCrewRow(actor, true)}
          {teammates.map((teammate) => renderCrewRow(teammate))}
        </div>
      </GamePanel>

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
