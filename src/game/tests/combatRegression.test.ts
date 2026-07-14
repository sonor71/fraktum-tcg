import { describe, expect, it } from "vitest";
import type { CardDefinition, CardInstance, MatchState, PlayerId } from "../core/types";
import { resolveCardEffects } from "../engine/EffectResolver";
import { resolveFieldCombat } from "../engine/DamageSystem";
import { createInitialMatchState, dispatch, endTurn, playCard, checkWinCondition } from "../engine/MatchEngine";
import { BOARD_SIZE } from "../engine/Rules";

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

function active(state: MatchState, playerId: PlayerId): MatchState {
  return {
    ...state,
    activePlayerId: playerId,
    phase: playerId === "player" ? "main" : "enemy",
    currentTurn: { playerId, d20Limit: "unlimited", playsUsed: 0, cardsPlayed: 0, destroyedOwnCard: false, freeCards: false, skipDamageApplied: false, timerSeconds: 60, playedCosts: [] },
  };
}

const unitDef = (id: string, attack = 3, health = 4) => def(id, { type: "attack", requiresBoardSlot: true, attack, health });

describe("combat readiness and strict lanes", () => {
  it("new player card skips the opponent turn and attacks on the next owner turn", () => {
    const sword = inst(unitDef("energy_sword_test", 4, 4), "player");
    let state = active(createInitialMatchState({ seed: 100, startingPlayerId: "player" }), "player");
    state = { ...state, player: { ...state.player, will: 5, hand: [sword], deck: [] } };

    const played = playCard(state, "player", sword.instanceId, { type: "slot", playerId: "player", slotIndex: 2 });
    const afterPlayerEnd = endTurn({ ...played, currentTurn: { ...played.currentTurn!, cardsPlayed: 1 } }, "player");
    const enemyCombat = resolveFieldCombat(afterPlayerEnd, "enemy");
    expect(enemyCombat.enemy.hp).toBe(afterPlayerEnd.enemy.hp);

    const ownerCombat = resolveFieldCombat({ ...enemyCombat, activePlayerId: "player", phase: "main" }, "player");
    expect(ownerCombat.enemy.hp).toBeLessThan(enemyCombat.enemy.hp);
  });

  it("new enemy card skips the player turn and attacks on the next enemy turn", () => {
    const sword = inst(unitDef("ai_sword_test", 4, 4), "enemy");
    let state = active(createInitialMatchState({ seed: 101, startingPlayerId: "enemy" }), "enemy");
    state = { ...state, enemy: { ...state.enemy, will: 5, hand: [sword], deck: [] } };

    const played = playCard(state, "enemy", sword.instanceId, { type: "slot", playerId: "enemy", slotIndex: 1 });
    const afterEnemyEnd = endTurn({ ...played, currentTurn: { ...played.currentTurn!, cardsPlayed: 1 } }, "enemy");
    const playerCombat = resolveFieldCombat(afterEnemyEnd, "player");
    expect(playerCombat.player.hp).toBe(afterEnemyEnd.player.hp);

    const enemyCombat = resolveFieldCombat({ ...playerCombat, activePlayerId: "enemy", phase: "enemy" }, "enemy");
    expect(enemyCombat.player.hp).toBeLessThan(playerCombat.player.hp);
  });

  it("old ready cards still fight simultaneously and destroyed declared attackers finish their attack", () => {
    const fragile = { ...inst(unitDef("fragile", 5, 1), "player"), attackReadyFromOwnerPersonalTurn: 0 };
    const crusher = { ...inst(unitDef("crusher", 3, 4), "enemy"), attackReadyFromOwnerPersonalTurn: 0 };
    const state = {
      ...createInitialMatchState({ seed: 102 }),
      player: { ...createInitialMatchState({ seed: 102 }).player, personalTurnsTaken: 2 },
      enemy: { ...createInitialMatchState({ seed: 102 }).enemy, personalTurnsTaken: 2 },
      board: { playerSlots: [fragile, null, null, null, null], enemySlots: [crusher, null, null, null, null] },
    };

    const next = resolveFieldCombat(state, "player");
    expect(next.board.playerSlots[0]?.currentHealth).toBe(0);
    expect(next.board.enemySlots[0]?.currentHealth).toBeLessThan(crusher.currentHealth);
  });

  it("slot 3 attacks hero when only slot 5 is occupied", () => {
    const attacker = { ...inst(unitDef("lane_attacker", 3, 4), "player"), attackReadyFromOwnerPersonalTurn: 0 };
    const offlane = { ...inst(unitDef("offlane", 0, 8), "enemy"), attackReadyFromOwnerPersonalTurn: 0 };
    const state = { ...createInitialMatchState({ seed: 103 }), board: { playerSlots: [null, null, attacker, null, null], enemySlots: [null, null, null, null, offlane] } };

    const next = resolveFieldCombat(state, "player");
    expect(next.enemy.hp).toBe(state.enemy.hp - 3);
    expect(next.board.enemySlots[4]?.currentHealth).toBe(offlane.currentHealth);
  });

  it("slot 3 attacks slot 3 and overflow reaches hero", () => {
    const attacker = { ...inst(unitDef("lane_attacker", 7, 4), "player"), attackReadyFromOwnerPersonalTurn: 0 };
    const blocker = { ...inst(unitDef("blocker", 0, 4), "enemy"), attackReadyFromOwnerPersonalTurn: 0 };
    const state = { ...createInitialMatchState({ seed: 104 }), board: { playerSlots: [null, null, attacker, null, null], enemySlots: [null, null, blocker, null, null] } };

    const next = resolveFieldCombat(state, "player");
    expect(next.board.enemySlots[2]?.currentHealth).toBe(0);
    expect(next.enemy.hp).toBe(state.enemy.hp - 3);
  });

  it("frontEnemy effects do not fallback to another lane, while random and selected targets can", () => {
    const front = inst(def("front", { effects: [{ op: "damage", amount: 3, target: "frontEnemy" }] }), "player");
    const random = inst(def("random", { effects: [{ op: "randomDamage", min: 1, max: 1 }] }), "player");
    const selected = inst(def("selected", { effects: [{ op: "damage", amount: 2, target: "enemy" }] }), "player");
    const far = inst(unitDef("far", 0, 5), "enemy");
    const initial = createInitialMatchState({ seed: 105 });
    const base = { ...initial, enemy: { ...initial.enemy, hand: [], deck: [] }, board: { playerSlots: Array<CardInstance | null>(BOARD_SIZE).fill(null), enemySlots: [null, null, null, null, far] } };

    const fronted = resolveCardEffects(base, "player", front, undefined, 2);
    expect(fronted.enemy.hp).toBeLessThan(base.enemy.hp);
    expect(fronted.board.enemySlots[4]?.currentHealth).toBe(far.currentHealth);

    const randomed = resolveCardEffects({ ...base, rngSeed: 1 }, "player", random, undefined, 2);
    expect(randomed.enemy.hp < base.enemy.hp || randomed.board.enemySlots[4]?.currentHealth !== far.currentHealth).toBe(true);

    const targeted = resolveCardEffects(base, "player", selected, { type: "slot", playerId: "enemy", slotIndex: 4 }, 2);
    expect(targeted.board.enemySlots[4]?.currentHealth).toBeLessThan(far.currentHealth);
  });
});

