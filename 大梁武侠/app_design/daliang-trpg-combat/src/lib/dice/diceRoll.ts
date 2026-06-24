// ==========================================================================
// Qi Dice Rolling Utilities — 大梁江湖 TRPG 气骰系统
// Phase 1: basic roll, create, and starter dice generation.
// ==========================================================================

import type { DieSides, QiDieData, QiDieKind, QiDieFace } from "../../types/dice";

/** Roll a single die of the given sides. Returns 1..sides. */
export function rollDie(sides: DieSides): number {
  return Math.floor(Math.random() * sides) + 1;
}

/** Roll a QiDieData, returning a new object with updated value. */
export function rollQiDie(die: QiDieData): QiDieData {
  return {
    ...die,
    value: rollDie(die.sides),
  };
}

/** Map kind to face label */
function kindToFace(kind: QiDieKind): QiDieFace {
  switch (kind) {
    case "yin": return "阴";
    case "yang": return "阳";
    case "raw": return "原";
  }
}

export interface CreateQiDieInput {
  id?: string;
  kind: QiDieKind;
  sides: DieSides;
  value?: number;
  location?: QiDieData["location"];
  source?: string;
  temporary?: boolean;
}

/** Create a single QiDieData with sensible defaults. */
export function createQiDie(input: CreateQiDieInput): QiDieData {
  return {
    id: input.id ?? `${input.kind}-d${input.sides}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: input.kind,
    face: kindToFace(input.kind),
    sides: input.sides,
    value: input.value ?? rollDie(input.sides),
    location: input.location ?? "qiSea",
    source: input.source,
    temporary: input.temporary ?? false,
    locked: false,
  };
}

/**
 * Generate a starter set of qi dice for the player.
 * - 2 阴 D6
 * - 2 阳 D6
 * - 2 原始 D4
 * All start in qiSea with rolled values.
 */
export function createStarterQiDice(): QiDieData[] {
  return [
    createQiDie({ id: "yin-d6-1", kind: "yin", sides: 6, location: "qiSea" }),
    createQiDie({ id: "yin-d6-2", kind: "yin", sides: 6, location: "qiSea" }),
    createQiDie({ id: "yang-d6-1", kind: "yang", sides: 6, location: "qiSea" }),
    createQiDie({ id: "yang-d6-2", kind: "yang", sides: 6, location: "qiSea" }),
    createQiDie({ id: "raw-d4-1", kind: "raw", sides: 4, location: "qiSea" }),
    createQiDie({ id: "raw-d4-2", kind: "raw", sides: 4, location: "qiSea" }),
  ];
}
