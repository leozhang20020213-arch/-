import type { FC, ReactNode } from "react";

export interface CenterCombatPanelProps {
  /** Combat stage content (Phaser board + unit cards + distance lines) */
  stage: ReactNode;
  /** 3D Qi dice tray content */
  qiZone: ReactNode;
}

/**
 * Center combat panel (flex 1, fills remaining width).
 * Vertical split: Combat Stage (top ~48%) | Qi Dice Zone (bottom ~52%).
 * Both sub-zones are overflow-hidden — no internal scrolling.
 */
export const CenterCombatPanel: FC<CenterCombatPanelProps> = ({
  stage,
  qiZone,
}) => {
  return (
    <div className="combat-center-panel">
      <div className="combat-stage-area">{stage}</div>
      <div className="combat-qi-area">{qiZone}</div>
    </div>
  );
};
