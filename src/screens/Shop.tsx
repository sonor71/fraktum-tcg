import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardView } from "../components/CardView";
import { getRandomCards } from "../game/cards";
import type { OwnedCard } from "../game/types";
import { playPackOpen, playRareDrop } from "../services/audio";
import { useGameStore } from "../useGameStore";

const PACK_COST = 100;

export default function Shop() {
  const nav = useNavigate();
  const coins = useGameStore((state) => state.coins);
  const spendCoins = useGameStore((state) => state.spendCoins);
  const openPack = useGameStore((state) => state.openPack);
  const giveDemoCoins = useGameStore((state) => state.giveDemoCoins);
  const [warning, setWarning] = useState("");
  const [revealed, setRevealed] = useState(0);
  const [cards, setCards] = useState<OwnedCard[]>([]);

  function buyPack() {
    if (!spendCoins(PACK_COST)) {
      setWarning("Not enough coins. Use Give demo coins for testing.");
      return;
    }
    const issued = openPack(getRandomCards(5));
    setCards(issued);
    setRevealed(0);
    setWarning("");
    playPackOpen();
    if (issued.some((card) => ["epic", "legendary", "mythic"].includes(card.rarity))) playRareDrop();
  }

  return (
    <section className="demo-page shop-demo">
      <header className="page-head"><div><p>Market</p><h1>Pack Opening</h1></div><button onClick={() => nav("/")} type="button">Back to Hub</button></header>
      <div className="shop-hero glass-panel"><div className="pack-orb"><img src="/packs/normal.png" alt="Demo pack" onError={(event) => { event.currentTarget.src = "/packs/egypt.png"; }} /></div><div><h2>Fraktum Demo Pack</h2><p>5 cards · 100 coins · local unique serials</p><p className="coin-line">Balance: {coins} coins</p><button onClick={buyPack} type="button">Open Pack</button><button className="ghost" onClick={giveDemoCoins} type="button">Give demo coins</button>{warning ? <p className="warning">{warning}</p> : null}</div></div>
      {cards.length > 0 ? <div className="pack-results">{cards.map((card, index) => <div key={card.instanceId} className={`reveal-slot ${index < revealed ? "is-open" : ""}`}><CardView card={card} compact={index >= revealed} onClick={() => setRevealed(Math.max(revealed, index + 1))} /></div>)}<button onClick={() => setRevealed(cards.length)} type="button">Reveal all / Add to collection</button><button onClick={() => { setCards([]); setRevealed(0); }} type="button">Continue</button></div> : null}
    </section>
  );
}
