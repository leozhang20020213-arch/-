# 2026-07-15 一次性覆盖重构落地记录

本文件保留原路径以承接既有开发引用，但本轮不再执行长期分期迁移。React + Electron 工程已按一次大范围覆盖调整完成情景、战斗、自动角色、DM、抽屉、数据接口、局域网和桌面发布收束。

## 落地原则

1. 不建立第二个演示项目，不恢复 Godot，不提供网站部署。
2. 保留可用规则引擎、Three.js 骰子、房间骨架和已有测试，在原工程内覆盖重构。
3. 三运行态、玩家 / DM 权限、招式定义 / 用法、存档和网络结构均使用显式版本化数据。
4. 规则权威先于表现；卡牌、骰子和动画只呈现已经确定的事务结果。
5. 不实现语音、录音或转写；存档与网络只接受确认文本和结构化行动。
6. 本轮只在全部测试、构建、实机流程和截图通过后创建一次提交。

## 最终会话结构

```text
AppSession
├─ identity / room / permissions / save metadata
├─ SceneSession
│  ├─ mode: SCENE_FREE | SCENE_STRUCTURED
│  ├─ scene state / objects / tracks / facts / drafts
│  └─ optional StructuredSceneSequence
├─ CombatEncounter?
│  ├─ combat round / initiative / phase / pending outcome
│  └─ proactive response / self-defense response budgets
└─ SharedCharacterState
   ├─ hp / momentum / status / equipment
   └─ pool / sea / temporary / lock / yin / yang / rest
```

工作区拆分为：

```text
PlayerSceneWorkspace
PlayerCombatWorkspace
DMRuntimeDesk
DMCreatorStudio
```

四者复用卡牌、人物牌、骰子、日志和规则事务，但不再通过一个玩家式布局模拟不同身份。

## 已完成覆盖

### 情景与战斗

- 自由情景没有强制队列；结构化情景只在追逐、潜入、争夺与限时事件中启用。
- 情景行动支持动态行为分类、卡牌 / 法门 / 物品、对象、可选办法和公开范围。
- 情景转战斗保留气海、息库、临气、状态、对象和轨道，不重新投骰。
- 战斗使用独立顺序、轮次、目标线、七区气域和横向手牌。
- 截击与应招已从独立工作台迁回原手牌与气骰动作台。

### 规则与自动角色

- `MoveDefinition` 与 `MoveUsage` 分离，模式与时点不再由 UI 猜测。
- `AvailabilityResult` 返回模式、时点、距离、目标、装备、势、气骰和响应额度等原因。
- 主动响应额度与目标本人自保应招额度分开记录。
- 自动角色覆盖队友、敌人、NPC 和动景；涉及玩家响应时暂停。
- 无合法招式时按移动、调整势、调息、返照和放弃行动兜底，禁止死循环。
- 调息与返照按 2026-07-15 冻结口径实现并有测试覆盖。

### UI 与桌面

- 玩家战斗收束为顶部顺序、中央抽象距离战场、七区气域、横向手牌和边缘题签。
- 人物、背包和招式改为大型覆盖页；日志、卷宗和设置保留窄抽屉。
- DM 运行台与剧情创作工作台使用独立布局。
- Electron 冷启动首页、受限 preload、应用数据存档、窗口控制和 Windows x64 目录包完成。
- 1366×768、1920×1080、DPR 1.0 / 1.25 / 1.5、最大化和全屏完成实际窗口复核。

### 数据、教学与 LAN

- `CampaignPack`、`SceneElement`、`TriggerCondition`、`CombatSetup`、`RewardDefinition` 和 `MediaAssetRef` 可版本化校验。
- 《白蘋渡失匣》作为默认教学团包接入，旧样例只保留兼容 fixture。
- 内嵌 LAN 房主覆盖房间、席位、版本握手、快照、重连和事务去重。
- 停止房主时主动终止活动客户端，避免退出和自动测试悬挂。

## 验收结果

- `npm run test:all`：27 个套件，146/146 通过。
- `npm run build`：通过。
- `npm run desktop:pack`：通过，生成 `release/win-unpacked/大梁武侠.exe`。
- 实际 Electron 玩家完整流程、DM 房间 / 运行台 / 创作台、断网运行和窗口缩放复核通过。
- 截图与逐图标注见仓库根目录 `reports/windows-ui-rebuild/README.md`。

## 发布边界

本轮验证的是可直接运行的 Windows x64 目录包。安装器封装在当前环境中未稳定结束，因此没有把 NSIS / portable 安装器列为已通过交付物。正式发行安装器仍需单独处理签名、升级与杀毒软件兼容性。
