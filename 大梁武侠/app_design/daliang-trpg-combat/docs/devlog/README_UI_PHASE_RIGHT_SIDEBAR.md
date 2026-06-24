# 右侧栏重构：删除敌人公开卡并接通调息返照

## 本轮目标

重构"大梁江湖 TRPG"的右侧栏与基础动作系统，重点处理：删除常驻敌人公开卡、点击战场敌人卡显示情报、接通调息与返照基础动作。

## 改动摘要

| 改动 | 说明 |
|------|------|
| 删除敌方概览 | 左侧 LeftCombatPanel 中"敌方概览"常驻模块已移除，场景进度/最近动态自然上移 |
| 点击战场敌人 → 右侧情报 | 点击中间交锋区域敌人卡后，右侧 EnemyPublicDrawer 显示敌人情报（已知信息） |
| 关闭情报卡 | 情报卡有 × 关闭按钮，关闭后只清空选中，不清除当前目标 |
| 调息接通 | 调息成为可选基础动作卡，可点击选中、确认执行，从息库取回气骰入气海 |
| 返照接通 | 返照成为可选基础动作卡，可点击选中、确认执行，气海为空时取回最低起投气骰 |
| 统一可用性判断 | combatEngine.ts 新增 `getBasicActionAvailability` 函数，返回 `usable` + `reasonTags` + `detailReasons` |
| 动态确认按钮 | 确认按钮文案随选择变化：确认宣言并锁气 / 确认调息 / 确认返照 |

## 改动文件清单

### 核心引擎
| 文件 | 改动说明 |
|------|----------|
| `src/combat/combatEngine.ts` | 新增 `BasicActionType`、`SkillAvailability` 接口、`getBasicActionAvailability()` 函数；调息检查息库非空+时点，返照检查气海为空+时点 |

### UI 组件
| 文件 | 改动说明 |
|------|----------|
| `src/ui/combat/LeftCombatPanel.tsx` | 删除"敌方概览"模块（enemy-roster-compact 区域）；移除未使用的 `enemies` 变量 |
| `src/ui/App.tsx` | **重大重构** — 新增 `selectedBasicAction` 状态；`patch()` 清空基本动作选择；新增 `executeBasicAction()` 执行调息/返照；新增 `getBasicActionAvailability` 导入；`ActionPanel` 全量重写（调息/返照作为可选卡牌、动态确认按钮、摘要面板、目标/招式下拉仅在普通招式时显示）；`DeskProps` 新增 `selectedBasicAction`/`setSelectedBasicAction`/`executeBasicAction`；`PlayerCombatDesk`/`DmCombatDesk` 右侧敌人区无选中时显示提示文案替代 EnemyRoster |

### 样式
无需新增样式 — 复用已有 `.action-card`、`.selected`、`.warn`、`.hint` 等现有 class。

## 实现的关键交互

### 1. 删除敌人公开卡
- **左侧**：原"敌方概览"区域（enemy-roster-compact）完全移除
- **右侧**：无选中敌人时显示"点击战场敌人卡片查看情报"提示，不再渲染 EnemyRoster
- **布局**：场景进度/最近动态自然上移，无空洞

### 2. 点击战场敌人卡显示情报
- **已存在**：`CombatStage.onSelect` → `setSelectedCombatantId` + `setSelectedTargetId`
- **右侧**：`EnemyPublicDrawer`（player 模式）显示已知情报（名称、气血条、势、状态、已知弱点、行为倾向、已知招式）
- **关闭**：× 按钮 → `setSelectedCombatantId(undefined)`，不清除 `selectedTargetId`

### 3. 调息卡
- **位置**：右侧招式卡网格中，与普通招式并列
- **选中**：点击 → `setSelectedBasicAction("regulateBreath")`，高亮 selected 态
- **可用条件**：当前行动者 + scene/declare 阶段 + 息库有气骰
- **不可用标签**：息库为空 / 非当前时点
- **确认**："确认调息"按钮 → `executeBasicAction("regulateBreath")` → `regulateBreath(state, actorId, [die.id], true)`
- **日志**：`{角色名} 主动调息（重掷入气海），1 枚气骰从息库回气海。`

