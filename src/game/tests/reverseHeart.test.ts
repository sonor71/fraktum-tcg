import { describe, expect, it } from "vitest";
import { createInitialMatchState, playCard } from "../engine/MatchEngine";
it("Reverse Heart swaps hero HP", () => { const state = createInitialMatchState(); const card = state.player.hand.find((c) => c.baseId === "reverse_heart")!; const next = playCard({ ...state, phase: "main", player: { ...state.player, hp: 10, will: 5 }, enemy: { ...state.enemy, hp: 25 } }, "player", card.instanceId); expect(next.player.hp).toBe(25); expect(next.enemy.hp).toBe(10); });
