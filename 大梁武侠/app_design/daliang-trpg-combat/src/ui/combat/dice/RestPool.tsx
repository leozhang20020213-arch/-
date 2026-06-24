import type { FC } from "react";
import type { QiDie as QiDieType } from "../../../combat/types";

export interface RestPoolProps {
  /** Dice in QI_REST (used/rested dice) */
  restDice: QiDieType[];
  /** Dice in QI_LOCK (locked from previous action) */
  lockedDice: QiDieType[];
  /** Dice in QI_POOL (not yet rolled into sea) */
  poolDice: QiDieType[];
}

function dieLabel(d: QiDieType): string {
  const n = d.nature === "yin" ? "阴" : d.nature === "yang" ? "阳" : "原";
  return `${n}${d.value ?? "?"}/${d.label}`;
}

/**
 * Rest pool + stats footer — compact summary area below the qi sea.
 * Shows counts for each zone: 息库 / 锁气 / 气池 / 临气.
 */
export const RestPool: FC<RestPoolProps> = ({
  restDice,
  lockedDice,
  poolDice,
}) => {
  return (
    <div className="rest-pool-bar">
      <span className="rest-stat">
        息库 <strong>{restDice.length}</strong>
      </span>
      {lockedDice.length > 0 && (
        <span className="rest-stat locked">
          锁气 <strong>{lockedDice.length}</strong>
        </span>
      )}
      <span className="rest-stat">
        气池 <strong>{poolDice.length}</strong>
      </span>

      {/* Expandable detail */}
      {(restDice.length > 0 || lockedDice.length > 0 || poolDice.length > 0) && (
        <details className="rest-detail-pop">
          <summary className="rest-detail-trigger">详情</summary>
          <div className="rest-detail-popover">
            {poolDice.length > 0 && (
              <div>气池：{poolDice.map(dieLabel).join("、")}</div>
            )}
            {restDice.length > 0 && (
              <div>息库：{restDice.map(dieLabel).join("、")}</div>
            )}
            {lockedDice.length > 0 && (
              <div className="locked-detail">
                锁气：{lockedDice.map(dieLabel).join("、")}
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
};
