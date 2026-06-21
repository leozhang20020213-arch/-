export type Die3DType = "D4" | "D6" | "D8" | "D10" | "D12" | "D20";
export type DiceAffinity = "yin" | "yang" | "raw";

export interface DiceRollResult {
  id: string;
  value: number;
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
