# Phase 9: 交锋状态机接入气骰系统

> **日期**: 2026 年 6 月 24 日
> **状态**: 已完成
> **构建**: 通过 ✅ (124 modules)

---

## 一、目标

点击"开始场景"后不只是改变文字，而是自动初始化/投掷气海气骰。宣言阶段才能锁气，结算后骰子进息库，下一轮保留未用骰。

## 二、阶段机与气骰接入

### 阶段流转

```
未开始 ─[开始场景]→ 宣言
   │                  ├─ 初始化气骰（如气海为空）
   │                  └─ 投掷所有气海骰
   │
宣言 ─[确认宣言并锁气]→ 响应
   │                    └─ 骰子锁定，阴槽/阳槽记入 declaration
   │
响应 ─[结算]→ 结算
   │          └─ 锁定的骰子移入息库
   │
结算 ─[下一轮]→ 宣言
   │             ├─ round + 1
   │             └─ 气海未用骰保留，息库骰不动
```

### 实现方式

在 `App.tsx` 的 `PlayerCombatDesk` 和 `DmCombatDesk` 中创建协调处理函数：

```typescript
// 使用 useDiceStore() 获取 dice 操作
const { initStarterDice, getQiSeaDice, resolveDeclaration, ... } = useDiceStore();

// 开始场景：两系统同步
function handleStartScene() {
  if (getQiSeaDice().length === 0) initStarterDice();
  props.patch((current) => enterScene(current));
}

// 结算：骰子进息库
function handleResolve() {
  if (diceState.declarationStatus === "locked") diceResolveDeclaration();
  props.patch((current) => applyOutcome(current));
}

// 下一轮：保留未用骰
function handleNextRound() {
  props.patch((current) => endRound(current));
}
```

### 两套系统的关系

当前有两套独立的骰子系统：

| 系统 | 类型 | 用途 |
|------|------|------|
| `CombatState.dice` | `QiDie[]` (combat/types.ts) | 战斗引擎计算（伤害、势等） |
| `DiceStoreState.qiDice` | `QiDieData[]` (types/dice.ts) | 2D UI 显示与交互 |

Phase 9 在阶段转换时同时操作两套系统以保持同步。后续可考虑统一为一套数据源。

## 三、开始场景流程

```
玩家点击"开始场景"
  │
  ├─→ getQiSeaDice().length === 0 ?
  │     YES → initStarterDice()      // 生成 6 枚入门骰
  │
  ├─→ props.patch(enterScene)
  │     └─ combatEngine.enterScene()
  │         ├─ phase = "scene"
  │         ├─ QI_POOL dice → QI_SEA with rolled values
  │         └─ 崩势→失势 auto-transition
  │
  └─→ PhasePromptBar 显示：
        "第1轮，沈青行动中。请选择招式、目标，并投入气骰。"
```

## 四、确认宣言流程

只在 `phase === "宣言"` 或 `"scene"` 时可用。

```
玩家拖骰入槽 → 点击"确认宣言并锁气"
  │
  ├─→ lockDeclaration() (dice store)
  │     ├─ 记录阴槽/阳槽骰子快照
  │     └─ 标记 locked: true
  │
  ├─→ declarationStatus = "locked"
  │
  └─→ PhasePromptBar 显示：
        "宣言已提交，等待主持人确认。"
```

## 五、结算流程

```
点击"查看落果"
  │
  ├─→ resolveDeclaration() (dice store)
  │     └─ locked dice → qiSea → restPool
  │
  ├─→ props.patch(applyOutcome)
  │     └─ combatEngine.applyOutcome()
  │         ├─ phase = "outcome"
  │         └─ 结算伤害、势变化
  │
  └─→ 骰子状态：
        ├─ 已用骰 → 息库（需调息取回）
        └─ 未用骰 → 气海（保留）
```

## 六、下一轮流程

```
点击"进入下一轮"
  │
  ├─→ props.patch(endRound)
  │     └─ combatEngine.endRound()
  │         ├─ round += 1
  │         ├─ phase = "setup"
  │         └─ responseQuotaUsed reset
  │
  └─→ 保留：
        ├─ 气海未用骰（不变）
        └─ 息库骰（不自动回气海，需调息）
```

## 七、新增文件

| 文件 | 说明 |
|------|------|
| `src/lib/combat/diceFlow.ts` | 协调工具：prepareStartScene / prepareResolve / prepareNextRound |

## 八、修改文件

| 文件 | 变更 |
|------|------|
| `src/ui/App.tsx` | PlayerCombatDesk & DmCombatDesk 中接入 `useDiceStore`，创建 `handleStartScene`、`handleResolve`、`handleNextRound` 协调函数 |

## 九、手动测试流程

1. **启动场景**
   - 点击"开始场景" → 气海出现 6 枚已投掷骰子
   - 底部提示变为 "第1轮，沈青行动中。请选择招式、目标，并投入气骰。"

2. **宣言锁气**
   - 右侧选择"雨步斩"，点击战场上的"短兵客"
   - 从气海拖一枚阴骰到阴槽（需至少 1 阴 1 阳）
   - 点击"确认宣言并锁气"
   - 骰子标记为 🔒，底部提示变为 "宣言已提交"

3. **结算**
   - 点击"查看落果"
   - 锁定的骰子从阴槽/阳槽消失，进入息库
   - 底部阶段变为"势变化"

4. **下一轮**
   - 点击"进入下一轮"
   - round 变为 2，phase 回到宣言
   - 气海中未用骰保留，息库骰仍在息库

5. **调息取回**
   - 在 QiZonePanel 中点击"调息"
   - 息库骰移回气海

## 十、已知限制

1. 两套骰子系统（combat engine QiDie vs dice store QiDieData）独立维护，值可能不完全一致
2. `useDiceRollAnimation` 和 `handleStartScene` 的角色分工需进一步明确（动画 hook 管理 UI 动画，协调函数管理阶段转换）
3. DM 视角下气骰状态同步尚未完整测试

---

*Phase 9 完成。交锋状态机已接入气骰系统，开始场景自动投骰，结算后骰进息库。*
