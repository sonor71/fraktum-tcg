import { useEffect, useMemo, useRef, useState } from "react";
import type { MatchDebugEvent, MatchDebugSession } from "./matchDebugTypes";
import { buildDebugFilename, buildDebugText, sanitizeDebugValue } from "./matchDebugUtils";
import { MATCH_DEBUG_STORAGE_KEY } from "./matchDebugStorage";
import { MatchDebugEventRow } from "./MatchDebugEventRow";

type MatchDebugFilter = "ALL" | "PLAYER" | "AI" | "ONLINE" | "ENGINE" | "WARNINGS" | "ERRORS";

type MatchDebugConsoleProps = {
  enabled: boolean;
  isOpen: boolean;
  onToggle: () => void;
  events: MatchDebugEvent[];
  textLog: string;
  exportSession: () => MatchDebugSession;
  onSnapshot: () => void;
  onClearView: () => void;
  previousSessions: MatchDebugSession[];
  onRefreshPreviousSessions: () => void;
};

const FILTERS: MatchDebugFilter[] = ["ALL", "PLAYER", "AI", "ONLINE", "ENGINE", "WARNINGS", "ERRORS"];

function eventMatchesFilter(event: MatchDebugEvent, filter: MatchDebugFilter) {
  if (filter === "ALL") return true;
  if (filter === "PLAYER") return event.source === "player";
  if (filter === "AI") return event.source === "ai";
  if (filter === "ONLINE") return event.source === "online_local" || event.source === "online_remote";
  if (filter === "ENGINE") return event.source === "engine";
  if (filter === "WARNINGS") return event.level === "warning";
  if (filter === "ERRORS") return event.level === "error";
  return true;
}

function downloadFile(filename: string, content: string, mimeType: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function MatchDebugConsole({
  enabled,
  isOpen,
  onToggle,
  events,
  textLog,
  exportSession,
  onSnapshot,
  onClearView,
  previousSessions,
  onRefreshPreviousSessions,
}: MatchDebugConsoleProps) {
  const [filter, setFilter] = useState<MatchDebugFilter>("ALL");
  const [query, setQuery] = useState("");
  const [paused, setPaused] = useState(false);
  const [height, setHeight] = useState(46);
  const listRef = useRef<HTMLUListElement>(null);

  const warningCount = events.filter((event) => event.level === "warning").length;
  const errorCount = events.filter((event) => event.level === "error").length;

  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return events.filter((event) => {
      if (!eventMatchesFilter(event, filter)) return false;
      if (!normalizedQuery) return true;
      return [event.message, event.source, event.category, event.actionType ?? ""].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [events, filter, query]);

  useEffect(() => {
    if (paused || !isOpen) return;
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [visibleEvents.length, paused, isOpen]);

  if (!enabled) return null;

  const session = exportSession();
  const json = JSON.stringify(sanitizeDebugValue(session), null, 2);

  return (
    <>
      <button className="matchDebugToggle" type="button" onClick={onToggle} aria-expanded={isOpen}>
        DEBUG LOG <b>{events.length}</b>
      </button>

      {isOpen ? (
        <section className="matchDebugConsole" style={{ height: `${height}svh` }} aria-label="Match debug console">
          <header>
            <div>
              <span>Match Debug Console</span>
              <b>{events.length} events · {warningCount} warnings · {errorCount} errors</b>
              <small>Stored at localStorage[{MATCH_DEBUG_STORAGE_KEY}]</small>
            </div>
            <button type="button" onClick={onToggle}>Collapse</button>
          </header>

          <div className="matchDebugToolbar">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search debug log" />
            <label>
              Height
              <input type="range" min="30" max="82" value={height} onChange={(event) => setHeight(Number(event.target.value))} />
            </label>
            <button type="button" onClick={() => setPaused((current) => !current)}>{paused ? "Resume autoscroll" : "Pause autoscroll"}</button>
            <button type="button" onClick={() => void navigator.clipboard?.writeText(textLog)}>Copy text</button>
            <button type="button" onClick={() => downloadFile(buildDebugFilename(session.mode, session.matchId, "txt"), textLog, "text/plain;charset=utf-8")}>Download TXT</button>
            <button type="button" onClick={() => downloadFile(buildDebugFilename(session.mode, session.matchId, "json"), json, "application/json;charset=utf-8")}>Download JSON</button>
            <button type="button" onClick={onSnapshot}>Snapshot</button>
            <button type="button" onClick={onClearView}>Clear view</button>
          </div>

          <div className="matchDebugFilters">
            {FILTERS.map((item) => (
              <button key={item} className={item === filter ? "is-active" : ""} type="button" onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>

          <ul className="matchDebugList" ref={listRef}>
            {visibleEvents.map((event) => <MatchDebugEventRow key={event.id} event={event} />)}
          </ul>

          <details className="matchDebugPrevious" onToggle={onRefreshPreviousSessions}>
            <summary>Previous sessions ({previousSessions.length})</summary>
            <div>
              {previousSessions.length === 0 ? <p>No previous sessions saved.</p> : previousSessions.map((item) => {
                const itemJson = JSON.stringify(sanitizeDebugValue(item), null, 2);
                return (
                  <article key={`${item.matchId}-${item.startTime}`}>
                    <span>{new Date(item.startTime).toLocaleString()} · {item.mode} · {item.events.length} events</span>
                    <button type="button" onClick={() => downloadFile(buildDebugFilename(item.mode, item.matchId, "json"), itemJson, "application/json;charset=utf-8")}>Download JSON</button>
                    <button type="button" onClick={() => downloadFile(buildDebugFilename(item.mode, item.matchId, "txt"), buildDebugText(item.events), "text/plain;charset=utf-8")}>Download TXT</button>
                  </article>
                );
              })}
            </div>
          </details>
        </section>
      ) : null}
    </>
  );
}
