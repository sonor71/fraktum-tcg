import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CardView } from "../components/CardView";
import { useGameStore } from "../useGameStore";

const MAX_DECK = 20;
const MIN_MATCH_DECK = 10;

export default function DeckBuilder() {
  const nav = useNavigate();
  const ownedCards = useGameStore((state) => state.ownedCards);
  const deckIds = useGameStore((state) => state.deckIds);
  const addToDeck = useGameStore((state) => state.addToDeck);
  const removeFromDeck = useGameStore((state) => state.removeFromDeck);
  const clearDeck = useGameStore((state) => state.clearDeck);
  const deckCards = useMemo(() => deckIds.map((id) => ownedCards.find((card) => card.instanceId === id)).filter(Boolean), [deckIds, ownedCards]);
  const isValid = deckIds.length >= MIN_MATCH_DECK;

  return (
    <section className="demo-page">
      <header className="page-head"><div><p>Forge</p><h1>Deck Builder</h1></div><button onClick={() => nav("/")} type="button">Back to Hub</button></header>
      <div className="deck-layout">
        <section className="glass-panel deck-column"><h2>Owned Cards</h2><p>Different instance IDs may repeat the same base card in demo.</p><div className="card-grid small">{ownedCards.map((card) => <CardView key={card.instanceId} card={card} selected={deckIds.includes(card.instanceId)} compact onClick={() => addToDeck(card.instanceId)} />)}</div></section>
        <aside className="glass-panel deck-column"><div className="deck-head"><h2>Current Deck</h2><strong>{deckIds.length}/{MAX_DECK}</strong></div><div className="deck-actions"><button onClick={clearDeck} disabled={deckIds.length === 0} type="button">Clear</button><button onClick={() => nav("/match-launcher")} disabled={!isValid} type="button">Start Match</button></div>{!isValid ? <p className="warning">Minimum {MIN_MATCH_DECK} cards required to launch Unity match.</p> : <p className="success">Deck valid for demo arena.</p>}<div className="deck-list">{deckCards.map((card) => card ? <button key={card.instanceId} className={`deck-row rarity-${card.rarity}`} onClick={() => removeFromDeck(card.instanceId)} type="button"><span>{card.title}</span><small>{card.instanceId}</small></button> : null)}</div></aside>
      </div>
    </section>
  );
}
