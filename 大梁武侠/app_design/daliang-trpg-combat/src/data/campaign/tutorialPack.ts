import type { CampaignPack } from "./campaignSchema";

export const tutorialCampaignPack: CampaignPack = {
  schemaVersion: 1,
  id: "tutorial-white-duckweed-ferry",
  name: "白蘋渡失匣",
  version: "1.0.0",
  rulesVersion: "2026-07-15",
  description: "规整的新手教学团包：从渡口调查、结构化追逐到苇荡夺匣交锋。",
  startSceneId: "white-duckweed-ferry",
  chapters: [{ id: "chapter-lost-case", name: "第一折·失匣", summary: "追查被调换的药匣，并决定渡口众人的去路。", sceneIds: ["white-duckweed-ferry", "alley-pursuit", "reed-bank-combat"] }],
  scenes: [
    {
      id: "white-duckweed-ferry", chapterId: "chapter-lost-case", name: "白蘋渡", mode: "SCENE_FREE",
      description: "雨后渡口尚未开船，一只带血的药匣封签压在系舟石旁。", objective: "查明药匣去向，并取得追查许可。", boundary: "茶棚、栈桥、系舟石与渡船候客处。",
      timeWindow: "晨雾散尽前", weather: "雨歇有雾", light: "清晨冷光", media: [],
      elements: [
        { id: "ferry-seal", kind: "clue", name: "带血封签", description: "封蜡被利器整齐挑开。", public: true, interactionUsageIds: ["investigate", "observe"] },
        { id: "boatwoman-lin", kind: "npc", name: "船娘林四", description: "守着空船，不肯先开口。", public: true, interactionUsageIds: ["negotiate", "observe"] },
        { id: "locked-medicine-case", kind: "container", name: "替换药匣", description: "匣锁完整，重量却不对。", public: false, interactionUsageIds: ["investigate", "take", "use_item"], destructible: true },
      ],
      tracks: [{ id: "ferry-insight", name: "真相", kind: "insight", max: 6, public: true }, { id: "boat-departs", name: "开船", kind: "crisis", max: 6, public: true }],
      events: [
        { id: "reveal-runner", name: "发现跑腿人", conditions: [{ id: "truth-four", kind: "track_threshold", sourceId: "ferry-insight", operator: "at_least", value: 4 }], effects: [{ kind: "reveal", targetId: "runner-shadow", value: true }], once: true, publicText: "雾里有人攥着同样的封签转身便走。" },
        { id: "start-pursuit", name: "转入追逐", conditions: [{ id: "dm-start-pursuit", kind: "dm", operator: "manual" }], effects: [{ kind: "end_scene", targetId: "alley-pursuit" }], once: true, publicText: "那人钻入渡口后的窄巷。" },
      ],
      rewardIds: ["permission-ferry-ledger"], nextSceneIds: ["alley-pursuit"],
    },
    {
      id: "alley-pursuit", chapterId: "chapter-lost-case", name: "雾巷追影", mode: "SCENE_STRUCTURED",
      description: "搬匣人借早市与湿滑石阶脱身。", objective: "在对方抵达苇岸前截住去路。", boundary: "三段窄巷、石阶与苇岸出口。",
      timeWindow: "三轮", weather: "雾重路湿", light: "散射晨光", media: [],
      elements: [
        { id: "runner-shadow", kind: "enemy", name: "搬匣人", description: "只求脱身，不愿死斗。", public: true, interactionUsageIds: ["move", "negotiate"] },
        { id: "fish-basket", kind: "obstacle", name: "倾倒鱼篓", description: "横在巷中，影响移动关系。", public: true, interactionUsageIds: ["move", "use_item"], blocksMovement: true },
      ],
      tracks: [{ id: "pursuit-distance", name: "追及", kind: "progress", max: 5, public: true }, { id: "crowd-alarm", name: "惊扰", kind: "crisis", max: 5, public: true }],
      events: [{ id: "reach-reeds", name: "抵达苇岸", conditions: [{ id: "round-three", kind: "round", operator: "at_least", value: 3 }], effects: [{ kind: "end_scene", targetId: "reed-bank-combat" }], once: true, publicText: "前方水声骤近，苇岸已在眼前。" }],
      rewardIds: [], nextSceneIds: ["reed-bank-combat"],
    },
    {
      id: "reed-bank-combat", chapterId: "chapter-lost-case", name: "苇岸夺匣", mode: "COMBAT",
      description: "接应者在苇岸现身，药匣随时可能被推入水中。", objective: "保住药匣并阻止接应者灭口。", boundary: "苇岸、浅水、系船木桩与一叶小舟。",
      timeWindow: "小舟离岸前", weather: "雾散风起", light: "晨光", media: [],
      elements: [{ id: "medicine-case-objective", kind: "object", name: "药匣", description: "本场争夺目标。", public: true, interactionUsageIds: ["take", "protect"] }],
      tracks: [{ id: "skiff-departure", name: "小舟离岸", kind: "crisis", max: 4, public: true }], events: [],
      combat: {
        id: "reed-bank-encounter", participantIds: ["pc-shen-qing", "pc-wei", "enemy-short-blade", "enemy-porter"],
        distanceRelations: [{ fromId: "pc-shen-qing", toId: "enemy-short-blade", band: "近身" }, { fromId: "pc-shen-qing", toId: "medicine-case-objective", band: "短距" }],
        victoryConditions: ["控制药匣且接应者失去继续争夺的能力"], defeatConditions: ["药匣沉水或被小舟带离"],
        retreatConditions: ["玩家主动放弃药匣撤离"], surrenderConditions: ["搬匣人受重伤且退路被断"], nonCombatResolutions: ["公开内应证据迫使接应者谈判"],
      },
      rewardIds: ["ending-case-recovered"], nextSceneIds: [],
    },
  ],
  rewards: [
    { id: "permission-ferry-ledger", name: "渡口账簿许可", kind: "permission", publicText: "船娘允许你查看当日船账。" },
    { id: "ending-case-recovered", name: "药匣归还", kind: "ending", publicText: "药匣得以保全，渡口留下新的江湖关系。" },
  ],
  referencedMoveIds: ["WG001"],
  referencedActorIds: ["pc-shen-qing", "pc-wei", "enemy-short-blade", "enemy-porter"],
  updatedAt: "2026-07-15T00:00:00.000Z",
};
