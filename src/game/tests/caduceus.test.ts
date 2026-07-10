import { expect, it } from "vitest";
import { createInitialMatchState } from "../engine/MatchEngine";

it("starts a FRAKTUM v1.0 match state", () => {
  const state = createInitialMatchState({ seed: 1 });
  expect(state.player.hand.length).toBeLessThanOrEqual(7);
  expect(state.enemy.hand.length).toBeLessThanOrEqual(7);
  expect(state.board.playerSlots).toHaveLength(6);
  expect(state.seriesScore).toEqual({ player: 0, enemy: 0 });
});
