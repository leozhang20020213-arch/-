# 《大梁武侠》Windows UI 覆盖重构截图索引

生成日期：2026-07-15

运行环境：React 19 + Electron 43，Windows x64

规则依据：2026-06-20 规则包与 2026-07-15 冻结口径

截图来源：实际 Electron 窗口，不是静态设计稿

## 验收摘要

- 自动测试：27 个测试套件，146/146 通过。
- 2026-07-16 增量大审查：30 个测试套件，170/170 通过；新增开卡、团包、数据库隔离、情景路径、自动战斗、房间组合与独立存档槽测试。详见[整体游戏、开团与数据库大审查](../full-game-audit-2026-07-16/README.md)。
- 生产构建：`npm run build` 通过。
- Windows 目录包：`npm run desktop:pack` 通过，产物为 `release/win-unpacked/大梁武侠.exe`。
- 打包程序复核：从 `app.asar` 启动成功，标题、首页、路由和窗口控制正常。
- Electron 控制台：完整流程中错误 0、警告 0。
- 断网复核：关闭网络上下文后，首页、卡牌、自动规则主持和交锋仍可操作。
- 3D 骰子：建场时实际投掷；规则结果先确定，表现层异常可回退为 2D。
- 1366×768：玩家情景、玩家战斗和 DM 创作台无页面级横向或纵向滚动。
- Windows 缩放：分别以实际 Electron `devicePixelRatio` 1.25 与 1.5 启动验证；截图 50—53 为实测结果。
- 窗口状态：窗口化、最大化、全屏均已验证。

## 截图标注

除特别说明外，交锋截图均为玩家身份、第一轮、100% 缩放。表中“展开内容”为截图时额外打开的检查器、抽屉或动作台。

