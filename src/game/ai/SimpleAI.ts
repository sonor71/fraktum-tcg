import type { MatchState } from "../core/types";
import { endTurn, playCard, rollD20 } from "../engine/MatchEngine";
export function runSimpleAI(state: MatchState): MatchState { if (state.activePlayerId !== "enemy") return { ...state, log: [...state.log, "AI skipped: not AI turn."] }; let next = state.phase === "enemy" ? rollD20(state, "enemy") : state; const playable = next.enemy.hand.find((c) => c.definition.cost <= next.enemy.will); if (playable) next = playCard(next, "enemy", playable.instanceId); return endTurn(next, "enemy"); }
