import type { CardInstance } from "../../game/core/types";
import { getBonusPercent } from "../../game/engine/BonusSystem";

export function BonusSlots({ cards }: { cards: CardInstance[] }) {
  const visibleSlots = Array.from({ length: Math.max(4, cards.length) }, (_, index) => cards[index] ?? null);

  return (
    <div className="matchBonusWrap">
      <div className="matchBonusLabel">Bonus cards <b>+{getBonusPercent(cards)}%</b></div>
      <div className="matchBonusSlots">
        {visibleSlots.map((card, index) => (
          <div className="matchBonusSlot" key={card?.instanceId ?? `empty-${index}`}>
            {card ? <img src={card.definition.image} alt={card.definition.title} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