| 文件 | 身份 | 页面 / 模式 | 轮次 / 时点 | 分辨率 / 缩放 | 展开内容 |
| --- | --- | --- | --- | --- | --- |
| [01-home-1920x1080-100.png](final/01-home-1920x1080-100.png) | 公共 | 首页 | 非交锋 | 1920×1080 / 100% | 五个正式入口 |
| [02-settings-1920x1080-100.png](final/02-settings-1920x1080-100.png) | 公共 | 设置 | 非交锋 | 1920×1080 / 100% | 显示、动画、骰子、网络与保存 |
| [03-character-select-1920x1080-100.png](final/03-character-select-1920x1080-100.png) | 玩家 | 角色选择 | 开场前 | 1920×1080 / 100% | 人物定位与确认区 |
| [04-new-scene-dice-motion-1920x1080-100.png](final/04-new-scene-dice-motion-1920x1080-100.png) | 玩家 | 新场景建场 | 整体投骰 | 1920×1080 / 100% | 嵌入式 3D 骰盘运动中 |
| [05-new-scene-dice-settle-1920x1080-100.png](final/05-new-scene-dice-settle-1920x1080-100.png) | 玩家 | 新场景建场 | 骰面确定 | 1920×1080 / 100% | 防重叠整理后的骰盘 |
| [06-player-scene-free-1920x1080-100.png](final/06-player-scene-free-1920x1080-100.png) | 玩家 | 自由情景 | 自由行动 | 1920×1080 / 100% | 场景对象、动态分类与紧凑气海 |
| [07-scene-card-hover-1920x1080-100.png](final/07-scene-card-hover-1920x1080-100.png) | 玩家 | 自由情景 | 选择用法 | 1920×1080 / 100% | 情景卡悬停浮框 |
| [08-scene-card-target-1920x1080-100.png](final/08-scene-card-target-1920x1080-100.png) | 玩家 | 自由情景 | 选择对象 | 1920×1080 / 100% | 卡牌选中与合法目标 |
| [09-scene-first-resolution-1920x1080-100.png](final/09-scene-first-resolution-1920x1080-100.png) | 玩家 | 自由情景 | 自动 DM 裁定 | 1920×1080 / 100% | 解密、危机与日志变化 |
| [10-player-scene-structured-1920x1080-100.png](final/10-player-scene-structured-1920x1080-100.png) | 玩家 | 结构化情景 | 追逐队列 | 1920×1080 / 100% | 行动序列与场景轨 |
| [11-structured-resolution-1920x1080-100.png](final/11-structured-resolution-1920x1080-100.png) | 玩家 | 结构化情景 | 行动落果 | 1920×1080 / 100% | 追逐推进与自动角色 |
| [12-player-combat-no-reroll-1920x1080-100.png](final/12-player-combat-no-reroll-1920x1080-100.png) | 玩家 | 战斗 | 情景转战斗 | 1920×1080 / 100% | 沿用原气海与息库 |
| [13-player-combat-ready-1920x1080-100.png](final/13-player-combat-ready-1920x1080-100.png) | 玩家 | 战斗 | 宣言前 | 1920×1080 / 100% | 抽象距离战场、七区气域与手牌 |
| [14-combat-card-hover-1920x1080-100.png](final/14-combat-card-hover-1920x1080-100.png) | 玩家 | 战斗 | 选牌 | 1920×1080 / 100% | 招式卡悬停与禁用原因 |
| [15-combat-card-detail-1920x1080-100.png](final/15-combat-card-detail-1920x1080-100.png) | 玩家 | 战斗 | 选牌 | 1920×1080 / 100% | 完整招式大卡 |
| [16-combat-target-selected-1920x1080-100.png](final/16-combat-target-selected-1920x1080-100.png) | 玩家 | 战斗 | 选择目标 | 1920×1080 / 100% | 目标线与目标高亮 |
| [17-combat-dice-assigned-1920x1080-100.png](final/17-combat-dice-assigned-1920x1080-100.png) | 玩家 | 战斗 | 配气 | 1920×1080 / 100% | 阴槽、阳槽与已投入骰 |
| [18-declaration-locked-1920x1080-100.png](final/18-declaration-locked-1920x1080-100.png) | 玩家 | 战斗 | 宣言 / 锁气 | 1920×1080 / 100% | 唯一确认令牌已提交 |
| [19-auto-outcome-1920x1080-100.png](final/19-auto-outcome-1920x1080-100.png) | 玩家 | 战斗 | 成招 / 落果 | 1920×1080 / 100% | 自动角色规则结果 |
| [20-auto-round-end-1920x1080-100.png](final/20-auto-round-end-1920x1080-100.png) | 玩家 | 战斗 | 自动轮转 | 1920×1080 / 100% | 顶部顺序与战场同步变化 |
| [21-enemy-declaration-1920x1080-100.png](final/21-enemy-declaration-1920x1080-100.png) | 玩家 | 战斗 | 敌方宣言 | 1920×1080 / 100% | 敌方目标线与招式摘要 |
| [22-player-intercept-opportunity-1920x1080-100.png](final/22-player-intercept-opportunity-1920x1080-100.png) | 玩家 | 战斗 | 截击机会 | 1920×1080 / 100% | 自动流程暂停、合法响应牌高亮 |
| [23-player-inline-response-1920x1080-100.png](final/23-player-inline-response-1920x1080-100.png) | 玩家 | 战斗 | 截击配气 | 1920×1080 / 100% | 原手牌区与气骰区内嵌处理 |
| [24-react-transition-1920x1080-100.png](final/24-react-transition-1920x1080-100.png) | 玩家 | 战斗 | 截击后复核 | 1920×1080 / 100% | 自动流转至应招阶段 |
| [25-player-react-opportunity-1920x1080-100.png](final/25-player-react-opportunity-1920x1080-100.png) | 玩家 | 战斗 | 应招机会 | 1920×1080 / 100% | 自保应招额度与待落果信息 |
| [26-raw-die-slot-choice-1920x1080-100.png](final/26-raw-die-slot-choice-1920x1080-100.png) | 玩家 | 战斗 | 应招配气 | 1920×1080 / 100% | 原始骰阴 / 阳二选一浮标 |
| [27-react-dice-assigned-1920x1080-100.png](final/27-react-dice-assigned-1920x1080-100.png) | 玩家 | 战斗 | 应招配气 | 1920×1080 / 100% | 响应骰投入完成 |
| [28-react-resolved-1920x1080-100.png](final/28-react-resolved-1920x1080-100.png) | 玩家 | 战斗 | 应招 / 落果 | 1920×1080 / 100% | 应招结果与资源去向 |
| [29-round-end-1920x1080-100.png](final/29-round-end-1920x1080-100.png) | 玩家 | 战斗 | 轮末 / 第二轮 | 1920×1080 / 100% | 全员完成后统一轮末 |
| [30-fanzhao-tray-1920x1080-100.png](final/30-fanzhao-tray-1920x1080-100.png) | 玩家 | 战斗 | 返照 | 1920×1080 / 100% | 气海断气后的内嵌动作台 |
| [31-fanzhao-resolved-1920x1080-100.png](final/31-fanzhao-resolved-1920x1080-100.png) | 玩家 | 战斗 | 返照结算 | 1920×1080 / 100% | 最低阶本命骰重投、主行动保留 |
| [32-tiaoxi-config-1920x1080-100.png](final/32-tiaoxi-config-1920x1080-100.png) | 玩家 | 战斗 | 调息 | 1920×1080 / 100% | 息引与息库骰选择 |
| [33-tiaoxi-resolved-1920x1080-100.png](final/33-tiaoxi-resolved-1920x1080-100.png) | 玩家 | 战斗 | 调息结算 | 1920×1080 / 100% | 原点数取回、主行动已消耗 |
| [34-character-cover-1920x1080-100.png](final/34-character-cover-1920x1080-100.png) | 玩家 | 人物覆盖页 | 战斗中暂停查看 | 1920×1080 / 100% | 人物、装备与返回交锋入口 |
| [35-character-six-roots-1920x1080-100.png](final/35-character-six-roots-1920x1080-100.png) | 玩家 | 人物覆盖页 | 战斗中暂停查看 | 1920×1080 / 100% | 六根页签 |
| [36-inventory-cover-1920x1080-100.png](final/36-inventory-cover-1920x1080-100.png) | 玩家 | 背包覆盖页 | 战斗中暂停查看 | 1920×1080 / 100% | 装备位、网格背包与物品详情 |
| [37-move-library-cover-1920x1080-100.png](final/37-move-library-cover-1920x1080-100.png) | 玩家 | 招式覆盖页 | 战斗中暂停查看 | 1920×1080 / 100% | 模式与类别筛选 |
| [38-log-drawer-1920x1080-100.png](final/38-log-drawer-1920x1080-100.png) | 玩家 | 日志抽屉 | 战斗进行中 | 1920×1080 / 100% | 叙事、交锋、资源与系统分类 |
| [39-settings-drawer-1920x1080-100.png](final/39-settings-drawer-1920x1080-100.png) | 玩家 | 设置抽屉 | 战斗进行中 | 1920×1080 / 100% | 动画速度、骰子表现与保存 |
| [40-dm-create-room-1920x1080-100.png](final/40-dm-create-room-1920x1080-100.png) | DM | 创建房间 | 开团前 | 1920×1080 / 100% | 团包、房间与高级网络设置 |
| [41-dm-room-lobby-1920x1080-100.png](final/41-dm-room-lobby-1920x1080-100.png) | DM | 房间大厅 | 等待开团 | 1920×1080 / 100% | 席位、角色、准备与连接状态 |
| [42-dm-runtime-scene-1920x1080-100.png](final/42-dm-runtime-scene-1920x1080-100.png) | DM | 主持运行台 / 情景 | 第一轮 / 监听 | 1920×1080 / 100% | 场景树、共享画面、裁定队列 |
| [43-dm-hidden-drawer-1920x1080-100.png](final/43-dm-hidden-drawer-1920x1080-100.png) | DM | 主持运行台 / 情景 | 第一轮 / 监听 | 1920×1080 / 100% | 隐藏 NPC、线索、事件与触发器牌匣 |
| [44-dm-runtime-combat-1920x1080-100.png](final/44-dm-runtime-combat-1920x1080-100.png) | DM | 主持运行台 / 战斗 | 第一轮 / 监听 | 1920×1080 / 100% | 战斗监看、接管与落果控制 |
| [45-dm-campaign-studio-1920x1080-100.png](final/45-dm-campaign-studio-1920x1080-100.png) | DM | 剧情创作工作台 | 编辑态 | 1920×1080 / 100% | 资源库、场景画布、属性检查器与验证区 |
| [46-dm-studio-1366x768-100.png](final/46-dm-studio-1366x768-100.png) | DM | 剧情创作工作台 | 编辑态 | 1366×768 / 100% | 最低分辨率布局 |
| [47-player-scene-1366x768-100.png](final/47-player-scene-1366x768-100.png) | 玩家 | 自由情景 | 自由行动 | 1366×768 / 100% | 最低分辨率完整桌面 |
| [49-player-combat-1366x768-100.png](final/49-player-combat-1366x768-100.png) | 玩家 | 战斗 | 宣言前 | 1366×768 / 100% | 最低分辨率完整桌面 |
| [50-player-combat-1601x902-125.png](final/50-player-combat-1601x902-125.png) | 玩家 | 战斗 | 宣言前 | 1601×902 / DPR 1.25 | 实际 Electron 125% 缩放 |
| [51-player-combat-1600x901-150.png](final/51-player-combat-1600x901-150.png) | 玩家 | 战斗 | 宣言前 | 1600×901 / DPR 1.5 | 实际 Electron 150% 缩放 |
| [52-player-combat-maximized-150.png](final/52-player-combat-maximized-150.png) | 玩家 | 战斗 | 宣言前 | 2134×1270 / DPR 1.5 | 最大化窗口 |
| [53-player-combat-fullscreen-150.png](final/53-player-combat-fullscreen-150.png) | 玩家 | 战斗 | 宣言前 | 2134×1334 / DPR 1.5 | F11 全屏 |

