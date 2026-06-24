# 大梁江湖TRPG_UI_PHASE2审查与PHASE3任务书_2026年6月20日

## 一、PHASE2 审查结论

PHASE2 通过，可以进入 PHASE3。

PHASE2 已完成：

1. 建立 `rules_ui_manifest.json`，锁定页面术语、字段、禁用字段和占位格式。
2. 建立 `mock_combat_state.json`，用占位数据驱动交锋主屏。
3. 主场景从 manifest/mock 读取 UI 字段，不写回规则书、世界观、数据库或计算层。
4. 接入基础 Theme 与 NinePatchRect 占位结构。
5. 生成交锋主屏截图 `docs/screenshots/phase2_main.png`。
6. 交锋主屏小卡没有显示六根。
7. 气骰没有逐点点击，只作摘要显示。
8. 调息、返照、取物、争夺物、便行仍在卡牌区。
9. 小按钮包含人物、背包、装备、内功、外功、法门、规则、日志、DM。
10. 未加入地图、格子、Token坐标、地形、路径、战棋移动。

截图肉眼验收：

1. 当前页面已经形成 Windows 一屏主界面。
2. 左侧玩家方、右侧敌方、中间交锋裁决区、底部卡牌手牌区已经存在。
3. 小按钮已在底部出现。
4. 缺点是仍然是静态线框，占位文字密集，卡牌没有交互反馈，目标线还只是文字面板，不像游戏操作。
5. 因此下一阶段不是美术填充，而是先把卡牌游戏式交互做起来。

---

## 二、PHASE3 总目标

PHASE3 只做交互表现细化，不接入真实规则计算，不改规则书、世界观、数据库原始字段或计算层。

目标：

```text
选卡悬浮
选卡高亮
选择目标
目标线动画
宣言/锁气预览浮起
响应窗口浮起
卡牌不可用遮罩
整组投入方案切换
浮动抽屉开合
截图验收
```

PHASE3 完成后，界面应当能表现完整操作感：

```text
鼠标移到卡上 → 卡浮起
点击卡 → 卡高亮并写入选中卡详情
可选目标高亮
点击目标 → 中央出现目标线
宣言/锁气预览浮起
点击进入响应 → 响应窗口浮起
点击结算演示 → 响应/结算面板显示效阶、落果、势变化
点击人物/背包/装备/内功/外功/法门/规则/日志/DM → 对应抽屉滑出
```

---

## 三、PHASE3 硬性禁止

```text
禁止改规则书原文。
禁止改世界观原文。
禁止改数据库原始字段。
禁止改计算层、规则层、数据层。
禁止引入真实规则自动裁决。
禁止把六根放回交锋主屏小卡。
禁止逐点点击气骰。
禁止把调息、返照、取物、争夺物、便行做成底部裸按钮。
禁止地图、格子、Token坐标、地形、路径、战棋移动。
禁止用滚轮承载交锋主屏核心操作。
禁止为了动画加入新规则术语。
禁止为了美术效果改字段名。
```

---

## 四、PHASE3 必须新增或修改的文件

建议新增：

```text
app_design/daliang-trpg-godot-r6/scripts/ui_interaction_state.gd
app_design/daliang-trpg-godot-r6/scripts/card_view.gd
app_design/daliang-trpg-godot-r6/scripts/combatant_card_view.gd
app_design/daliang-trpg-godot-r6/scripts/target_line_view.gd
app_design/daliang-trpg-godot-r6/scripts/drawer_controller.gd
app_design/daliang-trpg-godot-r6/data/mock_interaction_cases.json
app_design/daliang-trpg-godot-r6/docs/screenshots/phase3_card_hover.png
app_design/daliang-trpg-godot-r6/docs/screenshots/phase3_card_selected.png
app_design/daliang-trpg-godot-r6/docs/screenshots/phase3_target_selected.png
app_design/daliang-trpg-godot-r6/docs/screenshots/phase3_drawer_open.png
app_design/daliang-trpg-godot-r6/README_UI_PHASE3.md
```

可修改：

```text
app_design/daliang-trpg-godot-r6/scenes/main.tscn
app_design/daliang-trpg-godot-r6/scripts/main.gd
app_design/daliang-trpg-godot-r6/themes/daliang_placeholder_theme.tres
```

仍禁止修改：

```text
规则书原文
世界观原文
数据库原始字段
计算层
规则层
数据层
```

---

## 五、PHASE3 状态机

必须建立 UI 交互状态机，但不做真实规则计算。

