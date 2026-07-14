import { useEffect, useState, type FC } from "react";
import type { CombatState, Move, QiDie } from "../../../combat/types";
import { canConfirmDeclaration, canDropDieToSlot, type ConfirmCheck } from "../../../lib/combat/qiAssignment";
import { QiPool } from "./QiPool";
import { TemporaryQiPool } from "./TemporaryQiPool";
import { RestPool } from "./RestPool";
import { CurrentMoveSlots } from "./CurrentMoveSlots";
import { RawQiSlotPicker } from "./RawQiSlotPicker";
import { resolveQiDieActivation } from "./diceInteraction";

export interface QiDiceDockProps {
  /** Full combat state (for phase check) */
  state: CombatState;
  /** All dice owned by the active actor */
  actorDice: QiDie[];
  /** Currently selected move (may be undefined) */
  selectedMove: Move | undefined;
  /** Whether a target is selected */
  hasSelectedTarget: boolean;
  /** Authoritative declaration draft slot state, owned by App. */
  yinSlotIds: string[];
  yangSlotIds: string[];
  onAssignDie: (dieId: string, slot: "yin" | "yang") => boolean;
  onRemoveDie: (dieId: string) => void;
  /** Called when the player wants to confirm the authoritative draft. */
  onConfirm: () => void;
  /** Called when the player wants to roll dice from pool into sea */
  onRollToSea?: () => void;
  /** Distance validation warning (shown near confirm button) */
  distanceWarning?: string;
  /** False for spectators and basic actions, which do not use declaration slots. */
  declarationEnabled?: boolean;
  /** Context shown while the declaration workbench is intentionally gated. */
  inactiveReason?: string;
}

/**
 * QiDiceDock — the complete qi resource dashboard.
 *
 * Resource flow (top → bottom):
 *   ┌─────────────────────────────────────────┐
 *   │ 临气区 (TemporaryQiPool)                 │  ← temp dice from items/effects
 *   │   always visible, even when empty        │
 *   ├─────────────────────────────────────────┤
 *   │ ┌── 气海 (QiPool) ──┬─ 阴阳槽 (Slots) ─┐│  ← active work area
 *   │ │  available dice   │  阴槽 │ 阳槽      ││
 *   │ │  drag → slots     │                   ││
 *   │ └───────────────────┴───────────────────┘│
 *   ├─────────────────────────────────────────┤
 *   │ 息库 (RestPool)                          │  ← recuperable / locked / pool
 *   │   expanded zone with stats + detail      │
 *   ├─────────────────────────────────────────┤
 *   │ [确认宣言并锁气]                          │
 *   └─────────────────────────────────────────┘
 */
