import type { GameAction } from "../core/GameAction";
import type { CardDefinition, CardInstance, MatchState, PlayerId, StartMatchPayload, TargetRef } from "../core/types";
import { runSimpleAI } from "../ai/SimpleAI";
import { loadCardDefinitions } from "../data/cards";
import { resolveCardEffects } from "./EffectResolver";
import { rollDie } from "./Random";
import { canPayWill, gainWillFromRoll, payWill } from "./WillSystem";

const other = (playerId: PlayerId): PlayerId => (playerId === "player" ? "enemy" : "player");
const slotsKey = (playerId: PlayerId) => (playerId === "player" ? "playerSlots" : "enemySlots");
const hasBoardHp = (card: CardInstance) => card.definition.health > 0 || card.currentHealth > 0;

const inst = (definition: CardDefinition, ownerId: PlayerId, index: number): CardInstance => ({
  instanceId: `${ownerId}_${definition.id}_${index}`,
  baseId: definition.id,
  definition,
  currentAttack: definition.attack,
  currentHealth: definition.health,
  ownerId,
});

function log(state: MatchState, message: string): MatchState {
  return { ...state, log: [...state.log, message].slice(-50) };
}

function makeSide(id: PlayerId, defs: CardDefinition[]) {
  const heroDef = defs.find((card) => card.type === "character") ?? loadCardDefinitions()[0];
  const all = defs.filter((card) => card.id !== heroDef.id).map((definition, index) => inst(definition, id, index));
  const bonusCards = all.filter((card) => card.definition.type === "bonus");
  const deck = all.filter((card) => card.definition.type !== "bonus");
  const hero = inst(heroDef, id, 999);

  return {
    id,
    hero,
    hp: heroDef.health || 30,
    maxHp: heroDef.health || 30,
    shield: 0,
    will: 0,
    maxWill: 5,
    deck: deck.slice(5),
    hand: deck.slice(0, 5),
    discard: [],
    bonusCards,
    effects: [],
    lastTurnLostHp: 0,
  };
}

export function createInitialMatchState(payload: StartMatchPayload = {}): MatchState {
  const defs = loadCardDefinitions();
  const playerDeck = payload.playerDeck ?? defs;
  const enemyDeck = payload.enemyDeck ?? defs.map((card) => (card.id === "brian" ? (defs.find((definition) => definition.id === "felix") ?? card) : card));

  return {
    id: `match_${Date.now()}`,
    phase: "roll",
    turn: 1,
    activePlayerId: "player",
    player: makeSide("player", playerDeck),
    enemy: makeSide("enemy", enemyDeck),
    board: { playerSlots: Array(5).fill(null), enemySlots: Array(5).fill(null) },
    stack: [],
    log: ["React TypeScript match started."],
    rngSeed: payload.seed ?? 12345,
  };
}

export const startMatch = createInitialMatchState;

