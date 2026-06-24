from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from simulator.agents.dm_agent import DMAgent, Scene
from simulator.agents.player_agent import PlayerAgent
from simulator.core.character import default_party
from simulator.core.dice import DiceRoller, slot_result
from simulator.core.usage import UsageTracker
from simulator.rules_judge import RulesJudge


ROOT = Path(__file__).resolve().parents[2]
REPORTS = ROOT / "reports"
RAW = REPORTS / "raw_logs"


def choose_slots(values: list[int], mode: str) -> tuple[list[int], list[int], list[int]]:
    ordered = sorted(range(len(values)), key=lambda i: values[i], reverse=True)
    if mode == "weapon_feature":
        hit = [ordered[0], ordered[2]]
        benefit = [ordered[1]]
        flaw = [ordered[3]]
    else:
        hit = [ordered[0], ordered[1]]
        benefit = [ordered[2]]
        flaw = [ordered[3]]
    return hit, benefit, flaw


def run_sample(seed: int = 20260609) -> dict:
    RAW.mkdir(parents=True, exist_ok=True)
    log_path = RAW / "sample_short_campaign_seed_20260609.jsonl"
    usage = UsageTracker()
    judge = RulesJudge()
    dm = DMAgent()
    roller = DiceRoller(seed)
    party = default_party()
    agents = [PlayerAgent(c) for c in party]
    scenes = [
        Scene("S01", "茶馆接案", "调查/交涉", 8, "找到失踪官银第一条线索"),
        Scene("S02", "码头追踪", "追逐", 10, "追上带青布腕带的船工"),
        Scene("S03", "北仓潜入", "潜入/调查", 10, "确认官银是否入井下暗渠"),
        Scene("S04", "井口冲突", "战斗", 9, "守住井口并夺回证人"),
        Scene("S05", "水门结局", "战斗/抉择", 11, "阻止官银装船并决定是否追击主谋"),
    ]
    events: list[dict] = []
    with log_path.open("w", encoding="utf-8") as f:
        for idx, scene in enumerate(scenes):
            scene.dc = max(scene.dc, dm.scene_difficulty())
            for agent in agents[:3 if scene.scene_type != "战斗" else 4]:
                decision = agent.decide(scene.scene_type, scene.stakes)
                dice = [(agent.character.attr_die, "属性"), (agent.character.skill_die, "熟练"), ("d6", "情景/行动"), ("d6", "情景/行动")]
                rolls = roller.roll_many(dice)
                values = [r.value for r in rolls]
                slot_mode = "weapon_feature" if "战斗" in scene.scene_type and agent.character.weapon in {"长枪", "暗器"} else "normal"
                hit_idx, benefit_idx, flaw_idx = choose_slots(values, slot_mode)
                result = slot_result(rolls, hit_idx, benefit_idx, flaw_idx)
                success = result["hit"] >= scene.dc
                if "战斗" in scene.scene_type:
                    usage.trigger("CORE_COMBAT_ACTION", "正式战斗动作", "战斗", "战斗", "player", True, False, 8.0)
                    usage.trigger("CORE_FLAW", "破绽结算", "战斗", "战斗", "dm", True, result["flaw_level"] >= 2, 6.0)
                    if result["benefit_level"] < 2 and agent.character.weapon in {"长枪", "暗器"}:
                        judge.add("【不够爽】", scene.title, f"{agent.character.name}想触发{agent.character.weapon}特性但得利不足。", "medium", "补武器卡：写明得利门槛与得利1效果。")
                else:
                    usage.trigger("CORE_SCENE_CHECK", "情景检定", "情景", "情景", "player", True, False, 7.0)
                    usage.trigger("CORE_CRISIS", "危机增长", "情景", "情景", "dm", True, False, 3.0)
                    key_clue = idx in {0, 2}
                    resources = dm.apply_scene_result(result["benefit_level"] if success else 0, result["flaw_level"], key_clue)
                    if result["flaw_level"] >= 2 and success:
                        judge.add("【太惩罚】", scene.title, "成功但危机继续上涨，玩家可能感觉行动越多越糟。", "high", "补高代价成功话术，并模拟危机增长。")
                event = {
                    "seed": seed,
                    "scene": asdict(scene),
                    "character": asdict(agent.character),
                    "decision": asdict(decision),
                    "rolls": [asdict(r) for r in rolls],
                    "slots": {"hit": hit_idx, "benefit": benefit_idx, "flaw": flaw_idx},
                    "result": result,
                    "success": success,
                    "dm_state": {"crisis": dm.crisis, "mystery": dm.mystery, "fortune": dm.fortune},
                }
                events.append(event)
                f.write(json.dumps(event, ensure_ascii=False) + "\n")

    summary = {
        "seed": seed,
        "log_path": str(log_path.relative_to(ROOT)),
        "events": len(events),
        "final_dm_state": {"crisis": dm.crisis, "mystery": dm.mystery, "fortune": dm.fortune},
        "usage": usage.rows(),
        "issues": [asdict(i) for i in judge.issues],
    }
    (RAW / "sample_short_campaign_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(summary, events)
    return summary


def write_markdown(summary: dict, events: list[dict]) -> None:
    lines = [
        "# 03_完整跑团模拟日志",
        "",
        "## 样例短团：东渠样例案",
        "",
        f"- 随机种子：{summary['seed']}",
        f"- 原始日志：{summary['log_path']}",
        f"- 事件数：{summary['events']}",
        f"- 最终 DM 状态：危机 {summary['final_dm_state']['crisis']}，解密 {summary['final_dm_state']['mystery']}，战役得利 {summary['final_dm_state']['fortune']}",
        "",
        "## 关键过程",
    ]
    for event in events:
        roll_text = "，".join(f"{r['source']} {r['die']}={r['value']}" for r in event["rolls"])
        lines += [
            "",
            f"### {event['scene']['scene_id']} {event['scene']['title']}｜{event['character']['name']}（{event['character']['player_type']}）",
            "",
            f"- 行动：{event['decision']['goal']}；{event['decision']['method']}",
            f"- 掷骰：{roll_text}",
            f"- 分槽：命中 {event['slots']['hit']}，得利 {event['slots']['benefit']}，破绽/代价 {event['slots']['flaw']}",
            f"- 结果：Hit {event['result']['hit']} vs DC {event['scene']['dc']}，成功={event['success']}；得利等级 {event['result']['benefit_level']}；代价/破绽等级 {event['result']['flaw_level']}",
            f"- DM状态：{event['dm_state']}",
        ]
    lines += [
        "",
        "## 本次样例暴露的问题",
    ]
    for issue in summary["issues"]:
        lines.append(f"- {issue['issue_id']} {issue['tag']} {issue['scene']}：{issue['text']} 建议：{issue['recommendation']}")
    lines += [
        "",
        "## 规则使用统计样例",
        "",
        "| rule_id | rule_name | opportunities | triggered | changed | ambiguity | avg_time |",
        "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    for row in summary["usage"]:
        lines.append(
            f"| {row['rule_id']} | {row['rule_name']} | {row['opportunities']} | {row['triggered_count']} | {row['changed_outcome_count']} | {row['ambiguity_count']} | {row['average_resolution_time']} |"
        )
    (REPORTS / "03_完整跑团模拟日志.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    run_sample()
