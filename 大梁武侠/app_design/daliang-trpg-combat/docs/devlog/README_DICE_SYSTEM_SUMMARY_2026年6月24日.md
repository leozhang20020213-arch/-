# README — 气骰系统 MVP 总览

**日期：** 2026年6月24日  
**分支：** `dice-system-first-pass`  
**版本：** v0.1.0 气骰交锋可玩 MVP  
**阶段：** Phase 1–10 完成

---

## 1. 气骰系统当前架构

气骰系统采用**双轨并行**架构：

```
┌──────────────────────────────────────────────────────────────┐
│  规则引擎层 (src/combat/)                                     │
│  CombatState → QiDie (zone: QI_POOL/QI_SEA/QI_LOCK/...)      │
│  combatEngine.ts: enterScene / declareAction / applyOutcome   │
│                      regulateBreath / useReflection           │
├──────────────────────────────────────────────────────────────┤
│  UI 展示层 (src/store/ + src/components/dice/)                │
│  DiceStore (Context + useReducer) → QiDieData (location: ...) │
│  2D 卡片组件: QiDie2D / QiDiceTray / QiAssignmentBoard        │
│  拖拽: @dnd-kit (DraggableQiDie / QiDropSlot)                 │
├──────────────────────────────────────────────────────────────┤
│  类型层                                                       │
│  src/combat/types.ts — 引擎 QiDie, CombatState, Move, Actor  │
│  src/types/dice.ts   — UI QiDieData, QiSlotType, 宣言锁气    │
└──────────────────────────────────────────────────────────────┘
```

两条轨道各自维护骰子状态，在关键节点同步：
- **开始场景**: DiceStore.initStarterDice() + combatEngine.enterScene()
- **确认宣言**: DiceStore.lockDeclaration() → 骰子 lock 标记
- **结算落果**: DiceStore.resolveDeclaration() → 骰子入息库; combatEngine.applyOutcome() → 骰子入 QI_REST

---

## 2. 核心组件树

```
App.tsx
├── DiceStoreProvider (Context + useReducer)
│   ├── PlayerSceneDesk / PlayerCombatDesk / DmSceneDesk / DmCombatDesk
│   │   └── CombatShell (grid: topbar | left/center/right | phasebar)
│   │       ├── TopCombatBar     — 顶部导航 (56px)
│   │       ├── LeftCombatPanel  — 角色状态卡 (300px)
│   │       ├── CenterCombatPanel
│   │       │   ├── CombatStage (42%)   — 战术舞台 SVG
│   │       │   └── qiZone (58%)
│   │       │       ├── QiZonePanel     — 四区概览 (气海/锁气/息库/临气)
│   │       │       └── QiAssignmentBoard — 拖拽投骰区
│   │       │           ├── QiDiceTray  — 气海骰盘 + 工具栏
│   │       │           │   └── DraggableQiDie → QiDie2D (每枚骰子卡片)
│   │       │           ├── QiDropSlot (阴槽)
│   │       │           │   └── AssignedDiceRow → QiDie2D
│   │       │           └── QiDropSlot (阳槽)
│   │       │               └── AssignedDiceRow → QiDie2D
│   │       ├── RightCombatPanel — 招式卡 + 目标选择 (380px)
│   │       │   ├── ActionHintBar
│   │       │   ├── MoveCard[] (招式卡片列表)
│   │       │   └── TargetSummary
│   │       └── PhasePromptBar  — 底部阶段提示 (60px)
│   └── DebugPanel — 调试面板 (仅开发模式)
```

---

## 3. 核心类型

### 3.1 UI 骰子类型 (`src/types/dice.ts`)

