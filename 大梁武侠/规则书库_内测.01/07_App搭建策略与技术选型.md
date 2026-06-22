# 大梁江湖TRPG — App搭建策略与技术选型

> 2026年6月20日  
> 目标：局域网多人跑团App + 桌面程序，游戏化UI，支持自动化/半自动化

---

## 一、先定边界：App 做什么，不做什么

你的开发者规则书已经写得很清楚：

| App 负责 | App 不负责 |
|---|---|
| 交锋流程（宣言→截击→成招→触发→应招→落果） | 自由叙事、NPC自然语言对话 |
| 气骰七区状态追踪 | 玩家推理正确性判断 |
| 状态层数、衰减、解除 | 世界观开放性裁定 |
| 长效被动触发 | 关系事实的自由文本 |
| 场景轨记录 | 江湖常识判断 |
| 完整日志回放 | — |

**最大原则**：App 是记账与校验工具，DM 保留手动覆盖权（写入日志即可）。

---

## 二、推荐技术栈

### 方案A：Tauri + React + Rust 后端（⭐首选推荐）

```
┌─────────────────────────────────────────┐
│              桌面端 (Tauri)               │
│  ┌─────────────────────────────────┐    │
│  │   React UI (游戏化界面)          │    │
│  │   - 角色卡可视化                  │    │
│  │   - 气骰拖拽动画                  │    │
│  │   - 交锋流程图                    │    │
│  │   - 场景记录面板                  │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │   Rust 核心 (Tauri Backend)      │    │
│  │   - 规则引擎 (气骰/成招/触发)     │    │
│  │   - 本地数据库 (SQLite)           │    │
│  │   - WebSocket 服务端              │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
         │ WebSocket (局域网)
         ▼
┌─────────────────────────────────────────┐
│           玩家端 (浏览器/Electron)        │
│   连接 DM 主机 IP:端口 即可加入           │
└─────────────────────────────────────────┘
```

**优势**：
- Rust 写规则引擎：速度快，类型安全，你的"六根值×系数+加值"运算天然适合
- Tauri 包体积小（~5MB），比 Electron（~150MB）轻得多
- React 生态成熟，UI 组件库多
- 局域网模式：DM 端启动内置 WebSocket server，玩家浏览器连 `192.168.x.x:3000` 即可
- 一套代码 = 桌面端 + Web 端

**劣势**：
- Rust 学习曲线
- Tauri 移动端支持仍在完善

---

### 方案B：Web 全栈（最快原型）

```
前端: React + Canvas/Framer Motion (动画)
      TailwindCSS (样式)
      ReactFlow (交锋流程图)
      DnD Kit (气骰拖拽)

后端: Node.js + Express + Socket.io
      或 Python FastAPI + WebSocket

数据库: SQLite (本地) 或 PostgreSQL (如果需要中央服务器)
```

**优势**：
- 你用 Codex/GPT 写 JS/TS 效率最高
- Socket.io 天然支持房间、广播，多人跑团逻辑直接用
- 浏览器即客户端，不用装任何东西
- 原型最快：一周出可跑的交锋引擎

**劣势**：
- 浏览器做游戏化动画不如原生
- 局域网需要 DM 启动 server

---

### 方案C：Unity/Godot（纯游戏化路线）

```
Unity + C# 或 Godot + GDScript
内置网络：Mirror(Unity) / 自带(Godot)
UI: 全部用游戏引擎的 UI 系统
```

**优势**：
- 最强的游戏化表现（气骰滚动动画、招式特效、武侠氛围）
- 成熟的多人网络方案
- 如果你未来想做更重的游戏化（3D 场景、棋子动画等），这是最佳底座

**劣势**：
- 开发速度远慢于 Web 方案
- 规则逻辑修改→重新编译→重新分发客户端
- 你的 Codex/GPT 对 Unity/Godot 的帮助不如 Web 技术栈

---

### 我的推荐

**内测阶段：方案B（Web全栈）**  
**正式版：方案A（Tauri + React + Rust）**  
**如果资金/时间充足想做产品级游戏：方案C**

