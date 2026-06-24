import { type FC, useState } from "react";
import type { QiDie as QiDieType } from "../../../combat/types";

export interface RestPoolProps {
  /** Dice in QI_REST (used/rested dice — 息库) */
  restDice: QiDieType[];
  /** Dice in QI_LOCK (locked from previous action — 锁气) */
  lockedDice: QiDieType[];
  /** Dice in QI_POOL (not yet rolled into sea — 气池) */
  poolDice: QiDieType[];
}

function dieLabel(d: QiDieType): string {
  const n = d.nature === "yin" ? "阴" : d.nature === "yang" ? "阳" : "原";
  const sides = `D${d.sides}`;
  const val = d.value ?? "?";
  return `${n}${sides}(${val})`;
}

/**
 * Rest Pool (息库) — proper zone for recuperable dice.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────────────┐
 *   │ 息库  4枚 · 12点     [详情▾]                         │
 *   │ [D6 阴 3] [D8 阳 5] [D4 阳 1] [D10 阴 3]            │
 *   │ ──────────────────────────────────────────────────── │
 *   │ 锁气 1枚 · 4点  │  气池 2枚                          │
 *   └──────────────────────────────────────────────────────┘
 *
 * When empty:
 *   ┌──────────────────────────────────────────────────────┐
 *   │ 息库  0枚  暂无待回骰子                              │
 *   │ 使用调息 / 返照可将已用骰子回收至气海                │
 *   └──────────────────────────────────────────────────────┘
 */
export const RestPool: FC<RestPoolProps> = ({
  restDice,
  lockedDice,
  poolDice,
}) => {
  const [detailOpen, setDetailOpen] = useState(false);

  const restTotal = restDice.reduce((s, d) => s + (d.value ?? 0), 0);
  const lockedTotal = lockedDice.reduce((s, d) => s + (d.value ?? 0), 0);
  const hasAny = restDice.length > 0 || lockedDice.length > 0 || poolDice.length > 0;

  return (
    <div className="rest-pool-zone">
      {/* ── 息库 main section ── */}
      <div className={`rest-pool-main${restDice.length > 0 ? " has-dice" : ""}`}>
        <div className="rest-pool-header">
          <div className="rest-pool-header-left">
            <span className="rest-pool-title">息库</span>
            <span className="rest-pool-count">
              {restDice.length} 枚
            </span>
            {restDice.length > 0 && (
              <span className="rest-pool-sum">
                · {restTotal} 点
              </span>
            )}
          </div>
          {hasAny && (
            <button
              className="rest-pool-detail-btn"
              type="button"
              onClick={() => setDetailOpen(!detailOpen)}
            >
              {detailOpen ? "收起▲" : "详情▾"}
            </button>
          )}
        </div>

        {/* Dice preview row (息库内骰子小列表) */}
        {restDice.length > 0 ? (
          <div className="rest-pool-dice-preview">
            {restDice.map((d) => (
              <span key={d.id} className="rest-pool-die-chip">
                {dieLabel(d)}
              </span>
            ))}
          </div>
        ) : (
          <div className="rest-pool-empty-hint">
            {lockedDice.length > 0 || poolDice.length > 0
              ? "暂无待回骰子 · 使用调息/返照回收已用骰子"
              : "暂无待回骰子"}
          </div>
        )}
      </div>

      {/* ── 锁气 / 气池 summary row ── */}
      <div className="rest-pool-secondary">
        {lockedDice.length > 0 ? (
          <span className="rest-secondary-stat locked-stat">
            锁气 <strong>{lockedDice.length} 枚</strong>
            <span className="rest-secondary-points">· {lockedTotal} 点</span>
          </span>
        ) : (
          <span className="rest-secondary-stat locked-stat empty-stat">
            锁气 0 枚
          </span>
        )}

        {poolDice.length > 0 ? (
          <span className="rest-secondary-stat pool-stat">
            气池 <strong>{poolDice.length} 枚</strong>
          </span>
        ) : (
          <span className="rest-secondary-stat pool-stat empty-stat">
            气池 0 枚
          </span>
        )}
      </div>

      {/* Expandable detail popover */}
      {detailOpen && hasAny && (
        <div className="rest-pool-detail">
          {restDice.length > 0 && (
            <div className="rest-detail-group">
              <span className="rest-detail-zone-label">息库</span>
              <div className="rest-detail-dice-list">
                {restDice.map((d) => (
                  <span key={d.id} className="rest-detail-die">
                    {dieLabel(d)}
                    <span className="rest-detail-source">{d.sourceName}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {lockedDice.length > 0 && (
            <div className="rest-detail-group locked-group">
              <span className="rest-detail-zone-label">锁气</span>
              <div className="rest-detail-dice-list">
                {lockedDice.map((d) => (
                  <span key={d.id} className="rest-detail-die locked-die">
                    {dieLabel(d)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {poolDice.length > 0 && (
            <div className="rest-detail-group">
              <span className="rest-detail-zone-label">气池</span>
              <div className="rest-detail-dice-list">
                {poolDice.map((d) => (
                  <span key={d.id} className="rest-detail-die">
                    {dieLabel(d)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
