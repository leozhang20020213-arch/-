import * as THREE from "three";

export interface DicePlacementItem {
  id: string;
  position: THREE.Vector3;
  radius: number;
}

export const TRAY_BOUNDS = {
  minX: -3.35,
  maxX: 3.35,
  minZ: -2.8,
  maxZ: 2.8,
};

const MIN_GAP = 0.18;

export function clampToTray(position: THREE.Vector3, radius: number): THREE.Vector3 {
  return new THREE.Vector3(
    THREE.MathUtils.clamp(position.x, TRAY_BOUNDS.minX + radius, TRAY_BOUNDS.maxX - radius),
    position.y,
    THREE.MathUtils.clamp(position.z, TRAY_BOUNDS.minZ + radius, TRAY_BOUNDS.maxZ - radius),
  );
}

export function getInitialDicePosition(index: number, total: number): THREE.Vector3 {
  const columns = total <= 3 ? Math.max(total, 1) : Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / columns);
  const spacing = total >= 9 ? 1.2 : 1.55;
  const column = index % columns;
  const row = Math.floor(index / columns);
  return new THREE.Vector3((column - (columns - 1) / 2) * spacing, 1.05, (row - (rows - 1) / 2) * spacing);
}

export function resolveDiceOverlap(items: DicePlacementItem[], anchorId?: string): Map<string, THREE.Vector3> {
  const next = new Map<string, THREE.Vector3>();
  const working = items.map((item) => ({
    ...item,
    position: clampToTray(item.position.clone(), item.radius),
  }));

  for (let pass = 0; pass < 12; pass += 1) {
    for (let leftIndex = 0; leftIndex < working.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < working.length; rightIndex += 1) {
        const left = working[leftIndex];
        const right = working[rightIndex];
        const delta = new THREE.Vector3(right.position.x - left.position.x, 0, right.position.z - left.position.z);
        const distance = Math.max(delta.length(), 0.0001);
        const minDistance = left.radius + right.radius + MIN_GAP;

        if (distance >= minDistance) {
          continue;
        }

        const direction =
          distance > 0.001
            ? delta.multiplyScalar(1 / distance)
            : new THREE.Vector3(Math.cos((leftIndex + rightIndex) * 1.7), 0, Math.sin((leftIndex + rightIndex) * 1.7))
                .normalize();
        const push = (minDistance - distance) / 2;
        const leftLocked = left.id === anchorId;
        const rightLocked = right.id === anchorId;

        if (leftLocked && !rightLocked) {
          right.position.add(direction.clone().multiplyScalar(push * 2));
        } else if (rightLocked && !leftLocked) {
          left.position.add(direction.clone().multiplyScalar(-push * 2));
        } else {
          left.position.add(direction.clone().multiplyScalar(-push));
          right.position.add(direction.clone().multiplyScalar(push));
        }

        left.position.copy(clampToTray(left.position, left.radius));
        right.position.copy(clampToTray(right.position, right.radius));
      }
    }
  }

  for (const item of working) {
    next.set(item.id, item.position.clone());
  }
  return next;
}
