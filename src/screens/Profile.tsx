import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { RARITY_ORDER } from "../game/cards";
import { getAvailableWillUpgradePoints, getXpRequiredForLevel, useGameStore } from "../useGameStore";
import type { OwnedCard } from "../useGameStore";
import { CloudAccountPanel } from "../cloud/CloudAccountPanel";

function getCardImage(card: OwnedCard) {
  return card.frontSrc || card.image || "/cards/card-back.png";
}

function formatNumber(value: number) {
  return Math.max(0, Math.floor(value)).toLocaleString("ru-RU");
}

function ProfileMiniCard({ card }: { card: OwnedCard }) {
  return (
    <article className="profileMiniCard">
      <img src={getCardImage(card)} alt={card.title} draggable={false} />
      <strong>{card.title}</strong>
      <span>{card.instanceId}</span>
    </article>
  );
}

export default function Profile() {
  const nav = useNavigate();
  const playerName = useGameStore((state) => state.playerName);
  const avatar = useGameStore((state) => state.avatar);
  const level = useGameStore((state) => state.level);
  const xp = useGameStore((state) => state.xp);
  const coins = useGameStore((state) => state.coins);
  const premium = useGameStore((state) => state.premium);
  const openedPacksCount = useGameStore((state) => state.openedPacksCount);
  const ownedCards = useGameStore((state) => state.ownedCards);
  const showcaseCardIds = useGameStore((state) => state.showcaseCardIds);
  const deckIds = useGameStore((state) => state.deckIds);
  const wins = useGameStore((state) => state.wins);
  const matchHistory = useGameStore((state) => state.matchHistory);
  const willUpgrades = useGameStore((state) => state.willUpgrades);
  const setPlayerName = useGameStore((state) => state.setPlayerName);
  const setShowcaseCard = useGameStore((state) => state.setShowcaseCard);

  const progress = useMemo(() => {
    const required = getXpRequiredForLevel(level);
    const xpBeforeCurrentLevel = Array.from({ length: Math.max(0, level - 1) }).reduce<number>(
  (sum, _, index) => sum + getXpRequiredForLevel(index + 1),
  0
);

const xpIntoLevel = Math.max(0, xp - xpBeforeCurrentLevel);
    return {
      required,
      xpIntoLevel: Math.min(required, xpIntoLevel),
      percent: Math.max(0, Math.min(100, (xpIntoLevel / Math.max(1, required)) * 100)),
    };
  }, [level, xp]);

  const rarest = useMemo(
    () => [...ownedCards].sort((a, b) => (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0))[0] ?? null,
    [ownedCards]
  );

  const showcase = useMemo(
    () => showcaseCardIds
      .map((id) => ownedCards.find((card) => card.instanceId === id) ?? null)
      .slice(0, 3),
    [ownedCards, showcaseCardIds]
  );

  const recentCards = useMemo(() => [...ownedCards].sort((a, b) => b.obtainedAt - a.obtainedAt).slice(0, 12), [ownedCards]);
  const availableWillPoints = getAvailableWillUpgradePoints(level, willUpgrades);

  return (
    <section className="demo-page profilePage">
      <header className="page-head">
        <div>
          <p>FRAKTUM ACCOUNT</p>
          <h1>Profile</h1>
        </div>
        <button onClick={() => nav("/")} type="button">Back to Hub</button>
      </header>

      <div className="profileSyncBanner profileCloudSyncBanner">
        <CloudAccountPanel />
      </div>

      <div className="profile-grid profileGridFixed">
        <section className="glass-panel profile-card profileIdentityCard">
          <img src={avatar || "/vite.svg"} alt="Avatar" />
          <label>
            <span>Nickname</span>
            <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
          </label>

          <div className="profileLevelBlock">
            <div>
              <span>Level</span>
              <b>{level}</b>
            </div>
            <div className="profileXpBar" title={`${progress.xpIntoLevel}/${progress.required} XP`}>
              <i style={{ width: `${progress.percent}%` }} />
            </div>
            <small>{formatNumber(progress.xpIntoLevel)} / {formatNumber(progress.required)} XP до следующего уровня</small>
          </div>

          <div className="stats profileStatsGrid">
            <span>Coins <b>{formatNumber(coins)}</b></span>
            <span>Premium <b>{formatNumber(premium)}</b></span>
            <span>Packs <b>{formatNumber(openedPacksCount)}</b></span>
            <span>Cards <b>{formatNumber(ownedCards.length)}</b></span>
            <span>Deck <b>{formatNumber(deckIds.length)}</b></span>
            <span>Wins <b>{formatNumber(wins)}</b></span>
          </div>
        </section>

        <section className="glass-panel profilePanelFixed">
          <h2>Match profile</h2>
          <div className="profileStatCards">
            <article><span>Матчей</span><b>{matchHistory.length}</b></article>
            <article><span>Побед</span><b>{wins}</b></article>
            <article><span>Will points</span><b>{availableWillPoints}</b></article>
            <article><span>Will upgrades</span><b>{willUpgrades.maxWill + willUpgrades.regen}</b></article>
          </div>
        </section>

        <section className="glass-panel profilePanelFixed">
          <h2>Showcase Slots</h2>
          <div className="showcase profileShowcaseGrid">
            {[0, 1, 2].map((slot) => {
              const card = showcase[slot];
              return card ? <ProfileMiniCard card={card} key={card.instanceId} /> : <div key={slot} className="slot-empty">Slot {slot + 1}</div>;
            })}
          </div>

          <h3>Choose showcase cards</h3>
          <div className="mini-list profileMiniList">
            {ownedCards.slice(0, 40).map((card, index) => (
              <button key={card.instanceId} onClick={() => setShowcaseCard(index % 3, card.instanceId)} type="button">
                {card.title}
                <small>{card.instanceId}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="glass-panel profilePanelFixed">
          <h2>Favorite / Rarest</h2>
          {rarest ? <ProfileMiniCard card={rarest} /> : <p>No cards yet. Visit Market or Shop.</p>}
        </section>

        <section className="glass-panel profilePanelFixed profileRecentCards">
          <h2>Recent cards</h2>
          <div className="profileRecentGrid">
            {recentCards.length ? recentCards.map((card) => <ProfileMiniCard card={card} key={card.instanceId} />) : <p>No cards yet.</p>}
          </div>
        </section>
      </div>
    </section>
  );
}
