import { afterEach, describe, expect, it, vi } from "vitest";
import type { CardDefinition, CardInstance, MatchState, PlayerId } from "../core/types";
import { getBonusPercent, scaleByElementBonus } from "../engine/BonusSystem";
import { damageHero, resolveFieldCombat } from "../engine/DamageSystem";
import { drawCards } from "../engine/DrawSystem";
import { createInitialMatchState, dispatch, destroyOwnCard, endTurn, playCard, resolveCaduceusBattleDraw, rollD20 } from "../engine/MatchEngine";
import { BOARD_SIZE, clampTimerSeconds, getD20PlayLimit } from "../engine/Rules";
import { FATE_ROULETTE_RESULT_READ_MS } from "../engine/FateRoulette";
import { planNextAiAction } from "../ai/SimpleAI";

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
  afterEach(() => {
    vi.useRealTimers();
  });

  it("deck starts as 20 unique cards with 7 hand and 13 deck after draw", () => {
    const state = createInitialMatchState({ seed: 11 });
    expect(state.player.hand).toHaveLength(7);
    expect(state.player.deck).toHaveLength(13);
    expect(new Set([...state.player.hand, ...state.player.deck].map((card) => card.baseId)).size).toBe(20);
    expect([...state.player.hand, ...state.player.deck].some((card) => card.definition.type === "character" || card.definition.type === "bonus")).toBe(false);
  });
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
  it("9-11 roulette pauses the turn, then confirm rerolls 15-16 for a limit", () => {
    let state = createInitialMatchState({ seed: 31 });
    state = { ...state, rngSeed: 1198, activePlayerId: "player", phase: "roll" };
    const triggered = rollD20(state, "player");
    expect(triggered.phase).toBe("roulette");
    expect(triggered.rouletteState?.stage).toBe("awaitingSpin");
    expect(triggered.rouletteState?.event).toBeUndefined();
    expect(triggered.activeRouletteEvent).toBeUndefined();
    expect(triggered.lastRoll).toBe(15);
    expect(triggered.rouletteUsedThisBattle).toBe(true);

    const spin = dispatch(triggered, { type: "SPIN_FATE_ROULETTE", playerId: "player", rouletteId: triggered.rouletteState!.id });
    const duplicateSpin = dispatch(spin, { type: "SPIN_FATE_ROULETTE", playerId: "player", rouletteId: triggered.rouletteState!.id });
    expect(duplicateSpin.rouletteState?.event).toBe(spin.rouletteState?.event);

    const revealAt = 1_000;
    const reveal = dispatch(spin, { type: "REVEAL_FATE_ROULETTE_RESULT", playerId: "player", rouletteId: triggered.rouletteState!.id, revealedAtMs: revealAt });
    expect(reveal.rouletteState?.stage).toBe("result");
    vi.useFakeTimers();
    vi.setSystemTime(revealAt + FATE_ROULETTE_RESULT_READ_MS);
    const confirmed = dispatch(reveal, { type: "CONFIRM_FATE_ROULETTE_RESULT", playerId: "player", rouletteId: triggered.rouletteState!.id });
    expect(confirmed.rouletteState).toBeUndefined();
    expect(confirmed.currentTurn?.rouletteResolvedThisTurn).toBe(true);
    expect(confirmed.lastRoll).not.toBe(15);
    expect(confirmed.phase).toBe("main");
  });

  it("roulette result enforces the 15 second read window before confirm", () => {
    vi.useFakeTimers();
    const revealedAtMs = 10_000;
    let state = createInitialMatchState({ seed: 31 });
    state = { ...state, rngSeed: 1198, activePlayerId: "player", phase: "roll" };
    const triggered = rollD20(state, "player");
    const spin = dispatch(triggered, { type: "SPIN_FATE_ROULETTE", playerId: "player", rouletteId: triggered.rouletteState!.id });
    const reveal = dispatch(spin, { type: "REVEAL_FATE_ROULETTE_RESULT", playerId: "player", rouletteId: triggered.rouletteState!.id, revealedAtMs });

    expect(reveal.rouletteState?.stage).toBe("result");
    expect(reveal.rouletteState?.resultRevealedAt).toBe(revealedAtMs);
    expect(reveal.rouletteState?.confirmAvailableAt).toBe(revealedAtMs + FATE_ROULETTE_RESULT_READ_MS);

    vi.setSystemTime(revealedAtMs + 1_000);
    const blockedAfterOneSecond = dispatch(reveal, { type: "CONFIRM_FATE_ROULETTE_RESULT", playerId: "player", rouletteId: triggered.rouletteState!.id });
    expect(blockedAfterOneSecond.rouletteState).toBeDefined();
    expect(blockedAfterOneSecond.lastRoll).toBe(15);
    expect(blockedAfterOneSecond.structuredEngineEvents?.at(-1)?.type).toBe("ROULETTE_RESULT_CONFIRM_BLOCKED");

    vi.setSystemTime(revealedAtMs + FATE_ROULETTE_RESULT_READ_MS - 1);
    const blockedAt14999 = dispatch(reveal, { type: "CONFIRM_FATE_ROULETTE_RESULT", playerId: "player", rouletteId: triggered.rouletteState!.id });
    expect(blockedAt14999.rouletteState).toBeDefined();
    expect(blockedAt14999.phase).toBe("roulette");

    const repeatedReveal = dispatch(reveal, { type: "REVEAL_FATE_ROULETTE_RESULT", playerId: "player", rouletteId: triggered.rouletteState!.id, revealedAtMs: revealedAtMs + 99_999 });
    expect(repeatedReveal.rouletteState?.confirmAvailableAt).toBe(reveal.rouletteState?.confirmAvailableAt);

    vi.setSystemTime(revealedAtMs + FATE_ROULETTE_RESULT_READ_MS);
    const confirmed = dispatch(reveal, { type: "CONFIRM_FATE_ROULETTE_RESULT", playerId: "player", rouletteId: triggered.rouletteState!.id });
    expect(confirmed.rouletteState).toBeUndefined();
    expect(confirmed.phase).toBe("main");
    expect(confirmed.structuredEngineEvents?.some((event) => event.type === "ROULETTE_RESULT_CONFIRMED" && Number(event.payload?.visibleDurationMs) >= FATE_ROULETTE_RESULT_READ_MS)).toBe(true);
  });

  it("AI waits for roulette result read window before confirming", () => {
    vi.useFakeTimers();
    const revealedAtMs = 50_000;
    let state = createInitialMatchState({ seed: 31, startingPlayerId: "enemy" });
    state = { ...state, rngSeed: 1198, activePlayerId: "enemy", phase: "enemy" };
    const triggered = rollD20(state, "enemy");
    const spin = dispatch(triggered, { type: "SPIN_FATE_ROULETTE", playerId: "enemy", rouletteId: triggered.rouletteState!.id });
    const reveal = dispatch(spin, { type: "REVEAL_FATE_ROULETTE_RESULT", playerId: "enemy", rouletteId: triggered.rouletteState!.id, revealedAtMs });

    vi.setSystemTime(revealedAtMs + FATE_ROULETTE_RESULT_READ_MS - 1);
    expect(planNextAiAction(reveal)).toBeNull();

    vi.setSystemTime(revealedAtMs + FATE_ROULETTE_RESULT_READ_MS);
    expect(planNextAiAction(reveal)).toEqual({ type: "CONFIRM_FATE_ROULETTE_RESULT", playerId: "enemy", rouletteId: triggered.rouletteState!.id });
  });

  it("12 D20=20 makes cards free for current turn", () => {
    const card = inst(def("free", { cost: 5 }), "player");
    let state = withTurn(createInitialMatchState(), "player");
    state = { ...state, player: { ...state.player, will: 0, hand: [card] }, lastRoll: 20, currentTurn: { ...state.currentTurn!, freeCards: true } };
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
    expect(resolveFieldCombat(played, "enemy").enemy.hp).toBe(played.enemy.hp);
    expect(resolveFieldCombat({ ...played, player: { ...played.player, personalTurnsTaken: 1 } }, "player").enemy.hp).toBeLessThan(played.enemy.hp);
  });
  it("13-14 applies the same owner-personal-turn attack delay to AI cards", () => {
    const sandstorm = inst(def("sandstorm", { title: "Sandstorm", attack: 4, health: 3 }), "enemy");
    let state = withTurn(createInitialMatchState(), "enemy");
    state = { ...state, enemy: { ...state.enemy, will: 5, hand: [sandstorm] } };
    const played = playCard(state, "enemy", sandstorm.instanceId, { type: "slot", playerId: "enemy", slotIndex: 0 });
    expect(resolveFieldCombat(played, "player").player.hp).toBe(played.player.hp);
    expect(resolveFieldCombat({ ...played, enemy: { ...played.enemy, personalTurnsTaken: 1 } }, "enemy").player.hp).toBeLessThan(played.player.hp);
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
    expect(endTurn(state, "player").player.hp).toBe(state.player.hp - 3);
    state = { ...state, player: { ...state.player, hand: [], deck: [] } };
    expect(endTurn(state, "player").player.hp).toBe(state.player.hp - 3);
    const card = inst(def("p"), "player");
    state = { ...state, player: { ...state.player, will: 5, hand: [card], deck: [] } };
    const played = playCard(state, "player", card.instanceId, { type: "slot", playerId: "player", slotIndex: 0 });
    expect(endTurn(played, "player").player.hp).toBe(played.player.hp);
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
  it("blocks hand card play while BLIND_TOP is active", () => {
    const card = inst(def("blind_hand", { cost: 1 }), "player");
    let state = withTurn(createInitialMatchState(), "player");
    state = { ...state, activeRouletteEvent: "BLIND_TOP", player: { ...state.player, will: 5, hand: [card] } };
    const next = playCard(state, "player", card.instanceId, { type: "slot", playerId: "player", slotIndex: 0 });
    expect(next.player.hand).toContain(card);
    expect(next.log.at(-1)).toContain("[BLIND_TOP]");
  });
});
