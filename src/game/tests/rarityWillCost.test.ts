import { describe, expect, it } from "vitest";
import catalogCards from "../../data/cards.json";
import type { CardInstance } from "../core/types";
import { getCardCost } from "../engine/TurnManager";
import {
  WILL_COST_BY_RARITY,
  getWillCostByRarity,
} from "../rarityWillCost";
import type { CardRarity } from "../types";

const EXPECTED_COSTS: Record<CardRarity, number> = {
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

describe("FRAKTUM rarity Will costs", () => {
  it("keeps the official 1-10 rarity table as the single source of truth", () => {
    expect(WILL_COST_BY_RARITY).toEqual(EXPECTED_COSTS);
  });

  it("requires every catalog card to match its rarity cost", () => {
    for (const card of catalogCards) {
      expect(
        card.cost,
        `${card.id} (${card.rarity}) has an invalid Will cost`,
      ).toBe(getWillCostByRarity(card.rarity));
    }
  });

  it("does not trust a stale or tampered printed cost inside a match", () => {
    const card = {
      instanceId: "player_tampered_common_1",
      baseId: "tampered_common",
      definition: {
        id: "tampered_common",
        title: "Tampered Common",
        type: "event",
        rarity: "common",
        cost: 3,
        willCost: 3,
        attack: 0,
        health: 0,
        description: "",
        image: "/cards/test.png",
      },
      currentAttack: 0,
      currentHealth: 0,
      ownerId: "player",
      originalOwnerId: "player",
      controllerId: "player",
    } satisfies CardInstance;

    expect(getCardCost(card)).toBe(1);
  });
});
