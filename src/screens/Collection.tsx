import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CARDS, RARITY_ORDER } from "../game/cards";
import type {
  CardDefinition,
  CardType,
  OwnedCard,
} from "../game/types";

import { useGameStore } from "../useGameStore";
import TiltCard from "../components/TiltCard";

type FilterValue<T extends string> = "all" | T;

function getCardImage(card: CardDefinition) {
  const extended = card as CardDefinition & {
    frontSrc?: string;
    image?: string;
  };

  return extended.frontSrc ?? extended.image ?? "/cards/card-back.png";
}

function getRarityRank(card: CardDefinition) {
  const rarity = String(card.rarity) as keyof typeof RARITY_ORDER;
  return RARITY_ORDER[rarity] ?? 0;
}

function getOwnedBaseId(card: OwnedCard) {
  const extended = card as OwnedCard & {
    baseId?: string;
    id?: string;
  };

  return extended.baseId ?? extended.id ?? "";
}

function rarityLabel(rarity: string) {
  const labels: Record<string, string> = {
    common: "Обычная",
    rare: "Редкая",
    epic: "Эпическая",
    mythic: "Мифическая",
    legendary: "Легендарная",
    chromatic: "Хроматическая",
    exotic: "Экзотическая",
    divine: "Божественная",
    forgotten: "Забытая",
    archaic: "Архаичная",
  };

  return labels[rarity] ?? rarity;
}

