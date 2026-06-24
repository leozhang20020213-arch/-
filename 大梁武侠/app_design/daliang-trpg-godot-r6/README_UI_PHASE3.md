# README_UI_PHASE3

## 完成内容

- 新增 UI 交互状态机，仅用于表现层演示。
- 实现卡牌悬浮、卡牌选中、可选目标高亮、目标选择。
- 实现目标线、纠缠线、响应线、第三方护人线的可视演示。
- 实现宣言/锁气预览浮起、响应窗口浮起、结算预览。
- 实现卡牌不可用遮罩与不可用原因占位。
- 实现整组投入方案切换占位，不做逐点气骰操作。
- 实现人物、背包、装备、内功、外功、法门、规则、日志、DM 抽屉开合。
- 生成 PHASE3 七张验收截图。

## 修改文件

- `app_design/daliang-trpg-godot-r6/scripts/ui_interaction_state.gd`
- `app_design/daliang-trpg-godot-r6/scripts/card_view.gd`
- `app_design/daliang-trpg-godot-r6/scripts/combatant_card_view.gd`
- `app_design/daliang-trpg-godot-r6/scripts/target_line_view.gd`
- `app_design/daliang-trpg-godot-r6/scripts/drawer_controller.gd`
- `app_design/daliang-trpg-godot-r6/scripts/main.gd`
- `app_design/daliang-trpg-godot-r6/data/mock_combat_state.json`
- `app_design/daliang-trpg-godot-r6/data/mock_interaction_cases.json`
- `app_design/daliang-trpg-godot-r6/README_UI_PHASE3.md`

## 未改动文件

- 未改规则书原文。
- 未改世界观原文。
- 未改数据库原始字段。
- 未改计算层、规则层、数据层。
- 旧 React/Phaser UI 仍保持停用状态。

## 验收回答

1. 是否仍然停用旧 React/Phaser UI？是。
2. 是否仍然未改规则书、世界观、数据库、计算层？是。
3. 是否仍然使用 `rules_ui_manifest.json` 作为 UI 术语来源？是。
4. 是否新增 `ui_interaction_state.gd`？是。
5. 是否实现 `IDLE / CARD_SELECTED / TARGET_SELECTED / DECLARATION_PREVIEW / RESPONSE_OPEN / RESOLUTION_PREVIEW`？是。
6. 交锋小卡是否仍然没有出现六根？是。
7. 气骰是否仍然没有逐点点击？是，只显示摘要和整组投入方案占位。
8. 调息、返照、取物、争夺物、便行是否仍然在卡牌区？是。
9. 小按钮是否仍然包含人物、背包、装备、内功、外功、法门、规则、日志、DM？是。
10. 是否实现卡牌悬浮？是。
11. 是否实现卡牌选中？是。
12. 是否实现目标高亮？是。
13. 是否实现目标线/纠缠线/响应线/第三方护人线至少一种可视演示？是，四种均有占位线演示。
14. 是否实现宣言/锁气预览浮起？是。
15. 是否实现响应窗口浮起？是。
16. 是否实现结算预览？是。
17. 是否实现浮动抽屉开合？是。
18. 是否生成全部 PHASE3 截图？是。
19. 是否列出仍未接入真实数据库？是，本阶段仍只使用 mock 数据。
20. 是否列出下一阶段计划？是，见下节。

## 截图路径

- `docs/screenshots/phase3_card_hover.png`
- `docs/screenshots/phase3_card_selected.png`
- `docs/screenshots/phase3_target_selected.png`
- `docs/screenshots/phase3_declaration_preview.png`
- `docs/screenshots/phase3_response_open.png`
- `docs/screenshots/phase3_resolution_preview.png`
- `docs/screenshots/phase3_drawer_open.png`

## 规则字段与数据库字段

- UI 术语来源：`data/rules_ui_manifest.json`。
- 交锋主屏数据来源：`data/mock_combat_state.json`。
- 交互案例来源：`data/mock_interaction_cases.json`。
- 未接入真实数据库。
- 未接入真实规则计算。
- 不写回任何规则、世界观、数据库或角色数据。

## 美术素材槽位

- 卡牌悬浮/高亮边框。
- 卡牌不可用遮罩。
- 可选目标高亮边框。
- 目标线、纠缠线、响应线、第三方护人线。
- 宣言/锁气预览浮窗。
- 响应窗口浮窗。
- 结算预览浮窗。
- 抽屉背景与关闭按钮。
- 整组投入方案切换按钮。

## 下一阶段计划

- PHASE4 才进入美术素材搜索与统一换皮。
- PHASE4 只替换视觉皮肤，不改变交互结构。
- PHASE4 仍不改规则书、世界观、数据库原始字段或计算层。
- PHASE4 优先同一来源、同一作者、同一套 UI 包，避免风格混搭。
