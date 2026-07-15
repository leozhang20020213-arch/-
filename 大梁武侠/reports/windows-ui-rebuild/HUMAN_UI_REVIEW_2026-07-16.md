# 《大梁武侠》人类使用导向 UI 覆盖调整审查

日期：2026-07-16

## 本轮目标

本轮不是更换一套表面皮肤，而是把全应用的注意力顺序重新整理为“先看当前局面，再看可做之事，最后查看规则依据”。玩家端不再以程序状态、自动流程或长篇规则说明作为视觉中心；DM 端也不再复用玩家手牌桌面，而以场景、请求、隐藏信息和裁定为中心。

## 已完成调整

- 建立统一的深木、暗宣纸、皮革、青铜、暗金、玉青和朱砂视觉令牌，并在最后加载的 `human-ui.css` 中覆盖旧页面的零散表现。
- 首页改为玩家与主持两个明确的身份入口，资料库、旁观和设置退到次级工具区。
- 情景页以场景画布、对象和当前目标为第一视觉层；行为分类、可用卡和述意编辑器位于固定下层。已有卡牌与目标时不强迫玩家填写文字。
- 战斗页以行动顺序、抽象距离战场、目标线、手牌和气骰动作台为主。选中卡成为唯一焦点，规则长文只进入悬停与详情。
- 响应仍在原战场、手牌和气骰区域内处理。实测中修复了无普通行动牌时响应动作台被压缩、下方出现大块空区的问题。
- 人物、背包和招式改为深色大型覆盖页；日志、卷宗和设置保留独立滚动。打开覆盖页不改变已选卡、目标、已投入骰或响应状态。
- 房间创建与大厅统一为深木主持台，并修复席位文字、次按钮和禁用按钮在暗背景上的低对比度。
- DM 情景台、战斗台与创作工作台保持独立信息结构；主持视角不显示玩家式手牌主焦点。
- 资料库和团包管理统一到同一阅读层，同时保留数据审校状态，但将玩家可见的技术化“自动 DM”字样收束为“规则主持”或“权威结算”。
- 所有核心操作补齐键盘焦点；尊重 `prefers-reduced-motion`，并通过统一速度变量控制悬停、卡牌推出、抽屉和反馈动画。
- 1366×768 下重新压缩布局，而不是依赖页面级滚动；过小的情景卡正文与操作文字已提升到可读尺度。

## 真实使用流程审查

通过 Playwright 驱动实际运行页面完成以下操作：

1. 首页进入玩家流程并选择角色。
2. 在自由情景中选择卡牌、对象与气骰，执行调查。
3. 推进结构化追逐并进入交涉。
4. 情景自然转入战斗，沿用原气海而不重投。
5. 在战斗中选牌、选目标、双击投入阴阳骰并确认宣言。
6. 等待敌方自动行动并处理玩家截击/应招机会。
7. 使用原始骰的阴阳槽二选一，确认响应后继续到第二轮。
8. 打开人物与背包覆盖页，确认主流程状态保持。
9. 审查 DM 情景、DM 战斗、剧情工坊、房间、设置、资料库和团包管理。

本次真实流程直接发现并修正：响应区裁切、响应态无牌布局空洞、房间按钮层级不清、席位文字对比不足、1366 情景卡正文过小等问题。

## 截图索引（本轮视觉覆盖）

| 文件 | 身份 / 页面 | 审查重点 |
| --- | --- | --- |
| [54-home-human-guidance-1366x768-100.png](final/54-home-human-guidance-1366x768-100.png) | 公共 / 首页 | 身份入口与视觉优先级 |
| [55-player-scene-human-guidance-1366x768-100.png](final/55-player-scene-human-guidance-1366x768-100.png) | 玩家 / 自由情景 | 场景、卡牌、述意与紧凑气海 |
| [56-player-combat-human-guidance-1920x1080-100.png](final/56-player-combat-human-guidance-1920x1080-100.png) | 玩家 / 战斗 | 战场、顺序、手牌与气域整体比例 |
| [57-combat-card-focus-1920x1080-100.png](final/57-combat-card-focus-1920x1080-100.png) | 玩家 / 选牌 | 单卡焦点与目标引导 |
| [58-inline-response-human-guidance-1920x1080-100.png](final/58-inline-response-human-guidance-1920x1080-100.png) | 玩家 / 响应 | 原桌面内嵌响应与动作台修复 |
| [59-player-combat-human-guidance-1366x768-100.png](final/59-player-combat-human-guidance-1366x768-100.png) | 玩家 / 战斗 | 最低分辨率一屏操作 |
| [60-character-cover-human-guidance-1920x1080-100.png](final/60-character-cover-human-guidance-1920x1080-100.png) | 玩家 / 人物 | 大型人物覆盖页与装备位 |
| [61-inventory-cover-human-guidance-1920x1080-100.png](final/61-inventory-cover-human-guidance-1920x1080-100.png) | 玩家 / 背包 | 暗黑式装备与网格背包 |
| [62-room-create-human-guidance-1366x768-100.png](final/62-room-create-human-guidance-1366x768-100.png) | DM / 创建房间 | 主次设置和高级网络收束 |
| [63-room-lobby-human-guidance-1366x768-100.png](final/63-room-lobby-human-guidance-1366x768-100.png) | DM / 房间大厅 | 席位、准备与阻塞原因 |
| [64-dm-scene-human-guidance-1366x768-100.png](final/64-dm-scene-human-guidance-1366x768-100.png) | DM / 情景运行台 | 场景树、共享画面与请求队列 |
| [65-dm-combat-human-guidance-1366x768-100.png](final/65-dm-combat-human-guidance-1366x768-100.png) | DM / 战斗运行台 | 监看、接管与落果控制 |
| [66-dm-studio-human-guidance-1920x1080-100.png](final/66-dm-studio-human-guidance-1920x1080-100.png) | DM / 剧情工坊 | 资源库、画布、检查器与验证区 |
| [67-settings-human-guidance-1920x1080-100.png](final/67-settings-human-guidance-1920x1080-100.png) | 公共 / 设置 | 显示、动画、声音和保存分组 |
| [68-rules-library-human-guidance-1920x1080-100.png](final/68-rules-library-human-guidance-1920x1080-100.png) | 公共 / 规则资料库 | 搜索、审校和阅读层级 |
| [69-campaign-packs-human-guidance-1920x1080-100.png](final/69-campaign-packs-human-guidance-1920x1080-100.png) | DM / 团包管理 | 团包状态与兼容性信息 |

原有 `final/01` 至 `final/53` 继续保留完整交锋时点、投骰、调息、返照、抽屉、Windows 缩放、最大化与全屏证据。本轮 `54` 至 `69` 用于记录最后的人类使用导向覆盖调整。

## 验证结果

- `npm run test:all`：184/184 通过，30 个测试套件无失败。
- `npm run build`：通过。
- `npm run desktop:pack`：通过；生成 `release/win-unpacked/大梁武侠.exe`。
- 实际 UI 流程控制台：0 错误、0 警告。
- `git diff --check`：无空白错误，仅报告仓库既有的 LF/CRLF 转换提示。

## 仍应由正式美术资源替换的内容

当前人物头像、部分场景物件、卡牌插画和材质仍属于稳定占位。布局已为立绘、装备图、物品图、卡框和场景图保留固定槽位；替换美术时不应再次改变主要信息层级或压缩战场、手牌和气骰操作空间。
