import type { CardInstance } from "../../game/core/types";
import { getBonusPercent } from "../../game/engine/BonusSystem";

type BonusSlotsProps = {
  cards: CardInstance[];
  slotCount?: number;
  showLabel?: boolean;
  compact?: boolean;
};

function safeCards(cards: CardInstance[]) {
  return Array.isArray(cards) ? cards.filter(Boolean) : [];
}

function getCardImage(card: CardInstance) {
  return card.definition.image || "/cards/card-back.png";
}

function getCardTitle(card: CardInstance) {
  return card.definition.title || card.definition.ruTitle || card.baseId || "Bonus card";
}

function getCardPercent(card: CardInstance) {
  const text = `${card.definition.description ?? ""} ${card.definition.effectKey ?? ""}`;
  const match = text.match(/([+-]?\d+)\s*%/);
  if (!match) return 10;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 10;
}

export function BonusSlots({
  cards,
  slotCount = 4,
  showLabel = false,
  compact = false,
}: BonusSlotsProps) {
  const activeCards = safeCards(cards);
  const totalSlots = Math.max(slotCount, activeCards.length, 1);
  const visibleSlots = Array.from({ length: totalSlots }, (_, index) => activeCards[index] ?? null);
  const totalBonus = getBonusPercent(activeCards);

  const grid = (
    <div
      className={[
        "matchBonusSlots",
        compact ? "is-compact" : "",
        activeCards.length > 0 ? "has-bonus" : "is-empty",
      ].filter(Boolean).join(" ")}
      data-bonus-count={activeCards.length}
      data-bonus-total={totalBonus}
      aria-label={`Bonus cards, ${activeCards.length} active, +${totalBonus}%`}
    >
      {visibleSlots.map((card, index) => {
        if (!card) {
          return (
            <div
              className="matchBonusSlot is-empty"
              key={`empty-bonus-${index}`}
              aria-label={`Empty bonus slot ${index + 1}`}
              title="Empty bonus slot"
            >
              <span aria-hidden="true">+</span>
            </div>
          );
        }

        const title = getCardTitle(card);
        const bonus = getCardPercent(card);

        return (
          <div
            className={[
              "matchBonusSlot",
              "is-filled",
              `is-${card.definition.rarity ?? "common"}`,
            ].join(" ")}
            key={card.instanceId ?? `${card.baseId}-${index}`}
            title={`${title}: +${bonus}%`}
            aria-label={`${title}, bonus +${bonus}%`}
            data-card-id={card.baseId}
            data-rarity={card.definition.rarity}
          >
            <img src={getCardImage(card)} alt={title} draggable={false} />
            <b>+{bonus}%</b>
          </div>
        );
      })}
    </div>
  );

  if (!showLabel) return grid;

  return (
    <div className="matchBonusWrap">
      <div className="matchBonusLabel">
        <span>Bonus cards</span>
        <b>+{totalBonus}%</b>
      </div>
      {grid}
    </div>
  );
}
