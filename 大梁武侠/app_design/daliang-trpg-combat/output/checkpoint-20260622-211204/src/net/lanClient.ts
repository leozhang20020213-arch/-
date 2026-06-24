import { validateLanMessage, type LanMessage } from "../rules/schema";

export type LanConnectionStatus = "idle" | "connecting" | "connected" | "closed" | "error";

export interface LanClientOptions {
  url: string;
  roomCode: string;
  senderId: string;
  onMessage: (message: LanMessage) => void;
  onStatus?: (status: LanConnectionStatus, detail?: string) => void;
}

export interface LanClient {
  connect: () => void;
  close: () => void;
  send: (type: LanMessage["type"], payload: unknown) => boolean;
}

export function createLanClient(options: LanClientOptions): LanClient {
  let socket: WebSocket | undefined;
  let status: LanConnectionStatus = "idle";

  function setStatus(next: LanConnectionStatus, detail?: string) {
    status = next;
    options.onStatus?.(next, detail);
  }

  function connect() {
    if (status === "connected" || status === "connecting") return;
    setStatus("connecting");
    socket = new WebSocket(options.url);
    socket.addEventListener("open", () => setStatus("connected"));
    socket.addEventListener("close", () => setStatus("closed"));
    socket.addEventListener("error", () => setStatus("error", "局域网连接失败"));
    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as LanMessage;
        const validation = validateLanMessage(message);
        if (!validation.ok && message.type !== "client_error") {
          setStatus("error", validation.errors.join("；"));
          return;
        }
        options.onMessage(message);
      } catch {
        setStatus("error", "收到非法 LAN 消息");
      }
    });
  }

  function close() {
    socket?.close();
    socket = undefined;
    setStatus("closed");
  }

  function send(type: LanMessage["type"], payload: unknown): boolean {
    const message: LanMessage = {
      type,
      roomCode: options.roomCode,
      senderId: options.senderId,
      payload,
    };
    const validation = validateLanMessage(message);
    if (!validation.ok) {
      setStatus("error", validation.errors.join("；"));
      return false;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setStatus("error", "LAN 尚未连接");
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  }

  return { connect, close, send };
}
