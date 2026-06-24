import * as THREE from "three";
import type { DiceDefinition } from "./DiceGeometryFactory";
import { quaternionForFaceValue } from "./DiceResultResolver";

export interface DiceRollAnimationPlan {
  startQuaternion: THREE.Quaternion;
  targetQuaternion: THREE.Quaternion;
  durationMs: number;
  spinAxis: THREE.Vector3;
  spinTurns: number;
  bounceHeight: number;
}

export function createRollAnimationPlan(
  definition: DiceDefinition,
  startQuaternion: THREE.Quaternion,
  targetValue?: number,
): DiceRollAnimationPlan {
  const value = targetValue ?? definition.faces[Math.floor(Math.random() * definition.faces.length)].value;
  const readableQuaternion = quaternionForFaceValue(definition, value, "up");
  const spinAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.7 + 0.2, Math.random() - 0.5).normalize();

  return {
    startQuaternion: startQuaternion.clone(),
    targetQuaternion: readableQuaternion,
    durationMs: 900 + Math.random() * 400,
    spinAxis,
    spinTurns: 2.2 + Math.random() * 1.8,
    bounceHeight: 0.16 + Math.random() * 0.12,
  };
}

export function sampleRollAnimation(plan: DiceRollAnimationPlan, elapsedMs: number): {
  quaternion: THREE.Quaternion;
  lift: number;
  done: boolean;
} {
  const progress = Math.min(1, elapsedMs / plan.durationMs);
  const eased = easeOutCubic(progress);
  const spinProgress = 1 - Math.pow(1 - progress, 2.4);
  const spin = new THREE.Quaternion().setFromAxisAngle(plan.spinAxis, Math.PI * 2 * plan.spinTurns * (1 - spinProgress));
  const quaternion = plan.startQuaternion.clone().slerp(plan.targetQuaternion, eased).multiply(spin);
  const lift = Math.sin(Math.PI * progress) * plan.bounceHeight;
  return { quaternion, lift, done: progress >= 1 };
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}