describe("Time of Reckoning", () => {
  const time = (owner: PlayerId) => inst(def("time_of_reckoning", { title: "Time of Reckoning", type: "tactic", rarity: "chromatic", cost: 6, effects: [{ op: "modifyWill", amount: 99, target: "self" }] }), owner);

  it("AI Time of Reckoning pays its chromatic cost, halves player Will and damages player HP", () => {
    let state = active(createInitialMatchState({ seed: 201, startingPlayerId: "enemy" }), "enemy");
    const card = time("enemy");
    state = { ...state, player: { ...state.player, will: 5, hp: 20 }, enemy: { ...state.enemy, will: 10, maxWill: 10, hand: [card], deck: [] } };

    const next = playCard(state, "enemy", card.instanceId);
    expect(next.player.will).toBe(2);
    expect(next.enemy.will).toBe(4);
    expect(next.player.hp).toBe(15);
    expect(next.enemy.will).toBeLessThanOrEqual(state.enemy.will);
  });

  it("player Time of Reckoning targets enemy, never increases Will, and clamps at zero", () => {
    let state = active(createInitialMatchState({ seed: 202, startingPlayerId: "player" }), "player");
    const card = time("player");
    state = { ...state, player: { ...state.player, will: 10, maxWill: 10, hand: [card], deck: [] }, enemy: { ...state.enemy, will: 1, hp: 20 } };

    const next = playCard(state, "player", card.instanceId);
    expect(next.enemy.will).toBe(0);
    expect(next.enemy.hp).toBe(15);
    expect(next.player.will).toBe(4);
  });
});

describe("series structured events", () => {
  it("records one structured BATTLE_ENDED per battle through a three-battle series", () => {
    let state = createInitialMatchState({ seed: 301, startingPlayerId: "player" });
    state = checkWinCondition({ ...state, enemy: { ...state.enemy, hp: 0 } });
    state = dispatch(state, { type: "START_NEXT_BATTLE", battleNumber: state.battleNumber });
    state = checkWinCondition({ ...state, player: { ...state.player, hp: 0 } });
    state = dispatch(state, { type: "START_NEXT_BATTLE", battleNumber: state.battleNumber });
    state = checkWinCondition({ ...state, enemy: { ...state.enemy, hp: 0 }, seriesScore: { player: 1, enemy: 1 } });

    expect(state.structuredEngineEvents?.filter((event) => event.type === "BATTLE_ENDED")).toHaveLength(3);
  });
});
