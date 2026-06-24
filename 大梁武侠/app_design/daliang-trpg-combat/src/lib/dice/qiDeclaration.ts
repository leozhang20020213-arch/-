// ==========================================================================
// Qi Declaration Rules — 大梁江湖 TRPG 宣言锁气
// Phase 3: confirm, lock, resolve declarations.
// ==========================================================================

import type {
  QiDieData,
  CurrentMoveQiRequirement,
  LockedQiDeclaration,
  QiDeclarationStatus,
} from "../../types/dice";

// ---- Confirm Check ----

export interface ConfirmResult {
  ok: boolean;
  reasons: string[];
}

/**
 * Check whether the current assignment can be confirmed as a declaration.
 *
 * Conditions:
 * 1. A move is selected (requirement.moveId is non-empty)
 * 2. A target is selected (targetId is non-empty)
 * 3. Yin slot has enough dice (>= requirement.minYin)
 * 4. Yang slot has enough dice (>= requirement.minYang)
 * 5. All assigned dice are not already locked
 * 6. All assigned dice exist
 */
export function canConfirmQiDeclaration(params: {
  requirement: CurrentMoveQiRequirement | null;
  targetId: string | null;
  targetName: string;
  yinDice: QiDieData[];
  yangDice: QiDieData[];
  declarationStatus: QiDeclarationStatus;
}): ConfirmResult {
  const reasons: string[] = [];

  if (!params.requirement || !params.requirement.moveId) {
    reasons.push("未选择招式");
  }
  if (!params.targetId) {
    reasons.push("未选择目标");
  }
  if (params.declarationStatus === "locked") {
    reasons.push("已锁气，请先等待结算");
  }

  const req = params.requirement;
  if (req && req.moveId) {
    if (params.yinDice.length < req.minYin) {
      reasons.push(`阴槽不足（需≥${req.minYin}，当前${params.yinDice.length}）`);
    }
    if (params.yangDice.length < req.minYang) {
      reasons.push(`阳槽不足（需≥${req.minYang}，当前${params.yangDice.length}）`);
    }
  }

  // Check locked
  const allAssigned = [...params.yinDice, ...params.yangDice];
  if (allAssigned.some((d) => d.locked)) {
    reasons.push("部分气骰已锁定，不可重复宣言");
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

// ---- Lock Declaration ----

let declarationCounter = 0;

/**
 * Lock the current assignment into a formal declaration.
 * Returns the LockedQiDeclaration snapshot.
 * Caller is responsible for updating dice `locked` flags.
 */
export function lockQiDeclaration(params: {
  moveId: string;
  moveName: string;
  targetId: string;
  targetName: string;
  yinDice: QiDieData[];
  yangDice: QiDieData[];
}): LockedQiDeclaration {
  declarationCounter += 1;
  return {
    id: `decl-${Date.now()}-${declarationCounter}`,
    moveId: params.moveId,
    moveName: params.moveName,
    targetId: params.targetId,
    targetName: params.targetName,
    yinDice: params.yinDice.map((d) => ({ ...d, locked: true })),
    yangDice: params.yangDice.map((d) => ({ ...d, locked: true })),
    createdAt: Date.now(),
  };
}

// ---- Move Locked Dice to Rest Pool ----

/**
 * After resolution, move all locked dice to the rest pool.
 * Returns updated dice array and the declaration snapshot for archival.
 */
export function moveLockedDiceToRestPool(
  dice: QiDieData[],
  declaration: LockedQiDeclaration,
): QiDieData[] {
  const lockedIds = new Set([
    ...declaration.yinDice.map((d) => d.id),
    ...declaration.yangDice.map((d) => d.id),
  ]);

  return dice.map((d) =>
    lockedIds.has(d.id)
      ? { ...d, location: "restPool" as const, locked: false }
      : d,
  );
}

// ---- Summary ----

export interface DeclarationSummary {
  moveName: string;
  targetName: string;
  yinCount: number;
  yangCount: number;
  yinTotal: number;
  yangTotal: number;
  yinDetail: string;
  yangDetail: string;
}

/**
 * Get a human-readable summary of a declaration.
 */
export function getDeclarationSummary(
  declaration: LockedQiDeclaration,
): DeclarationSummary {
  const yinTotal = declaration.yinDice.reduce((s, d) => s + d.value, 0);
  const yangTotal = declaration.yangDice.reduce((s, d) => s + d.value, 0);

  return {
    moveName: declaration.moveName,
    targetName: declaration.targetName,
    yinCount: declaration.yinDice.length,
    yangCount: declaration.yangDice.length,
    yinTotal,
    yangTotal,
    yinDetail: declaration.yinDice.map((d) => `阴D${d.sides}=${d.value}`).join("、") || "无",
    yangDetail: declaration.yangDice.map((d) => `阳D${d.sides}=${d.value}`).join("、") || "无",
  };
}
