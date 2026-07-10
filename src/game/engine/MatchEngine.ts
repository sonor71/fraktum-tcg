import type { GameAction } from "../core/GameAction";
import type {
  CardDefinition,
  CardInstance,
  MatchState,
  PlayerId,
  StartMatchPayload,
  TargetRef,
} from "../core/types";
import { runSimpleAI } from "../ai/SimpleAI";
import { loadCardDefinitions } from "../data/cards";
import { resolveCardEffects } from "./EffectResolver";
import { rollDie, shuffleWithSeed } from "./Random";
import { canPayWill, initializeBattleWill, payWill, regenerateWillForTurn } from "./WillSystem";
import { drawCards } from "./DrawSystem";
import { resolveFieldCombat } from "./DamageSystem";
import {
  BOARD_SIZE,
  getCardBoardMaxHp,
  getCardCost,
  getCardTitle,
  getRequestedOrFreeSlotIndex,
  isCardBoardPermanent,
  isTemporaryCard,
  isValidSlotIndex,
  otherPlayer,
  playerLabel,
  slotsKey,
} from "./TurnManager";

import { DEFAULT_MAX_WILL, DEFAULT_WILL_REGEN, HAND_LIMIT, STARTING_HAND_SIZE, SKIP_TURN_DAMAGE, BASE_TURN_SECONDS, getD20PlayLimit, getMatchWinner, isFateRouletteRoll, scoreBattleResult } from "./Rules";
const LOG_LIMIT = 80;

type WillMatchConfig = {
  maxWill?: number;
  regenPerRound?: number;
};

