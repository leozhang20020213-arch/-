# PHASE 1 — 重构交锋主页面布局骨架

**日期**: 2026-06-24  
**分支**: ui-combat-refactor  
**目标**: 把混乱的交锋界面重构为真正适合 Windows 横屏使用的三栏交战桌面，不改业务逻辑。

---

## 1. 本轮修改目标

将旧的 5-row app-shell 布局（TitleBar / MainToolbar / RoundStatusBar / MainWorkspace / BottomStatusBar）替换为专门的 CombatShell 桌面布局，提供：

- **顶部单栏**：合并应用名、轮次、行动角色、阶段、一级导航、身份标识、保存/设置按钮
- **三栏主区域**：左 320px 角色信息 / 中自适应 交锋舞台+气骰 / 右 380px 招式宣言
- **底部阶段条**：交锋阶段流程指示器

非交锋路由（首页、创建房间、加入房间等）保持原 app-shell 布局不变。

---

## 2. 新增组件清单

| 组件 | 文件 | 说明 |
|------|------|------|
| `CombatShell` | `src/ui/combat/CombatShell.tsx` | 全视口交锋桌面外壳，grid 三行：TopBar / Main 3-column / PhaseBar |
| `TopCombatBar` | `src/ui/combat/TopCombatBar.tsx` | 56px 暗色顶栏，合并原 TitleBar + MainToolbar + RoundStatusBar |
| `LeftCombatPanel` | `src/ui/combat/LeftCombatPanel.tsx` | 320px 左栏：战斗简卡 / 队友 / 场景目标 / 敌方概览 / 最近动态 |
| `CenterCombatPanel` | `src/ui/combat/CenterCombatPanel.tsx` | flex 1 中栏：上半 CombatStage + 下半 QiDiceZone |
| `RightCombatPanel` | `src/ui/combat/RightCombatPanel.tsx` | 380px 右栏：招式宣言 / 敌方公开卡 / 流程按钮 / 提示 |
| `PhaseActionBar` | `src/ui/combat/PhaseActionBar.tsx` | 48px 底部阶段条：宣言 → 截击 → 成招/应招 → 落果 → 势变化 → 轮次结束 |

### 样式文件
| 文件 | 说明 |
|------|------|
| `src/styles/combat-shell.css` | 新 CombatShell 全套 CSS，~340 行，暗木桌面 + 羊皮纸面板主题 |

---

## 3. 三栏布局说明

```
┌──────────────────────────────────────────────────┐
│ TopCombatBar (56px)                               │
│ [大梁江湖 TRPG]  [第2轮 → 沈青 → 宣言阶段]  [人物 背包 招式 状态 日志 资料 设置 | 玩家 | ↩ ⚙] │
├────────────┬──────────────────────┬───────────────┤
│ LEFT 320px │ CENTER flex 1        │ RIGHT 380px   │
│            │                      │               │
│ 我的战斗简卡│  ┌────────────────┐  │ 招式与宣言面板 │
│ (UnitCard) │  │ CombatStage     │  │               │
│            │  │ (交锋舞台 48%)  │  │ 目标: [短兵客▼]│
│ 队友       │  │ Phaser棋盘      │  │ 招式: [雨步横斩▼]│
│ (UnitCard) │  │ 单位卡 + 距离线  │  │               │
│            │  └────────────────┘  │ [招式卡片网格]  │
│ 场景目标   │  ┌────────────────┐  │ 雨步横斩 雨燕回旋│
│ (tracks)   │  │ QiDiceZone      │  │               │
│            │  │ (3D气骰区 52%)  │  │ [气骰选择区]   │
│ 敌方概览   │  │ 临气区          │  │ 阴d6/4 阳d8/6  │
│ (compact)  │  │ 阴槽 气海 阳槽  │  │               │
│            │  │ 气池/息库统计   │  │ [确认宣言并锁气]│
│ 最近动态   │  └────────────────┘  │               │
│ (log)      │                      │ 敌方公开卡     │
│            │                      │ 阶段操作按钮   │
├────────────┴──────────────────────┴───────────────┤
│ PhaseActionBar (48px)                              │
│ 交锋阶段  → 宣言 → 截击 → 成招/应招 → 落果 → 势变化 → 轮次结束  │
└──────────────────────────────────────────────────┘
```

### 宽度设计
- 左栏：320px（1366px 屏幕时为 280px）
- 中栏：flex 1（自适应剩余宽度）
- 右栏：380px（1366px 屏幕时为 340px）
- 最小宽度：1366px

---

## 4. 被替换或包裹的旧页面/组件

### 替换的布局结构
**旧结构（app-shell 5-row grid）：**
```
TitleBar → MainToolbar → RoundStatusBar → MainWorkspace(LeftInfoPanel/CenterCombatZone/RightActionPanel) → BottomStatusBar
```

**新结构（CombatShell）：**
```
TopCombatBar → [LeftCombatPanel / CenterCombatPanel / RightCombatPanel] → PhaseActionBar
```

