import type { MatchResult, OwnedCard } from "../game/types";

export const MATCH_PAYLOAD_KEY = "fraktum_match_payload";
export const MATCH_RESULT_KEY = "fraktum_match_result";
export const REACT_MATCH_PATH = "/match/ai";

export type MatchPayload = { playerName: string; deckIds: string[]; ownedCards: OwnedCard[]; createdAt: number };

export function createMatchPayload(playerName: string, deckIds: string[], ownedCards: OwnedCard[]): MatchPayload {
  const payload = { playerName, deckIds, ownedCards, createdAt: Date.now() };
  localStorage.setItem(MATCH_PAYLOAD_KEY, JSON.stringify(payload));
  return payload;
}
export function launchReactMatch() { window.location.assign(REACT_MATCH_PATH); }
export function pollMatchResult(): MatchResult | null { const raw = localStorage.getItem(MATCH_RESULT_KEY); return raw ? JSON.parse(raw) as MatchResult : null; }
export function clearMatchResult() { localStorage.removeItem(MATCH_RESULT_KEY); }
export function simulateMatchResult(result: MatchResult["result"] = Math.random() > 0.35 ? "win" : "lose") { const simulated: MatchResult = { id: `sim-${Date.now()}`, result, coins: result === "win" ? 120 : 40, xp: result === "win" ? 80 : 25, opponent: "AI", playedAt: Date.now(), finishedAt: Date.now() }; localStorage.setItem(MATCH_RESULT_KEY, JSON.stringify(simulated)); return simulated; }
export function applyMatchResult(apply: (result: MatchResult) => void) { const result = pollMatchResult(); if (!result) return null; apply(result); clearMatchResult(); return result; }