理由：
1. 你现在规则还在迭代，Web 方案改规则最快（改 JS 刷页面即可）
2. 内测时 DM 开个 localhost，玩家浏览器连上就能跑
3. 等规则稳定后，把 JS 规则引擎用 Rust 重写，套 Tauri 壳 = 桌面端
4. 你的三种工具分工：**Claude Code 写 Rust 核心** → **Codex 写 React UI** → **GPT 写测试/文档**

---

## 三、多人局域网架构

```
                 ┌──────────────────┐
                 │    DM 主机        │
                 │  (WebSocket Srv)  │
                 │  192.168.1.5:3000 │
                 │                   │
                 │  ┌─────────────┐  │
                 │  │  规则引擎    │  │
                 │  │  游戏状态    │  │
                 │  │  日志记录    │  │
                 │  └─────────────┘  │
                 └──┬───────┬───────┘
                    │       │
        ┌───────────┘       └───────────┐
        ▼                               ▼
┌──────────────┐               ┌──────────────┐
│  玩家1 浏览器  │               │  玩家2 浏览器  │
│  192.168.1.6  │               │  192.168.1.7  │
│               │               │               │
│  角色卡视图   │               │  角色卡视图   │
│  气骰操作面板 │               │  气骰操作面板 │
│  招式选择器   │               │  响应窗口     │
└──────────────┘               └──────────────┘
```

**通信协议**：
- 每条消息 = `{type, actorId, payload, timestamp}`
- 消息类型：`declare_action / intercept / form_move / react / apply_outcome / update_state / dm_override`
- 日志完整记录每步，支持回放和"倒回去重来"

**半自动化模式**：
- 玩家宣言招式 → App 自动校验门槛（气骰够不够、势对不对、装备有没有）
- 成招后 → App 自动计算基础效果 + 槽值触发
- 状态衰减 → App 自动执行（每轮结束减层数）
- DM 手动覆盖 → App 接受但写入日志

---

## 四、你的工具分工策略

| 工具 | 最适合做什么 | 具体任务 |
|---|---|---|
| **Claude Code** | 复杂逻辑、系统设计、规则转换 | 规则引擎核心代码、数据库 schema、API 设计、状态机实现、架构评审 |
| **Codex (GPT)** | 快速迭代、UI 搭建、胶水代码 | React 组件、CSS 样式、API 请求、表单逻辑、表格渲染 |
| **GPT** | 样板代码、测试用例、文档 | 单元测试、Mock 数据、README、API 文档生成 |

**你的工作流建议**：
```
1. Claude Code: 写规则引擎的接口定义 + 数据流设计
       ↓
2. Codex: 根据接口搭 UI 组件 + 前后端连接
       ↓
3. GPT: 生成测试数据 + 写测试用例
       ↓
4. Claude Code: 审查代码 + 校对规则一致性
       ↓
5. 循环
```

---

## 五、需要的 Skill 配置建议

### Claude Code 端

```bash
# 1. 为你的 App 项目创建 CLAUDE.md
/init    # 在 App 项目根目录运行，让 CC 理解项目结构

# 2. 常用 skill
/code-review    # 每次大改后审查规则引擎代码
/simplify       # 清理重复和冗余逻辑
/loop           # 定时跑测试（如 /loop 10m npm test）

# 3. 配置 hooks（在 settings.json 中）
# 每次 git commit 前自动跑测试
# 每次 push 前自动做 code-review
```

### 自定义 hook 建议

