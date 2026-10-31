import { describe, expect, it } from "vitest";
import { CARDS, CARDS_BY_ID } from "../cards";
import { matchesMarketCardSearch } from "../marketCatalog";
import { PACKS } from "../../data/packs";

const NEW_CARDS = {
  elite_knight: ["Элитный рыцарь", "Elite Knight"],
  hero_silhouette: ["Силуэт героя", "Hero Silhouette"],
  healing: ["Исцеление", "Healing"],
  prime: ["Прайм", "Prime"],
  clean_sheet: ["Чистый лист", "Clean Sheet"],
  tsunami: ["Цунами", "Tsunami"],
} as const;

describe("new cards in packs and the market catalog", () => {
  it("makes all six cards available in the normal pack and market catalog", () => {
    const normalPool = PACKS.find((pack) => pack.id === "normal")?.cardPool ?? [];
    for (const id of Object.keys(NEW_CARDS)) {
      expect(CARDS_BY_ID[id]).toBeDefined();
      expect(CARDS.some((card) => card.id === id)).toBe(true);
      expect(normalPool).toContain(id);
    }
  });

  it("finds every new card by Russian and English name", () => {
    for (const [id, [russian, english]] of Object.entries(NEW_CARDS)) {
      const definition = CARDS_BY_ID[id];
      expect(definition).toBeDefined();
      expect(matchesMarketCardSearch(definition, russian)).toBe(true);
      expect(matchesMarketCardSearch(definition, english.toLowerCase())).toBe(true);
      expect(matchesMarketCardSearch(definition, id)).toBe(true);
    }
  });

  it("keeps collection search and excludes unrelated names", () => {
    const definition = CARDS_BY_ID.healing;
    expect(matchesMarketCardSearch(definition, "  ")).toBe(true);
    expect(matchesMarketCardSearch(definition, definition.collection)).toBe(true);
    expect(matchesMarketCardSearch(definition, "цУнАмИ")).toBe(false);
  });
});
