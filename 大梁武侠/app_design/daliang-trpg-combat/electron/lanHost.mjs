import os from "node:os";
import { WebSocketServer, WebSocket } from "ws";

const PROTOCOL_VERSION = 1;
let server;
const rooms = new Map();

function networkAddresses(port) {
  const values = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) values.push(`ws://${entry.address}:${port}`);
    }
  }
  return values;
}

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function error(socket, message) {
  send(socket, { type: "client_error", roomCode: "LAN-0000", senderId: "lan-host", payload: { message } });
}

function transactionId(message) {
  const payload = message.payload && typeof message.payload === "object" ? message.payload : {};
  const nested = payload.request ?? payload.event ?? payload;
  const stable = nested && typeof nested === "object" ? nested.id : undefined;
  return stable ? `${message.senderId}:${message.type}:${stable}` : undefined;
}

function broadcast(room, message, predicate = () => true) {
  for (const client of room.clients.values()) if (predicate(client)) send(client.socket, message);
}

export async function startLanHost(requestedPort = 8787) {
  if (server) {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : requestedPort;
    return { running: true, port, localUrl: `ws://127.0.0.1:${port}`, networkUrls: networkAddresses(port), protocolVersion: PROTOCOL_VERSION };
  }
  server = new WebSocketServer({ port: requestedPort, host: "0.0.0.0" });
  server.on("connection", (socket) => {
    let client;
    socket.on("message", (raw) => {
      let message;
      try { message = JSON.parse(String(raw)); } catch { error(socket, "消息不是合法JSON。"); return; }
      if (!message || typeof message.type !== "string" || typeof message.roomCode !== "string" || typeof message.senderId !== "string") {
        error(socket, "LAN消息缺少类型、房间码或发送者。"); return;
      }
      const version = message.payload?.protocolVersion ?? PROTOCOL_VERSION;
      if (version !== PROTOCOL_VERSION) { error(socket, `版本冲突：房主协议 ${PROTOCOL_VERSION}，来访者协议 ${version}。`); return; }

      if (message.type === "room_created") {
        const room = rooms.get(message.roomCode) ?? { roomCode: message.roomCode, hostId: message.senderId, clients: new Map(), seen: new Set() };
        room.hostId = message.senderId;
        room.lastRoomPayload = message.payload;
        room.lastPublicState = message.payload?.publicState;
        rooms.set(message.roomCode, room);
        client = { socket, senderId: message.senderId, isHost: true };
        room.clients.set(message.senderId, client);
        broadcast(room, message);
        return;
      }
      const room = rooms.get(message.roomCode);
      if (!room) { error(socket, `房间不存在：${message.roomCode}`); return; }
      if (!client) {
        client = { socket, senderId: message.senderId, isHost: message.senderId === room.hostId };
        room.clients.set(message.senderId, client);
      }
      const tx = transactionId(message);
      if (tx && room.seen.has(tx)) return;
      if (tx) room.seen.add(tx);

      if (["public_state_synced", "combat_event_committed", "dm_broadcast", "seat_assigned"].includes(message.type) && message.senderId !== room.hostId) {
        error(socket, "只有DM房主可以提交权威状态、席位或广播。"); return;
      }
      if (message.type === "room_joined" && room.lastPublicState) {
        send(socket, { type: "public_state_synced", roomCode: room.roomCode, senderId: room.hostId, payload: { publicState: room.lastPublicState } });
      }
      if (message.type === "public_state_synced") room.lastPublicState = message.payload?.publicState;
      if (message.type === "scene_action_requested" && message.payload?.request?.audience === "dm") {
        broadcast(room, message, (candidate) => candidate.senderId === room.hostId);
        return;
      }
      broadcast(room, message);
    });
    socket.on("close", () => {
      if (!client) return;
      for (const room of rooms.values()) room.clients.delete(client.senderId);
    });
  });
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  return { running: true, port, localUrl: `ws://127.0.0.1:${port}`, networkUrls: networkAddresses(port), protocolVersion: PROTOCOL_VERSION };
}

export async function stopLanHost() {
  if (!server) return { running: false };
  const active = server;
  server = undefined;
  // A graceful client close can remain in the WebSocket closing handshake and
  // keep Electron or Node's event loop alive indefinitely. The host owns these
  // sockets, so terminate them before closing the listening server. This also
  // makes room teardown and repeated LAN integration tests deterministic.
  for (const client of active.clients) client.terminate();
  rooms.clear();
  await new Promise((resolve) => active.close(resolve));
  return { running: false };
}
