import type { CardInstance } from "../../game/core/types";
import "./match.css";
export function CardView({ card, onClick, disabled }: { card: CardInstance; onClick?: () => void; disabled?: boolean }) { return <button className="tsCard" type="button" onClick={onClick} disabled={disabled} title={card.definition.description}><img src={card.definition.image} alt={card.definition.title} /></button>; }
