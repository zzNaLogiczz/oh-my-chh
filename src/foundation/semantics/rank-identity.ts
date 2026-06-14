export type RankBadgeFamily = "undead" | "angel" | "demon" | "admin" | "other";

export type RankBadgeIdentity = {
  rank: string;
  family: RankBadgeFamily;
  tier: string;
  effect: "0" | "1" | "2" | "3";
};

const OTHER_RANK_BADGE_IDENTITY: RankBadgeIdentity = { rank: "other", family: "other", tier: "0", effect: "0" };

const RANK_BADGE_IDENTITIES: Record<string, RankBadgeIdentity> = {
  亡灵: { rank: "undead", family: "undead", tier: "1", effect: "0" },
  实习天使: { rank: "apprentice-angel", family: "angel", tier: "2", effect: "0" },
  天使: { rank: "angel", family: "angel", tier: "3", effect: "1" },
  大天使: { rank: "archangel", family: "angel", tier: "4", effect: "1" },
  权天使: { rank: "authority-angel", family: "angel", tier: "5", effect: "1" },
  能天使: { rank: "energy-angel", family: "angel", tier: "6", effect: "1" },
  力天使: { rank: "power-angel", family: "angel", tier: "7", effect: "1" },
  主天使: { rank: "dominion-angel", family: "angel", tier: "8", effect: "2" },
  座天使: { rank: "throne-angel", family: "angel", tier: "9", effect: "2" },
  智天使: { rank: "wisdom-angel", family: "angel", tier: "10", effect: "2" },
  炽天使: { rank: "seraph", family: "angel", tier: "11", effect: "2" },
  小恶魔: { rank: "imp", family: "demon", tier: "12", effect: "1" },
  大恶魔: { rank: "greater-demon", family: "demon", tier: "13", effect: "2" },
  "圣魔使-迪亚波罗": { rank: "diablo", family: "admin", tier: "90", effect: "3" },
  "圣魔灵-路西法": { rank: "lucifer", family: "admin", tier: "95", effect: "3" },
  "圣魔王-\"傻蛋\"": { rank: "saint-demon-king", family: "admin", tier: "99", effect: "3" }
};

export function normalizeRankLabel(label: string): string {
  return label.replace(/[－—–]/g, "-").replace(/\s*-\s*/g, "-").replace(/\s+/g, "").trim();
}

export function getRankBadgeIdentity(label: string): RankBadgeIdentity | null {
  const normalizedLabel = normalizeRankLabel(label);
  if (!normalizedLabel) return null;
  return RANK_BADGE_IDENTITIES[normalizedLabel] ?? OTHER_RANK_BADGE_IDENTITY;
}

