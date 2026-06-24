// ==========================================================================
// RestPoolZone — 息库区域显示
// Phase 4: shows dice in the rest pool (post-resolution).
// ==========================================================================

import { type FC } from "react";
import type { QiDieData } from "../../types/dice";
import { QiDie2D } from "./QiDie2D";
import "./dice.css";

export interface RestPoolZoneProps {
  dice: QiDieData[];
}

export const RestPoolZone: FC<RestPoolZoneProps> = ({ dice }) => (
  <div className="qi-zone qi-zone--rest">
    <div className="qi-zone__header">
      <span className="qi-zone__title">息库</span>
      <span className="qi-zone__count">{dice.length}</span>
    </div>
    <p className="qi-zone__desc">已用气骰，调息后可回气海。</p>
    <div className="qi-zone__dice">
      {dice.length > 0 ? (
        dice.map((d) => (
          <QiDie2D key={d.id} die={d} />
        ))
      ) : (
        <span className="qi-zone__empty">息库为空。</span>
      )}
    </div>
  </div>
);
