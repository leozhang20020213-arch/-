import type { FC } from "react";
import type { QiDie as QiDieType, Move } from "../../../combat/types";
import { QiDie } from "./QiDie";

export interface CurrentMoveSlotsProps {
  /** The currently selected move (null = no move selected) */
  move: Move | undefined;
  /** Dice assigned to the yin slot */
  yinDice: QiDieType[];
  /** Dice assigned to the yang slot */
  yangDice: QiDieType[];
  /** Whether the move requires both yin+yang (formal) or not (quick) */
  requiresBoth: boolean;
  /** Whether dice can be dropped into slots */
  canAssign: boolean;
  /** Drop handlers */
  onDropToYin: (dieId: string) => void;
  onDropToYang: (dieId: string) => void;
  /** Remove die from slot */
  onRemove: (dieId: string) => void;
  /** Click a die in a slot */
  onClickDie: (dieId: string) => void;
}

/**
 * Yin/Yang slot drop zones for the currently selected move.
 *
 * Each slot shows:
 *   - Slot name (阴槽 / 阳槽)
 *   - Dice count and value total
 *   - Requirement badge (✓ met / ✗ unmet)
 *   - Dropped dice cards
 */
export const CurrentMoveSlots: FC<CurrentMoveSlotsProps> = ({
  move,
  yinDice,
  yangDice,
  requiresBoth,
  canAssign,
  onDropToYin,
  onDropToYang,
  onRemove,
  onClickDie,
}) => {
  const yinTotal = yinDice.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const yangTotal = yangDice.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const grandTotal = yinTotal + yangTotal;

  const yinMet = yinDice.length >= 1;
  const yangMet = yangDice.length >= 1;
  const minDiceMet = !move || (yinDice.length + yangDice.length) >= move.minDice;

  function handleDragOver(e: React.DragEvent) {
    if (canAssign) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }

  function handleDropYin(e: React.DragEvent) {
    e.preventDefault();
    if (!canAssign) return;
    const dieId = e.dataTransfer.getData("text/plain");
    if (dieId) onDropToYin(dieId);
  }

  function handleDropYang(e: React.DragEvent) {
    e.preventDefault();
    if (!canAssign) return;
    const dieId = e.dataTransfer.getData("text/plain");
    if (dieId) onDropToYang(dieId);
  }

  if (!move) {
    return (
      <div className="move-slots-empty">
        <span>请先选择招式</span>
        {yinDice.length + yangDice.length > 0 && (
          <span className="move-slots-empty-pre">
            （已预选 {yinDice.length + yangDice.length} 枚骰子，阴{yinDice.length}/阳{yangDice.length}）
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="current-move-slots">
      <div className="move-slots-header">
        <span className="move-slots-title">{move.name}</span>
        <span className="move-slots-req-row">
          <span className={`move-slots-req-badge ${minDiceMet ? "met" : "unmet"}`}>
            {yinDice.length + yangDice.length}/{move.minDice} 枚
          </span>
          <span className="move-slots-requirement">
            {requiresBoth ? "至少1阴+1阳" : "任意气性"}
          </span>
        </span>
      </div>

      <div className="move-slots-row">
        {/* Yin slot */}
        <div
          className={`move-slot yin-slot${canAssign ? " drop-target" : ""}${yinMet ? " met" : ""}`}
          onDragOver={handleDragOver}
          onDrop={handleDropYin}
        >
          <div className="slot-header">
            <span className="slot-name">阴槽</span>
            <span className={`slot-req ${yinMet ? "met" : "unmet"}`}>
              {yinMet ? `✓ ${yinDice.length}枚 ${yinTotal}点` : "需≥1"}
            </span>
          </div>
          <div className="slot-dice">
            {yinDice.length > 0 ? (
              yinDice.map((d) => (
                <QiDie
                  key={d.id}
                  die={d}
                  isAssigned
                  draggable={false}
                  onDragStart={() => {}}
                  onClick={() => onRemove(d.id)}
                />
              ))
            ) : (
              <span className="slot-placeholder">
                {canAssign ? "拖入阴骰" : "—"}
              </span>
            )}
          </div>
        </div>

        {/* Yang slot */}
        <div
          className={`move-slot yang-slot${canAssign ? " drop-target" : ""}${yangMet ? " met" : ""}`}
          onDragOver={handleDragOver}
          onDrop={handleDropYang}
        >
          <div className="slot-header">
            <span className="slot-name">阳槽</span>
            <span className={`slot-req ${yangMet ? "met" : "unmet"}`}>
              {yangMet ? `✓ ${yangDice.length}枚 ${yangTotal}点` : "需≥1"}
            </span>
          </div>
          <div className="slot-dice">
            {yangDice.length > 0 ? (
              yangDice.map((d) => (
                <QiDie
                  key={d.id}
                  die={d}
                  isAssigned
                  draggable={false}
                  onDragStart={() => {}}
                  onClick={() => onRemove(d.id)}
                />
              ))
            ) : (
              <span className="slot-placeholder">
                {canAssign ? "拖入阳骰" : "—"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Slot totals */}
      {yinDice.length + yangDice.length > 0 && (
        <div className="move-slots-total">
          合计 {yinTotal + yangTotal} 点 · 阴{yinTotal} 阳{yangTotal} · 合{grandTotal} · 差{Math.abs(yinTotal - yangTotal)}
        </div>
      )}
    </div>
  );
};
