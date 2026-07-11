import type { PlayerId, StartMatchPayload, TargetRef } from "./types";
export type GameAction =
  | { type: "START_MATCH"; payload?: StartMatchPayload }
  | { type: "ROLL_D20"; playerId: PlayerId }
  | { type: "PLAY_CARD"; playerId: PlayerId; cardInstanceId: string; target?: TargetRef }
  | { type: "DESTROY_OWN_CARD"; playerId: PlayerId; slotIndex: number }
  | { type: "END_TURN"; playerId: PlayerId }
  | { type: "AI_TURN" }
  | { type: "CONCEDE"; playerId: PlayerId };
