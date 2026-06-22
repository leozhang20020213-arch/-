# README_UI_PHASE1

## 完成内容

- 下载并使用项目内便携 Godot 4.7，不做全局安装。
- 备份旧 React/Phaser UI，并停用旧 UI 默认启动入口。
- 建立 Godot 1920x1080 Windows 主框架。
- 建立交锋主屏卡牌操作骨架：选择卡牌、选择目标、宣言/锁气预览、响应、结算。
- 交锋主屏小卡只显示表属性摘要，不显示六根。
- 调息、返照、取物、争夺物、便行已进入卡牌区。
- 保留小按钮：人物、背包、装备、内功、外功、法门、规则、日志、DM。
- 小按钮点击打开浮动抽屉占位；六根只在人物、内功、规则抽屉中作为里属性/详情/速查占位显示。
- 未加入地图、格子、Token坐标、地形、路径、战棋移动。

## 修改文件

- `app_design/daliang-trpg-combat/package.json`
- `app_design/daliang-trpg-combat/docs/OLD_UI_DISABLED_R6.md`
- `app_design/daliang-trpg-godot-r6/project.godot`
- `app_design/daliang-trpg-godot-r6/scenes/main.tscn`
- `app_design/daliang-trpg-godot-r6/scripts/main.gd`
- `app_design/daliang-trpg-godot-r6/README_UI_PHASE1.md`

## 未改动文件

- 规则书原文未改动。
- 世界观原文未改动。
- 数据库、表格、字段未改动。
- 计算层、规则层、数据层未改动。
- 旧 UI 源码未做业务逻辑修改，仅停用默认启动入口。

## 备份位置

- `app_design/ui_backups/R5_disabled_20260620_daliang-trpg-combat`

## 调用规则字段

- 交锋阶段：准备、宣言、计算、响应、结算、势变化。
- 主操作词：宣言、锁气、截击、成招、应招、落果、调息、返照、取物、争夺物、便行。
- 气骰五区：气池、气海、锁气、息库、临气区。
- 势面仅作占位展示：阴盛、阳盛、合势、圆融、崩溃、失势。
- 六根仅用于人物、内功、规则抽屉占位：顶门、目窍、心口、丹田、命门、步根。

## 调用数据库字段

- 第一阶段未接入数据库。
- 交锋小卡字段均为占位：角色名、势、状态、气骰摘要、距离、纠缠、当前宣言/响应。
- 未确认字段统一显示为 `【占位：字段名】`。

## 美术素材槽位

- 主框架面板：待接 NinePatchRect 面板素材。
- 角色小卡：待接小卡边框素材。
- 卡牌区：待接招式卡/操作卡卡面素材。
- 抽屉：待接浮动抽屉背景素材。
- 气骰摘要：待接气骰资源状态图标。

## 规则冲突

- R6 指令与旧 R5 原型冲突：旧原型存在底部裸按钮、主屏六根/气骰操作过重、React/Phaser 实现方向。已停用旧 UI 默认入口。
- 第一阶段未直接解析 docx/xlsx 原文，因此所有未确认字段保留占位，不写入新字段名。

## 截图路径

- 暂无生成截图。
- 建议下一步使用 Godot 编辑器或窗口运行后截图保存到：`app_design/daliang-trpg-godot-r6/docs/screenshots/phase1_main.png`。

## 下一步建议

- 第二阶段接入 Theme/NinePatchRect 和素材槽位。
- 调研 Godot Asset Library/GitHub 的卡牌选择、抽屉、提示浮窗 UI 组件，只借鉴 UI 交互。
- 从规则书/数据库原文确认交锋小卡字段命名，再替换占位。
- 建立只读 JSON/Resource 绑定层，但不改规则层、数据层、计算层。
