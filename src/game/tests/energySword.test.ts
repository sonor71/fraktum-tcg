import { describe, expect, it } from "vitest";
import { createInitialMatchState, playCard } from "../engine/MatchEngine";

describe("Energy Sword", () => {
  it("damages enemy hero and spends Will", () => {
    const state = createInitialMatchState({ seed: 1 });
    const card = state.player.hand.find((c) => c.baseId === "energy_sword");
    expect(card).toBeTruthy();
    const next = playCard({ ...state, phase: "main", player: { ...state.player, will: 5 } }, "player", card!.instanceId);
    expect(next.enemy.hp).toBe(28);
    expect(next.player.will).toBe(3);
  });
  it("cannot be played without Will", () => {
    const state = createInitialMatchState({ seed: 1 });
    const card = state.player.hand.find((c) => c.baseId === "energy_sword")!;
    const next = playCard({ ...state, phase: "main" }, "player", card.instanceId);
    expect(next.player.hand).toContain(card);
    expect(next.log.at(-1)).toContain("needs");
  });
});
