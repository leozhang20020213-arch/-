import { type FC, useState } from "react";
import type { QiDie as QiDieType } from "../../../combat/types";
import { QiDie } from "./QiDie";

export interface TemporaryQiPoolProps {
  dice: QiDieType[];
  assignedIds: Set<string>;
  canDrag: boolean;
  onDragStart: (dieId: string) => void;
  onClickDie: (dieId: string) => void;
}

/**
 * Temporary Qi pool (临气区) — always visible zone for temp dice.
 *
 * Temp dice come from items, effects, 返照, 法门, 状态效果, etc.
 * They are visually distinct (dashed border, "临" marker) and
 * must be used or they expire.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │ 临气  2枚 · 9点  来源：返照 / 状态效果      │
 *   │ [D6 阴 4] [D8 阳 5]           [详情▾]       │
 *   └─────────────────────────────────────────────┘
 *
 * When empty:
 *   ┌─────────────────────────────────────────────┐
 *   │ 临气  0枚  暂无临时气骰                      │
 *   └─────────────────────────────────────────────┘
 */
export const TemporaryQiPool: FC<TemporaryQiPoolProps> = ({
  dice,
  assignedIds,
  canDrag,
  onDragStart,
  onClickDie,
}) => {
  const [expanded, setExpanded] = useState(false);

  const totalValue = dice.reduce((sum, d) => sum + (d.value ?? 0), 0);

  // Collect unique sources
  const sources = [...new Set(dice.map((d) => d.sourceName).filter(Boolean))];

  return (
    <div className={`temp-qi-zone${dice.length > 0 ? " has-dice" : ""}`}>
      {/* Header row */}
      <div className="temp-qi-header">
        <div className="temp-qi-header-left">
          <span className="temp-qi-title">临气</span>
          <span className="temp-qi-count">
            {dice.length} 枚
          </span>
          {dice.length > 0 && (
            <span className="temp-qi-sum">
              · {totalValue} 点
            </span>
          )}
          {sources.length > 0 && (
            <span className="temp-qi-sources">
              来源：{sources.join(" / ")}
            </span>
          )}
        </div>

        {dice.length > 0 && (
          <button
            className="temp-qi-detail-btn"
            type="button"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "收起▲" : "详情▾"}
          </button>
        )}
      </div>

      {/* Dice row or empty state */}
      {dice.length > 0 ? (
        <div className="temp-qi-dice">
          {dice.map((d) => (
            <QiDie
              key={d.id}
              die={d}
              isAssigned={assignedIds.has(d.id)}
              draggable={canDrag && !assignedIds.has(d.id)}
              onDragStart={onDragStart}
              onClick={onClickDie}
            />
          ))}
        </div>
      ) : (
        <div className="temp-qi-empty">
          <span className="temp-qi-empty-text">暂无临时气骰</span>
          <span className="temp-qi-empty-hint">
            临时气骰可由返照、法门、状态效果等生成
          </span>
        </div>
      )}

      {/* Expanded detail: list each die with source */}
      {expanded && dice.length > 0 && (
        <div className="temp-qi-detail">
          {dice.map((d) => {
            const natureLabel = d.nature === "yin" ? "阴" : d.nature === "yang" ? "阳" : "原";
            return (
              <div key={d.id} className="temp-qi-detail-row">
                <span className="temp-qi-detail-die">
                  {natureLabel}D{d.sides} ({d.value ?? "?"})
                </span>
                <span className="temp-qi-detail-source">
                  {d.sourceName || "未知来源"}
                </span>
                {d.temporary && <span className="temp-qi-detail-tag">临</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
