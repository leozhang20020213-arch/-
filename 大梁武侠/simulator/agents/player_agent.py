from __future__ import annotations

from dataclasses import dataclass

from simulator.core.character import Character


@dataclass
class PlayerDecision:
    goal: str
    method: str
    skill: str
    comment: str


class PlayerAgent:
    def __init__(self, character: Character) -> None:
        self.character = character

    def decide(self, scene_type: str, prompt: str) -> PlayerDecision:
        pt = self.character.player_type
        if pt == "新手玩家":
            return PlayerDecision("弄清现在该做什么", "选择 DM 给出的行动菜单中最直接的一项", "侦察/枪术", "我先按最明显的来。")
        if pt == "剧情玩家":
            return PlayerDecision("保留线索并减少误伤", "问话、查证、保护证人", "侦察/礼法", "我想先确认事实。")
        if pt == "战斗玩家":
            return PlayerDecision("压住威胁", "用有画面感的武器动作逼退敌人", "刀术/威慑", "我想直接顶上去。")
        if pt == "构筑玩家":
            return PlayerDecision("用擅长项制造优势", "看破弱点或用暗器打断", "机关/暗器", "我会找能触发特性的做法。")
        if pt == "随性玩家":
            return PlayerDecision("制造意外机会", "用表演、诈唬或环境互动", "谈判/杂器", "我能不能这样搞一下？")
        return PlayerDecision("补位协助", "机动支援队友", "轻功/短刀", "我去补空位。")

