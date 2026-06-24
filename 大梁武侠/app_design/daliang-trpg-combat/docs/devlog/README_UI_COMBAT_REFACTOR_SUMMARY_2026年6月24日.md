# 大梁江湖 TRPG 交锋 UI 重构总结

**日期**: 2026-06-24  
**分支**: ui-combat-refactor  
**版本**: 内测 0.2.0

---

## 本次 0-10 阶段完成了什么

| 阶段 | 内容 | 核心产出 |
|------|------|----------|
| PHASE 0 | 审查仓库，建立基线 | 技术栈判断、目录结构、34 项测试通过确认 |
| PHASE 1 | 三栏交锋桌面骨架 | CombatShell / TopCombatBar / Left/Center/Right Panel / PhaseActionBar |
| PHASE 2 | 战术舞台替代裁切图片 | CombatantNode / SVG DistanceLine / SceneObjectiveMini / buildStageData |
| PHASE 3 | 敌方公开卡 → 选中展开 | EnemyPublicDrawer / EnemyPublicCard / EnemyWeaknessList / player/dm 双模式 |
| PHASE 5 | 卡牌式气骰拖拽 | QiDiceDock / QiDie / QiPool / CurrentMoveSlots / qiAssignment 纯函数 |
| PHASE 6 | 状态机驱动阶段按钮 | combatPhaseMachine / getAvailablePhaseActions / getPhaseHint / 自然语言提示 |
| PHASE 7 | 玩家/DM/调试分离 | DebugPanel (仅 DEV) / DmControlPanel (提取) / PlayerPromptBar |
| PHASE 8 | 导航收束 | 六根/内功并入人物抽屉 CharacterDrawerTabs / 顶部仅保留 7 个入口 |
| PHASE 9 | 设计 Token 统一 | 语义颜色别名: --color-bg-main / --color-border-active / --color-warning 等 |
| PHASE 10 | 测试与文档 | 34 项引擎测试 + 34 项 UI 逻辑测试 / 总结文档 / package.json scripts |

---

## 当前交锋 UI 架构

```
App.tsx (路由)
  ├── 首页 / 创建房间 / 加入房间 (原样保留)
  └── 交锋路由 (isDeskRoute)
        ├── PlayerSceneDesk ──→ CombatShell
        ├── PlayerCombatDesk ─→ CombatShell
        ├── DmSceneDesk ──────→ CombatShell
        └── DmCombatDesk ─────→ CombatShell

CombatShell (全视口 grid)
  ├── TopCombatBar (56px 顶栏)
  │     ├── 游戏名 + 轮次 + 行动者 + 阶段
  │     └── 一级导航 (人物/背包/招式/状态/日志/资料/设置) + 身份标识
  ├── combat-main (三栏)
  │     ├── Left (320px): LeftCombatPanel (战斗简卡/队友/场景目标/敌方概览/动态)
  │     ├── Center (flex 1): CenterCombatPanel
  │     │     ├── CombatStage (战术舞台: CombatantNode + SVG DistanceLine + SceneObjectiveMini)
  │     │     └── QiDiceDock (气骰区: QiPool + CurrentMoveSlots + TemporaryQiPool + RestPool)
  │     └── Right (380px): RightCombatPanel
  │           ├── ActionPanel (招式宣言)
  │           ├── EnemyPublicDrawer (选中敌人时) / EnemyRoster (默认)
  │           └── PlayerFlowPanel / DmControlPanel (操作按钮)
  ├── PlayerPromptBar (玩家自然语言提示)
  ├── PhaseActionBar (状态机按钮: 每阶段仅显示可用操作)
  └── DrawerLayer (抽屉: 人物/背包/招式/状态/日志/资料/设置)
        └── CharacterDrawerTabs (基础/六根/内功/状态)
```

---

## 当前组件树

