// ==========================================================================
// Move Types — 大梁江湖 TRPG 招式系统 UI 层类型
// Phase 7: bridges combat engine Move ↔ dice system CurrentMoveQiRequirement
// ==========================================================================

/** 招式大类 */
export type MoveKind =
  | "起手"
  | "连招"
  | "绝招"
  | "外功"
  | "法门"
  | "身法"
  | "调息"
  | "返照"
  | "出手便行"
  | "随手便行"
  | "应招"
  | "截击";

/** 招式气性门槛（从 dice 系统独立一份，方便 UI 使用） */
export interface MoveRequirement {
  /** 至少需要投入阴槽的骰子数 */
  minYin: number;
  /** 至少需要投入阳槽的骰子数 */
  minYang: number;
  /** 可用时点列表 */
  timing: string[];
  /** 是否消耗正式行动 */
  consumesAction: boolean;
}

/** 招式卡 UI 数据（从 combat Move 转换而来） */
export interface MoveCardData {
  id: string;
  name: string;
  kind: MoveKind;
  requirement: MoveRequirement;
  /** 基础效果简述 */
  baseEffect: string;
  /** 短标签（如 "主攻" "S级"） */
  tags?: string[];
  /** 详细描述（tooltip 用） */
  description?: string;
}

/** 招式不可用原因（短标签） */
export type MoveUnavailableReason =
  | "非宣言时点"
  | "缺阴骰"
  | "缺阳骰"
  | "气海为空"
  | "目标未选"
  | "不是当前行动者"
  | "势不符"
  | "已锁气"
  | "气骰投掷中";

/** 短标签 → 中文文本映射 */
export const MOVE_UNAVAILABLE_LABELS: Record<MoveUnavailableReason, string> = {
  "非宣言时点": "非宣言时点",
  "缺阴骰": "缺阴骰",
  "缺阳骰": "缺阳骰",
  "气海为空": "气海为空",
  "目标未选": "目标未选",
  "不是当前行动者": "非当前行动者",
  "势不符": "势不符",
  "已锁气": "已锁气",
  "气骰投掷中": "投掷中",
};

/**
 * Classify a verbose reason string into a short MoveUnavailableReason.
 * Falls back to the original string if no match.
 */
export function classifyUnavailableReason(raw: string): MoveUnavailableReason | string {
  const m = raw.trim();
  if (m.includes("时点") || m.includes("宣言") || m.includes("phase")) return "非宣言时点";
  if (m.includes("阴") && (m.includes("不足") || m.includes("缺"))) return "缺阴骰";
  if (m.includes("阳") && (m.includes("不足") || m.includes("缺"))) return "缺阳骰";
  if (m.includes("气海") || m.includes("气池") || m.includes("为空")) return "气海为空";
  if (m.includes("目标")) return "目标未选";
  if (m.includes("行动者")) return "不是当前行动者";
  if (m.includes("势")) return "势不符";
  if (m.includes("锁气") || m.includes("锁定")) return "已锁气";
  if (m.includes("投掷")) return "气骰投掷中";
  return raw;
}

/**
 * Parse a Move's qiNatureThreshold string into minYin/minYang counts.
 * Handles: "至少1阴", "至少1阳", "至少1阴1阳", "任意气性", etc.
 */
export function parseQiThreshold(threshold: string): { minYin: number; minYang: number } {
  let minYin = 0;
  let minYang = 0;
  const t = threshold.trim();

  if (t.includes("至少2阴")) minYin = 2;
  else if (t.includes("至少1阴")) minYin = 1;

  if (t.includes("至少2阳")) minYang = 2;
  else if (t.includes("至少1阳")) minYang = 1;

  // "任意气性" or empty → both 0
  return { minYin, minYang };
}

/** Map combat Move timing/category to MoveKind */
export function mapTimingToKind(timing: string, category: string, formPosition: string): MoveKind {
  if (formPosition === "起式") return "起手";
  if (formPosition === "绝式") return "绝招";
  if (timing === "正式出手" && (category === "外功" || category === "法门")) return category as MoveKind;
  if (timing === "正式出手" && category === "便行") return "身法";
  if (timing === "出手便行") return "出手便行";
  if (timing === "随手便行") return "随手便行";
  if (timing === "截击") return "截击";
  if (timing === "应招") return "应招";
  if (timing === "整备/情景") return "身法";
  return "外功";
}
