// ==========================================================================
// Qi Dice Store — React Context + useReducer
// Phase 2: adds slot assignment (yin/yang), move/target selection.
// ==========================================================================

import { createContext, useContext, useReducer, useCallback, type Dispatch, type ReactNode } from "react";
import type { QiDieData, QiDieLocation, QiSlotType, CurrentMoveQiRequirement, LockedQiDeclaration, QiDeclarationStatus } from "../types/dice";
import { createStarterQiDice, rollQiDie } from "../lib/dice/diceRoll";
import { canDropDieToSlot } from "../lib/dice/diceAssignment";
import { lockQiDeclaration, moveLockedDiceToRestPool } from "../lib/dice/qiDeclaration";
import { recoverFromRestPool, useReturnLight } from "../lib/dice/qiRecovery";

// ---- State ----

export interface DiceStoreState {
  /** All qi dice currently in play */
  qiDice: QiDieData[];
  /** Currently selected (clicked) die ID */
  selectedDieId: string | null;
  /** Timestamp of last roll action */
  lastRollAt: number | null;

  // Phase 2: slot assignment
  /** Dice IDs currently in yin slot */
  assignedYinDiceIds: string[];
  /** Dice IDs currently in yang slot */
  assignedYangDiceIds: string[];
  /** Currently selected move ID (from parent App state) */
  selectedMoveId: string | null;
  /** Current move qi requirement */
  moveRequirement: CurrentMoveQiRequirement | null;

  // Phase 3: declaration & rest pool
  /** Current target ID */
  targetId: string | null;
  /** Current target name */
  targetName: string;
  /** Declaration lifecycle status */
  declarationStatus: QiDeclarationStatus;
  /** Active locked declaration (null if none) */
  activeDeclaration: LockedQiDeclaration | null;
  /** Whether return light has been used this combat */
  hasUsedReturnLight: boolean;
  // Phase 5: rolling animation
  /** Whether dice are currently animating a roll */
  isRolling: boolean;
  /** Per-die display values during rolling animation (dieId → temp display number) */
  rollingDisplayValues: Record<string, number>;
}

const initialState: DiceStoreState = {
  qiDice: [],
  selectedDieId: null,
  lastRollAt: null,
  assignedYinDiceIds: [],
  assignedYangDiceIds: [],
  selectedMoveId: null,
  moveRequirement: null,
  targetId: null,
  targetName: "",
  declarationStatus: "draft",
  activeDeclaration: null,
  hasUsedReturnLight: false,
  isRolling: false,
  rollingDisplayValues: {},
};

// ---- Actions ----

export type DiceStoreAction =
  | { type: "INIT_STARTER_DICE" }
  | { type: "ROLL_ALL_QI_SEA" }
  | { type: "MOVE_DIE"; dieId: string; location: QiDieLocation }
  | { type: "RESET_TO_QI_SEA" }
  | { type: "SELECT_DIE"; dieId: string | null }
  | { type: "SET_DICE"; dice: QiDieData[] }
  // Phase 2
  | { type: "ASSIGN_DIE_TO_SLOT"; dieId: string; slot: QiSlotType }
  | { type: "RETURN_DIE_TO_SEA"; dieId: string }
  | { type: "CLEAR_ASSIGNMENT" }
  | { type: "SET_MOVE_REQUIREMENT"; requirement: CurrentMoveQiRequirement | null }
  // Phase 3
  | { type: "SET_TARGET"; targetId: string | null; targetName: string }
  | { type: "LOCK_DECLARATION"; moveId: string; moveName: string; targetId: string; targetName: string; yinDice: QiDieData[]; yangDice: QiDieData[] }
  | { type: "RESOLVE_DECLARATION" }
  | { type: "RESET_DECLARATION" }
  // Phase 4
  | { type: "REGULATE_BREATH" }
  | { type: "RETURN_LIGHT" }
  | { type: "RESET_RETURN_LIGHT" }
  // Phase 5: rolling animation
  | { type: "START_ROLLING" }
  | { type: "UPDATE_ROLLING_DISPLAY"; displayValues: Record<string, number> }
  | { type: "FINISH_ROLLING"; values: Array<{ dieId: string; value: number }> };

