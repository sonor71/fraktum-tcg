import type { CardRarity } from "./types";

/**
 * FRAKTUM printed Will cost is determined only by card rarity.
 * This is the single source of truth used by the catalog, saved cards,
 * online decks, UI and the match engine.
 */
export const WILL_COST_BY_RARITY: Readonly<Record<CardRarity, number>> = {
  common: 1,
  rare: 2,
  epic: 3,
  mythic: 4,
  legendary: 5,
  chromatic: 6,
  exotic: 7,
  divine: 8,
  forgotten: 9,
  archaic: 10,
};

export function normalizeCardRarity(value: unknown): CardRarity {
  const rarity = String(value ?? "common").trim().toLowerCase();

  if (rarity in WILL_COST_BY_RARITY) {
    return rarity as CardRarity;
  }

  return "common";
}

export function getWillCostByRarity(value: unknown): number {
  return WILL_COST_BY_RARITY[normalizeCardRarity(value)];
}

export function enforceRarityWillCost<T extends { rarity?: unknown }>(card: T): T & {
  cost: number;
  willCost: number;
} {
  const cost = getWillCostByRarity(card.rarity);
  return { ...card, cost, willCost: cost };
}