function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function safeInteger(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function normalizeWillMatchConfig(value: unknown): Required<WillMatchConfig> {
  const record = readRecord(value);
  const maxWill = Math.max(1, Math.min(20, safeInteger(record.maxWill, DEFAULT_MAX_WILL)));
  const regenPerRound = Math.max(0, Math.min(10, safeInteger(record.regenPerRound ?? record.willRegen, DEFAULT_WILL_REGEN)));

  return { maxWill, regenPerRound };
}

function getDefinitionType(definition: CardDefinition) {
  return String((definition as unknown as Record<string, unknown>).type ?? "").trim().toLowerCase();
}

const isBonusDefinition = (definition: CardDefinition) => {
  const type = getDefinitionType(definition);
  return type === "bonus" || type === "upgrade";
};

const isHeroDefinition = (definition: CardDefinition) => {
  const type = getDefinitionType(definition);
  return type === "character" || type === "hero";
};

const inst = (definition: CardDefinition, ownerId: PlayerId, index: number): CardInstance => ({
  instanceId: `${ownerId}_${definition.id}_${index}`,
  baseId: definition.id,
  definition,
  currentAttack: definition.attack,
  currentHealth: definition.health,
  ownerId,
  originalOwnerId: ownerId,
  controllerId: ownerId,
});

function log(state: MatchState, message: string): MatchState {
  return { ...state, log: [...state.log, message].slice(-LOG_LIMIT) };
}

function findPreferredHero(id: PlayerId, defs: CardDefinition[], fallbackDefs: CardDefinition[]) {
  const preferredId = id === "player" ? "brian" : "felix";
  return (
    defs.find((card) => isHeroDefinition(card) && card.id === preferredId) ??
    defs.find((card) => isHeroDefinition(card)) ??
    fallbackDefs.find((card) => isHeroDefinition(card) && card.id === preferredId) ??
    fallbackDefs.find((card) => isHeroDefinition(card)) ??
    defs[0] ??
    fallbackDefs[0]
  );
}

function makeSide(
  id: PlayerId,
  defs: CardDefinition[],
  fallbackDefs = loadCardDefinitions(),
  willConfig: WillMatchConfig = {},
) {
  const normalizedWillConfig = normalizeWillMatchConfig(willConfig);
  const allDefinitions = defs.length > 0 ? defs : fallbackDefs;
  const heroDef = findPreferredHero(id, allDefinitions, fallbackDefs);
  const pool = allDefinitions.filter((card) => card.id !== heroDef.id);

  const all = pool.map((definition, index) => inst(definition, id, index));
  const bonusCards = all.filter((card) => isBonusDefinition(card.definition));
  const deckCards = all.filter((card) => !isBonusDefinition(card.definition) && !isHeroDefinition(card.definition));
  const hero = inst(heroDef, id, 999);

  return {
    id,
    hero,
    hp: heroDef.health || 30,
    maxHp: heroDef.health || 30,
    shield: 0,
    will: 0,
    maxWill: normalizedWillConfig.maxWill,
    willRegenPerRound: normalizedWillConfig.regenPerRound,
    personalTurnsTaken: 0,
    deck: deckCards,
    hand: [],
    discard: [],
    bonusCards,
    effects: [],
    lastTurnLostHp: 0,
  };
}

function removeFromHand(hand: CardInstance[], cardInstanceId: string) {
  return hand.filter((candidate) => candidate.instanceId !== cardInstanceId);
}

function normalizePlayedCard(card: CardInstance, turn: number): CardInstance {
  const maxHp = getCardBoardMaxHp(card);
  const permanent = maxHp > 0;

  return {
    ...card,
    currentHealth: permanent ? maxHp : 0,
    currentArmor: Math.max(0, Number(card.definition.armor ?? 0)),
    temporaryUntilRoundEnd: !permanent,
    playedRound: turn,
    enteredFieldOnTurn: turn,
    canAttackFromTurn: permanent ? turn + 1 : undefined,
  };
}

function moveDestroyedCardsToDiscard(state: MatchState): MatchState {
  let next = state;
  const board = {
    playerSlots: [...state.board.playerSlots],
    enemySlots: [...state.board.enemySlots],
  };

  (["player", "enemy"] as const).forEach((playerId) => {
    const key = slotsKey(playerId);
    const destroyed: CardInstance[] = [];

    board[key] = board[key].map((card) => {
      if (!card) return card;

      const permanent = isCardBoardPermanent(card);
      const currentHp = Number(card.currentHealth ?? getCardBoardMaxHp(card));

      if (permanent && currentHp <= 0) {
        destroyed.push({ ...card, temporaryUntilRoundEnd: false });
        return null;
      }

      return card;
    });

    if (destroyed.length > 0) {
      next = {
        ...next,
        [playerId]: {
          ...next[playerId],
          discard: [...next[playerId].discard, ...destroyed],
        },
      };

      destroyed.forEach((card) => {
        next = log(next, `${getCardTitle(card)} was destroyed and moved to discard.`);
      });
    }
  });

  return { ...next, board };
}


function drawUpToHandSize(state: MatchState, playerId: PlayerId, handSize = STARTING_HAND_SIZE): MatchState {
  const sideBefore = state[playerId];
  const beforeHand = sideBefore.hand.length;
  const cardsNeeded = Math.max(0, handSize - beforeHand);

  if (cardsNeeded <= 0) {
    return state;
  }

  const sideAfter = drawCards(sideBefore, cardsNeeded);
  const drawnCards = sideAfter.hand.slice(beforeHand);
  const drawnCount = drawnCards.length;
  let next: MatchState = { ...state, [playerId]: sideAfter };

  if (drawnCount === 1) {
    const drawnName = drawnCards[0]?.definition.title ?? drawnCards[0]?.definition.ruTitle ?? drawnCards[0]?.baseId ?? "a card";
    next = log(next, `[DRAW] ${playerLabel(playerId)} drew ${drawnName}. Hand is ${sideAfter.hand.length}/${handSize}.`);
  } else if (drawnCount > 1) {
    next = log(next, `[DRAW] ${playerLabel(playerId)} drew ${drawnCount} cards. Hand is ${sideAfter.hand.length}/${handSize}.`);
  }

  // Empty decks do not cause draw damage in FRAKTUM v1.0.

  return next;
}



function getSideEffects(state: MatchState, playerId: PlayerId): Array<Record<string, unknown>> {
  return (((state[playerId] as unknown as Record<string, unknown>).effects ?? []) as Array<Record<string, unknown>>).filter(Boolean);
}

function setSideEffects(state: MatchState, playerId: PlayerId, effects: Array<Record<string, unknown>>): MatchState {
  return {
    ...state,
    [playerId]: {
      ...state[playerId],
      effects: effects as any,
    },
  };
}

function normalizeEffectId(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}







export function effectAmount(effect: Record<string, unknown>, fallback = 0) {
  return Math.max(0, safeInteger(effect.amount, fallback));
}

function dealDirectHeroDamage(state: MatchState, playerId: PlayerId, damage: number, source: string): MatchState {
  const amount = Math.max(0, Math.floor(damage));
  if (amount <= 0) return state;

  const side = state[playerId];
  const before = Math.max(0, Number(side.hp ?? 0));
  const after = Math.max(0, before - amount);

  return log(
    {
      ...state,
      [playerId]: {
        ...side,
        hp: after,
        lastTurnLostHp: Math.max(0, Number(side.lastTurnLostHp ?? 0)) + Math.max(0, before - after),
      },
    },
    `[DMG] ${source} dealt ${amount} damage to ${playerLabel(playerId)}.`,
  );
}

function discardRandomCardsFromHand(state: MatchState, playerId: PlayerId, count: number, source: string): MatchState {
  let next = state;
  const safeCount = Math.max(0, Math.floor(count));

  for (let index = 0; index < safeCount; index += 1) {
    const side = next[playerId];
    if (side.hand.length === 0) return log(next, `${playerLabel(playerId)} had no cards to discard for ${source}.`);

    const roll = rollDie(next.rngSeed, side.hand.length);
    const cardIndex = roll.value - 1;
    const card = side.hand[cardIndex];
    const hand = side.hand.filter((_, candidateIndex) => candidateIndex !== cardIndex);

    next = log(
      {
        ...next,
        rngSeed: roll.seed,
        [playerId]: {
          ...side,
          hand,
          discard: [...side.discard, card],
        },
      },
      `${source}: ${playerLabel(playerId)} discarded ${getCardTitle(card)}.`,
    );
  }

  return next;
}

function triggerTurnStartEffects(state: MatchState, playerId: PlayerId): MatchState {
  let next = state;
  const effects = getSideEffects(next, playerId);

  for (const effect of effects) {
    const id = normalizeEffectId(effect.id);
    const source = String(effect.source ?? "effect");

    if (id === "psychological_disorder") {
      const roll = rollDie(next.rngSeed, 2);
      const discardCount = roll.value;
      next = discardRandomCardsFromHand({ ...next, rngSeed: roll.seed }, playerId, discardCount, source);
      continue;
    }

    if (id === "friday" || id === "ailment") {
      next = dealDirectHeroDamage(next, playerId, 1, source);
    }
  }

  return next;
}


function tryBlockCardPlayWithEffects(state: MatchState, playerId: PlayerId) {
  const effects = getSideEffects(state, playerId);
  const disorder = effects.find((effect) => normalizeEffectId(effect.id) === "psychological_disorder");

  if (!disorder) return { state, blocked: false };

  const roll = rollDie(state.rngSeed, 100);
  const next = { ...state, rngSeed: roll.seed };

  if (roll.value <= 20) {
    return {
      blocked: true,
      state: log(next, `[WARN] ${playerLabel(playerId)} could not play a card because of ${String(disorder.source ?? "psychological disorder")} (${roll.value}/20).`),
    };
  }

  return { state: next, blocked: false };
}

function applyCardPlayedTriggers(state: MatchState, playerId: PlayerId): MatchState {
  const effects = getSideEffects(state, playerId);
  let nextEffects = effects;
  let next = state;

  nextEffects = nextEffects.map((effect) => {
    if (normalizeEffectId(effect.id) !== "every_second_card_self_damage") return effect;

    const cardCount = Math.max(0, safeInteger(effect.cardCount, 0)) + 1;
    if (cardCount % 2 === 0) {
      next = dealDirectHeroDamage(next, playerId, 1, String(effect.source ?? "Seal of Forgotten Souls"));
    }

    return { ...effect, cardCount };
  });

  return setSideEffects(next, playerId, nextEffects);
}



export function createInitialMatchState(payload: StartMatchPayload = {}): MatchState {
  const defs = loadCardDefinitions();
  const payloadRecord = payload as unknown as Record<string, unknown>;
  const playerWillConfig = normalizeWillMatchConfig(payloadRecord.playerWillStats ?? payloadRecord.playerWillConfig);
  const enemyWillConfig = normalizeWillMatchConfig(payloadRecord.enemyWillStats ?? payloadRecord.enemyWillConfig);
  const playerDeck = payload.playerDeck && payload.playerDeck.length > 0 ? payload.playerDeck : defs;
  const enemyDeck =
    payload.enemyDeck && payload.enemyDeck.length > 0
      ? payload.enemyDeck
      : defs.map((card) => (card.id === "brian" ? defs.find((definition) => definition.id === "felix") ?? card : card));

  let seed = payload.seed ?? 12345;
  let playerSide: any = makeSide("player", playerDeck, defs, playerWillConfig);
  let enemySide: any = makeSide("enemy", enemyDeck, defs, enemyWillConfig);
  const playerShuffle = shuffleWithSeed(playerSide.deck, seed);
  seed = playerShuffle.seed;
  const enemyShuffle = shuffleWithSeed(enemySide.deck, seed);
  seed = enemyShuffle.seed;
  playerSide = drawCards({ ...playerSide, deck: playerShuffle.items, hand: [] }, STARTING_HAND_SIZE);
  enemySide = drawCards({ ...enemySide, deck: enemyShuffle.items, hand: [] }, STARTING_HAND_SIZE);

  const initiativeRolls: Array<{ player: number; enemy: number }> = [];
  let firstPlayerId: PlayerId = "player";
  do {
    const playerRoll = rollDie(seed, 20);
    const enemyRoll = rollDie(playerRoll.seed, 20);
    seed = enemyRoll.seed;
    initiativeRolls.push({ player: playerRoll.value, enemy: enemyRoll.value });
    if (playerRoll.value !== enemyRoll.value) firstPlayerId = playerRoll.value > enemyRoll.value ? "player" : "enemy";
  } while (initiativeRolls[initiativeRolls.length - 1].player === initiativeRolls[initiativeRolls.length - 1].enemy);

  let state: MatchState = {
    id: `match_${Date.now()}`,
    phase: firstPlayerId === "player" ? "roll" : "enemy",
    turn: 1,
    activePlayerId: firstPlayerId,
    player: playerSide,
    enemy: enemySide,
    board: {
      playerSlots: Array<CardInstance | null>(BOARD_SIZE).fill(null),
      enemySlots: Array<CardInstance | null>(BOARD_SIZE).fill(null),
    },
    stack: [],
    log: [
      "React TypeScript match started.",
      `Initiative: ${initiativeRolls.map((r) => `${r.player}:${r.enemy}`).join(", ")}.`,
      "Bonus cards were assigned to hero slots.",
      `Player Will upgrades: max ${playerWillConfig.maxWill}, regen +${playerWillConfig.regenPerRound}/turn.`,
      `${playerLabel(firstPlayerId)} starts in roll phase.`,
    ],
    rngSeed: seed,
    initiativeRolls,
    battleNumber: 1,
    seriesScore: { player: 0, enemy: 0 },
    caduceusUsed: false,
    rouletteUsedThisBattle: false,
  };

  state = initializeBattleWill(state, firstPlayerId);
  return state;
}

export const startMatch = createInitialMatchState;

function finishBattle(state: MatchState, result: PlayerId | "draw", reason: string): MatchState {
  const scores = scoreBattleResult(state.seriesScore ?? { player: 0, enemy: 0 }, result);
  const matchWinner = getMatchWinner(scores);
  return log({ ...state, seriesScore: scores, phase: "ended", winner: matchWinner ?? result }, `${reason} Battle result: ${result}. Series score ${scores.player}:${scores.enemy}.`);
}

export function resolveCaduceusBattleDraw(state: MatchState, sourceName = "Caduceus"): MatchState {
  if (state.caduceusUsed) return log(state, `${sourceName} is blocked: Caduceus has already resolved in this match.`);
  return finishBattle({ ...state, caduceusUsed: true }, "draw", `${sourceName} ended the battle in a draw.`);
}

export function dispatch(state: MatchState, action: GameAction): MatchState {
  try {
    if (state.phase === "ended" && action.type !== "START_MATCH") {
      return log(state, "Match already ended.");
    }

    switch (action.type) {
      case "START_MATCH":
        return startMatch(action.payload);
      case "ROLL_D20":
        return rollD20(state, action.playerId);
      case "PLAY_CARD":
        return playCard(state, action.playerId, action.cardInstanceId, action.target);
      case "DESTROY_OWN_CARD":
        return destroyOwnCard(state, action.playerId, action.slotIndex);
      case "END_TURN":
        return endTurn(state, action.playerId);
      case "AI_TURN":
        return runSimpleAI(state);
      case "CONCEDE":
        return log(
          { ...state, phase: "ended", winner: otherPlayer(action.playerId) },
          `${playerLabel(action.playerId)} conceded.`,
        );
      default:
        return log(state, "Unknown action.");
    }
  } catch (error) {
    return log(state, `Invalid action: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function beginTurnIfNeeded(state: MatchState, playerId: PlayerId): MatchState {
  const sameTurn = state.currentTurn?.playerId === playerId;
  if (sameTurn) return state;
  let next = cleanupTemporaryCards(state);
  next = triggerTurnStartEffects(next, playerId);
  next = regenerateWillForTurn(next, playerId);
  next = drawUpToHandSize(next, playerId, HAND_LIMIT);
  return next;
}

function rollD20ForLimit(state: MatchState): { state: MatchState; roll: number; rouletteActivated: boolean } {
  let roll = rollDie(state.rngSeed, 20);
  let next: MatchState = { ...state, rngSeed: roll.seed };
  let rouletteActivated = false;

  if (isFateRouletteRoll(roll.value) && !next.rouletteUsedThisBattle) {
    const eventRoll = rollDie(next.rngSeed, 5);
    const events = ["MERGED_DECKS", "WORLD_WITHOUT_WILL", "BLIND_TOP", "HIDDEN_HAND", "EMPTY_OUTCOME"];
    next = log({ ...next, rngSeed: eventRoll.seed, rouletteUsedThisBattle: true, activeRouletteEvent: events[eventRoll.value - 1] }, `[ROULETTE] Fate Roulette activated: ${events[eventRoll.value - 1]}.`);
    rouletteActivated = true;
    do {
      roll = rollDie(next.rngSeed, 20);
      next = { ...next, rngSeed: roll.seed };
    } while (isFateRouletteRoll(roll.value));
  }

  return { state: next, roll: roll.value, rouletteActivated };
}

export function rollD20(state: MatchState, playerId: PlayerId): MatchState {
  if (state.activePlayerId !== playerId) return log(state, `It is not ${playerLabel(playerId)}'s roll.`);
  if (playerId === "player" && state.phase !== "roll") return log(state, "Player can roll only during roll phase.");
  if (playerId === "enemy" && state.phase !== "enemy") return log(state, "AI can roll only during enemy phase.");

  const started = beginTurnIfNeeded(state, playerId);
  const afterCombat = checkWinCondition(moveDestroyedCardsToDiscard(resolveFieldCombat(started, playerId)));
  if (afterCombat.phase === "ended") return afterCombat;
  const result = rollD20ForLimit(afterCombat);
  const d20Limit = getD20PlayLimit(result.roll);
  return log(
    {
      ...result.state,
      lastRoll: result.roll,
      phase: playerId === "player" ? "main" : "enemy",
      currentTurn: {
        playerId,
        d20Limit,
        playsUsed: 0,
        cardsPlayed: 0,
        destroyedOwnCard: false,
        freeCards: result.roll === 20,
        skipDamageApplied: false,
        timerSeconds: BASE_TURN_SECONDS,
        playedCosts: [],
      },
    },
    `${playerLabel(playerId)} rolled D20: ${result.roll}. Play limit: ${d20Limit === "unlimited" ? "unlimited" : d20Limit}${result.roll === 20 ? ", cards are free this turn" : ""}.`,
  );
}

export function playCard(
  state: MatchState,
  playerId: PlayerId,
  cardInstanceId: string,
  target?: TargetRef,
): MatchState {
  if (state.activePlayerId !== playerId) {
    return log(state, `It is not ${playerLabel(playerId)}'s turn.`);
  }

  if (playerId === "player" && state.phase !== "main") {
    return log(state, "Player can play cards only during main phase.");
  }

  if (playerId === "enemy" && state.phase !== "enemy") {
    return log(state, "AI can play cards only during enemy phase.");
  }

  const playBlock = tryBlockCardPlayWithEffects(state, playerId);
  if (playBlock.blocked) return playBlock.state;

  const side = playBlock.state[playerId];
  const card = side.hand.find((candidate) => candidate.instanceId === cardInstanceId);

  if (!card) return log(state, "Card is not in hand.");

  const turnState = playBlock.state.currentTurn ?? { playerId, d20Limit: "unlimited" as const, playsUsed: 0, cardsPlayed: 0, destroyedOwnCard: false, freeCards: false, skipDamageApplied: false, timerSeconds: BASE_TURN_SECONDS, playedCosts: [] };
  if (turnState.d20Limit !== "unlimited" && turnState.playsUsed >= turnState.d20Limit) return log(state, "D20 play limit has been reached.");

  const printedCost = getCardCost(card);
  const cost = turnState.freeCards ? 0 : printedCost;
  if (!canPayWill(side, cost)) {
    return log(state, `Not enough Will for ${getCardTitle(card)}. Needs ${cost}, has ${side.will}.`);
  }

  const ownSlotsKey = slotsKey(playerId);
  const currentSlots = [...playBlock.state.board[ownSlotsKey]];
  const slotIndex = getRequestedOrFreeSlotIndex(playBlock.state, playerId, target);

  if (!isValidSlotIndex(slotIndex, currentSlots.length)) {
    return log(state, "Invalid target: no playable slot.");
  }

  if (currentSlots[slotIndex]) {
    return log(state, `Invalid target: slot ${slotIndex + 1} is occupied.`);
  }

  const playedCard = { ...normalizePlayedCard(card, state.turn), slotIndex, controllerId: playerId, originalOwnerId: card.originalOwnerId ?? card.ownerId };
  currentSlots[slotIndex] = playedCard;

  const paidSide = payWill(side, cost);
  let next: MatchState = {
    ...playBlock.state,
    board: { ...playBlock.state.board, [ownSlotsKey]: currentSlots },
    [playerId]: {
      ...paidSide,
      hand: removeFromHand(side.hand, cardInstanceId),
    },
    currentTurn: {
      ...turnState,
      playsUsed: turnState.playsUsed + 1,
      cardsPlayed: turnState.cardsPlayed + 1,
      playedCosts: [...turnState.playedCosts, { playerId, cardTitle: getCardTitle(card), cost: printedCost }],
    },
  };

  next = log(next, `${playerLabel(playerId)} played ${getCardTitle(card)} on slot ${slotIndex + 1} (cost ${printedCost}).`);
  next = log(
    next,
    isCardBoardPermanent(playedCard)
      ? `${getCardTitle(card)} stays on board with ${playedCard.currentHealth}/${getCardBoardMaxHp(playedCard)} HP.`
      : `${getCardTitle(card)} is temporary and will move to discard on the next player D20 roll.`,
  );

  next = resolveCardEffects(next, playerId, playedCard, target, slotIndex);
  next = applyCardPlayedTriggers(next, playerId);
  next = moveDestroyedCardsToDiscard(next);

  return checkWinCondition(next);
}

export function destroyOwnCard(state: MatchState, playerId: PlayerId, slotIndex: number): MatchState {
  if (state.activePlayerId !== playerId || !state.currentTurn || state.currentTurn.playerId !== playerId) return log(state, "Cannot destroy own card outside your active turn.");
  const turnState = state.currentTurn;
  if (turnState.destroyedOwnCard) return log(state, "Own card has already been destroyed voluntarily this turn.");
  if (turnState.d20Limit !== "unlimited" && turnState.playsUsed >= turnState.d20Limit) return log(state, "D20 play limit has been reached.");
  const side = state[playerId];
  if (!canPayWill(side, 1)) return log(state, "Not enough Will to destroy own card.");
  const key = slotsKey(playerId);
  if (!isValidSlotIndex(slotIndex, state.board[key].length)) return log(state, "Invalid slot.");
  const slots = [...state.board[key]];
  const card = slots[slotIndex];
  if (!card) return log(state, "No own card in that slot.");
  slots[slotIndex] = null;
  return log({
    ...state,
    board: { ...state.board, [key]: slots },
    [playerId]: { ...payWill(side, 1), discard: [...side.discard, card] },
    currentTurn: { ...turnState, playsUsed: turnState.playsUsed + 1, destroyedOwnCard: true },
  }, `${playerLabel(playerId)} voluntarily destroyed ${getCardTitle(card)}.`);
}

export function cleanupTemporaryCards(state: MatchState): MatchState {
  let next = state;
  const board = {
    playerSlots: [...state.board.playerSlots],
    enemySlots: [...state.board.enemySlots],
  };

  (["player", "enemy"] as const).forEach((playerId) => {
    const key = slotsKey(playerId);
    const movingToDiscard: CardInstance[] = [];

    board[key] = board[key].map((card) => {
      if (!isTemporaryCard(card)) return card;

      movingToDiscard.push({
        ...card,
        temporaryUntilRoundEnd: false,
      } as CardInstance);

      return null;
    });

    if (movingToDiscard.length > 0) {
      next = {
        ...next,
        [playerId]: {
          ...next[playerId],
          discard: [...next[playerId].discard, ...movingToDiscard],
        },
      };

      movingToDiscard.forEach((card) => {
        next = log(next, `Round cleanup: ${getCardTitle(card)} moved to discard.`);
      });
    }
  });

  return { ...next, board };
}

export function endTurn(state: MatchState, playerId: PlayerId): MatchState {
  if (state.activePlayerId !== playerId) {
    return log(state, `It is not ${playerLabel(playerId)}'s turn.`);
  }

  if (state.phase === "ended") return state;

  let endingState = cleanupTemporaryCards(state);
  const turnState = endingState.currentTurn;
  if (turnState?.playerId === playerId && turnState.cardsPlayed === 0 && !turnState.skipDamageApplied) {
    endingState = dealDirectHeroDamage(endingState, playerId, SKIP_TURN_DAMAGE, "Skip penalty");
    endingState = { ...endingState, currentTurn: { ...turnState, skipDamageApplied: true } };
  }
  endingState = checkWinCondition(endingState);
  if (endingState.phase === "ended") return endingState;

  const nextPlayer = otherPlayer(playerId);
  let next: MatchState = {
    ...endingState,
    activePlayerId: nextPlayer,
    phase: nextPlayer === "player" ? "roll" : "enemy",
    turn: playerId === "enemy" ? endingState.turn + 1 : endingState.turn,
    currentTurn: undefined,
    [playerId]: {
      ...endingState[playerId],
      personalTurnsTaken: (endingState[playerId].personalTurnsTaken ?? 0) + 1,
    },
    [nextPlayer]: {
      ...endingState[nextPlayer],
      lastTurnLostHp: 0,
    },
  };

  next = log(
    next,
    playerId === "enemy"
      ? "AI ended turn."
      : "Player ended turn.",
  );

  return checkWinCondition(next);
}

function hasNoCardsToContinue(state: MatchState, playerId: PlayerId) {
  return state[playerId].deck.length === 0 && state[playerId].hand.length === 0;
}

function finishByHpComparison(state: MatchState, reason: string): MatchState {
  const playerHp = Number(state.player.hp ?? 0);
  const enemyHp = Number(state.enemy.hp ?? 0);
  if (playerHp > enemyHp) return finishBattle(state, "player", reason);
  if (enemyHp > playerHp) return finishBattle(state, "enemy", reason);
  return finishBattle(state, "draw", reason);
}

export function checkWinCondition(state: MatchState): MatchState {
  if (state.player.hp <= 0 && state.enemy.hp <= 0) {
    return finishByHpComparison(state, "Both heroes fell.");
  }

  if (state.player.hp <= 0) {
    return finishBattle(state, "enemy", "Player hero fell.");
  }

  if (state.enemy.hp <= 0) {
    return finishBattle(state, "player", "Enemy hero fell.");
  }

  if (hasNoCardsToContinue(state, "player") && hasNoCardsToContinue(state, "enemy")) {
    return finishByHpComparison(state, "Both players have no cards left in hand or deck.");
  }

  return state;
}
