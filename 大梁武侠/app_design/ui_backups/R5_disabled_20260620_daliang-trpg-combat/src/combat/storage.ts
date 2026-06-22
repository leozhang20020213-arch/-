import { createSeedState } from "../data/seed";
import type { AppSession, CombatState } from "./types";

const STORAGE_KEY = "daliang-trpg-combat:v1";
const SESSION_KEY = "daliang-trpg-session:v1";
const INVALID_PLACEHOLDER_STATUSES = new Set(["雨夜视线受限", "阴偏", "雨幕遮身", "搬箱奔逃", "等待撤离", "买主接应"]);

export function createDefaultSession(): AppSession {
  return {
    route: "home",
    gameMode: "scene",
    developerMode: false,
    roomCode: "LOCAL-BRIDGE-RAIN",
    playerName: "沈青玩家",
    selectedActorId: "pc-shen-qing",
    seats: [
      { id: "seat-dm", label: "DM", playerName: "试跑DM", ready: true },
      { id: "seat-1", label: "玩家1", playerName: "沈青玩家", actorId: "pc-shen-qing", ready: true },
      { id: "seat-2", label: "玩家2", ready: false },
      { id: "seat-3", label: "玩家3", ready: false },
    ],
    room: {
      roomName: "桥陵镇雨夜失镖",
      hostName: "试跑DM",
      campaignId: "bridge-rain",
      mode: "local",
      allowSpectators: true,
      maxPlayers: 4,
    },
  };
}

export function loadCombatState(): CombatState {
  if (typeof window === "undefined") {
    return createSeedState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeCombatState(JSON.parse(raw) as Partial<CombatState>) : createSeedState();
  } catch {
    return createSeedState();
  }
}

export function saveCombatState(state: CombatState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, lastSavedAt: Date.now() }));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

export function clearCombatState(): CombatState {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return createSeedState();
}

export function loadAppSession(): AppSession {
  if (typeof window === "undefined") {
    return createDefaultSession();
  }

  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? normalizeAppSession(JSON.parse(raw) as Partial<AppSession>) : createDefaultSession();
  } catch {
    return createDefaultSession();
  }
}

export function saveAppSession(session: AppSession): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

export function clearAppSession(): AppSession {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
  }
  return createDefaultSession();
}

function normalizeCombatState(value: Partial<CombatState>): CombatState {
  const seed = createSeedState();
  const actors = (value.actors ?? seed.actors).map((actor, index) => ({
    ...seed.actors[index],
    ...actor,
    inventory: actor.inventory ?? seed.actors[index]?.inventory ?? [],
    sixRoots: actor.sixRoots ?? seed.actors[index]?.sixRoots ?? { head: 3, eyes: 3, heart: 3, dantian: 3, waist: 3, legs: 3 },
    activeNeigong: actor.activeNeigong ?? seed.actors[index]?.activeNeigong,
    statuses: cleanStatuses(actor.statuses ?? seed.actors[index]?.statuses ?? []),
    publicStatuses: cleanStatuses(actor.publicStatuses ?? actor.statuses ?? seed.actors[index]?.publicStatuses ?? []),
    hiddenStatuses: cleanStatuses(actor.hiddenStatuses ?? seed.actors[index]?.hiddenStatuses ?? []),
  }));

  return {
    ...seed,
    ...value,
    actors,
    dice: value.dice ?? seed.dice,
    tracks: normalizeTracks(value.tracks ?? seed.tracks),
    distances: value.distances ?? seed.distances,
    logs: value.logs ?? seed.logs,
  };
}

function normalizeAppSession(value: Partial<AppSession>): AppSession {
  const seed = createDefaultSession();
  const routeMap: Record<string, AppSession["route"]> = {
    home: "home",
    room: "createRoom",
    player: "playerCombat",
    dm: "dmCombat",
    createRoom: "createRoom",
    joinRoom: "joinRoom",
    roomWaiting: "roomWaiting",
    characterAssign: "characterAssign",
    playerScene: "playerScene",
    playerCombat: "playerCombat",
    dmScene: "dmScene",
    dmCombat: "dmCombat",
    library: "library",
    packs: "packs",
    settings: "settings",
  };

  return {
    ...seed,
    ...value,
    route: routeMap[value.route ?? "home"] ?? "home",
    gameMode: value.gameMode ?? (value.route === "player" || value.route === "dm" ? "combat" : "scene"),
    developerMode: value.developerMode ?? false,
    roomCode: value.roomCode ?? seed.roomCode,
    seats: value.seats ?? seed.seats,
    room: { ...seed.room, ...value.room },
  };
}

function normalizeTracks(tracks: CombatState["tracks"]): CombatState["tracks"] {
  return tracks.map((track) => (track.id === "track-escape" || track.name === "逃离危机" ? { ...track, name: "危机值" } : track));
}

function cleanStatuses(statuses: string[]): string[] {
  return statuses.filter((status) => !INVALID_PLACEHOLDER_STATUSES.has(status));
}