| 类型 | 说明 |
|------|------|
| `QiDieKind` | `"yin" \| "yang" \| "raw"` — 阴/阳/原始 |
| `QiDieFace` | `"阴" \| "阳" \| "原"` — 面标识 |
| `DieSides` | `4 \| 6 \| 8 \| 10 \| 12 \| 20` — 骰阶 |
| `QiDieLocation` | `"qiSea" \| "tempQi" \| "restPool" \| "lockedYin" \| "lockedYang"` |
| `QiDieData` | `{ id, kind, face, sides, value, location, source?, temporary?, locked? }` |
| `QiSlotType` | `"yinSlot" \| "yangSlot"` |
| `QiSlotAssignment` | `{ slot, dice[], requiredMin }` |
| `CurrentMoveQiRequirement` | `{ moveId, moveName, minYin, minYang }` |
| `LockedQiDeclaration` | `{ id, moveId, moveName, targetId, targetName, yinDice[], yangDice[], createdAt }` |
| `QiDeclarationStatus` | `"draft" \| "locked" \| "resolved"` |

### 3.2 引擎骰子类型 (`src/combat/types.ts`)

| 类型 | 说明 |
|------|------|
| `QiZone` | `"QI_POOL" \| "QI_SEA" \| "QI_LOCK" \| "QI_REST" \| "TEMP_QI" \| "YIN_SLOT" \| "YANG_SLOT"` |
| `QiDie` | `{ id, label, sourceId, sourceName, nature, sides, value, zone, ownerId, temporary? }` |
| `PendingAction` | `{ actorId, targetId, moveId, diceIds[], yinSlotDiceIds[], yangSlotDiceIds[], formed?, slotValues? }` |
| `SlotValues` | `{ 阴值, 阳值, 合值, 阴阳差 }` |

---

## 4. 核心状态

### 4.1 DiceStore (UI 层)

```
DiceStoreState {
  qiDice: QiDieData[]           // 所有气骰
  selectedDieId: string | null  // 当前选中的骰子
  lastRollAt: number | null     // 上次投掷时间
  assignedYinDiceIds: string[]  // 阴槽骰子 ID
  assignedYangDiceIds: string[] // 阳槽骰子 ID
  moveRequirement: CurrentMoveQiRequirement | null  // 当前招式需求
  targetId: string | null       // 当前目标
  declarationStatus: "draft" | "locked" | "resolved"
  activeDeclaration: LockedQiDeclaration | null
  hasUsedReturnLight: boolean   // 是否已使用返照
  isRolling: boolean            // 是否正在投掷动画
  rollingDisplayValues: Record<string, number>  // 动画中间值
}
```

### 4.2 CombatState (引擎层)

```
CombatState {
  campaignName, sceneName, sceneGoal
  round: number
  phase: "setup" | "initiative" | "scene" | "declare" | ...
  activeActorId: string
  actors: Actor[]               // 角色 (含招式、内功、装备)
  dice: QiDie[]                 // 七区气骰
  pendingAction?: PendingAction // 当前待结算行动
  tracks: SceneTrack[]          // 场景轨
  distances: DistanceRelation[] // 距离关系
  logs: CombatLogEntry[]        // 日志
}
```

### 4.3 关键 Action 流转

```
INIT_STARTER_DICE  → 生成 6 枚入门气骰 (2阴D6 + 2阳D6 + 2原D4)
ROLL_ALL_QI_SEA    → 重掷气海全部骰子
ASSIGN_DIE_TO_SLOT → 拖入阴槽/阳槽 (验证气性)
RETURN_DIE_TO_SEA  → 从槽位取回气海
LOCK_DECLARATION   → 锁气宣言 (骰子 locked=true)
RESOLVE_DECLARATION → 结算 → 骰子入息库
REGULATE_BREATH    → 调息: 息库→气海 (重掷)
RETURN_LIGHT       → 返照: 息库最低骰→气海 (不重掷)
```

---

## 5. 气骰流转图

