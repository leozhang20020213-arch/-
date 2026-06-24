// ==========================================================================
// QiDiceTray — 2D Qi Dice Tray (气海骰盘)
// Phase 1: displays qi sea dice in a horizontal row with toolbar.
// ==========================================================================

import { type FC, useState, useCallback } from "react";
import { QiDie2D } from "./QiDie2D";
import { QiDiceToolbar } from "./QiDiceToolbar";
import { useDiceStore } from "../../store/diceStore";
import "./dice.css";

export interface QiDiceTrayProps {
  /** Minimum height for the tray area (default: 200) */
  minHeight?: number;
}

/**
 * QiDiceTray — the main 2D dice display area.
 *
 * Layout:
 * ┌──────────────────────────────────────────────┐
 * │ 气海 · 当前可用气骰          [Toolbar]       │
 * ├──────────────────────────────────────────────┤
 * │  [阴D6] [阴D6] [阳D6] [阳D6] [原D4] [原D4] │
 * │    3      2      5      1      2      4      │
 * └──────────────────────────────────────────────┘
 *
 * Self-contained: reads/writes via useDiceStore().
 */
export const QiDiceTray: FC<QiDiceTrayProps> = ({
  minHeight = 200,
}) => {
  const {
    state,
    initStarterDice,
    rollAllQiSeaDice,
    resetDiceToQiSea,
    selectDie,
    getQiSeaDice,
  } = useDiceStore();

  const [isRolling, setIsRolling] = useState(false);

  const qiSeaDice = getQiSeaDice();
  const hasDice = state.qiDice.length > 0;

  const handleRoll = useCallback(() => {
    if (isRolling || !hasDice) return;
    setIsRolling(true);
    // Brief delay to show animation, then roll
    setTimeout(() => {
      rollAllQiSeaDice();
      setIsRolling(false);
    }, 400);
  }, [isRolling, hasDice, rollAllQiSeaDice]);

  return (
    <div
      className="qi-dice-tray"
      style={{ minHeight }}
    >
      {/* Header row */}
      <div className="qi-dice-tray__header">
        <div className="qi-dice-tray__title">
          <span className="qi-dice-tray__title-text">气海</span>
          <span className="qi-dice-tray__subtitle">
            {qiSeaDice.length > 0
              ? `当前可用气骰 ${qiSeaDice.length} 枚`
              : "暂无气骰 · 请开始场景或调息"}
          </span>
        </div>
        <QiDiceToolbar
          hasDice={hasDice}
          isRolling={isRolling}
          onInit={initStarterDice}
          onRoll={handleRoll}
          onReset={resetDiceToQiSea}
        />
      </div>

      {/* Dice display area */}
      <div className="qi-dice-tray__dice-area">
        {qiSeaDice.length > 0 ? (
          <div className="qi-dice-tray__dice-row">
            {qiSeaDice.map((die) => (
              <QiDie2D
                key={die.id}
                die={die}
                selected={state.selectedDieId === die.id}
                rolling={isRolling}
                onClick={selectDie}
              />
            ))}
          </div>
        ) : (
          <div className="qi-dice-tray__empty">
            <span className="qi-dice-tray__empty-icon">🎲</span>
            <p>气海暂无气骰。请开始场景或调息。</p>
            <p className="qi-dice-tray__empty-hint">
              点击「初始化气骰」生成六枚入門气骰
            </p>
          </div>
        )}
      </div>

      {/* Quick stats footer */}
      {hasDice && (
        <div className="qi-dice-tray__footer">
          <span>气海 {qiSeaDice.length} 枚</span>
          {state.lastRollAt && (
            <span className="qi-dice-tray__last-roll">
              上次投掷：{new Date(state.lastRollAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
