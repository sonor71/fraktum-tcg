import type { CardInstance } from "../../game/core/types";
import "./match.css";

type CardViewProps = {
  card: CardInstance;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  size?: "hand" | "board" | "pile";
  dragging?: boolean;
};

export function CardView({ card, onClick, disabled, selected, size = "hand", dragging }: CardViewProps) {
  const hasHp = card.definition.health > 0 || card.currentHealth > 0;

  return (
    <button
      className={`matchCardView is-${size} ${selected ? "is-selected" : ""} ${dragging ? "is-dragging" : ""} ${card.temporaryUntilRoundEnd ? "is-temporary" : ""}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${card.definition.title}: ${card.definition.description}`}
    >
      <img src={card.definition.image} alt={card.definition.title} draggable={false} />
      <span className="matchCardBadge is-cost" aria-label={`Will cost ${card.definition.cost}`}>{card.definition.cost}</span>
      {hasHp ? <span className="matchCardBadge is-hp" aria-label={`${card.currentHealth} HP`}>{card.currentHealth} HP</span> : null}
      {card.temporaryUntilRoundEnd ? <span className="matchCardBadge is-temp">TEMP</span> : null}
    </button>
  );
}