// ---- Reducer ----

function diceReducer(state: DiceStoreState, action: DiceStoreAction): DiceStoreState {
  switch (action.type) {
    case "INIT_STARTER_DICE": {
      if (state.qiDice.length > 0) return state;
      return { ...state, qiDice: createStarterQiDice() };
    }
    case "ROLL_ALL_QI_SEA": {
      const rolled = state.qiDice.map((die) =>
        die.location === "qiSea" ? rollQiDie(die) : die,
      );
      return { ...state, qiDice: rolled, lastRollAt: Date.now() };
    }
    case "MOVE_DIE": {
      const moved = state.qiDice.map((die) =>
        die.id === action.dieId ? { ...die, location: action.location } : die,
      );
      return { ...state, qiDice: moved };
    }
    case "RESET_TO_QI_SEA": {
      const reset = state.qiDice.map((die) => ({
        ...die,
        location: "qiSea" as const,
        locked: false,
      }));
      return {
        ...state,
        qiDice: reset,
        assignedYinDiceIds: [],
        assignedYangDiceIds: [],
      };
    }
    case "SELECT_DIE": {
      return { ...state, selectedDieId: action.dieId };
    }
    case "SET_DICE": {
      return { ...state, qiDice: action.dice };
    }
    // ---- Phase 2 ----
    case "ASSIGN_DIE_TO_SLOT": {
      const die = state.qiDice.find((d) => d.id === action.dieId);
      if (!die) return state;
      if (!canDropDieToSlot(die, action.slot)) return state;

      // Remove from both slots first, then add to target
      const yin = state.assignedYinDiceIds.filter((id) => id !== action.dieId);
      const yang = state.assignedYangDiceIds.filter((id) => id !== action.dieId);

      const updatedDice = state.qiDice.map((d) =>
        d.id === action.dieId
          ? { ...d, location: (action.slot === "yinSlot" ? "lockedYin" : "lockedYang") as QiDieLocation }
          : d,
      );

      if (action.slot === "yinSlot") {
        return { ...state, qiDice: updatedDice, assignedYinDiceIds: [...yin, action.dieId], assignedYangDiceIds: yang };
      } else {
        return { ...state, qiDice: updatedDice, assignedYangDiceIds: [...yang, action.dieId], assignedYinDiceIds: yin };
      }
    }
    case "RETURN_DIE_TO_SEA": {
      const yin = state.assignedYinDiceIds.filter((id) => id !== action.dieId);
      const yang = state.assignedYangDiceIds.filter((id) => id !== action.dieId);
      const updatedDice = state.qiDice.map((d) =>
        d.id === action.dieId ? { ...d, location: "qiSea" as const } : d,
      );
      return { ...state, qiDice: updatedDice, assignedYinDiceIds: yin, assignedYangDiceIds: yang };
    }
    case "CLEAR_ASSIGNMENT": {
      const cleared = state.qiDice.map((d) =>
        d.location === "lockedYin" || d.location === "lockedYang"
          ? { ...d, location: "qiSea" as const }
          : d,
      );
      return { ...state, qiDice: cleared, assignedYinDiceIds: [], assignedYangDiceIds: [] };
    }
    case "SET_MOVE_REQUIREMENT": {
      return { ...state, moveRequirement: action.requirement };
    }
    // ---- Phase 3 ----
    case "SET_TARGET": {
      return { ...state, targetId: action.targetId, targetName: action.targetName };
    }
    case "LOCK_DECLARATION": {
      const declaration = lockQiDeclaration({
        moveId: action.moveId,
        moveName: action.moveName,
        targetId: action.targetId,
        targetName: action.targetName,
        yinDice: action.yinDice,
        yangDice: action.yangDice,
      });
      // Mark assigned dice as locked
      const lockedIds = new Set([
        ...declaration.yinDice.map((d) => d.id),
        ...declaration.yangDice.map((d) => d.id),
      ]);
      const updatedDice = state.qiDice.map((d) =>
        lockedIds.has(d.id) ? { ...d, locked: true } : d,
      );
      return {
        ...state,
        qiDice: updatedDice,
        declarationStatus: "locked",
        activeDeclaration: declaration,
      };
    }
    case "RESOLVE_DECLARATION": {
      if (!state.activeDeclaration) return state;
      const rested = moveLockedDiceToRestPool(state.qiDice, state.activeDeclaration);
      return {
        ...state,
        qiDice: rested,
        declarationStatus: "resolved",
        assignedYinDiceIds: [],
        assignedYangDiceIds: [],
        // Keep activeDeclaration for summary display
      };
    }
    case "RESET_DECLARATION": {
      const unlocked = state.qiDice.map((d) => ({ ...d, locked: false }));
      return {
        ...state,
        qiDice: unlocked,
        declarationStatus: "draft",
        activeDeclaration: null,
        assignedYinDiceIds: [],
        assignedYangDiceIds: [],
      };
    }
    // ---- Phase 4 ----
    case "REGULATE_BREATH": {
      const result = recoverFromRestPool(state.qiDice);
      return { ...state, qiDice: result.dice, lastRollAt: Date.now() };
    }
    case "RETURN_LIGHT": {
      const result = useReturnLight(state.qiDice);
      return { ...state, qiDice: result.dice, hasUsedReturnLight: true, lastRollAt: Date.now() };
    }
    case "RESET_RETURN_LIGHT": {
      return { ...state, hasUsedReturnLight: false };
    }
    // ---- Phase 5 ----
    case "START_ROLLING": {
      return { ...state, isRolling: true, rollingDisplayValues: {} };
    }
    case "UPDATE_ROLLING_DISPLAY": {
      return { ...state, rollingDisplayValues: { ...state.rollingDisplayValues, ...action.displayValues } };
    }
    case "FINISH_ROLLING": {
      const valueMap = new Map(action.values.map((v) => [v.dieId, v.value]));
      const updated = state.qiDice.map((die) => {
        const newVal = valueMap.get(die.id);
        if (newVal !== undefined && die.location === "qiSea") {
          return { ...die, value: newVal };
        }
        return die;
      });
      return { ...state, qiDice: updated, lastRollAt: Date.now(), isRolling: false, rollingDisplayValues: {} };
    }
    default:
      return state;
  }
}

