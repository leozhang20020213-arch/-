import type { FC, ReactNode } from "react";

export interface CenterCombatPanelProps {
  /** Combat stage content (Phaser board + unit cards + distance lines) */
  stage: ReactNode;
  /** Card/action deck for the authoritative declaration draft */
  actionDeck?: ReactNode;
  /** Qi dice workbench */
  qiZone: ReactNode;
}

/**
 * Center combat panel (flex 1, fills remaining width).
 * Vertical split: Combat Stage (top ~48%) | Qi Dice Zone (bottom ~52%).
 * Both sub-zones are overflow-hidden — no internal scrolling.
 */
export const CenterCombatPanel: FC<CenterCombatPanelProps> = ({
  stage,
  actionDeck,
  qiZone,
}) => {
  return (
    <div className="combat-center-panel">
      <div className="combat-stage-area">{stage}</div>
      <div className={`combat-workbench${actionDeck ? "" : " no-action-deck"}`}>
        {actionDeck && <div className="combat-action-deck">{actionDeck}</div>}
        <div className="combat-qi-area">{qiZone}</div>
      </div>
    </div>
  );
};
