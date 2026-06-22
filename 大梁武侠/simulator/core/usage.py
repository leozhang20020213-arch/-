from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass
class RuleUsage:
    rule_id: str
    rule_name: str
    chapter: str
    category: str
    opportunities: int = 0
    triggered_count: int = 0
    player_initiated_count: int = 0
    dm_initiated_count: int = 0
    changed_outcome_count: int = 0
    ignored_count: int = 0
    ambiguity_count: int = 0
    total_resolution_time: float = 0.0
    notes: str = ""

    @property
    def average_resolution_time(self) -> float:
        if not self.triggered_count:
            return 0.0
        return round(self.total_resolution_time / self.triggered_count, 3)

    def row(self) -> dict:
        data = asdict(self)
        data["average_resolution_time"] = self.average_resolution_time
        return data


class UsageTracker:
    def __init__(self) -> None:
        self.rules: dict[str, RuleUsage] = {}

    def ensure(self, rule_id: str, rule_name: str, chapter: str, category: str) -> RuleUsage:
        if rule_id not in self.rules:
            self.rules[rule_id] = RuleUsage(rule_id, rule_name, chapter, category)
        return self.rules[rule_id]

    def trigger(
        self,
        rule_id: str,
        rule_name: str,
        chapter: str,
        category: str,
        initiator: str,
        changed: bool = True,
        ambiguous: bool = False,
        seconds: float = 0.0,
        note: str = "",
    ) -> None:
        r = self.ensure(rule_id, rule_name, chapter, category)
        r.opportunities += 1
        r.triggered_count += 1
        if initiator == "player":
            r.player_initiated_count += 1
        else:
            r.dm_initiated_count += 1
        if changed:
            r.changed_outcome_count += 1
        if ambiguous:
            r.ambiguity_count += 1
        r.total_resolution_time += seconds
        if note:
            r.notes = (r.notes + " | " + note).strip(" |")

    def opportunity_only(self, rule_id: str, rule_name: str, chapter: str, category: str, ignored: bool = False) -> None:
        r = self.ensure(rule_id, rule_name, chapter, category)
        r.opportunities += 1
        if ignored:
            r.ignored_count += 1

    def rows(self) -> list[dict]:
        return [r.row() for r in sorted(self.rules.values(), key=lambda x: x.rule_id)]

