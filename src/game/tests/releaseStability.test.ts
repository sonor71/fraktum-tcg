import { describe, expect, it } from "vitest";
import type { CardDefinition, CardInstance, MatchState, PlayerId } from "../core/types";
import { runSimpleAI } from "../ai/SimpleAI";
import { createInitialMatchState, endTurn, playCard } from "../engine/MatchEngine";
import { BOARD_SIZE } from "../engine/Rules";
import { canPlayerMakeAnyMove } from "../engine/TurnManager";

const def = (id: string, partial: Partial<CardDefinition> = {}): CardDefinition => ({
  id,
  title: id,
  type: "event",
  rarity: "common",
  cost: 1,
  attack: 0,
  health: 0,
  description: "",
  image: "/cards/test.png",
  ...partial,
});

const inst = (definition: CardDefinition, ownerId: PlayerId, n = 0): CardInstance => ({
  instanceId: `${ownerId}_${definition.id}_${n}`,
  baseId: definition.id,
  definition,
  currentAttack: definition.attack,
  currentHealth: definition.health,
  ownerId,
  originalOwnerId: ownerId,
  controllerId: ownerId,
});

function withMain(state: MatchState, playerId: PlayerId): MatchState {
  return {
    ...state,
    activePlayerId: playerId,
    phase: playerId === "player" ? "main" : "enemy",
    currentTurn: {
      playerId,
      d20Limit: "unlimited",
      playsUsed: 0,
      cardsPlayed: 0,
      destroyedOwnCard: false,
      freeCards: false,
      skipDamageApplied: false,
      timerSeconds: 60,
      playedCosts: [],
    },
  };
}

describe("release match stability", () => {
  it("uses exactly five board slots for both sides", () => {
    const state = createInitialMatchState({ seed: 42 });
    expect(BOARD_SIZE).toBe(5);
    expect(state.board.playerSlots).toHaveLength(5);
    expect(state.board.enemySlots).toHaveLength(5);
  });

  it("canPlayerMakeAnyMove respects Will, free slots, and no-slot effects", () => {
    const slotCard = inst(def("slot", { cost: 1, requiresBoardSlot: true }), "player");
    const noSlotEffect = inst(def("effect", { cost: 1, requiresBoardSlot: false }), "player");
    const blocker = inst(def("block", { health: 1 }), "player");
    let state = withMain(createInitialMatchState(), "player");

    state = {
      ...state,
      player: { ...state.player, will: 1, hand: [slotCard] },
      board: { ...state.board, playerSlots: Array(BOARD_SIZE).fill(blocker) },
    };
    expect(canPlayerMakeAnyMove({ ...state, currentTurn: { ...state.currentTurn!, destroyedOwnCard: true } }, "player")).toBe(false);

    state = { ...state, player: { ...state.player, will: 1, hand: [noSlotEffect] } };
    expect(canPlayerMakeAnyMove(state, "player")).toBe(true);

    state = { ...state, player: { ...state.player, will: 0, hand: [noSlotEffect] } };
    expect(canPlayerMakeAnyMove({ ...state, currentTurn: { ...state.currentTurn!, destroyedOwnCard: true } }, "player")).toBe(false);
  });

  it("manual end turn passes initiative when player could still play", () => {
    const card = inst(def("cheap", { cost: 1 }), "player");
    const state = withMain(createInitialMatchState(), "player");
    const next = endTurn({ ...state, player: { ...state.player, will: 5, hand: [card] } }, "player");
    expect(next.activePlayerId).toBe("enemy");
  });

  it("AI played temporary cards remain visible on enemy board after AI turn", () => {
    const card = inst(def("ai_temp", { cost: 1, health: 0, requiresBoardSlot: true }), "enemy");
    let state = createInitialMatchState({ seed: 7 });
    state = withMain(state, "enemy");
    state = { ...state, enemy: { ...state.enemy, will: 5, hand: [card] } };

    const played = playCard(state, "enemy", card.instanceId, { type: "slot", playerId: "enemy", slotIndex: 0 });
    const ended = endTurn(played, "enemy");
    expect(ended.board.enemySlots[0]?.instanceId).toBe(card.instanceId);
  });

  it("AI can play visible cards through its normal turn flow", () => {
    const card = inst(def("ai_unit", { cost: 1, health: 2, attack: 1, requiresBoardSlot: true }), "enemy");
    let state = createInitialMatchState({ seed: 9 });
    state = { ...state, activePlayerId: "enemy", phase: "enemy", enemy: { ...state.enemy, will: 5, hand: [card], deck: [] } };
    const next = runSimpleAI(state);
    expect(next.enemy.discard.some((discarded) => discarded.instanceId === card.instanceId) || next.board.enemySlots.some((slot) => slot?.instanceId === card.instanceId)).toBe(true);
  });
});
