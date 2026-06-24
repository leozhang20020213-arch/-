# PHASE 0 — 审查仓库，建立开发基线

**日期**: 2026-06-24  
**分支**: ui-combat-refactor  
**目标**: 拉取/定位仓库，审查项目结构与技术栈，验证可构建可测试，建立改造基线。

---

## 1. 项目技术栈判断

| 层面 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19.x |
| 构建 | Vite | 7.3.5 |
| 语言 | TypeScript | 5.8 |
| 3D 渲染 | Three.js | 0.184 |
| 2D 游戏棋盘 | Phaser | 4.x |
| 物理 | cannon-es | 0.20 |
| CSS | 自定义属性 (CSS Custom Properties) | — |
| CSS 框架 | **无 Tailwind**，纯手写 CSS | — |
| 状态管理 | **React useState**（App.tsx 内聚，无 Zustand/Redux/Context） | — |
| 拖拽 | **原生 HTML5 Drag & Drop**（无 dnd-kit/react-dnd） | — |
| 桌面壳 | 无 Electron/Tauri，纯浏览器 Vite dev server | — |
| 包管理 | npm (Windows: npm.cmd) | — |

---

## 2. 当前目录结构说明

```
daliang-trpg-combat/
├── index.html              # Vite 入口 HTML
├── package.json            # 依赖与脚本
├── vite.config.ts          # Vite 配置（仅 React 插件）
├── tsconfig.json           # TS 配置
├── README.md               # 项目说明
├── docs/
│   ├── OLD_UI_DISABLED_R6.md      # 旧 UI 禁用说明（R5→R6 迁移）
│   ├── open_source_reuse.md       # 开源参考记录
│   └── devlog/                    # 【本轮新建】开发日志
├── public/                 # 静态资源（图标等）
├── server/                 # LAN WebSocket 服务端
├── dist/                   # Vite build 输出
├── src/
│   ├── main.tsx            # ReactDOM 入口
│   ├── styles.css          # 主样式表 (~4600 行，需拆分)
│   ├── vite-env.d.ts       # Vite 类型声明
│   ├── combat/             # 规则引擎 & 类型
│   │   ├── types.ts                # 完整类型定义（345 行）
│   │   ├── combatEngine.ts         # 纯函数规则引擎
│   │   ├── combatEngine.test.ts    # 34 项测试
│   │   └── storage.ts              # localStorage 持久化
│   ├── data/
│   │   └── seed.ts                 # 样例团包数据（沈青、短兵客、黑衣脚夫）
│   ├── dice3d/             # Three.js 3D 气骰
│   │   ├── QiDiceTray.tsx          # 3D 骰盘组件
│   │   ├── QiDiceRollOverlay.tsx   # 投掷弹窗
│   │   ├── DiceMesh.tsx            # 骰子网格
│   │   ├── DiceGeometryFactory.ts  # 几何工厂
│   │   ├── DiceMaterialFactory.ts  # 材质工厂
│   │   ├── DicePhysics.ts          # 物理模拟
│   │   ├── DicePlacementResolver.ts# 放置解析
│   │   ├── DiceResultResolver.ts   # 结果解析
│   │   └── DiceRollController.ts   # 投掷控制
│   ├── game/               # Phaser 2D 棋盘
│   │   ├── PhaserCombatBoard.tsx   # React-Phaser 桥接
│   │   └── combatScene.ts          # Phaser 场景
│   ├── net/
│   │   └── lanClient.ts            # WebSocket LAN 客户端
│   ├── rules/
│   │   ├── ruleCatalog.ts          # 规则目录
│   │   └── schema.ts               # 规则 schema
│   ├── styles/             # CSS 模块
│   │   ├── tokens.css              # 设计令牌（CSS 变量）
│   │   ├── layout.css              # 网格布局系统
│   │   ├── components.css          # 组件样式
│   │   └── overrides.css           # 覆盖样式
│   └── ui/                 # React UI 层
│       ├── App.tsx                 # 【核心】~2154 行，单文件包含全部桌面逻辑
│       ├── CharacterSelect.tsx     # 角色选择
│       ├── components/             # 可复用组件
│       │   ├── index.ts
│       │   ├── Button.tsx
│       │   ├── Dialog.tsx
│       │   ├── Drawer.tsx
│       │   ├── Tabs.tsx
│       │   ├── Tooltip.tsx
│       │   ├── Toast.tsx
│       │   ├── GamePanel.tsx
│       │   ├── UnitCard.tsx
│       │   ├── CombatBriefCard.tsx
│       │   └── SixRootsSummary.tsx
│       ├── layouts/                # 布局组件
│       │   ├── TitleBar.tsx
│       │   ├── MainToolbar.tsx
│       │   ├── RoundStatusBar.tsx
│       │   ├── MainWorkspace.tsx
│       │   ├── LeftInfoPanel.tsx
│       │   ├── CenterCombatZone.tsx
│       │   ├── RightActionPanel.tsx
│       │   └── BottomStatusBar.tsx
│       └── utils/
│           └── labels.ts           # 标签/格式化工具
```

