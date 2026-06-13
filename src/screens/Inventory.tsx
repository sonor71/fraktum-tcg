import { useEffect, useMemo, type DragEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore, type OwnedCard } from "../useGameStore";
import TiltCard from "../components/TiltCard";
import type { CardEdition, CardRarity } from "../game/types";

type CardItem = OwnedCard;

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

const NEXT_RARITY_LABELS: Record<string, string> = {
  common: "редкую",
  rare: "эпическую",
  epic: "мифическую",
  mythic: "легендарную",
  legendary: "хроматическую",
  chromatic: "экзотическую",
  exotic: "божественную",
  divine: "забытую",
  forgotten: "архаичную",
};

function normalizeRarity(rarity?: string): CardRarity {
  const normalized = String(rarity ?? "common").trim().toLowerCase();
  return (CRAFT_RARITY_CHAIN as readonly string[]).includes(normalized)
    ? (normalized as CardRarity)
    : "common";
}

function nextRarityOf(rarity: string) {
  const index = CRAFT_RARITY_CHAIN.indexOf(rarity as (typeof CRAFT_RARITY_CHAIN)[number]);
  return index >= 0 ? CRAFT_RARITY_CHAIN[index + 1] ?? null : null;
}

function rarityLabel(rarity: string) {
  return RARITY_LABELS[rarity] ?? rarity;
}

function nextRarityLabel(rarity: string) {
  return NEXT_RARITY_LABELS[rarity] ?? rarity;
}

function rarityClass(rarity?: string) {
  const value = normalizeRarity(rarity);

  if (value.includes("archaic") || value.includes("арха")) return "rarity-archaic";
  if (value.includes("forgotten") || value.includes("забыт")) return "rarity-forgotten";
  if (value.includes("divine") || value.includes("боже")) return "rarity-divine";
  if (value.includes("exotic") || value.includes("экзот")) return "rarity-exotic";
  if (value.includes("chromatic") || value.includes("хром")) return "rarity-chromatic";
  if (value.includes("mythic") || value.includes("миф")) return "rarity-mythic";
  if (value.includes("legendary") || value.includes("леген")) return "rarity-legendary";
  if (value.includes("epic") || value.includes("эпич")) return "rarity-epic";
  if (value.includes("rare") || value.includes("редк")) return "rarity-rare";
  return "rarity-common";
}

