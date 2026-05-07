import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CardView } from "../components/CardView";
import { RARITY_ORDER } from "../game/cards";
import { useGameStore } from "../useGameStore";

export default function Profile() {
  const nav = useNavigate();
  const state = useGameStore();
  const rarest = useMemo(() => [...state.ownedCards].sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity])[0], [state.ownedCards]);
  const showcase = state.showcaseCardIds.map((id) => state.ownedCards.find((card) => card.instanceId === id)).filter(Boolean);

  return (
    <section className="demo-page">
      <header className="page-head"><div><p>Identity</p><h1>Profile</h1></div><button onClick={() => nav("/")} type="button">Back to Hub</button></header>
      <div className="profile-grid">
        <section className="glass-panel profile-card"><img src={state.avatar} alt="Avatar" /><input value={state.playerName} onChange={(event) => state.setPlayerName(event.target.value)} /><div className="stats"><span>Level <b>{state.level}</b></span><span>XP <b>{state.xp}</b></span><span>Coins <b>{state.coins}</b></span><span>Packs <b>{state.openedPacksCount}</b></span><span>Cards <b>{state.ownedCards.length}</b></span></div></section>
        <section className="glass-panel"><h2>Showcase Slots</h2><div className="showcase">{[0,1,2].map((slot) => showcase[slot] ? <CardView key={showcase[slot]!.instanceId} card={showcase[slot]!} compact /> : <div key={slot} className="slot-empty">Slot {slot + 1}</div>)}</div><h3>Choose showcase cards</h3><div className="mini-list">{state.ownedCards.map((card) => <button key={card.instanceId} onClick={() => state.setShowcaseCard(Math.min(showcase.length, 2), card.instanceId)} type="button">{card.title}<small>{card.instanceId}</small></button>)}</div></section>
        <section className="glass-panel"><h2>Favorite / Rarest</h2>{rarest ? <CardView card={rarest} /> : <p>No cards yet. Visit Market.</p>}</section>
      </div>
    </section>
  );
}
