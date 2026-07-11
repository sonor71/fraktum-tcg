import type { CardInstance, MatchState, PlayerId, TargetRef } from "../core/types";

import { BOARD_SIZE } from "./Rules";
export { BOARD_SIZE };

export const otherPlayer = (playerId: PlayerId): PlayerId =>
  playerId === "player" ? "enemy" : "player";

export const slotsKey = (playerId: PlayerId) =>
  playerId === "player" ? "playerSlots" : "enemySlots";

export function playerLabel(playerId: PlayerId) {
  return playerId === "player" ? "Player" : "AI";
}

export function getCardTitle(card: CardInstance) {
  return card.definition.title || card.definition.ruTitle || card.baseId || "Card";
}

export function getCardCost(card: CardInstance) {
  const raw = Number(card.definition.cost ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

export function getCardBoardMaxHp(card: CardInstance) {
  const raw = Number(card.definition.health ?? 0);
  if (!Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

export function getCardCurrentHp(card: CardInstance) {
  const maxHp = getCardBoardMaxHp(card);
  if (maxHp <= 0) return 0;

  const raw = Number(card.currentHealth ?? maxHp);
  if (!Number.isFinite(raw)) return maxHp;
  return Math.max(0, Math.floor(raw));
}

/**
 * FRAKTUM rule:
 * - card.definition.health > 0 => card is a board permanent and stays until HP reaches 0
 * - card.definition.health <= 0 => card is a temporary effect card and leaves during round cleanup
 */
export function isCardBoardPermanent(card: CardInstance) {
  return getCardBoardMaxHp(card) > 0;
}

export function isCardNoHpTemporary(card: CardInstance) {
  return !isCardBoardPermanent(card);
}

export function isTemporaryCard(card: CardInstance | null | undefined) {
  return Boolean(card?.temporaryUntilRoundEnd);
}

export function isValidSlotIndex(slotIndex: unknown, boardSize = BOARD_SIZE): slotIndex is number {
  return (
    typeof slotIndex === "number" &&
    Number.isInteger(slotIndex) &&
    slotIndex >= 0 &&
    slotIndex < boardSize
  );
}

export function getFreeSlotIndex(state: MatchState, playerId: PlayerId) {
  return state.board[slotsKey(playerId)].findIndex((slot) => !slot);
}

export function hasFreeSlot(state: MatchState, playerId: PlayerId) {
  return getFreeSlotIndex(state, playerId) >= 0;
}

export function getOccupiedSlotCount(state: MatchState, playerId: PlayerId) {
  return state.board[slotsKey(playerId)].filter(Boolean).length;
}

export function getRequestedOrFreeSlotIndex(
  state: MatchState,
  playerId: PlayerId,
  target?: TargetRef,
) {
  const currentSlots = state.board[slotsKey(playerId)];
  const requestedSlot =
    target?.type === "slot" &&
    target.playerId === playerId &&
    isValidSlotIndex(target.slotIndex, currentSlots.length)
      ? target.slotIndex
      : undefined;

  return typeof requestedSlot === "number" ? requestedSlot : getFreeSlotIndex(state, playerId);
}

export function canTargetOwnFreeSlot(
  state: MatchState,
  playerId: PlayerId,
  slotIndex: unknown,
) {
  const ownSlots = state.board[slotsKey(playerId)];
  if (!isValidSlotIndex(slotIndex, ownSlots.length)) return false;
  return !ownSlots[slotIndex];
}

export function canPlayerAct(state: MatchState, playerId: PlayerId) {
  if (state.phase === "ended") return false;
  if (state.activePlayerId !== playerId) return false;
  if (playerId === "player") return state.phase === "main" || state.phase === "roll";
  return state.phase === "enemy";
}

export function canPlayerPlayCards(state: MatchState, playerId: PlayerId) {
  if (state.phase === "ended") return false;
  if (state.activePlayerId !== playerId) return false;
  return playerId === "player" ? state.phase === "main" : state.phase === "enemy";
}


export function cardRequiresBoardSlot(card: CardInstance) {
  const explicit = (card.definition as unknown as Record<string, unknown>).requiresBoardSlot;
  if (typeof explicit === "boolean") return explicit;

  // Existing catalog cards use board slots for combat permanents and temporary visible actions.
  // Technical cards may opt out with requiresBoardSlot: false.
  return true;
}

export function getEffectiveCardCost(state: MatchState, playerId: PlayerId, card: CardInstance) {
  const printedCost = getCardCost(card);
  const turn = state.currentTurn;
  const freeByTurn = turn?.playerId === playerId && turn.freeCards;
  const freeByWorldWithoutWill = state.activeRouletteEvent === "WORLD_WITHOUT_WILL";
  return freeByTurn || freeByWorldWithoutWill ? 0 : printedCost;
}

export function canPlayCardWithCurrentResources(state: MatchState, playerId: PlayerId, card: CardInstance) {
  const side = state[playerId];
  if (!canPlayerPlayCards(state, playerId)) return false;
  if (getEffectiveCardCost(state, playerId, card) > side.will) return false;
  if (state.currentTurn?.playerId === playerId && state.currentTurn.d20Limit !== "unlimited" && state.currentTurn.playsUsed >= state.currentTurn.d20Limit) return false;
  if (cardRequiresBoardSlot(card) && !hasFreeSlot(state, playerId)) return false;
  return true;
}

export function canPlayerMakeAnyMove(state: MatchState, playerId: PlayerId) {
  if (!canPlayerPlayCards(state, playerId)) return false;
  if (state[playerId].hand.some((card) => canPlayCardWithCurrentResources(state, playerId, card))) return true;

  const turn = state.currentTurn;
  const canSpendAction = !turn || turn.d20Limit === "unlimited" || turn.playsUsed < turn.d20Limit;
  const canDestroyOwnCard = Boolean(
    turn?.playerId === playerId &&
      !turn.destroyedOwnCard &&
      canSpendAction &&
      state[playerId].will >= 1 &&
      getOccupiedSlotCount(state, playerId) > 0,
  );

  return canDestroyOwnCard;
}

export function getPlayableCards(state: MatchState, playerId: PlayerId) {
  const side = state[playerId];
  if (!canPlayerPlayCards(state, playerId)) return [];

  return side.hand.filter((card) => canPlayCardWithCurrentResources(state, playerId, card));
}

export function getPlayableCardScore(card: CardInstance) {
  const costScore = getCardCost(card) * 100;
  const attackScore = Math.max(0, Number(card.definition.attack ?? 0)) * 10;
  const hpScore = getCardBoardMaxHp(card) * 4;
  const permanentScore = isCardBoardPermanent(card) ? 40 : 0;
  const effectScore = card.definition.effectKey || card.definition.effects?.length ? 24 : 0;

  return costScore + attackScore + hpScore + permanentScore + effectScore;
}

export function getBestPlayableCard(state: MatchState, playerId: PlayerId) {
  return [...getPlayableCards(state, playerId)].sort(
    (a, b) => getPlayableCardScore(b) - getPlayableCardScore(a),
  )[0];
}

export function shouldCleanupAfterTurn(playerId: PlayerId) {
  return playerId === "enemy";
}

export function getNextPlayerAfterTurn(playerId: PlayerId): PlayerId {
  return otherPlayer(playerId);
}

export function getNextPhaseForPlayer(playerId: PlayerId) {
  return playerId === "player" ? "roll" : "enemy";
}

export function describePhase(state: MatchState) {
  if (state.phase === "ended") return "Match ended.";
  if (state.phase === "roll") return "Roll D20.";
  if (state.phase === "main") return "Player main phase.";
  if (state.phase === "enemy") return "AI turn.";
  if (state.phase === "mulligan") return "Mulligan.";
  return String(state.phase);
}

export function countTemporaryCards(state: MatchState, playerId?: PlayerId) {
  if (playerId) {
    return state.board[slotsKey(playerId)].filter(isTemporaryCard).length;
  }

  return (
    state.board.playerSlots.filter(isTemporaryCard).length +
    state.board.enemySlots.filter(isTemporaryCard).length
  );
}

export function findFrontEnemySlot(state: MatchState, playerId: PlayerId, ownSlotIndex?: number) {
  const enemyId = otherPlayer(playerId);
  const slots = state.board[slotsKey(enemyId)];

  if (
    typeof ownSlotIndex === "number" &&
    ownSlotIndex >= 0 &&
    ownSlotIndex < slots.length &&
    slots[ownSlotIndex]
  ) {
    return ownSlotIndex;
  }

  return -1;
}

export function getPreferredFreeSlotIndex(state: MatchState, playerId: PlayerId) {
  const ownSlots = state.board[slotsKey(playerId)];
  const enemySlots = state.board[slotsKey(otherPlayer(playerId))];

  const matchingFrontSlot = enemySlots.findIndex((enemyCard, index) => enemyCard && !ownSlots[index]);
  if (matchingFrontSlot >= 0) return matchingFrontSlot;

  const centerPriority = [2, 3, 1, 4, 0, 5];
  const prioritySlot = centerPriority.find((index) => !ownSlots[index]);
  if (typeof prioritySlot === "number") return prioritySlot;

  return getFreeSlotIndex(state, playerId);
}