---

## 3. 当前主要页面入口（路由）

路由由 `AppSession.route` 驱动（非 React Router，纯状态机路由）：

| route | 说明 | 组件 |
|-------|------|------|
| `home` | 首页（开始/继续/创建/加入） | `HomeScreen` |
| `createRoom` | 创建房间 | `CreateRoomPage` |
| `joinRoom` | 加入房间 | `JoinRoomPage` |
| `roomWaiting` | 等待房间 | `RoomWaitingPage` |
| `characterAssign` | 角色分配 | `CharacterAssignPage` |
| `playerScene` | **玩家情景桌面** | `PlayerSceneDesk` |
| `playerCombat` | **玩家交锋桌面** | `PlayerCombatDesk` |
| `dmScene` | **DM 情景桌面** | `DmSceneDesk` |
| `dmCombat` | **DM 交锋桌面** | `DmCombatDesk` |
| `packs/library/settings` | 占位页 | `PlaceholderPage` |

---

## 4. 当前交锋界面相关文件

### 核心架构
- **`src/ui/App.tsx`** (2154 行) — 所有状态、所有 handler、所有桌面子组件均在此文件中
- **`src/ui/layouts/MainWorkspace.tsx`** — 三栏网格：Left 18% / Center 58% / Right 24%
- **`src/ui/layouts/LeftInfoPanel.tsx`** — 左栏：我的战斗简卡 / 队友 / 场景目标 / 最近动态
- **`src/ui/layouts/CenterCombatZone.tsx`** — 中栏：CombatStage (45%) / QiDiceZone (55%)
- **`src/ui/layouts/RightActionPanel.tsx`** — 右栏：actions / enemies / flowButtons / hint

### 交锋桌面组件（均在 App.tsx 内联定义）
- `PlayerCombatDesk` — 玩家交锋视图
- `DmCombatDesk` — DM 交锋视图
- `CombatStage` — 共享交锋舞台（含 Phaser 棋盘 + 战斗单位 + 距离线 + 行动栈）
- `QiZoneBoard` — 气骰操作区（临气区 / 阴槽-气海-阳槽 / 气池息库统计条）
- `ActionPanel` — 招式与宣言面板（目标选择 / 招式卡片 / 骰子勾选 / 宣言按钮）
- `EnemyRoster` — 敌方公开卡列表
- `PlayerFlowPanel` — 玩家阶段操作按钮
- `DmControlPanel` — DM 裁定面板
- `DrawerLayer` + `DrawerContent` — 右侧抽屉系统（14 个抽屉 ID）

### 关键样式文件
- `src/styles/tokens.css` (143 行) — CSS 变量：颜色/阴影/间距/字体/布局比例
- `src/styles/layout.css` (553 行) — 5-row 桌面网格：TitleBar/Toolbar/RoundBar/Workspace/StatusBar
- `src/styles.css` (4596 行) — 主样式，包含大量 combat-layout v2 样式（实际未启用）

