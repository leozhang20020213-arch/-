import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSeedState } from "../../data/seed";
import {
  queueSceneActionRequest,
  resolveQueuedSceneRequest,
  resolveSceneAction,
  resolveSceneActionWithNarration,
} from "./autoSceneDm";

const actorId = "pc-shen-qing";

describe("scene auto DM", () => {
  it("resolves legal scene actions and unlocks combat deterministically", () => {
    let state = createSeedState();
    state = resolveSceneAction(state, {
      id: "r1", actorId, actionType: "observe", targetId: "warehouse-door", approach: "贴地看水痕", createdAt: 1,
    }, { now: () => 10 });
    assert.equal(state.tracks.find((track) => track.id === "track-clue")?.value, 1);
    assert.ok(state.scene.permissions.some((fact) => fact.id === "permission-follow-water-marks"));

    state = resolveSceneAction(state, {
      id: "r2", actorId, actionType: "investigate", targetId: "warehouse-door", approach: "比对车辙", createdAt: 2,
    }, { now: () => 20 });
    assert.equal(state.tracks.find((track) => track.id === "track-clue")?.value, 3);
    assert.equal(state.scene.combatUnlocked, true);
    assert.ok(state.scene.lastResolution?.changes.includes("解锁：进入交锋"));
  });

  it("rejects an unavailable target without changing tracks", () => {
    const state = createSeedState();
    const next = resolveSceneAction(state, {
      id: "bad", actorId, actionType: "take", targetId: "hidden-archer", approach: "直接取走", createdAt: 1,
    }, { now: () => 10 });
    assert.equal(next.scene.lastResolution?.ruling, "rejected");
    assert.deepEqual(next.tracks, state.tracks);
  });

  it("falls back to rule narration when the optional narrator fails", async () => {
    const state = createSeedState();
    const next = await resolveSceneActionWithNarration(state, {
      id: "r1", actorId, actionType: "observe", targetId: "warehouse-door", approach: "观察", createdAt: 1,
    }, { narrationProvider: { narrate: async () => undefined }, now: () => 10 });
    assert.match(next.scene.narration, /水痕/);
  });

  it("queues a room-player action without resolving authority state", () => {
    const state = createSeedState();
    const next = queueSceneActionRequest(state, {
      id: "room-r1", actorId, actionType: "observe", targetId: "warehouse-door", approach: "贴地看水痕", createdAt: 10,
    });
    assert.equal(next.scene.pendingRequest?.id, "room-r1");
    assert.equal(next.tracks.find((track) => track.id === "track-clue")?.value, 0);
    assert.equal(next.logs[0]?.type, "SCENE_REQUEST");
  });

  it("keeps a DM-only scene request and its ruling out of the public log", () => {
    const queued = queueSceneActionRequest(createSeedState(), {
      id: "room-private", actorId, actionType: "observe", targetId: "warehouse-door",
      approach: "我只把真正来意告诉主持", audience: "dm", createdAt: 10,
    });
    assert.equal(queued.logs[0]?.public, false);
    const resolved = resolveQueuedSceneRequest(queued, "approved", "", { now: () => 20 });
    assert.equal(resolved.logs[0]?.type, "DM_RULING");
    assert.equal(resolved.logs[0]?.public, false);
    assert.equal(resolved.logs.find((entry) => entry.type === "SCENE_ACTION")?.public, false);
  });

  it("lets the真人 DM modify and resolve a queued request with an audit log", () => {
    const queued = queueSceneActionRequest(createSeedState(), {
      id: "room-r2", actorId, actionType: "observe", targetId: "warehouse-door", approach: "直接推门", createdAt: 10,
    });
    const next = resolveQueuedSceneRequest(queued, "modified", "先沿门边水痕观察，不直接暴露位置", { now: () => 20 });
    assert.equal(next.scene.pendingRequest, undefined);
    assert.equal(next.scene.lastResolution?.ruling, "modified");
    assert.equal(next.tracks.find((track) => track.id === "track-clue")?.value, 1);
    assert.equal(next.logs[0]?.type, "DM_RULING");
  });

  it("lets the真人 DM reject a request without changing tracks", () => {
    const queued = queueSceneActionRequest(createSeedState(), {
      id: "room-r3", actorId, actionType: "take", targetId: "blood-seal", approach: "隔空取物", createdAt: 10,
    });
    const next = resolveQueuedSceneRequest(queued, "rejected", "距离不足，请先移步抵近。", { now: () => 20 });
    assert.equal(next.scene.pendingRequest, undefined);
    assert.equal(next.scene.lastResolution?.ruling, "rejected");
    assert.deepEqual(next.tracks, queued.tracks);
    assert.match(next.logs[0]?.message ?? "", /距离不足/);
  });
});
