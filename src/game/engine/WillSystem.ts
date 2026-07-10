import type { MatchState, PlayerId, PlayerState } from "../core/types";
import { DEFAULT_MAX_WILL, DEFAULT_WILL_REGEN, FIRST_PLAYER_WILL_PENALTY } from "./Rules";

export const canPayWill = (p: PlayerState, cost: number) => p.will >= Math.max(0, Math.floor(cost));
export const payWill = (p: PlayerState, cost: number): PlayerState => ({ ...p, will: Math.max(0, p.will - Math.max(0, Math.floor(cost))) });
export const clampWill = (p: PlayerState): PlayerState => ({ ...p, maxWill: Math.max(1, p.maxWill || DEFAULT_MAX_WILL), will: Math.max(0, Math.min(Math.max(1, p.maxWill || DEFAULT_MAX_WILL), p.will || 0)) });
export const getWillRegen = (p: PlayerState) => Math.max(0, Math.floor(p.willRegenPerRound ?? DEFAULT_WILL_REGEN));

export function initializeBattleWill(state: MatchState, firstPlayerId: PlayerId): MatchState {
  const secondPlayerId = firstPlayerId === "player" ? "enemy" : "player";
  const first = state[firstPlayerId];
  const second = state[secondPlayerId];
  return {
    ...state,
    [firstPlayerId]: { ...first, will: Math.max(0, first.maxWill - FIRST_PLAYER_WILL_PENALTY), personalTurnsTaken: 0 },
    [secondPlayerId]: { ...second, will: second.maxWill, personalTurnsTaken: 0 },
  };
}

export function regenerateWillForTurn(state: MatchState, playerId: PlayerId): MatchState {
  const side = state[playerId];
  if ((side.personalTurnsTaken ?? 0) <= 0) return state;
  const regen = getWillRegen(side);
  return { ...state, [playerId]: { ...side, will: Math.min(side.maxWill, Math.max(0, side.will) + regen) } };
}