---

## 5. 当前状态管理方式

**全部状态在 `App.tsx` 的 `App()` 函数组件内通过 `useState` 管理：**

```typescript
const [state, setState] = useState<CombatState>(() => loadCombatState());
const [session, setSession] = useState<AppSession>(() => loadAppSession());
const [selectedTargetId, setSelectedTargetId] = useState("enemy-short-blade");
const [selectedMoveId, setSelectedMoveId] = useState("move-rain-step-cut");
const [selectedDice, setSelectedDice] = useState<string[]>([]);
const [slotDice, setSlotDice] = useState<{ yin: string[]; yang: string[] }>({ yin: [], yang: [] });
const [slotHint, setSlotHint] = useState("");
const [dmNote, setDmNote] = useState("...");
const [debugView, setDebugView] = useState(false);
const [activeDrawer, setActiveDrawer] = useState<DrawerId | null>(null);
const [lanUrl, setLanUrl] = useState("ws://localhost:8787");
const [lanStatus, setLanStatus] = useState<LanConnectionStatus>("idle");
const [lanDetail, setLanDetail] = useState("");
const [rollDice, setRollDice] = useState<QiDie[] | null>(null);
const [prompt, setPrompt] = useState<{ title: string; message: string } | null>(null);
```

**持久化**：通过 `useEffect` 每次 state/session 变化自动写入 localStorage：
```typescript
useEffect(() => saveCombatState(state), [state]);
useEffect(() => saveAppSession(session), [session]);
```

**规则引擎**：`combatEngine.ts` 是纯函数集合，不持有状态。App.tsx 调用引擎函数后通过 `patch()` 更新 state。

**结论**：当前无任何状态管理库。refactor 阶段如需拆分组件但共享状态，可考虑引入 React Context 或 Zustand，但需评估必要性。

---

## 6. 当前运行命令

```bash
# 开发（需要 --port 参数，否则 dev 脚本报错）
npm.cmd run dev:legacy -- --port 5174 --host 127.0.0.1

# 构建
npm.cmd run build

# 测试
npm.cmd test

# LAN 服务端
npm.cmd run dev:lan
```

注意：`npm run dev` 直接调用会报错 "R5 UI is disabled"，必须用 `npm run dev:legacy`。

---

## 7. 当前存在的主要 UI 问题

### 7.1 架构问题（优先级最高，本轮不改）

1. **App.tsx 巨型组件 (2154 行)** — 所有桌面组件、所有状态、所有 handler 共处一文件，无法独立测试或复用。

2. **状态全部在根组件** — 任何子组件修改需通过 props 层层传递 `patch`/`toggleDie`/`assignDieToSlot` 等 12+ 个 handler，props drilling 严重。

3. **CSS 样式表过大 (4596 行 styles.css)** — 包含大量未启用的 v2 redesign 样式（`.combat-layout`、`.character-card`、`.hand-area` 等），与当前实际使用的三栏布局样式混在一起。

### 7.2 交锋界面布局问题（核心改造目标）

4. **右侧面板信息过载** — `PlayerCombatDesk` 的右栏同时堆放了：
   - ActionPanel（目标选择 + 招式卡片网格 + 骰子列表 + 宣言按钮）
   - EnemyRoster（敌方公开卡）
   - PlayerFlowPanel（场景/成招/应招/落果按钮）
   - 三者从上到下堆叠，滚动才能看到全部

5. **招式卡片与角色卡分离** — 招式在右栏 ActionPanel 中显示为网格卡片，但在交锋时这应该是玩家最频繁操作的区域，却被挤在右侧 24% 的窄栏里。

6. **敌方公开卡占用操作空间** — 敌方公开卡在交锋中只需概览（HP/势/状态），但在右栏占据 30% 空间。

