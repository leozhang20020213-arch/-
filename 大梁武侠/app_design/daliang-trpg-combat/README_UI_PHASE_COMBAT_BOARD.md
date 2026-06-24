# 交锋主区域重构 — README_UI_PHASE_COMBAT_BOARD.md

## 本轮目标

重构"大梁江湖 TRPG"的【交锋主区域】，重点处理：目标线、距离、交锋角色布局、当前行动者表达、重复信息去除。

## 改动文件清单

### 战场核心组件
| 文件 | 改动说明 |
|------|----------|
| `src/ui/combat/stage/CombatStage.tsx` | **核心重构** — 传入 `selectedTargetId`，正确推导目标线与当前行动者；移除静态距离线（只剩活跃目标线）；为每个 CombatantNode 计算 `isCurrentActor` / `isTargeted` / `isDefeated` / `canBeTargeted` |
| `src/ui/combat/stage/CombatantNode.tsx` | **全重构** — 新增 `isCurrentActor` / `isTargeted` / `isDefeated` / `canBeTargeted` props；新增视觉状态：当前行动者脉冲金辉、目标红色锁定框+角标、退场灰色覆层、不可选灰态；增加阵营左侧色条（player=蓝，enemy=红） |
| `src/ui/combat/stage/TargetLine.tsx` | **增强** — 距离标签从 7px → 10px 大号字体 + 更大药丸形底框；增加方向指示点（线上3个点）、更宽箭头；非法距离态增加"⚠ 距离不符"顶部警告药丸；传入 `fromName` / `toName` 用于悬浮提示 |

### 集成层
| 文件 | 改动说明 |
|------|----------|
| `src/ui/App.tsx` | `CombatStage` 包装器新增 `selectedTargetId` prop；PlayerCombatDesk/DmCombatDesk 传递 `selectedTargetId`；右侧目标下拉 `onChange` 同步 `setSelectedCombatantId` 以联动战场高亮；移除 ActionPanel 中重复的距离信息展示（战场目标线已承担） |
| `src/ui/combat/TopCombatBar.tsx` | 新增"当前：沈青"金辉勋章，位于轮次与阶段徽章旁边；添加 `currentActorName` 计算 |

### 样式
| 文件 | 改动说明 |
|------|----------|
| `src/styles/combat-stage.css` | **全面更新** — 新增 `.current-actor`（金辉脉冲动画）、`.targeted`（红色锁定框+四角标）、`.defeated`（灰色退场覆层）、`.untargetable`（灰度不可点击）、`.side-player` / `.side-enemy`（阵营色条）、`.current-tag` / `.target-tag`（标签）、`.current-actor-dot`（脉冲指示点）、`.target-corners`（四角锁定标）、`.battlefield-zone-label`（我方/敌方区域标签） |
| `src/styles/combat-shell.css` | 新增 `.current-actor-badge` 顶部条样式（金辉勋章） |

## 实现的关键交互

### 1. 当前行动者高亮
- **顶部**：轮次/阶段旁出现 "当前：沈青" 金辉勋章
- **战场**：当前行动者的角色卡有强烈金辉脉冲动画 + 金色边框 + "行动中"标签 + 头像右上角脉冲指示点
- **行动顺序**：TurnChip 中当前行动者保持金色高亮（原有）

### 2. 目标选择同步
- **战场点击敌人卡** → 同时设置 `selectedCombatantId` 和 `selectedTargetId` → 战场目标线出现 → 右侧下拉同步
- **右侧下拉切换** → 同步设置 `selectedCombatantId` → 战场目标高亮同步
- 两个方向读取同一个 `selectedTargetId` 状态源

### 3. 目标线
- 从 `activeActorId` → `selectedTargetId` 的单条 SVG 线
- 方向性：线上有间隔小点 → 箭头指向目标
- 中点药丸标签：距离（如"近身"），大号字体 10px
- 非法距离态：红色虚线 + "⚠ 距离不符"顶部警告
- 悬浮 `<title>` tooltip：完整信息

### 4. 距离标签
- 固定枚举：贴身 / 近身 / 中距 / 远距 / 超距
- 显示在目标线中点，52×24px 药丸框
- 颜色随距离带变化（贴身=红、近身=橙、中距=金、远距=蓝、超距=灰）

### 5. 角色卡视觉状态（优先级从高到低）
1. **current-actor + targeted 叠加**：金辉内圈+红色外环
2. **current-actor**：金辉脉冲边框 + "行动中"标签
3. **targeted**：红色锁定框 + 四角标 + "目标"标签
4. **selected**（普通选中）：琥珀色边框
5. **defeated**：灰色+红色"退场"覆层
6. **untargetable**：灰度滤镜+禁止点击

### 6. 战场分区
- 左区标签"我方"、右区标签"敌方"（半透明竖排文字）
- 玩家角色偏左（x: 18-35%），敌方偏右（x: 72-85%）

### 7. 信息去重
- 移除：ActionPanel 中目标距离重复展示（战场目标线承担）
- 移除：战场中所有静态距离线（DistanceLine 组件不再渲染）
- 保留单一信息源：战场目标线 = 唯一距离/目标可视化

## 未完成 / 已知限制

1. **距离由 mock 数据驱动**：`state.distances[]` 中的距离关系尚未与位置计算联动。当前使用 seed 数据中的硬编码距离。后续需要实现位置→距离的自动推导。
2. **目标线锚点**：角色卡中心点（百分比坐标）作为线的起终点，在极端布局下可能穿卡。后续可优化为边缘锚定。
3. **静态距离线已完全移除**：如果未来需要显示多个距离关系，需要恢复但用更淡的样式。
4. **势条件与距离的联动**：崩势状态下"目标线全开放"的规则尚未实现，当前仅按距离校验。
5. **移动端适配**：当前交锋布局针对桌面 1366×768+，移动端需要额外响应式处理。

## 如何运行和验证

```bash
cd daliang-trpg-combat
npm run dev:legacy     # 启动 Vite 开发服务器
# 或
npm run build          # 生产构建
npm run preview        # 预览构建结果
```

### 验证清单
1. 打开交锋界面，确认顶部显示 "当前：沈青" 金辉勋章
2. 战场中沈青角色卡有明显的金色脉冲
3. 短兵客/黑衣脚夫卡在右侧（敌方区）
4. 点击短兵客 → 目标线出现（沈青→短兵客），中点显示"近身"
5. 点击黑衣脚夫 → 目标线切换到沈青→黑衣脚夫，显示"中距"
6. 右侧目标下拉框与战场目标同步切换
7. 玩家角色卡附近不再有重复的目标描述文字
8. 已退场角色灰显，不可点击
9. 悬浮目标线可看到 tooltip

## 构建/检查结果

```
npm run build  → ✅ PASS (tsc + vite build, 3.87s)
npm run test:all → ✅ 68 pass / 0 fail
npm run lint  → ❌ 不存在（项目无 lint 脚本）
```
