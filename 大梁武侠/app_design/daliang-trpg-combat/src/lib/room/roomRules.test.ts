import assert from "node:assert/strict";
import test from "node:test";
import { claimPlayerSeat, evaluateRoomReadiness } from "./roomRules";

const dmSeat = { id: "seat-dm", label: "DM", ready: true };

test("空房间不能开场并给出可恢复原因", () => {
  const result = evaluateRoomReadiness([dmSeat, { id: "seat-1", label: "玩家1", ready: false }]);
  assert.equal(result.canStart, false);
  assert.match(result.reason, /一名玩家/);
});

test("角色冲突、未分配和未准备都阻止开场", () => {
  const conflict = evaluateRoomReadiness([dmSeat,
    { id: "seat-1", label: "玩家1", playerName: "甲", actorId: "pc-1", ready: true },
    { id: "seat-2", label: "玩家2", playerName: "乙", actorId: "pc-1", ready: true },
  ]);
  assert.equal(conflict.canStart, false);
  assert.match(conflict.reason, /不能分配/);
});

test("认领席位独立保存人物、准备和连接状态", () => {
  const seats = claimPlayerSeat([dmSeat, { id: "seat-1", label: "玩家1", ready: false }], "沈青玩家", "pc-shen-qing", true);
  assert.deepEqual(seats[1], { id: "seat-1", label: "玩家1", playerName: "沈青玩家", actorId: "pc-shen-qing", ready: true, connectionStatus: "connected" });
  assert.equal(evaluateRoomReadiness(seats).canStart, true);
});
