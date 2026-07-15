# 阶段 1：双模式底层与招式用法

日期：2026-07-15
前置提交：`931aa05b docs: freeze July 15 dual-mode rebuild baseline`

## 已实现

### 三态运行会话

新增 `RuntimeSessionState`：

- `SCENE_FREE`：默认自由情景，不建立强制行动队列。
- `SCENE_STRUCTURED`：追逐、潜入、救援、争夺等结构化情景，拥有独立的情景序列快照。
- `COMBAT`：拥有独立 `CombatEncounterState`、战斗轮次、先后、已行动角色和时点。

情景转战斗时：

- 共享角色、气骰、场景对象、轨道、状态和装备保持不变；
- 创建稳定 encounter 标识；
- 战斗轮固定从第 1 轮开始；
- 重新建立战斗先后；
- 不重新投骰。

战斗返回情景时：

- 关闭 combat encounter；
- 恢复原情景控制器；
- 写入战斗摘要；
- 不自动调息、返照、恢复、重投或清除场景对象。

旧存档没有运行壳时按兼容原则迁移：旧 `scene` 模式映射为 `SCENE_STRUCTURED`，避免丢失已经存在的行动队列；新建会话默认 `SCENE_FREE`。

### 招式定义与用法分离

新增：

- `MoveDefinition`
- `MoveUsage`
- `ResponseUsage`
- `AvailabilityRule`
- `MoveTrigger`
- `ArtBinding`

使用域固定为：

- `SCENE_ONLY`
- `COMBAT_ONLY`
- `BOTH`
- `TRANSITION`
- `DM_ONLY`
- `PASSIVE`

`isUsageAvailableInMode` 和 `usagesForMode` 是后续情景行为区与战斗手牌的唯一模式过滤入口。旧 `Move` 通过兼容适配器生成 definition + legacy main usage，不在 UI 组件中继续推断模式。

### 双响应额度

新增 `ResponseBudget`：

- `proactiveUsed/maxProactive`：截击、第三方护人等主动介入。
- `selfDefenseUsed/maxSelfDefense`：角色成为目标时的自保应招。

截击开始写入主动额度；目标本人应招写入自保额度。旧 `responseQuotaUsed/maxResponseQuota` 暂时只作为主动额度的兼容镜像，阶段 3 内嵌响应 UI 完成后停止展示旧口径。

### 调息与返照冻结口径

- 调息保持现有正确实现：支付息引、消耗主行动、默认取回 1 枚常规骰、保留点数、不治疗。
- 返照已改为：断气且仍有行动机会时，取回息库最低阶本命骰并重投；每轮一次；不消耗正式出手。
- 玩家手牌上的返照标签已同步改为“随手便行·特殊 / 保留出手”，不再显示旧“耗行动”。

## 控制器边界

- `src/controllers/scene/sceneController.ts`
  - 新场景投骰；
  - 自由/结构化情景切换且不重投；
  - 战斗收束回情景。
- `src/controllers/combat/combatController.ts`
  - 从情景创建战斗 encounter；
  - 确认独立战斗先后。

旧 `CombatState` 顶层 `round/phase/initiativeOrder` 暂时保留为现有 UI 兼容镜像。新功能不得再把它们当作跨模式唯一权威源。

## 测试

`npm run test:all`：

```text
tests 136
pass 136
fail 0
```

新增覆盖：

- 新会话默认自由情景。
- 旧存档迁移为结构化情景。
- 情景第 4 轮进入战斗仍从战斗第 1 轮开始。
- 情景转战斗与返回均不改变气骰区域和值。
- scene-only / combat-only usage 不跨工作区泄漏。
- 主动响应与自保应招额度相互独立。
- 返照重投、每轮一次且保留正式出手。
- 旧 UI 的场景投骰后确认先后仍落在结构化情景控制器，不误建战斗 encounter。

`npm run build`：TypeScript 与 Vite 生产构建通过。

## 实际浏览器验收

使用 Playwright CLI 在 1920×1080 实际完成：

1. 首页 → 新开单人故事。
2. 选择沈青 → 踏入江湖。
3. 完成新场景骰面写入。
4. 进入现有结构化情景桌面。
5. 确认返照卡显示新冻结口径。
6. 检查控制台：0 error，0 warning（React 开发工具提示不计为 warning）。

验收截图：

- `output/playwright/phase-01/home-1920.png`
- `output/playwright/phase-01/player-scene-structured-1920.png`

实际验收曾发现并修复一个集成错误：旧 UI 在场景投骰后复用 `confirmInitiative` 建立情景序列，新实现最初把它错误限定为战斗 encounter，导致进入场景白屏。现已按 runtime mode 分流，并新增回归测试。

## 已知边界与下一阶段

- 当前玩家情景页面仍是上一轮“统一交锋台”的结构化外观；阶段 2 将建立真正的 `PlayerSceneWorkspace`，默认自由情景不会显示敌我战斗阵列和战斗顺序。
- 现有角色数据仍由旧 `Move[]` 提供；阶段 2 使用教学白名单接入 `MoveUsage`，阶段 7 再扩充正式数据库。
- 响应底层已拆额度，但现有 UI 仍是右侧工作台；阶段 3 将完全迁入原手牌和气骰台。
- 大型人物/背包、聚合日志、DM 创作工作台和《白蘋渡失匣》依次在后续阶段实现。
