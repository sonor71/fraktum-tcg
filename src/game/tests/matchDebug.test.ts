import { describe, expect, it } from "vitest";
import { createInitialMatchState } from "../engine/MatchEngine";
import { createMatchDebugStateSummary, diffMatchStates, sanitizeDebugValue } from "../../components/match/debug/matchDebugUtils";

describe("match debug utilities", () => {
  it("summarizes safe public match state without enemy hand contents", () => {
    const state = createInitialMatchState({ seed: 1 });
    const summary = createMatchDebugStateSummary(state);
    expect(summary.matchId).toBe(state.id);
    expect(summary.player.handCount).toBe(state.player.hand.length);
    expect(summary.enemy.handCount).toBe(state.enemy.hand.length);
    expect(summary.enemy.slots).toHaveLength(state.board.enemySlots.length);
    expect(JSON.stringify(summary)).not.toContain(state.enemy.hand[0]?.instanceId ?? "__missing__");
  });

  it("diffs HP, turn, and board changes", () => {
    const before = createInitialMatchState({ seed: 2 });
    const card = before.player.hand[0];
    const after = {
      ...before,
      turn: before.turn + 1,
      enemy: { ...before.enemy, hp: before.enemy.hp - 3 },
      board: { ...before.board, playerSlots: [card, ...before.board.playerSlots.slice(1)] },
    };
    const changes = diffMatchStates(before, after, "PLAY_CARD", ["Player played a card."]);
    expect(changes.some((change) => change.message.includes("Turn"))).toBe(true);
    expect(changes.some((change) => change.message.includes("Enemy HP"))).toBe(true);
    expect(changes.some((change) => change.message.includes("Player slot 1"))).toBe(true);
  });

  it("redacts secret-like keys", () => {
    const sanitized = sanitizeDebugValue({ accessToken: "secret", nested: { anonKey: "secret" } });
    expect(JSON.stringify(sanitized)).not.toContain("secret");
  });
});
