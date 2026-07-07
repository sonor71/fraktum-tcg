export type TacticalRevealCard = {
  id: string;
  title: string;
  image: string;
  cost?: number;
  rarity?: string;
};

export type TacticalRevealEvent = {
  id: string;
  kind: "peek-hand" | "peek-card" | "steal-cast" | "reverse";
  viewer: "player" | "enemy";
  owner: "player" | "enemy";
  source: string;
  title: string;
  cards: TacticalRevealCard[];
};

function getKindLabel(kind: TacticalRevealEvent["kind"]) {
  switch (kind) {
    case "peek-hand":
      return "REVEALED HAND";
    case "peek-card":
      return "REVEALED CARD";
    case "steal-cast":
      return "STOLEN & CAST";
    case "reverse":
      return "REVERSED";
    default:
      return "REVEAL";
  }
}

export function TacticalRevealLayer({ events }: { events: TacticalRevealEvent[] }) {
  if (events.length === 0) return null;

  const latest = events[events.length - 1];
  const shownCards = latest.cards.slice(0, latest.kind === "peek-hand" ? 8 : 1);

  return (
    <section className={`matchTacticalRevealLayer is-${latest.kind}`} aria-live="polite" aria-label={latest.title}>
      <div className="matchTacticalRevealPanel" key={latest.id}>
        <div className="matchTacticalRevealHeader">
          <span>{getKindLabel(latest.kind)}</span>
          <b>{latest.source}</b>
        </div>

        <div className="matchTacticalRevealCards" data-count={shownCards.length}>
          {shownCards.map((card, index) => (
            <article className="matchTacticalRevealCard" style={{ animationDelay: `${index * 90}ms` }} key={`${latest.id}-${card.id}-${index}`}>
              <div className="matchTacticalRevealCardInner">
                <div className="matchTacticalRevealCardBack" aria-hidden="true">F</div>
                <div className="matchTacticalRevealCardFront">
                  <img src={card.image} alt={card.title} draggable={false} />
                  {typeof card.cost === "number" ? <i>{card.cost}</i> : null}
                </div>
              </div>
              <strong>{card.title}</strong>
            </article>
          ))}
        </div>

        <p>
          {latest.kind === "steal-cast"
            ? "Enemy card was flipped, taken, and used against its owner."
            : latest.kind === "reverse"
              ? "Incoming card was reflected back to its caster."
              : "Enemy cards were flipped for your view."}
        </p>
      </div>
    </section>
  );
}
