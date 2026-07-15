import type { CampaignPack } from "./campaignSchema";
import { standardCampaignPack } from "./standardCampaignPack";
import { tutorialCampaignPack } from "./tutorialPack";

export interface CampaignPackListing {
  pack: CampaignPack;
  kind: "story" | "tutorial";
  recommendedPlayers: string;
  estimatedMinutes: string;
  flow: string;
  ready: boolean;
}

export const CAMPAIGN_PACKS: CampaignPackListing[] = [
  {
    pack: standardCampaignPack,
    kind: "story",
    recommendedPlayers: "1–4人",
    estimatedMinutes: "120–180分钟",
    flow: "调查 → 护送 → 对质／交锋 → 封卷",
    ready: true,
  },
  {
    pack: tutorialCampaignPack,
    kind: "tutorial",
    recommendedPlayers: "1–4人",
    estimatedMinutes: "60–90分钟",
    flow: "教学调查 → 追逐 → 非致命交锋",
    ready: true,
  },
];

export const DEFAULT_STORY_CAMPAIGN_ID = standardCampaignPack.id;
export const TUTORIAL_CAMPAIGN_ID = tutorialCampaignPack.id;

export function getCampaignPack(id: string | undefined): CampaignPack {
  return CAMPAIGN_PACKS.find((entry) => entry.pack.id === id)?.pack ?? standardCampaignPack;
}

export function getCampaignListing(id: string | undefined): CampaignPackListing {
  return CAMPAIGN_PACKS.find((entry) => entry.pack.id === id) ?? CAMPAIGN_PACKS[0];
}

export function isTutorialCampaign(id: string | undefined): boolean {
  return id === TUTORIAL_CAMPAIGN_ID;
}
