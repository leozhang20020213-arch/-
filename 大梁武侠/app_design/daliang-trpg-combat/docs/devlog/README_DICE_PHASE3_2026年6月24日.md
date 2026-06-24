# README — 确认宣言并锁气 + 气骰流转 Phase 3

**日期：** 2026年6月24日  
**分支：** `dice-system-first-pass`  
**前置：** Phase 1（气骰可视化）+ Phase 2（拖拽入槽）已完成

---

## 1. 本阶段目标

**实现"确认宣言并锁气" + "模拟结算入息库"的完整流转。**

玩家现在可以：
1. 选择招式 + 选择目标 → 拖骰入槽
2. 点击「确认宣言并锁气」→ 骰子锁死，不可再拖
3. 查看宣言摘要（招式、目标、投入骰子、合值）
4. 点击「模拟结算：气骰入息库」→ 已锁骰子移入息库
5. 息库显示骰子数量和详情
6. 重置宣言 → 骰子解锁，可重新编辑

---

## 2. 锁气条件

| 条件 | 说明 |
|------|------|
| 招式已选择 | requirement.moveId 非空 |
| 目标已选择 | targetId 非空 |
| 阴槽满足门槛 | yinCount >= requirement.minYin |
| 阳槽满足门槛 | yangCount >= requirement.minYang |
| 未重复锁气 | declarationStatus !== "locked" |
| 骰子未锁定 | 全部 assigned dice 的 locked === false |

规则函数位于 `src/lib/dice/qiDeclaration.ts`：
- `canConfirmQiDeclaration(params)` → `{ ok, reasons }`
- `lockQiDeclaration(params)` → `LockedQiDeclaration`
- `moveLockedDiceToRestPool(dice, declaration)` → 更新后的 dice 数组
- `getDeclarationSummary(declaration)` → human-readable summary

---

## 3. 锁气后 UI 表现

1. **槽内骰子**：locked 标记，不可拖拽
2. **气海骰子**：仍可见，但不可投入槽位（槽位已禁）
3. **宣言摘要卡片**：显示招式名 → 目标名，阴/阳各投入几枚，合值
4. **状态徽章**：顶部显示 "🔒 已锁气" 或 "✅ 已结算"
5. **操作按钮**：
   - 「模拟结算：气骰入息库」→ locked → resolved
   - 「重置宣言」→ 解锁全部骰子，清空槽位

---

## 4. 模拟结算后气骰进入息库

点击「模拟结算：气骰入息库」后：

1. locked dice 的 `location` 改为 `"restPool"`
2. `locked` 改为 `false`
3. 从阴槽/阳槽 ID 列表中移除
4. 底部息库栏显示：
   ```
   息库 2 枚  阴D6=4、阳D6=5  需调息/回气取回
   ```
5. 状态变为 "resolved"

---

## 5. 新增类型和函数

### 类型（`src/types/dice.ts`）

```typescript
LockedQiDeclaration {
  id, moveId, moveName, targetId, targetName,
  yinDice: QiDieData[], yangDice: QiDieData[],
  createdAt
}

QiDeclarationStatus = "draft" | "locked" | "resolved"
```

### 规则（`src/lib/dice/qiDeclaration.ts`）

- `canConfirmQiDeclaration()` — 确认检查
- `lockQiDeclaration()` — 创建宣言快照
- `moveLockedDiceToRestPool()` — 结算后移入息库
- `getDeclarationSummary()` — 人类可读摘要

### Store（`src/store/diceStore.tsx`）

新增 State：
- `targetId`, `targetName`
- `declarationStatus: QiDeclarationStatus`
- `activeDeclaration: LockedQiDeclaration | null`

新增 Actions：
- `SET_TARGET` / `LOCK_DECLARATION` / `RESOLVE_DECLARATION` / `RESET_DECLARATION`

新增 Methods：
- `setTarget()` / `lockDeclaration()` / `resolveDeclaration()` / `resetDeclaration()` / `getLockedDice()`

---

## 6. 新增组件

| 组件 | 路径 | 说明 |
|------|------|------|
| `QiRequirementStatus` | `src/components/dice/QiRequirementStatus.tsx` | 招式需求 vs 当前投入显示 |
| `QiDeclarationSummary` | `src/components/dice/QiDeclarationSummary.tsx` | 锁气宣言摘要 + 结算/重置按钮 |

### 修改组件

| 组件 | 修改 |
|------|------|
| `QiAssignmentBoard` | 集成确认按钮、需求状态、宣言摘要、息库栏 |
| `App.tsx` | 传递 `targetName` 到 QiAssignmentBoard |
| `dice.css` | 新增 Phase 3 样式（~200 行） |

---

## 7. 手动测试步骤

1. `npm run dev:legacy` → 进入交锋桌面
2. 初始化气骰 → 投掷气海
3. 选择招式（如"雨步横刀"）+ 选择目标（如"短兵客"）
4. 拖骰入阴槽/阳槽（至少各 1 枚）
5. 观察需求状态行显示 "阴槽：1/1 ✓" "阳槽：1/1 ✓"
6. 点击 **「确认宣言并锁气」**
7. 确认：
   - 槽内骰子锁定，不可再拖动
   - 宣言摘要出现，显示招式→目标、骰子详情
8. 点击 **「模拟结算：气骰入息库」**
9. 确认：
   - 槽位清空
   - 底部出现 "息库 2 枚 · 需调息/回气取回"
   - 状态变为 "✅ 已结算"
10. 点击「重置宣言」→ 回到初始可编辑状态

---

## 8. 当前还没有实现的内容

- **调息（从息库取回气海）** — Phase 4
- **返照（气海空时获取新骰）** — Phase 4
- **与原始 CombatEngine 完全桥接** — 后续 Phase
- **截击/应招窗口** — 后续 Phase
- **真实结算（伤害/效阶等）** — 后续 Phase

---

## 9. 下一阶段建议

**Phase 4：调息与返照 — 完整气骰流转**

目标：
1. 调息按钮：从息库选择 N 枚骰子移回气海（消耗回气属性）
2. 返照按钮：气海为空时可触发，获取新气骰
3. 与 CombatEngine 的 `regulateBreath` / `useReflection` 桥接
4. 气骰流转可视化（动画从息库→气海）

---

## 10. 文件清单

### 新建（4 个）
- `src/lib/dice/qiDeclaration.ts`
- `src/components/dice/QiRequirementStatus.tsx`
- `src/components/dice/QiDeclarationSummary.tsx`
- `docs/devlog/README_DICE_PHASE3_2026年6月24日.md`

### 修改（5 个）
- `src/types/dice.ts` — 新增 LockedQiDeclaration、QiDeclarationStatus
- `src/store/diceStore.tsx` — 宣言/结算/reset 状态和 actions
- `src/components/dice/QiAssignmentBoard.tsx` — 集成确认按钮、宣言摘要、息库栏
- `src/components/dice/dice.css` — Phase 3 样式
- `src/ui/App.tsx` — 传递 targetName

---

## 构建结果

✅ `npm run build` — 通过  
✅ TypeScript 编译 — 无错误  
✅ Vite 构建 — 成功（113 modules）

---

*Phase 3 完成。宣言可锁气，结算入息库。*
