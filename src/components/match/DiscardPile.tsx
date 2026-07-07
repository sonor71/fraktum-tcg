import type { CardInstance } from "../../game/core/types";

type PileOwner = "player" | "enemy";

type DiscardPileProps = {
  cards: CardInstance[];
  owner: PileOwner;
};

type CardDefinitionImageMeta = CardInstance["definition"] & {
  image?: string;
  imageUrl?: string;
  src?: string;
  path?: string;
};

function getOwnerLabel(owner: PileOwner) {
  return owner === "player" ? "Player" : "Enemy";
}

function getCardImage(card?: CardInstance) {
  if (!card) return "/cards/card-back.png";

  const definition = card.definition as CardDefinitionImageMeta;
  return definition.image || definition.imageUrl || definition.src || definition.path || "/cards/card-back.png";
}

function getCardName(card?: CardInstance) {
  return card?.definition?.title || card?.definition?.ruTitle || "Empty discard";
}

function getTopDiscard(cards: CardInstance[]) {
  if (!Array.isArray(cards) || cards.length === 0) return undefined;
  return cards[cards.length - 1];
}

function getDiscardPreview(cards: CardInstance[]) {
  if (!Array.isArray(cards) || cards.length === 0) return [];
  return cards.slice(Math.max(0, cards.length - 3)).reverse();
}

export function DiscardPile({ cards, owner }: DiscardPileProps) {
  const safeCards = Array.isArray(cards) ? cards : [];
  const top = getTopDiscard(safeCards);
  const preview = getDiscardPreview(safeCards);
  const count = safeCards.length;
  const ownerLabel = getOwnerLabel(owner);
  const isEmpty = count <= 0;
  const topLabel = top ? getCardName(top) : "empty";
  const title = `${ownerLabel} discard: ${count} card${count === 1 ? "" : "s"}. Top: ${topLabel}.`;

  return (
    <div
      className={[
        "matchPile",
        "is-discard",
        `is-${owner}`,
        isEmpty ? "is-empty" : "",
      ].filter(Boolean).join(" ")}
      role="group"
      aria-label={title}
      title={title}
      data-owner={owner}
      data-pile-owner={owner}
      data-pile-kind="discard"
      data-count={count}
      data-top-card={top?.baseId ?? ""}
    >
      <span className="matchPileAura" aria-hidden="true" />

      <span className="matchPileStack is-discard-stack" aria-hidden="true">
        {preview.length > 0 ? (
          preview.map((card, index) => (
            <img
              key={`${card.instanceId ?? card.baseId}-${index}`}
              className={`matchPileDiscardPreview preview-${index}`}
              src={getCardImage(card)}
              alt=""
              draggable={false}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ))
        ) : (
          <span className="matchPileEmpty" />
        )}

        {isEmpty ? <span className="matchPileEmptyOverlay">EMPTY</span> : null}
      </span>

      <span className="matchPileText" aria-hidden="true">
        <b>DISCARD</b>
      </span>

      <span className="matchPileCount" aria-hidden="true">
        <strong>{count}</strong>
      </span>

      <span className="matchPileSrOnly">{title}</span>
    </div>
  );
}
