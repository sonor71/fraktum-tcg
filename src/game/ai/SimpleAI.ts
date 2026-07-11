import type { GameAction } from "../core/GameAction";
import type { CardInstance, MatchState } from "../core/types";
import { confirmFateRouletteResult, endTurn, playBlindTopCard, playCard, rollD20 } from "../engine/MatchEngine";
import { getFateRouletteConfirmRemainingMs, spinFateRoulette } from "../engine/FateRoulette";
import {
  canPlayerMakeAnyMove,
  cardRequiresBoardSlot,
  getBestPlayableCard,
  getCardBoardMaxHp,
  getCardCost,
  getCardTitle,
  getPlayableCardScore,
  getPlayableCards,
  getPreferredFreeSlotIndex,
} from "../engine/TurnManager";

const AI_MAX_PLAYS_PER_TURN = 20;

function addLog(state: MatchState, message: string): MatchState {
  return { ...state, log: [...state.log, message].slice(-80) };
}

function cardLooksAggressive(card: CardInstance) {
  const key = card.definition.effectKey ?? "";
  const effects = card.definition.effects ?? [];
  const attack = Number(card.definition.attack ?? 0);

  return (
    attack > 0 ||
    key.includes("damage") ||
    key.includes("attack") ||
    key.includes("lightning") ||
    key.includes("reverse") ||
    effects.some((effect) => effect.op === "damage")
  );
}

function scoreAiCard(card: CardInstance) {
  const base = getPlayableCardScore(card);
  const costEfficiency = getCardCost(card) > 0 ? 12 : 0;
  const aggression = cardLooksAggressive(card) ? 70 : 0;
  const boardPresence = getCardBoardMaxHp(card) > 0 ? 36 : 0;

  return base + costEfficiency + aggression + boardPresence;
}

function chooseAiCard(state: MatchState): CardInstance | undefined {
  const playable = getPlayableCards(state, "enemy");
  if (playable.length === 0) return undefined;

  const bestByScore = [...playable].sort((a, b) => scoreAiCard(b) - scoreAiCard(a))[0];
  return bestByScore ?? getBestPlayableCard(state, "enemy");
}

export function planNextAiAction(state: MatchState): GameAction | null {
  if (state.winner) return null;
  if (state.phase === "roulette") {
    const roulette = state.rouletteState;
    if (!roulette || roulette.ownerId !== "enemy") return null;
    if (roulette.stage === "awaitingSpin") return { type: "SPIN_FATE_ROULETTE", playerId: "enemy", rouletteId: roulette.id };
    if (roulette.stage === "result") {
      if (getFateRouletteConfirmRemainingMs(state, Date.now()) > 0) return null;
      return { type: "CONFIRM_FATE_ROULETTE_RESULT", playerId: "enemy", rouletteId: roulette.id };
    }
    return null;
  }
  if (state.activePlayerId !== "enemy" || state.phase !== "enemy") return null;
  if (!state.currentTurn || state.currentTurn.playerId !== "enemy") return { type: "ROLL_D20", playerId: "enemy" };

  if (state.activeRouletteEvent === "BLIND_TOP") {
    const top = state.sharedDeck?.[0] ?? state.enemy.deck[0];
    if (!top) return { type: "END_TURN", playerId: "enemy" };
    return { type: "PLAY_BLIND_TOP_CARD", playerId: "enemy", target: { type: "slot", playerId: "enemy" } };
  }

  if (!canPlayerMakeAnyMove(state, "enemy")) return { type: "END_TURN", playerId: "enemy" };

  const chosen = chooseAiCard(state);
  if (!chosen) return { type: "END_TURN", playerId: "enemy" };

  const requiresSlot = cardRequiresBoardSlot(chosen);
  const slotIndex = requiresSlot ? getPreferredFreeSlotIndex(state, "enemy") : -1;
  if (requiresSlot && slotIndex < 0) return { type: "END_TURN", playerId: "enemy" };

  return {
    type: "PLAY_CARD",
    playerId: "enemy",
    cardInstanceId: chosen.instanceId,
    target: requiresSlot ? { type: "slot", playerId: "enemy", slotIndex } : undefined,
  };
}

export function runSimpleAI(state: MatchState): MatchState {
  let next = state;
  let safety = AI_MAX_PLAYS_PER_TURN + 3;

  while (safety > 0) {
    safety -= 1;
    const action = planNextAiAction(next);
    if (!action) return next;
    if (action.type === "ROLL_D20") next = rollD20(next, "enemy");
    else if (action.type === "SPIN_FATE_ROULETTE") next = spinFateRoulette(next, "enemy", action.rouletteId);
    else if (action.type === "CONFIRM_FATE_ROULETTE_RESULT") next = confirmFateRouletteResult(next, "enemy", action.rouletteId);
    else if (action.type === "PLAY_BLIND_TOP_CARD") next = playBlindTopCard(next, "enemy", action.target);
    else if (action.type === "PLAY_CARD") {
      const beforeWill = next.enemy.will;
      const chosen = next.enemy.hand.find((card) => card.instanceId === action.cardInstanceId);
      next = playCard(next, "enemy", action.cardInstanceId, action.target);
      if (chosen && beforeWill === next.enemy.will && getCardCost(chosen) > 0 && !next.currentTurn?.freeCards) {
        next = addLog(next, `AI warning: ${getCardTitle(chosen)} did not spend Will correctly.`);
        return next;
      }
    } else if (action.type === "END_TURN") return endTurn(next, "enemy");
    if (next.phase === "ended" || next.phase === "betweenBattles") return next;
  }

  return endTurn(next, "enemy");
}
