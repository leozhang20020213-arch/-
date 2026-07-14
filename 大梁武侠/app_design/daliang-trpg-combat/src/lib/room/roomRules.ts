import type { AppSession } from "../../combat/types";

type Seat = AppSession["seats"][number];

export interface RoomReadiness {
  canStart: boolean;
  reason: string;
  occupiedSeats: Seat[];
}

export function evaluateRoomReadiness(seats: Seat[]): RoomReadiness {
  const occupiedSeats = seats.filter((seat) => seat.id !== "seat-dm" && seat.playerName?.trim());
  const assigned = occupiedSeats.map((seat) => seat.actorId).filter((value): value is string => Boolean(value));
  const hasConflict = new Set(assigned).size !== assigned.length;
  if (occupiedSeats.length === 0) return { canStart: false, reason: "至少需要一名玩家入席", occupiedSeats };
  if (hasConflict) return { canStart: false, reason: "同一人物不能分配给多个席位", occupiedSeats };
  if (occupiedSeats.some((seat) => !seat.actorId)) return { canStart: false, reason: "仍有玩家未分配人物", occupiedSeats };
  if (occupiedSeats.some((seat) => !seat.ready)) return { canStart: false, reason: "仍有玩家未准备", occupiedSeats };
  return { canStart: true, reason: "所有席位已就绪", occupiedSeats };
}

export function claimPlayerSeat(
  seats: Seat[],
  playerName: string,
  actorId: string | undefined,
  connected: boolean,
): Seat[] {
  const target = seats.find((seat) => seat.id !== "seat-dm" && (seat.playerName === playerName || !seat.playerName));
  if (!target) return seats;
  return seats.map((seat) => seat.id === target.id ? {
    ...seat,
    playerName: playerName || seat.playerName || seat.label,
    actorId,
    ready: Boolean(actorId),
    connectionStatus: connected ? "connected" : "offline",
  } : seat);
}
