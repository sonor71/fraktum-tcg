import { describe, expect, it } from "vitest";
import { runSimpleAI } from "../ai/SimpleAI";
import { createInitialMatchState, endTurn, playCard, rollD20 } from "../engine/MatchEngine";
import {
  cardRequiresBoardSlot,
  getBestPlayableCard,
  getPreferredFreeSlotIndex,
} from "../engine/TurnManager";

function playAutomatedPlayerTurn(state: ReturnType<typeof createInitialMatchState>) {
  const card = getBestPlayableCard(state, "player");
  if (!card) return endTurn(state, "player");

  const slotIndex = cardRequiresBoardSlot(card)
    ? getPreferredFreeSlotIndex(state, "player")
    : 0;

  if (cardRequiresBoardSlot(card) && slotIndex < 0) {
    return endTurn(state, "player");
  }

  return playCard(
    state,
    "player",
    card.instanceId,
    cardRequiresBoardSlot(card)
      ? { type: "slot", playerId: "player", slotIndex }
      : undefined,
  );
}

describe("match engine stress flow", () => {
  it("resolves 50 deterministic battles without an AI or roulette deadlock", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      let state = createInitialMatchState({ seed });
      let steps = 0;

      while (state.phase !== "betweenBattles" && state.phase !== "ended" && steps < 700) {
        steps += 1;

        if (state.activePlayerId === "enemy" && state.phase === "enemy") {
          state = runSimpleAI(state);
          continue;
        }

        if (state.activePlayerId === "player" && state.phase === "roll") {
          state = rollD20(state, "player");
          continue;
        }

        if (state.activePlayerId === "player" && state.phase === "main") {
          state = playAutomatedPlayerTurn(state);
          continue;
        }

        throw new Error(`Seed ${seed} entered unsupported state ${state.phase}/${state.activePlayerId}.`);
      }

      expect(
        state.phase === "betweenBattles" || state.phase === "ended",
        `seed ${seed} did not resolve after ${steps} steps`,
      ).toBe(true);
      expect(steps).toBeLessThan(700);
    }
  });
});
