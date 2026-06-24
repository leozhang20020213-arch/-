import type { FC, ReactNode } from "react";

export interface CenterCombatZoneProps {
  stage: ReactNode;
  qiZone: ReactNode;
}

/**
 * Center combat zone (58% of workspace width).
 * Split vertically: Combat Stage (45%) | 3D Qi Dice Tray (55%)
 * No internal scrolling — both sub-zones are overflow:hidden.
 */
export const CenterCombatZone: FC<CenterCombatZoneProps> = ({ stage, qiZone }) => {
  return (
    <>
      <div className="combat-stage">{stage}</div>
      <div className="qi-dice-zone">{qiZone}</div>
    </>
  );
};
