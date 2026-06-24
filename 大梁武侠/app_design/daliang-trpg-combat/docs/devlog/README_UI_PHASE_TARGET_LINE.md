# 大梁江湖 TRPG 交锋 UI 重构 — 阶段三：目标选择、目标线和距离表达

**日期**: 2026-06-24
**分支**: `dice-system-first-pass`
**状态**: ✅ 完成

## 改动摘要

统一目标选择（战场点击 + 下拉同步），添加动态目标线（当前行动者 → 选中目标），集成距离校验（与招式 targetRange 比对），删除冗余目标显示。

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/lib/combat/targetValidation.ts` | **新建**。TargetState 数据结构、getDistanceBetween()、isDistanceValidForMove()（距离与招式 targetRange 校验）、deriveTargetState()、targetLineTooltip()。 |
| `src/ui/combat/stage/TargetLine.tsx` | **新建**。SVG 目标线组件：从行动者到目标绘制箭头线，中点显示距离标签，不合法距离变红虚线+⚠警告。悬浮 tooltip 显示角色名、距离、招式可用性。 |
| `src/ui/combat/stage/CombatStage.tsx` | **重写**。接收 state、selectedMove 属性。在 SVG 层渲染动态 TargetLine（仅当选中目标 ≠ 行动者时）。同步 internal/external 选中状态。 |
| `src/ui/App.tsx` | 更新 CombatStage 包装器传递 state + selectedMove。战场点击敌人自动设置 selectedTargetId（同步下拉选项）。ActionPanel 目标下拉下方新增距离标签（显示距离带 + 合法性）。新增 deriveTargetState 和 Move 导入。 |

## 目标线行为

| 条件 | 视觉 |
|------|------|
| 目标 = 行动者自己 | 无目标线 |
| 有效距离 | 金色实线 + 箭头 + 距离标签（琥珀色边框） |
| 无效距离 | 红色虚线 + ⚠警告 + 距离标签（红色边框） |
| 鼠标悬浮 | tooltip：`沈青 → 短兵客｜近身｜破浪横刀可用` |
| 角色位置变动 | 目标线实时跟随（基于百分比坐标） |
| 点击战场角色 | 设置目标并更新高亮 |

## 距离校验规则

- 解析招式的 `targetRange` 字段，提取距离关键词（贴身/近身/短距/中距/远距）
- 与实际 `distances` 关系中的距离带比对
- "相邻"表示±1档距离允许
- "自己"/"可及"/"同层"/"道路"/"房间"/"尸身"/"机关" = 总是有效
- 无法解析的距离文字默认放行（由 DM 裁定）

## 目标信息三合一

目标信息现在只在三处显示：
1. **战场目标线** — SVG 线路 + 中点距离标签
2. **目标角色卡高亮** — 战场上的金框选中效果
3. **右侧宣言面板目标栏** — 下拉列表 + 距离标签

已不再在玩家卡下方重复显示当前目标。

## 测试结果

```
npm run test:all   # 68/68 通过
npm run build      # TypeScript + Vite 构建成功
```