// ---- Context ----

interface DiceStoreContextValue {
  state: DiceStoreState;
  dispatch: Dispatch<DiceStoreAction>;
  // Phase 1
  initStarterDice: () => void;
  rollAllQiSeaDice: () => void;
  moveDieToLocation: (dieId: string, location: QiDieLocation) => void;
  resetDiceToQiSea: () => void;
  selectDie: (dieId: string | null) => void;
  getQiSeaDice: () => QiDieData[];
  getTempQiDice: () => QiDieData[];
  getRestPoolDice: () => QiDieData[];
  // Phase 2
  assignDieToSlot: (dieId: string, slot: QiSlotType) => void;
  returnDieToQiSea: (dieId: string) => void;
  clearCurrentAssignment: () => void;
  setMoveRequirement: (requirement: CurrentMoveQiRequirement | null) => void;
  getAssignedYinDice: () => QiDieData[];
  getAssignedYangDice: () => QiDieData[];
  // Phase 3
  setTarget: (targetId: string | null, targetName: string) => void;
  lockDeclaration: (moveId: string, moveName: string, targetId: string, targetName: string, yinDice: QiDieData[], yangDice: QiDieData[]) => void;
  resolveDeclaration: () => void;
  resetDeclaration: () => void;
  getLockedDice: () => QiDieData[];
  // Phase 4
  regulateBreath: () => void;
  returnLight: () => void;
  resetReturnLight: () => void;
}

const DiceStoreContext = createContext<DiceStoreContextValue | null>(null);

// ---- Provider ----

