import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MatchState } from "../../../game/core/types";
import type {
  MatchDebugContext,
  MatchDebugEvent,
  MatchDebugRecordInput,
  MatchDebugSession,
  MatchDebugStateSummary,
} from "./matchDebugTypes";
import {
  buildDebugText,
  createMatchDebugStateSummary,
  diffMatchStates,
  isMatchDebugAllowed,
  makeDebugSession,
  sanitizeDebugValue,
} from "./matchDebugUtils";
import { loadMatchDebugSessions, saveMatchDebugSession } from "./matchDebugStorage";

const MAX_EVENTS = 2000;
const SAVE_DEBOUNCE_MS = 700;

type UseMatchDebugRecorderInput = MatchDebugContext & {
  state: MatchState;
};

function getLevelFromChanges(changes: MatchDebugEvent["changes"]): MatchDebugEvent["level"] {
  if (changes?.some((change) => change.level === "error")) return "error";
  if (changes?.some((change) => change.level === "warning")) return "warning";
  return "info";
}

function getSourceForAction(actionType: string | undefined, fallback: MatchDebugRecordInput["source"]) {
  if (actionType === "AI_TURN") return "ai";
  return fallback;
}

export function useMatchDebugRecorder(input: UseMatchDebugRecorderInput) {
  const allowed = input.enabled && isMatchDebugAllowed();
  const [isOpen, setIsOpen] = useState(false);
  const [events, setEvents] = useState<MatchDebugEvent[]>([]);
  const [previousSessions, setPreviousSessions] = useState<MatchDebugSession[]>(() => loadMatchDebugSessions());
  const eventsRef = useRef<MatchDebugEvent[]>([]);
  const startTimeRef = useRef(Date.now());
  const sequenceRef = useRef(0);
  const previousStateRef = useRef<MatchState | null>(null);
  const previousLogCountRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);
  const latestSessionRef = useRef<MatchDebugSession | null>(null);

  const baseSummary = useMemo(() => createMatchDebugStateSummary(input.state), [input.state]);

  const makeEvent = useCallback((record: MatchDebugRecordInput): MatchDebugEvent => {
    const timestamp = Date.now();
    const source = getSourceForAction(record.actionType, record.source);
    return {
      id: `debug_${input.state.id}_${sequenceRef.current + 1}_${timestamp}`,
      sequence: sequenceRef.current + 1,
      timestamp,
      elapsedMs: timestamp - startTimeRef.current,
      matchId: input.state.id,
      matchMode: input.matchMode,
      roomId: input.roomId,
      seat: input.seat ?? undefined,
      source,
      level: record.level ?? getLevelFromChanges(record.changes),
      category: record.category,
      actionType: record.actionType,
      message: record.message,
      action: record.action ? sanitizeDebugValue(record.action) : undefined,
      before: record.before,
      after: record.after,
      changes: record.changes,
      metadata: record.metadata ? sanitizeDebugValue(record.metadata) as Record<string, unknown> : undefined,
    };
  }, [input.matchMode, input.roomId, input.seat, input.state.id]);

  const record = useCallback((recordInput: MatchDebugRecordInput) => {
    if (!allowed) return;
    const event = makeEvent(recordInput);
    sequenceRef.current = event.sequence;
    setEvents((current) => {
      const next = [...current, event].slice(-MAX_EVENTS);
      eventsRef.current = next;
      return next;
    });
  }, [allowed, makeEvent]);

  const refreshPreviousSessions = useCallback(() => {
    setPreviousSessions(loadMatchDebugSessions());
  }, []);

  const buildSession = useCallback((eventList: MatchDebugEvent[], finalState?: MatchDebugStateSummary): MatchDebugSession => makeDebugSession({
    matchId: input.state.id,
    mode: input.matchMode,
    roomId: input.roomId,
    seat: input.seat ?? undefined,
    playerNames: input.playerNames,
    startTime: startTimeRef.current,
    endTime: input.state.winner ? Date.now() : undefined,
    events: eventList.slice(-MAX_EVENTS),
    finalState: finalState ?? createMatchDebugStateSummary(input.state),
  }), [input.matchMode, input.playerNames, input.roomId, input.seat, input.state]);

  const persistNow = useCallback((eventList = events) => {
    if (!allowed || eventList.length === 0) return;
    const session = buildSession(eventList);
    latestSessionRef.current = session;
    saveMatchDebugSession(session);
    refreshPreviousSessions();
  }, [allowed, buildSession, events, refreshPreviousSessions]);

  useEffect(() => {
    if (!allowed) return;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      persistNow(events);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    };
  }, [allowed, events, persistNow]);

  useEffect(() => {
    if (!allowed) return;
    const previous = previousStateRef.current;
    const previousLogCount = previousLogCountRef.current;
    previousStateRef.current = input.state;
    previousLogCountRef.current = input.state.log.length;

    if (!previous) {
      record({ source: "system", category: "match", actionType: "START_MATCH", message: "Match debug session started.", after: baseSummary });
      return;
    }

    if (previous === input.state) return;
    const newLogLines = input.state.log.slice(previousLogCount);
    const before = createMatchDebugStateSummary(previous);
    const after = createMatchDebugStateSummary(input.state);
    const changes = diffMatchStates(before, after, undefined, newLogLines);

    if (changes.length > 0) {
      record({ source: "engine", category: "state", message: `State changed (${changes.length} changes).`, before, after, changes });
      if (previous.activePlayerId === "enemy" || previous.phase === "enemy") {
        changes.forEach((change) => {
          record({
            source: change.level === "warning" ? "warning" : "ai",
            level: change.level ?? "info",
            category: change.category,
            actionType: change.level === "warning" ? "AI_WARNING" : "AI_TURN_STEP",
            message: change.message,
            before,
            after,
            metadata: change.metadata,
          });
        });
        const enemyHandDecreased = after.enemy.handCount < before.enemy.handCount;
        const visibleEnemyCard = changes.some((change) => change.path?.startsWith("enemy.slots") || change.category === "discard");
        if (enemyHandDecreased && !visibleEnemyCard) {
          record({
            source: "warning",
            level: "warning",
            category: "card",
            actionType: "AI_CARD_NOT_VISIBLE",
            message: "AI effect resolved without a detected visible card.",
            before,
            after,
            metadata: { expectedDestination: "enemy board or discard", actualDestination: "not detected" },
          });
        }
      }
    }

    newLogLines.forEach((line) => {
      record({ source: "engine", category: "effect", message: line, metadata: { logIndex: previousLogCount + newLogLines.indexOf(line) } });
    });
  }, [allowed, baseSummary, input.state, record]);

  useEffect(() => {
    if (!allowed) return;
    const onError = (event: ErrorEvent) => {
      record({
        source: "error",
        level: "error",
        category: "error",
        message: event.message || "Browser error",
        after: createMatchDebugStateSummary(input.state),
        metadata: {
          name: event.error instanceof Error ? event.error.name : undefined,
          stack: event.error instanceof Error ? event.error.stack : undefined,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      record({
        source: "error",
        level: "error",
        category: "error",
        message: reason instanceof Error ? reason.message : "Unhandled promise rejection",
        after: createMatchDebugStateSummary(input.state),
        metadata: {
          name: reason instanceof Error ? reason.name : undefined,
          stack: reason instanceof Error ? reason.stack : undefined,
          reason: sanitizeDebugValue(reason),
        },
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [allowed, input.state, record]);

  useEffect(() => {
    if (!allowed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        setIsOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [allowed]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      if (eventsRef.current.length > 0) {
        saveMatchDebugSession(buildSession(eventsRef.current));
      } else {
        const session = latestSessionRef.current;
        if (session) saveMatchDebugSession(session);
      }
    };
  }, []);

  const addSnapshot = useCallback(() => {
    record({ source: "system", category: "state", actionType: "SNAPSHOT", message: "Manual state snapshot captured.", after: createMatchDebugStateSummary(input.state) });
  }, [input.state, record]);

  const clearView = useCallback(() => {
    eventsRef.current = [];
    setEvents([]);
    record({ source: "system", category: "state", actionType: "CLEAR_VIEW", message: "Debug view cleared." });
  }, [record]);

  const exportSession = useCallback(() => buildSession(events), [buildSession, events]);

  return {
    enabled: allowed,
    isOpen,
    setIsOpen,
    events,
    record,
    addSnapshot,
    clearView,
    persistNow,
    previousSessions,
    refreshPreviousSessions,
    currentSummary: baseSummary,
    exportSession,
    textLog: buildDebugText(events),
  };
}
