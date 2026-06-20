import { describe, expect, it } from "vitest";
import { createInitialMatchState, playCard } from "../engine/MatchEngine";

describe("play card board rules", () => {
  it("keeps an HP card on the board and spends Will", () => {
    const state = createInitialMatchState({ seed: 1 });
    const card = state.player.hand.find((candidate) => candidate.baseId === "energy_sword")!;
    const next = playCard({ ...state, phase: "main", player: { ...state.player, will: 5 } }, "player", card.instanceId, { type: "slot", playerId: "player", slotIndex: 1 });

    expect(next.board.playerSlots[1]?.baseId).toBe("energy_sword");
    expect(next.board.playerSlots[1]?.temporaryUntilRoundEnd).toBe(false);
    expect(next.player.discard.some((discarded) => discarded.instanceId === card.instanceId)).toBe(false);
    expect(next.player.will).toBe(3);
  });

  it("does not play a card without enough Will", () => {
    const state = createInitialMatchState({ seed: 1 });
    const card = state.player.hand.find((candidate) => candidate.baseId === "energy_sword")!;
    const next = playCard({ ...state, phase: "main", player: { ...state.player, will: 0 } }, "player", card.instanceId, { type: "slot", playerId: "player", slotIndex: 0 });

    expect(next.board.playerSlots.every((slot) => slot === null)).toBe(true);
    expect(next.player.hand).toContain(card);
    expect(next.log.at(-1)).toContain("Not enough Will");
  });
});
