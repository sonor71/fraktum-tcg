import type { CardInstance, MatchState, PlayerId } from "../core/types";
import { FATE_ROULETTE_EVENTS, type FateRouletteEvent } from "./Rules";
import { rollDie, shuffleWithSeed } from "./Random";
import { playerLabel } from "./TurnManager";

const LOG_LIMIT = 80;
const ENGINE_EVENT_LIMIT = 200;

export type { FateRouletteEvent };

export const FATE_ROULETTE_SECTOR_COUNT = 5;

export const FATE_ROULETTE_META: Record<FateRouletteEvent, { title: string; shortTitle: string; description: string; duration: string; affects: string; icon: string }> = {
  MERGED_DECKS: {
    title: "СЛИЯНИЕ КОЛОД",
    shortTitle: "КОЛОДЫ",
    description: "Оставшиеся карты обоих игроков объединяются в одну общую колоду и перемешиваются. До конца этого боя оба игрока будут брать карты из общей колоды.",
    duration: "До конца боя",
    affects: "Обе колоды",
    icon: "☍",
  },
  WORLD_WITHOUT_WILL: {
    title: "МИР БЕЗ ВОЛИ",
    shortTitle: "0 ВОЛИ",
    description: "Все карты временно разыгрываются бесплатно. Эффект действует в текущий ход инициатора и следующий ход соперника.",
    duration: "Один полный раунд",
    affects: "Оба игрока",
    icon: "◆",
  },
  BLIND_TOP: {
    title: "СЛЕПАЯ ВЕРШИНА",
    shortTitle: "ВЕРШИНА",
    description: "Карты в руках временно недоступны. Игроки разыгрывают только закрытую верхнюю карту своей или общей колоды. Эффект действует один полный раунд.",
    duration: "Один полный раунд",
    affects: "Обе руки и верх колоды",
    icon: "◈",
  },
  HIDDEN_HAND: {
    title: "СКРЫТАЯ РУКА",
    shortTitle: "РУКА",
    description: "Карты в руках переворачиваются рубашкой вверх. Их названия, стоимость и характеристики скрыты до момента розыгрыша. Эффект действует один полный раунд.",
    duration: "Один полный раунд",
    affects: "Обе руки",
    icon: "◐",
  },
  EMPTY_OUTCOME: {
    title: "ПУСТОЙ ИСХОД",
    shortTitle: "ПУСТОТА",
    description: "Рулетка остановилась на пустом секторе. Ничего не происходит. Ход продолжается по обычным правилам.",
    duration: "Мгновенно",
    affects: "Никого",
    icon: "○",
  },
};

function log(state: MatchState, message: string): MatchState {
  return { ...state, log: [...state.log, message].slice(-LOG_LIMIT) };
}

export function addRouletteEvent(state: MatchState, type: string, message: string, payload?: Record<string, unknown>): MatchState {
  const id = (state.engineEventSequence ?? 0) + 1;
  return {
    ...state,
    engineEventSequence: id,
    structuredEngineEvents: [...(state.structuredEngineEvents ?? []), { id, type, message, payload }].slice(-ENGINE_EVENT_LIMIT),
  };
}

export function createFateRouletteState(state: MatchState, ownerId: PlayerId, triggerRoll: 15 | 16): MatchState {
  const id = `roulette_${state.turn}_${ownerId}_${state.engineEventSequence ?? 0}_${state.rngSeed}`;
  let next: MatchState = {
    ...state,
    phase: "roulette",
    rouletteUsedThisBattle: true,
    rouletteState: { id, ownerId, triggerRoll, stage: "awaitingSpin" },
  };
  next = log(next, `[ROULETTE_TRIGGERED] ${playerLabel(ownerId)} rolled ${triggerRoll}. Fate Roulette awaits spin.`);
  next = addRouletteEvent(next, "ROULETTE_TRIGGERED", `${playerLabel(ownerId)} triggered Fate Roulette with ${triggerRoll}.`, { rouletteId: id, ownerId, triggerRoll });
  next = addRouletteEvent(next, "ROULETTE_AWAITING_SPIN", "Fate Roulette is waiting for the owner to spin.", { rouletteId: id, ownerId });
  return next;
}

