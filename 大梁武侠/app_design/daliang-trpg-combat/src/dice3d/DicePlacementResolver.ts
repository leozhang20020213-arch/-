import * as THREE from "three";

export interface DicePlacementItem {
  id: string;
  position: THREE.Vector3;
  radius: number;
}

export interface DicePackingItem {
  id: string;
  radius: number;
}

export interface DicePackingOptions {
  width?: number;
  depth?: number;
  gap?: number;
  maxColumns?: number;
}

export interface DicePackingLayout {
  positions: Map<string, THREE.Vector3>;
  scale: number;
  columns: number;
  rows: number;
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

/**
 * Packs mixed-size dice into a centered, non-overlapping rectangular tray.
 *
 * The previous overlay used a fixed 0.92-unit grid even though a D20 is
 * substantially wider than a D4. This layout first measures the widest die
 * in every column and row, then chooses the column count that preserves the
 * largest readable scale inside the available tray.
 */
export function packDicePositions(
  items: readonly DicePackingItem[],
  options: DicePackingOptions = {},
): DicePackingLayout {
  if (items.length === 0) {
    return { positions: new Map(), scale: 1, columns: 0, rows: 0 };
  }

  const width = options.width ?? 7.2;
  const depth = options.depth ?? 5.6;
  const gap = options.gap ?? 0.22;
  const maxColumns = Math.min(options.maxColumns ?? 6, items.length);
  let best: {
    columns: number;
    rows: number;
    scale: number;
    columnDiameters: number[];
    rowDiameters: number[];
    aspectPenalty: number;
  } | null = null;

  for (let columns = 1; columns <= maxColumns; columns += 1) {
    const rows = Math.ceil(items.length / columns);
    const columnDiameters = Array.from({ length: columns }, () => 0);
    const rowDiameters = Array.from({ length: rows }, () => 0);

    items.forEach((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const diameter = item.radius * 2;
      columnDiameters[column] = Math.max(columnDiameters[column], diameter);
      rowDiameters[row] = Math.max(rowDiameters[row], diameter);
    });

    const widthForDice = Math.max(0.1, width - gap * Math.max(0, columns - 1));
    const depthForDice = Math.max(0.1, depth - gap * Math.max(0, rows - 1));
    const naturalWidth = columnDiameters.reduce((sum, value) => sum + value, 0);
    const naturalDepth = rowDiameters.reduce((sum, value) => sum + value, 0);
    const scale = Math.min(1, widthForDice / naturalWidth, depthForDice / naturalDepth);
    const usedWidth = naturalWidth * scale + gap * Math.max(0, columns - 1);
    const usedDepth = naturalDepth * scale + gap * Math.max(0, rows - 1);
    const aspectPenalty = Math.abs(usedWidth / width - usedDepth / depth);

    if (
      !best
      || scale > best.scale + 0.0001
      || (Math.abs(scale - best.scale) <= 0.0001 && aspectPenalty < best.aspectPenalty)
    ) {
      best = { columns, rows, scale, columnDiameters, rowDiameters, aspectPenalty };
    }
  }

  const layout = best!;
  const scaledColumnWidths = layout.columnDiameters.map((value) => value * layout.scale);
  const scaledRowDepths = layout.rowDiameters.map((value) => value * layout.scale);
  const usedWidth = scaledColumnWidths.reduce((sum, value) => sum + value, 0)
    + gap * Math.max(0, layout.columns - 1);
  const usedDepth = scaledRowDepths.reduce((sum, value) => sum + value, 0)
    + gap * Math.max(0, layout.rows - 1);
  const columnCenters: number[] = [];
  const rowCenters: number[] = [];
  let cursor = -usedWidth / 2;
  scaledColumnWidths.forEach((columnWidth) => {
    columnCenters.push(cursor + columnWidth / 2);
    cursor += columnWidth + gap;
  });
  cursor = -usedDepth / 2;
  scaledRowDepths.forEach((rowDepth) => {
    rowCenters.push(cursor + rowDepth / 2);
    cursor += rowDepth + gap;
  });

  const positions = new Map<string, THREE.Vector3>();
  items.forEach((item, index) => {
    positions.set(item.id, new THREE.Vector3(
      columnCenters[index % layout.columns],
      0,
      rowCenters[Math.floor(index / layout.columns)],
    ));
  });

  return {
    positions,
    scale: layout.scale,
    columns: layout.columns,
    rows: layout.rows,
  };
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
