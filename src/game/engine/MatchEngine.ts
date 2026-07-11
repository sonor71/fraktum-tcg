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
  cardRequiresBoardSlot,
  getCardBoardMaxHp,
  getCardCost,
  getEffectiveCardCost,
  getCardTitle,
  getRequestedOrFreeSlotIndex,
  isCardBoardPermanent,
  isTemporaryCard,
  isValidSlotIndex,
  otherPlayer,
  playerLabel,
  slotsKey,
} from "./TurnManager";

import { DEFAULT_MAX_WILL, DEFAULT_WILL_REGEN, HAND_LIMIT, STARTING_HAND_SIZE, NO_CARD_PENALTY_DAMAGE, BASE_TURN_SECONDS, DECK_SIZE, FATE_ROULETTE_EVENTS, getD20PlayLimit, getMatchWinner, isFateRouletteRoll, scoreBattleResult } from "./Rules";
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
  const regenPerRound = Math.max(DEFAULT_WILL_REGEN, Math.min(10, safeInteger(record.regenPerRound ?? record.willRegen, DEFAULT_WILL_REGEN)));

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

function uniqueMainDeckDefinitions(defs: CardDefinition[], fallbackDefs: CardDefinition[], allowFixtureFallback: boolean) {
  const source = defs.length > 0 ? defs : allowFixtureFallback ? fallbackDefs : [];
  const unique = new Map<string, CardDefinition>();

  source.forEach((card) => {
    if (isHeroDefinition(card) || isBonusDefinition(card)) return;
    if (!unique.has(card.id)) unique.set(card.id, card);
  });

  const deck = [...unique.values()].slice(0, DECK_SIZE);
  if (deck.length !== DECK_SIZE) {
    throw new Error(`A FRAKTUM match deck must contain ${DECK_SIZE} unique non-character, non-bonus cards.`);
  }
  return deck;
}

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
  const bonusDefinitions = allDefinitions.filter((card) => isBonusDefinition(card));
  const deckDefinitions = uniqueMainDeckDefinitions(defs, fallbackDefs, defs.length === 0);

  const all = [...bonusDefinitions, ...deckDefinitions].map((definition, index) => inst(definition, id, index));
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


