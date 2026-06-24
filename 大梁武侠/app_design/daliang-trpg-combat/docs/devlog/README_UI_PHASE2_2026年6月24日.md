# PHASE 2 — 把中央"共享交锋舞台"改成真正的战术组件

**日期**: 2026-06-24  
**分支**: ui-combat-refactor  
**目标**: 替换被裁切的 Phaser 棋盘图片，用 HTML 绝对定位 + SVG 距离线实现可交互的战术舞台。

---

## 1. CombatStage 数据结构

### StageData（舞台完整数据）
```typescript
interface StageData {
  sceneName: string;                 // 场景名，如"旧堤仓"
  sceneTags: string[];               // 场景标签，如 ["雨夜", "仓门", "堤岸", "货堆"]
  combatants: Combatant[];           // 角色节点列表
  distances: DistanceEdge[];         // 距离边列表
  objectives: SceneObjective[];      // 场景目标/进度轨
  selectedCombatantId?: string;      // 当前选中的角色ID
}
```

### Combatant（角色节点）
```typescript
interface Combatant {
  id: string;                        // 唯一ID（与Actor.id对应）
  name: string;                      // 显示名称
  side: "player" | "enemy" | "neutral"; // 阵营
  hp: number;                        // 当前气血
  maxHp: number;                     // 最大气血
  momentum: MomentumFace;            // 势面
  statuses: string[];                // 公开状态名列表
  avatar?: string;                   // 头像路径（可选）
  x: number;                         // 舞台X坐标（0-100百分比）
  y: number;                         // 舞台Y坐标（0-100百分比）
}
```

### DistanceEdge（距离边）
```typescript
interface DistanceEdge {
  from: string;                      // 起点Combatant.id
  to: string;                        // 终点Combatant.id
  band: DistanceBand;                // 距离档位
}

type DistanceBand = "贴身" | "近身" | "短距" | "中距" | "远距" | "离场";
```

### SceneObjective（场景目标）
```typescript
interface SceneObjective {
  id: string;                        // 唯一ID（与SceneTrack.id对应）
  title: string;                     // 目标名称
  current: number;                   // 当前进度
  target: number;                    // 目标值
}
```

### MomentumFace（势面）
```typescript
type MomentumFace = "阴盛" | "阳盛" | "合势" | "圆融" | "崩势" | "失势";
```

---

## 2. 新增组件清单

| 组件 | 文件 | 说明 |
|------|------|------|
| `CombatStage` | `src/ui/combat/stage/CombatStage.tsx` | 战术舞台主组件，组装 header + battlefield + objectives |
| `CombatantNode` | `src/ui/combat/stage/CombatantNode.tsx` | 单个角色节点：头像/姓名/HP条/势/状态标签，支持选中高亮 |
| `DistanceLine` | `src/ui/combat/stage/DistanceLine.tsx` | SVG 距离线：彩色连线 + 中点距离标签（如"近身"） |
| `SceneObjectiveMini` | `src/ui/combat/stage/SceneObjectiveMini.tsx` | 场景目标进度条（如"找到血镖箱 1/3"） |

### 新增数据文件
| 文件 | 说明 |
|------|------|
| `src/types/combat.ts` | 舞台专用类型定义（独立于规则引擎类型） |
| `src/data/mockCombatData.ts` | 数据适配器 + 静态 mock 数据 |
| `src/styles/combat-stage.css` | 战术舞台专用样式（~280行） |

---

## 3. 当前距离显示规则

- 距离线从 `Combatant.x/y` 坐标绘制 SVG `<line>` 元素
- 中点显示距离档位标签（如"近身"、"中距"），底色为暗色圆角矩形
- 颜色编码：
  - **贴身**：红色 `rgba(194,58,46,0.7)`
  - **近身**：橙色 `rgba(212,132,58,0.7)`
  - **短距**：黄色 `rgba(194,168,78,0.6)`
  - **中距**：绿色 `rgba(107,138,92,0.6)`
  - **远距**：蓝色 `rgba(58,92,122,0.5)` + 虚线
  - **离场**：灰色 `rgba(107,107,107,0.4)` + 虚线
- 距离线不可点击（`pointer-events: none`）

