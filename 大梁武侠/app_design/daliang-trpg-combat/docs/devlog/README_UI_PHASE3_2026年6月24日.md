# PHASE 3 — 重构敌方公开卡：从常驻面板改为选中展开

**日期**: 2026-06-24  
**分支**: ui-combat-refactor  
**目标**: 敌方公开卡不再常驻占据右栏空间，改为"舞台节点点击 → 右侧展开详情"模式。

---

## 1. 核心改动：敌方公开卡从常驻改为点击展开

### 改动前
- 右栏常驻 `EnemyRoster`，列出所有敌方完整 UnitCard
- 舞台节点和右栏敌人卡信息重复
- 占用大量右栏空间（与招式宣言面板竞争）

### 改动后
- **无敌人选中时**：右栏 `enemies` 区域保持原样（玩家端：EnemyRoster；DM端：BroadcastPreview）
- **点击舞台敌人节点时**：右栏切换为 `EnemyPublicDrawer`，只显示当前选中敌人的公开信息
- 点击关闭按钮或再次点击同一节点 → 恢复原样
- 招式宣言面板不受影响

---

## 2. 玩家模式和 DM 模式显示差异

| 信息项 | 玩家模式 | DM 模式 |
|--------|----------|---------|
| 名称 | ✅ | ✅ |
| 气血条 | ✅ | ✅ |
| 势面 | ✅ | ✅ |
| 公开状态 | ✅ | ✅ |
| 简介 (publicNote) | ✅ | ✅ |
| 公开弱点 | ✅ | ✅ |
| 行为倾向 | ✅ | ✅ |
| 已知招式 | ✅ | ✅ |
| 隐藏目标 | ❌ | ✅ (紫色边框) |
| 隐藏状态 | ❌ | ✅ (紫色虚线标签) |
| 掉落/线索 | ❌ | ✅ |
| DM 备注 | ❌ | ✅ |

### 模式判断
- 从现有 `AppSession.identity` 读取，映射到 `AppMode = "player" | "dm"`
- 无新增 store，直接复用已有状态

---

## 3. 新增组件清单

| 组件 | 文件 | 说明 |
|------|------|------|
| `EnemyPublicDrawer` | `src/ui/combat/enemy/EnemyPublicDrawer.tsx` | 容器组件，接收 Actor，构建 EnemyPublicInfo，决策显示模式 |
| `EnemyPublicCard` | `src/ui/combat/enemy/EnemyPublicCard.tsx` | 敌方公开信息卡片，按固定顺序渲染所有字段 |
| `EnemyWeaknessList` | `src/ui/combat/enemy/EnemyWeaknessList.tsx` | 弱点列表，红色标记 + 单行文本，空状态显示"无已知弱点" |

### 新增样式
| 文件 | 说明 |
|------|------|
| `src/styles/enemy-card.css` | 敌方卡片全套样式（~250行），暗色背景 + 金色强调 |

---

## 4. 数据结构变化

### 新增类型（在 `src/types/combat.ts`）

```typescript
export type AppMode = "player" | "dm";

export interface EnemyPublicInfo {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  momentum: string;
  statuses: string[];         // 公开状态名（已过滤 public:true）
  description: string;        // 来自 Actor.publicNote
  publicWeaknesses: string[]; // 来自 Actor.publicWeakness，按换行分割
  behaviorHint: string;       // 来自 Actor.behaviorHint
  knownMoves: string[];       // 来自 Actor.moves[].name
  // DM-only:
  hiddenGoal?: string;
  hiddenStatuses?: string[];
  lootOrClue?: string;
  dmNote?: string;
}
```

### 适配函数

`buildEnemyPublicInfo(actor: Actor): EnemyPublicInfo` — 从现有 Actor 数据行提取公开/DM字段：
- `statuses` → 过滤 `public: true`
- `publicWeakness` → `.split("\n")` 分割为数组
- `knownMoves` → 映射 `actor.moves.map(m => m.name)`
- DM字段直接透传

---

## 5. 交互流程

```
1. 玩家点击舞台上的敌人节点（如"短兵客"）
   ↓
2. selectedCombatantId = "enemy-short-blade"
   ↓
3. PlayerCombatDesk 检测到 selectedEnemy 存在
   ↓
4. 右栏 enemies 区域从 EnemyRoster 切换为 EnemyPublicDrawer
   ↓
5. EnemyPublicDrawer 渲染 EnemyPublicCard（玩家模式，无 DM 字段）
   ↓
6. 玩家点击关闭按钮（×）
   ↓
7. setSelectedCombatantId(undefined)
   ↓
8. 右栏恢复为 EnemyRoster
```

DM 模式同理，但显示额外的 DM 专属区域（紫色分隔线标识）。

---

## 6. 修改文件列表

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/combat.ts` | 修改 | +AppMode, +EnemyPublicInfo 类型 |
| `src/ui/combat/enemy/EnemyPublicDrawer.tsx` | **新增** | 容器 + buildEnemyPublicInfo 适配器 |
| `src/ui/combat/enemy/EnemyPublicCard.tsx` | **新增** | 信息卡片（player/dm 模式切换） |
| `src/ui/combat/enemy/EnemyWeaknessList.tsx` | **新增** | 弱点列表 |
| `src/styles/enemy-card.css` | **新增** | 卡片样式 |
| `src/main.tsx` | 修改 | +1 行 CSS 导入 |
| `src/ui/App.tsx` | 修改 | PlayerCombatDesk + DmCombatDesk 增加 selectedEnemy 逻辑 |

---

## 7. 当前已知问题

1. **DM端 enemies 默认视图仍是 BroadcastPreview**：BroadcastPreview 当前只显示一条日志，后续可改为敌人快捷概览列表。
2. **玩家端无敌人选中时 EnemyRoster 仍显示完整 UnitCard**：后续可精简为 compact chips。
3. **选中的敌人节点在舞台上无额外视觉反馈**（除金色边框外）：后续可添加脉动动画或信息浮层。

---

## 8. 下一轮建议（PHASE 4）

**目标：重整招式与宣言面板**

- 将招式卡片从网格布局改为可水平滚动的"手牌区"
- 招式卡片直接显示阴阳要求、势条件、基础效果摘要
- 宣言流程优化：选中招式 → 拖骰入槽 → 确认宣言
- 引入招式过滤（按可用性/式位/类别）
- 基础动作（调息/返照）独立分组
