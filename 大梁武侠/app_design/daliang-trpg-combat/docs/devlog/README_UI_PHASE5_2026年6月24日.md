# PHASE 5 — 重构气骰区：卡牌式拖骰宣言流程

**日期**: 2026-06-24  
**分支**: ui-combat-refactor  
**目标**: 替换旧的气骰五区大仓库布局，改为卡牌游戏风格的"选招 → 拖骰 → 确认"流程。

---

## 1. 气骰区结构

### 旧结构
阴槽/阳槽像两个大仓库占据左右两侧，气海居中，缺乏操作引导。

### 新结构 (QiDiceDock)
```
┌──────────────────────────────────────────┐
│ TemporaryQiPool (临气) — 仅在有临时骰时显示 │
├───────────────────────┬──────────────────┤
│ QiPool (气海 60%)      │ CurrentMoveSlots  │
│                       │ (当前招式 40%)     │
│ [阴D6] [阳D8] [原D6]  │ ┌──────┬──────┐  │
│ [阴D6] [阳D4] ...     │ │ 阴槽  │ 阳槽  │  │
│                       │ │需≥1 ✓│需≥1 ✗│  │
│ 可拖拽骰子卡片         │ │[阴D6] │(拖入) │  │
│                       │ └──────┴──────┘  │
├───────────────────────┴──────────────────┤
│ 拖拽错误提示 (自动消失)                    │
├──────────────────────────────────────────┤
│ RestPool: 息库 2 | 锁气 1 | 气池 3       │
├──────────────────────────────────────────┤
│ [      确认宣言并锁气      ]              │
│ 未选择目标、阴槽未满足需求                  │
└──────────────────────────────────────────┘
```

---

## 2. 拖拽规则

| 骰子类型 | 可拖入阴槽 | 可拖入阳槽 | 说明 |
|----------|-----------|-----------|------|
| 阴骰 (yin) | ✅ | ❌ | 只能入阴槽 |
| 阳骰 (yang) | ❌ | ✅ | 只能入阳槽 |
| 原始骰 (raw) | ✅ | ✅ | 可入任意槽 |

### 拖拽前提条件
- ✅ 已选择招式 (`selectedMoveId` 非空)
- ✅ 已选择目标 (`selectedTargetId` 非空)
- ✅ 当前阶段为 `declare` 或 `scene`
- ❌ 未满足任一条件 → 禁止拖拽（骰子不可拖动）

### 不合法拖入
- 非法拖入 → 红色错误提示 toast，1.8 秒后自动消失
- 骰子自动返回气海，不进入槽位

### 槽位互斥
- 同一枚骰子只能在一个槽中
- 拖入阴槽 → 自动从阳槽移除
- 拖入阳槽 → 自动从阴槽移除
- 点击槽中骰子 → 返回气海

---

## 3. 原始骰规则

- `nature === "raw"` 的骰子标蓝色左边框
- `canDropDieToSlot(die, slot)` 对任意 slot 返回 `true`
- 可用于填补阴槽或阳槽的缺口
- 在"至少 1 阴 + 1 阳"的正式出手门槛中，原始骰只满足一侧

---

## 4. 确认宣言并锁气条件

按钮可用条件（`canConfirmDeclaration` 全部满足）：

1. ✅ 当前阶段为 `declare` 或 `scene`
2. ✅ 已选择招式 (`selectedMove` 非空)
3. ✅ 已选择目标 (`selectedTargetId` 非空)
4. ✅ 阴槽至少有 1 枚骰（正式出手需要）
5. ✅ 阳槽至少有 1 枚骰（正式出手需要）
6. ✅ 至少投入 1 枚骰

未满足时：
- 按钮灰色禁用
- 下方显示红色原因列表（如"未选择招式、阴槽未满足需求"）

---

## 5. 新增组件清单