## 实际流程记录

1. 从首页新开单人故事，选角后进入《白蘋渡失匣》。建场时自动整体投骰，骰面自动写入气海。
2. 在自由情景中执行法门、物品和自由叙事；文字在已有卡牌和目标时可省略。
3. 解密、危机、许可和资源通过规则型自动 DM 产生权威变化并进入日志。
4. 进入结构化追逐后，NPC、队友、敌人与动景按同一队列自动行动。
5. 转入战斗时沿用现有气海、息库、临气、状态和轮次，没有重新投骰。
6. 实际完成选卡、选目标、阴阳配骰、宣言、锁气、截击、成招、应招、落果和轮末。
7. 玩家成为敌方目标时，自动流程在原手牌与气骰区暂停；实际处理了一次截击和一次应招。
8. 实际验证返照只在断气时恢复最低阶本命骰并重投，不消耗正式出手；调息支付息引、保持取回骰原点数并消耗正式出手。
9. 打开人物、六根、背包、招式、日志和设置后，原选牌、目标、已投入骰和响应状态不丢失。
10. DM 端验证创建房间、席位状态、情景运行台、隐藏牌匣、战斗监看和剧情创作工作台。

## 已知发布说明

Windows `win-unpacked` 目录包已经生成并从实际可执行文件启动验证。`desktop:dist` 的安装器封装步骤在当前环境中未稳定结束，因此本次交付以可运行的 Windows x64 目录包为准，不把未生成的 NSIS / portable 文件列为已通过项。
