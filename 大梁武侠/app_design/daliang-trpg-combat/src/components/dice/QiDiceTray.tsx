// ==========================================================================
// QiDiceTray — 2D Qi Dice Tray (气海骰盘)
// Phase 2: supports draggable mode via @dnd-kit.
// ==========================================================================

import { type FC, useState, useCallback } from "react";
import { QiDie2D } from "./QiDie2D";
import { DraggableQiDie } from "./DraggableQiDie";
import { QiDiceToolbar } from "./QiDiceToolbar";
import { useDiceStore } from "../../store/diceStore";
import "./dice.css";

export interface QiDiceTrayProps {
  /** Minimum height for the tray area (default: 200) */
  minHeight?: number;
  /** Enable drag-and-drop (requires DndContext ancestor) */
  draggable?: boolean;
  /** Whether drag is currently allowed (e.g., move selected + target selected) */
  canDrag?: boolean;
}

/**
 * QiDiceTray — the main 2D dice display area.
 *
 * When draggable=true, each die is wrapped in DraggableQiDie
 * and requires a @dnd-kit DndContext ancestor.
 */
export const QiDiceTray: FC<QiDiceTrayProps> = ({
  minHeight = 200,
  draggable = false,
  canDrag = true,
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
              ? `当前可用气骰 ${qiSeaDice.length} 枚${draggable ? " · 可拖入阴槽/阳槽" : ""}`
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
            {qiSeaDice.map((die) =>
              draggable ? (
                <DraggableQiDie
                  key={die.id}
                  die={die}
                  selected={state.selectedDieId === die.id}
                  disabled={!canDrag}
                />
              ) : (
                <QiDie2D
                  key={die.id}
                  die={die}
                  selected={state.selectedDieId === die.id}
                  rolling={isRolling}
                  onClick={selectDie}
                />
              ),
            )}
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
