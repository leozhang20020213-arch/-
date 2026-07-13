import { type FC, useState } from "react";
import type { QiDie as QiDieType } from "../../../combat/types";

export interface RestPoolProps {
  restDice: QiDieType[];
  lockedDice: QiDieType[];
  poolDice: QiDieType[];
}

function dieLabel(die: QiDieType): string {
  const nature = die.nature === "yin" ? "阴" : die.nature === "yang" ? "阳" : "原";
  return `${nature}D${die.sides}(${die.value ?? "?"})`;
}

/**
 * Compact reserve strip for the three non-editable resource destinations.
 * All seven qi zones remain visible, while expanded source detail floats over
 * the board instead of pushing the declaration controls out of view.
 */
export const RestPool: FC<RestPoolProps> = ({ restDice, lockedDice, poolDice }) => {
  const [detailOpen, setDetailOpen] = useState(false);
  const restTotal = restDice.reduce((sum, die) => sum + (die.value ?? 0), 0);
  const lockedTotal = lockedDice.reduce((sum, die) => sum + (die.value ?? 0), 0);
  const hasAny = restDice.length > 0 || lockedDice.length > 0 || poolDice.length > 0;

  return (
    <div className="qi-reserve-strip">
      <section className={`qi-reserve-zone pool${poolDice.length ? " has-dice" : ""}`}>
        <span className="qi-reserve-label">气池</span>
        <strong>{poolDice.length} 枚</strong>
        <small>{poolDice.length ? "待整体投掷" : "已入场"}</small>
      </section>

      <section className={`qi-reserve-zone locked${lockedDice.length ? " has-dice" : ""}`}>
        <span className="qi-reserve-label">锁气</span>
        <strong>{lockedDice.length} 枚</strong>
        <small>{lockedDice.length ? `${lockedTotal} 点 · 待结算` : "无当前投入"}</small>
      </section>

      <section className={`qi-reserve-zone rest${restDice.length ? " has-dice" : ""}`}>
        <span className="qi-reserve-label">息库</span>
        <strong>{restDice.length} 枚</strong>
        <small>{restDice.length ? `${restTotal} 点 · 可调息/返照` : "无待回气骰"}</small>
        {hasAny && (
          <button
            className="rest-pool-detail-btn"
            type="button"
            aria-expanded={detailOpen}
            onClick={() => setDetailOpen((open) => !open)}
          >
            {detailOpen ? "收起" : "查看"}
          </button>
        )}
      </section>

      {detailOpen && hasAny && (
        <div className="qi-reserve-popover" role="dialog" aria-label="气骰资源详情">
          <div className="qi-reserve-popover__header">
            <strong>气骰来源与去向</strong>
            <button type="button" onClick={() => setDetailOpen(false)} aria-label="关闭气骰详情">×</button>
          </div>
          {([
            ["息库", restDice],
            ["锁气", lockedDice],
            ["气池", poolDice],
          ] as const).map(([label, dice]) => (
            <div className="qi-reserve-popover__group" key={label}>
              <span>{label}</span>
              <div>
                {dice.length > 0 ? dice.map((die) => (
                  <span className="rest-detail-die" key={die.id}>
                    {dieLabel(die)}
                    <small>{die.sourceName || "未知来源"}</small>
                  </span>
                )) : <em>无</em>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
