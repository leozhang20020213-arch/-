import * as THREE from "three";
import type { DiceDefinition } from "./DiceGeometryFactory";

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_DOWN = new THREE.Vector3(0, -1, 0);
export type DiceFaceDirection = "up" | "down";

export interface DiceRollResult {
  id: string;
  type: string;
  result: number;
  displayedValue: number;
}

export function resolveResultFromPose(definition: DiceDefinition, quaternion: THREE.Quaternion): number {
  let bestFace = definition.faces[0];
  let bestDot = -Infinity;

  for (const face of definition.faces) {
    const worldNormal = face.normal.clone().applyQuaternion(quaternion).normalize();
    const dot = worldNormal.dot(WORLD_UP);
    if (dot > bestDot) {
      bestDot = dot;
      bestFace = face;
    }
  }

  return bestFace.value;
}

export function createPredeterminedResult(definition: DiceDefinition): number {
  return Math.floor(Math.random() * definition.sides) + 1;
}

export function quaternionForReadableResult(definition: DiceDefinition, value: number): THREE.Quaternion {
  return quaternionForFaceValue(definition, value, "up");
}

export function quaternionForFaceValue(
  definition: DiceDefinition,
  value: number,
  direction: DiceFaceDirection,
): THREE.Quaternion {
  const face = definition.faces.find((item) => item.value === value) ?? definition.faces[0];
  const targetNormal = direction === "down" ? WORLD_DOWN : WORLD_UP;
  return new THREE.Quaternion().setFromUnitVectors(face.normal.clone().normalize(), targetNormal);
}

export function initialQuaternionForMaxFaceDown(definition: DiceDefinition): THREE.Quaternion {
  return quaternionForFaceValue(definition, definition.sides, "down");
}
