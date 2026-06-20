export function DeckPile({ count, owner }: { count: number; owner: "player" | "enemy" }) {
  return (
    <button className={`matchPile is-deck is-${owner}`} type="button" title={`${owner} deck: ${count} cards`} disabled>
      <span className="matchPileStack" aria-hidden="true"><img src="/cards/card-back.png" alt="" /></span>
      <b>Deck</b>
      <span>{count}</span>
    </button>
  );
}