export function spinFateRoulette(state: MatchState, playerId: PlayerId, rouletteId: string): MatchState {
  const roulette = state.rouletteState;
  if (!roulette || roulette.id !== rouletteId || roulette.ownerId !== playerId) return log(state, "Only the roulette owner can spin this wheel.");
  if (roulette.stage !== "awaitingSpin") return state;
  const result = rollDie(state.rngSeed, FATE_ROULETTE_EVENTS.length);
  const event = FATE_ROULETTE_EVENTS[result.value - 1];
  const nonceRoll = rollDie(result.seed, 1000000);
  const rotationRoll = rollDie(nonceRoll.seed, 4);
  const resultIndex = result.value - 1;
  const extraRotations = 4 + rotationRoll.value;
  let next: MatchState = {
    ...state,
    rngSeed: rotationRoll.seed,
    rouletteState: { ...roulette, stage: "spinning", event, resultIndex, spinNonce: nonceRoll.value, extraRotations },
  };
  next = log(next, `[ROULETTE_SPIN_STARTED] ${event} index=${resultIndex} rotations=${extraRotations}.`);
  return addRouletteEvent(next, "ROULETTE_SPIN_STARTED", `Fate Roulette spin started: ${event}.`, { rouletteId, ownerId: playerId, event, resultIndex, spinNonce: nonceRoll.value, extraRotations });
}

export function revealFateRouletteResult(state: MatchState, playerId: PlayerId, rouletteId: string): MatchState {
  const roulette = state.rouletteState;
  if (!roulette || roulette.id !== rouletteId || roulette.stage === "result") return state;
  if (roulette.id !== rouletteId) return state;
  if (playerId !== roulette.ownerId && playerId !== "player") return state;
  if (!roulette.event) return state;
  const next: MatchState = { ...state, rouletteState: { ...roulette, stage: "result" } };
  return addRouletteEvent(log(next, `[ROULETTE_RESULT_REVEALED] ${roulette.event}.`), "ROULETTE_RESULT_REVEALED", `Fate Roulette result revealed: ${roulette.event}.`, { rouletteId, event: roulette.event, resultIndex: roulette.resultIndex });
}

function preserveOriginalOwner(card: CardInstance): CardInstance {
  return { ...card, originalOwnerId: card.originalOwnerId ?? card.ownerId };
}

export function applyFateRouletteEvent(state: MatchState, ownerId: PlayerId, event: FateRouletteEvent): MatchState {
  let next = state;
  if (event === "MERGED_DECKS") {
    const merged = shuffleWithSeed([...next.player.deck, ...next.enemy.deck].map(preserveOriginalOwner), next.rngSeed);
    next = {
      ...next,
      rngSeed: merged.seed,
      sharedDeck: merged.items,
      player: { ...next.player, deck: [] },
      enemy: { ...next.enemy, deck: [] },
      activeRouletteEvent: event,
    };
    next = addRouletteEvent(next, "MERGED_DECKS_CREATED", "Both decks were merged into one shared deck.", { count: merged.items.length });
  } else if (event === "WORLD_WITHOUT_WILL" || event === "BLIND_TOP" || event === "HIDDEN_HAND") {
    next = {
      ...next,
      activeRouletteEvent: event,
      rouletteOwnerId: ownerId,
      rouletteExpiresBeforeOwnerPersonalTurn: (next[ownerId].personalTurnsTaken ?? 0) + 1,
      currentTurn: next.currentTurn ? { ...next.currentTurn, freeCards: event === "WORLD_WITHOUT_WILL" ? true : next.currentTurn.freeCards } : next.currentTurn,
    };
    const type = event === "WORLD_WITHOUT_WILL" ? "WORLD_WITHOUT_WILL_STARTED" : event === "BLIND_TOP" ? "BLIND_TOP_STARTED" : "HIDDEN_HAND_STARTED";
    next = addRouletteEvent(next, type, `${event} started for one full round.`, { ownerId, expiresBeforeOwnerPersonalTurn: next.rouletteExpiresBeforeOwnerPersonalTurn });
  } else {
    next = addRouletteEvent(next, "EMPTY_OUTCOME_RESOLVED", "Fate Roulette produced an empty outcome.", { ownerId });
  }
  next = addRouletteEvent(next, "ROULETTE_EFFECT_APPLIED", `Fate Roulette effect applied: ${event}.`, { ownerId, event });
  return log(next, `[ROULETTE_EFFECT_APPLIED] ${event}.`);
}
