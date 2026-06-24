# Phase 7: 气骰系统接入招式面板，简化右侧 UI

> **日期**: 2026 年 6 月 24 日
> **状态**: 已完成
> **构建**: 通过 ✅ (124 modules)

---

## 一、目标

让招式选择真正驱动气骰槽需求，右侧招式卡不再大段显示错误原因，当前招式需求直接反映到阴槽/阳槽。

## 二、新增类型系统

### 2.1 `src/types/move.ts`

统一的 UI 层招式类型，桥接 `combat/types.ts` 的 `Move` 和 `types/dice.ts` 的 `CurrentMoveQiRequirement`。

| 类型 | 说明 |
|------|------|
| `MoveKind` | 招式大类：起手、连招、绝招、外功、法门、身法、调息、返照、出手便行、随手便行、应招、截击 |
| `MoveRequirement` | 气性需求：`minYin` / `minYang` / `timing` / `consumesAction` |
| `MoveCardData` | 招式卡 UI 数据：id、name、kind、requirement、baseEffect、tags |
| `MoveUnavailableReason` | 不可用原因短标签（9 种） |

### 2.2 工具函数

| 函数 | 作用 |
|------|------|
| `parseQiThreshold(threshold)` | 从 "至少1阴1阳" 解析 `{minYin, minYang}` |
| `mapTimingToKind(timing, category, formPosition)` | combat Move → MoveKind |
| `classifyUnavailableReason(raw)` | 冗长原因 → 短标签 |

### 2.3 不可用原因短标签映射

| 冗长原因 | 短标签 |
|---------|--------|
| "未选择招式" / 时点相关 | `非宣言时点` |
| 阴骰不足 | `缺阴骰` |
| 阳骰不足 | `缺阳骰` |
| 气海为空 | `气海为空` |
| 目标相关 | `目标未选` |
| 行动者相关 | `不是当前行动者` |
| 势相关 | `势不符` |
| 锁定相关 | `已锁气` |
| 投掷相关 | `气骰投掷中` |

## 三、新增 UI 组件

### 3.1 `MoveCard` (`src/ui/combat/dice/MoveCard.tsx`)

精简招式卡片，每张只显示：

```
┌──────────────────────────┐
│ 雨步斩            外功   │ ← 名称 + 种类
│ 阴1 阳1                 │ ← 需求
│ 突进短距劈斩…            │ ← 效果（单行截断）
│ [外功] [行家] [A]        │ ← 标签
│ ⚠ 缺阴骰                 │ ← 仅在不可用时显示
└──────────────────────────┘
```

### 3.2 `ActionHintBar` (`src/ui/combat/dice/ActionHintBar.tsx`)

统一条状态栏，显示当前需要做什么：

| 状态 | 显示 |
|------|------|
| 未选招 | "请选择招式并指定目标" |
| 未选目标 | "雨步斩 · 请选择目标（点击战场敌人）" |
| 缺骰子 | "雨步斩 · 目标：短兵客 ｜ 阴1/1 阳0/1" |
| 满足要求 | "雨步斩 · 目标：短兵客 ｜ 可锁气" |
| 投掷中 | "🎯 气骰投掷中，请等待动画结束…" |
| 已锁气 | "🔒 已锁气，等待响应窗口或结算" |

## 四、招式驱动气槽

### 4.1 流程

```
玩家选择招式
  │
  ├─→ parseQiThreshold(move.qiNatureThreshold)
  │     提取 minYin / minYang
  │
  ├─→ QiAssignmentBoard 接收 moveRequirement
  │     └─ QiDropSlot 显示 "需≥1" / "需≥2"
  │
  └─→ ActionHintBar 显示当前满足状态
```

### 4.2 切换招式时的气骰处理（MVP 方案）

**原则：切换招式时，已投入阴槽/阳槽的骰子全部退回气海。**

