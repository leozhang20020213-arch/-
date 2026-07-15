# 大梁武侠 Windows 桌面版

《大梁武侠》是以 React 作为渲染层、Electron 作为 Windows 桌面外壳的武侠 TRPG 游戏。当前版本围绕玩家情景、战斗交锋、规则型自动 DM、真人 DM 运行台和剧情创作工作台建立完整闭环，核心功能不依赖互联网。

## 当前能力

- Windows 桌面外壳：隔离 preload、关闭渲染层 Node 权限、正式构建关闭开发工具。
- 冷启动首页：玩家游玩、主持开团、旁观入席、规则资料库和设置。
- 三运行态：自由情景、结构化情景和战斗；情景转战斗沿用气骰与状态，不重新投骰。
- 玩家交锋：横向卡牌手牌、抽象距离战场、七区气域、目标线和内嵌响应。
- 权威流程：宣言、锁气、截击、成招、应招、落果、资源去向、下一角色和统一轮末。
- 规则型自动 DM：本地确定性裁定队友、敌人、NPC 和动景；涉及玩家响应时暂停等待。
- 真人 DM：独立运行台、隐藏牌匣、手动接管、广播与覆盖记录。
- DM 创作：团包、章节、场景、区域、人物、物件、线索、事件、触发器、奖励和战斗配置。
- 角色与资源：人物、六根、内功、装备、暗黑式网格背包、招式库、日志和设置覆盖页。
- Windows 本地存档：由 Electron 写入应用数据目录，并迁移兼容旧 `localStorage` 存档。
- 局域网骨架：DM 房主、房间码、席位、版本握手、权威快照、断线恢复和事务去重。
- 教学团包：《白蘋渡失匣》，覆盖调查、交涉、追逐、战斗、响应、调息、返照与多结局结构。

本项目不包含语音输入、录音、语音转文字、麦克风权限或语音日志。背景音乐、环境音和游戏音效仍可作为 DM 场景媒体资源。

## 开发与运行

在本目录执行：

```powershell
npm install
npm run desktop:dev
```

常用验证命令：

```powershell
npm run test:all
npm run build
npm run desktop:pack
```

`desktop:pack` 生成 Windows x64 目录包：

```text
release/win-unpacked/大梁武侠.exe
```

该目录包已从实际可执行文件启动验证。安装器封装不作为本次已通过产物声明。

## 验收状态

| 项目 | 结果 |
| --- | --- |
| 自动测试 | 27 个套件，146/146 通过 |
| TypeScript + Vite 生产构建 | 通过 |
| Windows x64 目录包 | 通过 |
| 实际 Electron 完整玩家流程 | 通过 |
| DM 房间、运行台与创作台 | 通过 |
| 1366×768 与 1920×1080 | 通过 |
| Windows DPR 1.0 / 1.25 / 1.5 | 通过 |
| 窗口化、最大化、F11 全屏 | 通过 |
| 断网运行与 2D 骰子回退 | 通过 |
| Electron 控制台错误 | 0 |

实际 Electron 截图、每张截图的身份与时点说明见：

- [Windows UI 截图索引](../../reports/windows-ui-rebuild/README.md)
- [Windows 桌面实现说明](docs/windows-desktop-rebuild.md)

## 主要结构

```text
electron/                       Windows 外壳、存档桥接与内嵌 LAN 房主
src/combat/                     权威交锋状态与规则事务
src/controllers/scene/         情景运行与模式切换
src/data/schema/                招式用法、可用性与公共数据接口
src/data/campaign/              团包、教学内容与结构校验
src/domain/session/             三运行态、身份与会话状态
src/lib/combat/                 自动角色、目标、配气与行动序列
src/lib/scene/                  规则型情景自动 DM
src/net/                        LAN 协议与客户端
src/ui/scene/                   玩家自由 / 结构化情景桌面
src/ui/combat/                  战斗桌面、手牌、气骰和反馈
src/ui/dm/                      真人 DM 运行台与创作工作台
src/ui/overlays/                人物、背包、招式等大型覆盖页
```

## 规则与数据边界

- `MoveDefinition` 描述招式本体，`MoveUsage` 描述情景、战斗、截击或应招中的具体用法。
- UI 通过 `AvailabilityResult` 展示模式、时点、距离、目标、装备、势、气骰和额度等禁用原因，不自行猜测规则。
- 只有结构化效果可以修改权威状态；自由文本用于叙事，不直接改变数值。
- 遇到规则书没有冻结的内容，应记录规则问题，不批量发明招式或数值。
- 3D 与 2D 只负责表现，权威随机结果和日志由规则层决定。

## 当前发布说明

本次已验证的是 Windows x64 目录版。`desktop:dist` 在当前构建环境中完成应用打包后未能稳定结束安装器封装，因此没有把 NSIS 或 portable 安装包列为交付完成项。目录版可直接运行，后续如需正式分发安装器，应单独复核签名、安装路径与杀毒软件兼容性。
