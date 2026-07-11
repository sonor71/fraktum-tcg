import type { PlayerId, StartMatchPayload, TargetRef } from "./types";
export type GameAction =
  | { type: "START_MATCH"; payload?: StartMatchPayload }
  | { type: "ROLL_D20"; playerId: PlayerId }
  | { type: "PLAY_CARD"; playerId: PlayerId; cardInstanceId: string; target?: TargetRef }
  | { type: "PLAY_BLIND_TOP_CARD"; playerId: PlayerId; target?: TargetRef }
  | { type: "SPIN_FATE_ROULETTE"; playerId: PlayerId; rouletteId: string }
  | { type: "REVEAL_FATE_ROULETTE_RESULT"; playerId: PlayerId; rouletteId: string; revealedAtMs: number }
  | { type: "CONFIRM_FATE_ROULETTE_RESULT"; playerId: PlayerId; rouletteId: string }
  | { type: "DESTROY_OWN_CARD"; playerId: PlayerId; slotIndex: number }
  | { type: "END_TURN"; playerId: PlayerId }
  | { type: "AI_TURN" }
  | { type: "START_NEXT_BATTLE"; battleNumber?: number }
  | { type: "CONCEDE"; playerId: PlayerId };
