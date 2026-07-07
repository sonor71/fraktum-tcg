import type { CSSProperties } from "react";

type MatchFxTone = "damage" | "heal" | "will" | "shield" | "play" | "discard" | "sys";

type MatchFxAnchor =
  | "player-hero"
  | "enemy-hero"
  | "player-will"
  | "enemy-will"
  | "d20"
  | `slot-player-${number}`
  | `slot-enemy-${number}`;

export type MatchFxEvent = {
  id: string;
  text: string;
  tone: MatchFxTone;
  anchor: MatchFxAnchor;
};

type MatchFxLayerProps = {
  events: MatchFxEvent[];
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getSlotPosition(anchor: string): CSSProperties | undefined {
  const match = /^slot-(player|enemy)-(\d+)$/.exec(anchor);
  if (!match) return undefined;

  const side = match[1];
  const index = clamp(Number(match[2]), 0, 4);

  const fieldLeft = 22.6;
  const fieldWidth = 55.2;
  const slotWidth = fieldWidth / 5;
  const left = fieldLeft + slotWidth * (index + 0.5);
  const top = side === "enemy" ? 31.5 : 52.7;

  return {
    left: `${left}%`,
    top: `${top}%`,
  };
}

function getAnchorStyle(anchor: MatchFxAnchor): CSSProperties {
  const slotPosition = getSlotPosition(anchor);
  if (slotPosition) return slotPosition;

  switch (anchor) {
    case "player-hero":
      return { left: "11.8%", top: "39%" };
    case "enemy-hero":
      return { left: "88.2%", top: "39%" };
    case "player-will":
      return { left: "50%", top: "72.6%" };
    case "enemy-will":
      return { left: "50%", top: "18.9%" };
    case "d20":
      return { left: "8.2%", top: "79.5%" };
    default:
      return { left: "50%", top: "50%" };
  }
}

export function MatchFxLayer({ events }: MatchFxLayerProps) {
  if (events.length === 0) return null;

  return (
    <div className="matchFxLayer" aria-hidden="true">
      {events.map((event) => (
        <span
          className={`matchFxText is-${event.tone}`}
          data-anchor={event.anchor}
          key={event.id}
          style={getAnchorStyle(event.anchor)}
        >
          {event.text}
        </span>
      ))}
    </div>
  );
}
