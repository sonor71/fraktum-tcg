import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CARDS, RARITY_ORDER } from "../game/cards";
import type { CardRarity, CardType, OwnedCard } from "../game/types";
import { CardView } from "../components/CardView";
import { useGameStore } from "../useGameStore";

export default function Collection() {
  const nav = useNavigate();
  const ownedCards = useGameStore((state) => state.ownedCards);
  const [type, setType] = useState<"all" | CardType>("all");
  const [collection, setCollection] = useState("all");
  const [selected, setSelected] = useState<OwnedCard | null>(null);

  const collections = useMemo(() => Array.from(new Set(CARDS.map((card) => card.collection))), []);
  const cards = useMemo(() => {
    return [...ownedCards]
      .filter((card) => type === "all" || card.type === type)
      .filter((card) => collection === "all" || CARDS.find((base) => base.id === card.baseId)?.collection === collection)
      .sort((a, b) => RARITY_ORDER[b.rarity as CardRarity] - RARITY_ORDER[a.rarity as CardRarity] || a.title.localeCompare(b.title));
  }, [collection, ownedCards, type]);

  return (
    <section className="demo-page">
      <header className="page-head">
        <div><p>Archive</p><h1>Collection</h1></div>
        <button onClick={() => nav("/")} type="button">Back to Hub</button>
      </header>

      <div className="filters glass-panel">
        <label>Type <select value={type} onChange={(event) => setType(event.target.value as "all" | CardType)}><option value="all">All</option><option value="character">Character</option><option value="effect">Effect</option><option value="event">Event</option></select></label>
        <label>Collection <select value={collection} onChange={(event) => setCollection(event.target.value)}><option value="all">All</option>{collections.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <span>{cards.length} owned instances</span>
      </div>

      {ownedCards.length === 0 ? (
        <div className="empty-state glass-panel">
          <h2>No cards in the vault yet</h2>
          <p>Open a demo pack in Market to mint unique local instances.</p>
          <button onClick={() => nav("/shop")} type="button">Go to Market</button>
        </div>
      ) : (
        <div className="two-col">
          <div className="card-grid">{cards.map((card) => <CardView key={card.instanceId} card={card} selected={selected?.instanceId === card.instanceId} onClick={() => setSelected(card)} />)}</div>
          <aside className="detail-panel glass-panel">
            {selected ? <><CardView card={selected} selected /><h2>{selected.title}</h2><p>{CARDS.find((card) => card.id === selected.baseId)?.description}</p><dl><dt>Instance ID</dt><dd>{selected.instanceId}</dd><dt>Collection</dt><dd>{CARDS.find((card) => card.id === selected.baseId)?.collection}</dd></dl></> : <p>Select a card to inspect rarity, source collection, and unique serial.</p>}
          </aside>
        </div>
      )}
    </section>
  );
}