export function DiceStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(diceReducer, initialState);

  // Phase 1
  const initStarterDice = useCallback(() => dispatch({ type: "INIT_STARTER_DICE" }), []);
  const rollAllQiSeaDice = useCallback(() => dispatch({ type: "ROLL_ALL_QI_SEA" }), []);
  const moveDieToLocation = useCallback(
    (dieId: string, location: QiDieLocation) => dispatch({ type: "MOVE_DIE", dieId, location }),
    [],
  );
  const resetDiceToQiSea = useCallback(() => dispatch({ type: "RESET_TO_QI_SEA" }), []);
  const selectDie = useCallback((dieId: string | null) => dispatch({ type: "SELECT_DIE", dieId }), []);

  const getQiSeaDice = useCallback(
    () => state.qiDice.filter((d) => d.location === "qiSea"),
    [state.qiDice],
  );
  const getTempQiDice = useCallback(
    () => state.qiDice.filter((d) => d.location === "tempQi"),
    [state.qiDice],
  );
  const getRestPoolDice = useCallback(
    () => state.qiDice.filter((d) => d.location === "restPool"),
    [state.qiDice],
  );

  // Phase 2
  const assignDieToSlot = useCallback(
    (dieId: string, slot: QiSlotType) => dispatch({ type: "ASSIGN_DIE_TO_SLOT", dieId, slot }),
    [],
  );
  const returnDieToQiSea = useCallback(
    (dieId: string) => dispatch({ type: "RETURN_DIE_TO_SEA", dieId }),
    [],
  );
  const clearCurrentAssignment = useCallback(
    () => dispatch({ type: "CLEAR_ASSIGNMENT" }),
    [],
  );
  const setMoveRequirement = useCallback(
    (requirement: CurrentMoveQiRequirement | null) =>
      dispatch({ type: "SET_MOVE_REQUIREMENT", requirement }),
    [],
  );
  const getAssignedYinDice = useCallback(
    () => state.qiDice.filter((d) => state.assignedYinDiceIds.includes(d.id)),
    [state.qiDice, state.assignedYinDiceIds],
  );
  const getAssignedYangDice = useCallback(
    () => state.qiDice.filter((d) => state.assignedYangDiceIds.includes(d.id)),
    [state.qiDice, state.assignedYangDiceIds],
  );

  // Phase 3
  const setTarget = useCallback(
    (targetId: string | null, targetName: string) =>
      dispatch({ type: "SET_TARGET", targetId, targetName }),
    [],
  );
  const lockDeclaration = useCallback(
    (moveId: string, moveName: string, targetId: string, targetName: string, yinDice: QiDieData[], yangDice: QiDieData[]) =>
      dispatch({ type: "LOCK_DECLARATION", moveId, moveName, targetId, targetName, yinDice, yangDice }),
    [],
  );
  const resolveDeclaration = useCallback(
    () => dispatch({ type: "RESOLVE_DECLARATION" }),
    [],
  );
  const resetDeclaration = useCallback(
    () => dispatch({ type: "RESET_DECLARATION" }),
    [],
  );
  const getLockedDice = useCallback(
    () => state.qiDice.filter((d) => d.locked),
    [state.qiDice],
  );

  // Phase 4
  const regulateBreath = useCallback(
    () => dispatch({ type: "REGULATE_BREATH" }),
    [],
  );
  const returnLight = useCallback(
    () => dispatch({ type: "RETURN_LIGHT" }),
    [],
  );
  const resetReturnLight = useCallback(
    () => dispatch({ type: "RESET_RETURN_LIGHT" }),
    [],
  );

  const value: DiceStoreContextValue = {
    state,
    dispatch,
    initStarterDice,
    rollAllQiSeaDice,
    moveDieToLocation,
    resetDiceToQiSea,
    selectDie,
    getQiSeaDice,
    getTempQiDice,
    getRestPoolDice,
    assignDieToSlot,
    returnDieToQiSea,
    clearCurrentAssignment,
    setMoveRequirement,
    getAssignedYinDice,
    getAssignedYangDice,
    // Phase 3
    setTarget,
    lockDeclaration,
    resolveDeclaration,
    resetDeclaration,
    getLockedDice,
    // Phase 4
    regulateBreath,
    returnLight,
    resetReturnLight,
  };

  return (
    <DiceStoreContext.Provider value={value}>
      {children}
    </DiceStoreContext.Provider>
  );
}

// ---- Hook ----

export function useDiceStore(): DiceStoreContextValue {
  const ctx = useContext(DiceStoreContext);
  if (!ctx) {
    throw new Error("useDiceStore must be used within a DiceStoreProvider");
  }
  return ctx;
}
