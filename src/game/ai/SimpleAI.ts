import type { CardInstance, MatchState } from "../core/types";
import { endTurn, playCard, rollD20 } from "../engine/MatchEngine";
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

function consumeSkipTurn(state: MatchState): { state: MatchState; skipped: boolean } {
  const skip = state.enemy.effects.find((effect) => effect.id === "skip_next_turn");
  if (!skip) return { state, skipped: false };

  return {
    skipped: true,
    state: {
      ...state,
      enemy: {
        ...state.enemy,
        effects: state.enemy.effects.filter((effect) => effect !== skip),
      },
    },
  };
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

function didCardLeaveHand(state: MatchState, cardId: string) {
  return !state.enemy.hand.some((card) => card.instanceId === cardId);
}

export function runSimpleAI(state: MatchState): MatchState {
  if (state.activePlayerId !== "enemy") {
    return addLog(state, "AI skipped: not AI turn.");
  }

  if (state.phase !== "enemy") {
    return addLog(state, "AI skipped: enemy phase is not active.");
  }

  let next = state;

  const skipCheck = consumeSkipTurn(next);
  if (skipCheck.skipped) {
    next = addLog(skipCheck.state, "AI skipped this turn due to an active effect.");
    return endTurn(next, "enemy");
  }

  next = rollD20(next, "enemy");

  let cardsPlayed = 0;

  while (cardsPlayed < AI_MAX_PLAYS_PER_TURN && canPlayerMakeAnyMove(next, "enemy")) {
    const chosen = chooseAiCard(next);
    if (!chosen) {
      next = addLog(
        next,
        cardsPlayed === 0
          ? "AI has no playable cards after D20 roll."
          : "AI has no more playable cards.",
      );
      break;
    }

    const requiresSlot = cardRequiresBoardSlot(chosen);
    const slotIndex = requiresSlot ? getPreferredFreeSlotIndex(next, "enemy") : -1;
    if (requiresSlot && slotIndex < 0) {
      next = addLog(next, "AI cannot play: no free board slots.");
      break;
    }

    const beforeWill = next.enemy.will;
    next = playCard(next, "enemy", chosen.instanceId, requiresSlot ? {
      type: "slot",
      playerId: "enemy",
      slotIndex,
    } as any : undefined);

    if (!didCardLeaveHand(next, chosen.instanceId)) {
      next = addLog(next, `AI failed to play ${getCardTitle(chosen)}.`);
      break;
    }

    cardsPlayed += 1;

    if (beforeWill === next.enemy.will && getCardCost(chosen) > 0) {
      next = addLog(next, `AI warning: ${getCardTitle(chosen)} did not spend Will correctly.`);
      break;
    }

    if (next.phase === "ended") return next;
  }

  if (cardsPlayed > 0) {
    next = addLog(next, `AI played ${cardsPlayed} card${cardsPlayed === 1 ? "" : "s"}.`);
  }

  return endTurn(next, "enemy");
}
