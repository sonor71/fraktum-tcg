import rawCards from "../data/cards.json";
import type { CardDefinition } from "./types";

export const CARDS: CardDefinition[] = (rawCards as CardDefinition[]).map((card) => ({
  ...card,
  name: card.title,
  text: card.description,
  frontSrc: card.image,
}));

export const CARDS_BY_ID: Record<string, CardDefinition> = Object.fromEntries(
  CARDS.map((card) => [card.id, card])
);

export const RARITY_ORDER: Record<CardDefinition["rarity"], number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

export function getRandomCards(count: number) {
  const weighted = CARDS.flatMap((card) => {
    const weight = card.rarity === "mythic" ? 1 : card.rarity === "legendary" ? 2 : card.rarity === "epic" ? 4 : card.rarity === "rare" ? 7 : 12;
    return Array.from({ length: weight }, () => card);
  });

  return Array.from({ length: count }, () => weighted[Math.floor(Math.random() * weighted.length)]);
}
