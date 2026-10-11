import { nextRandom } from "../game/engine/Random";
import type { OnlineSeat } from "./onlineMatchmaking";

function normalizeSeed(value: number) {
  const numeric = Number.isFinite(value) ? Math.trunc(value) : 12345;
  const normalized = numeric >>> 0;
  return normalized === 0 ? 12345 : normalized;
}

function saltedSeed(seed: number, salt: number) {
  return nextRandom((normalizeSeed(seed) ^ salt) >>> 0).seed >>> 0;
}

export type OnlineMatchSeeds = {
  playerShuffleSeed: number;
  enemyShuffleSeed: number;
  gameplaySeed: number;
};

export function getOnlineMatchSeeds(roomSeed: number, seat: OnlineSeat): OnlineMatchSeeds {
  // These are tied to physical seats A/B, not to local "player/enemy".
  // Both browsers therefore build identical mirrored decks.
  const seatASeed = saltedSeed(roomSeed, 0x41f6e2d9);
  const seatBSeed = saltedSeed(roomSeed, 0x9e3779b9);
  const gameplaySeed = saltedSeed(roomSeed, 0x7f4a7c15);

  return {
    playerShuffleSeed: seat === "a" ? seatASeed : seatBSeed,
    enemyShuffleSeed: seat === "a" ? seatBSeed : seatASeed,
    gameplaySeed,
  };
}