```text
IDLE
  ↓ 点击卡牌
CARD_SELECTED
  ↓ 点击可选目标
TARGET_SELECTED
  ↓ 确认宣言
DECLARATION_PREVIEW
  ↓ 模拟响应窗口
RESPONSE_OPEN
  ↓ 模拟结算
RESOLUTION_PREVIEW
  ↓ 清空/下一步
IDLE
```

### 5.1 状态含义

```text
IDLE：
未选卡。卡牌区显示所有可见卡。

CARD_SELECTED：
选中招式卡/响应卡/调息卡/返照卡/取物卡/争夺物卡/便行卡。
选中卡详情区显示该卡字段。
可选目标高亮。

TARGET_SELECTED：
目标卡高亮。
中央目标线区出现目标线/纠缠线/响应线/第三方护人线占位。
当前目标字段更新。

DECLARATION_PREVIEW：
宣言/锁气预览面板浮起。
显示当前卡、阴阳结构、投入、势要求、目标。
气骰摘要显示气池、气海、锁气、息库、临气区。
不得逐点点击。

RESPONSE_OPEN：
响应窗口浮起。
显示截击、应招占位。
响应卡可高亮。

RESOLUTION_PREVIEW：
响应/结算面板显示效阶、落果、势变化占位。
```

---

## 六、卡牌交互要求

### 6.1 卡牌悬浮

鼠标移入卡牌：

```text
卡牌上浮 12px
卡牌阴影加深
卡牌边框轻微高亮
选中卡详情区预览该卡
不改变当前宣言
```

鼠标移出卡牌：

```text
卡牌回到原位
若未选中，取消预览
若已选中，保持选中卡详情
```

### 6.2 卡牌选中

点击卡牌：

```text
卡牌保持高亮
写入选中卡详情
进入 CARD_SELECTED
可选目标卡出现高亮边框
中央提示：请选择目标
```

### 6.3 卡牌不可用遮罩

如果卡牌在 mock 中标记为不可用：

```text
显示半透明遮罩
显示不可用原因：【占位：不可用原因】
点击时不进入 CARD_SELECTED
```

不可用原因必须来自 mock 或 manifest，占位写：

```text
【占位：不可用原因】
```

不得自行编造规则原因。

---

## 七、目标选择与关系线

### 7.1 可选目标高亮

在 CARD_SELECTED 状态下：

```text
可选目标卡边框高亮
不可选目标卡不高亮
当前行动者卡显示行动者标记
```

### 7.2 点击目标

点击目标卡：

```text
进入 TARGET_SELECTED
当前目标字段更新为目标卡角色名
目标卡保持高亮
目标线出现
```

### 7.3 关系线类型

只允许以下四类：

```text
目标线
纠缠线
响应线
第三方护人线
```

### 7.4 目标线表现

```text
目标线：
[行动者] ──【占位：距离】──> [目标]

纠缠线：
[行动者] ══【占位：纠缠】══ [目标]

响应线：
[响应者] - -【占位：截击/应招】- -> [卡]

第三方护人线：
[第三方] ～【占位：第三方护人】～> [被护]
```

PHASE3 可以做简单线条动画，但不得引入地图坐标和格子。

---

## 八、宣言/锁气预览

点击“确认宣言”或完成目标选择后，显示宣言/锁气预览。

内容固定：

```text
当前卡：【占位：当前卡】
阴阳结构：【占位：阴阳结构】
投入：【占位：投入】
势要求：【占位：势要求】
目标：【占位：目标】
```

气骰摘要固定：

```text
气池：【占位：气池】
气海：【占位：气海】
锁气：【占位：锁气】
息库：【占位：息库】
临气区：【占位：临气区】
```

禁止：

```text
点单个点数
点十点
把气骰做成数值按钮
```

允许：

```text
整组投入方案切换
取消宣言
改选目标
```

---

## 九、响应窗口浮起

当状态进入 RESPONSE_OPEN：

```text
响应窗口从中央区域浮起
显示截击：【占位：截击】
显示应招：【占位：应招】
显示响应卡区高亮
```

响应窗口是 UI 演示，不自动判断规则结果。

---

## 十、结算预览

当状态进入 RESOLUTION_PREVIEW：

```text
显示效阶：【占位：效阶】
显示落果：【占位：落果】
显示势变化：【占位：势变化】
显示气骰去向：【占位：气骰去向】
```

不得自动修改真实角色数据。

---

## 十一、浮动抽屉

### 11.1 小按钮固定

底部小按钮仍固定为：

```text
人物｜背包｜装备｜内功｜外功｜法门｜规则｜日志｜DM
```

### 11.2 抽屉行为

点击任意小按钮：

