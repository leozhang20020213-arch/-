import { dmOverride, regulateBreath } from "../combat/combatEngine";
import type { AppSession, CombatState, InventoryCategory, QiDie, QiZone } from "../combat/types";

export const zoneLabels: Record<QiZone, string> = {
  QI_POOL: "气池",
  QI_SEA: "气海",
  QI_LOCK: "锁气",
  QI_REST: "息库",
  TEMP_QI: "临气区",
  YIN_SLOT: "阴槽",
  YANG_SLOT: "阳槽",
};

export const zoneOrder: QiZone[] = ["QI_POOL", "QI_SEA", "TEMP_QI", "QI_LOCK", "YIN_SLOT", "YANG_SLOT", "QI_REST"];

export const categoryLabels: Record<InventoryCategory, string> = {
  weapon: "兵器",
  armor: "护具",
  accessory: "佩饰",
  tool: "器具",
  medicine: "药物",
  mount: "坐骑",
  document: "文书",
  misc: "杂物",
};

export const iconMap = {
  character: "/assets/icons/png128/001_player_character_角色.png",
  inventory: "/assets/icons/png128/002_inventory_背包.png",
  combat: "/assets/icons/png128/006_combat_交锋.png",
  qi: "/assets/icons/png128/009_qi_dice_气骰.png",
  response: "/assets/icons/png128/008_response_响应.png",
  momentum: "/assets/icons/png128/011_momentum_势.png",
  dm: "/assets/icons/png128/040_dm_tools_DM工具.png",
  world: "/assets/icons/png128/005_world_世界.png",
};

export type DrawerId =
  | "character"
  | "sixRoots"
  | "innerArt"
  | "inventory"
  | "moves"
  | "statuses"
  | "logs"
  | "library"
  | "settings"
  | "dmEnemies"
  | "dmDistance"
  | "dmRuling"
  | "dmHidden"
  | "dmScene"
  | "dmLog";

export const timepoints: Array<{ phase: CombatState["phase"] | "momentum"; label: string }> = [
  { phase: "setup", label: "准备" },
  { phase: "declare", label: "宣言" },
  { phase: "declare", label: "锁气" },
  { phase: "intercept_window", label: "截击窗口" },
  { phase: "react_window", label: "成招" },
  { phase: "react_window", label: "应招窗口" },
  { phase: "outcome", label: "落果" },
  { phase: "momentum", label: "势变化" },
  { phase: "round_end", label: "回合结束" },
];

export function drawerTitle(drawer: DrawerId) {
  const titles: Record<DrawerId, string> = {
    character: "人物详情",
    sixRoots: "六根详情",
    innerArt: "内功与窍位",
    inventory: "背包",
    moves: "招式与动作",
    statuses: "状态详情",
    logs: "日志回放",
    library: "资料库",
    settings: "设置",
    dmEnemies: "敌人完整详情",
    dmDistance: "距离调整",
    dmRuling: "裁定",
    dmHidden: "隐藏信息管理",
    dmScene: "场景",
    dmLog: "DM日志",
  };
  return titles[drawer];
}

export function regulateFirstRestDie(
  patch: (updater: (current: CombatState) => CombatState) => void,
  state: CombatState,
  actorId: string,
) {
  const die = state.dice.find((item) => item.ownerId === actorId && item.zone === "QI_REST");
  if (!die) {
    patch((current) => dmOverride(current, "息库没有可调息气骰。"));
    return;
  }
  patch((current) => regulateBreath(current, actorId, [die.id]));
}

export function dieLabel(die: QiDie) {
  const nature = die.nature === "yin" ? "阴" : die.nature === "yang" ? "阳" : "原";
  return `${nature}${die.value ?? "?"}/${die.label}`;
}

export function phaseLabel(phase: CombatState["phase"]) {
  const labels: Record<CombatState["phase"], string> = {
    setup: "准备",
    initiative: "先后",
    scene: "场景",
    declare: "宣言",
    intercept_window: "截击窗口",
    react_window: "应招窗口",
    outcome: "落果",
    round_end: "轮末",
  };
  return labels[phase];
}

export function identityLabel(identity: AppSession["identity"]) {
  if (identity === "dm") return "DM";
  if (identity === "player") return "玩家";
  if (identity === "spectator") return "旁观";
  return "未入席";
}

export function generateLanRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "LAN-";
  for (let index = 0; index < 4; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
