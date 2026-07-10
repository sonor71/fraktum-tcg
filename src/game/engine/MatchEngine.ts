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
import { rollDie } from "./Random";
import { canPayWill, gainWillFromRoll, payWill } from "./WillSystem";
import { drawCards } from "./DrawSystem";
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

const STARTING_HAND_SIZE = 5;
const LOG_LIMIT = 80;
const DEFAULT_MAX_WILL = 5;
const DEFAULT_WILL_REGEN_PER_ROUND = 0;

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
  const regenPerRound = Math.max(0, Math.min(10, safeInteger(record.regenPerRound, DEFAULT_WILL_REGEN_PER_ROUND)));

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
    deck: deckCards.slice(STARTING_HAND_SIZE),
    hand: deckCards.slice(0, STARTING_HAND_SIZE),
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
    temporaryUntilRoundEnd: !permanent,
    playedRound: turn,
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

function applyProtocolFractureDamage(state: MatchState, playerId: PlayerId, missingCards: number): MatchState {
  const damage = Math.max(0, Math.floor(missingCards));
  if (damage <= 0) return state;

  const side = state[playerId];
  const hpBefore = Math.max(0, Number(side.hp ?? 0));
  const hpAfter = Math.max(0, hpBefore - damage);
  const actualLostHp = Math.max(0, hpBefore - hpAfter);
  const cardWord = damage === 1 ? "card" : "cards";

  return log(
    {
      ...state,
      [playerId]: {
        ...side,
        hp: hpAfter,
        lastTurnLostHp: Math.max(0, Number(side.lastTurnLostHp ?? 0)) + actualLostHp,
      },
    },
    `[DMG] ${playerLabel(playerId)} failed to draw ${damage} ${cardWord} and took ${damage} Protocol Fracture damage.`,
  );
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
  const missingCards = Math.max(0, cardsNeeded - drawnCount);

  let next: MatchState = { ...state, [playerId]: sideAfter };

  if (drawnCount === 1) {
    const drawnName = drawnCards[0]?.definition.title ?? drawnCards[0]?.definition.ruTitle ?? drawnCards[0]?.baseId ?? "a card";
    next = log(next, `[DRAW] ${playerLabel(playerId)} drew ${drawnName}. Hand is ${sideAfter.hand.length}/${handSize}.`);
  } else if (drawnCount > 1) {
    next = log(next, `[DRAW] ${playerLabel(playerId)} drew ${drawnCount} cards. Hand is ${sideAfter.hand.length}/${handSize}.`);
  }

  if (missingCards > 0) {
    next = applyProtocolFractureDamage(next, playerId, missingCards);
  }

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


function normalizeCompact(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, "")
    : "";
}

function getCardSignature(card: CardInstance | null | undefined) {
  if (!card) return "";
  const definition = readRecord(card.definition);
  return [
    card.baseId,
    card.instanceId,
    definition.id,
    definition.code,
    definition.slug,
    definition.title,
    definition.ruTitle,
    definition.name,
    definition.effectKey,
    definition.description,
    definition.text,
    definition.effectText,
  ].map(normalizeCompact).filter(Boolean).join(" ");
}

function isStunGunCard(card: CardInstance | null | undefined) {
  const signature = getCardSignature(card);
  return ["sgu", "stungun", "sungun", "электрошокер", "электрошок"].some((token) => signature.includes(normalizeCompact(token)));
}

function hasOpponentStunGunAura(state: MatchState, playerId: PlayerId) {
  return state.board[slotsKey(otherPlayer(playerId))].some(isStunGunCard);
}

