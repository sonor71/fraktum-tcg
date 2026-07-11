import { describe, expect, it } from "vitest";
import type { CardDefinition, CardInstance, MatchState, PlayerId } from "../core/types";
import { getBonusPercent, scaleByElementBonus } from "../engine/BonusSystem";
import { damageHero, resolveFieldCombat } from "../engine/DamageSystem";
import { drawCards } from "../engine/DrawSystem";
import { createInitialMatchState, destroyOwnCard, endTurn, playCard, resolveCaduceusBattleDraw, rollD20 } from "../engine/MatchEngine";
import { BOARD_SIZE, clampTimerSeconds, getD20PlayLimit } from "../engine/Rules";

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
function withTurn(state: MatchState, playerId: PlayerId, limit: number | "unlimited" = "unlimited") {
  return { ...state, activePlayerId: playerId, phase: playerId === "player" ? "main" : "enemy", currentTurn: { playerId, d20Limit: limit, playsUsed: 0, cardsPlayed: 0, destroyedOwnCard: false, freeCards: false, skipDamageApplied: false, timerSeconds: 60, playedCosts: [] } } as MatchState;
}

describe("FRAKTUM Match Rules v1.0", () => {
  it("1 rerolls tied initiative", () => {
    const state = createInitialMatchState({ seed: 5 });
    expect(state.initiativeRolls?.length).toBeGreaterThanOrEqual(1);
    expect(state.initiativeRolls?.at(-1)?.player).not.toBe(state.initiativeRolls?.at(-1)?.enemy);
  });
  it("2 first player starts with maxWill - 2", () => {
    const state = createInitialMatchState({ seed: 1 });
    expect(state[state.activePlayerId].will).toBe(state[state.activePlayerId].maxWill - 2);
  });
  it("3 first personal turn does not regenerate Will", () => {
    let state = createInitialMatchState({ seed: 1 });
    const active = state.activePlayerId;
    const before = state[active].will;
    state = rollD20(state, active);
    expect(state[active].will).toBe(before);
  });
  it("4 second personal turn regenerates Will", () => {
    let state = createInitialMatchState({ seed: 1 });
    const active = state.activePlayerId;
    state = withTurn(state, active);
    state = endTurn(state, active);
    const other = state.activePlayerId;
    state = withTurn(state, other);
    state = endTurn(state, other);
    const before = state[active].will;
    state = rollD20(state, active);
    expect(state[active].will).toBeGreaterThan(before);
  });
  it("5 draws exactly to seven and no overdraw", () => {
    const card = def("c");
    const side = { ...createInitialMatchState().player, hand: [inst(card, "player")], deck: Array.from({ length: 10 }, (_, i) => inst(card, "player", i + 1)) };
    expect(drawCards(side, 99).hand).toHaveLength(7);
  });
  it("6-8 D20 limits match the spec", () => {
    expect(getD20PlayLimit(1)).toBe(1);
    expect(getD20PlayLimit(6)).toBe(6);
    expect(getD20PlayLimit(7)).toBe("unlimited");
  });
  it("9-11 roulette triggers per turn and rerolls 15-16 for a limit", () => {
    let state = createInitialMatchState({ seed: 31 });
    state = { ...state, rngSeed: 1198, activePlayerId: "player", phase: "roll" };
    const next = rollD20(state, "player");
    expect(next.currentTurn?.rouletteResolvedThisTurn).toBe(true);
    expect(next.activeRouletteEvent).toBeDefined();
    expect(next.lastRoll).not.toBe(15);
    const again = rollD20({ ...next, phase: "roll", rngSeed: 1198 }, "player");
    expect(again.log.filter((l) => l.includes("Fate Roulette activated"))).toHaveLength(1);
  });
  it("12 D20=20 does not make cards free; WORLD_WITHOUT_WILL does", () => {
    const card = inst(def("free", { cost: 5 }), "player");
    let state = withTurn(createInitialMatchState(), "player");
    state = { ...state, player: { ...state.player, will: 0, hand: [card] }, lastRoll: 20, currentTurn: { ...state.currentTurn!, freeCards: false } };
    expect(playCard(state, "player", card.instanceId, { type: "slot", playerId: "player", slotIndex: 0 }).player.hand).toHaveLength(1);
    state = { ...state, currentTurn: { ...state.currentTurn!, freeCards: true } };
    const played = playCard(state, "player", card.instanceId, { type: "slot", playerId: "player", slotIndex: 0 });
    expect(played.player.will).toBe(0);
    expect(played.currentTurn?.playedCosts[0].cost).toBe(5);
    expect(endTurn(played, "player").currentTurn).toBeUndefined();
  });
  it("13-14 new HP card attacks from next own turn only", () => {
    const unit = inst(def("unit", { attack: 3, health: 4 }), "player");
    let state = withTurn(createInitialMatchState(), "player");
    state = { ...state, player: { ...state.player, will: 5, hand: [unit] } };
    const played = playCard(state, "player", unit.instanceId, { type: "slot", playerId: "player", slotIndex: 0 });
    expect(resolveFieldCombat(played, "player").enemy.hp).toBe(played.enemy.hp);
    expect(resolveFieldCombat({ ...played, turn: played.turn + 1 }, "player").enemy.hp).toBeLessThan(played.enemy.hp);
  });
  it("15-17 line combat is simultaneous, defensive cards do not counter, overflow hits hero", () => {
    const a = inst(def("a", { attack: 7, health: 4 }), "player");
    const d = inst(def("d", { attack: 0, health: 4 }), "enemy");
    let state = createInitialMatchState();
    state = { ...state, turn: 2, board: { playerSlots: [a, null, null, null, null], enemySlots: [d, null, null, null, null] } };
    const next = resolveFieldCombat(state, "player");
    expect(next.enemy.hp).toBe(state.enemy.hp - 3);
    expect(next.player.hp).toBe(state.player.hp);
  });
  it("18-19 one-shot cards require a free slot", () => {
    const one = inst(def("one", { health: 0 }), "player");
    let state = withTurn(createInitialMatchState(), "player");
    state = { ...state, player: { ...state.player, will: 5, hand: [one] }, board: { ...state.board, playerSlots: Array(BOARD_SIZE).fill(inst(def("block", { health: 1 }), "player")) } };
    expect(playCard(state, "player", one.instanceId).player.hand).toContain(one);
  });
  it("20-22 voluntary destroy costs Will/limit and frees slot", () => {
    const unit = inst(def("unit", { health: 3 }), "player");
    let state = withTurn(createInitialMatchState(), "player", 1);
    state = { ...state, player: { ...state.player, will: 2 }, board: { ...state.board, playerSlots: [unit, null, null, null, null] } };
    const next = destroyOwnCard(state, "player", 0);
    expect(next.player.will).toBe(1);
    expect(next.currentTurn?.playsUsed).toBe(1);
    expect(next.board.playerSlots[0]).toBeNull();
    expect(next.player.discard).toContain(unit);
  });
  it("23-25 fatigue applies only with empty hand and deck", () => {
    let state = withTurn(createInitialMatchState(), "player");
    expect(endTurn(state, "player").player.hp).toBe(state.player.hp);
    state = { ...state, player: { ...state.player, hand: [], deck: [] } };
    expect(endTurn(state, "player").player.hp).toBe(state.player.hp - 3);
    const card = inst(def("p"), "player");
    state = { ...state, player: { ...state.player, will: 5, hand: [card], deck: [] } };
    const played = playCard(state, "player", card.instanceId, { type: "slot", playerId: "player", slotIndex: 0 });
    expect(endTurn(played, "player").player.hp).toBe(played.player.hp - 3);
  });
  it("26-28 periodic/sequence damage can end as draw and HP clamps to zero", () => {
    const p = damageHero({ ...createInitialMatchState().player, hp: 2 }, 5).player;
    expect(p.hp).toBe(0);
    const state = { ...createInitialMatchState(), player: { ...createInitialMatchState().player, hp: 0 }, enemy: { ...createInitialMatchState().enemy, hp: 0 } };
    expect(endTurn(withTurn({ ...state, seriesScore: { player: 1, enemy: 1 } }, "player"), "player").winner).toBe("draw");
  });
  it("29-32 Caduceus scores battle draw once per series", () => {
    expect(resolveCaduceusBattleDraw({ ...createInitialMatchState(), seriesScore: { player: 1, enemy: 0 } }).seriesScore).toEqual({ player: 2, enemy: 1 });
    expect(resolveCaduceusBattleDraw({ ...createInitialMatchState(), seriesScore: { player: 1, enemy: 1 } }).winner).toBe("draw");
    const first = resolveCaduceusBattleDraw(createInitialMatchState());
    expect(resolveCaduceusBattleDraw(first).seriesScore).toEqual(first.seriesScore);
  });
  it("33-34 new battle state resets zones but keeps hero and bonuses", () => {
    const state = createInitialMatchState({ seed: 2 });
    expect(state.player.hp).toBe(state.player.maxHp);
    expect(state.player.hand).toHaveLength(7);
    expect(state.player.bonusCards.length).toBeGreaterThan(0);
  });
  it("35-36 element bonus scales only allowed event fields, not tactics", () => {
    const hero = inst(def("hero", { type: "character", element: "fire" }), "player");
    const bonus = inst(def("bonus", { type: "upgrade", element: "fire", effects: [{ op: "bonus", percent: 20 }] }), "player");
    const pct = getBonusPercent([bonus], hero);
    expect(scaleByElementBonus(def("event", { type: "event", scalableFields: ["damage"] }), "damage", 5, pct)).toBe(6);
    expect(scaleByElementBonus(def("tactic", { type: "tactic", scalableFields: ["damage"] }), "damage", 5, pct)).toBe(5);
  });
  it("37-38 current enemy Will can be hidden while played costs are public", () => {
    const card = inst(def("costly", { cost: 4 }), "enemy");
    let state = withTurn(createInitialMatchState(), "enemy");
    state = { ...state, enemy: { ...state.enemy, will: 5, hand: [card] } };
    const played = playCard(state, "enemy", card.instanceId, { type: "slot", playerId: "enemy", slotIndex: 0 });
    expect(played.currentTurn?.playedCosts[0]).toMatchObject({ playerId: "enemy", cost: 4 });
  });
  it("39-40 time cards affect timer numbers within bounds", () => {
    expect(clampTimerSeconds(10)).toBe(20);
    expect(clampTimerSeconds(120)).toBe(90);
    expect(clampTimerSeconds(45)).toBe(45);
  });
});
