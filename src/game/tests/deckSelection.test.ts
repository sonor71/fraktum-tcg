import { describe, expect, it } from "vitest";
import {
  FRAKTUM_MAIN_DECK_SIZE,
  FRAKTUM_MAX_BONUS_CARDS,
  FRAKTUM_MAX_SAVED_DECK_CARDS,
  sanitizeDeckIds,
  splitDeckSelection,
} from "../deckRules";
import { createInitialMatchState } from "../engine/MatchEngine";
import { loadCardDefinitions } from "../data/cards";

function selectionCard(instanceId: string, baseId: string, type: string) {
  return { instanceId, baseId, type };
}

describe("saved deck selection", () => {
  it("keeps 20 main cards, one character and four bonus cards", () => {
    const character = selectionCard("char-1", "brian", "character");
    const bonuses = Array.from({ length: FRAKTUM_MAX_BONUS_CARDS }, (_, index) =>
      selectionCard(`bonus-${index}`, `bonus-base-${index}`, "bonus"),
    );
    const mains = Array.from({ length: FRAKTUM_MAIN_DECK_SIZE }, (_, index) =>
      selectionCard(`main-${index}`, `main-base-${index}`, "attack"),
    );
    const ownedCards = [character, ...bonuses, ...mains];
    const ids = ownedCards.map((card) => card.instanceId);

    const selection = splitDeckSelection(ownedCards, ids);

    expect(selection.character?.baseId).toBe("brian");
    expect(selection.bonusCards).toHaveLength(FRAKTUM_MAX_BONUS_CARDS);
    expect(selection.mainDeck).toHaveLength(FRAKTUM_MAIN_DECK_SIZE);
    expect(sanitizeDeckIds(ownedCards, ids)).toHaveLength(FRAKTUM_MAX_SAVED_DECK_CARDS);
  });
});

describe("match loadout", () => {
  it("uses exactly the selected main deck, hero and bonus cards", () => {
    const definitions = loadCardDefinitions();
    const selectedMainDeck = definitions
      .filter((card) => card.type !== "character" && card.type !== "bonus" && card.type !== "upgrade")
      .slice(0, FRAKTUM_MAIN_DECK_SIZE);
    const selectedHero = definitions.find((card) => card.id === "sam");
    const selectedBonus = definitions.find((card) => card.id === "crystal_of_time");

    expect(selectedHero).toBeDefined();
    expect(selectedBonus).toBeDefined();

    const state = createInitialMatchState({
      seed: 71,
      playerDeck: selectedMainDeck,
      playerHero: selectedHero,
      playerBonusCards: selectedBonus ? [selectedBonus] : [],
      startingPlayerId: "player",
    });

    const actualMainIds = new Set([
      ...state.player.hand,
      ...state.player.deck,
    ].map((card) => card.baseId));
    const expectedMainIds = new Set(selectedMainDeck.map((card) => card.id));

    expect(actualMainIds).toEqual(expectedMainIds);
    expect(state.player.hero.baseId).toBe("sam");
    expect(state.player.bonusCards.map((card) => card.baseId)).toEqual(["crystal_of_time"]);
  });
});
