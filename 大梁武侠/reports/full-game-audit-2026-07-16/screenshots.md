# 2026-07-16 大审查增量截图索引

这些截图来自本轮真实操作。`01—23` 为 Playwright 驱动的本地桌面渲染层，用于稳定复现操作时点；Windows 打包程序另以系统应用控制完成冷启动和存档恢复核验。完整 Electron 缩放矩阵沿用 `reports/windows-ui-rebuild/final/` 中的 52 张实机截图。

截图目录：`app_design/daliang-trpg-combat/output/playwright/full-audit/`

| 文件 | 身份 / 页面 | 分辨率 | 说明 |
| --- | --- | --- | --- |
| 01-home-1366x768.png | 公共首页 | 1366×768 | 五个正式入口 |
| 02-character-create-step1-1366x768.png | 玩家开卡 | 1366×768 | 出身选择 |
| 03-character-confirm-1366x768.png | 玩家开卡 | 1366×768 | 五步确认、六根与背景 |
| 04-player-free-scene-1366x768.png | 玩家自由情景 | 1366×768 | 场景对象、动态分类、紧凑气海 |
| 05-player-structured-pursuit-1366x768.png | 玩家结构化情景 | 1366×768 | 初次追逐记录 |
| 07-dm-create-room-1366x768.png | DM 创建房间 | 1366×768 | 修复串档后的新房间 |
| 08-dm-room-ready-1366x768.png | DM 房间大厅 | 1366×768 | 席位与准备状态 |
| 09-dm-free-scene-1366x768.png | DM 情景运行台 | 1366×768 | 玩家共享画面监看 |
| 10-dm-hidden-drawer-1366x768.png | DM 隐藏牌匣 | 1366×768 | 隐藏人物、线索和触发器 |
| 11-dm-log-drawer-1366x768.png | DM 日志抽屉 | 1366×768 | 主持裁定记录 |
| 12-dm-manual-takeover-1366x768.png | DM 手动接管 | 1366×768 | 敌人选牌、目标和配气 |
| 13-dm-inline-intercept-1366x768.png | DM 截击 | 1366×768 | 原战桌内嵌处理 |
| 14-dm-inline-react-1366x768.png | DM 应招 | 1366×768 | 合法响应与骰子组合 |
| 15-dm-outcome-confirm-1366x768.png | DM 落果 | 1366×768 | 权威落果确认 |
| 16-player-free-scene-after-dm-1366x768.png | 诊断截图 | 1366×768 | 用于复现旧版单人/DM串档，不作为验收通过图 |
| 17-player-character-drawer-1366x768.png | 玩家人物抽屉 | 1366×768 | 身份、立绘和装备区 |
| 18-player-character-roots-1366x768.png | 玩家六根页 | 1366×768 | 六根与属性 |
| 19-player-inventory-drawer-1366x768.png | 玩家背包 | 1366×768 | 暗色网格背包与物品详情 |
| 20-player-response-cards-1366x768.png | 玩家招式库 | 1366×768 | 修复后的真实响应卡筛选 |
| 21-player-structured-pursuit-retest-1366x768.png | 玩家结构化追逐 | 1366×768 | 只保留三名已编排参与者 |
| 22-player-combat-1366x768.png | 玩家战斗 | 1366×768 | 最低验收分辨率完整桌面 |
| 23-player-combat-1920x1080.png | 玩家战斗 | 1920×1080 | 标准分辨率完整桌面 |

`06-dm-create-room-1366x768.png` 是修复前对照图；验收以 `07` 为准。
