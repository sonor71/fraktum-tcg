import type { PlayerState } from "../core/types";
import { HAND_LIMIT } from "./Rules";
export function drawCards(player: PlayerState, amount: number): PlayerState {
  const deck = [...player.deck];
  const hand = [...player.hand];
  const drawCount = Math.min(Math.max(0, Math.floor(amount)), Math.max(0, HAND_LIMIT - hand.length));
  for (let i = 0; i < drawCount; i += 1) {
    const next = deck.shift();
    if (next) hand.push({ ...next, controllerId: player.id });
  }
  return { ...player, deck, hand };
}
export const drawToHandLimit = (player: PlayerState) => drawCards(player, HAND_LIMIT - player.hand.length);
