import { useMemo, useState, useCallback } from "react";
import type { Actor, AppSession, CombatState, InnerArt, InventoryItem, Move, QuickAction, ResponseAttachment, ShiState, SixRoots, SixRootName, StatusEffect, TableAttrs } from "../combat/types";
import { enterScene } from "../combat/combatEngine";

/* ===================================================================
   CharacterSelect — PoE-Style Dark Atmospheric Character Selection
   Rainy night bridge-town scene, 5 horizontal slots, creator wizard
   =================================================================== */

export interface CharacterSelectProps {
  state: CombatState;
  session: AppSession;
  setSession: React.Dispatch<React.SetStateAction<AppSession>>;
  go: (route: AppSession["route"], patchSession?: Partial<AppSession>) => void;
  patch: (updater: (current: CombatState) => CombatState) => void;
}

/* -------------------------------------------------------------------
   Shared Quick Actions (same as seed)
   ------------------------------------------------------------------- */

const BX001: QuickAction = {
  id: "BX001", name: "移步", type: "出手便行", timing: "自己回合", minDice: 1,
  qiNatureThreshold: "任意", shiCondition: "无势",
  permission: "自己；合法空间", effect: "改变1档位置或取得明确站位",
  limit: "不能穿越强封锁；不能稳定脱离纠缠", resourceDestination: "已用气骰入息库",
};
const BX002: QuickAction = {
  id: "BX002", name: "整身", type: "出手便行", timing: "自己回合", minDice: 1,
  qiNatureThreshold: "任意", shiCondition: "无势",
  permission: "自己；姿态散乱、倒地、迟滞或轻破口", effect: "起身，或迟滞-1，或关闭轻破口（二选一）",
  limit: "不能清强状态", resourceDestination: "已用气骰入息库",
};
const BX004: QuickAction = {
  id: "BX004", name: "取物", type: "出手便行", timing: "自己回合", minDice: 1,
  qiNatureThreshold: "任意", shiCondition: "无势",
  permission: "可及且未被争夺的物件", effect: "取出或拾起一件可及物",
  limit: "有人争夺时改正式出手", resourceDestination: "已用气骰入息库",
};
const BX006: QuickAction = {
  id: "BX006", name: "调息", type: "出手便行", timing: "自己回合", minDice: 1,
  qiNatureThreshold: "任意", shiCondition: "无势",
  permission: "息库有可回收常规气骰", effect: "按规则从息库取回常规气骰，重掷入气海",
  limit: "只回气骰，不治疗、不清状态、不改势", resourceDestination: "息引入息库；取回气骰入气海",
};
const QUICK_ACTIONS = [BX001, BX002, BX004, BX006];

/* -------------------------------------------------------------------
   Moves available in creator
   ------------------------------------------------------------------- */

const MOVE_POOL: Move[] = [
  {
    id: "WG001", name: "破浪横刀", category: "外功", subCategory: "主攻", tier: "俗家",
    designGrade: "C", yinYangLabel: "少阳", timing: "正式出手", formPosition: "起式",
    minDice: 2, qiNatureThreshold: "至少1阳", shiCondition: "宽势",
    allowedShi: ["阴盛", "阳盛", "合势", "失势"],
    targetRange: "近身人物目标；主手刀或同类短兵", equipPermission: "主手刀",
    baseEffect: "造成气血4点",
    triggers: [
      { type: "主槽", condition: "阳值≥7", effect: "追加气血3点" },
      { type: "合值", condition: "合值≥10", effect: "目标退距1档" },
      { type: "差值/风险", condition: "阴阳差≥5", effect: "自身破口1层" },
    ],
    postShi: "阳盛", resourceDestination: "已用常规气骰入息库", hasIntercept: true, hasReact: true,
  },
  {
    id: "WG006", name: "燕回侧步", category: "外功", subCategory: "身法", tier: "俗家",
    designGrade: "C", yinYangLabel: "少阴", timing: "正式出手", formPosition: "起式",
    minDice: 2, qiNatureThreshold: "至少1阴", shiCondition: "宽势",
    allowedShi: ["阴盛", "合势", "失势", "圆融"],
    targetRange: "自己；近身或相邻距离", equipPermission: "无",
    baseEffect: "移步1档或取得遮蔽",
    triggers: [
      { type: "主槽", condition: "阴值≥7", effect: "不触发普通追身机会" },
      { type: "合值", condition: "合值≥10", effect: "关闭一条普通目标线到本动作结束" },
      { type: "差值/风险", condition: "阴阳差≥5", effect: "自身迟滞1层" },
    ],
    postShi: "阴盛", resourceDestination: "已用常规气骰入息库", hasIntercept: true, hasReact: true,
  },
  {
    id: "WG008", name: "截腕挑锋", category: "外功", subCategory: "拆招", tier: "俗家",
    designGrade: "B", yinYangLabel: "少阴", timing: "正式出手", formPosition: "转式",
    minDice: 2, qiNatureThreshold: "至少1阴", shiCondition: "宽势",
    allowedShi: ["阴盛", "合势", "失势"],
    targetRange: "近身目标；空手、短兵或副手兵器", equipPermission: "短兵",
    baseEffect: "目标本轮持械许可受扰：下一次持械招最低投入+1枚气骰",
    triggers: [
      { type: "主槽", condition: "阴值≥7", effect: "目标破口1层" },
      { type: "合值", condition: "合值≥10", effect: "目标副手许可关闭至本轮结束" },
      { type: "差值/风险", condition: "阴阳差≥5", effect: "自身破口1层" },
    ],
    postShi: "阴盛", resourceDestination: "已用常规气骰入息库", hasIntercept: true, hasReact: false,
  },
  {
    id: "FM001", name: "听痕辨路", category: "法门", subCategory: "查探", tier: "俗家",
    designGrade: "C", yinYangLabel: "少阴", timing: "正式出手", formPosition: "无",
    minDice: 2, qiNatureThreshold: "至少1阴", shiCondition: "无势",
    allowedShi: ["阴盛", "阳盛", "合势", "圆融", "崩势", "失势"],
    targetRange: "道路、房间、尸身周边或机关痕迹", equipPermission: "无",
    baseEffect: "取得1条明确痕迹；解密+1",
    triggers: [
      { type: "主槽", condition: "阴值≥7", effect: "确认痕迹方向或新旧" },
      { type: "合值", condition: "合值≥10", effect: "危机-1" },
      { type: "差值/风险", condition: "阴阳差≥5", effect: "危机+1，并记录误判线索名" },
    ],
    postShi: "不改势", resourceDestination: "已用常规气骰入息库", hasIntercept: true, hasReact: false,
  },
  {
    id: "FM002", name: "简药止血", category: "法门", subCategory: "医药", tier: "俗家",
    designGrade: "C", yinYangLabel: "少阴", timing: "正式出手", formPosition: "无",
    minDice: 1, qiNatureThreshold: "至少1阴", shiCondition: "无势",
    allowedShi: ["阴盛", "阳盛", "合势", "圆融", "崩势", "失势"],
    targetRange: "接触范围内的一个角色", equipPermission: "药箱",
    baseEffect: "清除目标1层流血；或稳定濒死角色",
    triggers: [
      { type: "合值", condition: "合值≥5", effect: "额外清除1层流血，或恢复气血2点" },
      { type: "差值/风险", condition: "阴阳差≥4", effect: "自身破口1层（分心施救）" },
    ],
    postShi: "不改势", resourceDestination: "已用气骰入息库", hasIntercept: false, hasReact: true,
  },
  {
    id: "FM003", name: "压场问话", category: "法门", subCategory: "交涉", tier: "俗家",
    designGrade: "C", yinYangLabel: "中平", timing: "正式出手", formPosition: "无",
    minDice: 1, qiNatureThreshold: "任意气性", shiCondition: "无势",
    allowedShi: ["阴盛", "阳盛", "合势", "圆融", "失势"],
    targetRange: "对话范围内的一个角色；需言语互通", equipPermission: "无",
    baseEffect: "从目标获取一条明确信息判定",
    triggers: [
      { type: "主槽", condition: "阴值≥5", effect: "探知目标的当前情绪或真实意图" },
      { type: "合值", condition: "合值≥8", effect: "目标若说谎则暴露一处矛盾；解密+1" },
      { type: "差值/风险", condition: "阴阳差≥4", effect: "自身目标线对目标开放一轮" },
    ],
    postShi: "不改势", resourceDestination: "已用气骰入息库", hasIntercept: false, hasReact: false,
  },
  {
    id: "WG_QINGLONG", name: "青龙探爪", category: "外功", subCategory: "主攻", tier: "俗家",
    designGrade: "C", yinYangLabel: "中平", timing: "正式出手", formPosition: "起式",
    minDice: 1, qiNatureThreshold: "任意气性", shiCondition: "无势",
    allowedShi: ["阴盛", "阳盛", "合势", "圆融", "失势"],
    targetRange: "单个近身目标", equipPermission: "无",
    baseEffect: "目标气血-1；自身后退一档",
    triggers: [
      { type: "主槽", condition: "阴值≥3", effect: "目标追加1层迟滞" },
      { type: "差值/风险", condition: "合值≥6", effect: "自身获得1层失衡" },
    ],
    postShi: "不改势", resourceDestination: "已用常规气骰入息库", hasIntercept: false, hasReact: false,
  },
];

