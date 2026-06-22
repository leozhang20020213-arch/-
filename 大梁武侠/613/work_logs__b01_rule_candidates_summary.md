# B01 规则候选抽取摘要

生成时间：2026-06-11 02:03 Asia/Shanghai

## 输出

- JSONL：`D:\trpg\大梁武侠\review_output\02_rules_extracted.jsonl`
- XLSX：`D:\trpg\大梁武侠\review_output\02_rules_extracted.xlsx`
- 候选总数：542

## 来源分布

| 来源 | 候选数 |
| --- | ---: |
| DM规则书 | 354 |
| 玩家规则书 | 188 |

## 模块分布

| 模块 | 候选数 |
| --- | ---: |
| RES | 145 |
| COM | 119 |
| LIFE | 118 |
| MART | 38 |
| DM | 31 |
| SCN | 24 |
| MISC | 21 |
| CUE | 19 |
| ATT | 13 |
| SLOT | 6 |
| DB | 3 |
| WPN | 3 |
| CHK | 1 |
| SKL | 1 |

## 限制

- 本轮是启发式规则候选抽取，不等于最终 Rule_ID 映射。
- `是否歧义`、`关联数据库`、`建议Rule_ID` 仍需 B02 人工/半自动映射确认。
- 候选来源位置沿用 `01_chapter_chunks.jsonl` 的段落序号，不使用不稳定页码。
- 岁月与生成数据库仍缺失，相关长团候选只能作为限制性材料。
