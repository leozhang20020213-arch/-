# 双模式、数据库与新手教学迁移方案

## 迁移原则

1. 不建立第二个演示项目；所有迁移发生在现有 React + Electron 应用内。
2. 先引入新类型、索引和控制器，再替换 UI；旧存档通过显式迁移读取。
3. 每个阶段保持可运行、可测试、可打包。
4. 旧桥陵镇团包在《白蘋渡失匣》完成前仍可作为开发 fixture 使用，但不再扩写。
5. 新数据库 UI 只读索引，不在组件中硬编码卡牌。

## 目标分层

```text
AppSession
├─ identity / room / permissions / save metadata
├─ SceneSession
│  ├─ mode: SCENE_FREE | SCENE_STRUCTURED
│  ├─ scene state / objects / tracks / facts / drafts
│  └─ optional StructuredSceneSequence
├─ CombatEncounter? 
│  ├─ combat round / initiative / phase / pending outcome
│  └─ combat-only response quotas and acted state
└─ SharedCharacterState
   ├─ hp / momentum / status / equipment
   └─ qi pool / sea / lock / slots / rest / temporary
```

工作区组件必须同样拆分：

```text
PlayerSceneWorkspace
PlayerCombatWorkspace
DMRuntimeDesk
DMCreatorStudio
```

四者可以复用卡牌、气骰、人物牌、日志等原子组件，但不得用一个巨大组件通过标题和条件分支模拟四种桌面。

## 类型迁移

### 会话与 encounter

- 新增 `WorkspaceMode` 与 `SceneMode`。
- 新增 `AppSessionState`、`SceneSessionState`、`StructuredSceneSequence`、`CombatEncounterState`。
- 旧 `CombatState` 暂时保留为兼容层；阶段 1 提供 `migrateLegacyCombatState`。
- 存档 schema 增加版本号。旧 `encounterMode: scene` 映射为 `SCENE_STRUCTURED`，避免旧存档丢失正在进行的队列；新开团默认 `SCENE_FREE`。
- 旧统一 `round` 在迁移时：情景存入 `scene.sequence.round`，进入战斗后新 encounter 固定从 1 开始。

### 招式

- `MoveDefinition` 只描述名称、类别、流派、品级、阴阳、式位、说明和美术绑定。
- `MoveUsage` 描述使用域、模式、行动类型、时点、目标、距离、装备、势、最低投入、基础效果、触发、风险和资源去向。
- 响应挂载引用 usage，不复制主用法效果。
- 旧 `Move` 通过 `legacyMoveToDefinitionAndUsage` 迁移；缺少使用域时依据 timing/category 产生明确迁移警告。

### 响应额度

- 新增 `ResponseBudget`：`proactiveUsed/maxProactive` 与 `selfDefenseUsed/maxSelfDefense`。
- 旧 `responseQuotaUsed/maxResponseQuota` 迁移为主动响应额度；目标本人自保默认按规则模板生成，避免悄悄重复已消耗额度。
- 阶段 1 同时保留旧字段只读派生，阶段 3 UI 完成后移除写入路径。

## 各阶段代码边界

### 阶段 1

- `src/domain/session/*`：三态、转换和存档迁移。
- `src/data/schema/*`：MoveDefinition/MoveUsage/ResponseUsage/ArtBinding。
- `src/controllers/scene/*` 与 `src/controllers/combat/*`：独立控制器最小骨架。
- 新增模式切换、战斗先后独立、usage 过滤、响应额度、调息/返照冻结测试。

### 阶段 2—5

- 按工作区迁移 JSX，逐步削减 `App.tsx`。
- 先迁玩家情景，再迁战斗响应，再迁大型覆盖页，最后迁日志和设置。
- 每个旧页面只有在新页面通过功能测试和截图验收后才删除。

### 阶段 6—9

- DM 创作工作台输出版本化 Campaign Pack。
- 正式数据库按 schema 生成索引和审计报告。
- 美术由 manifest 绑定。
- 《白蘋渡失匣》作为第一个完整新格式团包验证全部系统。

## 存档与网络兼容

- 每个动作事务、响应、落果和 DM 覆盖必须有唯一事务 ID。
- 新客户端不得把旧客户端发来的重复消息重复结算。
- 团包 manifest、数据库 schema 和存档各自版本化。
- 无迁移器时，在开房前显示不兼容报告并阻止运行，不能静默丢字段。
- 语音原始音频不进入存档和网络广播；只发送确认后的文本和结构化行动。

## 删除时机

- `PlayerResponseWorkbench`：阶段 3 内嵌响应通过后删除。
- 旧窄人物/背包 drawer 内容：阶段 4 大型覆盖页通过后删除。
- 组件中的旧样例卡牌数组：阶段 7 索引通过后删除。
- `bridge/旧堤仓` 默认入口：阶段 9 教学团包完整通关后删除；legacy fixture 保留测试。
- 旧 `encounterMode` 和统一 `round` 写路径：阶段 1 新存档迁移测试稳定后停止写入，阶段 9 前彻底移除。

## 阶段验收门

每个阶段必须同时满足：

- 新增行为有自动测试，旧回归测试继续通过或有冻结规则说明替换。
- `npm run build` 通过。
- 核心页面在 Electron 或受控浏览器中实际操作并截图。
- `README_PHASE_XX.md` 记录实现、已知限制、验证命令和下一阶段入口。
- 只暂存该阶段应用、测试、截图和文档；不得带入 Office 锁文件、构建缓存或无关压缩包。

