import type { OwnedCard } from "../game/types";

export function CardView({ card, selected = false, compact = false, onClick }: { card: OwnedCard; selected?: boolean; compact?: boolean; onClick?: () => void }) {
  return (
    <button className={`fr-card rarity-${card.rarity} ${selected ? "is-selected" : ""} ${compact ? "is-compact" : ""}`} onClick={onClick} type="button">
      <div className="fr-card__image">
        <img src={card.image} alt={card.title} onError={(event) => { event.currentTarget.src = `/cards/placeholder-${card.rarity}.png`; }} />
      </div>
      <div className="fr-card__body">
        <strong>{card.title}</strong>
        <span>{card.rarity} · {card.type}</span>
        <small>{card.instanceId}</small>
      </div>
    </button>
  );
}
