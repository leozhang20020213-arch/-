# README — 气骰拖拽入槽 Phase 2

**日期：** 2026年6月24日  
**分支：** `dice-system-first-pass`  
**前置：** Phase 1（气骰可视化 MVP）已完成

---

## 1. 本阶段目标

**实现"选择招式 → 拖骰入阴槽/阳槽"的核心交互。**

玩家现在可以：
1. 看到气海中的可拖拽骰子
2. 将骰子拖入阴槽或阳槽
3. 阴骰 → 阴槽，阳骰 → 阳槽，原始骰 → 任意槽
4. 不合法投入自动拒绝（显示拒绝原因）
5. 点击已投入骰子取回气海
6. 清空全部槽位

---

## 2. 使用了哪个拖拽库

**@dnd-kit/core** v6.x（全新安装，之前项目无拖拽库）

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

选择原因：
- React 原生，无 DOM 操作
- PointerSensor 支持精确触控
- DragOverlay 提供流畅拖拽预览
- 与现有组件模型一致

---

## 3. 阴骰/阳骰/原始骰投入规则

| 骰子性质 | 可投入阴槽 | 可投入阳槽 | 说明 |
|----------|-----------|-----------|------|
| 阴骰 (yin) | ✅ | ❌ "阳骰不能投入阴槽" | 仅阴 |
| 阳骰 (yang) | ❌ "阴骰不能投入阳槽" | ✅ | 仅阳 |
| 原始骰 (raw) | ✅ | ✅ | 任意槽 |
| 已锁定骰 | ❌ "该气骰已锁定" | ❌ "该气骰已锁定" | 不可移动 |

规则函数位于 `src/lib/dice/diceAssignment.ts`：
- `canDropDieToSlot(die, slot)` — 布尔判断
- `getDropRejectReason(die, slot)` — 人类可读拒绝原因
- `hasEnoughDiceForMove(yinCount, yangCount, req)` — 是否满足招式门槛

---

## 4. 新增组件

| 组件 | 路径 | 说明 |
|------|------|------|
| `QiAssignmentBoard` | `src/components/dice/QiAssignmentBoard.tsx` | 主布局：DndContext + 气海 + 阴槽 + 阳槽 |
| `QiDropSlot` | `src/components/dice/QiDropSlot.tsx` | 可放置槽位（useDroppable），显示已投入骰子 |
| `DraggableQiDie` | `src/components/dice/DraggableQiDie.tsx` | 可拖拽骰子包装器（useDraggable） |
| `AssignedDiceRow` | `src/components/dice/AssignedDiceRow.tsx` | 槽内已投入骰子行，点击取回 |

### 修改的组件

| 组件 | 修改内容 |
|------|---------|
| `QiDiceTray` | 新增 `draggable` 和 `canDrag` 属性，拖拽模式下渲染 `DraggableQiDie` |
| `QiDie2D` | 无修改（Phase 1 保持） |

---

## 5. 新增状态

### DiceStore 新增字段（`src/store/diceStore.tsx`）

```typescript
assignedYinDiceIds: string[]   // 阴槽中骰子 ID 列表
assignedYangDiceIds: string[]   // 阳槽中骰子 ID 列表
selectedMoveId: string | null   // 当前选中招式
moveRequirement: CurrentMoveQiRequirement | null  // 招式气性门槛
```

### 新增 Actions

| Action | 说明 |
|--------|------|
| `ASSIGN_DIE_TO_SLOT` | 将骰子投入槽位（验证 kind） |
| `RETURN_DIE_TO_SEA` | 将骰子从槽位取回气海 |
| `CLEAR_ASSIGNMENT` | 清空全部槽位 |
| `SET_MOVE_REQUIREMENT` | 设置当前招式门槛 |

### 新增便捷方法

- `assignDieToSlot(dieId, slot)` — 投入槽位
- `returnDieToQiSea(dieId)` — 取回气海
- `clearCurrentAssignment()` — 清空
- `setMoveRequirement(req)` — 设置招式需求
- `getAssignedYinDice()` — 获取阴槽骰子列表
- `getAssignedYangDice()` — 获取阳槽骰子列表

---

## 6. 手动测试步骤

1. 启动应用：`npm run dev:legacy`
2. 进入交锋桌面（玩家或 DM）
3. **初始化气骰** → 气海出现 6 枚骰子卡片
4. **投掷气海** → 骰子点数随机化
5. 观察槽位显示 "未选招式 · 请先选择招式和目标"
6. 在右侧面板**选择招式**（如"雨步横刀"）和**目标**（如"短兵客"）
7. 槽位变为可接受拖放状态，显示 "至少 1 枚" 门槛
8. **拖拽阴骰**（青色）到**阴槽** → 骰子从气海消失，出现在阴槽中
9. **拖拽阳骰**（橙色）到**阳槽** → 同上
10. **拖拽阴骰到阳槽** → 应拒绝，显示 "阴骰不能投入阳槽"
11. **拖拽原始骰**（灰色）到任意槽 → 应接受
12. 点击槽内骰子上的 **↩** → 骰子取回气海
13. 点击 **清空槽位** → 全部骰子回气海
14. 当槽满足 "至少 1 枚" 门槛时，槽标题显示 ✓ 完成状态

---

## 7. 当前还没有实现的内容

- **确认宣言并锁气** — Phase 3
- **3D 骰子动画** — 后续 Phase
- **气骰流转（锁气→息库→气海）** — Phase 3
- **招式结算** — Phase 4+
- **与原始 CombatState.dice 同步** — 后续桥接

---

## 8. 下一阶段建议

**Phase 3：确认宣言并锁气 + 气骰流转**

目标：
1. 添加"确认宣言并锁气"按钮
2. 锁气后骰子锁入 LOCK 区
3. 调息：从息库取回气海
4. 返照：气海空时获取新骰
5. 桥接 DiceStore ↔ CombatState（QiDieData ↔ QiDie）

---

## 9. 文件清单

### 新建文件（7 个）
| 文件 | 说明 |
|------|------|
| `src/lib/dice/diceAssignment.ts` | 投入规则验证 |
| `src/components/dice/QiAssignmentBoard.tsx` | 主拖拽布局 |
| `src/components/dice/QiDropSlot.tsx` | 可放置槽位 |
| `src/components/dice/DraggableQiDie.tsx` | 可拖拽骰子 |
| `src/components/dice/AssignedDiceRow.tsx` | 已投入骰子行 |
| `docs/devlog/README_DICE_PHASE2_2026年6月24日.md` | 本文档 |

### 修改文件（5 个）
| 文件 | 修改内容 |
|------|----------|
| `src/types/dice.ts` | 新增 QiSlotType、QiSlotAssignment、CurrentMoveQiRequirement |
| `src/store/diceStore.tsx` | 新增槽位状态和 actions |
| `src/components/dice/QiDiceTray.tsx` | 新增 draggable/canDrag 属性 |
| `src/components/dice/dice.css` | 新增 Phase 2 全部样式（~250 行） |
| `src/ui/App.tsx` | 接入 QiAssignmentBoard，替换四个桌面模式的 qiZone |
| `package.json` | 新增 @dnd-kit 依赖 |

---

## 构建结果

✅ `npm run build` — 通过  
✅ TypeScript 编译 — 无错误  
✅ Vite 构建 — 成功（110 modules）

---

*Phase 2 完成。气骰可拖入阴阳槽。*
