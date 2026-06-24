import { useState, type FC } from "react";
import type { CombatState, Move, QiDie } from "../../../combat/types";
import { canConfirmDeclaration, canDropDieToSlot, type ConfirmCheck } from "../../../lib/combat/qiAssignment";
import { QiPool } from "./QiPool";
import { TemporaryQiPool } from "./TemporaryQiPool";
import { RestPool } from "./RestPool";
import { CurrentMoveSlots } from "./CurrentMoveSlots";

export interface QiDiceDockProps {
  /** Full combat state (for phase check) */
  state: CombatState;
  /** All dice owned by the active actor */
  actorDice: QiDie[];
  /** Currently selected move (may be undefined) */
  selectedMove: Move | undefined;
  /** Whether a target is selected */
  hasSelectedTarget: boolean;
  /** Called when the player wants to confirm & lock, passes slot dice IDs */
  onConfirm: (yinIds: string[], yangIds: string[]) => void;
  /** Called when the player wants to roll dice from pool into sea */
  onRollToSea?: () => void;
  /** Distance validation warning (shown near confirm button) */
  distanceWarning?: string;
}

/**
 * QiDiceDock — the single, canonical qi dice assignment area.
 *
 * Layout:
 *   ┌─────────────────────────────────────────┐
 *   │ TemporaryQiPool (临气 — if any)          │
 *   ├──────────────────────┬──────────────────┤
 *   │ QiPool (气海)         │ CurrentMoveSlots │
 *   │  draggable dice      │  阴槽 | 阳槽     │
 *   │                      │                  │
 *   ├──────────────────────┴──────────────────┤
 *   │ RestPool (息库/锁气/气池 stats)          │
 *   ├─────────────────────────────────────────┤
 *   │ [确认宣言并锁气]  ← enabled/disabled     │
 *   └─────────────────────────────────────────┘
 *
 * Dice can be pre-assigned to slots even without a selected move.
 * The confirm button shows why it's disabled when requirements aren't met.
 */
