# 战场角色卡排布 — 规整化与扩展位设计

> 本轮改动范围：仅中间战场区的角色卡排布逻辑。不改左侧/右侧/全局美术。

## 改动摘要

### 1. 引入 BoardSlot 系统

新增文件 `src/lib/combat/boardLayout.ts`，定义按阵营分区的 slot 网格：

| 阵营 | 前排 | 后排 | 总计 |
|------|------|------|------|
| 玩家方 (player) | 主位 ×3 | 后位 ×2 | 5 slots |
| 敌方 (enemy) | 前排 ×4 | 后排 ×3 | 7 slots |
| 友方 (ally) | — | 援位 ×2 | 2 slots |
| 中立 (neutral) | — | 中立 ×2 | 2 slots |

每个 slot 预定义了 `x, y` 百分比坐标，确保卡片不会重叠。

### 2. 自动分配逻辑

`assignActorsToSlots(actorIds, occupiedSlotIds)`:
- 同一阵营的 actor 按顺序占据该阵营的空闲 slot
- 新角色加入时优先占空位
- 若某阵营 slot 已满，溢出角色放在该侧底部

### 3. 战场区视觉分区

- **玩家方区域**：左侧 0–25%，带蓝色虚线边框 + "我方" 标签
- **敌方区域**：右侧 75–100%，带红色虚线边框 + "敌方" 标签
- **友方/中立区域**：仅在对应角色在场时显示
- **中央中场空间**：保留给目标线和距离标签

### 4. 高亮保持

- 当前行动者：金色光晕 + 脉冲动画
- 当前目标：红色目标环 + 十字准星角标
- 目标线：从行动者到目标的有向 SVG 线，带距离标签
- 所有高亮逻辑基于 actor ID，不受排布变化影响

## 涉及文件

| 文件 | 改动 |
|------|------|
| `src/types/combat.ts` | 新增 `CombatSide`, `BoardSlot`, `ActorPlacement` 类型；`Combatant` 增加 `slotId` 字段 |
| `src/lib/combat/boardLayout.ts` | **新文件**，slot 定义 + 分配/查找/锚点函数 |
| `src/data/mockCombatData.ts` | 重写 `actorsToCombatants()` 使用 slot 定位；MOCK_STAGE_DATA 坐标与 slot 一致 |
| `src/ui/combat/stage/CombatStage.tsx` | 按阵营分组渲染；添加 side-zone 背景容器；阵营人数标签 |
| `src/ui/combat/stage/CombatantNode.tsx` | 新增 `ally`/`neutral` 侧边样式类 |
| `src/styles/combat-stage.css` | 新增 side-zone-bg 样式、zone 标签、ally/neutral 边框色 |

## 扩展位设计

1. **加新玩家角色**：自动分配到下一个空闲 `player-main-*` 或 `player-rear-*` slot
2. **加新敌人**：自动分配到下一个空闲 `enemy-front-*` 或 `enemy-rear-*` slot
3. **加友方/NPC**：`ally` / `neutral` slot
4. **slot 满了**：溢出角色放在该侧底部，y=88%
5. **修改 slot 坐标**：只需编辑 `boardLayout.ts` 中的常量数组

## 尚未完成

- 角色卡拖拽重新排位（手动换位）
- 地形/障碍物可视化
- 复杂走位路径
- 角色入场/退场动画
- slot 占用状态在 UI 上的可视化占位框
