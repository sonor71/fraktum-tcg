import { CARDS } from "../cards";
import type { CardDefinition as CatalogCardDefinition } from "../types";
import type { CardDefinition } from "../core/types";

function toEngineCardDefinition(card: CatalogCardDefinition): CardDefinition {
  const bonusEffects = card.type === "bonus" ? [{ op: "bonus", percent: 10 }] : undefined;
  const hasBoardHp = Math.max(0, Math.floor(Number(card.health ?? 0))) > 0;

  return {
    id: card.id,
    title: card.title,
    type: card.type,
    rarity: card.rarity,
    cost: card.cost,
    willCost: card.cost,
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
  if (existing) return { ...existing, ...input, id: existing.id, title: input.title ?? input.name ?? existing.title };

  const title = input.title ?? input.name ?? input.id ?? "Card";
  const health = Math.max(0, Math.floor(Number(input.health ?? input.hp ?? 0)) || 0);

  return {
    id: input.id ?? title.toLowerCase().replaceAll(" ", "_"),
    title,
    type: input.type ?? "effect",
    rarity: input.rarity ?? "common",
    cost: Math.max(0, Math.floor(Number(input.cost ?? input.willCost ?? 1)) || 0),
    willCost: Math.max(0, Math.floor(Number(input.willCost ?? input.cost ?? 1)) || 0),
    attack: Math.max(0, Math.floor(Number(input.attack ?? 0)) || 0),
    health,
    hp: health,
    description: input.description ?? "",
    image: input.image ?? `/cards/${title}.png`,
    effectKey: input.effectKey,
    requiresBoardSlot: input.requiresBoardSlot ?? true,
    leavesAtTurnEnd: input.leavesAtTurnEnd ?? health <= 0,
    ...input,
  };
}

export const getCardDefinition = (id: string) => cardDefinitions.find((card) => card.id === id) ?? cardDefinitions[0];
