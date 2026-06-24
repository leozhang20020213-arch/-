# Phase 8: 整理交锋页 UI，让骰子区成为主操作区

> **日期**: 2026 年 6 月 24 日
> **状态**: 已完成
> **构建**: 通过 ✅ (126 modules)

---

## 一、目标

在 Windows 1920×1080 下，一屏内清楚显示全部交锋信息，气骰区成为视觉主操作区。

## 二、布局比例调整

### 之前

| 区域 | 尺寸 |
|------|------|
| 顶栏 | 56px |
| 左栏 | 320px |
| 右栏 | 380px |
| 中上 CombatStage | 48% |
| 中下 Qi Dice | 52% (min 320px) |
| 底部 | 48px |

### 之后

| 区域 | 尺寸 |
|------|------|
| 顶栏 | 56px |
| 左栏 | **300px**（-20px，更紧凑） |
| 右栏 | 380px（保持） |
| 中上 CombatStage | **42%**（-6%，腾空间给气骰区） |
| 中下 Qi Dice | **flex 1**（min **220px**，确保不挤压） |
| 底部 | **60px**（+12px，容纳提示+按钮） |

### CSS Token 变更

```css
:root {
  --cs-left-w:        300px;  /* was 320px */
  --cs-phasebar-h:    60px;   /* was 48px */
  --cs-gap:           8px;    /* was 10px */
}
```

### 中心区域

```
┌─────────────────────────────────────┐
│ CombatStage (42%) min 200px        │  ← 不挤压到看不见角色距离
├─────────────────────────────────────┤
│ QiDiceDock (flex 1) min 220px      │  ← 气骰主操作区
│ ┌───────┐ ┌──────┐ ┌──────┐        │
│ │ 气海   │ │ 阴槽 │ │ 阳槽 │        │
│ │ 🎲🎲  │ │ 🎲  │ │      │        │
│ └───────┘ └──────┘ └──────┘        │
│ [确认宣言并锁气]                     │
└─────────────────────────────────────┘
```

## 三、气骰区视觉优先级

气骰区（QiAssignmentBoard + QiZonePanel）现在是中央主操作区：

1. **QiZonePanel** 显示四区：气海、锁气、息库、临气
2. **QiDiceTray** 居中显示可用气骰，支持拖拽
3. **阴槽/阳槽**（QiDropSlot）在气海两侧
4. **确认宣言并锁气** 按钮紧邻气槽（在 QiAssignmentBoard footer 内）
5. **ActionHintBar** 在右侧招式面板顶部，不重复显示错误

关键约束：
- QiDiceDock 不低于 220px
- CombatStage 不低于 200px
- 阴槽/阳槽始终可见

## 四、敌方卡收束

### 之前

右侧常驻完整敌方公开卡（EnemyPublicCard），含：
- 名称、HP 条、势、状态、描述、弱点列表、行为倾向、已知招式
- 占据大量垂直空间，挤压招式区

### 之后

右侧仅显示 **TargetSummary** 紧凑摘要：

```
┌─ TargetSummary ──────────────────────┐
│ 短兵客             42/60  [详情] [✕] │
│ 阳盛  [迟滞]                         │
│ 弱点：左肩旧伤                        │
└──────────────────────────────────────┘
```

- 名称、HP、势、状态、弱点（单行截断）
- 点击「详情」展开完整 EnemyPublicCard
- 点击「✕」清除目标
- 左栏「敌方概览」保留紧凑 chip 列表

## 五、底部提示栏统一

### 之前

底部两个独立组件：
- `PlayerPromptBar`：自然语言提示
- `PhaseActionBar`：阶段按钮 + 禁用提示

导致重复信息（"不可宣言：……"出现多次）。

### 之后

**PhasePromptBar** 合并两个组件为单一 60px 栏：

```
┌─ PhasePromptBar ───────────────────────────────────────────────┐
│ ⚔ 第1轮，沈青行动中。请选择招式、目标，并投入气骰。            │
│                          [进入宣言] [结束回合]  ……  | 宣言     │
└────────────────────────────────────────────────────────────────┘
   ← 提示文本                              →  ← 按钮 →  ← 阶段 →
```

- 不再到处重复"不可宣言：缺少阴槽气骰……"
- 不可用原因仅显示在 ActionHintBar 和 MoveCard 短标签中
- DM 模式自动切换提示文本和按钮标签

## 六、左侧卡片紧凑化

| 改动 | 说明 |
|------|------|
| 卡片内边距 | 12px → 8px |
| "场景目标"标题 | 改为"场景"，更紧凑 |
| "最近动态" | 颜色加深（`var(--ink-dark)`），字体更大（12px → 11px，但对比度提升） |
| 敌方概览 | 移至左侧"当前目标"区域，chip 保持紧凑 |

## 七、抽屉页修正

| 修正项 | 之前 | 之后 |
|--------|------|------|
| 最大宽度 | `min(400px, calc(100vw - 36px))` | `min(760px, calc(100vw - 40px))` |
| 最大高度 | `100vh`（固定全屏） | `90vh`（留上下边距） |
| 定位 | `top:0; right:0; bottom:0` | `top:5vh; right:20px` |
| 关闭按钮 | 随内容滚动 | `position: sticky` 固定在标题栏右上 |
| 内容区 | 无独立 padding | `drawer-content` 包裹 16px padding |
| 标题栏 | 无 sticky | `drawer-title` sticky top |

```css
.combat-drawer-layer {
  position: fixed;
  top: 5vh;
  right: 20px;
  width: min(760px, calc(100vw - 40px));
  max-height: 90vh;
  overflow-y: auto;
}
```

## 八、涉及文件

```
新增:
  src/ui/combat/enemy/TargetSummary.tsx          — 紧凑目标摘要
  src/ui/combat/player/PhasePromptBar.tsx         — 统一底部栏
  docs/devlog/README_DICE_PHASE8_2026年6月24日.md

修改:
  src/styles/combat-shell.css                     — 布局 token、比例、抽屉、新组件样式
  src/ui/combat/LeftCombatPanel.tsx               — 紧凑化左侧面板
  src/ui/App.tsx                                  — 接入 TargetSummary、PhasePromptBar
```

## 九、已知问题

1. **DM 桌面的 DmControlPanel** 仍然较大，后续可独立整理
2. **PhasePromptBar** 暂未接入全部 DM 按钮（onApplyMomentum 等），DM 按钮已在 PhaseActionBar 中保持向后兼容
3. 1366×768 下 QiDiceDock 可能降至 220px 最小值，需实测确认可拖拽体验
4. 移动端/竖屏布局尚未处理

## 十、下一阶段

Phase 9: 测试和打磨
- 端到端宣言流程测试
- 拖拽回弹与错误提示验收
- 气骰动画与数据一致性验证
- 响应式布局回归测试

---

*Phase 8 完成。气骰区已提升为交锋页主操作区，一屏可见全部关键信息。*