function applyStunGunWillSuppression(state: MatchState, playerId: PlayerId, rawGain: number, source: "regen" | "roll") {
  const safeGain = Math.max(0, Math.floor(rawGain));
  if (safeGain <= 0) return { state, gain: safeGain };
  if (!hasOpponentStunGunAura(state, playerId)) return { state, gain: safeGain };

  const reduced = Math.max(0, Math.floor(safeGain / 2));
  return {
    state: log(state, `[WILL] Stun Gun suppressed ${playerLabel(playerId)} ${source} Will gain from ${safeGain} to ${reduced}.`),
    gain: reduced,
  };
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

function consumeSkipTurn(state: MatchState, playerId: PlayerId) {
  const effects = getSideEffects(state, playerId);
  const skipEffect = effects.find((effect) => normalizeEffectId(effect.id) === "skip_next_turn");

  if (!skipEffect) return { state, skipped: false };

  return {
    skipped: true,
    state: setSideEffects(state, playerId, effects.filter((effect) => effect !== skipEffect)),
  };
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

function applyWillGainModifiers(state: MatchState, playerId: PlayerId, rawGain: number) {
  const effects = getSideEffects(state, playerId);
  let gain = Math.max(0, Math.floor(rawGain));
  let changed = false;

  const nextEffects = effects.flatMap((effect) => {
    if (normalizeEffectId(effect.id) !== "will_gain_multiplier") return [effect];

    const percent = Math.max(-100, Math.min(500, safeInteger(effect.percent, 0)));
    const multiplier = Math.max(0, 1 + percent / 100);
    gain = Math.max(0, Math.floor(gain * multiplier));
    changed = true;

    const remainingTurns = safeInteger(effect.remainingTurns, 1) - 1;
    if (remainingTurns <= 0) return [];
    return [{ ...effect, remainingTurns }];
  });

  let next = changed
    ? log(setSideEffects(state, playerId, nextEffects), `[WILL] ${playerLabel(playerId)} timed Will gain changed ${rawGain} → ${gain}.`)
    : state;

  const suppressed = applyStunGunWillSuppression(next, playerId, gain, "roll");
  next = suppressed.state;
  gain = suppressed.gain;

  return { state: next, gain };
}

function applyWillRegenAtTurnStart(state: MatchState, playerId: PlayerId): MatchState {
  const side = state[playerId];
  const sideRecord = side as unknown as Record<string, unknown>;
  const rawRegen = Math.max(0, safeInteger(sideRecord.willRegenPerRound, DEFAULT_WILL_REGEN_PER_ROUND));
  const maxWill = Math.max(1, safeInteger(side.maxWill, DEFAULT_MAX_WILL));

  if (rawRegen <= 0 || side.will >= maxWill) return state;

  const suppressed = applyStunGunWillSuppression(state, playerId, rawRegen, "regen");
  const regen = suppressed.gain;
  let next = suppressed.state;

  if (regen <= 0) return next;

  const nextWill = Math.min(maxWill, Math.max(0, side.will) + regen);
  const gained = nextWill - side.will;

  if (gained <= 0) return next;

  return log(
    {
      ...next,
      [playerId]: {
        ...next[playerId],
        will: nextWill,
        maxWill,
        willRegenPerRound: rawRegen,
      },
    },
    `[WILL] ${playerLabel(playerId)} recovered ${gained} Will from upgrades.`,
  );
}

export function createInitialMatchState(payload: StartMatchPayload = {}): MatchState {
  const defs = loadCardDefinitions();
  const payloadRecord = payload as unknown as Record<string, unknown>;
  const playerWillConfig = normalizeWillMatchConfig(payloadRecord.playerWillStats ?? payloadRecord.playerWillConfig);
  const enemyWillConfig = normalizeWillMatchConfig(payloadRecord.enemyWillStats ?? payloadRecord.enemyWillConfig);
  const startingPlayerId: PlayerId = payloadRecord.startingPlayerId === "enemy" ? "enemy" : "player";
  const playerDeck = payload.playerDeck && payload.playerDeck.length > 0 ? payload.playerDeck : defs;
  const enemyDeck =
    payload.enemyDeck && payload.enemyDeck.length > 0
      ? payload.enemyDeck
      : defs.map((card) =>
          card.id === "brian"
            ? defs.find((definition) => definition.id === "felix") ?? card
            : card,
        );

  return {
    id: `match_${Date.now()}`,
    phase: startingPlayerId === "player" ? "roll" : "enemy",
    turn: 1,
    activePlayerId: startingPlayerId,
    player: makeSide("player", playerDeck, defs, playerWillConfig),
    enemy: makeSide("enemy", enemyDeck, defs, enemyWillConfig),
    board: {
      playerSlots: Array<CardInstance | null>(BOARD_SIZE).fill(null),
      enemySlots: Array<CardInstance | null>(BOARD_SIZE).fill(null),
    },
    stack: [],
    log: [
      "React TypeScript match started.",
      payload.playerDeck && payload.playerDeck.length > 0
        ? `Player deck loaded from saved deck: ${playerDeck.length} cards.`
        : "Player deck fallback loaded from default card pool.",
      "Bonus cards were assigned to hero slots.",
      `Player Will upgrades: max ${playerWillConfig.maxWill}, regen +${playerWillConfig.regenPerRound}/round.`,
      startingPlayerId === "player" ? "Player starts in roll phase." : "Opponent starts in roll phase.",
    ],
    rngSeed: payload.seed ?? 12345,
  };
}

export const startMatch = createInitialMatchState;

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

export function rollD20(state: MatchState, playerId: PlayerId): MatchState {
  if (state.activePlayerId !== playerId) {
    return log(state, `It is not ${playerLabel(playerId)}'s roll.`);
  }

  if (playerId === "player" && state.phase !== "roll") {
    return log(state, "Player can roll only during roll phase.");
  }

  if (playerId === "enemy" && state.phase !== "enemy") {
    return log(state, "AI can roll only during enemy phase.");
  }

  // Important UX rule:
  // temporary no-HP cards remain visible after AI turn,
  // then cleanup happens when the player starts the next round by rolling D20.
  const afterCleanupState = playerId === "player" ? cleanupTemporaryCards(state) : state;

  // Will Regen is a round-start stat, so it must happen before the D20 roll.
  // This also makes the first player roll correctly start with upgraded Will.
  const baseState = applyWillRegenAtTurnStart(afterCleanupState, playerId);

  const roll = rollDie(baseState.rngSeed, 20);
  const sideBefore = baseState[playerId];
  const rawSideAfter = gainWillFromRoll(sideBefore, roll.value);
  const rawGained = Math.max(0, rawSideAfter.will - sideBefore.will);
  const modifiedGain = applyWillGainModifiers({ ...baseState, rngSeed: roll.seed }, playerId, rawGained);
  const modifiedSideBefore = modifiedGain.state[playerId];
  const gained = modifiedGain.gain;
  const sideAfter = {
    ...modifiedSideBefore,
    will: Math.min(Math.max(1, modifiedSideBefore.maxWill), Math.max(0, modifiedSideBefore.will) + gained),
  };

  return log(
    {
      ...modifiedGain.state,
      rngSeed: roll.seed,
      lastRoll: roll.value,
      phase: playerId === "player" ? "main" : "enemy",
      [playerId]: sideAfter,
    },
    `${playerLabel(playerId)} rolled D20: ${roll.value} and gained ${gained} Will.`,
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

  const cost = getCardCost(card);
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

  const playedCard = normalizePlayedCard(card, state.turn);
  currentSlots[slotIndex] = playedCard;

  const paidSide = payWill(side, cost);
  let next: MatchState = {
    ...playBlock.state,
    board: { ...playBlock.state.board, [ownSlotsKey]: currentSlots },
    [playerId]: {
      ...paidSide,
      hand: removeFromHand(side.hand, cardInstanceId),
    },
  };

  next = log(next, `${playerLabel(playerId)} played ${getCardTitle(card)} on slot ${slotIndex + 1}.`);
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

  const nextPlayer = otherPlayer(playerId);
  let next: MatchState = {
    ...state,
    activePlayerId: nextPlayer,
    phase: nextPlayer === "player" ? "roll" : "enemy",
    turn: playerId === "enemy" ? state.turn + 1 : state.turn,
    [nextPlayer]: {
      ...state[nextPlayer],
      lastTurnLostHp: 0,
    },
  };

  next = triggerTurnStartEffects(next, nextPlayer);
  const skipCheck = consumeSkipTurn(next, nextPlayer);

  if (skipCheck.skipped) {
    const afterSkipPlayer = playerId;
    let afterSkip: MatchState = {
      ...skipCheck.state,
      activePlayerId: afterSkipPlayer,
      phase: afterSkipPlayer === "player" ? "roll" : "enemy",
      turn: nextPlayer === "enemy" ? state.turn + 1 : state.turn,
      [afterSkipPlayer]: {
        ...skipCheck.state[afterSkipPlayer],
        lastTurnLostHp: 0,
      },
    };

    afterSkip = drawUpToHandSize(afterSkip, afterSkipPlayer);
    afterSkip = log(afterSkip, `${playerLabel(nextPlayer)} skipped turn.`);
    return checkWinCondition(afterSkip);
  }

  // Do not cleanup temporary cards or apply Will regen here.
  // React must have time to render AI temporary cards on board after AI ends turn.
  // Will regen is applied when that side actually starts its roll.
  next = drawUpToHandSize(skipCheck.state, nextPlayer);

  next = log(
    next,
    playerId === "enemy"
      ? "AI ended turn. Temporary cards remain on board until the next player D20 roll."
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

  if (playerHp > enemyHp) {
    return log(
      { ...state, phase: "ended", winner: "player" },
      `${reason} Player has more HP (${playerHp} vs ${enemyHp}) and wins.`,
    );
  }

  if (enemyHp > playerHp) {
    return log(
      { ...state, phase: "ended", winner: "enemy" },
      `${reason} AI has more HP (${enemyHp} vs ${playerHp}) and wins.`,
    );
  }

  return log(
    { ...state, phase: "ended", winner: "draw" },
    `${reason} HP is tied (${playerHp} vs ${enemyHp}). Draw.`,
  );
}

export function checkWinCondition(state: MatchState): MatchState {
  if (state.player.hp <= 0 && state.enemy.hp <= 0) {
    return finishByHpComparison(state, "Both heroes fell.");
  }

  if (state.player.hp <= 0) {
    return log({ ...state, phase: "ended", winner: "enemy" }, "Player hero fell. AI wins.");
  }

  if (state.enemy.hp <= 0) {
    return log({ ...state, phase: "ended", winner: "player" }, "Enemy hero fell. Player wins.");
  }

  if (hasNoCardsToContinue(state, "player") && hasNoCardsToContinue(state, "enemy")) {
    return finishByHpComparison(state, "Both players have no cards left in hand or deck.");
  }

  return state;
}
