# 大梁江湖 TRPG 交锋辅助桌面原型

首版定位：本地 Web 原型，用于验证“大梁江湖 TRPG 专用交锋辅助桌面”的核心闭环。

## 已实现

- 桥陵镇雨夜失镖内置样例团包。
- 启动首页、房间设置、身份选择、玩家桌面、DM主持台。
- 玩家、短兵客、黑衣脚夫预设数据。
- **气骰七区：气池、气海、锁气、息库、临气区、阴槽、阳槽。**
- **2D 卡片式气骰可视化：阴/阳/原 + D4–D20 + 当前点数。**
- **@dnd-kit 拖拽投骰：阴骰→阴槽、阳骰→阳槽、原始骰→任意槽，非法拖拽回弹+提示。**
- **宣言锁气：选招式→选目标→拖骰入槽→确认宣言并锁气→结算入息库。**
- **回气操作：调息（息库→气海，重掷）、返照（断气时取息库最低骰，不重掷）。**
- **四区概览面板 + 合计计数：气海/锁气/息库/临气数量实时显示。**
- **招式需求验证：气性门槛、势条件、装备许可、最低投入。**
- 交锋流程：开始场景、宣言锁气、截击取消、成招、应招、落果。
- 手动入口：调息、返照、来源失效、势变化、轮次结束、DM 裁定。
- 玩家端 / DM端按身份进入；开发调试全量视图仅作为顶部调试入口。
- 玩家视图隐藏 DM 信息、隐藏轨、敌人隐藏目标和敌方截击挂载。
- 单位卡统一显示势徽记和状态栏，势贴近名称，状态栏位于势下方。
- 交锋桌面增加回合条、时点条、距离线和当前行动栈。
- 背包分栏：装备、药物、器具、杂物、临时来源。
- 物品事件：使用药物生成临时气骰、装备/卸下、物品触发来源失效。
- 浏览器本地保存当前交锋状态。
- 浏览器本地保存房间和身份会话。
- 规则纯函数测试（68 项全部通过）。

## 交锋 UI 内测版运行方式

```bash
npm install
npm run dev:legacy -- --port 5174 --host 127.0.0.1
```

打开：`http://127.0.0.1:5174`

## 验证

```bash
npm run build         # TypeScript + Vite 生产构建
npm run test          # 规则引擎测试 (34 项)
npm run test:lib      # UI 逻辑测试 (34 项)
npm run test:all      # 全部测试 (68 项)
```

## 气骰系统

气骰是大梁江湖 TRPG 的核心资源系统。玩家拥有阴骰、阳骰、原始骰三种气性，通过拖拽投骰至阴槽/阳槽来满足招式门槛，确认宣言后锁气结算。

### 气骰区

| 区域 | 说明 |
|------|------|
| 气海 | 可用气骰，可见可拖拽 |
| 阴槽 / 阳槽 | 拖放目标，仅匹配气性的骰子可投入 |
| 锁气 | 已确认宣言的骰子，不可拖动 |
| 息库 | 已结算骰子，等待调息/返照取回 |
| 临气区 | 临时骰子（物品/功法生成） |

### 气骰流转

```
气池 → 投掷 → 气海 → 拖入阴/阳槽 → 确认宣言锁气 → 结算 → 息库 → 调息/返照 → 气海
```

### 当前分支说明

**当前分支：** `dice-system-first-pass`

本分支实现了完整的气骰系统 MVP（Phase 1–10）：
- 2D 卡片式气骰可视化
- @dnd-kit 拖拽投骰到阴/阳槽
- 宣言锁气 + 结算入息库
- 调息/返照回气操作
- 招式需求验证（气性、势、装备）
- 规则引擎纯函数（34 项测试通过）
- 表属性运算器、效阶结算器（部分实现）

**已知限制：** 3D 骰子尚未接入主线、多人同步未联调、招式库使用硬编码样例数据。

## 开发文档入口

