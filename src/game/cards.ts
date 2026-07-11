import rawCards from "../data/cards.json";
import {
  CARD_RARITIES,
  type CardDefinition,
  type CardRarity,
  type CardType,
} from "./types";

export const RARITIES = CARD_RARITIES;
export type GameRarity = CardRarity;

export const RARITY_ORDER: Record<CardRarity, number> = {
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

export const RARITY_CHANCE: Record<CardRarity, number> = {
  common: 5500,
  rare: 2800,
  epic: 1000,
  mythic: 400,
  legendary: 180,
  chromatic: 50,
  exotic: 40,
  divine: 20,
  forgotten: 8,
  archaic: 2,
};

const CARD_TYPES = new Set<CardType>([
  "character",
  "attack",
  "tactic",
  "effect",
  "bonus",
  "event",
]);
const RARITY_SET = new Set<string>(CARD_RARITIES);

function requireString(value: unknown, field: string, index: number) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`[FRAKTUM] cards.json: card #${index + 1} has invalid field "${field}".`);
  }
  return value.trim();
}

function requireNumber(value: unknown, field: string, index: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`[FRAKTUM] cards.json: card #${index + 1} has invalid field "${field}".`);
  }
  return value;
}

function parseCard(value: unknown, index: number): CardDefinition {
  if (typeof value !== "object" || value === null) {
    throw new Error(`[FRAKTUM] cards.json: entry #${index + 1} is not an object.`);
  }

  const raw = value as Record<string, unknown>;
  const id = requireString(raw.id, "id", index);
  const title = requireString(raw.title, "title", index);
  const type = requireString(raw.type, "type", index) as CardType;
  const rarity = requireString(raw.rarity, "rarity", index) as CardRarity;

  if (!CARD_TYPES.has(type)) {
    throw new Error(`[FRAKTUM] cards.json: card "${id}" has unknown type "${type}".`);
  }
  if (!RARITY_SET.has(rarity)) {
    throw new Error(`[FRAKTUM] cards.json: card "${id}" has unknown rarity "${rarity}".`);
  }

  const description = requireString(raw.description, "description", index);
  const image = requireString(raw.image, "image", index);

  return {
    id,
    title,
    name: title,
    type,
    rarity,
    cost: requireNumber(raw.cost, "cost", index),
    attack: requireNumber(raw.attack, "attack", index),
    health: requireNumber(raw.health, "health", index),
    description,
    text: description,
    image,
    frontSrc: image,
    effectKey: requireString(raw.effectKey, "effectKey", index),
    collection: requireString(raw.collection, "collection", index),
  };
}

if (!Array.isArray(rawCards)) {
  throw new Error("[FRAKTUM] cards.json must contain an array.");
}

export const CARDS: CardDefinition[] = rawCards.map(parseCard);

const duplicateIds = CARDS.filter(
  (card, index, cards) =>
    cards.findIndex((other) => other.id === card.id) !== index,
).map((card) => card.id);

if (duplicateIds.length > 0) {
  throw new Error(
    `[FRAKTUM] Duplicate card ids: ${[...new Set(duplicateIds)].join(", ")}.`,
  );
}

export const CARDS_BY_ID: Record<string, CardDefinition> = Object.fromEntries(
  CARDS.map((card) => [card.id, card]),
);

function getCardsByRarity(cards: CardDefinition[]) {
  const result: Record<CardRarity, CardDefinition[]> = {
    common: [],
    rare: [],
    epic: [],
    mythic: [],
    legendary: [],
    chromatic: [],
    exotic: [],
    divine: [],
    forgotten: [],
    archaic: [],
  };

  for (const card of cards) result[card.rarity].push(card);
  return result;
}

function getRandomItem<T>(items: readonly T[]) {
  if (items.length === 0) {
    throw new Error("[FRAKTUM] Cannot choose an item from an empty array.");
  }

  return items[Math.floor(Math.random() * items.length)];
}

function pickRandomRarity(
  cardsByRarity: Record<CardRarity, CardDefinition[]>,
) {
  const availableRarities = CARD_RARITIES.filter(
    (rarity) => cardsByRarity[rarity].length > 0,
  );

  if (availableRarities.length === 0) {
    throw new Error("[FRAKTUM] No cards are available for this pool.");
  }

  const totalWeight = availableRarities.reduce(
    (sum, rarity) => sum + RARITY_CHANCE[rarity],
    0,
  );
  let roll = Math.random() * totalWeight;

  for (const rarity of availableRarities) {
    roll -= RARITY_CHANCE[rarity];
    if (roll <= 0) return rarity;
  }

  return availableRarities[availableRarities.length - 1];
}

export function getRandomCards(
  count: number,
  source: readonly CardDefinition[] = CARDS,
) {
  const uniqueSource = [
    ...new Map(source.map((card) => [card.id, card])).values(),
  ];
  const safeCount = Math.min(
    uniqueSource.length,
    Math.max(0, Math.floor(count)),
  );
  const remainingCards = [...uniqueSource];
  const selectedCards: CardDefinition[] = [];

  while (
    selectedCards.length < safeCount &&
    remainingCards.length > 0
  ) {
    const cardsByRarity = getCardsByRarity(remainingCards);
    const rarity = pickRandomRarity(cardsByRarity);
    const selectedCard = getRandomItem(cardsByRarity[rarity]);

    selectedCards.push(selectedCard);

    const selectedIndex = remainingCards.findIndex(
      (card) => card.id === selectedCard.id,
    );
    if (selectedIndex >= 0) {
      remainingCards.splice(selectedIndex, 1);
    }
  }

  return selectedCards;
}

export function getRandomCardIdsFromPool(
  baseIds: readonly string[],
  count: number,
) {
  const uniqueIds = [...new Set(baseIds)];
  const pool = uniqueIds
    .map((id) => CARDS_BY_ID[id])
    .filter((card): card is CardDefinition => Boolean(card));

  if (pool.length === 0) {
    throw new Error("[FRAKTUM] The selected pack has no valid cards.");
  }

  return getRandomCards(count, pool).map((card) => card.id);
}
