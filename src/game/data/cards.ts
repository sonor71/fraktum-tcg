import { CARDS } from "../cards";
import type { CardDefinition as CatalogCardDefinition } from "../types";
import type { CardDefinition } from "../core/types";
import { getWillCostByRarity } from "../rarityWillCost";

function toEngineCardDefinition(card: CatalogCardDefinition): CardDefinition {
  const bonusEffects = card.type === "bonus" ? [{ op: "bonus", percent: 10 }] : undefined;
  const hasBoardHp = Math.max(0, Math.floor(Number(card.health ?? 0))) > 0;

  const willCost = getWillCostByRarity(card.rarity);

  return {
    id: card.id,
    title: card.title,
    type: card.type,
    rarity: card.rarity,
    cost: willCost,
    willCost,
    attack: card.attack,
    health: card.health,
    hp: card.health,
    description: card.description,
    image: card.image,
    effectKey: card.effectKey,
    effects: bonusEffects,
    collection: card.collection,
    requiresBoardSlot: card.type !== "character" && card.type !== "bonus",
    leavesAtTurnEnd: !hasBoardHp,
    canAttack: hasBoardHp && card.attack > 0,
    scalableByElementBonus: card.type === "attack" || card.type === "event",
    scalableFields: card.attack > 0 ? ["damage"] : undefined,
  };
}

export const cardDefinitions: CardDefinition[] = CARDS.map(toEngineCardDefinition);

export function loadCardDefinitions() {
  return cardDefinitions;
}

export function normalizeCardDefinition(input: Partial<CardDefinition> & { id?: string; title?: string; name?: string; image?: string }): CardDefinition {
  const existing = input.id ? getCardDefinition(input.id) : undefined;
  if (existing) {
    const merged = {
      ...existing,
      ...input,
      id: existing.id,
      title: input.title ?? input.name ?? existing.title,
    };
    const willCost = getWillCostByRarity(merged.rarity);
    return { ...merged, cost: willCost, willCost };
  }

  const title = input.title ?? input.name ?? input.id ?? "Card";
  const health = Math.max(0, Math.floor(Number(input.health ?? input.hp ?? 0)) || 0);
  const rarity = input.rarity ?? "common";
  const willCost = getWillCostByRarity(rarity);

  return {
    ...input,
    id: input.id ?? title.toLowerCase().replaceAll(" ", "_"),
    title,
    type: input.type ?? "effect",
    rarity,
    cost: willCost,
    willCost,
    attack: Math.max(0, Math.floor(Number(input.attack ?? 0)) || 0),
    health,
    hp: health,
    description: input.description ?? "",
    image: input.image ?? `/cards/${title}.png`,
    effectKey: input.effectKey,
    requiresBoardSlot: input.requiresBoardSlot ?? true,
    leavesAtTurnEnd: input.leavesAtTurnEnd ?? health <= 0,
  };
}

export const getCardDefinition = (id: string) => cardDefinitions.find((card) => card.id === id) ?? cardDefinitions[0];
