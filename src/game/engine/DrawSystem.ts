import type { PlayerState } from "../core/types";
export function drawCards(player: PlayerState, amount: number): PlayerState { const deck = [...player.deck]; const hand = [...player.hand]; for (let i = 0; i < amount; i += 1) { const next = deck.shift(); if (next) hand.push(next); } return { ...player, deck, hand }; }