| 文档 | 说明 |
|------|------|
| [气骰系统总览](docs/devlog/README_DICE_SYSTEM_SUMMARY_2026年6月24日.md) | 架构、组件树、类型、状态、流转图、测试 checklist |
| [PHASE 1 — 气骰可视化](docs/devlog/README_DICE_PHASE1_2026年6月24日.md) | 2D 卡片骰子、初始化、投掷 |
| [PHASE 2 — 拖拽投骰](docs/devlog/README_DICE_PHASE2_2026年6月24日.md) | @dnd-kit 拖拽、阴阳槽验证 |
| [PHASE 3 — 宣言锁气](docs/devlog/README_DICE_PHASE3_2026年6月24日.md) | 确认宣言、锁气、结算入息库 |
| [PHASE 4 — 回气操作](docs/devlog/README_DICE_PHASE4_2026年6月24日.md) | 调息、返照、四区面板 |
| [PHASE 5 — 投掷动画](docs/devlog/README_DICE_PHASE5_2026年6月24日.md) | 每骰 500–900ms 数字跳动 |
| [PHASE 7 — 招式接入](docs/devlog/README_DICE_PHASE7_2026年6月24日.md) | MoveCard、ActionHintBar、需求验证 |
| [PHASE 8 — 阶段整合](docs/devlog/README_DICE_PHASE8_2026年6月24日.md) | PhasePromptBar 统一底部栏 |
| [PHASE 9 — 状态同步](docs/devlog/README_DICE_PHASE9_2026年6月24日.md) | DiceStore 与 CombatState 协调 |
| [UI PHASE 0 — 审查基线](docs/devlog/README_UI_PHASE0_2026年6月24日.md) | 技术栈、目录结构、UI 问题诊断 |
| [UI PHASE 1 — 三栏桌面](docs/devlog/README_UI_PHASE1_2026年6月24日.md) | CombatShell 骨架、三栏布局 |
| [UI PHASE 2 — 战术舞台](docs/devlog/README_UI_PHASE2_2026年6月24日.md) | CombatantNode、SVG 距离线 |
| [UI PHASE 3 — 敌方公开卡](docs/devlog/README_UI_PHASE3_2026年6月24日.md) | 选中展开、player/dm 双模式 |
| [UI PHASE 5 — 气骰拖拽](docs/devlog/README_UI_PHASE5_2026年6月24日.md) | 卡牌式拖骰、确认宣言条件 |
| [UI PHASE 6 — 状态机](docs/devlog/README_UI_PHASE6_2026年6月24日.md) | 阶段按钮、自然语言提示 |
| [UI PHASE 7 — 玩家/DM分离](docs/devlog/README_UI_PHASE7_2026年6月24日.md) | DebugPanel、DmControlPanel、PlayerPromptBar |
| [UI PHASE 8 — 导航收束](docs/devlog/README_UI_PHASE8_2026年6月24日.md) | 六根/内功并入人物抽屉 |
| [UI PHASE 9 — 设计Token](docs/devlog/README_UI_PHASE9_2026年6月24日.md) | 颜色语义统一 |
| [UI 总结文档](docs/devlog/README_UI_COMBAT_REFACTOR_SUMMARY_2026年6月24日.md) | 架构、组件树、状态机、已知问题 |

## 主要组件位置

```
src/ui/combat/CombatShell.tsx         — 桌面外壳
src/ui/combat/TopCombatBar.tsx        — 顶部导航栏
src/ui/combat/PhaseActionBar.tsx      — 底部阶段按钮
src/ui/combat/stage/CombatStage.tsx   — 战术舞台
src/store/diceStore.tsx               — 气骰状态管理 (Context + useReducer)
src/components/dice/QiDie2D.tsx       — 单枚 2D 气骰卡片
src/components/dice/QiDiceTray.tsx    — 气海骰盘容器
src/components/dice/QiAssignmentBoard.tsx — 拖拽投骰主界面
src/components/dice/QiDropSlot.tsx    — 阴/阳槽拖放区
src/components/dice/QiZonePanel.tsx   — 四区概览面板
src/components/dice/DraggableQiDie.tsx — 可拖拽骰子 (@dnd-kit)
src/lib/dice/diceRoll.ts              — 投掷 & 创建骰子
src/lib/dice/diceAssignment.ts        — 拖拽验证规则
src/lib/dice/qiDeclaration.ts         — 宣言锁气逻辑
src/lib/dice/qiRecovery.ts            — 调息 & 返照逻辑
src/lib/combat/qiAssignment.ts        — 引擎层拖拽验证
src/lib/combat/combatPhaseMachine.ts  — 阶段状态机
```

## 首版边界

- 不做联网多人同步。
- 不导入 xlsx 数据库。
- 不实现完整角色创建。
- 不做 AI DM、NPC 自然语言或玩家推理判定。
- UI 动画只读取事件；规则结果来自规则层。
