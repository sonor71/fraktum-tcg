import type { CardInstance } from "../../game/core/types";
import "./match.css";

type CardViewProps = {
  card: CardInstance;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  size?: "hand" | "board" | "pile";
};

export function CardView({ card, onClick, disabled, selected, size = "hand" }: CardViewProps) {
  return (
    <button
      className={`matchCardView is-${size} ${selected ? "is-selected" : ""}`}
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      title={`${card.definition.title}: ${card.definition.description}`}
    >
      <img src={card.definition.image} alt={card.definition.title} draggable={false} />
    </button>
  );
}