实现方式：
- `useDiceStore().returnAllAssignedToSea()` — 新增 store action
- `ActionPanel.handleMoveChange()` — 在 `setSelectedMoveId` 之前调用
- 简洁明了，不会导致玩家困惑"骰子去哪了"

后续可考虑优化：如果新招式需求与旧招式兼容，保留已投入骰子。

### 4.3 QiAssignmentBoard 已有集成

`QiAssignmentBoard` 通过以下 props 接入：
- `moveRequirement: CurrentMoveQiRequirement` — 驱动阴槽/阳槽需求显示
- `hasTarget: boolean` — 控制拖拽可用性
- `targetName: string` — 显示目标

切换招式后，`QiDropSlot` 自动更新需求徽章。

## 五、目标选择

### 5.1 两种方式

1. **战场点击**（新增）：点击 `CombatStage` 上的敌方节点 → 自动设置 `selectedTargetId`
2. **下拉菜单**（保留）：右侧面板的目标 `<select>` 下拉框

### 5.2 实现

```tsx
// CombatStage 包装器
onSelectCombatant={(id) => {
  onSelect(id);
  const actor = state.actors.find(a => a.id === id);
  if (actor && actor.side !== "player") {
    onSelectTarget?.(id);  // 敌方 → 设为宣言目标
  }
}}
```

### 5.3 未选目标时的行为

- `QiAssignmentBoard.canDrop` 为 false（拖拽禁用）
- `ActionHintBar` 显示 "请选择目标（点击战场敌人）"
- 确认锁气按钮不可用（`canConfirmQiDeclaration` 检查 `targetId`）

## 六、右侧面板简化

### 之前（复杂）

```
招式与宣言
├── 目标下拉框
├── 招式下拉框
├── 招式卡网格（含冗长错误原因）
├── 基础动作按钮（调息/返照）
├── 基础效果文本
├── 骰子选择列表
├── 确认宣言按钮
└── 不可用原因长文本
```

### 之后（精简）

```
招式与宣言
├── ActionHintBar（一行状态）
├── 目标下拉框
└── MoveCard 网格（名称+种类+需求+效果+标签+短原因）
```

移除内容：
- 招式下拉框（卡片点击即选择）
- 基础动作按钮（后续在独立面板处理）
- 骰子选择列表（已有 QiDiceTray 和拖拽）
- 确认宣言按钮（已在 QiAssignmentBoard 内有）
- 冗长错误原因文本（短标签替代）
- 基础效果文本（内嵌在 MoveCard 内）

## 七、Store 变更

新增 `RETURN_ALL_ASSIGNED_TO_SEA` action：

```typescript
case "RETURN_ALL_ASSIGNED_TO_SEA": {
  const returned = state.qiDice.map((die) =>
    die.location === "lockedYin" || die.location === "lockedYang"
      ? { ...die, location: "qiSea" as const }
      : die,
  );
  return { ...state, qiDice: returned, assignedYinDiceIds: [], assignedYangDiceIds: [] };
}
```

## 八、涉及文件

```
新增:
  src/types/move.ts                          — 招式 UI 类型系统
  src/ui/combat/dice/MoveCard.tsx             — 精简招式卡
  src/ui/combat/dice/ActionHintBar.tsx        — 统一状态栏
  docs/devlog/README_DICE_PHASE7_2026年6月24日.md

修改:
  src/store/diceStore.tsx                     — 新增 RETURN_ALL_ASSIGNED_TO_SEA
  src/ui/App.tsx                              — 重写 ActionPanel, 接入目标选择
  src/components/dice/dice.css               — MoveCard + ActionHintBar 样式
```

## 九、下一阶段

Phase 8：整体 UI 布局优化
- 右侧面板宽度和滚动优化
- 气骰区域与招式面板的视觉关联
- 响应式布局支持
- 暗色主题完善

---

*Phase 7 完成。招式面板已接入气骰系统，右侧 UI 大幅简化。*
