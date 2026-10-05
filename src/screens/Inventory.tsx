import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore, type OwnedCard } from "../useGameStore";
import TiltCard from "../components/TiltCard";
import type { CardEdition, CardRarity } from "../game/types";

type CardItem = OwnedCard;
type InventoryView = "collection" | "craft";

let pendingMarkSeenTimer: number | null = null;
const CRAFT_COST = 10;

const CRAFT_RARITY_CHAIN = [
  "common",
  "rare",
  "epic",
  "mythic",
  "legendary",
  "chromatic",
  "exotic",
  "divine",
  "forgotten",
  "archaic",
] as const;

const RARITY_LABELS: Record<string, string> = {
  common: "Обычные",
  rare: "Редкие",
  epic: "Эпические",
  mythic: "Мифические",
  legendary: "Легендарные",
  chromatic: "Хроматические",
  exotic: "Экзотические",
  divine: "Божественные",
  forgotten: "Забытые",
  archaic: "Архаичные",
};

function normalizeRarity(rarity?: string): CardRarity {
  const value = String(rarity ?? "common").trim().toLowerCase();
  return (CRAFT_RARITY_CHAIN as readonly string[]).includes(value)
    ? (value as CardRarity)
    : "common";
}

function rarityClass(rarity?: string) {
  return `rarity-${normalizeRarity(rarity)}`;
}

function rarityLabel(rarity: string) {
  return RARITY_LABELS[rarity] ?? rarity;
}

function nextRarityOf(rarity: string) {
  const index = CRAFT_RARITY_CHAIN.indexOf(rarity as (typeof CRAFT_RARITY_CHAIN)[number]);
  return index >= 0 ? CRAFT_RARITY_CHAIN[index + 1] ?? null : null;
}