7. **中心舞台太小** — CombatStage 仅 45% 高度（~220px），Phaser 棋盘被压缩，战斗单位信息显示不全。

8. **气骰区拖拽跨栏** — 气骰从 CenterCombatZone 拖到阴槽/阳槽时，实际拖放目标在同一栏内，但概念上应该更贴近招式选择区（右栏）。

9. **没有"手牌区"** — 招式作为玩家的"手牌"，应该在桌面底部或中栏底部以水平手牌形式展示，而非右侧网格卡片。

10. **DM 视图同样混乱** — DmCombatDesk 把裁定面板、广播预览、敌人库全塞右栏。

### 7.3 次要问题

11. **响应式不适配横屏** — 虽然是 Windows 桌面应用，但 CSS 中有大量 `@media (max-width: 1220px)` 的移动端适配代码，在横屏 1366×768 下表现不理想。

12. **PhaserCombatBoard 交互缺失** — `onSelectUnit={() => undefined}`，棋盘上的单位不可点击选择。

13. **无快捷键支持** — 交锋流程（宣言/成招/应招/落果）没有键盘快捷键。

---

## 8. 下一轮改造入口建议（PHASE 1）

### 目标：建立真正的三栏交锋桌面骨架

**不改规则引擎、不改数据层、不改 3D 骰子核心逻辑。**

#### 8.1 拆分 App.tsx
- 将 `PlayerCombatDesk` / `DmCombatDesk` 提取到独立文件 `src/ui/desks/PlayerCombatDesk.tsx` 和 `DmCombatDesk.tsx`
- 将 `CombatStage` 提取到 `src/ui/combat/CombatStage.tsx`
- 将 `QiZoneBoard` 提取到 `src/ui/combat/QiZoneBoard.tsx`
- 将 `ActionPanel` 提取到 `src/ui/combat/ActionPanel.tsx`

#### 8.2 重新设计三栏分配
- **左栏 (18%)**：我方角色卡 + 队友简卡 + 势/状态摘要
- **中栏 (58%)**：
  - 上半：CombatStage（战斗舞台 + Phaser 棋盘 + 距离线）— 增大到 55-60%
  - 下半：QiZoneBoard（3D 气骰区）— 缩小到 40-45%
- **右栏 (24%)**：
  - 上半：敌方公开卡（精简为 HP/势/状态概览，不展开完整 UnitCard）
  - 下半：操作按钮（宣言/成招/应招/落果）— 简洁的纵向流程按钮

#### 8.3 引入底部手牌区
- 在中栏底部或桌面底部增加水平手牌区（hand area），展示可用招式卡片
- 点击手牌选中招式，拖拽气骰到招式卡上完成锁气

#### 8.4 清理 CSS
- 删除 styles.css 中未使用的 v2 redesign 样式
- 或将其移动到 `src/styles/unused/` 目录备份

---

## 9. 本轮修改清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `docs/devlog/` 目录 | 开发日志目录 |
| 新建 | `docs/devlog/README_UI_PHASE0_2026年6月24日.md` | 本文件 |
| 无代码修改 | — | Phase 0 仅审查，不修改业务代码 |

---

## 10. 构建与测试状态

```
✓ TypeScript 编译通过 (tsc -b)
✓ Vite 生产构建成功 (vite build, 10.65s)
✓ 34 项规则引擎测试全部通过 (npm test)
✓ dist/ 输出正常
✓ 无 import 错误
✓ 无启动阻塞问题
```

---

## 11. Git 信息

- **远端**: `https://github.com/leozhang20020213-arch/-.git`
- **新分支**: `ui-combat-refactor`
- **本地 commit**: （见下方）

### 网络状态说明
当前网络环境无法连接 github.com (连接超时)，因此 `git push` 无法执行。本地 commit 已完成。待网络恢复后，执行以下命令推送：

```bash
cd D:/trpg/大梁武侠/app_design/daliang-trpg-combat
git push -u origin ui-combat-refactor
```