export const QiDiceDock: FC<QiDiceDockProps> = ({
  state,
  actorDice,
  selectedMove,
  hasSelectedTarget,
  yinSlotIds,
  yangSlotIds,
  onAssignDie,
  onRemoveDie,
  onConfirm,
  onRollToSea,
  distanceWarning,
  declarationEnabled = true,
  inactiveReason,
}) => {
  const [dragError, setDragError] = useState<string | null>(null);
  const [rawSlotChoiceDieId, setRawSlotChoiceDieId] = useState<string | null>(null);

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
    declarationEnabled && (state.phase === "declare" || state.phase === "scene"),
  );

  const rawSlotChoiceDie = rawSlotChoiceDieId
    ? actorDice.find((die) => die.id === rawSlotChoiceDieId)
    : undefined;
  const rawSlotChoiceAvailable = Boolean(
    rawSlotChoiceDie &&
    rawSlotChoiceDie.nature === "raw" &&
    (rawSlotChoiceDie.zone === "QI_SEA" || rawSlotChoiceDie.zone === "TEMP_QI") &&
    !assignedIds.has(rawSlotChoiceDie.id),
  );

  useEffect(() => {
    if (rawSlotChoiceDieId && (!canDrag || !rawSlotChoiceAvailable)) {
      setRawSlotChoiceDieId(null);
    }
  }, [rawSlotChoiceDieId, canDrag, rawSlotChoiceAvailable]);

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
  const confirmationAllowed = confirmCheck.allowed && !distanceWarning;
  const confirmationBlocker = distanceWarning ?? confirmCheck.reasons.join("、");

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

    if (!onAssignDie(dieId, "yin")) {
      setDragError("此骰当前不能投入阴槽");
      setTimeout(() => setDragError(null), 1800);
    }
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

    if (!onAssignDie(dieId, "yang")) {
      setDragError("此骰当前不能投入阳槽");
      setTimeout(() => setDragError(null), 1800);
    }
  }

  function handleRemoveFromSlot(dieId: string) {
    onRemoveDie(dieId);
  }

  function handleClickDie(dieId: string) {
    const die = actorDice.find((item) => item.id === dieId);
    if (!die) return;
    const activation = resolveQiDieActivation(
      die,
      assignedIds.has(dieId),
      canDrag,
    );

    if (activation !== "choose-raw-slot") setRawSlotChoiceDieId(null);

    switch (activation) {
      case "remove":
        handleRemoveFromSlot(dieId);
        break;
      case "assign-yin":
        handleDropToYin(dieId);
        break;
      case "assign-yang":
        handleDropToYang(dieId);
        break;
      case "choose-raw-slot":
        setDragError(null);
        setRawSlotChoiceDieId(dieId);
        break;
      case "none":
        break;
    }
  }

  function handleRawSlotChoice(slot: "yin" | "yang") {
    const dieId = rawSlotChoiceDieId;
    setRawSlotChoiceDieId(null);
    if (!dieId) return;
    if (slot === "yin") handleDropToYin(dieId);
    else handleDropToYang(dieId);
  }

  const yinTotal = yinDice.reduce((sum, d) => sum + (d.value ?? 0), 0);
  const yangTotal = yangDice.reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <div className="qi-dice-dock">
      {/* ── 1. Temporary Qi (临气区) — always visible ── */}
      <TemporaryQiPool
        dice={tempDice}
        assignedIds={assignedIds}
        canDrag={canDrag}
        onDragStart={() => {}}
        onClickDie={handleClickDie}
      />

      {/* ── 2. Main area: Qi Sea (气海) + Move Slots (阴阳槽) ── */}
      <div className="qi-dock-main">
        <QiPool
          dice={seaDice}
          assignedIds={assignedIds}
          canDrag={canDrag}
          onDragStart={() => {}}
          onClickDie={handleClickDie}
          onRoll={poolDice.length > 0 ? onRollToSea : undefined}
        />
        {declarationEnabled ? (
          <>
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
          </>
        ) : (
          <div className="qi-basic-action-mode" role="status">
            <strong>气骰总览</strong>
            <span>{inactiveReason ?? "当前为只读或基础动作模式，无需配置阴阳槽。"}</span>
          </div>
        )}
      </div>

      {canDrag && rawSlotChoiceAvailable && rawSlotChoiceDie && (
        <RawQiSlotPicker
          key={rawSlotChoiceDie.id}
          die={rawSlotChoiceDie}
          onChoose={handleRawSlotChoice}
          onCancel={() => setRawSlotChoiceDieId(null)}
        />
      )}

      {/* Drag error toast */}
      {dragError && (
        <div className="qi-drag-error">{dragError}</div>
      )}

      {/* Pre-selection hint */}
      {declarationEnabled && !selectedMove && (yinSlotIds.length + yangSlotIds.length > 0) && (
        <div className="qi-preselect-hint">
          已预选 {yinSlotIds.length + yangSlotIds.length} 枚气骰（阴{yinTotal}点 / 阳{yangTotal}点）
          — 选择招式和目标后即可确认
        </div>
      )}

      {/* ── 3. Rest Pool (息库 — expanded zone) ── */}
      <RestPool
        restDice={restDice}
        lockedDice={lockedDice}
        poolDice={poolDice}
      />

      {/* ── 4. Confirm button ── */}
      {declarationEnabled ? (
        <>
          <button
            className={`qi-confirm-btn${confirmationAllowed ? "" : " disabled"}`}
            type="button"
            disabled={!confirmationAllowed}
            onClick={onConfirm}
            title={confirmationAllowed ? "确认本次招式、目标与阴阳配骰" : confirmationBlocker}
          >
            <span>确认宣言并锁气</span>
            {!confirmationAllowed && <small>{confirmationBlocker}</small>}
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
        </>
      ) : null}
    </div>
  );
};