| 组件 | 文件 | 说明 |
|------|------|------|
| `QiDiceDock` | `src/ui/combat/dice/QiDiceDock.tsx` | 气骰区总容器，管理槽位状态，组装所有子组件 |
| `QiDie` | `src/ui/combat/dice/QiDie.tsx` | 单枚骰子卡片：阴/阳/原 + D6/D8 + 点数 |
| `QiPool` | `src/ui/combat/dice/QiPool.tsx` | 气海区：横排可拖拽骰子卡片 |
| `CurrentMoveSlots` | `src/ui/combat/dice/CurrentMoveSlots.tsx` | 当前招式阴槽/阳槽拖放区 |
| `TemporaryQiPool` | `src/ui/combat/dice/TemporaryQiPool.tsx` | 临气区：临时骰子 |
| `RestPool` | `src/ui/combat/dice/RestPool.tsx` | 息库/锁气/气池统计条（可展开详情） |

### 新增逻辑文件
| 文件 | 说明 |
|------|------|
| `src/lib/combat/qiAssignment.ts` | 纯函数：`canDropDieToSlot()` `canConfirmDeclaration()` `getDropHint()` |

### 新增样式
| 文件 | 说明 |
|------|------|
| `src/styles/qi-dice.css` | 气骰区全套样式（~350行） |

---

## 6. 数据流

```
PlayerCombatDesk
  ├── selectedMoveId ──→ QiDiceDock.selectedMove
  ├── selectedTargetId → QiDiceDock.hasSelectedTarget
  ├── state.dice ────→ QiDiceDock.actorDice
  │
  └── QiDiceDock.onConfirm(yinIds, yangIds)
        ↓
        ├── canDeclareAction(state, actorId, moveId, {yinSlotDiceIds, yangSlotDiceIds})
        ├── 验证通过 → patch(declareAction(...))
        └── 验证失败 → setPrompt({ title, message })
```

QiDiceDock 内部使用 `useState` 管理 `yinSlotIds` / `yangSlotIds`。

---

## 7. 修改文件列表

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/combat/qiAssignment.ts` | **新增** | 拖拽验证 + 确认条件纯函数 |
| `src/ui/combat/dice/QiDiceDock.tsx` | **新增** | 气骰区总容器 |
| `src/ui/combat/dice/QiDie.tsx` | **新增** | 骰子卡片 |
| `src/ui/combat/dice/QiPool.tsx` | **新增** | 气海区 |
| `src/ui/combat/dice/CurrentMoveSlots.tsx` | **新增** | 招式槽位 |
| `src/ui/combat/dice/TemporaryQiPool.tsx` | **新增** | 临气区 |
| `src/ui/combat/dice/RestPool.tsx` | **新增** | 息库/锁气统计 |
| `src/styles/qi-dice.css` | **新增** | 样式 |
| `src/main.tsx` | 修改 | +1 行 CSS 导入 |
| `src/ui/App.tsx` | 修改 | 替换 QiZoneBoard → QiDiceDock；新增 setPrompt 到 common/DeskProps |
| `docs/devlog/README_UI_PHASE5_2026年6月24日.md` | **新增** | 本文件 |

---

## 8. 当前已知问题

1. **旧 QiZoneBoard 代码仍在 App.tsx 中**：QiZoneBoard 函数定义未删除，只是不再被调用。后续清理。
2. **3D QiDiceTray 未集成**：旧的三维骰盘不再渲染。后续可将 3D 骰子投掷动画保留为弹窗效果。
3. **拖拽使用原生 HTML5 DnD**：未安装 dnd-kit。当前实现满足基本拖放需求，但无动画。
4. **骰子来源 (sourceName) 仅 tooltip 显示**：不在卡片主面展示。
5. **投掷入海按钮有回调但未连接到规则引擎**：当前仅展示，点击后无实际效果。

---

## 9. 下一轮建议（PHASE 6）

**目标：重整招式与宣言面板 + 状态机完善**

- 将 ActionPanel 从右栏移到舞台下方（手牌区）
- 招式卡片显示阴阳要求、势条件、式位等关键信息
- 宣言/成招/应招/落果的完整状态机驱动
- PhaseActionBar 从占位变为可点击的阶段推进按钮
