# README — 气骰可视化 Phase 1（MVP）

**日期：** 2026年6月24日  
**分支：** `dice-system-first-pass`  
**作者：** 自动生成（Claude Code · DeepSeek V4 Pro）

---

## 1. 本阶段目标

**解决气骰不可见问题。**

在交锋页面（所有桌面模式）的中央下方区域，新增一个 2D 气骰盘（QiDiceTray），让玩家可以：
- 看到气海中的每一枚气骰（2D 卡片式）
- 点击「初始化气骰」生成入门气骰（2阴D6 + 2阳D6 + 2原D4）
- 点击「投掷气海」随机刷新所有气海骰子点数
- 点击「全部回气海」将全部骰子重置回气海

---

## 2. 修改了哪些文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/ui/App.tsx` | 修改 | 引入 DiceStoreProvider + QiDiceTray2D，包裹所有桌面路由；替换 scene 模式 qiZone 占位；combat 模式 qiZone 增加 2D 骰盘 |
| `src/store/diceStore.tsx` | 新建 | React Context + useReducer 骰子状态管理 |
| `src/types/dice.ts` | 新建 | QiDieData / QiDieKind / DieSides 等类型定义 |
| `src/lib/dice/diceRoll.ts` | 新建 | rollDie / rollQiDie / createQiDie / createStarterQiDice |
| `src/components/dice/QiDie2D.tsx` | 新建 | 单枚 2D 气骰卡片组件 |
| `src/components/dice/QiDiceTray.tsx` | 新建 | 气海骰盘容器组件 |
| `src/components/dice/QiDiceToolbar.tsx` | 新建 | 骰子操作工具栏 |
| `src/components/dice/dice.css` | 新建 | 2D 骰子系统全部样式 |

**未修改的现有文件：**
- `src/combat/types.ts` — QiDie 引擎类型保持不变
- `src/ui/combat/dice/QiDie.tsx` — 现有骰子卡片组件保持不变
- `src/ui/combat/dice/QiDiceDock.tsx` — 现有骰子停靠栏保持不变
- `src/dice3d/` — 3D 骰子系统保持不变

---

## 3. 新增了哪些组件

### 3.1 QiDie2D（单枚骰子卡片）

**路径：** `src/components/dice/QiDie2D.tsx`

显示内容：
- **左上角**：阴/阳/原 性质标识
- **中央大字**：当前点数（value）
- **右下角**：骰阶（D4/D6/D8/D10/D12/D20）

视觉特性：
- 根据 sides 自动缩放尺寸（D4 最小 50px → D20 最大 85px）
- 根据 kind 改变边框色和底纹：
  - 阴骰：青蓝冷色 `#3a7ca5`
  - 阳骰：赤金暖色 `#c8782a`
  - 原始骰：灰白中性 `#8a8a80`
- 选中态：金色边框 + 发光
- 投掷动画：400ms CSS 脉冲旋转

### 3.2 QiDiceTray（气海骰盘）

**路径：** `src/components/dice/QiDiceTray.tsx`

布局：
```
┌──────────────────────────────────────────────┐
│ 气海 · 当前可用气骰 N 枚     [工具栏按钮]    │
├──────────────────────────────────────────────┤
│  [阴D6] [阴D6] [阳D6] [阳D6] [原D4] [原D4] │
│    3      2      5      1      2      4      │
├──────────────────────────────────────────────┤
│ 气海 N 枚              上次投掷：14:30:22    │
└──────────────────────────────────────────────┘
```

- 空状态：显示 🎲 + "气海暂无气骰。请开始场景或调息。" + 操作提示
- 自包含：通过 `useDiceStore()` 读取/写入骰子状态

### 3.3 QiDiceToolbar（工具栏）

**路径：** `src/components/dice/QiDiceToolbar.tsx`

三个按钮：
1. 🎲 **初始化气骰** — 仅在无骰时可点击，生成 6 枚入门骰
2. 🎯 **投掷气海** — 有骰时可点击，400ms 动画后刷新所有气海骰点数
3. ↩ **全部回气海** — 有骰时可点击，将所有骰子移到气海并解锁

---

## 4. 新增了哪些类型/状态/函数

### 类型（`src/types/dice.ts`）

```typescript
QiDieKind        = "yin" | "yang" | "raw"
QiDieFace        = "阴" | "阳" | "原"
DieSides         = 4 | 6 | 8 | 10 | 12 | 20
QiDieLocation    = "qiSea" | "tempQi" | "restPool" | "lockedYin" | "lockedYang"
QiDieData        = { id, kind, face, sides, value, location, source?, temporary?, locked? }
```

常量：`DIE_SIDES_LABEL`, `DIE_SIZE_SCALE`, `DIE_KIND_LABEL`

### 工具函数（`src/lib/dice/diceRoll.ts`）

