// ==========================================================================
// LockedQiZone — 锁气区域显示
// Phase 4: shows dice locked in the current declaration.
// ==========================================================================

import { type FC } from "react";
import type { QiDieData } from "../../types/dice";
import { QiDie2D } from "./QiDie2D";
import "./dice.css";

export interface LockedQiZoneProps {
  /** Dice currently locked (in yin/yang slots or marked locked) */
  dice: QiDieData[];
  declarationMoveName?: string;
  declarationTargetName?: string;
}

export const LockedQiZone: FC<LockedQiZoneProps> = ({
  dice,
  declarationMoveName,
  declarationTargetName,
}) => (
  <div className="qi-zone qi-zone--locked">
    <div className="qi-zone__header">
      <span className="qi-zone__title">锁气</span>
      <span className="qi-zone__count">{dice.length}</span>
    </div>
    <p className="qi-zone__desc">
      {declarationMoveName
        ? `本次宣言「${declarationMoveName}」${declarationTargetName ? ` → ${declarationTargetName}` : ""}已投入。`
        : "本次宣言已投入。"}
    </p>
    <div className="qi-zone__dice">
      {dice.length > 0 ? (
        dice.map((d) => (
          <QiDie2D key={d.id} die={d} />
        ))
      ) : (
        <span className="qi-zone__empty">暂无锁气骰。选择招式并投入骰子。</span>
      )}
    </div>
  </div>
);