/* -------------------------------------------------------------------
   Inner Arts available in creator (simplified for preview)
   ------------------------------------------------------------------- */

interface CreatorInnerArt {
  id: string;
  name: string;
  tier: InnerArt["tier"];
  occupiedAcupoints: string[];
  readRoots: string[];
  passive: string;
  attrPreview: Partial<TableAttrs>;
}

const CREATOR_INNER_ARTS: CreatorInnerArt[] = [
  {
    id: "neigong-xiao-zhoutian", name: "小周天养息功", tier: "俗家",
    occupiedAcupoints: ["丹田"], readRoots: ["顶门", "目窍", "心口", "丹田", "命门", "步根"],
    passive: "读全六根，一重。调息时可多取回1枚气骰。",
    attrPreview: { 气血: 6, 护体: 1, 爆发: 3, 回气: 4, 观照: 9, 身势: 4 },
  },
  {
    id: "neigong-yangjin", name: "阳劲入门功", tier: "俗家",
    occupiedAcupoints: ["丹田"], readRoots: ["心口", "丹田"],
    passive: "气海中阳骰点数+1（最高不超过骰阶上限）。",
    attrPreview: { 气血: 6, 护体: 0, 爆发: 7, 回气: 1, 观照: 3, 身势: 3 },
  },
  {
    id: "neigong-zhaoying", name: "照影观微诀", tier: "行家",
    occupiedAcupoints: ["目窍"], readRoots: ["顶门", "目窍", "步根"],
    passive: "查探法门投骰时阴值+1；医药法门最低投入-1。",
    attrPreview: { 气血: 3, 护体: 2, 爆发: 2, 回气: 5, 观照: 11, 身势: 5 },
  },
  {
    id: "neigong-cold-river", name: "寒江夜行功", tier: "俗家",
    occupiedAcupoints: ["步根"], readRoots: ["目窍", "步根", "丹田"],
    passive: "潜行或夜间行动时身势判定+1；隐匿法门最低投入-1。",
    attrPreview: { 气血: 4, 护体: 1, 爆发: 3, 回气: 4, 观照: 10, 身势: 7 },
  },
  {
    id: "neigong-tieyi", name: "铁衣伏虎劲", tier: "行家",
    occupiedAcupoints: ["命门"], readRoots: ["丹田", "命门", "心口"],
    passive: "护体值+2；被击中时自动消耗1枚息库骰减免1点气血损失。",
    attrPreview: { 气血: 8, 护体: 5, 爆发: 4, 回气: 2, 观照: 3, 身势: 3 },
  },
];

/* -------------------------------------------------------------------
   Identities
   ------------------------------------------------------------------- */

interface Identity {
  id: string;
  name: string;
  subtitle: string;
  icon: string;
  bonus: string;
  defaultRoots: SixRoots;
  defaultName: string;
  availableInnerArts: string[];
  availableMoves: string[];
  tagline: string;
}

const IDENTITIES: Identity[] = [
  {
    id: "bureau", name: "镖局弟子", subtitle: "镖局出身", icon: "镖",
    bonus: "气血↑", tagline: "刀快话不多",
    defaultRoots: { 顶门: 3, 目窍: 3, 心口: 5, 丹田: 5, 命门: 4, 步根: 4 },
    defaultName: "沈青",
    availableInnerArts: ["neigong-xiao-zhoutian", "neigong-yangjin", "neigong-tieyi"],
    availableMoves: ["WG001", "WG006", "FM001", "WG008"],
  },
  {
    id: "medic", name: "药堂学徒", subtitle: "药堂出身", icon: "药",
    bonus: "回气↑", tagline: "伤者不问来路",
    defaultRoots: { 顶门: 5, 目窍: 6, 心口: 3, 丹田: 4, 命门: 3, 步根: 3 },
    defaultName: "云苓",
    availableInnerArts: ["neigong-xiao-zhoutian", "neigong-zhaoying", "neigong-cold-river"],
    availableMoves: ["FM002", "FM001", "FM003", "WG_QINGLONG"],
  },
  {
    id: "spy", name: "密探线人", subtitle: "暗夜行走", icon: "影",
    bonus: "身势↑", tagline: "有些事只能在夜里办",
    defaultRoots: { 顶门: 4, 目窍: 6, 心口: 4, 丹田: 3, 命门: 4, 步根: 3 },
    defaultName: "燕七",
    availableInnerArts: ["neigong-cold-river", "neigong-zhaoying", "neigong-xiao-zhoutian"],
    availableMoves: ["WG006", "WG008", "FM001", "WG001"],
  },
  {
    id: "ranger", name: "游侠浪人", subtitle: "漂泊江湖", icon: "游",
    bonus: "观照↑", tagline: "四海为家，剑随人行",
    defaultRoots: { 顶门: 4, 目窍: 5, 心口: 4, 丹田: 4, 命门: 5, 步根: 2 },
    defaultName: "陆川",
    availableInnerArts: ["neigong-xiao-zhoutian", "neigong-yangjin", "neigong-cold-river"],
    availableMoves: ["WG001", "FM001", "WG_QINGLONG", "FM003"],
  },
];

/* -------------------------------------------------------------------
   Random Names
   ------------------------------------------------------------------- */

const SURNAMES = ["沈", "云", "燕", "陆", "柳", "萧", "裴", "苏", "顾", "叶"];
const GIVEN_NAMES = ["青", "苓", "七", "川", "峰", "霜", "明", "安", "远", "遥", "霁", "舟"];

function randomName(): string {
  const s = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
  const g = GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
  return s + g;
}

/* -------------------------------------------------------------------
   Build helpers
   ------------------------------------------------------------------- */

function buildNeigongFromCreator(ca: CreatorInnerArt): InnerArt {
  return {
    id: ca.id, name: ca.name, tier: ca.tier,
    occupiedAcupoints: ca.occupiedAcupoints as InnerArt["occupiedAcupoints"],
    readRoots: ca.readRoots as SixRootName[],
    currentLevel: 1, maxLevel: 5,
    attrContributions: [], qiGeneration: [],
    passive: ca.passive, disperseRules: "散功：失去所有气骰与属性贡献，内功等级归零。",
  };
}

