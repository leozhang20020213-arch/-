// ==========================================================================
// TemporaryQiZone — 临气区域显示
// Phase 4: shows temporary qi dice.
// ==========================================================================

import { type FC } from "react";
import type { QiDieData } from "../../types/dice";
import { QiDie2D } from "./QiDie2D";
import "./dice.css";

export interface TemporaryQiZoneProps {
  dice: QiDieData[];
}

export const TemporaryQiZone: FC<TemporaryQiZoneProps> = ({ dice }) => (
  <div className="qi-zone qi-zone--temp">
    <div className="qi-zone__header">
      <span className="qi-zone__title">临气</span>
      <span className="qi-zone__count">{dice.length}</span>
    </div>
    <p className="qi-zone__desc">临时气骰，按来源规则使用。</p>
    <div className="qi-zone__dice">
      {dice.length > 0 ? (
        dice.map((d) => (
          <QiDie2D key={d.id} die={d} />
        ))
      ) : (
        <span className="qi-zone__empty">暂无临时气骰。</span>
      )}
    </div>
  </div>
);
