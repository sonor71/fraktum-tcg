type PileOwner = "player" | "enemy";

type DeckPileProps = {
  count: number;
  owner: PileOwner;
  onActivate?: () => void;
  disabled?: boolean;
  actionLabel?: string;
};

const CARD_BACK_IMAGE = "/cards/card-back.png";

function clampCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function getOwnerLabel(owner: PileOwner) {
  return owner === "player" ? "Player" : "Enemy";
}

function getDeckState(count: number) {
  if (count <= 0) return "empty";
  if (count <= 3) return "low";
  if (count <= 7) return "medium";
  return "full";
}

export function DeckPile({ count, owner, onActivate, disabled = false, actionLabel }: DeckPileProps) {
  const safeCount = clampCount(count);
  const ownerLabel = getOwnerLabel(owner);
  const state = getDeckState(safeCount);
  const isEmpty = state === "empty";
  const title = `${ownerLabel} deck: ${safeCount} card${safeCount === 1 ? "" : "s"}. State: ${state}.`;

  const interactive = Boolean(onActivate) && !disabled && !isEmpty;
  const accessibleTitle = actionLabel ? `${title} ${actionLabel}.` : title;

  return (
    <div
      className={[
        "matchPile",
        "is-deck",
        `is-${owner}`,
        isEmpty ? "is-empty" : "",
        onActivate ? "is-interactive" : "",
        disabled ? "is-disabled" : "",
      ].filter(Boolean).join(" ")}
      role={onActivate ? "button" : "group"}
      tabIndex={interactive ? 0 : undefined}
      aria-disabled={onActivate ? !interactive : undefined}
      aria-label={accessibleTitle}
      title={accessibleTitle}
      onClick={interactive ? onActivate : undefined}
      onKeyDown={interactive ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onActivate?.();
        }
      } : undefined}
      data-owner={owner}
      data-count={safeCount}
      data-state={state}
    >
      <span className="matchPileAura" aria-hidden="true" />

      <span className="matchPileStack" aria-hidden="true">
        <span className="matchPileLayer layer-3" />
        <span className="matchPileLayer layer-2" />
        <span className="matchPileLayer layer-1" />
        <span className="matchPileBackFallback">F</span>
        <img
          src={CARD_BACK_IMAGE}
          alt=""
          draggable={false}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        {isEmpty ? <span className="matchPileEmptyOverlay">EMPTY</span> : null}
      </span>

      <span className="matchPileText" aria-hidden="true">
        <b>{actionLabel ?? "DECK"}</b>
      </span>

      <span className="matchPileCount" aria-hidden="true">
        <strong>{safeCount}</strong>
      </span>

      <span className="matchPileSrOnly">{title}</span>
    </div>
  );
}