function buildActor(
  name: string,
  identity: Identity,
  roots: SixRoots,
  neigong: CreatorInnerArt,
  moves: Move[],
): Actor {
  const innerArt = buildNeigongFromCreator(neigong);
  const id = "pc-custom-" + Date.now().toString(36);

  // Build equipment based on moves
  const inventory: InventoryItem[] = [];
  const hasWeaponMove = moves.some((m) => m.equipPermission.includes("刀"));
  const hasMedicineMove = moves.some((m) => m.equipPermission.includes("药箱"));

  if (hasWeaponMove) {
    inventory.push({
      id: "item-ring-saber-" + id, name: "环首刀", category: "weapon", quantity: 1, equipped: true,
      sourceId: name + "·环首刀", publicNote: "主要武器。",
    });
  } else {
    inventory.push({
      id: "item-short-knife-" + id, name: "短刀", category: "weapon", quantity: 1, equipped: true,
      sourceId: name + "·短刀", publicNote: "防身短刃。",
    });
  }

  inventory.push({
    id: "item-thick-shirt-" + id, name: "厚布上衣", category: "armor", quantity: 1, equipped: true,
    sourceId: name + "·厚布上衣", publicNote: "基础护甲。",
  });

  if (hasMedicineMove) {
    inventory.push({
      id: "item-medicine-box-" + id, name: "药箱", category: "tool", quantity: 1, equipped: true,
      sourceId: name + "·药箱", publicNote: "开启医药法门的核心器具。",
    });
  }

  inventory.push({
    id: "item-golden-ointment-" + id, name: "金疮药", category: "medicine", quantity: 2,
    sourceId: "金疮药", publicNote: "使用后可恢复气血。",
  });
  inventory.push({
    id: "item-fire-starter-" + id, name: "火折", category: "tool", quantity: 1,
    sourceId: "火折", publicNote: "可用于点燃、照明或制造烟雾。",
  });

  const equippedWeapon = hasWeaponMove ? inventory[0].id : inventory[0].id;
  const equippedArmorUpper = inventory.find((i) => i.category === "armor")?.id;

  const actor: Actor = {
    id, name, side: "player",
    sixRoots: roots,
    innerArts: [innerArt],
    tableAttrs: {
      气血: neigong.attrPreview.气血 ?? 5,
      护体: neigong.attrPreview.护体 ?? 1,
      爆发: neigong.attrPreview.爆发 ?? 3,
      回气: neigong.attrPreview.回气 ?? 4,
      观照: neigong.attrPreview.观照 ?? 6,
      身势: neigong.attrPreview.身势 ?? 4,
    },
    maxHp: (neigong.attrPreview.气血 ?? 5) * 3,
    hp: (neigong.attrPreview.气血 ?? 5) * 3,
    momentum: "合势" as ShiState,
    moves,
    responses: [],
    quickActions: QUICK_ACTIONS,
    inventory,
    equippedWeapon,
    equippedArmorUpper,
    responseQuotaUsed: 0,
    maxResponseQuota: 1,
    statuses: [] as StatusEffect[],
    publicWeakness: "初入江湖，尚需历练。",
    publicNote: "自定义创建的角色。",
  };
  return actor;
}

/* -------------------------------------------------------------------
   Six Roots helpers
   ------------------------------------------------------------------- */

const ROOT_NAMES: SixRootName[] = ["顶门", "目窍", "心口", "丹田", "命门", "步根"];
const ROOT_LABELS: Record<SixRootName, string> = {
  顶门: "顶门/头部", 目窍: "目窍", 心口: "心口", 丹田: "丹田", 命门: "命门", 步根: "步根/腿足",
};

function totalRoots(roots: SixRoots): number {
  return ROOT_NAMES.reduce((s, k) => s + roots[k], 0);
}

/* -------------------------------------------------------------------
   Main Component
   ------------------------------------------------------------------- */

