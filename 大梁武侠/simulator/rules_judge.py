from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RuleIssue:
    issue_id: str
    tag: str
    scene: str
    text: str
    severity: str
    recommendation: str


class RulesJudge:
    def __init__(self) -> None:
        self.issues: list[RuleIssue] = []
        self.counter = 1

    def add(self, tag: str, scene: str, text: str, severity: str, recommendation: str) -> None:
        self.issues.append(
            RuleIssue(
                issue_id=f"I{self.counter:04d}",
                tag=tag,
                scene=scene,
                text=text,
                severity=severity,
                recommendation=recommendation,
            )
        )
        self.counter += 1

