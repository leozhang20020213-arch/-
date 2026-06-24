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
  /** Whether the move requires both yin+ yang (formal) or not (quick) */
  requiresBoth: boolean;
  /** Current phase */
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
 * Layout:
 *   ┌──────────┐  ┌──────────┐
 *   │  阴槽     │  │  阳槽     │
 *   │ (yin)    │  │ (yang)   │
 *   │  dice... │  │  dice... │
 *   │ 需≥1     │  │ 需≥1     │
 *   └──────────┘  └──────────┘
 *
 * Empty state: "将骰子拖入此槽"
 * Requirement badge: "需≥1" (red if unmet, green if met)
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
  const yinMet = yinDice.length >= 1;
  const yangMet = yangDice.length >= 1;

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
      </div>
    );
  }

  return (
    <div className="current-move-slots">
      <div className="move-slots-header">
        <span className="move-slots-title">{move.name}</span>
        <span className="move-slots-requirement">
          {requiresBoth ? "至少1阴+1阳" : "任意气性"}
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
              {yinMet ? "✓" : "需≥1"}
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
              {yangMet ? "✓" : "需≥1"}
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
    </div>
  );
};
