# 大梁江湖 TRPG 交锋辅助桌面原型

首版定位：本地 Web 原型，用于验证“大梁江湖 TRPG 专用交锋辅助桌面”的核心闭环。

## 已实现

- 桥陵镇雨夜失镖内置样例团包。
- 启动首页、房间设置、身份选择、玩家桌面、DM主持台。
- 玩家、短兵客、黑衣脚夫预设数据。
- 气骰五区：气池、气海、锁气、息库、临气区。
- 交锋流程：开始场景、宣言锁气、截击取消、成招、应招、落果。
- 手动入口：调息、返照、来源失效、势变化、轮次结束、DM 裁定。
- 玩家端 / DM端按身份进入；开发调试全量视图仅作为顶部调试入口。
- 玩家视图隐藏 DM 信息、隐藏轨、敌人隐藏目标和敌方截击挂载。
- 气骰操作区按“气海最大、临时来源在锁气上方、锁气分阴阳槽、息库右侧、气池折叠”布局。
- 气骰支持基础拖拽到阴槽/阳槽，不合法拖拽给出小提示并回弹。
- 骰子主卡只显示阴/阳/中、点数和骰阶；来源保留在详情提示中。
- 单位卡统一显示势徽记和状态栏，势贴近名称，状态栏位于势下方。
- 交锋桌面增加回合条、时点条、距离线和当前行动栈。
- 背包分栏：装备、药物、器具、杂物、临时来源。
- 物品事件：使用药物生成临时气骰、装备/卸下、物品触发来源失效。
- 浏览器本地保存当前交锋状态。
- 浏览器本地保存房间和身份会话。
- 规则纯函数测试。

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

## 开发文档入口

| 文档 | 说明 |
|------|------|
| [PHASE 0 — 审查基线](docs/devlog/README_UI_PHASE0_2026年6月24日.md) | 技术栈、目录结构、UI 问题诊断 |
| [PHASE 1 — 三栏桌面](docs/devlog/README_UI_PHASE1_2026年6月24日.md) | CombatShell 骨架、三栏布局 |
| [PHASE 2 — 战术舞台](docs/devlog/README_UI_PHASE2_2026年6月24日.md) | CombatantNode、SVG 距离线 |
| [PHASE 3 — 敌方公开卡](docs/devlog/README_UI_PHASE3_2026年6月24日.md) | 选中展开、player/dm 双模式 |
| [PHASE 5 — 气骰拖拽](docs/devlog/README_UI_PHASE5_2026年6月24日.md) | 卡牌式拖骰、确认宣言条件 |
| [PHASE 6 — 状态机](docs/devlog/README_UI_PHASE6_2026年6月24日.md) | 阶段按钮、自然语言提示 |
| [PHASE 7 — 玩家/DM分离](docs/devlog/README_UI_PHASE7_2026年6月24日.md) | DebugPanel、DmControlPanel、PlayerPromptBar |
| [PHASE 8 — 导航收束](docs/devlog/README_UI_PHASE8_2026年6月24日.md) | 六根/内功并入人物抽屉 |
| [PHASE 9 — 设计Token](docs/devlog/README_UI_PHASE9_2026年6月24日.md) | 颜色语义统一 |
| [总结文档](docs/devlog/README_UI_COMBAT_REFACTOR_SUMMARY_2026年6月24日.md) | 架构、组件树、状态机、已知问题 |

## 主要组件位置

```
src/ui/combat/CombatShell.tsx    — 桌面外壳
src/ui/combat/TopCombatBar.tsx   — 顶部导航栏
src/ui/combat/PhaseActionBar.tsx — 底部阶段按钮
src/ui/combat/stage/CombatStage.tsx — 战术舞台
src/ui/combat/dice/QiDiceDock.tsx   — 气骰拖拽区
src/ui/combat/enemy/EnemyPublicDrawer.tsx — 敌方信息卡片
src/lib/combat/qiAssignment.ts       — 拖拽验证逻辑
src/lib/combat/combatPhaseMachine.ts — 阶段状态机
```

## 首版边界

- 不做联网多人同步。
- 不导入 xlsx 数据库。
- 不实现完整角色创建。
- 不做 AI DM、NPC 自然语言或玩家推理判定。
- UI 动画只读取事件；规则结果来自规则层。
