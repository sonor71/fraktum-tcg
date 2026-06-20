import type { CardInstance } from "../../game/core/types";
import { CardView } from "./CardView";
export function HandView({ cards, onPlay, disabled }: { cards: CardInstance[]; onPlay: (id: string) => void; disabled?: boolean }) { return <div className="tsHand">{cards.map((card, index) => <div className="tsHandCard" style={{ rotate: `${(index - cards.length / 2) * 4}deg` }} key={card.instanceId}><CardView card={card} onClick={() => onPlay(card.instanceId)} disabled={disabled} /></div>)}</div>; }
