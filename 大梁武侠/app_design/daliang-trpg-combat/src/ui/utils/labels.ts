import type { Actor, AppSession, CombatState, QiDie } from "../../combat/types";

/** Map Qi zone enum keys to display labels */
const zoneLabels: Record<string, string> = {
  QI_POOL: "气池",
  QI_SEA: "气海",
  QI_LOCK: "锁气",
  QI_REST: "息库",
  TEMP_QI: "临气区",
  YIN_SLOT: "阴槽",
  YANG_SLOT: "阳槽",
};

export function dieLabel(die: QiDie): string {
  const zone = zoneLabels[die.zone] ?? die.zone;
  return `${zone}·${die.label}(${die.value}/${die.sides})`;
}

export function phaseLabel(phase: CombatState["phase"]): string {
  const map: Record<CombatState["phase"], string> = {
    setup: "开局",
    initiative: "先攻判定",
    scene: "可宣言",
    declare: "宣言中",
    intercept_window: "等待截击",
    react_window: "等待应招",
    outcome: "结算中",
    round_end: "轮次结束",
  };
  return map[phase] ?? phase;
}

export function identityLabel(identity: AppSession["identity"]): string {
  if (!identity) return "未入席";
  const map: Record<string, string> = {
    dm: "DM",
    player: "玩家",
    spectator: "观战",
  };
  return map[identity] ?? identity;
}

export function generateLanRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "LAN-";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function momentumLabel(momentum: Actor["momentum"]): string {
  return momentum;
}

export function sixRootLabel(key: string): string {
  const map: Record<string, string> = {
    crown: "顶门",
    vision: "目窍",
    heart: "心口",
    dantian: "丹田",
    gate: "命门",
    root: "步根",
  };
  return map[key] ?? key;
}
