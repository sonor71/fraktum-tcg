export const FRAKTUM_MAIN_DECK_SIZE = 20;
export const FRAKTUM_MAX_BONUS_CARDS = 4;
export const FRAKTUM_MAX_CHARACTER_CARDS = 1;
export const FRAKTUM_MAX_SAVED_DECK_CARDS =
  FRAKTUM_MAIN_DECK_SIZE + FRAKTUM_MAX_BONUS_CARDS + FRAKTUM_MAX_CHARACTER_CARDS;

export type DeckCardKind = "main" | "character" | "bonus";

export type DeckSelectableCard = {
  instanceId: string;
  baseId: string;
  type?: string;
};

export type DeckSelection<T extends DeckSelectableCard> = {
  character: T | null;
  bonusCards: T[];
  mainDeck: T[];
  allCards: T[];
  missingInstanceIds: string[];
};

export function getDeckCardKind(type: unknown): DeckCardKind {
  const normalized = String(type ?? "").trim().toLowerCase();

  if (
    normalized.includes("character") ||
    normalized.includes("hero") ||
    normalized.includes("персонаж")
  ) {
    return "character";
  }

  if (
    normalized.includes("bonus") ||
    normalized.includes("boost") ||
    normalized.includes("upgrade") ||
    normalized.includes("бонус") ||
    normalized.includes("усилен")
  ) {
    return "bonus";
  }

  return "main";
}

export function splitDeckSelection<T extends DeckSelectableCard>(
  ownedCards: readonly T[],
  deckIds: readonly string[],
): DeckSelection<T> {
  const ownedById = new Map(ownedCards.map((card) => [card.instanceId, card]));
  const usedBaseIds = new Set<string>();
  const missingInstanceIds: string[] = [];
  let character: T | null = null;
  const bonusCards: T[] = [];
  const mainDeck: T[] = [];

  for (const instanceId of deckIds) {
    const card = ownedById.get(instanceId);
    if (!card) {
      missingInstanceIds.push(instanceId);
      continue;
    }

    if (!card.baseId || usedBaseIds.has(card.baseId)) continue;

    const kind = getDeckCardKind(card.type);

    if (kind === "character") {
      if (character) continue;
      character = card;
      usedBaseIds.add(card.baseId);
      continue;
    }

    if (kind === "bonus") {
      if (bonusCards.length >= FRAKTUM_MAX_BONUS_CARDS) continue;
      bonusCards.push(card);
      usedBaseIds.add(card.baseId);
      continue;
    }

    if (mainDeck.length >= FRAKTUM_MAIN_DECK_SIZE) continue;
    mainDeck.push(card);
    usedBaseIds.add(card.baseId);
  }

  return {
    character,
    bonusCards,
    mainDeck,
    allCards: [
      ...(character ? [character] : []),
      ...bonusCards,
      ...mainDeck,
    ],
    missingInstanceIds,
  };
}

export function sanitizeDeckIds<T extends DeckSelectableCard>(
  ownedCards: readonly T[],
  deckIds: readonly string[],
) {
  return splitDeckSelection(ownedCards, deckIds).allCards.map((card) => card.instanceId);
}

export function isMainDeckReady<T extends DeckSelectableCard>(
  ownedCards: readonly T[],
  deckIds: readonly string[],
) {
  return splitDeckSelection(ownedCards, deckIds).mainDeck.length === FRAKTUM_MAIN_DECK_SIZE;
}