```
src/
├── combat/          规则引擎 (不变)
├── data/
│   ├── seed.ts             样例团包数据
│   └── mockCombatData.ts   舞台数据适配器
├── lib/combat/
│   ├── qiAssignment.ts     拖拽验证 + 确认条件 (纯函数)
│   └── combatPhaseMachine.ts 阶段状态机 (纯函数)
├── types/
│   └── combat.ts           舞台类型 (Combatant/DistanceEdge/EnemyPublicInfo/AppMode)
├── ui/
│   ├── App.tsx             主应用 (路由 + 状态)
│   ├── combat/
│   │   ├── CombatShell.tsx
│   │   ├── TopCombatBar.tsx
│   │   ├── LeftCombatPanel.tsx
│   │   ├── CenterCombatPanel.tsx
│   │   ├── RightCombatPanel.tsx
│   │   ├── PhaseActionBar.tsx
│   │   ├── stage/          战术舞台
│   │   │   ├── CombatStage.tsx
│   │   │   ├── CombatantNode.tsx
│   │   │   ├── DistanceLine.tsx
│   │   │   └── SceneObjectiveMini.tsx
│   │   ├── enemy/          敌方信息
│   │   │   ├── EnemyPublicDrawer.tsx
│   │   │   ├── EnemyPublicCard.tsx
│   │   │   └── EnemyWeaknessList.tsx
│   │   ├── dice/           气骰区
│   │   │   ├── QiDiceDock.tsx
│   │   │   ├── QiDie.tsx
│   │   │   ├── QiPool.tsx
│   │   │   ├── CurrentMoveSlots.tsx
│   │   │   ├── TemporaryQiPool.tsx
│   │   │   └── RestPool.tsx
│   │   ├── player/
│   │   │   └── PlayerPromptBar.tsx
│   │   └── dm/
│   │       └── DmControlPanel.tsx
│   ├── components/        通用组件 (Button/Dialog/Drawer/Tabs/Toast/Tooltip/GamePanel/UnitCard)
│   ├── layouts/           原布局组件 (保留，非交锋路由使用)
│   └── debug/
│       └── DebugPanel.tsx
└── styles/
    ├── tokens.css          设计 Token (含语义别名)
    ├── layout.css          非交锋布局
    ├── combat-shell.css    交锋桌面布局
    ├── combat-stage.css    战术舞台样式
    ├── enemy-card.css      敌方信息公开卡样式
    ├── qi-dice.css         气骰区样式
    ├── debug-panel.css     调试面板样式
    ├── components.css      通用组件样式
    ├── styles.css          主样式 (部分冗余待清理)
    └── overrides.css       覆盖样式
```

---

## 当前气骰拖拽规则

1. **前提条件**：已选招式 + 已选目标 + 阶段为 declare/scene
2. **阴骰 → 阴槽**，**阳骰 → 阳槽**，**原始骰 → 任意槽**
3. 不合法拖入 → 红色 toast 1.8 秒后消失，骰子自动回气海
4. 同一骰子只能在一个槽中，拖入新槽自动从旧槽移除
5. 点击槽中骰子 → 返回气海
6. 确认宣言需满足：阴槽 ≥ 1 + 阳槽 ≥ 1（正式出手）/ 任意槽 ≥ 1（便行）

---

## 玩家/DM 模式差异

| 层面 | 玩家 | DM |
|------|------|-----|
| 顶部导航 | 人物/背包/招式/状态/日志/资料/设置 | 玩家/敌人/距离/裁定/日志/资料/设置 |
| 阶段按钮 | 仅显示 public/both 按钮 | 显示所有按钮（含截击/应招/跳过响应） |
| 敌方信息 | 仅公开字段（名称/HP/势/状态/简介/弱点/招式） | 额外显示隐藏目标/隐藏状态/掉落线索/DM备注 |
| 提示语 | "选择招式、目标，并投入气骰" | "请选择是否开启截击/应招窗口" |
| 调试面板 | 隐藏（除非 debugView 手动开启） | 开发模式下可见 |
| 保存状态 | 自动保存（不显示"未保存"提示） | 显示保存时间 |

---

## 测试覆盖

```
combat engine      34 tests ✅  (规则引擎)
qiAssignment        8 tests ✅  (拖拽验证)
combatPhaseMachine 20 tests ✅  (状态机/阶段/提示/转换)
canConfirmDeclaration 7 tests ✅ (确认宣言条件)
─────────────────────────────────
Total              68 tests ✅
```

运行命令: `npm run test:all`

---

## 已知问题

1. **styles.css 仍有 ~4600 行冗余**：包含未使用的 v2 combat-layout 样式，后续清理。
2. **旧 QiZoneBoard 函数未删除**：仍在 App.tsx 中但不再被调用。
3. **FighterGroup/PendingPreview/createCombatBoardSnapshot 死代码**：保留在 App.tsx 中。
4. **Phaser 依赖已移除**但 package.json 中仍有 phaser 包引用。
5. **GitHub push 偶发超时**：网络不稳定，需手动重试。
6. **3D 骰子托盘 (QiDiceTray) 不再渲染**：原 Three.js 骰盘被 QiDiceDock 替代，3D 资产仍可保留用于投掷动画。

---

## 下一步开发建议

1. **清理死代码**：移除 App.tsx 中不再使用的函数和未使用的 CSS。
2. **集成 3D 投掷动画**：QiDiceDock 的"投掷入海"按钮可唤起 QiDiceRollOverlay。
3. **招式手牌区**：将右栏 ActionPanel 的招式卡片改为中栏底部的水平手牌。
4. **快捷键**：DM 端 1=截击 / 2=应招 / 3=跳过 / 4=落果 / 5=下一轮。
5. **响应式优化**：1920×1080 和 1366×768 双分辨率适配。
6. **无障碍 (a11y)**：ARIA 标签完善，键盘导航。
7. **Zustand 引入**：当组件间状态共享复杂度超过阈值时，引入 Zustand 替代 useState。
