import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import TiltCard from "../components/TiltCard";
import {
  AUCTION_HOUSE_FEE_RATE,
  CARDS,
  getMarketCardPrice,
  useGameStore,
} from "../useGameStore";
import type {
  AuctionListing,
  CardDefinition,
  CardEdition,
  CardRarity,
  OwnedCard,
} from "../game/types";
import "./market.css";

type MarketTab = "buy" | "sell" | "auctions";
type EditionFilter = "all" | CardEdition;
type RarityFilter = "all" | CardRarity;

type CatalogOffer = {
  key: string;
  definition: CardDefinition;
  edition: CardEdition;
  price: number;
  preview: OwnedCard;
};

const DURATION_OPTIONS = [
  { value: 1, label: "1 минута · тест" },
  { value: 60, label: "1 час" },
  { value: 360, label: "6 часов" },
  { value: 1440, label: "24 часа" },
] as const;

const RARITY_LABELS: Record<CardRarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  mythic: "Mythic",
  legendary: "Legendary",
  chromatic: "Chromatic",
  exotic: "Exotic",
  divine: "Divine",
  forgotten: "Forgotten",
  archaic: "Archaic",
};

const RARITY_ORDER: Record<CardRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  mythic: 3,
  legendary: 4,
  chromatic: 5,
  exotic: 6,
  divine: 7,
  forgotten: 8,
  archaic: 9,
};

function formatPremium(value: number) {
  return `${Math.max(0, Math.floor(value)).toLocaleString("ru-RU")} P`;
}

