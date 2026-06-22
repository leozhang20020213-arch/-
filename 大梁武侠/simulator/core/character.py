from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Character:
    name: str
    player_type: str
    role: str
    attr_die: str
    skill_die: str
    weapon: str
    tags: list[str] = field(default_factory=list)


def default_party() -> list[Character]:
    return [
        Character("卢青", "新手玩家", "防御型镖师", "d8", "d6", "长枪", ["防御型", "新手"]),
        Character("沈照", "剧情玩家", "社交/调查型捕快", "d8", "d6", "单刀", ["社交", "调查"]),
        Character("贺骁", "战斗玩家", "爆发型刀客", "d8", "d8", "单刀", ["爆发型"]),
        Character("燕七", "构筑玩家", "远程/暗器型巧手", "d8", "d6", "暗器", ["远程", "机关"]),
        Character("白闲", "随性玩家", "均衡型说书人", "d8", "d6", "杂器", ["均衡", "社交"]),
        Character("方逐", "普通玩家", "机动型游侠", "d8", "d6", "短刀", ["机动型"]),
    ]