在 `~/.claude/settings.json` 中：
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{
          "type": "command",
          "command": "echo '文件已修改，建议运行 /code-review'"
        }]
      }
    ]
  }
}
```

---

## 六、分阶段执行计划

### 第一阶段：规则引擎核心（2-3周）

**产出**：一个能跑通"宣言→成招→落果"的命令行版本

```
任务：
□ 实现气骰七区数据结构
□ 实现六根→内功盘→表属性运算
□ 实现成招门槛校验（通用门槛+特殊门槛）
□ 实现基础效果计算
□ 实现槽值触发（阴值/阳值/合值/阴阳差）
□ 实现势状态机（六面势转换）
□ 实现调息/返照
□ 实现来源失效追溯
□ 实现完整日志记录
```

**这个阶段用 Claude Code 主力，Codex 辅助写测试。**

### 第二阶段：Web UI + 局域网联机（3-4周）

**产出**：DM 开 server，玩家浏览器连入，能看到角色卡和交锋流程

```
任务：
□ React 项目搭建
□ 角色卡视图（六根/内功盘/表属性/武艺/气骰/装备/状态）
□ 气骰面板（拖拽气骰到阴阳槽）
□ 交锋流程 UI（宣言→截击→成招→触发→应招→落果 可视化）
□ WebSocket 多人房间
□ DM 控制面板（场景管理/危机值/解密值/敌人卡）
□ 招式选择器（按势过滤可用招式）
□ 状态追踪面板
```

**这个阶段用 Codex 主力写 UI，Claude Code 审查规则一致性。**

### 第三阶段：游戏化打磨（2-3周）

```
任务：
□ 气骰投掷动画
□ 成招特效
□ 势变化动效
□ 武侠风格 UI 皮肤
□ 音效（可选）
□ 暗色/亮色主题
□ 响应窗口弹窗动画
```

### 第四阶段：数据库工具 + 打包（1-2周）

```
任务：
□ 内功/招式/装备/药物编辑器（DM 用）
□ 角色卡导入/导出
□ 模组编辑器
□ 日志回放器
□ Tauri 打包为桌面应用
□ 一键启动脚本（DM 双击即开）
```

---

## 七、数据库结构建议（与规则书对齐）

```
数据库分库（对应大小样库结构）：

1. 内功库 (inner_arts)
   - id, name, tier, yin_yang_label, occupied_acupoints[], 
     read_roots[], max_level, passive, disperse_rules
   - 关联: 表属性运算表(level, root→attr, multiplier, bonus)
   - 关联: 取气运算表(level, root→qi, multiplier, bonus, qi_map)

2. 招式库 (moves)
   - id, name, category(外功/法门/便行), sub_category,
     tier, design_grade, yin_yang_label, timing, form_position,
     min_input, qi_nature_threshold, shi_condition_type, shi_range,
     hard_prerequisite, target_range_equip, base_effect,
     slot_triggers[], risk, post_shi, resource_destination,
     has_intercept, has_react

3. 响应挂载库 (responses)
   - id, move_id, type(截击/应招), timing, min_input,
     qi_nature_threshold, shi_condition, equip_permission,
     base_response_effect, slot_triggers[], constraints

4. 装备库 (equipment)
   - id, name, category(武器/护甲/佩饰/器具), sub_category,
     tier, hand_slot, attr_contributions[], qi_dice[],
     temp_qi_dice[], permissions[], passives[], durability

5. 药物库 (medicine)
   - id, name, category, tier, timing, target, cost,
     effects[], temp_qi[], costs_restrictions[]

6. 状态库 (statuses)
   - id, name, layers, effect_per_layer, decay_rule, removal_entries

7. 角色库 (characters)
   - 关联以上所有库的实例数据
```

---

## 八、关键技术难点预警

| 难点 | 解决方案 |
|---|---|
| 气骰点数随机 vs 规则一致性 | 所有随机数由服务端生成并广播，客户端不生成随机数 |
| "任何可能改变结果的行动都必须有日志" | 每条消息带 UUID，日志写入 SQLite，支持按时间线回放 |
| DM 手动覆盖 vs App 自动计算 | DM 覆盖时 App 标记 `overridden: true` + `reason` + `dm_id`，后续自动计算基于覆盖后的状态继续 |
| 截击窗口时间窗 | 声明后启动一个可配置的倒计时（默认15秒），超时视为放弃截击 |
| 规则迭代 → App 更新 | 规则引擎单独一个 crate/module，有版本号，配置文件标记规则版本 |

---

## 九、你现在可以做的第一步

**本周就能开始的事**：

1. 用 Claude Code 写 TypeScript 类型定义（把上面的数据库结构翻译成 TS interfaces）
2. 用 Codex 搭一个最简单的 React 项目 + 角色卡静态页面
3. 用 GPT 生成 20 条测试用例（基于招式库中的 WG001-WG009）
4. 在本地跑通"服务端出随机数 → 客户端显示气骰"的最小回路

**一句话策略**：
> 让 Claude Code 写规则引擎（保证对），让 Codex 写 UI（保证快），让 GPT 写测试（保证稳）。先做命令行能跑的交锋引擎，再做 Web UI，最后套 Tauri 壳。
