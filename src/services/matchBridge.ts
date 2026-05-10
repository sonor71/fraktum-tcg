import type { MatchResult, OwnedCard } from "../game/types";

export const MATCH_PAYLOAD_KEY = "fraktum_match_payload";
export const MATCH_RESULT_KEY = "fraktum_match_result";
export const UNITY_MATCH_PATH = "/unity-match/index.html";

export type MatchPayload = {
  playerName: string;
  deckIds: string[];
  ownedCards: OwnedCard[];
  mode: "demo";
  enemyId: "demo_ai";
  startedAt: number;
};

export function createMatchPayload(playerName: string, deckIds: string[], ownedCards: OwnedCard[]): MatchPayload {
  const payload: MatchPayload = {
    playerName,
    deckIds,
    ownedCards,
    mode: "demo",
    enemyId: "demo_ai",
    startedAt: Date.now(),
  };
  localStorage.setItem(MATCH_PAYLOAD_KEY, JSON.stringify(payload));
  return payload;
}

export function launchUnityMatch() {
  window.open(UNITY_MATCH_PATH, "_blank", "noopener,noreferrer");
}

export function pollMatchResult(): MatchResult | null {
  const raw = localStorage.getItem(MATCH_RESULT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MatchResult;
  } catch {
    localStorage.removeItem(MATCH_RESULT_KEY);
    return null;
  }
}

export function clearMatchResult() {
  localStorage.removeItem(MATCH_RESULT_KEY);
}

export function simulateMatchResult(result: MatchResult["result"] = Math.random() > 0.35 ? "win" : "lose") {
  const simulated: MatchResult = {
    result,
    xp: result === "win" ? 80 : 35,
    coins: result === "win" ? 140 : 45,
    cardsRewarded: [],
    cardsLost: [],
    finishedAt: Date.now(),
  };
  localStorage.setItem(MATCH_RESULT_KEY, JSON.stringify(simulated));
  return simulated;
}

export function applyMatchResult(apply: (result: MatchResult) => void) {
  const result = pollMatchResult();
  if (!result) return null;
  apply(result);
  clearMatchResult();
  return result;
}
