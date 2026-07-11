import { describe, expect, it } from "vitest";
import catalogCards from "../../data/cards.json";
import { loadCardDefinitions } from "../data/cards";

type CatalogCard = {
  id: string;
  cost: number;
  health: number;
  rarity: string;
  type: string;
  attack: number;
  effectKey: string;
  collection: string;
};

describe("match card data source", () => {
  it("adapts match definitions from src/data/cards.json without conflicting balance", () => {
    const catalog = catalogCards as CatalogCard[];
    const definitions = loadCardDefinitions();
    const byId = new Map(definitions.map((card) => [card.id, card]));

    expect(definitions).toHaveLength(catalog.length);
    expect(new Set(definitions.map((card) => card.id)).size).toBe(definitions.length);

    catalog.forEach((card) => {
      const definition = byId.get(card.id);
      expect(definition, `missing match definition for ${card.id}`).toBeDefined();
      expect(definition?.type).toBe(card.type);
      expect(definition?.cost).toBe(card.cost);
      expect(definition?.attack).toBe(card.attack);
      expect(definition?.health).toBe(card.health);
      expect(definition?.rarity).toBe(card.rarity);
      expect(definition?.effectKey).toBe(card.effectKey);
      expect(definition?.collection).toBe(card.collection);
    });
  });
});
