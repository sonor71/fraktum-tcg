import type { CardInstance } from "../../game/core/types";

export function DiscardPile({ cards, owner }: { cards: CardInstance[]; owner: "player" | "enemy" }) {
  const top = cards.at(-1);

  return (
    <button className={`matchPile is-discard is-${owner}`} type="button" title={`${owner} discard: ${cards.length} cards`} disabled>
      <span className="matchPileStack" aria-hidden="true">
        {top ? <img src={top.definition.image} alt="" /> : <span className="matchPileEmpty" />}
      </span>
      <b>Discard</b>
      <span>{cards.length}</span>
    </button>
  );
}
