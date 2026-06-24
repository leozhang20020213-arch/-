# README — 四区气骰面板与调息/返照 Phase 4

**日期：** 2026年6月24日  
**分支：** `dice-system-first-pass`  
**前置：** Phase 1-3 已完成

---

## 1. 本阶段目标

**把气骰区做成完整规则面板，显示四区状态并实现调息/返照。**

玩家现在可以看到：
- **气海** — 当前可用骰子
- **锁气** — 本次宣言已投入骰子
- **息库** — 已用待回气骰子
- **临气** — 临时气骰

并且可以执行：
- **调息** — 息库全部骰子回气海并重新投掷
- **返照** — 气海空时从息库取最低骰阶一枚（限一次）

---

## 2. 四区结构

```
┌─────────────────────┬─────────────────────┐
│ 气海 (QiSeaZone)     │ 锁气 (LockedQiZone) │
│ 可用于当前出手       │ 本次宣言已投入      │
│ [D6:4] [D6:2]      │ [D6:4] [D6:2]      │
├─────────────────────┼─────────────────────┤
│ 息库 (RestPoolZone) │ 临气 (TempQiZone)   │
│ 已用待回气           │ 临时气骰            │
│ [D6:5] [D6:1]      │ 暂无                │
├─────────────────────┴─────────────────────┤
│ [🫁 调息] [☀ 返照]    合计 N 枚           │
└───────────────────────────────────────────┘
```

每区显示：区域名、数量徽章、简短说明、骰子列表。

---

## 3. 调息 MVP 规则

**当前实现：**
- 如果息库有骰子 → 全部移回气海，重新投掷点数
- 如果息库为空 → 按钮禁用，提示"息库为空，无需调息。"

**与正式规则的差异：**
- 正式规则：玩家可选择从息库取回哪些骰子，受「回气」属性限制
- MVP 实现：全部取回，不做选择，不查属性
- README 声明这是临时实现，方便测试流程

---

## 4. 返照 MVP 规则

**条件：**
1. 气海必须为空
2. 息库至少 1 枚骰子
3. 本场交锋未使用过（`hasUsedReturnLight` 标记）

**当前实现：**
- 满足条件 → 从息库取最低骰阶 1 枚，回气海并重新投掷
- 标记 `hasUsedReturnLight = true`
- 不满足条件 → 按钮禁用，hover 显示原因

**与正式规则的差异：**
- 正式规则：返照条件更复杂，可能涉及气池、内功等
- MVP 实现：简化为三条件判断
- 本阶段先做 MVP，后续接正式规则引擎

---

## 5. 新增组件

| 组件 | 路径 | 说明 |
|------|------|------|
| `QiZonePanel` | `src/components/dice/QiZonePanel.tsx` | 四区面板容器 + 调息/返照按钮 |
| `QiSeaZone` | `src/components/dice/QiSeaZone.tsx` | 气海区域 |
| `LockedQiZone` | `src/components/dice/LockedQiZone.tsx` | 锁气区域 |
| `RestPoolZone` | `src/components/dice/RestPoolZone.tsx` | 息库区域 |
| `TemporaryQiZone` | `src/components/dice/TemporaryQiZone.tsx` | 临气区域 |
| `QiRecoveryActions` | `src/components/dice/QiRecoveryActions.tsx` | 调息/返照按钮 |

---

## 6. 新增规则函数

**`src/lib/dice/qiRecovery.ts`**

| 函数 | 说明 |
|------|------|
| `recoverFromRestPool(dice)` | 调息：息库全回气海，重新投掷 |
| `canUseReturnLight(params)` | 检查返照是否可用 |
| `useReturnLight(dice)` | 返照：取最低骰阶一枚回气海 |
| `getZoneCounts(dice)` | 四区计数快照 |

---

## 7. 状态更新

**diceStore 新增：**
- `hasUsedReturnLight: boolean` — 返照使用标记
- `REGULATE_BREATH` action
- `RETURN_LIGHT` action
- `RESET_RETURN_LIGHT` action

---

## 8. 手动测试步骤

1. `npm run dev:legacy` → 进入任意桌面
2. 观察四区面板：气海 0、锁气 0、息库 0、临气 0
3. 初始化气骰 → 气海出现 6 枚
4. 调息按钮禁用（息库为空）
5. 返照按钮禁用（气海不为空）
6. 选择招式 + 目标 → 拖骰入槽 → 确认宣言并锁气
7. 锁气区显示已投入骰子（带锁图标）
8. 模拟结算 → 骰子入息库
9. 息库现在有骰子 → 调息按钮可用
10. 点击 **调息** → 息库骰子回气海，重新投掷
11. 再次宣言 → 锁气 → 结算 → 息库
12. 气海为空时，点击 **返照** → 从息库取一枚回气海
13. 返照按钮标记 "已用"，不可再次点击

---

## 9. 下一阶段建议

**Phase 5：2D 投掷动画强化 + 整体 UI 调优**

目标：
1. 投掷时骰子卡片翻转/弹跳动画
2. 骰子从气海拖入槽位时平滑过渡
3. 结算时骰子从锁气区动画移动到息库
4. 调息时息库骰子弹回气海
5. 整体色彩/对比度优化

---

## 10. 文件清单

### 新建（7 个）
- `src/lib/dice/qiRecovery.ts`
- `src/components/dice/QiZonePanel.tsx`
- `src/components/dice/QiSeaZone.tsx`
- `src/components/dice/LockedQiZone.tsx`
- `src/components/dice/RestPoolZone.tsx`
- `src/components/dice/TemporaryQiZone.tsx`
- `src/components/dice/QiRecoveryActions.tsx`

### 修改（4 个）
- `src/store/diceStore.tsx` — 新增 hasUsedReturnLight + recovery actions
- `src/components/dice/dice.css` — Phase 4 样式（~230 行）
- `src/ui/App.tsx` — 接入 QiZonePanel
- `docs/devlog/README_DICE_PHASE4_2026年6月24日.md`

---

## 构建结果

✅ `npm run build` — 通过  
✅ TypeScript 编译 — 无错误  
✅ Vite 构建 — 成功（120 modules）

---

*Phase 4 完成。四区面板可读，调息返照可操作。*
