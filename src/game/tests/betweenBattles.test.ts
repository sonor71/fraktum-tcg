import { describe, expect, it } from "vitest";
import { createInitialMatchState, checkWinCondition, dispatch, endTurn } from "../engine/MatchEngine";
import type { GameAction } from "../core/GameAction";

function finishWithHp(playerHp: number, enemyHp: number, score = { player: 0, enemy: 0 }) {
  const state = createInitialMatchState({ seed: 77, startingPlayerId: "player" });
  return checkWinCondition({
    ...state,
    seriesScore: score,
    player: { ...state.player, hp: playerHp },
    enemy: { ...state.enemy, hp: enemyHp },
  });
}

describe("FRAKTUM between-battle series flow", () => {
  it("keeps a player first-battle win between battles without declaring a match winner", () => {
    const state = finishWithHp(10, 0);

    expect(state.phase).toBe("betweenBattles");
    expect(state.seriesScore).toEqual({ player: 1, enemy: 0 });
    expect(state.winner).toBeUndefined();
    expect(state.battleResult).toBe("player");
  });

  it("scores an AI battle win", () => {
    const state = finishWithHp(0, 10);

    expect(state.phase).toBe("betweenBattles");
    expect(state.seriesScore).toEqual({ player: 0, enemy: 1 });
    expect(state.battleResult).toBe("enemy");
  });


  it("does not score the same HP defeat twice", () => {
    const first = finishWithHp(10, 0);
    const second = checkWinCondition(first);

    expect(second.seriesScore).toEqual({ player: 1, enemy: 0 });
    expect(second.structuredEngineEvents?.filter((event) => event.type === "BATTLE_ENDED")).toHaveLength(1);
  });

  it("fatigue death during END_TURN scores exactly one battle", () => {
    const base = createInitialMatchState({ seed: 88, startingPlayerId: "enemy" });
    const state = {
      ...base,
      activePlayerId: "enemy" as const,
      phase: "enemy" as const,
      enemy: { ...base.enemy, hp: 2, hand: [], deck: [] },
      currentTurn: {
        playerId: "enemy" as const,
        d20Limit: "unlimited" as const,
        playsUsed: 0,
        cardsPlayed: 0,
        destroyedOwnCard: false,
        freeCards: false,
        skipDamageApplied: false,
        timerSeconds: 60,
        playedCosts: [],
      },
    };

    const next = endTurn(state, "enemy");

    expect(next.enemy.hp).toBe(0);
    expect(next.phase).toBe("betweenBattles");
    expect(next.seriesScore).toEqual({ player: 1, enemy: 0 });
    expect(next.structuredEngineEvents?.filter((event) => event.type === "BATTLE_ENDED")).toHaveLength(1);
  });

  it("START_NEXT_BATTLE resets only battle state and preserves series identity", () => {
    const first = finishWithHp(10, 0);
    const opponentHeroId = first.enemy.hero.baseId;
    const next = dispatch(first, { type: "START_NEXT_BATTLE", battleNumber: first.battleNumber } as GameAction);

    expect(next.id).toBe(first.id);
    expect(next.battleNumber).toBe((first.battleNumber ?? 1) + 1);
    expect(next.seriesScore).toEqual({ player: 1, enemy: 0 });
    expect(next.enemy.hero.baseId).toBe(opponentHeroId);
    expect(next.player.hp).toBe(next.player.maxHp);
    expect(next.enemy.hp).toBe(next.enemy.maxHp);
    expect(next.board.playerSlots.every((slot) => slot === null)).toBe(true);
    expect(next.board.enemySlots.every((slot) => slot === null)).toBe(true);
  });

  it("continues from 1:0 and can reach 1:1 after the second battle", () => {
    const battle2 = dispatch(finishWithHp(10, 0), { type: "START_NEXT_BATTLE", battleNumber: 1 } as GameAction);
    expect(battle2.seriesScore).toEqual({ player: 1, enemy: 0 });

    const tied = checkWinCondition({ ...battle2, player: { ...battle2.player, hp: 0 }, enemy: { ...battle2.enemy, hp: 12 } });
    expect(tied.phase).toBe("betweenBattles");
    expect(tied.seriesScore).toEqual({ player: 1, enemy: 1 });
    expect(tied.winner).toBeUndefined();
  });

  it("ends the whole match only after the decisive 2:1 battle", () => {
    const battle3 = dispatch(finishWithHp(0, 10, { player: 1, enemy: 0 }), { type: "START_NEXT_BATTLE", battleNumber: 1 } as GameAction);
    const final = checkWinCondition({ ...battle3, seriesScore: { player: 1, enemy: 1 }, player: { ...battle3.player, hp: 10 }, enemy: { ...battle3.enemy, hp: 0 } });

    expect(final.phase).toBe("ended");
    expect(final.winner).toBe("player");
    expect(final.seriesScore).toEqual({ player: 2, enemy: 1 });
  });

  it("restart starts a fresh 0:0 series", () => {
    const restarted = dispatch(finishWithHp(10, 0), { type: "START_MATCH", payload: { seed: 99 } } as GameAction);

    expect(restarted.seriesScore).toEqual({ player: 0, enemy: 0 });
    expect(restarted.battleNumber).toBe(1);
  });

  it("ignores duplicate START_NEXT_BATTLE after a new battle has already started", () => {
    const between = finishWithHp(10, 0);
    const next = dispatch(between, { type: "START_NEXT_BATTLE", battleNumber: between.battleNumber } as GameAction);
    const duplicate = dispatch(next, { type: "START_NEXT_BATTLE", battleNumber: between.battleNumber } as GameAction);

    expect(duplicate.battleNumber).toBe(next.battleNumber);
    expect(duplicate.seriesScore).toEqual(next.seriesScore);
  });
});
