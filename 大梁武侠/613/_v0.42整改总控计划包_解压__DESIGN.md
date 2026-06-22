# DESIGN.md — 大梁武侠TRPG APP 设计系统

## 设计气质
关键词：武侠、清晰、克制、案卷、江湖历、规则工具。  
不要做成游戏商城、玄幻页游或五颜六色后台。

## 色彩
- 背景：#F6F1E7 宣纸米白
- 面板：#FFFDF7
- 主文字：#1F2933 墨色
- 次文字：#6B7280
- 主色：#1F4E5F 黛青
- 标题深色：#17365D
- 强调：#A33A2A 朱砂
- 奖励/名望：#B08D57 金石灰
- 成功：#2F6B4F
- 警告：#B7791F
- 危险：#9B2C2C

## 布局
桌面端优先：
- 左侧导航 280px
- 顶部状态栏
- 主内容卡片区
- 右侧详情/日志抽屉 360px

## 组件
使用 shadcn/ui + Tailwind：
- Card
- Table
- Tabs
- Badge
- Dialog
- Drawer
- Command
- Separator
- Tooltip
- Progress
- ScrollArea
- Timeline 自定义组件
- ResourceChip 自定义组件
- TrackBar 自定义组件

## 交互原则
- 每页只突出1个主操作。
- 所有危险操作必须确认。
- 所有结算必须可回滚。
- 所有规则引用必须显示 Rule_ID。
- 所有长团记录必须可导出 JSONL/Markdown。

## 禁止
- 禁止随机渐变。
- 禁止过度毛玻璃。
- 禁止每页不同风格。
- 禁止一屏超过三个主按钮。
- 禁止无来源字段。
