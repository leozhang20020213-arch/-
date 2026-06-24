// ==========================================================================
// Qi Dice Store — React Context + useReducer
// Phase 2: adds slot assignment (yin/yang), move/target selection.
// ==========================================================================

import { createContext, useContext, useReducer, useCallback, type Dispatch, type ReactNode } from "react";
import type { QiDieData, QiDieLocation, QiSlotType, CurrentMoveQiRequirement } from "../types/dice";
import { createStarterQiDice, rollQiDie } from "../lib/dice/diceRoll";
import { canDropDieToSlot } from "../lib/dice/diceAssignment";

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
}

const initialState: DiceStoreState = {
  qiDice: [],
  selectedDieId: null,
  lastRollAt: null,
  assignedYinDiceIds: [],
  assignedYangDiceIds: [],
  selectedMoveId: null,
  moveRequirement: null,
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
  | { type: "SET_MOVE_REQUIREMENT"; requirement: CurrentMoveQiRequirement | null };

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