export function consumeSkipTurn(state: MatchState, playerId: PlayerId): { state: MatchState; skipped: boolean } {
  const effects = getSideEffects(state, playerId);
  const skip = effects.find((effect) => normalizeEffectId(effect.id) === "skip_next_turn");
  if (!skip) return { state, skipped: false };

  const next = setSideEffects(state, playerId, effects.filter((effect) => effect !== skip));
  return { state: log(next, `[TURN_SKIPPED] ${playerLabel(playerId)} skipped turn due to ${String(skip.source ?? "freeze")}.`), skipped: true };
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
  let firstPlayerId: PlayerId = payload.startingPlayerId === "enemy" ? "enemy" : "player";
  if (!payload.startingPlayerId) {
    do {
      const playerRoll = rollDie(seed, 20);
      const enemyRoll = rollDie(playerRoll.seed, 20);
      seed = enemyRoll.seed;
      initiativeRolls.push({ player: playerRoll.value, enemy: enemyRoll.value });
      if (playerRoll.value !== enemyRoll.value) firstPlayerId = playerRoll.value > enemyRoll.value ? "player" : "enemy";
    } while (initiativeRolls[initiativeRolls.length - 1].player === initiativeRolls[initiativeRolls.length - 1].enemy);
  }

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
      initiativeRolls.length > 0 ? `Initiative: ${initiativeRolls.map((r) => `${r.player}:${r.enemy}`).join(", ")}.` : `Initiative fixed by room: ${playerLabel(firstPlayerId)} starts.`,
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

function collectBattleDefinitions(state: MatchState, playerId: PlayerId): CardDefinition[] {
  const side = state[playerId];
  const slotCards = state.board[slotsKey(playerId)].filter((card): card is CardInstance => Boolean(card));
  const cards = [side.hero, ...side.deck, ...side.hand, ...side.discard, ...(side.exile ?? []), ...side.bonusCards, ...slotCards];
  const unique = new Map<string, CardDefinition>();
  cards.forEach((card) => unique.set(card.baseId, card.definition));
  return [...unique.values()];
}

function startNextBattle(state: MatchState, scores: Record<PlayerId, number>, reason: string): MatchState {
  const nextBattle = createInitialMatchState({
    seed: state.rngSeed,
    playerDeck: collectBattleDefinitions(state, "player"),
    enemyDeck: collectBattleDefinitions(state, "enemy"),
  });

  return log({
    ...nextBattle,
    id: state.id,
    battleNumber: (state.battleNumber ?? 1) + 1,
    seriesScore: scores,
    caduceusUsed: state.caduceusUsed,
    rouletteUsedThisBattle: false,
    activeRouletteEvent: undefined,
    rouletteOwnerId: undefined,
    rouletteExpiresBeforeOwnerPersonalTurn: undefined,
    battleResult: undefined,
  }, `${reason} Battle result: ${state.battleResult ?? "complete"}. Series score ${scores.player}:${scores.enemy}. Next battle starts.`);
}

function finishBattle(state: MatchState, result: PlayerId | "draw", reason: string): MatchState {
  const scores = scoreBattleResult(state.seriesScore ?? { player: 0, enemy: 0 }, result);
  const matchWinner = getMatchWinner(scores);
  const scoredState = { ...state, seriesScore: scores, battleResult: result };

  if (!matchWinner) {
    return log({ ...scoredState, phase: "betweenBattles", battleEndReason: reason }, `${reason} Battle result: ${result}. Series score ${scores.player}:${scores.enemy}. Awaiting next battle.`);
  }

  return log({ ...scoredState, phase: "ended", winner: matchWinner, battleEndReason: reason }, `${reason} Battle result: ${result}. Series score ${scores.player}:${scores.enemy}. Match result: ${matchWinner}.`);
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
      case "START_NEXT_BATTLE":
        return state.phase === "betweenBattles" ? startNextBattle(state, state.seriesScore ?? { player: 0, enemy: 0 }, "BATTLE_STATE_RESET") : log(state, "Cannot start next battle now.");
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
  let next = state;
  if (next.activeRouletteEvent === "WORLD_WITHOUT_WILL" && next.rouletteOwnerId === playerId && (next[playerId].personalTurnsTaken ?? 0) >= (next.rouletteExpiresBeforeOwnerPersonalTurn ?? Number.POSITIVE_INFINITY)) {
    next = log({ ...next, activeRouletteEvent: undefined, rouletteOwnerId: undefined, rouletteExpiresBeforeOwnerPersonalTurn: undefined }, `[ROULETTE_END] Event expired before ${playerLabel(playerId)} turn.`);
  }
  next = triggerTurnStartEffects(next, playerId);
  next = regenerateWillForTurn(next, playerId);
  next = drawUpToHandSize(next, playerId, HAND_LIMIT);
  return next;
}

function rollD20ForLimit(state: MatchState): { state: MatchState; roll: number; rouletteActivated: boolean } {
  let roll = rollDie(state.rngSeed, 20);
  let next: MatchState = log({ ...state, rngSeed: roll.seed }, `[D20_INITIAL_ROLL] ${roll.value}.`);
  let rouletteActivated = false;

  if (isFateRouletteRoll(roll.value) && !next.rouletteUsedThisBattle) {
    const eventRoll = rollDie(next.rngSeed, FATE_ROULETTE_EVENTS.length);
    const event = FATE_ROULETTE_EVENTS[eventRoll.value - 1];
    next = log({ ...next, rngSeed: eventRoll.seed, rouletteUsedThisBattle: true, activeRouletteEvent: event }, `[ROULETTE_STARTED] ${event}.`);
    rouletteActivated = true;
  }

  while (isFateRouletteRoll(roll.value)) {
    roll = rollDie(next.rngSeed, 20);
    next = log({ ...next, rngSeed: roll.seed }, `[D20_LIMIT_REROLL] ${roll.value}.`);
  }

  const limit = getD20PlayLimit(roll.value);
  next = log(next, `[D20_LIMIT_SET] ${limit === "unlimited" ? "unlimited" : limit}.`);

  return { state: next, roll: roll.value, rouletteActivated };
}

export function rollD20(state: MatchState, playerId: PlayerId): MatchState {
  if (state.activePlayerId !== playerId) return log(state, `It is not ${playerLabel(playerId)}'s roll.`);
  if (playerId === "player" && state.phase !== "roll") return log(state, "Player can roll only during roll phase.");
  if (playerId === "enemy" && state.phase !== "enemy") return log(state, "AI can roll only during enemy phase.");

  const started = beginTurnIfNeeded(state, playerId);
  const skip = consumeSkipTurn(started, playerId);
  if (skip.skipped) return endTurn(skip.state, playerId);
  const result = rollD20ForLimit(skip.state);
  const d20Limit = getD20PlayLimit(result.roll);
  const freeCards = result.roll === 20 || result.state.activeRouletteEvent === "WORLD_WITHOUT_WILL";
  let afterRoll: MatchState = {
    ...result.state,
    lastRoll: result.roll,
    currentTurn: {
      playerId,
      d20Limit,
      playsUsed: 0,
      cardsPlayed: 0,
      destroyedOwnCard: false,
      freeCards,
      rouletteResolvedThisTurn: result.rouletteActivated,
      skipDamageApplied: false,
      timerSeconds: BASE_TURN_SECONDS,
      playedCosts: [],
    },
  };

  if (result.state.activeRouletteEvent === "WORLD_WITHOUT_WILL" && result.rouletteActivated) {
    afterRoll = {
      ...afterRoll,
      rouletteOwnerId: playerId,
      rouletteExpiresBeforeOwnerPersonalTurn: (afterRoll[playerId].personalTurnsTaken ?? 0) + 1,
    };
  }

  const afterCombat = checkWinCondition(moveDestroyedCardsToDiscard(resolveFieldCombat(afterRoll, playerId)));
  if (afterCombat.phase === "ended" || afterCombat.phase === "betweenBattles") return afterCombat;

  return log(
    {
      ...afterCombat,
      phase: playerId === "player" ? "main" : "enemy",
    },
    `${playerLabel(playerId)} rolled D20: ${result.roll}. Play limit: ${d20Limit === "unlimited" ? "unlimited" : d20Limit}${freeCards ? ", cards are free this turn" : ""}.`,
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
  const handCardRequested = side.hand.some((candidate) => candidate.instanceId === cardInstanceId);
  if (playBlock.state.activeRouletteEvent === "BLIND_TOP" && handCardRequested) {
    return log(playBlock.state, "[BLIND_TOP] Cards from hand cannot be played while Blind Top is active.");
  }

  const card = side.hand.find((candidate) => candidate.instanceId === cardInstanceId);

  if (!card) return log(state, "Card is not in hand.");

  const turnState = playBlock.state.currentTurn ?? { playerId, d20Limit: "unlimited" as const, playsUsed: 0, cardsPlayed: 0, destroyedOwnCard: false, freeCards: false, skipDamageApplied: false, timerSeconds: BASE_TURN_SECONDS, playedCosts: [] };
  if (turnState.d20Limit !== "unlimited" && turnState.playsUsed >= turnState.d20Limit) return log(state, "D20 play limit has been reached.");

  const printedCost = getCardCost(card);
  const cost = getEffectiveCardCost(playBlock.state, playerId, card);
  if (!canPayWill(side, cost)) {
    return log(state, `Not enough Will for ${getCardTitle(card)}. Needs ${cost}, has ${side.will}.`);
  }

  const ownSlotsKey = slotsKey(playerId);
  const currentSlots = [...playBlock.state.board[ownSlotsKey]];
  const requiresSlot = cardRequiresBoardSlot(card);
  const slotIndex = requiresSlot ? getRequestedOrFreeSlotIndex(playBlock.state, playerId, target) : -1;

  if (requiresSlot && !isValidSlotIndex(slotIndex, currentSlots.length)) {
    return log(state, "Invalid target: no playable slot.");
  }

  if (requiresSlot && currentSlots[slotIndex]) {
    return log(state, `Invalid target: slot ${slotIndex + 1} is occupied.`);
  }

  const ownerPersonalTurn = side.personalTurnsTaken ?? 0;
  const playedCard = { ...normalizePlayedCard(card, state.turn), ownerPersonalTurnPlayed: ownerPersonalTurn, attackReadyFromOwnerPersonalTurn: getCardBoardMaxHp(card) > 0 ? ownerPersonalTurn + 1 : undefined, slotIndex: requiresSlot ? slotIndex : undefined, controllerId: playerId, originalOwnerId: card.originalOwnerId ?? card.ownerId };
  if (requiresSlot) currentSlots[slotIndex] = playedCard;

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

  next = log(next, `${playerLabel(playerId)} played ${getCardTitle(card)}${requiresSlot ? ` on slot ${slotIndex + 1}` : ""} (cost ${printedCost}).`);
  next = log(
    next,
    isCardBoardPermanent(playedCard)
      ? `${getCardTitle(card)} stays on board with ${playedCard.currentHealth}/${getCardBoardMaxHp(playedCard)} HP.`
      : `${getCardTitle(card)} is temporary and will move to discard at end of this turn.`,
  );

  next = resolveCardEffects(next, playerId, playedCard, target, requiresSlot ? slotIndex : undefined);
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

export function cleanupTemporaryCards(state: MatchState, onlyPlayerId?: PlayerId): MatchState {
  let next = state;
  const board = {
    playerSlots: [...state.board.playerSlots],
    enemySlots: [...state.board.enemySlots],
  };

  (onlyPlayerId ? [onlyPlayerId] : (["player", "enemy"] as const)).forEach((playerId) => {
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

  let endingState = cleanupTemporaryCards(state, playerId);
  const turnState = endingState.currentTurn;
  if (turnState?.playerId === playerId && turnState.cardsPlayed === 0 && !turnState.skipDamageApplied) {
    endingState = dealDirectHeroDamage(endingState, playerId, NO_CARD_PENALTY_DAMAGE, "No-card penalty");
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

  return state;
}
