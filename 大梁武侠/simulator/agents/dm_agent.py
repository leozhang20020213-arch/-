from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Scene:
    scene_id: str
    title: str
    scene_type: str
    dc: int
    stakes: str


class DMAgent:
    def __init__(self) -> None:
        self.crisis = 0
        self.mystery = 0
        self.fortune = 0
        self.rulings: list[str] = []

    def scene_difficulty(self) -> int:
        if self.crisis >= 12:
            return 12
        if self.crisis >= 6:
            return 10
        return 8

    def apply_scene_result(self, benefit_level: int, flaw_level: int, key_clue: bool) -> dict:
        self.crisis += flaw_level
        self.fortune += benefit_level
        if key_clue:
            self.mystery += benefit_level
        return {"crisis": self.crisis, "mystery": self.mystery, "fortune": self.fortune}

    def ruling(self, text: str) -> None:
        self.rulings.append(text)

