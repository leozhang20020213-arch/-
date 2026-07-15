import assert from "node:assert/strict";
import { it } from "node:test";
import WebSocket from "ws";
// The embedded host is an Electron ESM module and intentionally has no renderer API.
// @ts-expect-error JavaScript Electron module is exercised directly by this integration test.
import { startLanHost, stopLanHost } from "../../electron/lanHost.mjs";

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function nextMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => socket.once("message", (raw) => resolve(JSON.parse(String(raw)) as Record<string, unknown>)));
}

it("embedded LAN host isolates private requests and sends the authority snapshot", async () => {
  const hostInfo = await startLanHost(0);
  const host = await openSocket(hostInfo.localUrl);
  let player: WebSocket | null = null;

  try {
    host.send(JSON.stringify({
      type: "room_created",
      roomCode: "LAN-T001",
      senderId: "dm",
      payload: { protocolVersion: 1, room: {}, seats: [], publicState: { sceneName: "白蘋渡" } },
    }));
    await nextMessage(host);

    player = await openSocket(hostInfo.localUrl);
    const playerSnapshot = nextMessage(player);
    const hostJoinNotice = nextMessage(host);
    player.send(JSON.stringify({
      type: "room_joined",
      roomCode: "LAN-T001",
      senderId: "player",
      payload: { protocolVersion: 1, playerName: "测试玩家" },
    }));
    assert.equal((await playerSnapshot).type, "public_state_synced");
    assert.equal((await hostJoinNotice).type, "room_joined");

    const hostPrivate = nextMessage(host);
    const playerMessages: string[] = [];
    player.on("message", (raw) => playerMessages.push(String(raw)));
    player.send(JSON.stringify({
      type: "scene_action_requested",
      roomCode: "LAN-T001",
      senderId: "player",
      payload: { protocolVersion: 1, request: { id: "private-1", audience: "dm" } },
    }));
    assert.equal((await hostPrivate).type, "scene_action_requested");
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(playerMessages.some((message) => message.includes("private-1")), false);
  } finally {
    host.close();
    player?.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await stopLanHost();
  }
});
