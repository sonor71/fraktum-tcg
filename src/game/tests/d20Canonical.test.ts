import { describe, expect, it, vi } from "vitest";
import { createInitialMatchState, rollD20, confirmFateRouletteResult } from "../engine/MatchEngine";
import { revealFateRouletteResult, spinFateRoulette, FATE_ROULETTE_RESULT_READ_MS } from "../engine/FateRoulette";
import { getD20PlayLimit, getD20Rule } from "../engine/Rules";
import { planNextAiAction, runSimpleAI } from "../ai/SimpleAI";

describe("canonical D20 table", () => {
  it.each([[1,1],[6,6],[10,10],[11,1],[14,1],[17,"unlimited"],[18,"unlimited"],[19,1],[20,1]] as const)("maps %s to %s", (roll, limit) => expect(getD20PlayLimit(roll)).toBe(limit));
  it.each([[1,"limit"],[10,"limit"],[11,"discard"],[14,"discard"],[15,"roulette"],[16,"roulette"],[17,"doubleWill"],[18,"doubleWill"],[19,"enemyDeck"],[20,"awakening"]] as const)("classifies %s as %s", (roll, rule) => expect(getD20Rule(roll)).toBe(rule));
  it("applies doubled Will and awakening state", () => {
    const base = createInitialMatchState({ startingPlayerId: "player" });
    expect(rollD20({ ...base, phase: "roll" }, "player", 17).currentTurn?.willCostMultiplier).toBe(2);
    const awakening = rollD20({ ...base, phase: "roll" }, "player", 20);
    expect(awakening.currentTurn).toMatchObject({ d20Limit: 1, freeCards: false });
  });
});

describe("canonical Fate Roulette flow", () => {
  it.each([15, 16] as const)("opens, spins, reveals and returns player roll %s to main", (roll) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    let state = rollD20({ ...createInitialMatchState({ startingPlayerId: "player" }), phase: "roll" }, "player", roll);
    expect(state.rouletteState?.stage).toBe("awaitingSpin");
    state = spinFateRoulette(state, "player", state.rouletteState!.id);
    state = revealFateRouletteResult(state, "player", state.rouletteState!.id, Date.now() - FATE_ROULETTE_RESULT_READ_MS);
    state = confirmFateRouletteResult(state, "player", state.rouletteState!.id);
    expect(state.phase).toBe("main"); expect(state.rouletteState).toBeUndefined();
    vi.useRealTimers();
  });
  it("lets AI complete its roulette and continue without a deadlock", () => {
    let state = rollD20({ ...createInitialMatchState({ startingPlayerId: "enemy" }), phase: "enemy", activePlayerId: "enemy" }, "enemy", 15);
    expect(planNextAiAction(state)?.type).toBe("SPIN_FATE_ROULETTE");
    state = runSimpleAI(state);
    expect(state.phase).not.toBe("roulette");
  });
});
