import { createInitialCombatState, createSeedState } from "../data/seed";
import type { AppSession, CombatState, InnerArt, InventoryItem, MoveTiming, QiDie, SixRoots, StatusEffect } from "./types";
import { normalizeResponseBudget, normalizeRuntimeSession } from "../domain/session/runtime";

const STORAGE_KEY = "daliang-trpg-combat:v1";
const SESSION_KEY = "daliang-trpg-session:v1";
export type CombatStorageScope = "solo" | "room";
type DesktopCombatStorageKey = "combat-solo" | "combat-room";

export function combatStorageKey(scope: CombatStorageScope): string {
  return `${STORAGE_KEY}:${scope}`;
}

function desktopCombatStorageKey(scope: CombatStorageScope): DesktopCombatStorageKey {
  return `combat-${scope}`;
}
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
    soloCampaignId: "campaign-mist-salt-ledger",
    roomCode: "LAN-BP01",
    playerName: "沈青玩家",
    preferences: {
      uiScale: 1,
      animationSpeed: 1,
      dicePresentation: "full",
      textSpeed: "normal",
      masterVolume: 0.8,
      autoRuleLevel: "standard",
    },
    selectedActorId: "pc-shen-qing",
    seats: [
      { id: "seat-dm", label: "DM", playerName: "试跑DM", ready: true, connectionStatus: "offline" },
      { id: "seat-1", label: "玩家1", playerName: "沈青玩家", actorId: "pc-shen-qing", ready: true, connectionStatus: "offline" },
      { id: "seat-2", label: "玩家2", ready: false },
      { id: "seat-3", label: "玩家3", ready: false },
    ],
    room: {
      roomName: "雾岭盐引",
      hostName: "试跑DM",
      campaignId: "campaign-mist-salt-ledger",
      mode: "local",
      allowSpectators: true,
      allowPrivateDmMessages: true,
      maxPlayers: 4,
    },
  };
}

export function loadCombatState(scope: CombatStorageScope = "solo"): CombatState {
  if (typeof window === "undefined") {
    return createSeedState(); // SSR/test: return raw seed (no auto-enter)
  }

  try {
    const desktopKey = desktopCombatStorageKey(scope);
    const desktopValue = window.daliangDesktop?.storage.read(desktopKey) as Partial<CombatState> | undefined;
    if (desktopValue) return normalizeCombatState(desktopValue);
    const raw = window.localStorage.getItem(combatStorageKey(scope));
    // If saved state exists, normalize it. Otherwise use initial state with pre-rolled dice.
    if (raw) return normalizeCombatState(JSON.parse(raw) as Partial<CombatState>);

    // One-time migration: the legacy build had a single shared slot. Move it
    // into the currently active play mode, then remove the ambiguous source so
    // it cannot be imported into both solo play and a hosted room.
    const legacyDesktop = window.daliangDesktop?.storage.read("combat") as Partial<CombatState> | undefined;
    const legacyRaw = window.localStorage.getItem(STORAGE_KEY);
    if (!legacyDesktop && !legacyRaw) return createInitialCombatState();
    const migrated = normalizeCombatState(legacyDesktop ?? JSON.parse(legacyRaw!) as Partial<CombatState>);
    void window.daliangDesktop?.storage.write(desktopKey, migrated);
    void window.daliangDesktop?.storage.clear("combat");
    window.localStorage.setItem(combatStorageKey(scope), JSON.stringify(migrated));
    window.localStorage.removeItem(STORAGE_KEY);
    return migrated;
  } catch {
    return createInitialCombatState();
  }
}

export function saveCombatState(state: CombatState, scope: CombatStorageScope = "solo"): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (window.daliangDesktop) {
      void window.daliangDesktop.storage.write(desktopCombatStorageKey(scope), { ...state, lastSavedAt: Date.now() });
      return;
    }
    window.localStorage.setItem(combatStorageKey(scope), JSON.stringify({ ...state, lastSavedAt: Date.now() }));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

export function clearCombatState(scope: CombatStorageScope = "solo"): CombatState {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(combatStorageKey(scope));
    void window.daliangDesktop?.storage.clear(desktopCombatStorageKey(scope));
  }
  return createInitialCombatState();
}

export function loadAppSession(): AppSession {
  if (typeof window === "undefined") {
    return createDefaultSession();
  }

  try {
    const desktopValue = window.daliangDesktop?.storage.read("session") as Partial<AppSession> | undefined;
    const rawValue = desktopValue ?? (() => {
      const raw = window.localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) as Partial<AppSession> : undefined;
    })();
    if (!rawValue) return createDefaultSession();
    const normalized = normalizeAppSession(rawValue);
    if (!desktopValue) void window.daliangDesktop?.storage.write("session", normalized);
    return {
      ...normalized,
      route: "home",
      lastRoute: normalized.route === "home" ? normalized.lastRoute : normalized.route,
    };
  } catch {
    return createDefaultSession();
  }
}

