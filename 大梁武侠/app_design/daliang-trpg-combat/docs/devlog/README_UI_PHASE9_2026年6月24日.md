# PHASE 9 — 统一 UI 视觉层级

**日期**: 2026-06-24  
**分支**: ui-combat-refactor

## 改动

- `tokens.css` 新增语义颜色别名：
  - `--color-bg-main` (深黑褐) — 战盘背景
  - `--color-bg-panel` (米白) — 信息卡背景
  - `--color-border-active` (金色) — 当前选中/可操作
  - `--color-warning` (红色) — 警告/失败/受伤
  - `--color-disabled` (灰色) — 禁用
  - `--color-yin` (青蓝) / `--color-yang` (赤金)
- 语义规则：金色=选中，灰色=禁用，红色=警告，不混淆
- 所有别名为现有变量的别名，不破坏已有样式
