# 大梁江湖 TRPG 交锋 UI 重构 — 阶段四：场景轨统一 (SceneClock)

**日期**: 2026-06-24
**分支**: `dice-system-first-pass`
**状态**: ✅ 完成

## 改动摘要

将"危机值""解密值""巡检注意"等分散的场景轨系统统一为 `SceneClock`。主界面只显示紧凑进度条+简短触发条件，长文本移入"详情"按钮展开。减少主界面文字，聚焦交锋操作。

## 修改文件

| 文件 | 改动 |
|------|------|
| `src/combat/sceneClock.ts` | **新建**。SceneClock 类型（6种：crisis/investigation/chase/alarm/ritual/custom）、SceneClockCompact 显示组件、migrateTracksToClocks() 数据迁移函数、clockCompactLine() 紧凑摘要。 |
| `src/ui/combat/SceneClockCompact.tsx` | **新建**。紧凑场景进度轨组件。主轨展开（名称+进度条+触发条件+后果），副轨折叠为小进度条，详情按需展开。 |
| `src/ui/combat/LeftCombatPanel.tsx` | **重写**。替换旧的 `<meter>` + `<small>` 文本轨为 SceneClockCompact。不再显示大段场景描述。 |
| `src/styles/combat-stage.css` | 新增 scene-clock-compact / clock-row / clock-bar-track 等完整样式。 |

## SceneClock 类型

| 类型 | 英文 | 图标 | 说明 |
|------|------|------|------|
| 危机 | crisis | 🔥 | 火势、追兵、时限等压迫性进度 |
| 调查 | investigation | 🔍 | 线索发现、痕迹追踪 |
| 追逐 | chase | 🏃 | 逃跑或追击进度 |
| 警戒 | alarm | 🔔 | 巡检注意、守卫警觉 |
| 仪式 | ritual | ✨ | 仪式进度 |
| 自定义 | custom | 📋 | 其他场景特定进度 |

## 数据迁移

旧 `SceneTrack` 字段自动映射：
- `解密值` → `type: "investigation"`
- `危机值` → `type: "crisis"`
- `巡检注意` → `type: "alarm"`
- 旧 `track.description` 移入 `clock.detail`（折叠详情）
- 触发/后果文字从预设映射表提取

## 紧凑显示格式

```
🔔 巡检注意 3/10 ｜ 大声喧哗 +1
[██████░░░░░░░░░░░░░░] 30%
详情 ▸
```

## 测试结果

```
npm run test:all   # 68/68 通过
npm run build      # TypeScript + Vite 构建成功
```
