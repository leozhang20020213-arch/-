// ==========================================================================
// QiZonePanel — Complete four-zone qi panel with recovery actions.
// Phase 4: 气海 | 锁气 | 息库 | 临气 + 调息/返照
// ==========================================================================

import { type FC } from "react";
import { useDiceStore } from "../../store/diceStore";
import { QiSeaZone } from "./QiSeaZone";
import { LockedQiZone } from "./LockedQiZone";
import { RestPoolZone } from "./RestPoolZone";
import { TemporaryQiZone } from "./TemporaryQiZone";
import { QiRecoveryActions } from "./QiRecoveryActions";
import { getZoneCounts } from "../../lib/dice/qiRecovery";
import "./dice.css";

export interface QiZonePanelProps {
  /** Minimum height */
  minHeight?: number;
}

/**
 * QiZonePanel — the full four-zone qi status panel.
 *
 * Layout (vertical stacks on narrow, 2×2 grid on wide):
 * ┌─────────────────────┬─────────────────────┐
 * │ 气海 (QiSeaZone)     │ 锁气 (LockedQiZone) │
 * │ 可用于当前出手       │ 本次宣言已投入      │
 * │ [D6:4] [D6:2]      │ [D6:4] [D6:2]      │
 * ├─────────────────────┼─────────────────────┤
 * │ 息库 (RestPoolZone) │ 临气 (TempQiZone)   │
 * │ 已用待回气           │ 临时气骰            │
 * │ [D6:5] [D6:1]      │ 暂无                │
 * ├─────────────────────┴─────────────────────┤
 * │ [调息] [返照]                              │
 * └───────────────────────────────────────────┘
 */
export const QiZonePanel: FC<QiZonePanelProps> = ({ minHeight = 260 }) => {
  const {
    state,
    selectDie,
    getQiSeaDice,
    getRestPoolDice,
    getLockedDice,
    getTempQiDice,
    regulateBreath,
    returnLight,
  } = useDiceStore();

  const seaDice = getQiSeaDice();
  const restDice = getRestPoolDice();
  const lockedDice = getLockedDice();
  const tempDice = getTempQiDice();

  const counts = getZoneCounts(state.qiDice);

  const declName = state.activeDeclaration?.moveName;
  const declTarget = state.activeDeclaration?.targetName;

  return (
    <div className="qi-zone-panel" style={{ minHeight }}>
      {/* Four-zone grid */}
      <div className="qi-zone-panel__grid">
        <QiSeaZone
          dice={seaDice}
          onSelectDie={selectDie}
          selectedDieId={state.selectedDieId}
        />
        <LockedQiZone
          dice={lockedDice}
          declarationMoveName={declName}
          declarationTargetName={declTarget}
        />
        <RestPoolZone dice={restDice} />
        <TemporaryQiZone dice={tempDice} />
      </div>

      {/* Recovery actions + total summary */}
      <div className="qi-zone-panel__footer">
        <QiRecoveryActions
          restPoolCount={counts.restPool}
          qiSeaCount={counts.qiSea}
          hasUsedReturnLight={state.hasUsedReturnLight}
          onRegulateBreath={regulateBreath}
          onReturnLight={returnLight}
        />
        <span className="qi-zone-panel__total">
          合计 {counts.total} 枚 · 气海{counts.qiSea} 锁气{counts.locked} 息库{counts.restPool} 临气{counts.tempQi}
        </span>
      </div>
    </div>
  );
};
