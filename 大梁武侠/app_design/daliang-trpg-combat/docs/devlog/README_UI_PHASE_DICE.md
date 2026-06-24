# 大梁江湖 TRPG 交锋 UI 重构 — 阶段一：气骰系统

**日期**: 2026-06-24
**分支**: `dice-system-first-pass`
**状态**: ✅ 完成

## 改动摘要

重构交锋主界面的气骰系统，使骰子真正可见、可拖、可锁。消除两个重复气海操作区的功能冲突，建立统一的 QiDiceDock 作为唯一骰子操作入口。

## 修改文件

### 核心逻辑层
| 文件 | 改动 |
|------|------|
| `src/data/seed.ts` | 新增 `createInitialCombatState()` 函数，自动调用 `enterScene` 将气骰从气池投掷入气海，确保 UI 加载时骰子立即可见。原 `createSeedState()` 保持不变，测试继续使用。 |
| `src/combat/storage.ts` | `loadCombatState()` 和 `clearCombatState()` 改用 `createInitialCombatState()` 替代 `createSeedState()`，首次加载即有已投气骰。 |

### UI 组件层
| 文件 | 改动 |
|------|------|
| `src/ui/combat/dice/QiDie.tsx` | **重写**。骰子卡片放大（64×80px），点数居中大字（26px），阶数（D4/D6/...）在左上角，气性标签（阴/阳/原）在底部，新增锁气标记（`锁`）和临气标记（`临`）。locked 状态通过 `zone === "QI_LOCK"` 判断。 |
| `src/ui/combat/dice/QiPool.tsx` | **重写**。标题栏显示"气海 N 枚 · 合计 X 点 · 阴N 阳N 原N"。骰子卡片列表渲染。空状态不再显示纯文字，改为居中图标+按钮+提示。`onRoll` 回调只在气池有骰时才显示"投掷入海"按钮。 |
| `src/ui/combat/dice/CurrentMoveSlots.tsx` | **重写**。每个槽位显示"✓ N枚 X点"（满足时）或"需≥1"（不满足时）。槽位标题行显示当前招式名、已投/最低枚数徽章、气性门槛标签。底部新增合计条：阴值/阳值/合值/阴阳差。未选招式时显示预选提示。 |
| `src/ui/combat/dice/QiDiceDock.tsx` | **增强**。新增 `onRollToSea` 回调属性。拖拽不再要求必须选招式和目标（允许预选），但确认按钮在条件不满足时显示简短禁用原因。新增预选提示条。 |
| `src/ui/combat/dice/RestPool.tsx` | **增强**。显示每个区域点数合计。详情弹窗改进排版，每个骰子独立标签。无骰时显示"无其他区域骰子"。 |

### 布局层
| 文件 | 改动 |
|------|------|
| `src/ui/App.tsx` | 删除已弃用的 `QiZoneBoard` 函数（～180行，3D骰子托盘旧版，与 QiDiceDock 功能重叠）和 `DiceList` 函数（～45行）。移除 `QiDiceTray` 导入（仅旧版使用）。为玩家/DM 战斗桌面的 `QiDiceDock` 添加 `onRollToSea` 属性。 |

### 样式层
| 文件 | 改动 |
|------|------|
| `src/styles/qi-dice.css` | **重写**。骰子卡片更大更清晰（64×80px），点数 26px 粗体居中。槽位满足/不满足状态颜色明确。新增预选提示、合计条、空状态等样式。详情弹窗支持分组显示。锁定/临气标记独立样式。 |

## 运行方式

```bash
cd daliang-trpg-combat
npm install
npm run dev:legacy -- --port 5174 --host 127.0.0.1
```

打开 `http://127.0.0.1:5174`，进入玩家/DM 战斗桌面，即可看到气海中的 6 枚已投气骰（沈青：D4×1、D6×4、D8×1，随机点数）。

## 测试结果

```
npm run test:all   # 68 项全部通过
npm run build      # TypeScript + Vite 构建成功
```

## 当前完成度

### ✅ 已完成
1. 骰子在 UI 加载时立即可见（`createInitialCombatState` 预投骰入气海）
2. 每枚骰子显示：阶数（D4/D6/D8/D10）、当前点数、气性（阴/阳/原）、临气标记、锁气标记
3. 气海骰子可拖入阴槽/阳槽（HTML5 原生拖拽 API）
4. 不合法拖入自动回弹并显示短提示（1.8 秒自动消失）
5. 阴槽/阳槽显示：已放入骰子数量、点数合计、最低枚数是否满足
6. 确认宣言按钮在条件不满足时禁用，并显示简短原因
7. 允许不选招式/目标时预选骰子（槽位接受拖放但确认不可用）
8. 底部气骰区（QiDiceDock）是唯一的骰子操作入口
9. 旧版 QiZoneBoard / DiceList 已删除
10. 息库/锁气/气池统计条显示点数和详情
11. 上方资源区保留为小型统计条（RestPool），不承担拖拽主功能

### ⏳ 后续阶段
- 目标线和距离表达（计划阶段二）
- 行动顺序/先后手队列（计划阶段三）
- 招式卡减字（计划阶段四）
- 场景轨统一（计划阶段五）
- 3D 骰子视觉效果（美术阶段）

## 已知限制

1. 拖拽为 HTML5 原生 API，移动端体验不佳（后续可替换为 pointer 事件）
2. 骰子样式为 2D 卡片，非 3D（按用户要求不优先做美术）
3. 当前仅渲染当前角色的气骰（DM 可见所有，玩家仅见自己）
4. 招式卡详情仍未减字（后续阶段处理）

## 与规则书的对应

| 规则概念 | UI 实现 |
|---------|---------|
| 气海 (QI_SEA) | QiPool — 可拖骰子列表 |
| 阴槽 (YIN_SLOT) | CurrentMoveSlots 左槽 |
| 阳槽 (YANG_SLOT) | CurrentMoveSlots 右槽 |
| 锁气 (QI_LOCK) | RestPool 锁气统计 + 骰子 `lock` 标记 |
| 息库 (QI_REST) | RestPool 息库统计 |
| 临气 (TEMP_QI) | TemporaryQiPool 上方条 |
| 气池 (QI_POOL) | RestPool 气池统计（等待投掷入海） |
| 宣言并锁气 | 确认宣言按钮 → `declareAction()` |
