import { createInitialCombatState, createSeedState } from "../data/seed";
import type { AppSession, CombatState, InnerArt, InventoryItem, MoveTiming, SixRoots, StatusEffect } from "./types";

const STORAGE_KEY = "daliang-trpg-combat:v1";
const SESSION_KEY = "daliang-trpg-session:v1";
const INVALID_PLACEHOLDER_STATUSES = new Set(["雨夜视线受限", "阴偏", "雨幕遮身", "搬箱奔逃", "等待撤离", "买主接应"]);
const VALID_MOVE_TIMINGS = new Set<MoveTiming>([
  "正式出手",
  "出手便行",
  "随手便行",
  "截击",
  "应招",
  "整备/情景",
]);

export function createDefaultSession(): AppSession {
  return {
    route: "home",
    gameMode: "scene",
    developerMode: false,
    autoDmEnabled: false,
    playMode: "solo",
    aiNarrationEnabled: false,
    aiNarrationEndpoint: "",
    roomCode: "LOCAL-BRIDGE-RAIN",
    playerName: "沈青玩家",
    selectedActorId: "pc-shen-qing",
    seats: [
      { id: "seat-dm", label: "DM", playerName: "试跑DM", ready: true, connectionStatus: "offline" },
      { id: "seat-1", label: "玩家1", playerName: "沈青玩家", actorId: "pc-shen-qing", ready: true, connectionStatus: "offline" },
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
    return createSeedState(); // SSR/test: return raw seed (no auto-enter)
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    // If saved state exists, normalize it. Otherwise use initial state with pre-rolled dice.
    return raw
      ? normalizeCombatState(JSON.parse(raw) as Partial<CombatState>)
      : createInitialCombatState();
  } catch {
    return createInitialCombatState();
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
  return createInitialCombatState();
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

export function normalizeCombatState(value: Partial<CombatState>): CombatState {
  const seed = createSeedState();
  const actors = (value.actors ?? seed.actors).map((actor, index) => {
    const seedActor = seed.actors[index] ?? seed.actors[0];
    // Cast to unknown first, then to a record so we can access arbitrary legacy keys
    const rawActor = actor as unknown as Record<string, unknown>;
    const rawSeed = seedActor as unknown as Record<string, unknown> | undefined;

    // Normalize sixRoots (old English keys → new Chinese keys)
    const normalizedSixRoots = normalizeSixRoots(
      rawActor.sixRoots ?? rawSeed?.["sixRoots"],
    );

    // Normalize innerArts (old activeNeigong → innerArts array)
    const oldNeigong = rawActor.activeNeigong;
    const normalizedInnerArts = normalizeInnerArts(
      rawActor.innerArts,
      oldNeigong,
      rawSeed?.["innerArts"],
    );

    // Normalize statuses (old string[] → StatusEffect[])
    const normalizedStatuses = normalizeStatuses(
      rawActor.statuses,
      rawSeed?.["statuses"],
      (rawActor.id as string) ?? seedActor.id ?? "unknown",
    );

    // Normalize old publicStatuses (merge into statuses with public: true)
    const oldPublicStatuses = rawActor.publicStatuses;
    const publicStatEffs = normalizeLegacyStatusList(
      oldPublicStatuses ?? rawSeed?.["statuses"],
      true,
      (rawActor.id as string) ?? seedActor.id ?? "unknown",
    );

    // Normalize old hiddenStatuses (merge into statuses with public: false)
    const oldHiddenStatuses = rawActor.hiddenStatuses;
    const hiddenStatEffs = normalizeLegacyStatusList(
      oldHiddenStatuses ?? rawSeed?.["hiddenStatuses"],
      false,
      (rawActor.id as string) ?? seedActor.id ?? "unknown",
    );

    // Merge all statuses: normalized from new format, plus converted from old public/hidden
    const allStatuses = mergeStatusEffects([...normalizedStatuses, ...publicStatEffs, ...hiddenStatEffs]);

    return {
      ...seedActor,
      ...actor,
      sixRoots: normalizedSixRoots,
      innerArts: normalizedInnerArts,
      statuses: allStatuses,
      inventory: (rawActor.inventory as InventoryItem[]) ?? seedActor?.inventory ?? [],
      moves: normalizeMoves(rawActor.moves, seedActor?.moves ?? []),
    };
  });

  const valueRec = value as unknown as Record<string, unknown>;
  const actorIds = new Set(actors.map((actor) => actor.id));
  const storedOrder = Array.isArray(valueRec.initiativeOrder)
    ? valueRec.initiativeOrder.filter((id): id is string => typeof id === "string" && actorIds.has(id))
    : [];
  const initiativeOrder = [
    ...storedOrder,
    ...actors.map((actor) => actor.id).filter((id) => !storedOrder.includes(id)),
  ];
  const actedActorIds = Array.isArray(valueRec.actedActorIds)
    ? valueRec.actedActorIds.filter((id): id is string => typeof id === "string" && actorIds.has(id))
    : [];

  return {
    ...seed,
    ...value,
    actors,
    initiativeOrder,
    actedActorIds,
    encounterMode: value.encounterMode === "combat" ? "combat" : "scene",
    turnPaused: Boolean(value.turnPaused),
    dice: normalizeDice(
      (Array.isArray(valueRec.dice) ? valueRec.dice : seed.dice) as CombatState["dice"],
      seed.dice,
    ),
    tracks: normalizeTracks((Array.isArray(valueRec.tracks) ? valueRec.tracks : seed.tracks) as CombatState["tracks"]),
    scene: value.scene ? { ...seed.scene, ...value.scene } : seed.scene,
    distances: (Array.isArray(valueRec.distances) ? valueRec.distances : seed.distances) as CombatState["distances"],
    logs: (Array.isArray(valueRec.logs) ? valueRec.logs : seed.logs) as CombatState["logs"],
    feedback: (Array.isArray(valueRec.feedback) ? valueRec.feedback : seed.feedback) as CombatState["feedback"],
  };
}

export function normalizeAppSession(value: Partial<AppSession>): AppSession {
  const seed = createDefaultSession();
  const routeMap: Record<string, AppSession["route"]> = {
    home: "home",
    characterSelect: "characterSelect",
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
    autoDmEnabled: value.autoDmEnabled ?? false,
    playMode: value.playMode ?? "solo",
    aiNarrationEnabled: value.aiNarrationEnabled ?? false,
    aiNarrationEndpoint: value.aiNarrationEndpoint ?? "",
    roomCode: value.roomCode ?? seed.roomCode,
    seats: value.seats ?? seed.seats,
    room: { ...seed.room, ...value.room },
  };
}

function normalizeTracks(tracks: CombatState["tracks"]): CombatState["tracks"] {
  return tracks.map((track) => {
    const renamed = track.id === "track-escape" || track.name === "逃离危机" ? { ...track, name: "危机值" } : track;
    if (renamed.kind) return renamed;
    return { ...renamed, kind: renamed.name.includes("解密") ? "insight" as const : "crisis" as const };
  });
}

function normalizeDice(
  dice: CombatState["dice"],
  seedDice: CombatState["dice"],
): CombatState["dice"] {
  const seeds = new Map(seedDice.map((die) => [die.id, die]));
  return dice.map((die) => {
    const rawNature = String((die as unknown as Record<string, unknown>).nature ?? "raw");
    const nature = rawNature === "yin" || rawNature === "yang"
      ? rawNature
      : "raw";
    return { ...seeds.get(die.id), ...die, nature };
  });
}

function normalizeMoves(raw: unknown, seedMoves: CombatState["actors"][number]["moves"]): CombatState["actors"][number]["moves"] {
  if (!Array.isArray(raw)) return seedMoves;
  const seeds = new Map(seedMoves.map((move) => [move.id, move]));
  return raw.map((move) => {
    if (!isRecord(move)) return move;
    const id = String(move.id ?? "");
    const seedMove = seeds.get(id);
    const rawTiming = String(move.timing ?? seedMove?.timing ?? "正式出手");
    const legacyDamage = typeof move.baseDamage === "number" ? move.baseDamage : 0;
    return {
      ...seedMove,
      ...move,
      // Legacy prototypes used free-form timing labels. Unknown labels are
      // migrated to the strict formal-action path so yin/yang slot rules are
      // never silently bypassed by an old save.
      timing: VALID_MOVE_TIMINGS.has(rawTiming as MoveTiming)
        ? rawTiming as MoveTiming
        : "正式出手",
      category: typeof move.category === "string" ? move.category : seedMove?.category ?? "外功",
      subCategory: typeof move.subCategory === "string" ? move.subCategory : seedMove?.subCategory ?? "主攻",
      tier: typeof move.tier === "string" ? move.tier : seedMove?.tier ?? "俗家",
      designGrade: typeof move.designGrade === "string" ? move.designGrade : seedMove?.designGrade ?? "C",
      yinYangLabel: typeof move.yinYangLabel === "string" ? move.yinYangLabel : seedMove?.yinYangLabel ?? "中平",
      formPosition: typeof move.formPosition === "string" ? move.formPosition : seedMove?.formPosition ?? "无",
      minDice: typeof move.minDice === "number" ? move.minDice : seedMove?.minDice ?? 1,
      qiNatureThreshold: typeof move.qiNatureThreshold === "string"
        ? move.qiNatureThreshold
        : seedMove?.qiNatureThreshold ?? "任意气性",
      shiCondition: typeof move.shiCondition === "string" ? move.shiCondition : seedMove?.shiCondition ?? "无势",
      targetRange: typeof move.targetRange === "string" ? move.targetRange : seedMove?.targetRange ?? "当前目标",
      equipPermission: typeof move.equipPermission === "string" ? move.equipPermission : seedMove?.equipPermission ?? "无",
      baseEffect: typeof move.baseEffect === "string"
        ? move.baseEffect
        : seedMove?.baseEffect ?? (legacyDamage > 0 ? `造成气血${legacyDamage}点` : "按旧版招式文本裁定"),
      triggers: Array.isArray(move.triggers) ? move.triggers : seedMove?.triggers ?? [],
      postShi: typeof move.postShi === "string" ? move.postShi : seedMove?.postShi ?? "不改势",
      resourceDestination: typeof move.resourceDestination === "string"
        ? move.resourceDestination
        : seedMove?.resourceDestination ?? "已用常规气骰入息库",
      hasIntercept: typeof move.hasIntercept === "boolean" ? move.hasIntercept : seedMove?.hasIntercept ?? true,
      hasReact: typeof move.hasReact === "boolean" ? move.hasReact : seedMove?.hasReact ?? true,
      allowedShi: Array.isArray(move.allowedShi)
        ? move.allowedShi
        : seedMove?.allowedShi ?? [],
    };
  }) as CombatState["actors"][number]["moves"];
}

// === Normalization helpers ===

const OLD_SIX_ROOT_MAP: Record<string, string> = {
  head: "顶门",
  eyes: "目窍",
  heart: "心口",
  dantian: "丹田",
  waist: "命门",
  legs: "步根",
};

function normalizeSixRoots(raw: unknown): SixRoots {
  if (!isRecord(raw)) {
    return { 顶门: 3, 目窍: 3, 心口: 3, 丹田: 3, 命门: 3, 步根: 3 };
  }
  const mapped: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const mappedKey = OLD_SIX_ROOT_MAP[key] ?? key;
    mapped[mappedKey] = typeof value === "number" ? value : 3;
  }
  // Ensure all required keys exist
  return {
    顶门: mapped["顶门"] ?? 3,
    目窍: mapped["目窍"] ?? 3,
    心口: mapped["心口"] ?? 3,
    丹田: mapped["丹田"] ?? 3,
    命门: mapped["命门"] ?? 3,
    步根: mapped["步根"] ?? 3,
  };
}

function normalizeInnerArts(
  rawInnerArts: unknown,
  oldNeigong: unknown,
  seedInnerArts: unknown,
): InnerArt[] {
  // If we have a proper innerArts array, use it
  if (Array.isArray(rawInnerArts) && rawInnerArts.length > 0) {
    return rawInnerArts as InnerArt[];
  }
  // If we have an old activeNeigong object, wrap it in an array
  if (isRecord(oldNeigong)) {
    return [oldNeigong as unknown as InnerArt];
  }
  // Fall back to seed innerArts
  if (Array.isArray(seedInnerArts)) {
    return seedInnerArts as InnerArt[];
  }
  return [];
}

function normalizeStatuses(
  raw: unknown,
  seedStatuses: unknown,
  ownerId: string,
): StatusEffect[] {
  return normalizeLegacyStatusList(raw ?? seedStatuses, true, ownerId);
}

function normalizeLegacyStatusList(
  raw: unknown,
  isPublic: boolean,
  ownerId: string,
): StatusEffect[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string | Record<string, unknown> => typeof item === "string" || isRecord(item))
    .map((item) => {
      if (typeof item === "string") {
        // Old format: plain string → convert to StatusEffect
        if (INVALID_PLACEHOLDER_STATUSES.has(item)) return null;
        return {
          id: `status-legacy-${item}-${ownerId}`,
          name: item,
          layers: 1,
          source: "legacy",
          ownerId,
          public: isPublic,
          effects: [],
          removalEntries: [],
        } as StatusEffect;
      }
      // Already a StatusEffect-like object
      if (isRecord(item)) {
        const name = String(item.name ?? "");
        if (INVALID_PLACEHOLDER_STATUSES.has(name)) return null;
        return {
          id: String(item.id ?? `status-${name}-${ownerId}`),
          name,
          layers: typeof item.layers === "number" ? item.layers : 1,
          source: String(item.source ?? "legacy"),
          ownerId: String(item.ownerId ?? ownerId),
          public: typeof item.public === "boolean" ? item.public : isPublic,
          effects: Array.isArray(item.effects) ? item.effects : [],
          removalEntries: Array.isArray(item.removalEntries) ? item.removalEntries : [],
        } as StatusEffect;
      }
      return null;
    })
    .filter((item): item is StatusEffect => item !== null);
}

function mergeStatusEffects(all: StatusEffect[]): StatusEffect[] {
  const seen = new Map<string, StatusEffect>();
  for (const eff of all) {
    const key = eff.id;
    if (seen.has(key)) {
      const existing = seen.get(key)!;
      seen.set(key, { ...existing, layers: existing.layers + eff.layers });
    } else {
      seen.set(key, eff);
    }
  }
  return [...seen.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
