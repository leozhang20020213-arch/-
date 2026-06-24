# 大梁江湖 TRPG 交锋 UI 重构 — 阶段二：行动顺序队列

**日期**: 2026-06-24
**分支**: `dice-system-first-pass`
**状态**: ✅ 完成

## 改动摘要

重构顶部轮次栏，从简单"第N轮→角色名"改为由先攻值排序的行动顺序队列。每个角色以紧凑头像芯片显示当前/已行动/可响应/濒死状态。

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/lib/combat/turnOrder.ts` | **新建**。TurnOrderEntry / TurnState 数据结构、computeTurnOrder()（按先攻排序）、deriveTurnState()、shortPhaseLabel()（≤12字）、findNextActorIndex() 等纯函数。 |
| `src/ui/combat/TopCombatBar.tsx` | **重写**。中段改为行动顺序队列（横排头像芯片），每枚显示名称、先攻值、当前/已行动/可响应/濒死状态。当前行动者高亮金框+辉光，已行动者暗化+勾号，可响应者虚线边框+脉冲点。阶段文字控制在 12 字以内。 |
| `src/ui/utils/labels.ts` | 阶段标签缩短（"情景中"→"可宣言"，"宣言阶段"→"宣言中" 等，全≤12字）。 |
| `src/styles/combat-shell.css` | 新增 turn-chip / turn-arrow / respondPulse 等完整队列样式。当前行动者辉光动画。 |
| `src/ui/App.tsx` | 新增 `actedActorIds` 状态（Set<string>），加入 `DeskProps` 和 `common` 对象，传递至所有 4 个桌面组件的 TopCombatBar。 |

## 行动队列数据结构

```typescript
interface TurnOrderEntry {
  actorId: string;        // 角色标识
  name: string;           // 角色名称
  initiative: number;     // 先攻值 = 观照 + 身势
  hasActed: boolean;      // 本轮是否已行动
  isCurrent: boolean;     // 是否当前行动者
  canRespond: boolean;    // 是否可截击/应招
  momentum: ShiState;     // 当前势
  isDying: boolean;       // 是否濒死 (hp ≤ 0)
  side: "player"|"enemy"; // 阵营
  statusTags: string[];   // 公开状态标签
}
```

## 排序规则

1. 按先攻值（观照 + 身势）降序
2. 同值优先玩家方
3. 同阵营按名称排序（zh-Hans-CN）

## 阶段标签对照

| 引擎 phase | 旧标签 | 新标签 (≤12字) |
|-----------|--------|---------------|
| setup | 开局 | 准备开始 |
| initiative | 先攻判定 | 先后确认 |
| scene | 情景中 | 可宣言 |
| declare | 宣言阶段 | 宣言中 |
| intercept_window | 截击窗口 | 等待截击 |
| react_window | 应招窗口 | 等待应招 |
| outcome | 落果结算 | 结算中 |
| round_end | 轮次结束 | 轮次结束 |

## 测试结果

```
npm run test:all   # 68/68 通过
npm run build      # TypeScript + Vite 构建成功
```

## 已知限制

1. `actedActorIds` 目前未自动追踪（需在 applyOutcome 后手动标记，后续阶段完善自动追踪）
2. 响应窗口的"可截击/可应招"标记依赖于 phase 和 responseQuota，DM 需手动推进阶段
3. 响应阶段的实际"谁可响应"需要根据目标线和装备许可进一步过滤（后续阶段完善）