```
                  ┌──────────────┐
                  │    气池       │  (初始存放，引擎层)
                  │   QI_POOL    │
                  └──────┬───────┘
                         │ enterScene() / 投掷
                         ▼
  ┌──────────┐    ┌──────────────┐    ┌──────────┐
  │   阴槽    │◄───│    气海       │───►│   阳槽    │
  │ lockedYin│    │   qiSea      │    │lockedYang│
  │ (UI层)   │    │   QI_SEA     │    │ (UI层)   │
  │          │    │  (引擎层)     │    │          │
  └────┬─────┘    └──────────────┘    └────┬─────┘
       │                                    │
       │     确认宣言并锁气 (LOCK_DECLARATION) │
       │                                    │
       └──────────────┬─────────────────────┘
                      │
                      ▼
               ┌──────────────┐
               │    锁气       │
               │   QI_LOCK    │ (引擎+UI locked=true)
               └──────┬───────┘
                      │ 结算落果 (RESOLVE_DECLARATION / applyOutcome)
                      ▼
               ┌──────────────┐
               │    息库       │
               │  restPool    │
               │  QI_REST     │
               └──────┬───────┘
                      │
          ┌───────────┼───────────┐
          │ 调息(重掷) │ 返照(不重掷)│ 被动流转(不重掷)
          ▼           ▼           ▼
      ┌──────────────────────────────┐
      │           气海               │
      └──────────────────────────────┘

  临气区 (tempQi / TEMP_QI): 物品/功法生成的临时骰，用后消失
```

---

## 6. 手动测试 Checklist

### 6.1 可见性
- [ ] 进入交锋页 (`playerCombat`/`dmCombat`)，中央下方能看到气骰区
- [ ] 气海为空时提示 "气海暂无气骰。请开始场景或调息。"
- [ ] 点击「初始化气骰」后，能看到 6 枚气骰（2阴D6 + 2阳D6 + 2原D4）
- [ ] 每枚骰子显示：阴/阳/原 (左上)、D几 (右下)、当前点数 (中央)
- [ ] 1920×1080 分辨率下，气骰区不被遮挡，无大面积空黑框

### 6.2 投掷
- [ ] 点击「投掷气海」能刷新所有气海骰子点数
- [ ] 点数不超过骰阶 (D4 最大 4, D6 最大 6)
- [ ] 动画结束后点数清晰可读

### 6.3 拖拽
- [ ] 阴骰能拖入阴槽
- [ ] 阳骰能拖入阳槽
- [ ] 原始骰能拖入任意槽
- [ ] 阳骰拖入阴槽 → 提示 "阳骰不能投入阴槽"，骰子回弹
- [ ] 阴骰拖入阳槽 → 提示 "阴骰不能投入阳槽"，骰子回弹
- [ ] 槽内骰子点击可取回气海

### 6.4 锁气
- [ ] 选招式后，阴槽/阳槽显示需求 (如 "至少 1 枚")
- [ ] 选目标后，可拖骰入槽
- [ ] 满足阴阳需求后，「确认宣言并锁气」按钮可用
- [ ] 点击确认后，骰子标记 "锁" 且不可拖动
- [ ] 点击「结算」后，锁定骰子进入息库

### 6.5 回气
- [ ] 调息能从息库回气海（骰子重掷）
- [ ] 返照在气海为空时可用（取息库最低骰不重掷）
- [ ] 气海/息库/临气/锁气数量显示正确
- [ ] QiZonePanel 合计栏显示 "合计 N 枚 · 气海A 锁气B 息库C 临气D"

### 6.6 UI
- [ ] 流程提示清晰: "① 选招 → ② 选目标 → ③ 拖骰入槽 → ④ 锁气"
- [ ] ActionHintBar 在 idle / rolling / locked / ready 状态切换正确
- [ ] 不出现"点击十个点"玩法
- [ ] 不出现一堆重复错误原因（单条 toast 1.8 秒后消失）
- [ ] 右侧招式卡显示可用/不可用状态及原因标签

---

## 7. 仍需开发的内容

以下功能不在当前 MVP 范围内，留待后续阶段：

