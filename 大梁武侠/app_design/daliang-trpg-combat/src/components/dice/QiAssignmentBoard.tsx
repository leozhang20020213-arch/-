// ==========================================================================
// QiAssignmentBoard — Main drag-and-drop dice assignment layout.
// Phase 3: adds confirm/lock declaration, rest pool flow.
// ==========================================================================

import { type FC, useState, useCallback } from "react";
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
import { QiRequirementStatus } from "./QiRequirementStatus";
import { QiDeclarationSummary } from "./QiDeclarationSummary";
import { useDiceStore } from "../../store/diceStore";
import { getDropRejectReason } from "../../lib/dice/diceAssignment";
import { canConfirmQiDeclaration } from "../../lib/dice/qiDeclaration";
import "./dice.css";

export interface QiAssignmentBoardProps {
  /** Current move requirement (null = no move selected) */
  moveRequirement: CurrentMoveQiRequirement | null;
  /** Whether a target is selected */
  hasTarget: boolean;
  /** Current target name */
  targetName?: string;
  /** Minimum height */
  minHeight?: number;
}

/**
 * QiAssignmentBoard — the complete dice assignment + declaration area.
 */
export const QiAssignmentBoard: FC<QiAssignmentBoardProps> = ({
  moveRequirement,
  hasTarget,
  targetName = "",
  minHeight = 260,
}) => {
  const {
    state,
    assignDieToSlot,
    returnDieToQiSea,
    clearCurrentAssignment,
    getAssignedYinDice,
    getAssignedYangDice,
    getRestPoolDice,
    lockDeclaration,
    resolveDeclaration,
    resetDeclaration,
  } = useDiceStore();

  const [activeDragDieId, setActiveDragDieId] = useState<string | null>(null);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const assignedYin = getAssignedYinDice();
  const assignedYang = getAssignedYangDice();
  const restPoolDice = getRestPoolDice();

  const isLocked = state.declarationStatus === "locked";
  const isResolved = state.declarationStatus === "resolved";

  // A move must be selected AND a target must be selected to allow drops
  // Also: cannot drag when locked
  const canDrop = Boolean(moveRequirement?.moveId && hasTarget && !isLocked && !isResolved);

  // Confirm check
  const yinTotal = assignedYin.reduce((s, d) => s + d.value, 0);
  const yangTotal = assignedYang.reduce((s, d) => s + d.value, 0);

  const confirmCheck = canConfirmQiDeclaration({
    requirement: moveRequirement,
    targetId: state.targetId,
    targetName,
    yinDice: assignedYin,
    yangDice: assignedYang,
    declarationStatus: state.declarationStatus,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
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
      if (!over) return;

      const targetSlot = String(over.id).replace(/^slot-/, "");
      if (targetSlot !== "yinSlot" && targetSlot !== "yangSlot") return;

      const die = state.qiDice.find((d) => d.id === dieId);
      if (!die) return;

      const reason = getDropRejectReason(die, targetSlot as "yinSlot" | "yangSlot");
      if (reason) {
        setRejectMessage(reason);
        setTimeout(() => setRejectMessage(null), 1800);
        return;
      }

      assignDieToSlot(dieId, targetSlot as "yinSlot" | "yangSlot");
      setRejectMessage(null);
    },
    [state.qiDice, assignDieToSlot],
  );

  // ---- Confirm handler ----
  const handleConfirm = useCallback(() => {
    setConfirmError(null);
    if (!confirmCheck.ok) {
      setConfirmError(confirmCheck.reasons.join("、"));
      setTimeout(() => setConfirmError(null), 2500);
      return;
    }
    if (!moveRequirement?.moveId) return;
    lockDeclaration(
      moveRequirement.moveId,
      moveRequirement.moveName,
      state.targetId ?? "",
      targetName,
      assignedYin,
      assignedYang,
    );
  }, [confirmCheck, moveRequirement, state.targetId, targetName, assignedYin, assignedYang, lockDeclaration]);

  // ---- Resolve handler ----
  const handleResolve = useCallback(() => {
    resolveDeclaration();
  }, [resolveDeclaration]);

  // ---- Reset handler ----
  const handleReset = useCallback(() => {
    resetDeclaration();
    clearCurrentAssignment();
  }, [resetDeclaration, clearCurrentAssignment]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="qi-assignment-board" style={{ minHeight }}>
        {/* Flow hint */}
        <div className="qi-assignment-board__flow-hint">
          <span className="qi-assignment-board__step">① 选招</span>
          <span className="qi-assignment-board__arrow">→</span>
          <span className="qi-assignment-board__step">② 选目标</span>
          <span className="qi-assignment-board__arrow">→</span>
          <span className={`qi-assignment-board__step${canDrop ? " qi-assignment-board__step--active" : ""}`}>
            ③ 拖骰入槽
          </span>
          <span className="qi-assignment-board__arrow">→</span>
          <span className={`qi-assignment-board__step${isLocked ? " qi-assignment-board__step--active" : ""}`}>
            ④ 锁气
          </span>
          {moveRequirement?.moveName && (
            <span className="qi-assignment-board__current-move">
              {moveRequirement.moveName}
              {targetName ? ` → ${targetName}` : ""}
            </span>
          )}
          {state.declarationStatus !== "draft" && (
            <span className={`qi-assignment-board__status-badge qi-assignment-board__status-badge--${state.declarationStatus}`}>
              {state.declarationStatus === "locked" ? "🔒 已锁气" : "✅ 已结算"}
            </span>
          )}
        </div>

        {/* Requirement status */}
        {!isLocked && !isResolved && (
          <QiRequirementStatus
            requirement={moveRequirement}
            yinCount={assignedYin.length}
            yangCount={assignedYang.length}
            yinTotal={yinTotal}
            yangTotal={yangTotal}
          />
        )}

        {/* Reject / error toasts */}
        {rejectMessage && (
          <div className="qi-assignment-board__reject-toast">{rejectMessage}</div>
        )}
        {confirmError && (
          <div className="qi-assignment-board__reject-toast">{confirmError}</div>
        )}

        {/* Main area: Sea + Slots */}
        <div className="qi-assignment-board__main">
          <div className="qi-assignment-board__sea">
            <QiDiceTray
              minHeight={minHeight - 60}
              draggable
              canDrag={canDrop}
            />
          </div>

          <div className="qi-assignment-board__slot">
            <QiDropSlot
              type="yinSlot"
              dice={assignedYin}
              requirement={moveRequirement}
              onReturnDie={returnDieToQiSea}
              canDrop={canDrop}
            />
          </div>

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

        {/* Action bar: confirm / footer */}
        {!isLocked && !isResolved && (
          <div className="qi-assignment-board__footer">
            <span>阴槽 {assignedYin.length} 枚（合{yinTotal}）</span>
            <span>阳槽 {assignedYang.length} 枚（合{yangTotal}）</span>
            {(assignedYin.length > 0 || assignedYang.length > 0) && (
              <button
                type="button"
                className="qi-assignment-board__clear-btn"
                onClick={clearCurrentAssignment}
              >
                清空槽位
              </button>
            )}
            <button
              type="button"
              className={`qi-assignment-board__confirm-btn${confirmCheck.ok ? "" : " disabled"}`}
              disabled={!confirmCheck.ok}
              onClick={handleConfirm}
            >
              确认宣言并锁气
            </button>
            {!confirmCheck.ok && confirmCheck.reasons.length > 0 && (
              <span className="qi-assignment-board__confirm-hint">
                {confirmCheck.reasons.join("、")}
              </span>
            )}
          </div>
        )}

        {/* Declaration summary (when locked or resolved) */}
        {state.activeDeclaration && (isLocked || isResolved) && (
          <QiDeclarationSummary
            declaration={state.activeDeclaration}
            status={state.declarationStatus}
            onResolve={isLocked ? handleResolve : undefined}
            onReset={handleReset}
          />
        )}

        {/* Rest pool indicator */}
        {restPoolDice.length > 0 && (
          <div className="qi-assignment-board__rest-pool">
            <span className="qi-assignment-board__rest-label">息库</span>
            <span>{restPoolDice.length} 枚</span>
            <span className="qi-assignment-board__rest-detail">
              {restPoolDice.map((d) => `${d.face}D${d.sides}=${d.value}`).join("、")}
            </span>
            <span className="qi-assignment-board__rest-hint">需调息/回气取回</span>
          </div>
        )}
      </div>

      {/* Drag overlay */}
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
