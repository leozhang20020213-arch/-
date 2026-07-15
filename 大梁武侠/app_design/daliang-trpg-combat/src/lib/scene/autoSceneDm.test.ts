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
  it("resolves legal scene actions and unlocks the structured pursuit only at four clues", () => {
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
    assert.equal(state.scene.combatUnlocked, false);

    state = resolveSceneAction(state, {
      id: "r3", actorId, actionType: "take", targetId: "blood-seal", approach: "收起破封绳", createdAt: 3,
    }, { now: () => 30 });
    assert.equal(state.tracks.find((track) => track.id === "track-clue")?.value, 4);
    assert.equal(state.scene.combatUnlocked, true);
    assert.ok(state.scene.lastResolution?.changes.includes("解锁：栈桥追逐"));
    assert.equal(state.scene.elements.find((element) => element.id === "porter-shadow")?.public, true);
  });

  it("resolves pursuit and standoff with separate authored tracks", () => {
    let state = createSeedState();
    state.scene.id = "pier-pursuit";
    state.scene.elements = [{ id: "pursuit-runner", kind: "person", name: "胡五", description: "", public: true, interactionIds: ["move"] }];
    state.tracks = [{ id: "pursuit-progress", name: "追及", kind: "insight", value: 2, max: 3, hidden: false, description: "追上抱匣人" }, { id: "pursuit-risk", name: "药匣受险", kind: "crisis", value: 0, max: 3, hidden: false, description: "药匣受损风险" }];
    state = resolveSceneAction(state, { id: "p1", actorId, actionType: "move", targetId: "pursuit-runner", createdAt: 1 }, { now: () => 10 });
    assert.equal(state.scene.combatUnlocked, true);
    assert.equal(state.tracks[0]?.value, 3);

    state.scene.id = "old-boathouse-standoff";
    state.scene.combatUnlocked = false;
    state.scene.elements = [{ id: "medicine-case", kind: "object", name: "药匣", description: "", public: true, interactionIds: ["take"] }];
    state.tracks = [{ id: "standoff-trust", name: "交匣意愿", kind: "insight", value: 0, max: 3, hidden: false, description: "说服胡五交还药匣" }];
    state = resolveSceneAction(state, { id: "s1", actorId, actionType: "take", targetId: "medicine-case", createdAt: 2 }, { now: () => 20 });
    assert.equal(state.scene.combatUnlocked, true);
    assert.match(state.scene.lastResolution?.changes.join("｜") ?? "", /非致命交锋/);
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
    assert.match(next.scene.narration, /湿痕/);
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