---

## 4. 点击节点后的状态变化

1. **点击任意 CombatantNode** → 触发 `onSelectCombatant(id)` 回调
2. App.tsx 中的 `setSelectedCombatantId(id)` 更新状态
3. **再次点击同一节点** → 取消选中（`id === undefined`）
4. 选中节点获得金色发光边框：`box-shadow: 0 0 0 2px gold, 0 0 18px gold`
5. 选中状态实时同步到 `CombatStage` 的 `selectedId` prop

---

## 5. 角色布局规则

- **玩家方**：x 坐标 18-26%（舞台左侧），y 坐标均匀分布
- **敌方**：x 坐标 72-80%（舞台右侧），y 坐标均匀分布
- 节点使用 `position: absolute; transform: translate(-50%, -50%)` 定位
- 节点中心对准其 (x, y) 百分比坐标

---

## 6. 从现有数据源读取

`buildStageData(state: CombatState): StageData` 是主要适配器：

- `Actor[]` → `Combatant[]`：映射 id/name/side/hp/maxHp/momentum/statuses，自动计算 x/y 位置
- `DistanceRelation[]` → `DistanceEdge[]`：过滤非公开距离，映射 fromActorId/toActorId/band
- `SceneTrack[]` → `SceneObjective[]`：过滤隐藏轨道，映射 name/value/max → title/current/target
- `Actor.side === "pressure"` → `Combatant.side === "enemy"`（自动归一化）

---

## 7. 删除/替换的旧逻辑

| 旧逻辑 | 操作 | 说明 |
|--------|------|------|
| `PhaserCombatBoard` 导入 | **删除** | 不再需要 Phaser 游戏引擎棋盘 |
| `createCombatBoardSnapshot()` | **删除** | 旧快照适配器，已被 buildStageData 替代 |
| 内联 `CombatStage` 函数体 | **替换** | 从 Phaser+FighterGroup+DistanceLines 替换为 TacticalCombatStage |
| `FighterGroup` 组件 | **保留但不再调用** | 仅舞台使用，抽屉不受影响 |
| `PendingPreview` 组件 | **保留但不再调用** | 后续可移到 PhaseActionBar |

---

## 8. 修改文件列表

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/combat.ts` | **新增** | 舞台类型定义 |
| `src/data/mockCombatData.ts` | **新增** | 数据适配器 + MOCK_STAGE_DATA |
| `src/ui/combat/stage/CombatStage.tsx` | **新增** | 战术舞台主组件 |
| `src/ui/combat/stage/CombatantNode.tsx` | **新增** | 角色节点组件 |
| `src/ui/combat/stage/DistanceLine.tsx` | **新增** | SVG 距离线组件 |
| `src/ui/combat/stage/SceneObjectiveMini.tsx` | **新增** | 场景目标进度条组件 |
| `src/styles/combat-stage.css` | **新增** | 舞台样式 |
| `src/main.tsx` | 修改 | +1 行，导入 combat-stage.css |
| `src/ui/App.tsx` | 修改 | 替换 CombatStage 实现；新增 selectedCombatantId 状态；移除 Phaser 依赖 |

---

## 9. 当前已知问题

1. **尚未移除 FighterGroup/PendingPreview 函数定义**：它们仍在 App.tsx 中但不再被调用，后续清理。
2. **场景目标数据来自 SceneTrack**：当前仅"桥陵镇雨夜失镖"团包有轨道数据。
3. **节点无拖拽/动画**：节点位置静态，后续可添加拖拽移动和 HP 变化动画。
4. **无行动栈/宣言预览**：PendingPreview 被移除，需在后续阶段重新实现到舞台或 PhaseActionBar 中。

---

## 10. 下一轮建议（PHASE 3）

**目标：敌方公开卡处理**

- 将敌方公开卡从左栏 compact chips 或右栏完整 EnemyRoster 中决策最终位置
- 点击舞台节点 → 右栏显示该角色的简要详情（不展开完整 UnitCard）
- 整合 `pendingAction` 信息到舞台（如箭头标注宣言目标）
- 清理 App.tsx 中已不再使用的 FighterGroup/PendingPreview 等死代码
