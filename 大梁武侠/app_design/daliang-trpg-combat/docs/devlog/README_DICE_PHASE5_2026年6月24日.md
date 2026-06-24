# Phase 5: 强化 2D 气骰投掷动画

> **日期**: 2026 年 6 月 24 日
> **状态**: 已完成
> **构建**: 通过 ✅

---

## 一、目标

在不引入复杂 3D 的前提下，让气骰投掷有明显反馈，并保证最终点数清楚可读。

## 二、实现方式

### 2.1 动画架构

采用 **纯 2D CSS + React Hook** 方案，而非 Three.js/Phaser 3D 方案。

**核心组件**：

| 文件 | 作用 |
|------|------|
| `src/hooks/useDiceRollAnimation.ts` | 管理每枚骰子独立的动画状态 |
| `src/components/dice/QiDie2D.tsx` | 骰子卡片组件，支持 `displayValue` 和 `rolling` 状态 |
| `src/store/diceStore.tsx` | 新增 `isRolling`、`rollingDisplayValues` 状态及 3 个 action |
| `src/components/dice/dice.css` | 增强的 `@keyframes qi-die-roll` 动画 |

### 2.2 动画流程

```
用户点击「投掷气海」
  │
  ├─→ useDiceRollAnimation.startRollAnimation(dice)
  │     │
  │     ├─ 1. 预计算每枚骰子的最终值 (rollQiDie)
  │     ├─ 2. dispatch START_ROLLING → store.isRolling = true
  │     ├─ 3. 启动 80ms 间隔定时器，每 tick 更新随机 displayValue
  │     ├─ 4. 每枚骰子独立 500-900ms 倒计时
  │     │     └─ 到期后显示最终值，从滚动集合中移除
  │     └─ 5. 全部骰子完成后
  │           ├─ 停止间隔定时器
  │           ├─ 等待 150ms（让玩家看清最终值）
  │           └─ dispatch FINISH_ROLLING → 写入 store
  │
  └─→ QiDie2D 重新渲染，显示最终点数
```

### 2.3 CSS 动画

```css
@keyframes qi-die-roll {
  0%   { transform: translateY(0) rotate(0deg) scale(1); }
  25%  { transform: translateY(-6px) rotate(-8deg) scale(1.04); }
  50%  { transform: translateY(3px) rotate(9deg) scale(0.98); }
  75%  { transform: translateY(-3px) rotate(-4deg) scale(1.02); }
  100% { transform: translateY(0) rotate(0deg) scale(1); }
}
```

- 骰子在动画期间轻微上下弹跳 + 旋转 + 缩放
- 数字跳动时颜色变为金色 (`#ffd76b`) 并带发光效果
- 使用 `qi-die-2d--animating` class 控制动画开关
- 使用 `qi-die-2d--rolling` class 禁用点击事件 (`pointer-events: none`)

### 2.4 骰阶大小区分

通过 `DIE_SIZE_SCALE` 常量按骰面数等比缩放：

| 骰阶 | 缩放倍率 | 实际尺寸 (px) |
|------|---------|--------------|
| D4   | 0.78    | 50 × 57      |
| D6   | 1.00    | 64 × 74      |
| D8   | 1.08    | 69 × 79      |
| D10  | 1.16    | 74 × 85      |
| D12  | 1.24    | 79 × 91      |
| D20  | 1.32    | 84 × 97      |

骰阶越高骰子略大，但不夸张——最大 D20 仅比 D6 大 32%。

### 2.5 视觉区分

| 类型 | 背景色 | 文字色 | 左边框 |
|------|--------|--------|--------|
| 阴骰 | 深蓝黑渐变 | `#d4eaff` | `#3a7ca5` |
| 阳骰 | 深棕黑渐变 | `#ffe0b0` | `#c8782a` |
| 原始骰 | 深灰渐变 | `#e8e8e0` | `#8a8a80` |

## 三、动画期间禁用操作

| 操作 | 状态 | 实现方式 |
|------|------|---------|
| 重复投掷按钮 | ❌ 禁用 | `QiDiceToolbar.isRolling` → `disabled` |
| 确认锁气按钮 | ❌ 禁用 | `state.isRolling` → `confirmCheck.ok = false` |
| 拖拽骰子入槽 | ❌ 禁用 | `effectiveCanDrag = canDrag && !isAnyRolling` |
| 骰子点击 | ❌ 禁用 | `qi-die-2d--rolling` → `pointer-events: none` |

## 四、为什么暂不做 3D

1. **复杂度**: Three.js 骰子物理模拟需要 Cannon.js/rapier 等物理引擎，集成成本高
2. **性能**: 移动端和低配设备上 3D 渲染性能开销显著
3. **可读性**: 3D 骰子旋转时数字面难以看清，玩家在动画期间无法确认点数
4. **布局稳定性**: 2D CSS 动画在 flex/grid 布局内运行，不会导致布局跳动
5. **开发优先级**: 当前阶段核心需求是"点数可读 + 有投掷反馈"，2D 方案完全满足

## 五、最终点数可读性保证

1. **预计算机制**: 最终值在动画开始前已确定（`rollQiDie` 预计算），不依赖动画时序
2. **中间态与终态分离**: 动画期间 `displayValue` 显示随机数，动画结束后自动回到 `die.value`
3. **150ms 停顿**: 全部骰子显示最终值后，等待 150ms 再清除 `isRolling` 标志，确保玩家看清
4. **大号数字**: 中央数字使用 `26px`、`font-weight: 900`，在任何骰面大小下都清晰可辨
5. **静态布局**: 骰子卡片尺寸由骰阶预先确定（`baseSize * scale`），动画只改变 `transform`，不改变布局流

## 六、无布局跳动

- 骰子尺寸基于 `DIE_SIZE_SCALE` 静态计算，不随动画改变
- CSS 动画仅使用 `transform`（GPU 加速），不触发 reflow
- `pointer-events: none` 防止动画期间的意外交互
- 骰子始终在 `qi-dice-tray__dice-row` 的 flex-wrap 容器内，不会飞出屏幕

## 七、下一阶段 3D Spike 计划

- **Phase 6**: 调研 Three.js + Cannon.js 骰子物理投掷
- 在独立 `dice-lab` 项目中先行验证
- 评估移动端性能表现
- 设计 3D→2D 点数映射方案（保证可读性）
- 如果可行，在主项目中以 `QiDiceRollOverlay` 方式集成

## 八、涉及文件

```
修改:
  src/store/diceStore.tsx          — 新增 3 个 action + 2 个 state 字段
  src/components/dice/QiDie2D.tsx   — 新增 displayValue prop + rolling 增强
  src/components/dice/QiDiceTray.tsx — 接入 useDiceRollAnimation
  src/components/dice/DraggableQiDie.tsx — 透传 rolling/displayValue
  src/components/dice/QiAssignmentBoard.tsx — 动画期间禁用拖拽/确认
  src/components/dice/dice.css      — 新增 qi-die-roll 动画 + 新 class

新增:
  src/hooks/useDiceRollAnimation.ts — 核心动画 hook (165 行)
  docs/devlog/README_DICE_PHASE5_2026年6月24日.md — 本文档
```

---

*Phase 5 完成。2D 气骰投掷动画已就绪，下一阶段将探索 3D 骰子物理模拟。*
