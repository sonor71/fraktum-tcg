import { describe, expect, it } from "vitest";
import { cleanupTemporaryCards, createInitialMatchState, endTurn, playCard } from "../engine/MatchEngine";

describe("temporary no-HP cards", () => {
  it("keeps no-HP cards temporary on board instead of discarding immediately", () => {
    const state = createInitialMatchState({ seed: 1 });
    const card = state.player.hand.find((candidate) => candidate.baseId === "fire")!;
    const next = playCard({ ...state, phase: "main", player: { ...state.player, will: 5 } }, "player", card.instanceId, { type: "slot", playerId: "player", slotIndex: 2 });

    expect(next.board.playerSlots[2]?.baseId).toBe("fire");
    expect(next.board.playerSlots[2]?.temporaryUntilRoundEnd).toBe(true);
    expect(next.player.discard.some((discarded) => discarded.instanceId === card.instanceId)).toBe(false);
  });

  it("moves temporary cards to discard at round cleanup", () => {
    const state = createInitialMatchState({ seed: 1 });
    const card = state.player.hand.find((candidate) => candidate.baseId === "fire")!;
    const played = playCard({ ...state, phase: "main", player: { ...state.player, will: 5 } }, "player", card.instanceId, { type: "slot", playerId: "player", slotIndex: 2 });
    const cleaned = cleanupTemporaryCards(played);

    expect(cleaned.board.playerSlots[2]).toBeNull();
    expect(cleaned.player.discard.some((discarded) => discarded.instanceId === card.instanceId)).toBe(true);
  });

  it("runs cleanup after the enemy ends turn", () => {
    const state = createInitialMatchState({ seed: 1 });
    const card = state.player.hand.find((candidate) => candidate.baseId === "fire")!;
    const played = playCard({ ...state, phase: "main", player: { ...state.player, will: 5 } }, "player", card.instanceId, { type: "slot", playerId: "player", slotIndex: 2 });
    const afterPlayer = endTurn(played, "player");
    const afterEnemy = endTurn({ ...afterPlayer, activePlayerId: "enemy", phase: "enemy" }, "enemy");

    expect(afterEnemy.board.playerSlots[2]).toBeNull();
    expect(afterEnemy.player.discard.some((discarded) => discarded.instanceId === card.instanceId)).toBe(true);
  });
});
