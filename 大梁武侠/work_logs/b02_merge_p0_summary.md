# B02 P0补命中合并摘要

生成时间：2026-06-11 03:33 Asia/Shanghai

## 输出

- 合并映射JSONL：`D:\trpg\大梁武侠\review_output\03_rules_mapped_p0_merged.jsonl`
- 合并映射XLSX：`D:\trpg\大梁武侠\review_output\03_rules_mapped_p0_merged.xlsx`
- 人工处理JSONL：`D:\trpg\大梁武侠\review_output\03_p0_manual_review_queue.jsonl`
- 人工处理XLSX：`D:\trpg\大梁武侠\review_output\03_p0_manual_review_queue.xlsx`

## 结果

- 原映射候选：542
- P0补命中合并：13
- 合并后映射候选：555
- 人工处理项：18

## 人工处理项

- `SYS-001` 游戏定位：江湖人生而非职业等级：疑似命中-需人工复核，chunk `player_rulebook-0024`
- `SLOT-004` 得利不可万能兑换：疑似命中-需人工复核，chunk `dm_rulebook-0012`
- `CBT-001` 伤害结算公式：疑似命中-需人工复核，chunk `dm_rulebook-0019`
- `CBT-005` 普通敌人破绽兑现：疑似命中-需人工复核，chunk `dm_rulebook-0014`
- `CBT-007` 反击链终止：疑似缺失-需人工确认，chunk `dm_rulebook-0001`
- `ACT-001` 协助行动：疑似命中-需人工复核，chunk `dm_rulebook-0169`
- `ACT-002` 强行尝试：疑似缺失-需人工确认，chunk `dm_rulebook-0001`
- `ACT-004` 非杀伤/制服：疑似缺失-需人工确认，chunk `dm_rulebook-0001`
- `ACT-005` 环境互动：疑似命中-需人工复核，chunk `dm_rulebook-0246`
- `FAME-003` 名望调用入口：疑似缺失-需人工确认，chunk `dm_rulebook-0001`
- `REST-001` 三阶段休整：疑似命中-需人工复核，chunk `dm_rulebook-0051`
- `REST-003` 年龄节点不线性惩罚：疑似命中-需人工复核，chunk `player_rulebook-0149`
- `FAC-001` 世界投放链：疑似缺失-需人工确认，chunk `dm_rulebook-0001`
- `CARD-001` 武器卡：疑似缺失-需人工确认，chunk `dm_rulebook-0001`
- `CARD-002` 招式卡：疑似缺失-需人工确认，chunk `dm_rulebook-0001`
- `CARD-003` 内功卡：疑似缺失-需人工确认，chunk `dm_rulebook-0001`
- `REC-001` DM三轨记录：疑似缺失-需人工确认，chunk `dm_rulebook-0001`
- `EX-001` 得利强度表示例：疑似缺失-需人工确认，chunk `dm_rulebook-0001`

## 限制

- 本轮不覆盖原始 `03_rules_mapped`，只生成合并版。
- P0补命中仍标记为待复核，进入B03前应人工确认摘录是否支持对应Rule_ID。
- 18条人工处理项未解决前，B03冲突审查只能作为草案执行。
- 岁月与生成数据库仍缺失，REST/LIFE相关结论继续限制性处理。
