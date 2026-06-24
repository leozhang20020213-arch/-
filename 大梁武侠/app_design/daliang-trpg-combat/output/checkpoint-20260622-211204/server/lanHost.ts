import { WebSocketServer, type WebSocket } from "ws";
import { validateLanMessage, type LanMessage } from "../src/rules/schema";

interface LanClient {
  socket: WebSocket;
  senderId: string;
  roomCode: string;
  isHost: boolean;
}

interface LanRoom {
  roomCode: string;
  hostId: string;
  clients: Map<string, LanClient>;
  lastRoomPayload?: unknown;
  lastPublicState?: unknown;
}

const port = Number(process.env.DALIANG_LAN_PORT ?? 8787);
const rooms = new Map<string, LanRoom>();
const server = new WebSocketServer({ port, host: "0.0.0.0" });

server.on("connection", (socket) => {
  let client: LanClient | undefined;

  socket.on("message", (raw) => {
    let message: LanMessage;
    try {
      message = JSON.parse(String(raw)) as LanMessage;
    } catch {
      sendError(socket, "消息不是合法 JSON。");
      return;
    }

    const validation = validateLanMessage(message);
    if (!validation.ok) {
      sendError(socket, validation.errors.join("；"));
      return;
    }

    if (message.type === "room_created") {
      const room = rooms.get(message.roomCode) ?? {
        roomCode: message.roomCode,
        hostId: message.senderId,
        clients: new Map<string, LanClient>(),
      };
      room.hostId = message.senderId;
      room.lastRoomPayload = message.payload;
      const publicState = readPublicState(message.payload);
      if (publicState) {
        room.lastPublicState = publicState;
      }
      rooms.set(message.roomCode, room);
      client = { socket, senderId: message.senderId, roomCode: message.roomCode, isHost: true };
      room.clients.set(message.senderId, client);
      broadcast(room, message);
      return;
    }

    const room = rooms.get(message.roomCode);
    if (!room) {
      sendError(socket, `房间不存在：${message.roomCode}`);
      return;
    }

    if (!client) {
      client = { socket, senderId: message.senderId, roomCode: message.roomCode, isHost: message.senderId === room.hostId };
      room.clients.set(message.senderId, client);
    }

    if (message.type === "room_joined" && room.lastPublicState) {
      socket.send(JSON.stringify({
        type: "public_state_synced",
        roomCode: room.roomCode,
        senderId: room.hostId,
        payload: { publicState: room.lastPublicState },
      } satisfies LanMessage));
    }

    if (message.type === "combat_event_committed" || message.type === "dm_broadcast" || message.type === "public_state_synced") {
      if (message.senderId !== room.hostId) {
        sendError(socket, "只有 DM 房主可以提交规则事件或广播公开状态。");
        return;
      }
      if (message.type === "public_state_synced") {
        const publicState = readPublicState(message.payload);
        if (publicState) {
          room.lastPublicState = publicState;
        }
      }
    }

    broadcast(room, message);
  });

  socket.on("close", () => {
    if (!client) return;
    const room = rooms.get(client.roomCode);
    room?.clients.delete(client.senderId);
  });
});

server.on("listening", () => {
  const address = server.address();
  const portText = typeof address === "object" && address ? address.port : port;
  console.log(`大梁江湖 LAN 房主服务已启动：ws://0.0.0.0:${portText}`);
});

function broadcast(room: LanRoom, message: LanMessage): void {
  const text = JSON.stringify(message);
  for (const client of room.clients.values()) {
    if (client.socket.readyState === client.socket.OPEN) {
      client.socket.send(text);
    }
  }
}

function sendError(socket: WebSocket, message: string): void {
  const payload: LanMessage = {
    type: "client_error",
    roomCode: "LAN-0000",
    senderId: "lan-host",
    payload: { message },
  };
  socket.send(JSON.stringify(payload));
}

function readPublicState(payload: unknown): unknown {
  if (!isRecord(payload) || !("publicState" in payload)) return undefined;
  return payload.publicState;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
