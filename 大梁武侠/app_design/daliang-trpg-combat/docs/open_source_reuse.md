# Open Source Reuse Record

## 项目：大梁江湖 TRPG 交锋辅助桌面 (daliang-trpg-combat)

本文档记录在 UI 重构过程中参考的开源项目、许可证状态及使用范围。

---

### 1. shadcn-ui/ui
- **仓库**: https://github.com/shadcn-ui/ui
- **许可证**: MIT
- **使用范围**: 设计参考
- **参考内容**:
  - 组件组织模式（单文件组件，co-located variants）
  - Button、Dialog、Drawer、Tabs、Tooltip、Toast 的 API 设计
  - CSS 变量驱动的主题系统
  - `createPortal` 弹窗/抽屉模式
- **复刻方式**: 参考其组件接口设计，自行实现武侠桌面视觉风格
- **未复制代码**: 未直接复制任何源代码

### 2. masquevil/trpg-saikou
- **仓库**: https://github.com/masquevil/trpg-saikou
- **许可证**: 待查（仓库已下载到 external_sources/trpg-saikou）
- **使用范围**: 设计参考
- **参考内容**:
  - TRPG 工具的信息结构（角色/房间/日志/骰子交互）
  - DM 与玩家面板分离的信息架构
  - 三栏布局的信息分配策略
- **未复制代码**

### 3. Dice-Developer-Team/Dice
- **仓库**: https://github.com/Dice-Developer-Team/Dice
- **许可证**: 待下载后确认
- **使用范围**: 设计参考（骰子功能流程）
- **参考内容**:
  - 骰子投掷工作流
  - 结果展示与记录
- **未复制代码**

### 4. shu223/UIKitForGame
- **仓库**: https://github.com/shu223/UIKitForGame
- **许可证**: 待下载后确认
- **使用范围**: 设计参考（游戏 UI 控件）
- **参考内容**:
  - HUD 风格工具栏
  - 游戏内菜单/弹窗/按钮层级
- **未复制代码**

### 5. UnderwaterApps/overlap2d
- **仓库**: https://github.com/UnderwaterApps/overlap2d
- **许可证**: Apache 2.0
- **使用范围**: 设计参考（2D 场景层级编排）
- **参考内容**:
  - Layer compositing 概念
  - z-ordering 管理策略
- **未复制代码**

---

## 本项目组件实现

所有组件均为自行实现，采用以下设计原则：
- React 19 + TypeScript 5.8
- CSS 自定义属性驱动主题
- 暗色木纹桌面 + 羊皮纸面板视觉风格
- 固定桌面工作台布局（无整页滚动）
- 严格使用大梁江湖规则术语

### 已实现的组件层

| 组件 | 文件 | 参考来源 |
|------|------|----------|
| Button | src/ui/components/Button.tsx | shadcn-ui 变体模式 |
| Dialog | src/ui/components/Dialog.tsx | shadcn-ui portal 模式 |
| Drawer | src/ui/components/Drawer.tsx | shadcn-ui sheet 模式 |
| Tabs | src/ui/components/Tabs.tsx | shadcn-ui tabs 模式 |
| Tooltip | src/ui/components/Tooltip.tsx | 自行设计 |
| Toast | src/ui/components/Toast.tsx | shadcn-ui sonner 概念 |
| GamePanel | src/ui/components/GamePanel.tsx | 自行设计（游戏面板容器）|
| TitleBar | src/ui/layouts/TitleBar.tsx | Windows 桌面标题栏 |
| MainToolbar | src/ui/layouts/MainToolbar.tsx | 游戏 HUD 工具栏 |
| RoundStatusBar | src/ui/layouts/RoundStatusBar.tsx | 自行设计 |
| MainWorkspace | src/ui/layouts/MainWorkspace.tsx | 桌面工作区 |
| LeftInfoPanel | src/ui/layouts/LeftInfoPanel.tsx | TRPG 信息面板 |
| CenterCombatZone | src/ui/layouts/CenterCombatZone.tsx | 3D 气骰操作台 |
| RightActionPanel | src/ui/layouts/RightActionPanel.tsx | TRPG 操作面板 |

---

## 许可证合规声明

- 所有参考项目仅用于设计模式研究，未直接复制代码
- 本项目 UI 组件的视觉风格（武侠桌面）为独立设计
- 规则引擎（combatEngine.ts）为原创实现
- 3D 骰子渲染使用 Three.js（MIT 许可证）
