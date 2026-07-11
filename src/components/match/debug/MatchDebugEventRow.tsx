import { useState } from "react";
import type { MatchDebugEvent } from "./matchDebugTypes";
import { formatDebugElapsed, sanitizeDebugValue } from "./matchDebugUtils";

type MatchDebugEventRowProps = {
  event: MatchDebugEvent;
};

function JsonBlock({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(sanitizeDebugValue(value), null, 2)}</pre>;
}

export function MatchDebugEventRow({ event }: MatchDebugEventRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className={`matchDebugEvent is-${event.level} is-${event.source}`}>
      <button type="button" onClick={() => setExpanded((current) => !current)}>
        <span>#{event.sequence}</span>
        <span>{formatDebugElapsed(event.elapsedMs)}</span>
        <b>{event.source}</b>
        <i>{event.category}{event.actionType ? `/${event.actionType}` : ""}</i>
        <strong>{event.message}</strong>
      </button>
      {expanded ? (
        <div className="matchDebugDetails">
          {event.action !== undefined ? <section><h4>Action</h4><JsonBlock value={event.action} /></section> : null}
          {event.before ? <section><h4>Before</h4><JsonBlock value={event.before} /></section> : null}
          {event.after ? <section><h4>After</h4><JsonBlock value={event.after} /></section> : null}
          {event.changes ? <section><h4>Changes</h4><JsonBlock value={event.changes} /></section> : null}
          {event.metadata ? <section><h4>Metadata</h4><JsonBlock value={event.metadata} /></section> : null}
        </div>
      ) : null}
    </li>
  );
}
