import { expect, it } from "vitest";
import { createInitialMatchState, playCard } from "../engine/MatchEngine";
it("Caduceus ends match in a draw", () => { const state = createInitialMatchState(); const card = state.player.hand.find((c) => c.baseId === "caduceus")!; const next = playCard({ ...state, phase: "main", player: { ...state.player, will: 5 } }, "player", card.instanceId); expect(next.phase).toBe("ended"); expect(next.winner).toBe("draw"); });
