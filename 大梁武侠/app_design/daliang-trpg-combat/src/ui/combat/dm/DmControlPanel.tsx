import type { FC } from "react";
import type { Actor, CombatState } from "../../../combat/types";

export interface DmControlPanelProps {
  state: CombatState;
  dmNote: string;
  setDmNote: (value: string) => void;
  onExpireSource: () => void;
  onMomentum: (actorId: string, momentum: Actor["momentum"]) => void;
  onOverride: () => void;
}

/**
 * DM utility panel. Combat phase progression is owned by the bottom command
 * bar; this panel keeps only host-only resource and adjudication tools.
 */
export const DmControlPanel: FC<DmControlPanelProps> = ({
  state,
  dmNote,
  setDmNote,
  onExpireSource,
  onMomentum,
  onOverride,
}) => {
  const activeActor =
    state.actors.find((a) => a.id === state.activeActorId) ?? state.actors[0];

  return (
    <section className="panel dm-console dm-toolbox">
      <div className="panel-title dm-toolbox__title">
        <div>
          <span className="dm-toolbox__eyebrow">当前行动者</span>
          <h2>主持工具</h2>
        </div>
        <strong className="dm-toolbox__actor">{activeActor?.name ?? "未选单位"}</strong>
      </div>
      <p className="dm-toolbox__phase-note">
        当前时点由底部命令条统一推进；此处保留资源与手动裁定。
      </p>
      <div className="dm-toolbox__quick-actions" aria-label="DM 来源维护">
        <button type="button" onClick={onExpireSource}>
          来源失效
        </button>
      </div>
      <label className="dm-toolbox__field">
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
      <label className="dm-toolbox__field dm-toolbox__note">
        手动裁定 / 广播文本
        <textarea
          value={dmNote}
          onChange={(e) => setDmNote(e.target.value)}
        />
      </label>
      <button className="secondary-action" type="button" onClick={onOverride}>
        记录并广播裁定
      </button>
    </section>
  );
};
