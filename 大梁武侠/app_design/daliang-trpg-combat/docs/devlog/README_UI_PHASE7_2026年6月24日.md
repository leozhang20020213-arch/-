# PHASE 7 — 清理玩家界面，分离 DM/调试信息

**日期**: 2026-06-24  
**分支**: ui-combat-refactor

## 改动

- **PlayerPromptBar**: 新增自然语言提示条，替代系统语
- **DmControlPanel**: 从 App.tsx 提取为独立组件 `src/ui/combat/dm/DmControlPanel.tsx`
- **DebugPanel**: 仅在 `import.meta.env.DEV` 或 `debugView=true` 时显示
- 玩家模式不显示：本地模式、未保存、DM裁定细节、调试日志
- 玩家提示使用自然语言：第X轮，XX行动中。请选择招式、目标，并投入气骰。
- DM提示：玩家已锁气，请选择是否开启响应窗口。
