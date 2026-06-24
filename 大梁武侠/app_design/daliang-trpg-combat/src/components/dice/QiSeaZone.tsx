// ==========================================================================
// QiSeaZone — 气海区域显示
// Phase 4: shows available dice in the qi sea.
// ==========================================================================

import { type FC } from "react";
import type { QiDieData } from "../../types/dice";
import { QiDie2D } from "./QiDie2D";
import "./dice.css";

export interface QiSeaZoneProps {
  dice: QiDieData[];
  onSelectDie?: (dieId: string) => void;
  selectedDieId?: string | null;
}

export const QiSeaZone: FC<QiSeaZoneProps> = ({ dice, onSelectDie, selectedDieId }) => (
  <div className="qi-zone qi-zone--sea">
    <div className="qi-zone__header">
      <span className="qi-zone__title">气海</span>
      <span className="qi-zone__count">{dice.length}</span>
    </div>
    <p className="qi-zone__desc">可用于当前出手。</p>
    <div className="qi-zone__dice">
      {dice.length > 0 ? (
        dice.map((d) => (
          <QiDie2D
            key={d.id}
            die={d}
            selected={selectedDieId === d.id}
            onClick={onSelectDie}
          />
        ))
      ) : (
        <span className="qi-zone__empty">暂无气骰。调息或返照以获取。</span>
      )}
    </div>
  </div>
);
