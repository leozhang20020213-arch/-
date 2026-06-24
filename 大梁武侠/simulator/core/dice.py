from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass
class DieRoll:
    die: str
    value: int
    source: str


class DiceRoller:
    def __init__(self, seed: int) -> None:
        self.rng = random.Random(seed)
        self.seed = seed

    def roll(self, die: str, source: str = "") -> DieRoll:
        sides = int(die.lower().replace("d", ""))
        return DieRoll(die=die, value=self.rng.randint(1, sides), source=source)

    def roll_many(self, dice: list[tuple[str, str]]) -> list[DieRoll]:
        return [self.roll(die, source) for die, source in dice]


def slot_result(rolls: list[DieRoll], hit_idx: list[int], benefit_idx: list[int], flaw_idx: list[int]) -> dict:
    hit = sum(rolls[i].value for i in hit_idx)
    benefit = sum(rolls[i].value for i in benefit_idx)
    flaw_guard = sum(rolls[i].value for i in flaw_idx)
    benefit_level = 1 if benefit <= 4 else 2 if benefit <= 8 else 3
    flaw_level = 2 if flaw_guard <= 4 else 1 if flaw_guard <= 8 else 0
    return {
        "hit": hit,
        "benefit": benefit,
        "flaw_guard": flaw_guard,
        "benefit_level": benefit_level,
        "flaw_level": flaw_level,
    }