export default function Inventory() {
  const nav = useNavigate();

  const owned = useGameStore((s) => s.ownedCards);
  const deckIds = useGameStore((s) => s.deckIds);
  const addToDeck = useGameStore((s) => s.addToDeck);
  const craftCardsByRarity = useGameStore((s) => s.craftCardsByRarity);
  const markAllCardsAsSeen = useGameStore((s) => s.markAllCardsAsSeen);

  const cards = useMemo<CardItem[]>(() => [...owned], [owned]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [funnelHover, setFunnelHover] = useState(false);
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

  const craftRows = useMemo(() => {
    const counts: Record<string, { serial: number; foil: number }> = {};

    for (const rarity of CRAFT_RARITY_CHAIN) {
      counts[rarity] = { serial: 0, foil: 0 };
    }

    for (const card of cards) {
      const rarity = normalizeRarity(card.rarity);
      if (!counts[rarity]) continue;

      if (card.edition === "foil_serial" || card.isFoil) {
        counts[rarity].foil += 1;
      } else {
        counts[rarity].serial += 1;
      }
    }

    return CRAFT_RARITY_CHAIN.slice(0, -1).flatMap((rarity) => {
      const nextRarity = nextRarityOf(rarity);
      const rowCounts = counts[rarity] ?? { serial: 0, foil: 0 };

      return [
        {
          rarity,
          nextRarity,
          edition: "serial" as CardEdition,
          title: "Serial",
          count: rowCounts.serial,
          canCraft: rowCounts.serial >= CRAFT_COST && Boolean(nextRarity),
        },
        {
          rarity,
          nextRarity,
          edition: "foil_serial" as CardEdition,
          title: "Foil Serial",
          count: rowCounts.foil,
          canCraft: rowCounts.foil >= CRAFT_COST && Boolean(nextRarity),
        },
      ];
    });
  }, [cards]);

  function onDragStart(e: DragEvent<HTMLDivElement>, card: CardItem) {
    setDraggingId(card.instanceId);
    e.dataTransfer.setData("text/plain", card.instanceId);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragEnd() {
    setDraggingId(null);
    setFunnelHover(false);
  }

  function onFunnelDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setFunnelHover(true);
  }

  function onFunnelDragLeave() {
    setFunnelHover(false);
  }

  function onFunnelDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setFunnelHover(false);

    const instanceId = e.dataTransfer.getData("text/plain");
    if (!instanceId) return;

    const card = cards.find((c) => c.instanceId === instanceId);
    if (!card) return;

    addToDeck(card.instanceId);
    setDraggingId(null);
  }

  function handleCraft(rarity: CardRarity, edition: CardEdition) {
    const crafted = craftCardsByRarity(rarity, edition);

    if (!crafted) {
      const nextRarity = nextRarityOf(rarity);
      const editionLabel = edition === "foil_serial" ? "Foil Serial" : "Serial";

      setCraftMessage(
        nextRarity
          ? `Нельзя скрафтить ${editionLabel} ${nextRarityLabel(rarity)} карту: нужно 10 карт этой же серии и редкости.`
          : "Эту редкость нельзя улучшить дальше."
      );
      return;
    }

    setCraftMessage(
      `Скрафчено: ${crafted.title} → ${rarityLabel(normalizeRarity(crafted.rarity))}${
        crafted.isFoil ? " / FOIL SERIAL" : " / SERIAL"
      }`
    );
  }

  return (
    <div className="invRoot">
      <div className="invTopRow">
        <button className="invDeckBtn" onClick={() => nav("/deck")}>
          КОЛОДА <span className="invDeckCount">{deckIds.length}</span>
        </button>

        <div
          className={`invFunnel ${funnelHover ? "isHover" : ""}`}
          title="Перетащи карту сюда, чтобы добавить в колоду"
          onDragOver={onFunnelDragOver}
          onDragLeave={onFunnelDragLeave}
          onDrop={onFunnelDrop}
        >
          <div className="invFunnelInner" />
          <div className="invFunnelHint">воронка</div>
        </div>
      </div>

      <section className="invCraftPanel">
        <div className="invCraftHead">
          <div>
            <strong>КРАФТ КАРТ</strong>
            <span>10 карт одной редкости → 1 карта следующей редкости. Serial и Foil Serial крафтятся отдельно.</span>
          </div>
        </div>

        <div className="invCraftGrid">
          {craftRows.map((row) => (
            <button
              key={`${row.rarity}-${row.edition}`}
              type="button"
              className={`invCraftBtn ${row.canCraft ? "canCraft" : ""} ${
                row.edition === "foil_serial" ? "isFoilCraft" : ""
              }`}
              disabled={!row.canCraft}
              onClick={() => handleCraft(row.rarity, row.edition)}
              title={
                row.nextRarity
                  ? `Скрафтить ${row.title} ${nextRarityLabel(row.rarity)} карту`
                  : "Последняя редкость"
              }
            >
              <strong>
                {row.title} · {rarityLabel(row.rarity)}
              </strong>
              <span>
                {row.count}/{CRAFT_COST} → {row.nextRarity ? rarityLabel(row.nextRarity) : "MAX"}
              </span>
            </button>
          ))}
        </div>

        {craftMessage ? <div className="invCraftMessage">{craftMessage}</div> : null}
      </section>

      <div className="invTablet invTablet--clean">
        <div className="invScrollArea">
          <div className="invGrid">
            {cards.length === 0 ? (
              <div style={{ opacity: 0.7, padding: 12 }}>
                Инвентарь пуст — открой пак в магазине.
              </div>
            ) : (
              cards.map((c) => {
                const isFoil = Boolean(c.isFoil);

                return (
                  <div
                    key={c.instanceId}
                    className={`invCard ${draggingId === c.instanceId ? "isDragging" : ""} ${isFoil ? "hasFoil" : ""}`}
                    draggable
                    onDragStart={(e) => onDragStart(e, c)}
                    onDragEnd={onDragEnd}
                    onDoubleClick={() => addToDeck(c.instanceId)}
                    title={isFoil ? `${c.title} · FOIL SERIAL` : c.title}
                  >
                    <div className={`invCardVisual ${rarityClass(c.rarity)} ${isFoil ? "hasFoil" : ""}`}>
                      <TiltCard
                        rarity={normalizeRarity(c.rarity)}
                        isFoil={isFoil}
                        maskSrc={c.frontSrc}
                        className="invTiltCard"
                      >
                        <img className="invCardImg" src={c.frontSrc} alt={c.title} draggable={false} />

                        {isFoil ? <div className="foilBadge">FOIL SERIAL</div> : null}

                        {typeof c.marketValue === "number" ? (
                          <div className="cardValueBadge">₵ {c.marketValue.toLocaleString("ru-RU")}</div>
                        ) : null}

                        {c.isNew ? <div className="invNewBadge">NEW</div> : null}

                        <div className="invInstanceId">{c.instanceId}</div>
                      </TiltCard>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <button className="invBackBtn" onClick={() => nav("/")}>
        НАЗАД В МЕНЮ
      </button>
    </div>
  );
}
