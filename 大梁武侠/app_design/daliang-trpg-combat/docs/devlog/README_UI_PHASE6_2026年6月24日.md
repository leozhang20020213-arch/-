# PHASE 6 — 建立交锋状态机，重构阶段按钮

**日期**: 2026-06-24  
**分支**: ui-combat-refactor  
**目标**: 用状态机驱动底部阶段栏，每个阶段只显示可用按钮，禁用原因统一显示在提示栏。

---

## 1. 状态机阶段

### 引擎阶段 → 展示阶段映射

| 引擎 phase | 展示 DisplayPhase | 说明 |
|------------|------------------|------|
| `setup` / `initiative` | **准备** | 开局/先攻判定 |
| `scene` / `declare` | **宣言** | 情景/宣言锁气 |
| `intercept_window` | **响应** | 截击窗口 |
| `react_window` | **计算** | 应招窗口 |
| `outcome` | **结算** | 落果结算 |
| `round_end` | **势变化** | 轮末势变化 |

---

## 2. 每个阶段可用按钮

### 未开始
| 按钮 | 可见 | 条件 |
|------|------|------|
| [开始场景] | 全员 | 总是可用 |

### 准备
| 按钮 | 可见 | 条件 |
|------|------|------|
| [进入宣言] | 全员 | 总是可用 |

### 宣言
| 按钮 | 可见 | 条件 |
|------|------|------|
| [确认宣言并锁气] | 全员 | 已选招式 + 已选目标 + 槽位满足 |
| [等待确认截击] / [开启截击窗口] | 玩家/DM | DM 需要有待结算宣言 |

### 响应
| 按钮 | 可见 | 条件 |
|------|------|------|
| [截击] | 仅 DM | 有待结算宣言 |
| [放弃响应] | 仅 DM | 总是可用 |
| [应招] | 仅 DM | 有待结算宣言 |

### 计算
| 按钮 | 可见 | 条件 |
|------|------|------|
| [应招] | 仅 DM | 有待结算宣言 |
| [跳过应招] | 仅 DM | 总是可用 |

### 结算
| 按钮 | 可见 | 条件 |
|------|------|------|
| [查看落果] | 全员 | 总是可用 |

### 势变化
| 按钮 | 可见 | 条件 |
|------|------|------|
| [结算势变化] | 仅 DM | DM 模式 |
| [进入下一轮] | 仅 DM | DM 模式 |

---

## 3. 玩家/DM 显示差异

### 提示语差异

| 阶段 | 玩家端 | DM端 |
|------|--------|------|
| 宣言 | "选择招式、目标，拖骰入槽，点击确认宣言" | "宣言已提交，请确认是否开启截击/应招窗口" |
| 响应 | "等待主持人确认响应窗口" | "请选择是否开启截击或放弃响应" |
| 计算 | "等待主持人裁定应招" | "请裁定应招结果" |
| 结算 | "查看落果结算" | "结算伤害与效果" |
| 势变化 | "等待主持人推进下一轮" | "请确认势变化并推进轮次" |

### 按钮可见性
- DM 模式：显示所有 `visibleTo: "both"` + `"dm"` 的按钮
- 玩家模式：只显示 `visibleTo: "both"` + `"player"` 的按钮
- 截击/应招/跳过响应/势变化等 DM 专属按钮对玩家不可见

---

## 4. 状态字段

### PhaseActionBar 输入
```typescript
interface ActionCheckInput {
  phase: CombatState["phase"];
  hasPendingAction: boolean;
  hasSelectedMove: boolean;
  hasSelectedTarget: boolean;
  hasSlottedDice: boolean;
  isDM: boolean;
  round: number;
}
```

### PhaseAction 定义
```typescript
interface PhaseAction {
  type: PhaseActionType;
  label: string;           // 默认标签
  playerLabel?: string;    // 玩家端覆盖
  dmLabel?: string;        // DM端覆盖
  visibleTo: "player" | "dm" | "both";
  enabled: boolean;
  disabledReason: string;  // 禁用原因（空=可用）
}
```

### PhaseActionType 枚举
```typescript
type PhaseActionType =
  | "START_SCENE" | "START_DECLARATION" | "CONFIRM_DECLARATION"
  | "OPEN_RESPONSE_WINDOW" | "DECLARE_INTERCEPT" | "DECLARE_RESPONSE"
  | "SKIP_RESPONSE" | "RESOLVE_RESULT"
  | "APPLY_MOMENTUM" | "NEXT_ROUND" | "END_SCENE";
```

---

## 5. 禁用原因显示

- 禁用原因**不写在按钮上**，统一收集到右侧提示栏
- 多个原因用 ` · ` 分隔
- 例如："未选择招式 · 阴槽/阳槽未满足需求"
- 当所有按钮可用时，提示栏显示自然语言阶段提示

---

## 6. 新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/lib/combat/combatPhaseMachine.ts` | **新增** | 状态机纯函数：toDisplayPhase, getAvailablePhaseActions, getPhaseHint, canTransition |
| `src/ui/combat/PhaseActionBar.tsx` | **重写** | 从只读步骤指示器 → 动态按钮 + 原因提示栏 |
| `src/styles/combat-shell.css` | 修改 | PhaseActionBar CSS 从步骤指示器改为按钮样式 |
| `src/ui/App.tsx` | 修改 | 4 个 desk 组件更新 PhaseActionBar props |
| `docs/devlog/README_UI_PHASE6_2026年6月24日.md` | **新增** | 本文件 |

---

## 7. 关于 Zustand

项目当前使用 React useState 管理所有状态（App.tsx 内聚）。评估后决定**暂不引入 Zustand**：
- 状态机函数已设计为纯函数（输入状态 → 输出可用动作），无需额外 store
- 引入 Zustand 需要重构整个状态管理层，风险过高
- PhaseActionBar 所需的所有判断信息均可从现有 `CombatState` + props 推导
- 后续如需跨组件状态共享，可择机引入 React Context 或 Zustand

---

## 8. 当前已知问题

1. **CONFIRM_DECLARATION 按钮与 QiDiceDock 的确认按钮功能重叠**：两者都触发宣言确认，后续需统一。
2. **hasSlottedDice 由 QiDiceDock 内部管理**：PhaseActionBar 无法感知槽位状态，当前传 `false`。
3. **旧 PhaseActionBar 步骤指示器样式已删除**：不再显示阶段流程步骤。
4. **状态机函数为纯函数，不持有状态**：实际状态仍在 App.tsx 的 useState 中。

---

## 9. 下一轮建议（PHASE 7）

**目标：玩家/DM 界面最终分离**

- 玩家端和 DM 端使用完全不同的 PhaseActionBar 配置
- 玩家端移除所有 "等待 DM" 的弱提示，改为更积极的引导
- DM 端增加快捷键支持（1=截击, 2=应招, 3=跳过, 4=落果, 5=下一轮）
- 清理 App.tsx 中不再使用的死代码
