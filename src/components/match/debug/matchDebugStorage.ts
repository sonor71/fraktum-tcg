import type { MatchDebugSession } from "./matchDebugTypes";
import { sanitizeDebugValue } from "./matchDebugUtils";

const STORAGE_KEY = "fraktum.matchDebugSessions.v1";
const MAX_SESSIONS = 10;
const MAX_EVENTS_PER_SESSION = 2000;
const MAX_STORAGE_CHARS = 4_500_000;

function readStoredSessions(): MatchDebugSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((entry): entry is MatchDebugSession => typeof entry === "object" && entry !== null && "matchId" in entry) : [];
  } catch {
    return [];
  }
}

function normalizeSession(session: MatchDebugSession): MatchDebugSession {
  return {
    ...session,
    events: session.events.slice(-MAX_EVENTS_PER_SESSION),
  };
}

function trimToStorageLimit(sessions: MatchDebugSession[]) {
  let next = sessions.slice(-MAX_SESSIONS).map(normalizeSession);
  while (next.length > 1 && JSON.stringify(sanitizeDebugValue(next)).length > MAX_STORAGE_CHARS) {
    next = next.slice(1);
  }
  return next;
}

export function loadMatchDebugSessions() {
  return readStoredSessions();
}

export function saveMatchDebugSession(session: MatchDebugSession) {
  if (typeof window === "undefined") return;
  const previous = readStoredSessions().filter((entry) => entry.matchId !== session.matchId || entry.startTime !== session.startTime);
  const next = trimToStorageLimit([...previous, normalizeSession(session)]);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeDebugValue(next)));
  } catch {
    // Debug persistence must never break a match.
  }
}

export { STORAGE_KEY as MATCH_DEBUG_STORAGE_KEY };