```text
对应抽屉从右侧或底部滑出
其他抽屉自动关闭
遮罩不阻挡主界面预览
ESC 或关闭按钮关闭抽屉
```

### 11.3 抽屉内容

PHASE3 只做占位，不接真实数据库。

```text
人物抽屉：表属性摘要 + 进入人物页
背包抽屉：物品格占位 + 使用/装备/取物
装备抽屉：装备槽占位
内功抽屉：可以显示顶门、目窍、心口、丹田、命门、步根
外功抽屉：条目占位
法门抽屉：条目占位
规则抽屉：规则速查占位
日志抽屉：日志占位
DM抽屉：DM控制占位
```

注意：

```text
交锋小卡不能显示六根。
内功抽屉可以显示六根。
人物页可以显示六根。
规则速查可以显示六根。
```

---

## 十二、mock_interaction_cases.json 草案

```json
{
  "cases": [
    {
      "case_id": "select_move_target_enemy",
      "start_state": "IDLE",
      "card_type": "招式卡",
      "card_name": "【占位：招式名】",
      "target_type": "敌人",
      "line_type": "目标线",
      "next_states": [
        "CARD_SELECTED",
        "TARGET_SELECTED",
        "DECLARATION_PREVIEW"
      ]
    },
    {
      "case_id": "select_tiaoxi_self",
      "start_state": "IDLE",
      "card_type": "调息卡",
      "card_name": "调息",
      "target_type": "自己",
      "line_type": "目标线",
      "next_states": [
        "CARD_SELECTED",
        "TARGET_SELECTED",
        "DECLARATION_PREVIEW"
      ]
    },
    {
      "case_id": "select_response_card",
      "start_state": "RESPONSE_OPEN",
      "card_type": "响应卡",
      "card_name": "【占位：响应名】",
      "target_type": "当前卡",
      "line_type": "响应线",
      "next_states": [
        "CARD_SELECTED",
        "TARGET_SELECTED",
        "RESOLUTION_PREVIEW"
      ]
    },
    {
      "case_id": "open_bag_drawer",
      "start_state": "IDLE",
      "button": "背包",
      "drawer": "背包抽屉",
      "next_states": [
        "IDLE"
      ]
    }
  ]
}
```

---

## 十三、PHASE3 截图要求

必须生成以下截图：

```text
docs/screenshots/phase3_card_hover.png
docs/screenshots/phase3_card_selected.png
docs/screenshots/phase3_target_selected.png
docs/screenshots/phase3_declaration_preview.png
docs/screenshots/phase3_response_open.png
docs/screenshots/phase3_resolution_preview.png
docs/screenshots/phase3_drawer_open.png
```

如果自动截图不能模拟鼠标悬停，允许用调试脚本手动设置状态后截图。

---

## 十四、PHASE3 README 必须回答

`README_UI_PHASE3.md` 必须逐条回答：

```text
1. 是否仍然停用旧 React/Phaser UI？
2. 是否仍然未改规则书、世界观、数据库、计算层？
3. 是否仍然使用 rules_ui_manifest.json 作为 UI 术语来源？
4. 是否新增 ui_interaction_state.gd？
5. 是否实现 IDLE / CARD_SELECTED / TARGET_SELECTED / DECLARATION_PREVIEW / RESPONSE_OPEN / RESOLUTION_PREVIEW？
6. 交锋小卡是否仍然没有出现六根？
7. 气骰是否仍然没有逐点点击？
8. 调息、返照、取物、争夺物、便行是否仍然在卡牌区？
9. 小按钮是否仍然包含人物、背包、装备、内功、外功、法门、规则、日志、DM？
10. 是否实现卡牌悬浮？
11. 是否实现卡牌选中？
12. 是否实现目标高亮？
13. 是否实现目标线/纠缠线/响应线/第三方护人线至少一种可视演示？
14. 是否实现宣言/锁气预览浮起？
15. 是否实现响应窗口浮起？
16. 是否实现结算预览？
17. 是否实现浮动抽屉开合？
18. 是否生成全部 PHASE3 截图？
19. 是否列出仍未接入真实数据库？
20. 是否列出下一阶段计划？
```

---

## 十五、PHASE4 预告

PHASE3 通过后，PHASE4 再做美术资源搜索与统一风格填充。

PHASE4 才允许 Codex 到指定网站找素材：

```text
优先同一网站
优先同一作者
优先同一套 UI 包
优先武侠/东方/卷轴/纸面/木案/墨色/朱砂方向
不混搭多个风格
```

PHASE4 不允许改交互结构，只能换皮。
