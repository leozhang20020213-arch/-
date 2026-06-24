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
  const sides = `D${d.sides}`;
  const val = d.value ?? "?";
  return `${n}${sides}(${val})`;
}

function zoneTotal(dice: QiDieType[]): string {
  if (dice.length === 0) return "";
  const sum = dice.reduce((s, d) => s + (d.value ?? 0), 0);
  return ` ${sum}点`;
}

/**
 * Rest pool + stats footer — compact summary area below the qi sea.
 * Shows counts and point totals for each zone: 息库 / 锁气 / 气池.
 */
export const RestPool: FC<RestPoolProps> = ({
  restDice,
  lockedDice,
  poolDice,
}) => {
  const hasAny = restDice.length > 0 || lockedDice.length > 0 || poolDice.length > 0;

  return (
    <div className="rest-pool-bar">
      <span className={`rest-stat${restDice.length > 0 ? " has-dice" : ""}`}>
        息库 <strong>{restDice.length}</strong>
        {restDice.length > 0 && <span className="rest-points">{zoneTotal(restDice)}</span>}
      </span>

      {lockedDice.length > 0 && (
        <span className="rest-stat locked has-dice">
          锁气 <strong>{lockedDice.length}</strong>
          <span className="rest-points">{zoneTotal(lockedDice)}</span>
        </span>
      )}

      {poolDice.length > 0 && (
        <span className="rest-stat pool">
          气池 <strong>{poolDice.length}</strong>
        </span>
      )}

      {/* Expandable detail */}
      {hasAny && (
        <details className="rest-detail-pop">
          <summary className="rest-detail-trigger">详情</summary>
          <div className="rest-detail-popover">
            {poolDice.length > 0 && (
              <div className="rest-detail-group">
                <span className="rest-detail-zone">气池</span>
                {poolDice.map((d) => (
                  <span key={d.id} className="rest-detail-die">{dieLabel(d)}</span>
                ))}
              </div>
            )}
            {restDice.length > 0 && (
              <div className="rest-detail-group">
                <span className="rest-detail-zone">息库</span>
                {restDice.map((d) => (
                  <span key={d.id} className="rest-detail-die">{dieLabel(d)}</span>
                ))}
              </div>
            )}
            {lockedDice.length > 0 && (
              <div className="rest-detail-group locked-detail">
                <span className="rest-detail-zone">锁气</span>
                {lockedDice.map((d) => (
                  <span key={d.id} className="rest-detail-die">{dieLabel(d)}</span>
                ))}
              </div>
            )}
          </div>
        </details>
      )}

      {!hasAny && (
        <span className="rest-stat empty">无其他区域骰子</span>
      )}
    </div>
  );
};
