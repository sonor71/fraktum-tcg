import type { CardInstance } from "../../game/core/types";
export function DiscardPile({ cards }: { cards: CardInstance[] }) { return <div className="tsPile">{cards.at(-1) ? <img src={cards.at(-1)?.definition.image} alt="Discard" /> : <div className="tsEmpty" />}<span>Discard {cards.length}</span></div>; }
