import type { PlayerId } from "../core/types";

export const BOARD_SIZE = 5;
export const STARTING_HAND_SIZE = 7;
export const HAND_LIMIT = 7;
export const MATCH_POINTS_TO_WIN = 2;
export const NO_CARD_PENALTY_DAMAGE = 3;
export const SKIP_TURN_DAMAGE = NO_CARD_PENALTY_DAMAGE;
export const BASE_TURN_SECONDS = 60;
export const MIN_TURN_SECONDS = 20;
export const MAX_TURN_SECONDS = 90;
export const DEFAULT_MAX_WILL = 5;
export const DEFAULT_WILL_REGEN = 2;
export const FIRST_PLAYER_WILL_PENALTY = 2;
export const ELEMENT_BONUS_CAP = 0.5;

export const DECK_SIZE = 20;

export type FateRouletteEvent = "MERGED_DECKS" | "WORLD_WITHOUT_WILL" | "BLIND_TOP" | "HIDDEN_HAND" | "EMPTY_OUTCOME";

export const FATE_ROULETTE_EVENTS: FateRouletteEvent[] = [
  "MERGED_DECKS",
  "WORLD_WITHOUT_WILL",
  "BLIND_TOP",
  "HIDDEN_HAND",
  "EMPTY_OUTCOME",
];

export function getD20PlayLimit(roll: number): number | "unlimited" {
  if (roll >= 1 && roll <= 6) return roll;
  return "unlimited";
}

export function isFateRouletteRoll(roll: number) {
  return roll === 15 || roll === 16;
}

export function clampTimerSeconds(seconds: number) {
  return Math.max(MIN_TURN_SECONDS, Math.min(MAX_TURN_SECONDS, Math.floor(seconds)));
}

export function scoreBattleResult(scores: Record<PlayerId, number>, result: PlayerId | "draw") {
  const next = { ...scores };
  if (result === "draw") {
    next.player += 1;
    next.enemy += 1;
  } else {
    next[result] += 1;
  }
  return next;
}

export function getMatchWinner(scores: Record<PlayerId, number>): PlayerId | "draw" | undefined {
  if (scores.player >= MATCH_POINTS_TO_WIN && scores.enemy >= MATCH_POINTS_TO_WIN && scores.player === scores.enemy) return "draw";
  if (scores.player >= MATCH_POINTS_TO_WIN && scores.player > scores.enemy) return "player";
  if (scores.enemy >= MATCH_POINTS_TO_WIN && scores.enemy > scores.player) return "enemy";
  return undefined;
}
