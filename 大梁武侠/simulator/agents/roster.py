from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from simulator.core.character import Character


ROOT = Path(__file__).resolve().parents[2]
ROSTER_PATH = Path(__file__).with_name("long_campaign_roster.json")


def load_long_campaign_roster() -> dict[str, Any]:
    return json.loads(ROSTER_PATH.read_text(encoding="utf-8"))


def load_long_campaign_party() -> list[Character]:
    roster = load_long_campaign_roster()
    party = []
    for item in roster["players"]:
        party.append(
            Character(
                name=item["name"],
                player_type=item["player_type"],
                role=item["role"],
                attr_die=item["attr_die"],
                skill_die=item["skill_die"],
                weapon=item["weapon"],
                tags=item["tags"],
            )
        )
    return party

