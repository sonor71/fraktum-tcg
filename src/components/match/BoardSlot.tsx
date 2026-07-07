import type { CardInstance } from "../../game/core/types";
import { CardView } from "./CardView";

type BoardSlotProps = {
  card: CardInstance | null;
  side: "enemy" | "player";
  index: number;
  valid?: boolean;
};

function safeNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getCardTitle(card: CardInstance | null) {
  return card?.definition.title || card?.definition.ruTitle || card?.baseId || "Card";
}

function getCardHp(card: CardInstance | null) {
  if (!card) {
    return {
      current: 0,
      max: 0,
      hasHp: false,
      ratio: 0,
      state: "none" as const,
    };
  }

  const max = Math.max(0, safeNumber(card.definition.health));
  const current = Math.max(0, safeNumber(card.currentHealth, max));
  const hasHp = max > 0 || current > 0;
  const ratio = hasHp ? current / Math.max(1, max || current) : 0;

  let state: "none" | "healthy" | "damaged" | "critical" | "dead" = "none";
  if (hasHp) {
    if (current <= 0) state = "dead";
    else if (ratio <= 0.25) state = "critical";
    else if (ratio <= 0.5) state = "damaged";
    else state = "healthy";
  }

  return {
    current,
    max: max > 0 ? max : current,
    hasHp,
    ratio,
    state,
  };
}

function getSlotTitle(side: "enemy" | "player", index: number, card: CardInstance | null, canDrop: boolean) {
  const slotName = `${side === "player" ? "Player" : "Enemy"} slot ${index + 1}`;

  if (card) {
    const hp = getCardHp(card);
    const state = card.temporaryUntilRoundEnd
      ? "temporary, moves to discard after round cleanup"
      : hp.hasHp
        ? `HP ${hp.current}/${hp.max}`
        : "no HP";

    return `${slotName}: ${getCardTitle(card)} — ${state}`;
  }

  if (canDrop) return `${slotName}: valid drop zone`;
  if (side === "enemy") return `${slotName}: enemy zone`;
  return `${slotName}: empty player slot`;
}

function getSlotState(card: CardInstance | null, canDrop: boolean) {
  if (card) return "occupied";
  if (canDrop) return "open";
  return "locked";
}

export function BoardSlot({ card, side, index, valid = false }: BoardSlotProps) {
  const isPlayerSlot = side === "player";
  const occupied = Boolean(card);
  const canDrop = isPlayerSlot && !occupied && valid;
  const temporary = Boolean(card?.temporaryUntilRoundEnd);
  const hp = getCardHp(card);
  const cardKind = card ? (temporary ? "temporary" : hp.hasHp ? "permanent" : "effect") : "none";
  const title = getSlotTitle(side, index, card, canDrop);

  const className = [
    "matchBoardSlot",
    `is-${side}`,
    occupied ? "is-occupied" : "is-empty",
    canDrop ? "is-valid is-drop-open" : "",
    !occupied && isPlayerSlot && !canDrop ? "is-drop-locked" : "",
    temporary ? "is-temporary" : "",
    card && hp.hasHp ? "has-hp-card" : "",
    card && !hp.hasHp ? "has-no-hp-card" : "",
    hp.state !== "none" ? `is-hp-${hp.state}` : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      title={title}
      aria-label={title}
      data-drop-slot={canDrop ? index : undefined}
      data-slot-side={side}
      data-slot-index={index}
      data-slot-state={getSlotState(card, canDrop)}
      data-card-kind={cardKind}
      data-card-id={card?.instanceId ?? ""}
    >
      <span className="matchSlotRune" aria-hidden="true">✦</span>
      <span className="matchSlotDropHitbox" aria-hidden="true" />

      {card ? (
        <div className="matchSlotCardShell">
          <CardView card={card} size="board" disabled />

          {temporary ? (
            <span className="matchSlotStateTag is-temp">TEMP</span>
          ) : hp.hasHp ? (
            <span className={`matchSlotStateTag is-hp is-${hp.state}`}>{hp.current}/{hp.max} HP</span>
          ) : (
            <span className="matchSlotStateTag is-effect">EFFECT</span>
          )}
        </div>
      ) : (
        <>
          <span className="matchSlotNumber">{index + 1}</span>
          <span className="matchSlotHint">{canDrop ? "DROP" : isPlayerSlot ? "EMPTY" : "ENEMY"}</span>
        </>
      )}
    </div>
  );
}