export default function Inventory() {
  const nav = useNavigate();
  const owned = useGameStore((s) => s.ownedCards);
  const deckIds = useGameStore((s) => s.deckIds);
  const addToDeck = useGameStore((s) => s.addToDeck);
  const craftCardsByRarity = useGameStore((s) => s.craftCardsByRarity);
  const markAllCardsAsSeen = useGameStore((s) => s.markAllCardsAsSeen);

  const cards = useMemo<CardItem[]>(() => [...owned], [owned]);
  const [view, setView] = useState<InventoryView>("collection");
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [craftMessage, setCraftMessage] = useState<string | null>(null);

  useEffect(() => {
    if (pendingMarkSeenTimer !== null) {
      window.clearTimeout(pendingMarkSeenTimer);
      pendingMarkSeenTimer = null;
    }
    return () => {
      pendingMarkSeenTimer = window.setTimeout(() => {
        markAllCardsAsSeen();
        pendingMarkSeenTimer = null;
      }, 100);
    };
  }, [markAllCardsAsSeen]);

  const selected = cards.find((card) => card.instanceId === selectedId) ?? null;

  const filteredCards = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("ru");
    return cards.filter((card) => {
      if (rarity !== "all" && normalizeRarity(card.rarity) !== rarity) return false;
      if (!q) return true;
      return [card.title, card.baseId, card.instanceId]
        .some((value) => String(value ?? "").toLocaleLowerCase("ru").includes(q));
    });
  }, [cards, query, rarity]);

  const craftRows = useMemo(() => {
    const counts: Record<string, { serial: number; foil: number }> = {};
    for (const rarityName of CRAFT_RARITY_CHAIN) counts[rarityName] = { serial: 0, foil: 0 };

    for (const card of cards) {
      const rarityName = normalizeRarity(card.rarity);
      if (card.edition === "foil_serial" || card.isFoil) counts[rarityName].foil += 1;
      else counts[rarityName].serial += 1;
    }

    return CRAFT_RARITY_CHAIN.slice(0, -1).map((rarityName) => ({
      rarity: rarityName,
      nextRarity: nextRarityOf(rarityName),
      serial: counts[rarityName].serial,
      foil: counts[rarityName].foil,
    }));
  }, [cards]);

  function handleCraft(rarityName: CardRarity, edition: CardEdition) {
    const crafted = craftCardsByRarity(rarityName, edition);
    if (!crafted) {
      setCraftMessage("Недостаточно карт: нужно 10 карт одной редкости и одной серии.");
      return;
    }
    setCraftMessage(`Готово: ${crafted.title} · ${rarityLabel(normalizeRarity(crafted.rarity))}`);
  }

  function addSelectedToDeck() {
    if (!selected) return;
    addToDeck(selected.instanceId);
    setSelectedId(null);
  }

  return (
    <div className="invRoot invRootV2">
      <header className="invV2Header">
        <div>
          <span>КОЛЛЕКЦИЯ FRAKTUM</span>
          <h1>Инвентарь</h1>
        </div>
        <button className="invDeckBtn" type="button" onClick={() => nav("/deck")}>
          КОЛОДА <span className="invDeckCount">{deckIds.length}</span>
        </button>
      </header>

      <nav className="invV2Tabs" aria-label="Разделы инвентаря">
        <button
          type="button"
          className={view === "collection" ? "is-active" : ""}
          onClick={() => setView("collection")}
        >
          КОЛЛЕКЦИЯ
        </button>
        <button
          type="button"
          className={view === "craft" ? "is-active" : ""}
          onClick={() => setView("craft")}
        >
          КРАФТ
        </button>
      </nav>

      {view === "collection" ? (
        <>
          <div className="invV2Toolbar">
            <label className="invSearch">
              <span>ПОИСК</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Название карты"
                inputMode="search"
              />
            </label>
            <label className="invRarityFilter">
              <span>РЕДКОСТЬ</span>
              <select value={rarity} onChange={(event) => setRarity(event.target.value)}>
                <option value="all">Все</option>
                {CRAFT_RARITY_CHAIN.map((rarityName) => (
                  <option key={rarityName} value={rarityName}>{rarityLabel(rarityName)}</option>
                ))}
              </select>
            </label>
            <div className="invV2Count">{filteredCards.length} карт</div>
          </div>

          <div className="invTablet invTablet--clean invTabletV2">
            <div className="invGrid invGridV2">
              {filteredCards.length === 0 ? (
                <div className="invEmptyV2">Ничего не найдено.</div>
              ) : filteredCards.map((card) => {
                const isFoil = Boolean(card.isFoil || card.edition === "foil_serial");
                return (
                  <button
                    key={card.instanceId}
                    type="button"
                    className={`invCard invCardV2 ${isFoil ? "hasFoil" : ""}`}
                    onClick={() => setSelectedId(card.instanceId)}
                    aria-label={card.title}
                  >
                    <div className={`invCardVisual ${rarityClass(card.rarity)} ${isFoil ? "hasFoil" : ""}`}>
                      <TiltCard
                        rarity={normalizeRarity(card.rarity)}
                        isFoil={isFoil}
                        maskSrc={card.frontSrc}
                        className="invTiltCard"
                      >
                        <img className="invCardImg" src={card.frontSrc} alt={card.title} draggable={false} />
                        {isFoil ? <div className="foilBadge">FOIL</div> : null}
                        {card.isNew ? <div className="invNewBadge">NEW</div> : null}
                      </TiltCard>
                    </div>
                    <span className="invCardTitleV2">{card.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <section className="invCraftPanel invCraftPanelV2">
          <div className="invCraftHead">
            <div>
              <strong>КРАФТ КАРТ</strong>
              <span>10 одинаковых по серии карт одной редкости → 1 карта следующей редкости.</span>
            </div>
          </div>

          <div className="invCraftListV2">
            {craftRows.map((row) => (
              <article key={row.rarity} className="invCraftRowV2">
                <div className="invCraftRarityV2">
                  <strong>{rarityLabel(row.rarity)}</strong>
                  <span>→ {row.nextRarity ? rarityLabel(row.nextRarity) : "MAX"}</span>
                </div>
                <button
                  type="button"
                  disabled={row.serial < CRAFT_COST}
                  onClick={() => handleCraft(row.rarity, "serial")}
                >
                  SERIAL <b>{row.serial}/{CRAFT_COST}</b>
                </button>
                <button
                  type="button"
                  className="isFoilCraft"
                  disabled={row.foil < CRAFT_COST}
                  onClick={() => handleCraft(row.rarity, "foil_serial")}
                >
                  FOIL <b>{row.foil}/{CRAFT_COST}</b>
                </button>
              </article>
            ))}
          </div>

          {craftMessage ? <div className="invCraftMessage">{craftMessage}</div> : null}
        </section>
      )}

      {selected ? (
        <div className="invCardSheetScrim" role="presentation" onClick={() => setSelectedId(null)}>
          <section
            className="invCardSheet"
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
            onClick={(event) => event.stopPropagation()}
          >
            <button className="invSheetClose" type="button" onClick={() => setSelectedId(null)} aria-label="Закрыть">×</button>
            <img src={selected.frontSrc} alt={selected.title} />
            <div className="invSheetInfo">
              <span>{rarityLabel(normalizeRarity(selected.rarity))}{selected.isFoil ? " · FOIL" : ""}</span>
              <h2>{selected.title}</h2>
              <small>{selected.instanceId}</small>
              <div className="invSheetActions">
                <button type="button" className="is-primary" onClick={addSelectedToDeck}>ДОБАВИТЬ В КОЛОДУ</button>
                <button type="button" onClick={() => nav("/deck")}>ОТКРЫТЬ КОЛОДУ</button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