- `rollDie(sides)` — 返回 1..sides 随机数
- `rollQiDie(die)` — 投掷单枚骰子，返回新对象
- `createQiDie(input)` — 创建单枚骰子
- `createStarterQiDice()` — 生成入门骰组（2阴D6 + 2阳D6 + 2原D4）

### 状态管理（`src/store/diceStore.tsx`）

**State:**
```typescript
{
  qiDice: QiDieData[]       // 全部气骰
  selectedDieId: string | null  // 当前选中骰子
  lastRollAt: number | null     // 上次投掷时间戳
}
```

**Actions:**
- `INIT_STARTER_DICE` — 生成入门骰（空时才生效）
- `ROLL_ALL_QI_SEA` — 投掷所有气海骰
- `MOVE_DIE` — 移动单枚骰子到指定位置
- `RESET_TO_QI_SEA` — 全部回气海
- `SELECT_DIE` — 选中/取消选中
- `SET_DICE` — 批量设置骰子

**Hook:** `useDiceStore()` — 返回 state + 便捷方法

---

## 5. 当前如何运行

```bash
cd app_design/daliang-trpg-combat
npm install
npm run dev:legacy
```

浏览器打开 `http://127.0.0.1:5173`，进入游戏 → 选择角色 → 进入玩家/DM 桌面。

---

## 6. 当前如何手动测试

1. 启动应用，进入任意桌面（玩家场景 / 玩家交锋 / DM场景 / DM交锋）
2. 确认页面中央下方出现 **气海骰盘**（深色背景卡片）
3. 气海骰盘显示 🎲 "气海暂无气骰。请开始场景或调息。"
4. 点击 **「🎲 初始化气骰」** 按钮
5. 确认 6 枚骰子卡片出现：
   - 2 枚阴骰（青蓝色，D6，初始值 1）
   - 2 枚阳骰（暖橙色，D6，初始值 1）
   - 2 枚原骰（灰色，D4，初始值 1）
6. 点击 **「🎯 投掷气海」** 按钮
7. 观察骰子执行 400ms 旋转脉冲动画
8. 确认每枚骰子点数变为 1..sides 范围内的随机值
9. 点击「↩ 全部回气海」确认全部骰子回到气海
10. **1920×1080 下骰子清晰可见**，文字不淡

---

## 7. 已知问题

1. **2D 骰子系统与 3D 骰子系统独立运行** — 两个系统使用各自的 state，不互通。3D QiDiceTray 仍使用 `CombatState.dice`（QiDie 类型），2D QiDiceTray2D 使用 `DiceStore`（QiDieData 类型）。
2. **骰子不可拖入阴槽/阳槽** — 这是 Phase 2 的工作。
3. **尚未锁气** — 这是 Phase 3 的工作。
4. **尚未 3D 动画** — 这是后续 Phase 的工作（可能在 2D 稳定后）。
5. **入门骰初始值固定为 1** — 需要点击"投掷气海"来随机化。
6. **未与 CombatState.dice 同步** — 两个骰子系统目前独立。后续需要桥接。

---

## 8. 下一阶段建议

**Phase 2：拖拽投入阴槽/阳槽**

目标：
1. 实现 HTML5 Drag & Drop 或 pointer-event 拖拽
2. 将气海骰子拖入阴槽/阳槽区域
3. 阴骰 → 阴槽，阳骰 → 阳槽，原始骰 → 任意槽
4. 显示槽值合计
5. 与现有 QiDiceDock 的 CurrentMoveSlots 桥接

建议：
- 先实现 2D 拖拽，稳定后再考虑 3D
- 拖入后骰子 visual 应移动到槽区
- 支持从槽区拖回气海

---

## 9. 路径说明

用户要求路径 vs 实际落地路径：

| 要求路径 | 实际路径 | 说明 |
|----------|----------|------|
| `src/types/dice.ts` | 同 | ✅ 新建 |
| `src/lib/dice/diceRoll.ts` | 同 | ✅ 新建 |
| `src/store/diceStore.ts` | `src/store/diceStore.tsx` | ✅ 含 JSX，使用 .tsx 扩展名 |
| `src/components/dice/QiDie2D.tsx` | 同 | ✅ 新建 |
| `src/components/dice/QiDiceTray.tsx` | 同 | ✅ 新建 |
| `src/components/dice/QiDiceToolbar.tsx` | 同 | ✅ 新建 |
| `src/components/dice/dice.css` | 同 | ✅ 新建 |

现有骰子文件位置（未修改）：
- `src/ui/combat/dice/QiDie.tsx` — 原有骰子卡片
- `src/ui/combat/dice/QiDiceDock.tsx` — 原有停靠栏
- `src/dice3d/QiDiceTray.tsx` — 原有 3D 骰盘
- `src/styles/qi-dice.css` — 原有骰子样式
- `src/combat/types.ts` — 原有 QiDie 类型

---

## 构建结果

✅ `npm run build` — 通过  
✅ TypeScript 编译 — 无错误  
✅ Vite 构建 — 成功（108 modules）

---

*Phase 1 完成。骰子现已可见。*
