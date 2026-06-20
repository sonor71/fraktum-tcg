import type { CardInstance } from "../../game/core/types";
import { CardView } from "./CardView";

export function HandView({ cards, onPlay, disabled, selectedId, onSelect }: { cards: CardInstance[]; onPlay: (id: string) => void; disabled?: boolean; selectedId?: string | null; onSelect?: (id: string | null) => void }) {
  const center = (cards.length - 1) / 2;

  return (
    <div className="playerHandFan" aria-label="Player hand">
      {cards.map((card, index) => {
        const offset = index - center;
        const selected = selectedId === card.instanceId;
        return (
          <div
            className={`playerHandCard ${selected ? "is-selected" : ""}`}
            key={card.instanceId}
            style={{
              transform: `translateX(${offset * 42}px) translateY(${Math.abs(offset) * 8 - (selected ? 52 : 0)}px) rotate(${offset * 7}deg)`,
              zIndex: selected ? 100 : index + 1,
            }}
            onMouseEnter={() => onSelect?.(card.instanceId)}
            onMouseLeave={() => onSelect?.(null)}
          >
            <CardView card={card} onClick={() => onPlay(card.instanceId)} disabled={disabled} selected={selected} />
          </div>
        );
      })}
    </div>
  );
}
