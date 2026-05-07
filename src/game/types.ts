export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
export type CardType = "character" | "event" | "effect" | "tactic";

export type Card = {
  id: string;
  name: string;
  rarity: Rarity;
  type: CardType;
  collection: string;
  text?: string;
};
