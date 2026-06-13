import type { OwnedCard } from "../../useGameStore";
import { createMatchCardFromOwned, createStarterDeck } from "./catalog";
import type { MatchCard, MatchLogEntry, MatchState, Owner, PlayerState } from "./types";

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function makeLog(text: string): MatchLogEntry {
  return {
    id: crypto.randomUUID(),
    text,
  };
}

function drawCards(deck: MatchCard[], amount: number) {
  return {
    hand: deck.slice(0, amount),
    restDeck: deck.slice(amount),
  };
}

function buildPlayerDeck(ownedCards: OwnedCard[], deckIds: string[]): MatchCard[] {
  const ownedById = new Map(ownedCards.map((card) => [card.instanceId, card]));

  const chosenFromDeck = deckIds
    .map((instanceId) => ownedById.get(instanceId) ?? null)
    .filter((card): card is OwnedCard => card !== null)
    .map((card) => createMatchCardFromOwned(card));

  const usedIds = new Set(chosenFromDeck.map((card) => card.instanceId));

  const restOwned = ownedCards
    .filter((card) => !usedIds.has(card.instanceId))
    .map((card) => createMatchCardFromOwned(card));

  const combined = [...chosenFromDeck, ...restOwned];
  const supplemented = combined.length >= 20
    ? combined.slice(0, 20)
    : [...combined, ...createStarterDeck("player_starter").slice(0, 20 - combined.length)];

  return shuffle(supplemented);
}

function buildAiDeck(playerCards: MatchCard[]): MatchCard[] {
  if (playerCards.length >= 20) {
    const mirrored = playerCards.slice(0, 20).map((card, index) => ({
      ...card,
      instanceId: `ai_mirror_${card.baseId}_${index}`,
    }));
    return shuffle(mirrored);
  }

  return shuffle(createStarterDeck("ai_starter"));
}

function createPlayerState(owner: Owner, deck: MatchCard[]): PlayerState {
  const { hand, restDeck } = drawCards(deck, 5);

  return {
    owner,
    hp: 30,
    will: owner === "player" ? 1 : 0,
    maxWill: 5,
    deck: restDeck,
    hand,
    board: [],
    graveyard: [],
  };
}

export function createInitialMatch(ownedCards: OwnedCard[], deckIds: string[]): MatchState {
  const playerDeck = buildPlayerDeck(ownedCards, deckIds);
  const aiDeck = buildAiDeck(playerDeck);

  return {
    matchId: crypto.randomUUID(),
    phase: "turn_intro",
    activePlayer: "player",
    round: 1,
    player: createPlayerState("player", playerDeck),
    ai: createPlayerState("ai", aiDeck),
    sharedDeck: {
      active: false,
      cards: [],
    },
    turn: {
      round: 1,
      roll: null,
      playLimit: 1,
      playsMade: 0,
      playedAnyCard: false,
      willMultiplier: 1,
      graveyardPlayAvailable: false,
      enemyDeckPlayCardId: null,
      awakeningFreePlayAvailable: false,
      awakeningPassiveAvailable: false,
      rouletteEventId: null,
    },
    log: [
      makeLog("Матч FRAKTUM начался."),
      makeLog("Игрок начинает с 1 Воли. В начале каждого хода бросается D20."),
    ],
    winner: null,
    passiveSilencedUntilRound: null,
  };
}
