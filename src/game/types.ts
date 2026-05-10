export type CardRarity = "common" | "rare" | "epic" | "legendary" | "mythic";
export type CardType = "character" | "effect" | "event";

export type CardDefinition = {
  id: string;
  title: string;
  name?: string;
  type: CardType;
  rarity: CardRarity;
  cost: number;
  attack: number;
  health: number;
  description: string;
  text?: string;
  image: string;
  frontSrc?: string;
  effectKey: string;
  collection: string;
};

export type OwnedCard = {
  instanceId: string;
  baseId: string;
  title: string;
  rarity: CardRarity;
  type: CardType;
  image: string;
  frontSrc: string;
  obtainedAt: number;
};

export type MatchResult = {
  result: "win" | "lose";
  xp: number;
  coins: number;
  cardsRewarded: string[];
  cardsLost: string[];
  finishedAt: number;
};

export type MatchHistoryEntry = MatchResult & {
  id: string;
  appliedAt: number;
};

export type PlayerSettings = {
  sound: boolean;
  music: boolean;
  reducedMotion: boolean;
};

export type Card = CardDefinition;