export default function Collection() {
  const nav = useNavigate();

  const ownedCards = useGameStore((state) => state.ownedCards);

  const [type, setType] = useState<FilterValue<CardType>>("all");
  const [collection, setCollection] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ownedByBaseId = useMemo(() => {
    const map = new Map<string, OwnedCard[]>();

    for (const ownedCard of ownedCards) {
      const baseId = getOwnedBaseId(ownedCard);
      if (!baseId) continue;

      const list = map.get(baseId) ?? [];
      list.push(ownedCard);
      map.set(baseId, list);
    }

    return map;
  }, [ownedCards]);

  const collections = useMemo(() => {
    return Array.from(new Set(CARDS.map((card) => card.collection))).filter(Boolean);
  }, []);

  const cards = useMemo(() => {
    return [...CARDS]
      .filter((card) => type === "all" || card.type === type)
      .filter((card) => collection === "all" || card.collection === collection)
      .sort((a, b) => {
        const rarityDiff = getRarityRank(b) - getRarityRank(a);
        if (rarityDiff !== 0) return rarityDiff;

        return a.title.localeCompare(b.title);
      });
  }, [collection, type]);

  const selectedCard = useMemo(() => {
    return cards.find((card) => card.id === selectedId) ?? cards[0] ?? null;
  }, [cards, selectedId]);

  const ownedUniqueCount = useMemo(() => {
    return CARDS.filter((card) => ownedByBaseId.has(card.id)).length;
  }, [ownedByBaseId]);

  return (
    <section className="demo-page">
      <header className="page-head">
        <div>
          <p>Archive</p>
          <h1>Collection</h1>
        </div>

        <button onClick={() => nav("/")} type="button">
          Back to Hub
        </button>
      </header>

      <div className="filters glass-panel">
        <label>
          Type{" "}
          <select
            value={type}
            onChange={(event) => setType(event.target.value as FilterValue<CardType>)}
          >
            <option value="all">All</option>
            <option value="character">Character</option>
            <option value="attack">Attack</option>
            <option value="tactic">Tactic</option>
            <option value="effect">Effect</option>
            <option value="bonus">Bonus</option>
          </select>
        </label>

        <label>
          Collection{" "}
          <select
            value={collection}
            onChange={(event) => setCollection(event.target.value)}
          >
            <option value="all">All</option>

            {collections.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <span>
          {ownedUniqueCount}/{CARDS.length} cards collected
        </span>
      </div>

      <div className="two-col">
        <div className="card-grid">
          {cards.map((card) => {
            const ownedInstances = ownedByBaseId.get(card.id) ?? [];
            const foilInstance = ownedInstances.find((ownedCard) => ownedCard.isFoil);
            const displayInstance = foilInstance ?? ownedInstances[0];
            const isOwned = ownedInstances.length > 0;
            const hasFoil = Boolean(foilInstance);
            const image = displayInstance?.frontSrc ?? getCardImage(card);
            const isSelected = selectedCard?.id === card.id;

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setSelectedId(card.id)}
                className="glass-panel"
                title={
                  isOwned
                    ? `${card.title} — owned x${ownedInstances.length}`
                    : `${card.title} — not obtained`
                }
                style={{
                  position: "relative",
                  display: "grid",
                  gap: 10,
                  padding: 12,
                  borderRadius: 18,
                  border: isSelected
                    ? "1px solid rgba(255, 220, 120, 0.9)"
                    : "1px solid rgba(150, 224, 255, 0.16)",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "#eef8ff",
                  overflow: "hidden",
                  opacity: isOwned ? 1 : 0.58,
                  boxShadow: isSelected
                    ? "0 0 28px rgba(255, 210, 90, 0.22)"
                    : undefined,
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "29 / 40",
                    borderRadius: 14,
                    overflow: "hidden",
                    background: "rgba(0, 0, 0, 0.35)",
                  }}
                >
                  <TiltCard rarity={card.rarity} isFoil={hasFoil} maskSrc={image} className="collectionTiltCard">
                    <img
                      src={image}
                      alt={card.title}
                      style={{
                        display: "block",
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        filter: isOwned
                          ? "none"
                          : "grayscale(1) brightness(0.32) contrast(0.95)",
                      }}
                    />

                    {!isOwned && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          zIndex: 8,
                          display: "grid",
                          placeItems: "center",
                          background:
                            "linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0.62))",
                          color: "rgba(255, 255, 255, 0.86)",
                          fontWeight: 900,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          fontSize: 12,
                        }}
                      >
                        LOCKED
                      </div>
                    )}

                    {hasFoil ? <div className="foilBadge">FOIL</div> : null}

                    {isOwned && ownedInstances.length > 1 && (
                      <div
                        style={{
                          position: "absolute",
                          right: 8,
                          bottom: 8,
                          zIndex: 8,
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: "rgba(0, 0, 0, 0.72)",
                          color: "#fff4c7",
                          fontWeight: 900,
                          fontSize: 12,
                        }}
                      >
                        x{ownedInstances.length}
                      </div>
                    )}
                  </TiltCard>
                </div>

                <div style={{ display: "grid", gap: 4 }}>
                  <strong style={{ fontSize: 14 }}>{card.title}</strong>

                  <span
                    style={{
                      color: isOwned
                        ? "rgba(255, 236, 170, 0.92)"
                        : "rgba(220, 230, 240, 0.48)",
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: "uppercase",
                    }}
                  >
                    {rarityLabel(String(card.rarity))}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <aside className="detail-panel glass-panel">
          {selectedCard ? (
            (() => {
              const selectedOwnedInstances = ownedByBaseId.get(selectedCard.id) ?? [];
              const selectedFoilInstance = selectedOwnedInstances.find((ownedCard) => ownedCard.isFoil);
              const selectedDisplayInstance = selectedFoilInstance ?? selectedOwnedInstances[0];
              const selectedIsOwned = selectedOwnedInstances.length > 0;
              const selectedHasFoil = Boolean(selectedFoilInstance);

              return (
                <>
                  <div
                    style={{
                      width: "min(260px, 100%)",
                      margin: "0 auto 18px",
                      opacity: selectedIsOwned ? 1 : 0.52,
                    }}
                  >
                    <TiltCard
                      rarity={selectedCard.rarity}
                      isFoil={selectedHasFoil}
                      maskSrc={selectedDisplayInstance?.frontSrc ?? getCardImage(selectedCard)}
                      className="collectionDetailTiltCard"
                    >
                      <img
                        src={selectedDisplayInstance?.frontSrc ?? getCardImage(selectedCard)}
                        alt={selectedCard.title}
                        style={{
                          display: "block",
                          width: "100%",
                          borderRadius: 18,
                          filter: selectedIsOwned
                            ? "none"
                            : "grayscale(1) brightness(0.38)",
                        }}
                      />

                      {selectedHasFoil ? <div className="foilBadge">FOIL SERIAL</div> : null}
                    </TiltCard>
                  </div>

              <h2>{selectedCard.title}</h2>

              <p>{selectedCard.description}</p>

              <dl>
                <dt>Status</dt>
                <dd>
                  {selectedIsOwned
                    ? `Owned x${selectedOwnedInstances.length}${selectedHasFoil ? " · Foil version owned" : ""}`
                    : "Not obtained"}
                </dd>

                <dt>Rarity</dt>
                <dd>{rarityLabel(String(selectedCard.rarity))}</dd>

                <dt>Type</dt>
                <dd>{selectedCard.type}</dd>

                <dt>Collection</dt>
                <dd>{selectedCard.collection}</dd>

                {selectedIsOwned && (
                  <>
                    <dt>First Instance ID</dt>
                    <dd>{selectedOwnedInstances[0]?.instanceId}</dd>

                    {selectedHasFoil ? (
                      <>
                        <dt>Foil Serial ID</dt>
                        <dd>{selectedFoilInstance?.instanceId}</dd>
                      </>
                    ) : null}

                    {typeof selectedDisplayInstance?.marketValue === "number" ? (
                      <>
                        <dt>Estimated Value</dt>
                        <dd>₵ {selectedDisplayInstance.marketValue.toLocaleString("ru-RU")}</dd>
                      </>
                    ) : null}
                  </>
                )}
                </dl>
              </>
            );
          })()
          ) : (
            <p>Select a card to inspect rarity, source collection, and unique serial.</p>
          )}
        </aside>
      </div>
    </section>
  );
}