export const QiDiceDock: FC<QiDiceDockProps> = ({
  state,
  actorDice,
  selectedMove,
  hasSelectedTarget,
  onConfirm,
  onRollToSea,
  distanceWarning,
}) => {
  // Local slot assignment state — tracks which dice are in yin/yang slots
  const [yinSlotIds, setYinSlotIds] = useState<string[]>([]);
  const [yangSlotIds, setYangSlotIds] = useState<string[]>([]);
  const [dragError, setDragError] = useState<string | null>(null);

  const activeActorId = state.activeActorId;

  // Filter dice by zone
  const seaDice = actorDice.filter((d) => d.zone === "QI_SEA");
  const tempDice = actorDice.filter((d) => d.zone === "TEMP_QI");
  const restDice = actorDice.filter((d) => d.zone === "QI_REST");
  const lockedDice = actorDice.filter((d) => d.zone === "QI_LOCK");
  const poolDice = actorDice.filter((d) => d.zone === "QI_POOL");

  // Assigned IDs set for quick lookup
  const assignedIds = new Set([...yinSlotIds, ...yangSlotIds]);

  // Whether drag is allowed now
  const canDrag = Boolean(
    (state.phase === "declare" || state.phase === "scene"),
  );

  // Resolve slot dice objects
  const yinDice = yinSlotIds
    .map((id) => actorDice.find((d) => d.id === id))
    .filter(Boolean) as QiDie[];
  const yangDice = yangSlotIds
    .map((id) => actorDice.find((d) => d.id === id))
    .filter(Boolean) as QiDie[];

  // Is this a formal move requiring both slots?
  const requiresBoth = selectedMove?.timing === "正式出手";

  // Confirm check
  const confirmCheck: ConfirmCheck = canConfirmDeclaration({
    phase: state.phase,
    hasSelectedMove: Boolean(selectedMove),
    hasSelectedTarget,
    yinCount: yinSlotIds.length,
    yangCount: yangSlotIds.length,
    requiresBothSlots: requiresBoth,
  });

  // ---- Handlers ----

  function handleDropToYin(dieId: string) {
    setDragError(null);
    const die = actorDice.find((d) => d.id === dieId);
    if (!die) return;

    if (!canDropDieToSlot(die, "yin", activeActorId)) {
      setDragError(`${die.nature === "yin" ? "阴" : die.nature === "yang" ? "阳" : "原"}骰 D${die.sides} 不能投入阴槽`);
      setTimeout(() => setDragError(null), 1800);
      return;
    }

    // Remove from other slot if present, add to yin
    setYangSlotIds((prev) => prev.filter((id) => id !== dieId));
    setYinSlotIds((prev) => (prev.includes(dieId) ? prev : [...prev, dieId]));
  }

  function handleDropToYang(dieId: string) {
    setDragError(null);
    const die = actorDice.find((d) => d.id === dieId);
    if (!die) return;

    if (!canDropDieToSlot(die, "yang", activeActorId)) {
      setDragError(`${die.nature === "yin" ? "阴" : die.nature === "yang" ? "阳" : "原"}骰 D${die.sides} 不能投入阳槽`);
      setTimeout(() => setDragError(null), 1800);
      return;
    }

    setYinSlotIds((prev) => prev.filter((id) => id !== dieId));
    setYangSlotIds((prev) => (prev.includes(dieId) ? prev : [...prev, dieId]));
  }

  function handleRemoveFromSlot(dieId: string) {
    setYinSlotIds((prev) => prev.filter((id) => id !== dieId));
    setYangSlotIds((prev) => prev.filter((id) => id !== dieId));
  }

  function handleClickDie(dieId: string) {
    // Toggle: if in a slot, remove
    if (assignedIds.has(dieId)) {
      handleRemoveFromSlot(dieId);
    }
    // Clicking a sea die doesn't auto-assign — drag required
  }

  const yinTotal = yinDice.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const yangTotal = yangDice.reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <div className="qi-dice-dock">
      {/* Temporary Qi */}
      <TemporaryQiPool
        dice={tempDice}
        assignedIds={assignedIds}
        canDrag={canDrag}
        onDragStart={() => {}}
        onClickDie={handleClickDie}
      />

      {/* Main area: Qi Sea + Move Slots */}
      <div className="qi-dock-main">
        <QiPool
          dice={seaDice}
          assignedIds={assignedIds}
          canDrag={canDrag}
          onDragStart={() => {}}
          onClickDie={handleClickDie}
          onRoll={poolDice.length > 0 ? onRollToSea : undefined}
        />
        <div className="qi-dock-divider" />
        <CurrentMoveSlots
          move={selectedMove}
          yinDice={yinDice}
          yangDice={yangDice}
          requiresBoth={requiresBoth}
          canAssign={canDrag}
          onDropToYin={handleDropToYin}
          onDropToYang={handleDropToYang}
          onRemove={handleRemoveFromSlot}
          onClickDie={handleClickDie}
        />
      </div>

      {/* Drag error toast */}
      {dragError && (
        <div className="qi-drag-error">{dragError}</div>
      )}

      {/* Slot summary (visible before move is selected, for pre-selection) */}
      {!selectedMove && (yinSlotIds.length + yangSlotIds.length > 0) && (
        <div className="qi-preselect-hint">
          已预选 {yinSlotIds.length + yangSlotIds.length} 枚气骰（阴{yinTotal}点 / 阳{yangTotal}点）
          — 选择招式和目标后即可确认
        </div>
      )}

      {/* Rest / Locked / Pool stats */}
      <RestPool
        restDice={restDice}
        lockedDice={lockedDice}
        poolDice={poolDice}
      />

      {/* Confirm button */}
      <button
        className={`qi-confirm-btn${confirmCheck.allowed ? "" : " disabled"}`}
        type="button"
        disabled={!confirmCheck.allowed}
        onClick={() => onConfirm(yinSlotIds, yangSlotIds)}
      >
        确认宣言并锁气
      </button>
      {!confirmCheck.allowed && confirmCheck.reasons.length > 0 && (
        <p className="qi-confirm-hint">
          {confirmCheck.reasons.join("、")}
        </p>
      )}
      {distanceWarning && (
        <p className="qi-confirm-hint distance-warn">
          ⚠ {distanceWarning}
        </p>
      )}
    </div>
  );
};
