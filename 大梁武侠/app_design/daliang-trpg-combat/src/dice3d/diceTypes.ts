import * as THREE from "three";

export type Die3DType = "D4" | "D6" | "D8" | "D10" | "D12" | "D20";
export type DiceAffinity = "yin" | "yang" | "raw";

export interface DiceRollResult {
  id: string;
  value: number;
}

export interface Dice3DState {
  id: string;
  type: Die3DType;
  affinity: DiceAffinity;
  result: number | null;
  position: THREE.Vector3;
  radius: number;
  rotation: THREE.Euler;
  isRolling: boolean;
  isDragging: boolean;
  lastResult: number | null;
}

export interface DiceFace {
  faceId?: string;
  value: number;
  normal: THREE.Vector3;
  center: THREE.Vector3;
}

export interface DiceMeshSpec {
  geometry: THREE.BufferGeometry;
  faces: DiceFace[];
  radius: number;
  physicsVertices: THREE.Vector3[];
  physicsFaces: number[][];
}

export const DIE_TYPES: Die3DType[] = ["D4", "D6", "D8", "D10", "D12", "D20"];

export function sidesForDie(type: Die3DType): number {
  return Number(type.slice(1));
}

export function dieTypeFromSides(sides: number): Die3DType {
  if (sides === 4) return "D4";
  if (sides === 6) return "D6";
  if (sides === 8) return "D8";
  if (sides === 10) return "D10";
  if (sides === 12) return "D12";
  return "D20";
}

export function affinityFromNature(nature: string): DiceAffinity {
  if (nature === "yin") return "yin";
  if (nature === "yang") return "yang";
  return "raw";
}

/** Map our "raw" affinity to dice-lab's "neutral" for material lookups */
export function affinityToLabTheme(affinity: DiceAffinity): "yin" | "yang" | "neutral" {
  if (affinity === "yin") return "yin";
  if (affinity === "yang") return "yang";
  return "neutral";
}

export function createDiceId(): string {
  return `die-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
