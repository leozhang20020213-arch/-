// ==========================================================================
// Qi Dice Store — React Context + useReducer
// Phase 1: init, roll, move, reset. No drag-and-drop yet.
// ==========================================================================

import { createContext, useContext, useReducer, useCallback, type Dispatch, type ReactNode } from "react";
import type { QiDieData, QiDieLocation } from "../types/dice";
import { createStarterQiDice, rollQiDie } from "../lib/dice/diceRoll";

// ---- State ----

export interface DiceStoreState {
  /** All qi dice currently in play */
  qiDice: QiDieData[];
  /** Currently selected (clicked) die ID */
  selectedDieId: string | null;
  /** Timestamp of last roll action */
  lastRollAt: number | null;
}

const initialState: DiceStoreState = {
  qiDice: [],
  selectedDieId: null,
  lastRollAt: null,
};

// ---- Actions ----

export type DiceStoreAction =
  | { type: "INIT_STARTER_DICE" }
  | { type: "ROLL_ALL_QI_SEA" }
  | { type: "MOVE_DIE"; dieId: string; location: QiDieLocation }
  | { type: "RESET_TO_QI_SEA" }
  | { type: "SELECT_DIE"; dieId: string | null }
  | { type: "SET_DICE"; dice: QiDieData[] };

// ---- Reducer ----

function diceReducer(state: DiceStoreState, action: DiceStoreAction): DiceStoreState {
  switch (action.type) {
    case "INIT_STARTER_DICE": {
      // Only init if dice array is empty (avoid double-init)
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
      const reset = state.qiDice.map((die) => ({ ...die, location: "qiSea" as const, locked: false }));
      return { ...state, qiDice: reset };
    }
    case "SELECT_DIE": {
      return { ...state, selectedDieId: action.dieId };
    }
    case "SET_DICE": {
      return { ...state, qiDice: action.dice };
    }
    default:
      return state;
  }
}

// ---- Context ----

interface DiceStoreContextValue {
  state: DiceStoreState;
  dispatch: Dispatch<DiceStoreAction>;
  // Convenience methods
  initStarterDice: () => void;
  rollAllQiSeaDice: () => void;
  moveDieToLocation: (dieId: string, location: QiDieLocation) => void;
  resetDiceToQiSea: () => void;
  selectDie: (dieId: string | null) => void;
  getQiSeaDice: () => QiDieData[];
  getTempQiDice: () => QiDieData[];
  getRestPoolDice: () => QiDieData[];
}

const DiceStoreContext = createContext<DiceStoreContextValue | null>(null);

// ---- Provider ----

export function DiceStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(diceReducer, initialState);

  const initStarterDice = useCallback(() => dispatch({ type: "INIT_STARTER_DICE" }), []);
  const rollAllQiSeaDice = useCallback(() => dispatch({ type: "ROLL_ALL_QI_SEA" }), []);
  const moveDieToLocation = useCallback(
    (dieId: string, location: QiDieLocation) => dispatch({ type: "MOVE_DIE", dieId, location }),
    [],
  );
  const resetDiceToQiSea = useCallback(() => dispatch({ type: "RESET_TO_QI_SEA" }), []);
  const selectDie = useCallback((dieId: string | null) => dispatch({ type: "SELECT_DIE", dieId }), []);

  const getQiSeaDice = useCallback(() => state.qiDice.filter((d) => d.location === "qiSea"), [state.qiDice]);
  const getTempQiDice = useCallback(() => state.qiDice.filter((d) => d.location === "tempQi"), [state.qiDice]);
  const getRestPoolDice = useCallback(() => state.qiDice.filter((d) => d.location === "restPool"), [state.qiDice]);

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
