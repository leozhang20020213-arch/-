// ==========================================================================
// QiAssignmentBoard — Main drag-and-drop dice assignment layout.
// Phase 2: 气海 (draggable dice) → 阴槽 / 阳槽 (drop targets).
// ==========================================================================

import { type FC, useState, useCallback, type DragEvent } from "react";
import {
  DndContext,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { CurrentMoveQiRequirement } from "../../types/dice";
import { QiDiceTray } from "./QiDiceTray";
import { QiDropSlot } from "./QiDropSlot";
import { QiDie2D } from "./QiDie2D";
import { useDiceStore } from "../../store/diceStore";
import { getDropRejectReason } from "../../lib/dice/diceAssignment";
import "./dice.css";

export interface QiAssignmentBoardProps {
  /** Current move requirement (null = no move selected) */
  moveRequirement: CurrentMoveQiRequirement | null;
  /** Whether a target is selected */
  hasTarget: boolean;
  /** Minimum height */
  minHeight?: number;
}

/**
 * QiAssignmentBoard — the complete dice assignment area.
 *
 * Layout (horizontal on wide screens):
 * ┌──────────────────────┬────────────┬────────────┐
 * │    气海 (QiDiceTray)  │  阴槽       │  阳槽       │
 * │   [D6] [D6] [D4]    │  [D6] [D4] │  [D6]      │
 * │   draggable dice     │  drop zone │  drop zone │
 * └──────────────────────┴────────────┴────────────┘
 *
 * Uses @dnd-kit for drag and drop.
 * Validation via diceAssignment.ts rules.
 */
export const QiAssignmentBoard: FC<QiAssignmentBoardProps> = ({
  moveRequirement,
  hasTarget,
  minHeight = 240,
}) => {
  const {
    state,
    assignDieToSlot,
    returnDieToQiSea,
    clearCurrentAssignment,
    getAssignedYinDice,
    getAssignedYangDice,
  } = useDiceStore();

  const [activeDragDieId, setActiveDragDieId] = useState<string | null>(null);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);

  const assignedYin = getAssignedYinDice();
  const assignedYang = getAssignedYangDice();

  // A move must be selected AND a target must be selected to allow drops
  const canDrop = Boolean(moveRequirement?.moveId && hasTarget);

  // Configure pointer sensor for reliable drag
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6, // 6px movement before drag starts (prevents accidental drag)
      },
    }),
  );

  const activeDragDie = activeDragDieId
    ? state.qiDice.find((d) => d.id === activeDragDieId) ?? null
    : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const dieId = String(event.active.id).replace(/^die-/, "");
    setActiveDragDieId(dieId);
    setRejectMessage(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const dieId = String(event.active.id).replace(/^die-/, "");
      setActiveDragDieId(null);

      const { over } = event;
      if (!over) {
        // Dropped outside any target — snaps back
        return;
      }

      const targetSlot = String(over.id).replace(/^slot-/, "");
      if (targetSlot !== "yinSlot" && targetSlot !== "yangSlot") return;

      const die = state.qiDice.find((d) => d.id === dieId);
      if (!die) return;

      // Check reject reason
      const reason = getDropRejectReason(die, targetSlot as "yinSlot" | "yangSlot");
      if (reason) {
        setRejectMessage(reason);
        setTimeout(() => setRejectMessage(null), 1800);
        return;
      }

      // Valid — assign
      assignDieToSlot(dieId, targetSlot as "yinSlot" | "yangSlot");
      setRejectMessage(null);
    },
    [state.qiDice, assignDieToSlot],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="qi-assignment-board" style={{ minHeight }}>
        {/* Top bar: assignment flow hint */}
        <div className="qi-assignment-board__flow-hint">
          <span className="qi-assignment-board__step">
            ① 选择招式
          </span>
          <span className="qi-assignment-board__arrow">→</span>
          <span className="qi-assignment-board__step">
            ② 选择目标
          </span>
          <span className="qi-assignment-board__arrow">→</span>
          <span className={`qi-assignment-board__step${canDrop ? " qi-assignment-board__step--active" : ""}`}>
            ③ 拖骰入槽
          </span>
          {moveRequirement?.moveName && (
            <span className="qi-assignment-board__current-move">
              当前招式：{moveRequirement.moveName}
              {moveRequirement.minYin > 0 && ` · 阴≥${moveRequirement.minYin}`}
              {moveRequirement.minYang > 0 && ` · 阳≥${moveRequirement.minYang}`}
            </span>
          )}
        </div>

        {/* Reject message toast */}
        {rejectMessage && (
          <div className="qi-assignment-board__reject-toast">
            {rejectMessage}
          </div>
        )}

        {/* Main area: Sea + Slots */}
        <div className="qi-assignment-board__main">
          {/* 气海 — source of draggable dice */}
          <div className="qi-assignment-board__sea">
            <QiDiceTray
              minHeight={minHeight - 60}
              draggable
              canDrag={canDrop}
            />
          </div>

          {/* 阴槽 */}
          <div className="qi-assignment-board__slot">
            <QiDropSlot
              type="yinSlot"
              dice={assignedYin}
              requirement={moveRequirement}
              onReturnDie={returnDieToQiSea}
              canDrop={canDrop}
            />
          </div>

          {/* 阳槽 */}
          <div className="qi-assignment-board__slot">
            <QiDropSlot
              type="yangSlot"
              dice={assignedYang}
              requirement={moveRequirement}
              onReturnDie={returnDieToQiSea}
              canDrop={canDrop}
            />
          </div>
        </div>

        {/* Footer: clear assignment */}
        {(assignedYin.length > 0 || assignedYang.length > 0) && (
          <div className="qi-assignment-board__footer">
            <span>阴槽 {assignedYin.length} 枚（合值 {assignedYin.reduce((s, d) => s + d.value, 0)}）</span>
            <span>阳槽 {assignedYang.length} 枚（合值 {assignedYang.reduce((s, d) => s + d.value, 0)}）</span>
            <button
              type="button"
              className="qi-assignment-board__clear-btn"
              onClick={clearCurrentAssignment}
            >
              清空槽位
            </button>
          </div>
        )}
      </div>

      {/* Drag overlay: show the die being dragged */}
      <DragOverlay dropAnimation={null}>
        {activeDragDie ? (
          <div style={{ opacity: 0.85, transform: "scale(1.08)" }}>
            <QiDie2D die={activeDragDie} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
