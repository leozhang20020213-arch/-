# README_UI_PHASE2

## 完成内容

- 建立规则字段只读绑定层。
- 建立 `rules_ui_manifest.json`，锁定页面术语、字段、禁用字段和占位格式。
- 建立 `mock_combat_state.json`，用占位数据驱动交锋主屏。
- 主场景改为从 manifest/mock 读取 UI 字段，不写回规则书、世界观、数据库或计算层。
- 接入基础 Theme 与 NinePatchRect 占位结构，不挑正式美术素材。
- 生成交锋主屏截图 `docs/screenshots/phase2_main.png`。

## 修改文件

- `app_design/daliang-trpg-godot-r6/data/rules_ui_manifest.json`
- `app_design/daliang-trpg-godot-r6/data/mock_combat_state.json`
- `app_design/daliang-trpg-godot-r6/scripts/rules_manifest_loader.gd`
- `app_design/daliang-trpg-godot-r6/scripts/mock_combat_state_loader.gd`
- `app_design/daliang-trpg-godot-r6/scripts/main.gd`
- `app_design/daliang-trpg-godot-r6/scripts/capture_phase2.gd`
- `app_design/daliang-trpg-godot-r6/themes/daliang_placeholder_theme.tres`
- `app_design/daliang-trpg-godot-r6/docs/screenshots/phase2_main.png`
- `app_design/daliang-trpg-godot-r6/README_UI_PHASE2.md`

## 未改动文件

- 未改规则书原文。
- 未改世界观原文。
- 未改数据库原始字段。
- 未改计算层、规则层、数据层。
- 旧 React/Phaser UI 仍保持 PHASE1 的停用状态。

## 验收回答

1. 是否仍然停用旧 React/Phaser UI？是。
2. 是否仍然未改规则书、世界观、数据库、计算层？是。
3. 是否生成 `rules_ui_manifest.json`？是。
4. 是否生成 `mock_combat_state.json`？是。
5. 交锋小卡是否没有出现顶门、目窍、心口、丹田、命门、步根？是；这些只存在于 manifest 的内属性/禁用字段列表，以及人物/内功/规则抽屉逻辑中。
6. 气骰是否没有逐点点击？是；气骰只作为摘要显示。
7. 调息、返照、取物、争夺物、便行是否仍在卡牌区？是。
8. 小按钮是否包含人物、背包、装备、内功、外功、法门、规则、日志、DM？是。
9. 是否生成 `phase2_main.png` 截图？是：`docs/screenshots/phase2_main.png`。
10. 是否列出全部美术素材槽位？是，见下节。
11. 是否列出下一阶段计划？是，见末节。

## 调用规则字段

- 交锋阶段：准备、宣言、计算、响应、结算、势变化。
- 气骰五区：气池、气海、锁气、息库、临气区。
- 势面：阴盛、阳盛、合势、圆融、崩溃、失势。
- 六根/内属性：顶门、目窍、心口、丹田、命门、步根。
- 卡牌类型：招式卡、响应卡、调息卡、返照卡、取物卡、争夺物卡、便行卡。
- 目标线类型：目标线、纠缠线、响应线、第三方护人线。

## 调用数据库字段

- 本阶段未接入真实数据库。
- Mock 小卡字段：角色名、势、状态、气骰摘要、距离、纠缠、当前宣言/响应。
- 未确认字段保留 `【占位：字段名】` 格式或具体占位说明。

## 美术素材槽位

- 顶栏 NinePatchRect 占位。
- 玩家方/敌方卡区 NinePatchRect 占位。
- 交锋小卡 NinePatchRect 占位。
- 交锋裁决区 NinePatchRect 占位。
- 当前行动/目标/卡/阶段面板 NinePatchRect 占位。
- 目标线/纠缠线/响应线/第三方护人线面板 NinePatchRect 占位。
- 宣言/锁气预览面板 NinePatchRect 占位。
- 响应/结算面板 NinePatchRect 占位。
- 底部卡牌操作区 NinePatchRect 占位。
- 选中卡详情面板 NinePatchRect 占位。
- 卡牌手牌区 NinePatchRect 占位。
- 浮动抽屉 NinePatchRect 占位。
- 按钮 Theme 占位。

## 截图路径

- `app_design/daliang-trpg-godot-r6/docs/screenshots/phase2_main.png`

## 规则冲突

- 无新增规则冲突。
- 旧 R5/React/Phaser UI 与 R6 方向冲突，已在 PHASE1 停用默认入口，本阶段未恢复。
- Godot headless/dummy 渲染无法读取 viewport 纹理；截图使用正常窗口渲染模式自动保存后退出。

## 下一阶段计划

- PHASE3 只做交互表现细化：选卡悬浮、选卡高亮、选目标高亮、目标线动画、宣言/锁气预览动画、响应窗口浮起、卡牌不可用遮罩、整组投入方案切换。
- PHASE3 仍不改规则书、世界观、数据库原始字段或计算层。
- PHASE3 继续保持交锋主屏不显示六根、不逐点点击气骰、不加入地图/格子/Token坐标/地形/路径/战棋移动。