function formatRemaining(endsAt: number, now: number) {
  const remaining = Math.max(0, endsAt - now);
  const totalSeconds = Math.ceil(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}д ${hours}ч`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function statusLabel(listing: AuctionListing) {
  if (listing.status === "active") return listing.bidCount > 0 ? "Идут торги" : "Ожидает ставку";
  if (listing.status === "sold") return listing.claimedAt ? "Выплачено" : "Продано";
  if (listing.status === "expired") return listing.claimedAt ? "Карта возвращена" : "Не продано";
  return "Отменено";
}

function createPreviewCard(definition: CardDefinition, edition: CardEdition): OwnedCard {
  const isFoil = edition === "foil_serial";
  return {
    instanceId: `MARKET-${definition.id}-${edition}`,
    baseId: definition.id,
    title: definition.title,
    rarity: definition.rarity,
    type: definition.type,
    image: definition.image,
    frontSrc: definition.frontSrc ?? definition.image,
    packId: "market-preview",
    obtainedAt: 0,
    edition,
    isFoil,
    foilColor: isFoil ? definition.rarity : undefined,
    marketValue: getMarketCardPrice(definition.rarity, edition),
    cost: definition.cost,
    attack: definition.attack,
    health: definition.health,
    description: definition.description,
    effectKey: definition.effectKey,
    collection: definition.collection,
  };
}

function CardArtwork({ card, className = "" }: { card: OwnedCard; className?: string }) {
  return (
    <TiltCard
      rarity={card.rarity}
      isFoil={card.isFoil || card.edition === "foil_serial"}
      maskSrc={card.frontSrc}
      className={className}
      maxTilt={10}
    >
      <img className="marketCardImage" src={card.frontSrc} alt={card.title} draggable={false} />
    </TiltCard>
  );
}

function AuctionRow({
  listing,
  now,
  onCancel,
  onClaim,
}: {
  listing: AuctionListing;
  now: number;
  onCancel: (id: string) => void;
  onClaim: (id: string) => void;
}) {
  const gross = listing.salePrice ?? listing.currentBid;
  const fee = gross > 0 ? Math.max(1, Math.ceil(gross * AUCTION_HOUSE_FEE_RATE)) : 0;
  const net = Math.max(0, gross - fee);
  const canCancel = listing.status === "active" && listing.bidCount === 0;
  const canClaim = !listing.claimedAt && (listing.status === "sold" || listing.status === "expired");
  const isFoil = listing.card.isFoil || listing.card.edition === "foil_serial";

  return (
    <article className={`auctionRow is-${listing.status} ${listing.claimedAt ? "is-claimed" : ""}`}>
      <div className="auctionRowCard">
        <CardArtwork card={listing.card} className="auctionMiniTilt" />
        {isFoil ? <span className="marketFoilBadge">FOIL</span> : null}
      </div>

      <div className="auctionRowInfo">
        <div className="auctionRowTitle">
          <div>
            <strong>{listing.card.title}</strong>
            <span>{listing.card.instanceId}</span>
          </div>
          <span className={`auctionStatus is-${listing.status}`}>{statusLabel(listing)}</span>
        </div>

        <div className="auctionMetrics">
          <div><span>Старт</span><strong>{formatPremium(listing.startingPrice)}</strong></div>
          <div><span>Текущая ставка</span><strong>{listing.currentBid ? formatPremium(listing.currentBid) : "—"}</strong></div>
          <div><span>Ставок</span><strong>{listing.bidCount}</strong></div>
          <div><span>Осталось</span><strong>{listing.status === "active" ? formatRemaining(listing.endsAt, now) : "—"}</strong></div>
        </div>

        {listing.highestBidder ? (
          <div className="auctionBidder">Лидер: <strong>{listing.highestBidder}</strong></div>
        ) : null}

        {listing.status === "sold" ? (
          <div className="auctionPayoutLine">
            Продажа: {formatPremium(gross)} · комиссия {formatPremium(fee)} · к получению <strong>{formatPremium(net)}</strong>
          </div>
        ) : null}
      </div>

      <div className="auctionRowActions">
        {listing.status === "active" && !canCancel ? (
          <span className="marketPlayerBidNote">Ожидается ставка игрока</span>
        ) : null}

        {canCancel ? (
          <button type="button" className="marketDangerBtn" onClick={() => onCancel(listing.id)}>
            Снять лот
          </button>
        ) : null}

        {canClaim ? (
          <button type="button" className="marketPrimaryBtn" onClick={() => onClaim(listing.id)}>
            {listing.status === "sold" ? "Получить Premium" : "Вернуть карту"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function Market() {
  const nav = useNavigate();
  const premium = useGameStore((state) => state.premium);
  const ownedCards = useGameStore((state) => state.ownedCards);
  const auctionListings = useGameStore((state) => state.auctionListings);
  const auctionSalesTotal = useGameStore((state) => state.auctionSalesTotal);
  const purchaseMarketCard = useGameStore((state) => state.purchaseMarketCard);
  const createAuctionListing = useGameStore((state) => state.createAuctionListing);
  const cancelAuctionListing = useGameStore((state) => state.cancelAuctionListing);
  const processAuctionMarket = useGameStore((state) => state.processAuctionMarket);
  const claimAuctionResult = useGameStore((state) => state.claimAuctionResult);

  const [tab, setTab] = useState<MarketTab>("buy");

  const [buySearch, setBuySearch] = useState("");
  const [buyEditionFilter, setBuyEditionFilter] = useState<EditionFilter>("serial");
  const [buyRarityFilter, setBuyRarityFilter] = useState<RarityFilter>("all");
  const [selectedOfferKey, setSelectedOfferKey] = useState("");

  const [selectedId, setSelectedId] = useState("");
  const [startingPrice, setStartingPrice] = useState("");
  const [buyoutPrice, setBuyoutPrice] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [sellSearch, setSellSearch] = useState("");
  const [sellEditionFilter, setSellEditionFilter] = useState<EditionFilter>("all");
  const [sellRarityFilter, setSellRarityFilter] = useState<RarityFilter>("all");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    processAuctionMarket(Date.now());
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      processAuctionMarket(current);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [processAuctionMarket]);

  const catalogOffers = useMemo(() => {
    const query = buySearch.trim().toLowerCase();
    const editions: CardEdition[] = buyEditionFilter === "all"
      ? ["serial", "foil_serial"]
      : [buyEditionFilter];

    return CARDS.flatMap((definition) =>
      editions.map((edition): CatalogOffer => ({
        key: `${definition.id}:${edition}`,
        definition,
        edition,
        price: getMarketCardPrice(definition.rarity, edition),
        preview: createPreviewCard(definition, edition),
      })),
    )
      .filter((offer) => {
        const searchable = `${offer.definition.title} ${offer.definition.id} ${offer.definition.collection}`.toLowerCase();
        if (query && !searchable.includes(query)) return false;
        if (buyRarityFilter !== "all" && offer.definition.rarity !== buyRarityFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const rarityDiff = RARITY_ORDER[b.definition.rarity] - RARITY_ORDER[a.definition.rarity];
        if (rarityDiff !== 0) return rarityDiff;
        if (a.edition !== b.edition) return a.edition === "foil_serial" ? -1 : 1;
        return a.definition.title.localeCompare(b.definition.title, "ru");
      });
  }, [buyEditionFilter, buyRarityFilter, buySearch]);

  const selectedOffer = catalogOffers.find((offer) => offer.key === selectedOfferKey) ?? null;
  const selectedCard = ownedCards.find((card) => card.instanceId === selectedId) ?? null;

  const sellableCards = useMemo(() => {
    const query = sellSearch.trim().toLowerCase();
    return [...ownedCards]
      .filter((card) => {
        if (query && !`${card.title} ${card.instanceId} ${card.collection}`.toLowerCase().includes(query)) return false;
        if (sellEditionFilter !== "all" && card.edition !== sellEditionFilter) return false;
        if (sellRarityFilter !== "all" && card.rarity !== sellRarityFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const rarityDiff = RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
        if (rarityDiff !== 0) return rarityDiff;
        return b.marketValue - a.marketValue || b.obtainedAt - a.obtainedAt;
      });
  }, [ownedCards, sellEditionFilter, sellRarityFilter, sellSearch]);

  const sortedListings = useMemo(
    () => [...auctionListings].sort((a, b) => {
      const aPriority = a.status === "active" ? 0 : a.claimedAt ? 2 : 1;
      const bPriority = b.status === "active" ? 0 : b.claimedAt ? 2 : 1;
      return aPriority - bPriority || b.listedAt - a.listedAt;
    }),
    [auctionListings],
  );

  const activeCount = auctionListings.filter((listing) => listing.status === "active").length;
  const pendingCount = auctionListings.filter(
    (listing) => !listing.claimedAt && (listing.status === "sold" || listing.status === "expired"),
  ).length;

  const startValue = Math.max(0, Math.floor(Number(startingPrice) || 0));
  const buyoutValue = Math.max(0, Math.floor(Number(buyoutPrice) || 0));
  const estimatedFee = startValue > 0 ? Math.max(1, Math.ceil(startValue * AUCTION_HOUSE_FEE_RATE)) : 0;
  const estimatedNet = Math.max(0, startValue - estimatedFee);

  function buySelectedOffer() {
    if (!selectedOffer) {
      setNotice("Сначала выбери карту на рынке.");
      return;
    }

    const result = purchaseMarketCard(selectedOffer.definition.id, selectedOffer.edition);
    if (!result.ok) {
      if (result.reason === "insufficient_premium") {
        const missing = Math.max(0, (result.price ?? selectedOffer.price) - premium);
        setNotice(`Недостаточно Premium. Не хватает ${formatPremium(missing)}.`);
      } else {
        setNotice("Не удалось купить карту.");
      }
      return;
    }

    setNotice(
      `${result.card.title} куплена за ${formatPremium(result.price)}. Получен экземпляр ${result.card.instanceId}.`,
    );
  }

  function selectCard(card: OwnedCard) {
    setSelectedId(card.instanceId);
    setStartingPrice(String(Math.max(1, card.marketValue)));
    setBuyoutPrice(String(Math.max(card.marketValue + 1, Math.round(card.marketValue * 1.3))));
    setNotice("");
  }

  function submitListing() {
    if (!selectedCard) {
      setNotice("Сначала выбери карту.");
      return;
    }
    if (startValue <= 0) {
      setNotice("Стартовая цена должна быть больше нуля.");
      return;
    }
    if (buyoutPrice.trim() && buyoutValue <= startValue) {
      setNotice("Цена мгновенной покупки должна быть выше стартовой ставки.");
      return;
    }

    const listingId = createAuctionListing(
      selectedCard.instanceId,
      startValue,
      durationMinutes,
      buyoutPrice.trim() ? buyoutValue : undefined,
    );

    if (!listingId) {
      setNotice("Не удалось выставить карту. Возможно, она уже недоступна.");
      return;
    }

    setNotice(`${selectedCard.title} выставлена на аукцион за Premium.`);
    setSelectedId("");
    setStartingPrice("");
    setBuyoutPrice("");
    setTab("auctions");
  }

  function cancelListing(id: string) {
    const ok = cancelAuctionListing(id);
    setNotice(ok ? "Лот снят, карта возвращена в инвентарь." : "Лот нельзя снять после первой ставки.");
  }

  function claimListing(id: string) {
    const result = claimAuctionResult(id);
    if (!result) {
      setNotice("Результат этого аукциона уже получен.");
      return;
    }

    if (result.kind === "sold") {
      setNotice(`Продажа завершена: получено ${formatPremium(result.net)} после комиссии.`);
    } else {
      setNotice(`${result.card.title} возвращена в инвентарь.`);
    }
  }

  return (
    <div className="marketRoot">
      <header className="marketHero">
        <div>
          <p className="marketKicker">FRAKTUM EXCHANGE</p>
          <h1>Аукционный дом</h1>
          <p>
            Покупай любые Serial и Foil Serial экземпляры за Premium, либо выставляй собственные карты на аукцион.
            Номинал Premium и обычной монеты одинаковый — различается только область применения.
          </p>
        </div>

        <div className="marketHeroActions">
          <button type="button" className="marketGhostBtn" onClick={() => nav("/shop")}>Магазин паков</button>
          <button type="button" className="marketGhostBtn" onClick={() => nav(-1)}>Назад</button>
        </div>
      </header>

      <section className="marketStats">
        <div><span>Premium баланс</span><strong>{formatPremium(premium)}</strong></div>
        <div><span>Активные лоты</span><strong>{activeCount}</strong></div>
        <div><span>Ожидают действия</span><strong>{pendingCount}</strong></div>
        <div><span>Получено с продаж</span><strong>{formatPremium(auctionSalesTotal)}</strong></div>
      </section>

      <div className="marketTabs" role="tablist" aria-label="Разделы рынка">
        <button type="button" className={tab === "buy" ? "is-active" : ""} onClick={() => setTab("buy")}>Купить карты</button>
        <button type="button" className={tab === "sell" ? "is-active" : ""} onClick={() => setTab("sell")}>Продать карту</button>
        <button type="button" className={tab === "auctions" ? "is-active" : ""} onClick={() => setTab("auctions")}>Мои аукционы</button>
      </div>

      {notice ? <div className="marketNotice">{notice}</div> : null}

      {tab === "buy" ? (
        <div className="marketSellLayout marketBuyLayout">
          <section className="marketInventoryPanel marketCatalogPanel">
            <div className="marketPanelHead">
              <div>
                <span>MARKET CATALOG</span>
                <h2>Доступные карты</h2>
              </div>
              <strong>{catalogOffers.length}</strong>
            </div>

            <div className="marketFilters">
              <input value={buySearch} onChange={(event) => setBuySearch(event.target.value)} placeholder="Название или коллекция" />
              <select value={buyEditionFilter} onChange={(event) => setBuyEditionFilter(event.target.value as EditionFilter)}>
                <option value="all">Все версии</option>
                <option value="serial">Serial</option>
                <option value="foil_serial">Foil Serial</option>
              </select>
              <select value={buyRarityFilter} onChange={(event) => setBuyRarityFilter(event.target.value as RarityFilter)}>
                <option value="all">Все редкости</option>
                {(Object.keys(RARITY_LABELS) as CardRarity[]).map((rarity) => (
                  <option value={rarity} key={rarity}>{RARITY_LABELS[rarity]}</option>
                ))}
              </select>
            </div>

            {catalogOffers.length ? (
              <div className="marketCardGrid">
                {catalogOffers.map((offer) => {
                  const isSelected = selectedOfferKey === offer.key;
                  const affordable = premium >= offer.price;
                  return (
                    <button
                      className={`marketInventoryCard ${isSelected ? "is-selected" : ""} ${affordable ? "" : "is-unaffordable"}`}
                      key={offer.key}
                      type="button"
                      onClick={() => {
                        setSelectedOfferKey(offer.key);
                        setNotice("");
                      }}
                    >
                      <div className="marketInventoryArt">
                        <CardArtwork card={offer.preview} className="marketGridTilt" />
                        {offer.edition === "foil_serial" ? <span className="marketFoilBadge">FOIL</span> : null}
                      </div>
                      <strong>{offer.definition.title}</strong>
                      <span>{offer.edition === "foil_serial" ? "Foil Serial" : "Serial"}</span>
                      <small>{RARITY_LABELS[offer.definition.rarity]} · {formatPremium(offer.price)}</small>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="marketEmpty">Под эти фильтры нет доступных карт.</div>
            )}
          </section>

          <aside className="marketCreatePanel marketPurchasePanel">
            <div className="marketPanelHead">
              <div>
                <span>BUY CARD</span>
                <h2>Покупка экземпляра</h2>
              </div>
            </div>

            {selectedOffer ? (
              <>
                <div className="marketSelectedCard">
                  <CardArtwork card={selectedOffer.preview} className="marketPreviewTilt" />
                  <div>
                    <strong>{selectedOffer.definition.title}</strong>
                    <span>{selectedOffer.definition.collection}</span>
                    <small>{selectedOffer.edition === "foil_serial" ? "Foil Serial" : "Serial"} · {RARITY_LABELS[selectedOffer.definition.rarity]}</small>
                  </div>
                </div>

                <div className="marketEstimate marketPurchaseEstimate">
                  <div><span>Цена</span><strong>{formatPremium(selectedOffer.price)}</strong></div>
                  <div><span>Твой Premium</span><strong>{formatPremium(premium)}</strong></div>
                  <div>
                    <span>После покупки</span>
                    <strong>{premium >= selectedOffer.price ? formatPremium(premium - selectedOffer.price) : "Недостаточно"}</strong>
                  </div>
                </div>

                <div className="marketWarning">
                  После покупки игра создаст новый уникальный Serial ID. Карта сразу появится в инвентаре с отметкой NEW.
                </div>

                <button
                  type="button"
                  className="marketPrimaryBtn marketSubmitBtn marketBuyButton"
                  onClick={buySelectedOffer}
                  disabled={premium < selectedOffer.price}
                >
                  {premium >= selectedOffer.price
                    ? `Купить за ${formatPremium(selectedOffer.price)}`
                    : `Не хватает ${formatPremium(selectedOffer.price - premium)}`}
                </button>
              </>
            ) : (
              <div className="marketEmpty marketEmptyLarge">Выбери карту слева, чтобы купить Serial или Foil Serial экземпляр.</div>
            )}
          </aside>
        </div>
      ) : null}

      {tab === "sell" ? (
        <div className="marketSellLayout">
          <section className="marketInventoryPanel">
            <div className="marketPanelHead">
              <div>
                <span>INVENTORY</span>
                <h2>Выбери экземпляр</h2>
              </div>
              <strong>{sellableCards.length}</strong>
            </div>

            <div className="marketFilters">
              <input value={sellSearch} onChange={(event) => setSellSearch(event.target.value)} placeholder="Название, serial или коллекция" />
              <select value={sellEditionFilter} onChange={(event) => setSellEditionFilter(event.target.value as EditionFilter)}>
                <option value="all">Все версии</option>
                <option value="serial">Serial</option>
                <option value="foil_serial">Foil Serial</option>
              </select>
              <select value={sellRarityFilter} onChange={(event) => setSellRarityFilter(event.target.value as RarityFilter)}>
                <option value="all">Все редкости</option>
                {(Object.keys(RARITY_LABELS) as CardRarity[]).map((rarity) => (
                  <option value={rarity} key={rarity}>{RARITY_LABELS[rarity]}</option>
                ))}
              </select>
            </div>

            {sellableCards.length ? (
              <div className="marketCardGrid">
                {sellableCards.map((card) => (
                  <button
                    className={`marketInventoryCard ${selectedId === card.instanceId ? "is-selected" : ""}`}
                    key={card.instanceId}
                    type="button"
                    onClick={() => selectCard(card)}
                  >
                    <div className="marketInventoryArt">
                      <CardArtwork card={card} className="marketGridTilt" />
                      {card.isFoil || card.edition === "foil_serial" ? <span className="marketFoilBadge">FOIL</span> : null}
                    </div>
                    <strong>{card.title}</strong>
                    <span>{card.instanceId}</span>
                    <small>{RARITY_LABELS[card.rarity]} · оценка {formatPremium(card.marketValue)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="marketEmpty">Под эти фильтры нет доступных карт.</div>
            )}
          </section>

          <aside className="marketCreatePanel">
            <div className="marketPanelHead">
              <div>
                <span>NEW LOT</span>
                <h2>Настрой аукцион</h2>
              </div>
            </div>

            {selectedCard ? (
              <>
                <div className="marketSelectedCard">
                  <CardArtwork card={selectedCard} className="marketPreviewTilt" />
                  <div>
                    <strong>{selectedCard.title}</strong>
                    <span>{selectedCard.instanceId}</span>
                    <small>{selectedCard.isFoil ? "Foil Serial" : "Serial"} · {RARITY_LABELS[selectedCard.rarity]}</small>
                  </div>
                </div>

                <label className="marketField">
                  <span>Стартовая Premium-ставка</span>
                  <input min="1" max="100000000" type="number" value={startingPrice} onChange={(event) => setStartingPrice(event.target.value)} />
                </label>

                <label className="marketField">
                  <span>Мгновенная покупка <small>необязательно</small></span>
                  <input min="2" max="100000000" type="number" value={buyoutPrice} onChange={(event) => setBuyoutPrice(event.target.value)} />
                </label>

                <label className="marketField">
                  <span>Длительность</span>
                  <select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}>
                    {DURATION_OPTIONS.map((option) => (
                      <option value={option.value} key={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <div className="marketEstimate">
                  <div><span>Оценка карты</span><strong>{formatPremium(selectedCard.marketValue)}</strong></div>
                  <div><span>Комиссия при продаже</span><strong>{Math.round(AUCTION_HOUSE_FEE_RATE * 100)}%</strong></div>
                  <div><span>При продаже по старту</span><strong>{formatPremium(estimatedNet)}</strong></div>
                </div>

                <div className="marketWarning">
                  После публикации карта будет убрана из инвентаря, колоды и витрины до завершения аукциона.
                </div>

                <button type="button" className="marketPrimaryBtn marketSubmitBtn" onClick={submitListing}>
                  Выставить на аукцион
                </button>
              </>
            ) : (
              <div className="marketEmpty marketEmptyLarge">Выбери карту слева, чтобы настроить цену и длительность.</div>
            )}
          </aside>
        </div>
      ) : null}

      {tab === "auctions" ? (
        <section className="marketAuctionsPanel">
          <div className="marketPanelHead">
            <div>
              <span>MY LOTS</span>
              <h2>История и активные торги</h2>
            </div>
            <strong>{auctionListings.length}</strong>
          </div>

          {sortedListings.length ? (
            <div className="auctionList">
              {sortedListings.map((listing) => (
                <AuctionRow
                  key={listing.id}
                  listing={listing}
                  now={now}
                  onCancel={cancelListing}
                  onClaim={claimListing}
                />
              ))}
            </div>
          ) : (
            <div className="marketEmpty marketEmptyLarge">Пока нет лотов игроков. Выстави карту — она будет ждать реальную ставку после подключения Supabase.</div>
          )}
        </section>
      ) : null}

      <div className="marketBackendNote">
        <strong>Важно:</strong> тестовые ставки ботов отключены. Локальный рынок сейчас позволяет выставлять и возвращать лоты;
        реальные ставки игроков нужно подключать через Supabase Auth, таблицу auctions/bids и серверную проверку Premium-транзакций.
      </div>
    </div>
  );
}
