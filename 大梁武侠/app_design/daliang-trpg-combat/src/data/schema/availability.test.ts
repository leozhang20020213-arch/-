import assert from "node:assert/strict";
import { it } from "node:test";
import { createAvailabilityResult } from "./availability";

it("keeps structured availability dimensions and readable failure reasons", () => {
  const result = createAvailabilityResult([
    { dimension: "mode", status: "pass" },
    { dimension: "distance", status: "fail", reason: "目标超出短距" },
    { dimension: "qi", status: "fail", reason: "缺少阳槽气骰" },
  ]);
  assert.equal(result.available, false);
  assert.deepEqual(result.reasons, ["目标超出短距", "缺少阳槽气骰"]);
});
