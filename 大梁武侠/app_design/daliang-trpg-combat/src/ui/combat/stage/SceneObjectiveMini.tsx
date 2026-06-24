import type { FC } from "react";
import type { SceneObjective } from "../../../types/combat";

export interface SceneObjectiveMiniProps {
  objectives: SceneObjective[];
}

/**
 * Compact scene objective progress bar at the bottom of the tactical stage.
 * Shows each objective as a labeled progress bar: title [====>    ] current/target
 */
export const SceneObjectiveMini: FC<SceneObjectiveMiniProps> = ({ objectives }) => {
  if (objectives.length === 0) return null;

  return (
    <div className="scene-objective-mini">
      {objectives.map((obj) => {
        const pct = obj.target > 0 ? Math.round((obj.current / obj.target) * 100) : 0;
        return (
          <div className="objective-track" key={obj.id}>
            <span className="objective-label">{obj.title}</span>
            <div className="objective-bar-wrap">
              <div
                className="objective-bar-fill"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="objective-nums">
              {obj.current}/{obj.target}
            </span>
          </div>
        );
      })}
    </div>
  );
};
