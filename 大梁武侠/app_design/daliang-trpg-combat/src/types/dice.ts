// ==========================================================================
// Qi Dice Types — 大梁江湖 TRPG 气骰系统
// Phase 1: 2D visible dice cards for the combat assistant.
// Distinct from src/combat/types.ts QiDie (engine/rule types).
// These types are optimized for the 2D dice display layer.
// ==========================================================================

/** 气骰性质：阴 / 阳 / 原始 */
export type QiDieKind = "yin" | "yang" | "raw";

/** 气骰面标识 */
export type QiDieFace = "阴" | "阳" | "原";

/** 骰阶（面数） */
export type DieSides = 4 | 6 | 8 | 10 | 12 | 20;

/** 气骰所在位置 */
export type QiDieLocation =
  | "qiSea"       // 气海 — available for assignment
  | "tempQi"      // 临气区 — temporary dice
  | "restPool"    // 息库 — resting dice
  | "lockedYin"   // 锁气阴槽
  | "lockedYang"; // 锁气阳槽

/** 单枚气骰的完整数据 */
export interface QiDieData {
  /** 唯一标识，如 "yin-d6-1" */
  id: string;
  /** 骰子性质 */
  kind: QiDieKind;
  /** 显示用面标识 */
  face: QiDieFace;
  /** 骰阶（面数） */
  sides: DieSides;
  /** 当前点数 (1 ~ sides) */
  value: number;
  /** 当前所在位置 */
  location: QiDieLocation;
  /** 来源标识（功法/物品/情景） */
  source?: string;
  /** 是否为临时骰 */
  temporary?: boolean;
  /** 是否已锁定 */
  locked?: boolean;
}

/** 骰阶中文标签 */
export const DIE_SIDES_LABEL: Record<DieSides, string> = {
  4: "D4",
  6: "D6",
  8: "D8",
  10: "D10",
  12: "D12",
  20: "D20",
};

/** 骰阶显示尺寸倍率 (以 D6 = 1.0 为基准) */
export const DIE_SIZE_SCALE: Record<DieSides, number> = {
  4: 0.78,
  6: 1.0,
  8: 1.08,
  10: 1.16,
  12: 1.24,
  20: 1.32,
};

/** 骰子性质中文标签 */
export const DIE_KIND_LABEL: Record<QiDieKind, string> = {
  yin: "阴",
  yang: "阳",
  raw: "原",
};