export function saveAppSession(session: AppSession): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const persisted = session.route === "home"
      ? session
      : { ...session, lastRoute: session.route };
    if (window.daliangDesktop) {
      void window.daliangDesktop.storage.write("session", persisted);
      return;
    }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(persisted));
  } catch {
    // Local storage can be unavailable in restricted browser contexts.
  }
}

export function clearAppSession(): AppSession {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(SESSION_KEY);
    void window.daliangDesktop?.storage.clear("session");
  }
  return createDefaultSession();
}

export function normalizeCombatState(value: Partial<CombatState>): CombatState {
  const seed = createSeedState();
  const storedActors = value.actors ?? seed.actors;
  const storedActorIds = new Set(storedActors.map((actor) => actor.id));
  const actorInputs = [
    ...storedActors,
    // A content update may add reviewed preset actors. They must become
    // available to old profiles without replacing or reordering user-created
    // actors already present in the save.
    ...seed.actors.filter((actor) => !storedActorIds.has(actor.id)),
  ];
  const seedActorsById = new Map(seed.actors.map((actor) => [actor.id, actor]));
  const actors = actorInputs.map((actor) => {
    // Stable ids, never array indexes, define actor identity across versions.
    const seedActor = seedActorsById.get(actor.id) ?? seed.actors[0];
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

    const inventory = (rawActor.inventory as InventoryItem[]) ?? seedActor?.inventory ?? [];
    const equippedWeapon = typeof rawActor.equippedWeapon === "string"
      ? rawActor.equippedWeapon
      : seedActor?.equippedWeapon;
    const equippedArmorUpper = typeof rawActor.equippedArmorUpper === "string"
      ? rawActor.equippedArmorUpper
      : seedActor?.equippedArmorUpper;
    const equippedArmorLower = typeof rawActor.equippedArmorLower === "string"
      ? rawActor.equippedArmorLower
      : seedActor?.equippedArmorLower;
    const equippedAccessory = typeof rawActor.equippedAccessory === "string"
      ? rawActor.equippedAccessory
      : seedActor?.equippedAccessory;
    const normalizedInventory = inventory.map((item) => {
      if (item.category === "weapon") return { ...item, equipped: item.id === equippedWeapon };
      if (item.category === "armor") return { ...item, equipped: item.id === equippedArmorUpper || item.id === equippedArmorLower };
      if (item.category === "accessory") return { ...item, equipped: item.id === equippedAccessory };
      return item.equipped ? { ...item, equipped: false } : item;
    });

    return {
      ...seedActor,
      ...actor,
      sixRoots: normalizedSixRoots,
      innerArts: normalizedInnerArts,
      statuses: allStatuses,
      inventory: normalizedInventory,
      equippedWeapon,
      equippedArmorUpper,
      equippedArmorLower,
      equippedAccessory,
      moves: normalizeMoves(rawActor.moves, seedActor?.moves ?? []),
      responseBudget: normalizeResponseBudget(
        rawActor.responseBudget,
        typeof rawActor.responseQuotaUsed === "number" ? rawActor.responseQuotaUsed : seedActor.responseQuotaUsed,
        typeof rawActor.maxResponseQuota === "number" ? rawActor.maxResponseQuota : seedActor.maxResponseQuota,
      ),
    };
  });

  const valueRec = value as unknown as Record<string, unknown>;
  const actorIds = new Set(actors.map((actor) => actor.id));
  const storedOrder = Array.isArray(valueRec.initiativeOrder)
    ? valueRec.initiativeOrder.filter((id): id is string => typeof id === "string" && actorIds.has(id))
    : [];
  const legacyOrder = [
    ...storedOrder,
    ...actors.map((actor) => actor.id).filter((id) => !storedOrder.includes(id)),
  ];
  const legacyActedActorIds = Array.isArray(valueRec.actedActorIds)
    ? valueRec.actedActorIds.filter((id): id is string => typeof id === "string" && actorIds.has(id))
    : [];
  const runtime = normalizeRuntimeSession(valueRec.runtime, {
    sceneId: value.scene?.id ?? seed.scene.id,
    encounterMode: value.encounterMode,
    round: value.round,
    phase: value.phase,
    activeActorId: value.activeActorId,
    initiativeOrder: legacyOrder,
    actedActorIds: legacyActedActorIds,
    turnPaused: value.turnPaused,
  });
  const runtimeSequence = runtime.mode === "COMBAT"
    ? runtime.combat
    : runtime.mode === "SCENE_STRUCTURED"
      ? runtime.scene.sequence
      : undefined;
  // Authored structured scenes may deliberately include only a subset of the
  // actor registry. Never append every stored NPC during migration: doing so
  // silently inserts future enemies into a chase or negotiation sequence.
  const initiativeOrder = runtimeSequence?.initiativeOrder.filter((id) => actorIds.has(id)) ?? [];
  const actedActorIds = runtimeSequence?.actedActorIds.filter((id) => actorIds.has(id)) ?? [];
  const storedActiveActorId = typeof valueRec.activeActorId === "string" ? valueRec.activeActorId : undefined;
  const activeActorId = runtimeSequence?.activeActorId && initiativeOrder.includes(runtimeSequence.activeActorId)
    ? runtimeSequence.activeActorId
    : storedActiveActorId && (initiativeOrder.length === 0 || initiativeOrder.includes(storedActiveActorId))
      ? storedActiveActorId
      : initiativeOrder[0] ?? seed.activeActorId;
  const cleanedRuntime = runtime.mode === "SCENE_STRUCTURED" && runtime.scene.sequence
    ? {
        ...runtime,
        scene: {
          ...runtime.scene,
          sequence: {
            ...runtime.scene.sequence,
            activeActorId: initiativeOrder.includes(runtime.scene.sequence.activeActorId ?? "")
              ? runtime.scene.sequence.activeActorId
              : undefined,
            initiativeOrder,
            actedActorIds,
          },
        },
      }
    : runtime;
  const storedCampaign = value.campaign;
  const now = Date.now();
  const campaign = storedCampaign && typeof storedCampaign === "object"
    ? {
        ...seed.campaign,
        ...storedCampaign,
        packId: storedCampaign.packId || seed.campaign.packId,
        packVersion: storedCampaign.packVersion || seed.campaign.packVersion,
        currentSceneId: storedCampaign.currentSceneId || value.scene?.id || seed.scene.id,
        completedSceneIds: Array.isArray(storedCampaign.completedSceneIds) ? [...new Set(storedCampaign.completedSceneIds)] : [],
        completedEventIds: Array.isArray(storedCampaign.completedEventIds) ? [...new Set(storedCampaign.completedEventIds)] : [],
        earnedRewardIds: Array.isArray(storedCampaign.earnedRewardIds) ? [...new Set(storedCampaign.earnedRewardIds)] : [],
        partyActorIds: Array.isArray(storedCampaign.partyActorIds)
          ? [...new Set(storedCampaign.partyActorIds)].filter((id) => actorIds.has(id))
          : actors.filter((actor) => actor.side === "player").slice(0, 1).map((actor) => actor.id),
        activeActorIds: Array.isArray(storedCampaign.activeActorIds)
          ? [...new Set(storedCampaign.activeActorIds)].filter((id) => actorIds.has(id))
          : actors.map((actor) => actor.id),
        flags: storedCampaign.flags && typeof storedCampaign.flags === "object" ? { ...storedCampaign.flags } : {},
        startedAt: Number.isFinite(storedCampaign.startedAt) ? storedCampaign.startedAt : now,
        updatedAt: Number.isFinite(storedCampaign.updatedAt) ? storedCampaign.updatedAt : now,
      }
    : {
        ...seed.campaign,
        currentSceneId: value.scene?.id || seed.scene.id,
        startedAt: now,
        updatedAt: now,
      };

  return {
    ...seed,
    ...value,
    runtime: cleanedRuntime,
    campaign,
    actors,
    initiativeOrder,
    actedActorIds,
    activeActorId,
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
    lastRoute: value.lastRoute ? routeMap[value.lastRoute] ?? "home" : undefined,
    gameMode: value.gameMode ?? (value.route === "player" || value.route === "dm" ? "combat" : "scene"),
    developerMode: value.developerMode ?? false,
    autoDmEnabled: value.autoDmEnabled ?? false,
    playMode: value.playMode ?? "solo",
    soloCampaignId: value.soloCampaignId ?? seed.soloCampaignId,
    roomCode: value.roomCode ?? seed.roomCode,
    preferences: { ...seed.preferences, ...value.preferences },
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
  const normalized = dice.map((die) => {
    const rawNature = String((die as unknown as Record<string, unknown>).nature ?? "raw");
    const nature: QiDie["nature"] = rawNature === "yin" || rawNature === "yang"
      ? rawNature
      : "raw";
    return { ...seeds.get(die.id), ...die, nature };
  });
  const storedIds = new Set(normalized.map((die) => die.id));
  return [...normalized, ...seedDice.filter((die) => !storedIds.has(die.id))];
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