### 4. 返照卡
- **位置**：右侧招式卡网格中，与普通招式并列
- **选中**：点击 → `setSelectedBasicAction("fanzhao")`，高亮 selected 态
- **可用条件**：当前行动者 + scene/declare 阶段 + 气海为空
- **不可用标签**：气海未空 / 非当前时点
- **确认**："确认返照"按钮 → `executeBasicAction("fanzhao")` → `useReflection(state, actorId)`
- **日志**：`{角色名} 返照，取回最低可用气骰 {sourceName}（{value}点），不重掷。`

### 5. 统一可用性函数
```typescript
function getBasicActionAvailability(state, actorId, actionType): SkillAvailability {
  // 调息: 自身目标、无需敌方、无需距离、息库非空、scene/declare阶段
  // 返照: 自身目标、无需敌方、无需距离、气海为空、scene/declare阶段
  return { usable, reasonTags, detailReasons };
}
```
短标签：可用 / 息库为空 / 气海未空 / 非当前时点 / 非当前行动者

### 6. 动态确认按钮
| 选择 | 按钮文案 |
|------|----------|
| 普通招式 | 确认宣言并锁气 |
| 调息 | 确认调息 |
| 返照 | 确认返照 |

### 7. 右侧卡片列表
右侧招式/动作卡网格包含：
1. 普通招式（如破浪横刀、回潮压刃等）
2. 调息（基础动作 · 目标：自身）
3. 返照（特殊动作 · 目标：自身）

## 未完成 / 已知限制

1. **返照次数限制**：当前 `getBasicActionAvailability` 中 `_reflectionUsedCount` 参数预留但未接入实际计数。需要后续在 CombatState 中添加交锋内返照使用记录。
2. **调息取回数量**：当前每次调息取回 1 枚息库气骰。后续应根据规则配置支持取回多枚。
3. **敌人情报的"已知/隐藏"字段**：当前按 mock 处理，`publicWeakness` 和 `knownMoves` 已显示，"隐藏"字段（hiddenGoal、hiddenStatuses 等）仅 DM 模式可见。
4. **调整势卡**：当前调整势卡作为普通招式的一部分（通过 `changeMomentum` 效果），尚未独立为特殊动作卡类型。
5. **DM 端 DmControlPanel**：DM 端的调息/返照按钮仍通过 `onRegulateBreath`/`onReflection` props 走旧路径，未改用 `executeBasicAction`。
6. **移动端适配**：右侧栏 380px 固定宽度，移动端需要响应式处理。

## 验收结果

| 验收项 | 状态 |
|--------|------|
| 左侧不再有"敌方概览 / 敌人公开卡" | ✅ |
| 点击战场敌人卡后右侧出现敌人信息 | ✅ |
| 敌人信息卡可关闭 | ✅ |
| 敌人信息卡只显示已知情报 | ✅（player 模式） |
| 调息卡可点击选中 | ✅ |
| 调息息库非空时可执行 | ✅ |
| 调息不要求选择敌方目标 | ✅ |
| 调息不检查距离 | ✅ |
| 返照卡可点击选中 | ✅ |
| 返照气海为空时可执行 | ✅ |
| 返照不要求选择敌方目标 | ✅ |
| 返照不检查距离 | ✅ |
| 调息/返照走统一确认流程 | ✅ |
| 执行调息/返照后气骰状态真实变化 | ✅（调用已有 engine 函数） |
| 执行调息/返照后日志有记录 | ✅（engine 函数内置 appendLog） |
| 不出现"夺势"二字 | ✅ |
| 不改动不相关页面 | ✅ |

## 构建/检查结果

```
npm run build  → ✅ PASS (tsc -b && vite build)
npm run test:all → ✅ 68 pass / 0 fail
npm run lint  → ❌ 不存在（项目无 lint 脚本）
TypeScript --noEmit → ✅ 零错误
```