| 功能 | 说明 | 优先级 |
|------|------|--------|
| **完整 3D 多面骰** | 当前为 2D 卡片，3D 物理骰子 (Three.js + cannon-es) 已有底板但未接入主线 | 中 |
| **更严格的招式数据接入** | 目前使用硬编码样例数据 (move-rain-step-cut)，需接入完整招式库 | 高 |
| **DM 多人同步** | LAN WebSocket 已有代码但未联调；多人同步需要完整的房间状态机 | 高 |
| **响应/截击完整结算** | 截击窗口和应招窗口已有引擎支持，UI 交互尚未完善 | 中 |
| **高阶内功生成临气** | InnerArt.qiGeneration 字段已定义，generateTempQi 引擎函数待实现 | 中 |
| **动画音效** | 投掷、拖拽、锁气、结算等环节尚无音效反馈 | 低 |
| **骰子来源追溯** | QiDieData.source 字段已有，UI 需要展示来源信息 | 低 |
| **回气限制** | 当前调息移动全部息库骰子，完整规则需按回气属性限制数量 | 中 |
| **多人角色切换** | 仅支持单玩家角色 (pc-shen-qing)，多人需座位管理 | 高 |

---

## 8. 文件索引

### 新系统文件 (Phase 1–10)

```
src/types/dice.ts                          — UI 骰子类型定义
src/store/diceStore.tsx                    — 骰子状态管理 (Context + useReducer)
src/lib/dice/diceRoll.ts                   — 投掷 & 创建骰子
src/lib/dice/diceAssignment.ts             — 拖拽验证规则
src/lib/dice/qiDeclaration.ts              — 宣言锁气逻辑
src/lib/dice/qiRecovery.ts                 — 调息 & 返照逻辑
src/components/dice/QiDie2D.tsx            — 单枚 2D 骰子卡片
src/components/dice/QiDiceTray.tsx         — 气海骰盘容器
src/components/dice/QiDiceToolbar.tsx      — 骰子操作工具栏
src/components/dice/DraggableQiDie.tsx     — 可拖拽骰子 (dnd-kit)
src/components/dice/QiDropSlot.tsx         — 阴/阳槽拖放区
src/components/dice/AssignedDiceRow.tsx    — 已分配骰子行
src/components/dice/QiAssignmentBoard.tsx  — 拖拽投骰主界面
src/components/dice/QiRequirementStatus.tsx— 招式需求状态
src/components/dice/QiDeclarationSummary.tsx— 宣言锁气摘要
src/components/dice/QiZonePanel.tsx        — 四区概览面板
src/components/dice/QiSeaZone.tsx          — 气海区
src/components/dice/LockedQiZone.tsx       — 锁气区
src/components/dice/RestPoolZone.tsx       — 息库区
src/components/dice/TemporaryQiZone.tsx    — 临气区
src/components/dice/QiRecoveryActions.tsx  — 回气操作 (调息/返照)
src/components/dice/dice.css               — 全部 2D 骰子样式
src/hooks/useDiceRollAnimation.ts          — 投掷动画 Hook
src/ui/combat/dice/MoveCard.tsx            — 招式卡片
src/ui/combat/dice/ActionHintBar.tsx       — 操作提示栏
src/types/move.ts                          — 招式 UI 类型
```

### 引擎层文件 (已有)

```
src/combat/types.ts                        — 引擎 QiDie / CombatState / Actor / Move 类型
src/combat/combatEngine.ts                 — 规则引擎纯函数 (700+ 行)
src/combat/combatEngine.test.ts            — 34 项引擎测试
src/ui/App.tsx                             — 主 App (路由 + 桌面)
src/ui/combat/CombatShell.tsx              — 桌面三栏外壳
src/ui/combat/CenterCombatPanel.tsx        — 中央面板 (舞台 + 气骰区)
src/lib/combat/qiAssignment.ts             — 引擎层拖拽验证
src/lib/combat/combatPhaseMachine.ts       — 阶段状态机
```

---

## 9. 运行方式

```bash
cd D:\trpg\大梁武侠\app_design\daliang-trpg-combat
npm install
npm run dev:legacy -- --port 5174 --host 127.0.0.1
```

打开 `http://127.0.0.1:5174`，选择身份进入交锋桌面。

## 10. 构建 & 测试

```bash
npm run build         # TypeScript + Vite 生产构建
npm run test          # 规则引擎测试 (34 项)
npm run test:lib      # UI 逻辑测试 (34 项)
npm run test:all      # 全部测试 (68 项)
```

---

*此文档为气骰系统 MVP 总结，后续阶段文档将在 `docs/devlog/` 目录下递增。*
