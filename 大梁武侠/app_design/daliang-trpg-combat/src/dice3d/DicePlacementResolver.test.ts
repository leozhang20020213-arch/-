import assert from "node:assert/strict";
import test from "node:test";
import { packDicePositions } from "./DicePlacementResolver";

test("packs sixteen mixed-size dice without overlap", () => {
  const radii = [0.67, 0.7, 0.86, 0.93, 1.02, 1.12, 0.7, 0.86, 0.93, 1.02, 1.12, 0.67, 0.7, 0.86, 0.93, 1.02];
  const items = radii.map((radius, index) => ({ id: `die-${index}`, radius }));
  const layout = packDicePositions(items, { width: 7.35, depth: 5.65, gap: 0.24 });

  assert.equal(layout.positions.size, items.length);
  assert.ok(layout.scale > 0.55, `expected readable scale, got ${layout.scale}`);

  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      const leftPosition = layout.positions.get(items[left].id)!;
      const rightPosition = layout.positions.get(items[right].id)!;
      const distance = leftPosition.distanceTo(rightPosition);
      const minimum = (items[left].radius + items[right].radius) * layout.scale;
      assert.ok(distance + 0.0001 >= minimum, `${items[left].id} overlaps ${items[right].id}`);
    }
  }
});

test("keeps a small roll at full scale", () => {
  const items = Array.from({ length: 4 }, (_, index) => ({ id: `d6-${index}`, radius: 0.7 }));
  const layout = packDicePositions(items, { width: 7.35, depth: 5.65 });
  assert.equal(layout.scale, 1);
  assert.equal(layout.rows * layout.columns >= items.length, true);
});