export function dispatch(state: MatchState, action: GameAction): MatchState {
  try {
    if (state.phase === "ended" && action.type !== "START_MATCH") return log(state, "Match already ended.");

    switch (action.type) {
      case "START_MATCH": return startMatch(action.payload);
      case "ROLL_D20": return rollD20(state, action.playerId);
      case "PLAY_CARD": return playCard(state, action.playerId, action.cardInstanceId, action.target);
      case "END_TURN": return endTurn(state, action.playerId);
      case "AI_TURN": return runSimpleAI(state);
      case "CONCEDE": return log({ ...state, phase: "ended", winner: other(action.playerId) }, `${action.playerId} conceded.`);
    }
  } catch (error) {
    return log(state, `Invalid action: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function rollD20(state: MatchState, playerId: PlayerId): MatchState {
  if (state.activePlayerId !== playerId) return log(state, `It is not ${playerId}'s roll.`);
  const roll = rollDie(state.rngSeed, 20);
  return log({
    ...state,
    rngSeed: roll.seed,
    lastRoll: roll.value,
    phase: playerId === "player" ? "main" : "enemy",
    [playerId]: gainWillFromRoll(state[playerId], roll.value),
  }, `${playerId} rolled D20: ${roll.value} and gained Will.`);
}

export function playCard(state: MatchState, playerId: PlayerId, cardInstanceId: string, target?: TargetRef): MatchState {
  if (state.activePlayerId !== playerId) return log(state, `It is not ${playerId}'s turn.`);

  const side = state[playerId];
  const card = side.hand.find((candidate) => candidate.instanceId === cardInstanceId);
  if (!card) return log(state, "Card is not in hand.");
  if (!canPayWill(side, card.definition.cost)) return log(state, `Not enough Will for ${card.definition.title}.`);

  const ownSlotsKey = slotsKey(playerId);
  const requestedSlot = target?.type === "slot" && target.playerId === playerId ? target.slotIndex : undefined;
  const currentSlots = [...state.board[ownSlotsKey]];
  const slotIndex = typeof requestedSlot === "number" ? requestedSlot : currentSlots.findIndex((slot) => !slot);

  if (slotIndex < 0 || slotIndex >= currentSlots.length) return log(state, "Invalid target: no playable slot.");
  if (currentSlots[slotIndex]) return log(state, "Invalid target: slot is occupied.");

  const playedCard: CardInstance = hasBoardHp(card)
    ? { ...card, temporaryUntilRoundEnd: false, playedRound: state.turn }
    : { ...card, temporaryUntilRoundEnd: true, playedRound: state.turn };

  currentSlots[slotIndex] = playedCard;

  let next: MatchState = {
    ...state,
    board: { ...state.board, [ownSlotsKey]: currentSlots },
    [playerId]: {
      ...payWill(side, card.definition.cost),
      hand: side.hand.filter((candidate) => candidate.instanceId !== cardInstanceId),
    },
  };

  next = log(next, `${playerId === "player" ? "Player" : "AI"} played ${card.definition.title}.`);
  next = log(next, hasBoardHp(playedCard)
    ? `${card.definition.title} stays on board with ${playedCard.currentHealth} HP.`
    : `${card.definition.title} will move to discard after round.`);
  next = resolveCardEffects(next, playerId, playedCard);

  return checkWinCondition(next);
}

export function cleanupTemporaryCards(state: MatchState): MatchState {
  let next = state;
  const board = { playerSlots: [...state.board.playerSlots], enemySlots: [...state.board.enemySlots] };

  (["player", "enemy"] as const).forEach((playerId) => {
    const key = slotsKey(playerId);
    const movingToDiscard: CardInstance[] = [];

    board[key] = board[key].map((card) => {
      if (!card?.temporaryUntilRoundEnd) return card;
      movingToDiscard.push({ ...card, temporaryUntilRoundEnd: false });
      return null;
    });

    if (movingToDiscard.length > 0) {
      next = {
        ...next,
        [playerId]: { ...next[playerId], discard: [...next[playerId].discard, ...movingToDiscard] },
      };
      movingToDiscard.forEach((card) => {
        next = log(next, `End of round: ${card.definition.title} moved to discard.`);
      });
    }
  });

  return { ...next, board };
}

export function endTurn(state: MatchState, playerId: PlayerId): MatchState {
  if (state.activePlayerId !== playerId) return log(state, `It is not ${playerId}'s turn.`);

  const nextPlayer = other(playerId);
  let next: MatchState = {
    ...state,
    activePlayerId: nextPlayer,
    phase: nextPlayer === "player" ? "roll" : "enemy",
    turn: playerId === "enemy" ? state.turn + 1 : state.turn,
    [nextPlayer]: { ...state[nextPlayer], lastTurnLostHp: 0 },
  };

  if (playerId === "enemy") next = cleanupTemporaryCards(next);
  return log(next, playerId === "enemy" ? "AI ended turn. Round cleanup complete." : "Player ended turn.");
}

export function checkWinCondition(state: MatchState): MatchState {
  if (state.player.hp <= 0 && state.enemy.hp <= 0) return { ...state, phase: "ended", winner: "draw" };
  if (state.player.hp <= 0) return { ...state, phase: "ended", winner: "enemy" };
  if (state.enemy.hp <= 0) return { ...state, phase: "ended", winner: "player" };
  return state;
}