### 包裹关系
| 旧组件 | 状态 | 新组件 |
|--------|------|--------|
| `TitleBar` | 保留（非交锋路由仍使用） | `TopCombatBar` 合并其功能 |
| `MainToolbar` | 保留文件，不再渲染 | 导航按钮移入 `TopCombatBar` |
| `RoundStatusBar` | 保留文件，不再渲染 | 轮次/阶段信息移入 `TopCombatBar` |
| `MainWorkspace` | 保留文件，不再渲染 | `CombatShell` 替代 |
| `LeftInfoPanel` | 保留文件，不再渲染 | `LeftCombatPanel` 重写（复用 GamePanel/CombatBriefCard/UnitCard） |
| `CenterCombatZone` | 保留文件，不再渲染 | `CenterCombatPanel` 替代 |
| `RightActionPanel` | 保留文件，不再渲染 | `RightCombatPanel` 替代 |
| `BottomStatusBar` | 保留文件，不再渲染 | `PhaseActionBar` 替代 |

### 不变的部分
- **规则引擎**：`combatEngine.ts`、`types.ts`、`storage.ts` 完全不变
- **3D 骰子**：`QiDiceTray.tsx`、`QiDiceRollOverlay.tsx` 完全不变
- **Phaser 棋盘**：`PhaserCombatBoard.tsx` 完全不变
- **种子数据**：`seed.ts` 完全不变
- **所有内联子组件**：`CombatStage`、`QiZoneBoard`、`ActionPanel`、`EnemyRoster`、`PlayerFlowPanel`、`DmControlPanel`、`DrawerLayer` 等全部保留在 App.tsx 中，仅包裹方式改变
- **非交锋路由**：首页、创建房间、加入房间、角色分配等完全不变

---

## 5. 当前哪些区域仍为占位

| 区域 | 状态 | 说明 |
|------|------|------|
| PhaseActionBar | **占位** | 显示阶段流程步骤和当前阶段高亮，但步骤不可点击，无实际操作按钮 |
| 敌方概览（左栏） | **基础实现** | 使用 compact chip 样式显示敌人名称/势/HP，不可交互 |
| 中央交锋舞台 | **旧版** | 仍使用原 `CombatStage` 组件，单位卡以大全卡展示，下一轮改造 |

---

## 6. 修改了哪些文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/main.tsx` | 修改 | +1 行，导入 `combat-shell.css` |
| `src/ui/App.tsx` | 修改 | 4 个 desk 函数返回结构重写；common/DeskProps 添加 resetAll；顶层路由分叉（交锋/非交锋） |
| `src/styles/combat-shell.css` | **新增** | ~340 行，交锋桌面全套样式 |
| `src/ui/combat/CombatShell.tsx` | **新增** | 桌面外壳组件 |
| `src/ui/combat/TopCombatBar.tsx` | **新增** | 顶栏组件 |
| `src/ui/combat/LeftCombatPanel.tsx` | **新增** | 左栏组件 |
| `src/ui/combat/CenterCombatPanel.tsx` | **新增** | 中栏组件 |
| `src/ui/combat/RightCombatPanel.tsx` | **新增** | 右栏组件 |
| `src/ui/combat/PhaseActionBar.tsx` | **新增** | 底部阶段条组件 |

---

## 7. 运行方式

```bash
# 开发（必须使用 dev:legacy）
npm.cmd run dev:legacy -- --port 5174 --host 127.0.0.1

# 构建
npm.cmd run build

# 测试
npm.cmd test
```

---

## 8. 当前已知问题

1. **Overrides.css 冲突**：`overrides.css` 强制 app-shell 使用 5-row grid。非交锋路由正常，交锋路由已改用 CombatShell 不受影响。后续可清理 overrides.css 中不再需要的规则。

2. **styles.css 冗余**：主样式表仍有约 4600 行，包含未启用的 v2 combat-layout 样式，后续需清理。

3. **App.tsx 仍过大**：内联组件（CombatStage、QiZoneBoard、ActionPanel 等 15+ 函数）仍在 App.tsx 中，后续阶段逐步提取。

4. **PhaseActionBar 无交互**：底部阶段条仅显示当前阶段，无点击推进交锋流程的功能。

5. **非 npm 包管理器的兼容性**：`npm run dev` 被禁用（提示 R5 UI is disabled），必须使用 `npm run dev:legacy`。

---

## 9. 下一轮建议（PHASE 2）

**目标：把中央"共享交锋舞台"改成真正的战术组件**

- 新增 `CombatStage` 组件，使用绝对定位或 SVG 线条绘制角色节点和距离线
- 新增 `CombatantNode` 组件，精简显示（头像/姓名/气血条/势/状态标签）
- 新增 `DistanceLine` 组件，清晰显示角色间距离关系
- 中央舞台不再显示完整敌方公开卡
- 点击敌方节点触发 `selectedCombatantId` 状态
- 新增 mock 数据文件供独立开发
- 从 App.tsx 提取 CombatStage 到独立文件
