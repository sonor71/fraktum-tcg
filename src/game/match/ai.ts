import type { MatchAction, MatchCard, MatchState, UnitState } from "./types";

function getSide(state: MatchState, owner: "player" | "ai") {
  return owner === "player" ? state.player : state.ai;
}

function getEnemyOwner(owner: "player" | "ai") {
  return owner === "player" ? "ai" : "player";
}

function getPlayCost(state: MatchState, card: MatchCard, free = false) {
  return free ? 0 : card.willCost * state.turn.willMultiplier;
}

function canStillPlay(state: MatchState) {
  return state.turn.playLimit === null || state.turn.playsMade < state.turn.playLimit;
}

function scoreCard(state: MatchState, card: MatchCard, free = false) {
  const cost = getPlayCost(state, card, free);
  const base = card.kind === "character"
    ? (card.attack ?? 0) * 2 + (card.health ?? 0) * 1.4
    : card.kind === "effect"
      ? 5.5
      : card.kind === "tactic"
        ? 5
        : 4.5;

  return base + (free ? 3 : 0) - cost * 0.3;
}

function getAffordableBestCard(state: MatchState, cards: MatchCard[], free = false) {
  const owner = state.activePlayer;
  const side = getSide(state, owner);

  return cards
    .filter((card) => {
      if (card.kind === "character" && side.board.length >= 5) return false;
      return side.will >= getPlayCost(state, card, free);
    })
    .sort((left, right) => scoreCard(state, right, free) - scoreCard(state, left, free))[0] ?? null;
}

function getBestAttackTarget(attacker: UnitState, enemyBoard: UnitState[]) {
  const killable = enemyBoard
    .filter((unit) => unit.health <= attacker.attack)
    .sort((left, right) => {
      const leftScore = left.attack + left.health;
      const rightScore = right.attack + right.health;
      return rightScore - leftScore;
    });

  const safeKill = killable.find((unit) => unit.attack < attacker.health);
  if (safeKill) {
    return { kind: "unit" as const, unitId: safeKill.instanceId };
  }

  if (killable[0]) {
    return { kind: "unit" as const, unitId: killable[0].instanceId };
  }

  const threatening = enemyBoard
    .slice()
    .sort((left, right) => (right.attack + right.health) - (left.attack + left.health))[0];

  if (threatening && threatening.attack >= attacker.health) {
    return { kind: "unit" as const, unitId: threatening.instanceId };
  }

  return { kind: "hero" as const };
}

export function getNextAiAction(state: MatchState): MatchAction {
  const owner = "ai" as const;
  if (state.phase !== "ai_turn" || state.activePlayer !== owner || state.winner) {
    return { type: "END_TURN", owner };
  }

  const side = getSide(state, owner);
  const enemySide = getSide(state, getEnemyOwner(owner));

  if (canStillPlay(state)) {
    if (state.turn.awakeningFreePlayAvailable) {
      const bestFree = getAffordableBestCard(state, [...side.hand, ...side.graveyard], true);
      if (bestFree) {
        const source = side.hand.some((card) => card.instanceId === bestFree.instanceId) ? "hand" : "graveyard";
        return {
          type: "PLAY_CARD",
          owner,
          source,
          cardInstanceId: bestFree.instanceId,
          free: true,
        };
      }

      if (state.turn.awakeningPassiveAvailable) {
        return { type: "USE_AWAKENING_PASSIVE", owner };
      }
    }

    if (state.turn.enemyDeckPlayCardId) {
      const blindCard = findBlindCard(state, state.turn.enemyDeckPlayCardId);
      if (blindCard && side.will >= getPlayCost(state, blindCard, false)) {
        return {
          type: "PLAY_CARD",
          owner,
          source: "enemy_deck",
          cardInstanceId: blindCard.instanceId,
        };
      }
    }

    if (state.turn.graveyardPlayAvailable) {
      const bestGrave = getAffordableBestCard(state, side.graveyard, false);
      if (bestGrave) {
        return {
          type: "PLAY_CARD",
          owner,
          source: "graveyard",
          cardInstanceId: bestGrave.instanceId,
        };
      }
    }

    const bestHandCard = getAffordableBestCard(state, side.hand, false);
    if (bestHandCard) {
      return {
        type: "PLAY_CARD",
        owner,
        source: "hand",
        cardInstanceId: bestHandCard.instanceId,
      };
    }
  }

  const readyAttacker = side.board
    .filter((unit) => !unit.exhausted)
    .sort((left, right) => (right.attack + right.health) - (left.attack + left.health))[0];

  if (readyAttacker) {
    return {
      type: "ATTACK",
      owner,
      attackerId: readyAttacker.instanceId,
      target: getBestAttackTarget(readyAttacker, enemySide.board),
    };
  }

  if (state.turn.awakeningPassiveAvailable) {
    return { type: "USE_AWAKENING_PASSIVE", owner };
  }

  return { type: "END_TURN", owner };
}

function findBlindCard(state: MatchState, instanceId: string) {
  const enemySide = state.player;
  return enemySide.deck.find((card) => card.instanceId === instanceId)
    ?? state.sharedDeck.cards.find((card) => card.instanceId === instanceId)
    ?? null;
}
