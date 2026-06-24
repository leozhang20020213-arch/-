# B02 P0 Rule_ID 定向复核摘要

生成时间：2026-06-11 03:03 Asia/Shanghai

## 输出

- JSONL：`D:\trpg\大梁武侠\review_output\03_p0_rule_mapping_review.jsonl`
- XLSX：`D:\trpg\大梁武侠\review_output\03_p0_rule_mapping_review.xlsx`
- P0 Rule_ID总数：45

## 复核状态分布

| 状态 | 数量 |
| --- | ---: |
| 已覆盖-仅候选命中 | 4 |
| 已覆盖-有候选和回查证据 | 10 |
| 疑似命中-需人工复核 | 8 |
| 疑似缺失-需人工确认 | 10 |
| 补命中-需加入映射 | 13 |

## 需要优先人工处理

- `SYS-001` 游戏定位：江湖人生而非职业等级：疑似命中-需人工复核，证据分数 3，chunk `player_rulebook-0024`
- `SLOT-004` 得利不可万能兑换：疑似命中-需人工复核，证据分数 3，chunk `dm_rulebook-0012`
- `CBT-001` 伤害结算公式：疑似命中-需人工复核，证据分数 3，chunk `dm_rulebook-0019`
- `CBT-005` 普通敌人破绽兑现：疑似命中-需人工复核，证据分数 3，chunk `dm_rulebook-0014`
- `CBT-007` 反击链终止：疑似缺失-需人工确认，证据分数 0，chunk `dm_rulebook-0001`
- `ACT-001` 协助行动：疑似命中-需人工复核，证据分数 3，chunk `dm_rulebook-0169`
- `ACT-002` 强行尝试：疑似缺失-需人工确认，证据分数 0，chunk `dm_rulebook-0001`
- `ACT-004` 非杀伤/制服：疑似缺失-需人工确认，证据分数 0，chunk `dm_rulebook-0001`
- `ACT-005` 环境互动：疑似命中-需人工复核，证据分数 3，chunk `dm_rulebook-0246`
- `FAME-003` 名望调用入口：疑似缺失-需人工确认，证据分数 0，chunk `dm_rulebook-0001`
- `REST-001` 三阶段休整：疑似命中-需人工复核，证据分数 3，chunk `dm_rulebook-0051`
- `REST-003` 年龄节点不线性惩罚：疑似命中-需人工复核，证据分数 3，chunk `player_rulebook-0149`
- `FAC-001` 世界投放链：疑似缺失-需人工确认，证据分数 0，chunk `dm_rulebook-0001`
- `CARD-001` 武器卡：疑似缺失-需人工确认，证据分数 0，chunk `dm_rulebook-0001`
- `CARD-002` 招式卡：疑似缺失-需人工确认，证据分数 0，chunk `dm_rulebook-0001`
- `CARD-003` 内功卡：疑似缺失-需人工确认，证据分数 0，chunk `dm_rulebook-0001`
- `REC-001` DM三轨记录：疑似缺失-需人工确认，证据分数 0，chunk `dm_rulebook-0001`
- `EX-001` 得利强度表示例：疑似缺失-需人工确认，证据分数 0，chunk `dm_rulebook-0001`

## 限制

- 本轮是P0定向回查，不直接修改规则书。
- `补命中-需加入映射` 表示规则书文本中有疑似证据，但上一轮候选映射未覆盖，需要下一轮合并进03映射表。
- `疑似缺失-需人工确认` 不能直接判定规则缺失，需人工读证据块后再进入B03冲突/缺失审查。
- 岁月与生成数据库仍缺失，REST/LIFE相关结论继续限制性处理。
