import type { FC } from "react";
import type { Actor, CombatState } from "../../../combat/types";

export interface DmControlPanelProps {
  state: CombatState;
  dmNote: string;
  setDmNote: (value: string) => void;
  onStartScene: () => void;
  onIntercept: () => void;
  onForm: () => void;
  onReact: () => void;
  onOutcome: () => void;
  onEndRound: () => void;
  onRegulateBreath: () => void;
  onReflection: () => void;
  onExpireSource: () => void;
  onMomentum: (actorId: string, momentum: Actor["momentum"]) => void;
  onOverride: () => void;
}

/**
 * DM control panel — extracted from App.tsx inline.
 * Shows DM-only action buttons: adjudication, response window, momentum, etc.
 * Only rendered in DM mode (dmCombat route).
 */
export const DmControlPanel: FC<DmControlPanelProps> = ({
  state,
  dmNote,
  setDmNote,
  onStartScene,
  onIntercept,
  onForm,
  onReact,
  onOutcome,
  onEndRound,
  onRegulateBreath,
  onReflection,
  onExpireSource,
  onMomentum,
  onOverride,
}) => {
  const activeActor =
    state.actors.find((a) => a.id === state.activeActorId) ?? state.actors[0];

  return (
    <section className="panel dm-console">
      <div className="panel-title">
        <h2>裁定面板</h2>
      </div>
      <div className="flow-buttons">
        <button type="button" onClick={onStartScene}>
          开始场景
        </button>
        <button
          type="button"
          onClick={onIntercept}
          disabled={!state.pendingAction}
        >
          截击取消
        </button>
        <button
          type="button"
          onClick={onForm}
          disabled={!state.pendingAction}
        >
          判定成招
        </button>
        <button
          type="button"
          onClick={onReact}
          disabled={!state.pendingAction}
        >
          目标应招
        </button>
        <button
          type="button"
          onClick={onOutcome}
          disabled={!state.pendingAction}
        >
          应用落果
        </button>
        <button type="button" onClick={onEndRound}>
          轮次结束
        </button>
        <button type="button" onClick={onRegulateBreath}>
          调息
        </button>
        <button type="button" onClick={onReflection}>
          返照
        </button>
        <button type="button" onClick={onExpireSource}>
          来源失效
        </button>
      </div>
      <label>
        势变化（{activeActor?.name ?? "未选单位"}）
        <select
          value={activeActor?.momentum ?? "阴盛"}
          onChange={(e) =>
            activeActor &&
            onMomentum(activeActor.id, e.target.value as Actor["momentum"])
          }
        >
          {["阴盛", "阳盛", "合势", "圆融", "崩势", "失势"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label>
        手动裁定 / 广播文本
        <textarea
          value={dmNote}
          onChange={(e) => setDmNote(e.target.value)}
        />
      </label>
      <button className="secondary-action" type="button" onClick={onOverride}>
        写入裁定日志
      </button>
    </section>
  );
};