export function CharacterSelect({ state, session, setSession, go, patch }: CharacterSelectProps) {
  // Packs from state (existing characters)
  const playerActors = useMemo(
    () => state.actors.filter((a) => a.side === "player"),
    [state.actors],
  );

  // Slot state
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [showCreator, setShowCreator] = useState(false);

  // Creator state
  const [creatorStep, setCreatorStep] = useState(1);
  const [creatorIdentity, setCreatorIdentity] = useState<Identity | null>(null);
  const [creatorRoots, setCreatorRoots] = useState<SixRoots>({ 顶门: 4, 目窍: 4, 心口: 4, 丹田: 4, 命门: 4, 步根: 4 });
  const [creatorNeigongId, setCreatorNeigongId] = useState<string | null>(null);
  const [creatorSelectedMoves, setCreatorSelectedMoves] = useState<string[]>([]);
  const [creatorName, setCreatorName] = useState("");

  // Total 5 slots: fill first N with existing actors, rest empty
  const filledCount = Math.min(playerActors.length, 5);
  const emptySlots = 5 - filledCount;
  const slots: Array<{ type: "actor"; actor: Actor } | { type: "empty" }> = [
    ...playerActors.slice(0, filledCount).map((a) => ({ type: "actor" as const, actor: a })),
    ...Array.from({ length: emptySlots }, () => ({ type: "empty" as const })),
  ];

  const selectedActor = selectedSlot !== null && slots[selectedSlot]?.type === "actor"
    ? (slots[selectedSlot] as { type: "actor"; actor: Actor }).actor
    : null;

  // Enter with existing character
  const handleEnterScene = useCallback((actor: Actor) => {
    setSession((c) => ({ ...c, selectedActorId: actor.id, identity: "player" }));
    go("playerScene", { identity: "player", gameMode: "scene" });
    patch((c) => enterScene(c));
  }, [setSession, go, patch]);

  // Finalize creation
  const handleCreateConfirm = useCallback(() => {
    if (!creatorIdentity || !creatorNeigongId) return;
    const neigong = CREATOR_INNER_ARTS.find((n) => n.id === creatorNeigongId);
    if (!neigong) return;
    const moves = MOVE_POOL.filter((m) => creatorSelectedMoves.includes(m.id));
    const name = creatorName.trim() || creatorIdentity.defaultName;
    const actor = buildActor(name, creatorIdentity, creatorRoots, neigong, moves);

    patch((c) => {
      const withActor = { ...c, actors: [...c.actors, actor] };
      return enterScene(withActor);
    });
    setSession((c) => ({ ...c, selectedActorId: actor.id, identity: "player" }));
    go("playerScene", { identity: "player", gameMode: "scene" });
  }, [creatorIdentity, creatorNeigongId, creatorSelectedMoves, creatorRoots, creatorName, patch, setSession, go]);

  // Creator helpers
  const handleOpenCreator = useCallback((slotIndex: number) => {
    setSelectedSlot(slotIndex);
    setShowCreator(true);
    setCreatorStep(1);
    setCreatorIdentity(null);
    setCreatorNeigongId(null);
    setCreatorSelectedMoves([]);
    setCreatorName("");
  }, []);

  const handleCloseCreator = useCallback(() => {
    setShowCreator(false);
    setSelectedSlot(null);
  }, []);

  const handleSelectIdentity = useCallback((identity: Identity) => {
    setCreatorIdentity(identity);
    setCreatorRoots({ ...identity.defaultRoots });
    setCreatorName(identity.defaultName);
    setCreatorStep(2);
  }, []);

  const handleRootChange = useCallback((root: SixRootName, delta: number) => {
    setCreatorRoots((prev) => {
      const current = prev[root];
      const proposal = current + delta;
      if (proposal < 1 || proposal > 6) return prev;
      const othersSum = ROOT_NAMES.filter((r) => r !== root).reduce((s, r) => s + prev[r], 0);
      if (othersSum + proposal > 24) return prev;
      return { ...prev, [root]: proposal };
    });
  }, []);

  // Creator nav
  const canAdvanceStep = (step: number): boolean => {
    switch (step) {
      case 1: return creatorIdentity !== null;
      case 2: return totalRoots(creatorRoots) === 24;
      case 3: return creatorNeigongId !== null;
      case 4: return creatorSelectedMoves.length >= 2 && creatorSelectedMoves.length <= 3;
      case 5: return true;
      default: return false;
    }
  };

  // Render creator overlay if active
  if (showCreator) {
    return (
      <section className="cs-root">
        <CreatorWizard
          step={creatorStep}
          identity={creatorIdentity}
          roots={creatorRoots}
          neigongId={creatorNeigongId}
          selectedMoves={creatorSelectedMoves}
          name={creatorName}
          onSelectIdentity={handleSelectIdentity}
          onRootChange={handleRootChange}
          onSelectNeigong={setCreatorNeigongId}
          onToggleMove={(id) => setCreatorSelectedMoves((prev) =>
            prev.includes(id) ? prev.filter((m) => m !== id) : prev.length < 3 ? [...prev, id] : prev
          )}
          onNameChange={setCreatorName}
          onNext={() => canAdvanceStep(creatorStep) && setCreatorStep((s) => Math.min(s + 1, 5))}
          onPrev={() => setCreatorStep((s) => Math.max(s - 1, 1))}
          onConfirm={handleCreateConfirm}
          onClose={handleCloseCreator}
          canAdvance={canAdvanceStep(creatorStep)}
        />
        <style>{csStyles}</style>
      </section>
    );
  }

  // Main select screen
  return (
    <section className="cs-root">
      {/* ART SLOT: home-bg — 1920×1080 桥陵镇雨夜全景，水墨风格，画面下半部留暗 */}
      <div className="cs-background" />

      {/* Ambient overlay */}
      <div className="cs-ambient">
        <div className="cs-rain-overlay" />
        <div className="cs-fog-overlay" />
      </div>

      {/* Scene title */}
      <div className="cs-scene-title">
        <h1 className="cs-title-text">桥陵镇 · 雨夜</h1>
        <p className="cs-subtitle-text">一桩失镖案。你为何而来？</p>
      </div>

      {/* Character slots row */}
      <div className="cs-slots-row">
        {slots.map((slot, i) => {
          if (slot.type === "actor") {
            const actor = slot.actor;
            const isSelected = selectedSlot === i;
            const neigong = actor.innerArts[0];
            return (
              <button
                key={actor.id}
                className={`cs-slot cs-slot--filled ${isSelected ? "cs-slot--selected" : ""}`}
                type="button"
                onClick={() => setSelectedSlot(isSelected ? null : i)}
              >
                {/* ART SLOT: portrait-{name} — 140×200px 角色立绘，半身，面向镜头 */}
                <div className="cs-portrait">
                  <span className="cs-portrait-placeholder">
                    {actor.name.charAt(0)}
                  </span>
                </div>
                <div className="cs-slot-info">
                  <span className="cs-slot-name">{actor.name}</span>
                  <span className="cs-slot-identity">{neigong?.name ?? "未运转内功"}</span>
                  <div className="cs-slot-hp-mini">
                    <div className="cs-slot-hp-track">
                      <div
                        className="cs-slot-hp-fill"
                        style={{ width: `${Math.max(0, (actor.hp / actor.maxHp) * 100)}%` }}
                      />
                    </div>
                    <span className="cs-slot-hp-text">{actor.hp}/{actor.maxHp}</span>
                  </div>
                </div>
              </button>
            );
          }
          return (
            <button
              key={`empty-${i}`}
              className="cs-slot cs-slot--empty"
              type="button"
              onClick={() => handleOpenCreator(i)}
            >
              <div className="cs-portrait cs-portrait--empty">
                <span className="cs-empty-icon">+</span>
              </div>
              <div className="cs-slot-info">
                <span className="cs-slot-name cs-empty-text">创建新角色</span>
                <span className="cs-slot-identity">自定义开卡</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom info panel */}
      <div className={`cs-info-panel ${selectedActor ? "cs-info-panel--visible" : ""}`}>
        {selectedActor && (() => {
          const actor = selectedActor;
          const neigong = actor.innerArts[0];
          const rootsStr = ROOT_NAMES.map((r) => `${r}${actor.sixRoots[r]}`).join(" ");
          const movesStr = actor.moves.slice(0, 3).map((m) => m.name).join(" · ");
          const equipStr = actor.inventory
            .filter((item) => item.equipped || item.category === "medicine")
            .slice(0, 3)
            .map((item) => `${item.name}${item.quantity > 1 ? `×${item.quantity}` : ""}`)
            .join(" · ");
          return (
            <div className="cs-info-content">
              <div className="cs-info-left">
                <div className="cs-info-header">
                  <span className="cs-info-name">{actor.name}</span>
                  <span className="cs-info-dot">·</span>
                  <span className="cs-info-identity">{neigong?.tier ?? ""}·{neigong?.occupiedAcupoints?.join("") ?? ""}</span>
                  <span className="cs-info-tagline">"{actor.publicNote.slice(0, 16)}"</span>
                </div>
                <div className="cs-info-roots">{rootsStr}</div>
              </div>
              <div className="cs-info-center">
                <span className="cs-info-label">内功</span>
                <span className="cs-info-value">{neigong?.name ?? "无"}</span>
                <span className="cs-info-label">武艺</span>
                <span className="cs-info-value">{movesStr}</span>
              </div>
              <div className="cs-info-right">
                <span className="cs-info-equip">{equipStr}</span>
                <button
                  className="cs-enter-btn"
                  type="button"
                  onClick={() => handleEnterScene(actor)}
                >
                  踏入江湖
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      <style>{csStyles}</style>
    </section>
  );
}

/* -------------------------------------------------------------------
   Creator Wizard
   ------------------------------------------------------------------- */

interface CreatorWizardProps {
  step: number;
  identity: Identity | null;
  roots: SixRoots;
  neigongId: string | null;
  selectedMoves: string[];
  name: string;
  onSelectIdentity: (id: Identity) => void;
  onRootChange: (root: SixRootName, delta: number) => void;
  onSelectNeigong: (id: string) => void;
  onToggleMove: (id: string) => void;
  onNameChange: (name: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onConfirm: () => void;
  onClose: () => void;
  canAdvance: boolean;
}

function CreatorWizard({
  step, identity, roots, neigongId, selectedMoves, name,
  onSelectIdentity, onRootChange, onSelectNeigong, onToggleMove,
  onNameChange, onNext, onPrev, onConfirm, onClose, canAdvance,
}: CreatorWizardProps) {
  return (
    <div className="cs-creator-overlay">
      <div className="cs-creator-bg" />
      {/* ART SLOT: creator-bg — 1920×1080 桥陵镇雨夜茶棚内景，暖灯，窗外雨幕 */}
      <div className="cs-creator-card">
        {/* Header */}
        <div className="cs-creator-header">
          <button className="cs-creator-close" type="button" onClick={onClose}>×</button>
          <h2 className="cs-creator-title">创建新角色</h2>
          <div className="cs-step-breadcrumb">
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s} className={`cs-step-dot ${s === step ? "cs-step-dot--active" : ""} ${s < step ? "cs-step-dot--done" : ""}`}>
                {s < step ? "✓" : s}
              </span>
            ))}
          </div>
          <span className="cs-step-label">步 {step}/5</span>
        </div>

        {/* Step content */}
        <div className="cs-creator-body">
          {step === 1 && <Step1Identity onSelect={onSelectIdentity} />}
          {step === 2 && <Step2Roots roots={roots} onRootChange={onRootChange} />}
          {step === 3 && identity && (
            <Step3Neigong
              identity={identity}
              selectedId={neigongId}
              onSelect={onSelectNeigong}
            />
          )}
          {step === 4 && identity && (
            <Step4Moves
              identity={identity}
              selectedMoves={selectedMoves}
              onToggle={onToggleMove}
            />
          )}
          {step === 5 && identity && neigongId && (
            <Step5Confirm
              identity={identity}
              roots={roots}
              neigong={CREATOR_INNER_ARTS.find((n) => n.id === neigongId)!}
              moves={MOVE_POOL.filter((m) => selectedMoves.includes(m.id))}
              name={name}
              onNameChange={onNameChange}
            />
          )}
        </div>

        {/* Footer */}
        <div className="cs-creator-footer">
          {step > 1 && (
            <button className="cs-creator-btn cs-creator-btn--back" type="button" onClick={onPrev}>
              上一步
            </button>
          )}
          <div className="cs-creator-footer-spacer" />
          {step < 5 ? (
            <button
              className="cs-creator-btn cs-creator-btn--next"
              type="button"
              disabled={!canAdvance}
              onClick={onNext}
            >
              下一步
            </button>
          ) : (
            <button
              className="cs-creator-btn cs-creator-btn--confirm"
              type="button"
              disabled={!name.trim()}
              onClick={onConfirm}
            >
              踏入江湖
            </button>
          )}
        </div>
      </div>
      <style>{csStyles}</style>
    </div>
  );
}

/* -------------------------------------------------------------------
   Step 1: Select Identity
   ------------------------------------------------------------------- */

function Step1Identity({ onSelect }: { onSelect: (id: Identity) => void }) {
  return (
    <div className="cs-step-content">
      <h3 className="cs-step-heading">选择你的出身</h3>
      <p className="cs-step-desc">出身决定初始六根倾向和可选内功。后续步骤可自由调整。</p>
      <div className="cs-identity-grid">
        {IDENTITIES.map((idn) => (
          <button
            key={idn.id}
            className="cs-identity-card"
            type="button"
            onClick={() => onSelect(idn)}
          >
            {/* ART SLOT: identity-{name} — 120×80px 身份概念图，水墨剪影 */}
            <div className="cs-identity-icon">{idn.icon}</div>
            <div className="cs-identity-name">{idn.name}</div>
            <div className="cs-identity-subtitle">{idn.subtitle}</div>
            <div className="cs-identity-bonus">{idn.bonus}</div>
            <div className="cs-identity-tagline">"{idn.tagline}"</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------
   Step 2: Allocate Six Roots
   ------------------------------------------------------------------- */

function Step2Roots({ roots, onRootChange }: {
  roots: SixRoots;
  onRootChange: (root: SixRootName, delta: number) => void;
}) {
  const remaining = 24 - totalRoots(roots);
  return (
    <div className="cs-step-content">
      <h3 className="cs-step-heading">分配六根</h3>
      <p className={`cs-step-desc ${remaining !== 0 ? "cs-step-desc--warn" : ""}`}>
        剩余点数：{remaining} 点（合计必须为24）
      </p>
      <div className="cs-radar-container">
        {/* Hexagon background */}
        <svg className="cs-radar-svg" viewBox="0 0 440 340" aria-label="六根雷达图">
          {/* Reference hexagon grid */}
          {[1, 2, 3, 4, 5, 6].map((level) => {
            const r = 20 + level * 18;
            const pts = hexPoints(220, 170, r);
            return (
              <polygon
                key={level}
                points={pts}
                fill="none"
                stroke="rgba(107,75,45,0.2)"
                strokeWidth="1"
              />
            );
          })}
          {/* Data polygon */}
          <polygon
            points={hexDataPoints(220, 170, roots)}
            fill="rgba(212,132,58,0.15)"
            stroke="rgba(212,132,58,0.6)"
            strokeWidth="2"
          />
          {/* Vertex dots */}
          {ROOT_NAMES.map((root, i) => {
            const pos = hexVertexPos(220, 170, i, 20 + roots[root] * 18);
            return (
              <circle
                key={root}
                cx={pos.x}
                cy={pos.y}
                r="6"
                fill="#d4843a"
                stroke="#2a2218"
                strokeWidth="2"
              />
            );
          })}
          {/* Labels */}
          {ROOT_NAMES.map((root, i) => {
            const labelPos = hexVertexPos(220, 170, i, 150);
            return (
              <text
                key={root}
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#8a7a6a"
                fontSize="13"
                fontWeight="700"
              >
                {root}
              </text>
            );
          })}
        </svg>
      </div>
      {/* Root adjusters */}
      <div className="cs-roots-adjusters">
        {ROOT_NAMES.map((root) => (
          <div key={root} className="cs-root-adjuster">
            <span className="cs-root-adjuster-label">{ROOT_LABELS[root]}</span>
            <button
              className="cs-root-btn"
              type="button"
              disabled={roots[root] <= 1}
              onClick={() => onRootChange(root, -1)}
            >−</button>
            <span className="cs-root-adjuster-value">{roots[root]}</span>
            <button
              className="cs-root-btn"
              type="button"
              disabled={roots[root] >= 6 || totalRoots(roots) >= 24}
              onClick={() => onRootChange(root, +1)}
            >+</button>
          </div>
        ))}
      </div>
      <p className="cs-step-desc cs-step-desc--hint">
        推荐分布：6/5/4/4/3/2 — 有一项强根，一项副强根，不平均
      </p>
    </div>
  );
}

function hexVertexPos(cx: number, cy: number, index: number, r: number): { x: number; y: number } {
  // Arrange from top, clockwise: 顶门, 目窍, 心口, 步根, 丹田, 命门
  const angles = [-90, -30, 30, 90, 150, 210]; // degrees from top, clockwise
  const rad = (angles[index] * Math.PI) / 180;
  return {
    x: Math.round(cx + r * Math.cos(rad)),
    y: Math.round(cy + r * Math.sin(rad)),
  };
}

function hexPoints(cx: number, cy: number, r: number): string {
  return ROOT_NAMES.map((_, i) => {
    const p = hexVertexPos(cx, cy, i, r);
    return `${p.x},${p.y}`;
  }).join(" ");
}

function hexDataPoints(cx: number, cy: number, roots: SixRoots): string {
  return ROOT_NAMES.map((root, i) => {
    const r = 20 + roots[root] * 18;
    const p = hexVertexPos(cx, cy, i, r);
    return `${p.x},${p.y}`;
  }).join(" ");
}

/* -------------------------------------------------------------------
   Step 3: Select Inner Art
   ------------------------------------------------------------------- */

function Step3Neigong({ identity, selectedId, onSelect }: {
  identity: Identity;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const arts = CREATOR_INNER_ARTS.filter((a) => identity.availableInnerArts.includes(a.id));
  return (
    <div className="cs-step-content">
      <h3 className="cs-step-heading">选择初始内功</h3>
      <p className="cs-step-desc">内功是最重要的构筑选择。新手建议选读根少、占窍少的内功。</p>
      <div className="cs-neigong-grid">
        {arts.map((art) => {
          const isSelected = selectedId === art.id;
          return (
            <button
              key={art.id}
              className={`cs-neigong-card ${isSelected ? "cs-neigong-card--selected" : ""}`}
              type="button"
              onClick={() => onSelect(art.id)}
            >
              <div className="cs-neigong-name">{art.name}</div>
              <div className="cs-neigong-meta">
                <span>{art.tier}</span>
                <span>·</span>
                <span>占{art.occupiedAcupoints.join("、")}</span>
              </div>
              <div className="cs-neigong-roots">读：{art.readRoots.join("、")}</div>
              <div className="cs-neigong-passive">{art.passive}</div>
              <div className="cs-neigong-preview">
                <span>气血{art.attrPreview.气血}</span>
                <span>护{art.attrPreview.护体}</span>
                <span>爆{art.attrPreview.爆发}</span>
                <span>回{art.attrPreview.回气}</span>
                <span>观{art.attrPreview.观照}</span>
                <span>身{art.attrPreview.身势}</span>
              </div>
              {art.tier === "俗家" && art.occupiedAcupoints.length <= 1 && (
                <div className="cs-neigong-recommend">入门推荐</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------
   Step 4: Select Moves
   ------------------------------------------------------------------- */

function Step4Moves({ identity, selectedMoves, onToggle }: {
  identity: Identity;
  selectedMoves: string[];
  onToggle: (id: string) => void;
}) {
  const moves = MOVE_POOL.filter((m) => identity.availableMoves.includes(m.id));
  return (
    <div className="cs-step-content">
      <h3 className="cs-step-heading">选择初始武艺</h3>
      <p className="cs-step-desc">
        选择 2-3 条武艺。建议至少1条常用外功 + 1条法门。
        已选：{selectedMoves.length}/3
      </p>
      <div className="cs-moves-grid">
        {moves.map((move) => {
          const isSelected = selectedMoves.includes(move.id);
          const atLimit = selectedMoves.length >= 3 && !isSelected;
          return (
            <button
              key={move.id}
              className={`cs-move-card ${isSelected ? "cs-move-card--selected" : ""} ${atLimit ? "cs-move-card--disabled" : ""}`}
              type="button"
              disabled={atLimit}
              onClick={() => onToggle(move.id)}
            >
              <div className="cs-move-name">{move.name}</div>
              <div className="cs-move-meta">
                <span>{move.category}·{move.subCategory || move.formPosition}</span>
                <span>{move.yinYangLabel}</span>
              </div>
              <div className="cs-move-effect">{move.baseEffect}</div>
              {move.equipPermission && move.equipPermission !== "无" && (
                <div className="cs-move-equip">需要：{move.equipPermission}</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------
   Step 5: Confirm
   ------------------------------------------------------------------- */

function Step5Confirm({ identity, roots, neigong, moves, name, onNameChange }: {
  identity: Identity;
  roots: SixRoots;
  neigong: CreatorInnerArt;
  moves: Move[];
  name: string;
  onNameChange: (n: string) => void;
}) {
  const rootsStr = ROOT_NAMES.map((r) => `${r}${roots[r]}`).join(" · ");
  const movesStr = moves.map((m) => m.name).join(" · ");
  return (
    <div className="cs-step-content">
      <h3 className="cs-step-heading">确认角色</h3>
      <div className="cs-confirm-card">
        {/* ART SLOT: portrait-final — 140×200px 角色立绘预览 */}
        <div className="cs-confirm-portrait">
          <span className="cs-confirm-portrait-icon">{identity.icon}</span>
        </div>
        <div className="cs-confirm-details">
          <input
            className="cs-confirm-name-input"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="输入江湖名号"
            maxLength={12}
          />
          <div className="cs-confirm-line">
            <span className="cs-confirm-label">出身</span>
            <span>{identity.name} · {identity.subtitle}</span>
          </div>
          <div className="cs-confirm-line">
            <span className="cs-confirm-label">六根</span>
            <span>{rootsStr}</span>
          </div>
          <div className="cs-confirm-line">
            <span className="cs-confirm-label">内功</span>
            <span>{neigong.name}（{neigong.tier}·占{neigong.occupiedAcupoints.join("、")}）</span>
          </div>
          <div className="cs-confirm-line">
            <span className="cs-confirm-label">武艺</span>
            <span>{movesStr || "未选"}</span>
          </div>
          <div className="cs-confirm-line">
            <span className="cs-confirm-label">表属性</span>
            <span>
              气血{neigong.attrPreview.气血} 护{neigong.attrPreview.护体} 爆{neigong.attrPreview.爆发}{" "}
              回{neigong.attrPreview.回气} 观{neigong.attrPreview.观照} 身{neigong.attrPreview.身势}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   CSS Styles (scoped via .cs-root)
   =================================================================== */

const csStyles = `
/* ---- Root container ---- */
.cs-root {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  min-height: 0;
}

/* ---- Background (rainy night bridge) ---- */
.cs-background {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    /* moon/ambient light */
    radial-gradient(ellipse at 50% 15%, rgba(180,200,220,0.07), transparent 50%),
    /* distant bridge silhouette */
    radial-gradient(ellipse at 50% 35%, rgba(40,35,28,0.4), transparent 45%),
    /* rain streaks */
    repeating-linear-gradient(
      5deg,
      transparent,
      transparent 2px,
      rgba(180,195,210,0.03) 2px,
      rgba(180,195,210,0.03) 3px
    ),
    /* dark night gradient */
    linear-gradient(180deg,
      #0d1117 0%,
      #121a22 15%,
      #1a2230 30%,
      #1a1f28 50%,
      #141a20 70%,
      #0d1115 100%
    );
}

/* ---- Ambient overlays ---- */
.cs-ambient {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.cs-rain-overlay {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      170deg,
      transparent,
      transparent 3px,
      rgba(200,210,225,0.015) 3px,
      rgba(200,210,225,0.015) 4px
    );
  animation: csRainFall 0.8s linear infinite;
}
@keyframes csRainFall {
  0% { background-position: 0 0; }
  100% { background-position: 0 16px; }
}
.cs-fog-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
  background: linear-gradient(0deg, rgba(20,26,32,0.7), transparent);
}

/* ---- Scene title ---- */
.cs-scene-title {
  position: relative;
  z-index: 2;
  text-align: center;
  margin-bottom: 32px;
}
.cs-title-text {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #c8bfb0;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 12px rgba(0,0,0,0.7), 0 0 40px rgba(180,160,130,0.15);
}
.cs-subtitle-text {
  margin: 6px 0 0;
  font-size: 14px;
  color: #6a6058;
  font-style: italic;
  letter-spacing: 0.04em;
}

/* ---- Slots row ---- */
.cs-slots-row {
  position: relative;
  z-index: 2;
  display: flex;
  gap: 24px;
  justify-content: center;
  align-items: flex-end;
  margin-bottom: 0;
}

/* ---- Slot ---- */
.cs-slot {
  width: 180px;
  min-height: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: 2px solid rgba(107,75,45,0.2);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(26,20,16,0.6), rgba(15,12,8,0.8));
  cursor: pointer;
  transition: transform 250ms ease, box-shadow 250ms ease, border-color 250ms ease;
  overflow: hidden;
  font: inherit;
  color: inherit;
  text-align: center;
}
.cs-slot:hover {
  transform: translateY(-4px);
  border-color: rgba(197,173,138,0.4);
  box-shadow: 0 8px 30px rgba(0,0,0,0.5);
}
.cs-slot--selected {
  transform: translateY(-8px) scale(1.04);
  border-color: rgba(212,132,58,0.7);
  box-shadow:
    0 0 30px rgba(212,132,58,0.35),
    0 0 60px rgba(212,132,58,0.12),
    0 8px 32px rgba(0,0,0,0.5);
  background: linear-gradient(180deg, rgba(42,30,18,0.8), rgba(20,14,8,0.9));
}
.cs-slot--empty {
  opacity: 0.45;
  border-style: dashed;
}
.cs-slot--empty:hover {
  opacity: 0.7;
  border-color: rgba(197,173,138,0.5);
}

/* ---- Portrait ---- */
.cs-portrait {
  width: 140px;
  height: 200px;
  flex-shrink: 0;
  margin-top: 8px;
  border-radius: 6px;
  background:
    radial-gradient(ellipse at 50% 30%, rgba(212,200,184,0.06), transparent 55%),
    linear-gradient(180deg, #2a2218, #1a1410);
  border: 1px solid rgba(107,75,45,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cs-portrait-placeholder {
  font-size: 52px;
  font-weight: 700;
  color: rgba(212,200,184,0.15);
  text-shadow: 0 3px 10px rgba(0,0,0,0.5);
  font-family: "Cinzel", "EB Garamond", "Noto Serif SC", serif;
}
.cs-portrait--empty {
  background: rgba(26,20,16,0.5);
  border: 1px dashed rgba(107,75,45,0.25);
}
.cs-empty-icon {
  font-size: 40px;
  font-weight: 300;
  color: rgba(212,200,184,0.12);
}

/* ---- Slot info ---- */
.cs-slot-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0 12px 14px;
  width: 100%;
}
.cs-slot-name {
  font-size: 16px;
  font-weight: 700;
  color: #c5ad8a;
  letter-spacing: 0.04em;
}
.cs-slot-identity {
  font-size: 11px;
  color: #6a6058;
}
.cs-empty-text {
  color: #4a4238;
  font-size: 13px;
}
.cs-slot-hp-mini {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin-top: 4px;
}
.cs-slot-hp-track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}
.cs-slot-hp-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #c23a2e, #e05040);
  transition: width 500ms ease;
}
.cs-slot-hp-text {
  font-size: 10px;
  color: #6a6058;
  font-weight: 600;
}

/* ---- Info Panel ---- */
.cs-info-panel {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 960px;
  margin-top: 20px;
  height: 0;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(26,20,16,0.92), rgba(15,12,8,0.95));
  border-top: 1px solid rgba(107,75,45,0.3);
  transition: height 350ms cubic-bezier(0.22,0.61,0.36,1);
}
.cs-info-panel--visible {
  height: 120px;
}
.cs-info-content {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 120px;
  padding: 16px 32px;
}
.cs-info-left {
  flex: 2;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cs-info-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.cs-info-name {
  font-size: 20px;
  font-weight: 700;
  color: #d4c8b8;
  letter-spacing: 0.04em;
}
.cs-info-dot {
  color: #5a5044;
}
.cs-info-identity {
  font-size: 13px;
  color: #8a7a6a;
}
.cs-info-tagline {
  font-size: 12px;
  color: #5a5044;
  font-style: italic;
}
.cs-info-roots {
  font-size: 13px;
  color: #a09488;
  font-weight: 600;
  letter-spacing: 0.03em;
}
.cs-info-center {
  flex: 2;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 8px;
  font-size: 12px;
}
.cs-info-label {
  color: #5a5044;
  font-weight: 600;
}
.cs-info-value {
  color: #a09488;
}
.cs-info-right {
  flex: 2;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.cs-info-equip {
  font-size: 12px;
  color: #5a5044;
}
.cs-enter-btn {
  min-height: 44px;
  padding: 0 32px;
  border: 1px solid #8b5e36;
  border-radius: 6px;
  background: linear-gradient(180deg, #7b4f2c, #5c3a1e);
  color: #fff9ee;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: transform 200ms ease, box-shadow 200ms ease;
  font-family: inherit;
  text-shadow: 0 1px 2px rgba(0,0,0,0.3);
}
.cs-enter-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(212,132,58,0.4);
  background: linear-gradient(180deg, #8b5e36, #7b4f2c);
}

/* ================================================================
   Creator Overlay
   ================================================================ */
.cs-creator-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.cs-creator-bg {
  position: absolute;
  inset: 0;
  background: rgba(8,6,4,0.85);
  backdrop-filter: blur(6px);
}
.cs-creator-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 820px;
  min-height: 520px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(107,75,45,0.35);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(42,34,24,0.97), rgba(26,20,16,0.98));
  box-shadow:
    0 0 60px rgba(0,0,0,0.6),
    0 20px 80px rgba(0,0,0,0.5);
  overflow: hidden;
  animation: csCardAppear 300ms ease;
}
@keyframes csCardAppear {
  0% { opacity: 0; transform: translateY(20px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

/* Creator header */
.cs-creator-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(107,75,45,0.2);
  flex-shrink: 0;
}
.cs-creator-close {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(107,75,45,0.3);
  border-radius: 50%;
  background: transparent;
  color: #5a5044;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 150ms ease, border-color 150ms ease;
  font-family: inherit;
  line-height: 1;
}
.cs-creator-close:hover {
  color: #8a7a6a;
  border-color: rgba(197,173,138,0.5);
}
.cs-creator-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #c5ad8a;
  letter-spacing: 0.04em;
}
.cs-step-breadcrumb {
  display: flex;
  gap: 8px;
  margin-left: auto;
}
.cs-step-dot {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid rgba(107,75,45,0.3);
  color: #5a5044;
  transition: all 200ms ease;
}
.cs-step-dot--active {
  border-color: rgba(212,132,58,0.7);
  background: rgba(212,132,58,0.15);
  color: #d4843a;
  box-shadow: 0 0 10px rgba(212,132,58,0.2);
}
.cs-step-dot--done {
  border-color: rgba(74,122,92,0.4);
  background: rgba(74,122,92,0.1);
  color: #5cbf7a;
}
.cs-step-label {
  font-size: 12px;
  color: #5a5044;
  font-weight: 600;
}

/* Creator body */
.cs-creator-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

/* Creator footer */
.cs-creator-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  border-top: 1px solid rgba(107,75,45,0.2);
  flex-shrink: 0;
}
.cs-creator-footer-spacer {
  flex: 1;
}
.cs-creator-btn {
  min-height: 40px;
  padding: 0 24px;
  border-radius: 6px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: transform 200ms ease, box-shadow 200ms ease;
  font-family: inherit;
}
.cs-creator-btn:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}
.cs-creator-btn--next {
  border: 1px solid rgba(197,173,138,0.5);
  background: linear-gradient(180deg, #5c3a1e, #3a2210);
  color: #fff9ee;
}
.cs-creator-btn--next:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(212,132,58,0.3);
}
.cs-creator-btn--back {
  border: 1px solid rgba(107,75,45,0.25);
  background: transparent;
  color: #5a5044;
}
.cs-creator-btn--back:hover {
  color: #8a7a6a;
  border-color: rgba(197,173,138,0.4);
}
.cs-creator-btn--confirm {
  border: 1px solid #8b5e36;
  background: linear-gradient(180deg, #7b4f2c, #5c3a1e);
  color: #fff9ee;
}
.cs-creator-btn--confirm:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(212,132,58,0.4);
}

/* Step content */
.cs-step-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cs-step-heading {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #d4c8b8;
  text-align: center;
}
.cs-step-desc {
  margin: 0;
  font-size: 13px;
  color: #6a6058;
  text-align: center;
  font-style: italic;
}
.cs-step-desc--warn {
  color: #d4843a;
  font-weight: 600;
}
.cs-step-desc--hint {
  font-size: 12px;
  color: #4a4238;
}

/* ---- Identity grid ---- */
.cs-identity-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.cs-identity-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 12px;
  border: 1px solid rgba(107,75,45,0.25);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(42,34,24,0.7), rgba(26,20,16,0.7));
  cursor: pointer;
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
  font: inherit;
  color: inherit;
  text-align: center;
}
.cs-identity-card:hover {
  transform: translateY(-3px);
  border-color: rgba(197,173,138,0.5);
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
}
.cs-identity-icon {
  font-size: 36px;
  font-weight: 700;
  color: rgba(212,200,184,0.12);
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(107,75,45,0.15);
  border-radius: 8px;
  background: rgba(26,20,16,0.5);
  font-family: "Cinzel", "Noto Serif SC", serif;
}
.cs-identity-name {
  font-size: 16px;
  font-weight: 700;
  color: #c5ad8a;
}
.cs-identity-subtitle {
  font-size: 12px;
  color: #6a6058;
}
.cs-identity-bonus {
  font-size: 12px;
  font-weight: 700;
  color: #d4843a;
  padding: 2px 10px;
  border: 1px solid rgba(212,132,58,0.25);
  border-radius: 10px;
  background: rgba(212,132,58,0.08);
}
.cs-identity-tagline {
  font-size: 11px;
  color: #4a4238;
  font-style: italic;
}

/* ---- Radar chart ---- */
.cs-radar-container {
  display: flex;
  justify-content: center;
  padding: 10px 0;
}
.cs-radar-svg {
  width: 100%;
  max-width: 440px;
  height: auto;
}

/* ---- Root adjusters ---- */
.cs-roots-adjusters {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  max-width: 500px;
  margin: 0 auto;
  width: 100%;
}
.cs-root-adjuster {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(107,75,45,0.2);
  border-radius: 6px;
  background: rgba(42,34,24,0.5);
}
.cs-root-adjuster-label {
  font-size: 12px;
  color: #6a6058;
  font-weight: 600;
  min-width: 60px;
}
.cs-root-btn {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(107,75,45,0.3);
  border-radius: 4px;
  background: rgba(42,34,24,0.6);
  color: #8a7a6a;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 150ms ease, color 150ms ease;
  font-family: inherit;
  line-height: 1;
}
.cs-root-btn:hover:not(:disabled) {
  border-color: rgba(212,132,58,0.5);
  color: #c5ad8a;
}
.cs-root-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.cs-root-adjuster-value {
  font-size: 18px;
  font-weight: 700;
  color: #d4c8b8;
  min-width: 24px;
  text-align: center;
}

/* ---- Neigong cards ---- */
.cs-neigong-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
.cs-neigong-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  border: 1px solid rgba(107,75,45,0.25);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(42,34,24,0.7), rgba(26,20,16,0.7));
  cursor: pointer;
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
  text-align: left;
  font: inherit;
  color: inherit;
  position: relative;
}
.cs-neigong-card:hover {
  transform: translateY(-2px);
  border-color: rgba(197,173,138,0.5);
  box-shadow: 0 4px 18px rgba(0,0,0,0.4);
}
.cs-neigong-card--selected {
  border-color: rgba(212,132,58,0.7);
  box-shadow: 0 0 0 2px rgba(212,132,58,0.25), 0 4px 20px rgba(0,0,0,0.4);
  background: linear-gradient(180deg, rgba(60,44,24,0.8), rgba(36,26,14,0.8));
}
.cs-neigong-name {
  font-size: 16px;
  font-weight: 700;
  color: #c5ad8a;
}
.cs-neigong-meta {
  font-size: 11px;
  color: #6a6058;
  display: flex;
  gap: 4px;
}
.cs-neigong-roots {
  font-size: 11px;
  color: #5a5044;
}
.cs-neigong-passive {
  font-size: 12px;
  color: #8a7a6a;
  line-height: 1.5;
}
.cs-neigong-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 11px;
  color: #a09488;
  font-weight: 600;
}
.cs-neigong-recommend {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 10px;
  font-weight: 700;
  color: #5cbf7a;
  padding: 2px 8px;
  border: 1px solid rgba(74,122,92,0.3);
  border-radius: 10px;
  background: rgba(74,122,92,0.1);
}

/* ---- Moves grid ---- */
.cs-moves-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.cs-move-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  border: 1px solid rgba(107,75,45,0.25);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(42,34,24,0.7), rgba(26,20,16,0.7));
  cursor: pointer;
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
  text-align: left;
  font: inherit;
  color: inherit;
}
.cs-move-card:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: rgba(197,173,138,0.5);
}
.cs-move-card--selected {
  border-color: rgba(212,132,58,0.7);
  box-shadow: 0 0 0 2px rgba(212,132,58,0.2), 0 4px 16px rgba(0,0,0,0.3);
  background: linear-gradient(180deg, rgba(60,44,24,0.7), rgba(36,26,14,0.7));
}
.cs-move-card--disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.cs-move-name {
  font-size: 14px;
  font-weight: 700;
  color: #c5ad8a;
}
.cs-move-meta {
  display: flex;
  gap: 6px;
  font-size: 11px;
  color: #5a5044;
}
.cs-move-effect {
  font-size: 12px;
  color: #8a7a6a;
  line-height: 1.4;
}
.cs-move-equip {
  font-size: 10px;
  color: #d4843a;
  font-weight: 600;
}

/* ---- Confirm card ---- */
.cs-confirm-card {
  display: flex;
  gap: 24px;
  padding: 24px;
  border: 1px solid rgba(107,75,45,0.3);
  border-radius: 10px;
  background: linear-gradient(180deg, rgba(42,34,24,0.7), rgba(26,20,16,0.7));
  align-items: flex-start;
}
.cs-confirm-portrait {
  width: 120px;
  height: 170px;
  flex-shrink: 0;
  border-radius: 6px;
  background:
    radial-gradient(ellipse at 50% 30%, rgba(212,200,184,0.06), transparent 55%),
    linear-gradient(180deg, #2a2218, #1a1410);
  border: 1px solid rgba(107,75,45,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cs-confirm-portrait-icon {
  font-size: 40px;
  font-weight: 700;
  color: rgba(212,200,184,0.12);
  font-family: "Cinzel", "Noto Serif SC", serif;
}
.cs-confirm-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cs-confirm-name-input {
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid rgba(197,173,138,0.5);
  border-radius: 8px;
  background: #2a2218;
  color: #d4c8b8;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.05em;
  font-family: "Cinzel", "EB Garamond", "Noto Serif SC", serif;
  transition: border-color 200ms ease, box-shadow 200ms ease;
}
.cs-confirm-name-input:focus {
  outline: none;
  border-color: rgba(212,132,58,0.7);
  box-shadow: 0 0 12px rgba(212,132,58,0.15);
}
.cs-confirm-name-input::placeholder {
  color: #4a4238;
  font-weight: 400;
}
.cs-confirm-line {
  display: flex;
  gap: 8px;
  font-size: 13px;
  color: #8a7a6a;
}
.cs-confirm-label {
  color: #5a5044;
  font-weight: 700;
  min-width: 45px;
}

/* ---- Responsive ---- */
@media (max-width: 860px) {
  .cs-slots-row {
    flex-wrap: wrap;
    gap: 12px;
  }
  .cs-slot {
    width: 140px;
    min-height: 260px;
  }
  .cs-portrait {
    width: 100px;
    height: 140px;
  }
  .cs-info-content {
    flex-direction: column;
    height: auto;
    gap: 8px;
    padding: 12px 16px;
  }
  .cs-info-panel--visible {
    height: auto;
  }
  .cs-identity-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .cs-roots-adjusters {
    grid-template-columns: repeat(2, 1fr);
  }
  .cs-creator-card {
    max-height: 95vh;
  }
}
`;
