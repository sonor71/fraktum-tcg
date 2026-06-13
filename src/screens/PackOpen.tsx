import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import TiltCard from "../components/TiltCard";
import { getPackById } from "../data/packs";
import { getRandomCardIdsFromPool } from "../game/cards";
import type { CardRarity, OwnedCard } from "../game/types";
import { playPackOpen, playRareDrop } from "../services/audio";
import { useGameStore } from "../useGameStore";

const BACK_SRC = "/cards/card-back.png";
const PACK_SIZE = 5;

const HIGH_RARITIES = new Set<CardRarity>([
  "epic",
  "mythic",
  "legendary",
  "chromatic",
  "exotic",
  "divine",
  "forgotten",
  "archaic",
]);

type PackRouteState = {
  packId?: string;
  packTitle?: string;
  openSessionId?: string;
};

function Card3D({
  card,
  flipped,
  onFlip,
  index,
}: {
  card: OwnedCard;
  flipped: boolean;
  onFlip: () => void;
  index: number;
}) {
  const isFoil = card.edition === "foil_serial" || card.isFoil;
  const imageSrc = card.frontSrc || card.image;

  return (
    <button
      type="button"
      className={`poCard rarity-${card.rarity} ${isFoil ? "isFoil" : ""} ${flipped ? "isFlipped" : ""}`}
      onClick={onFlip}
      style={{ "--i": index } as CSSProperties & Record<"--i", number>}
      aria-label={flipped ? `Карта: ${card.title}` : "Открыть карту"}
      title={flipped ? `${card.title} · ${card.instanceId}` : "Нажми, чтобы открыть"}
    >
      <div className="poCardInner">
        <div className="poFace poBack">
          <img className="poBackImg" src={BACK_SRC} alt="Рубашка карты" />
          <div className="poBackHint">нажми</div>
        </div>

        <div className="poFace poFront">
          <TiltCard rarity={card.rarity} isFoil={isFoil} maskSrc={imageSrc} className="poTiltCard">
            <img className="poFrontImg" src={imageSrc} alt={card.title} />
            {isFoil ? <div className="foilBadge">FOIL SERIAL</div> : null}
            <div className="cardValueBadge">₵ {card.marketValue.toLocaleString("ru-RU")}</div>
            <div className="poRareBurst" aria-hidden="true" />
          </TiltCard>
        </div>
      </div>

      {flipped ? (
        <div className="poCardCaption">
          <strong>{isFoil ? "FOIL SERIAL" : card.rarity}</strong>
          <span>{card.instanceId}</span>
        </div>
      ) : null}
    </button>
  );
}

export default function PackOpen() {
  const nav = useNavigate();
  const location = useLocation();
  const routeState = location.state as PackRouteState | null;
  const search = new URLSearchParams(location.search);
  const packIdFromRoute = routeState?.packId ?? search.get("packId");
  const pack = useMemo(() => getPackById(packIdFromRoute), [packIdFromRoute]);

  const coins = useGameStore((state) => state.coins);
  const purchasePack = useGameStore((state) => state.purchasePack);
  const openPurchasedPack = useGameStore((state) => state.openPurchasedPack);

  const [sessionId, setSessionId] = useState(routeState?.openSessionId ?? "");
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [flipped, setFlipped] = useState<boolean[]>(() => Array(PACK_SIZE).fill(false));
  const [notice, setNotice] = useState("");
  const issuedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setCards([]);
      setNotice("Этот пак не был оплачен. Вернись в маркет и купи его.");
      return;
    }
    if (issuedSessionRef.current === sessionId) return;
    issuedSessionRef.current = sessionId;

    const baseIds = getRandomCardIdsFromPool(pack.cardPool, PACK_SIZE);
    const issued = openPurchasedPack(sessionId, pack.id, baseIds);

    if (!issued) {
      setCards([]);
      setNotice("Покупка пакета не найдена, устарела или уже принадлежит другому паку.");
      return;
    }

    setCards(issued);
    setFlipped(Array(issued.length).fill(false));
    setNotice("");
    playPackOpen();

    if (issued.some((card) => HIGH_RARITIES.has(card.rarity) || card.isFoil)) playRareDrop();
  }, [openPurchasedPack, pack, sessionId]);

  const openedCount = flipped.filter(Boolean).length;
  const allRevealed = cards.length > 0 && openedCount === cards.length;

  function flipOne(index: number) {
    setFlipped((previous) => {
      if (previous[index]) return previous;
      const next = [...previous];
      next[index] = true;
      return next;
    });
  }

  function revealAll() {
    setFlipped(Array(cards.length || PACK_SIZE).fill(true));
  }

  function openAnother() {
    const nextSessionId = purchasePack(pack.id, pack.price);
    if (!nextSessionId) {
      setNotice(`Не хватает монет для "${pack.title}". Нужно ${pack.price}, доступно ${coins}.`);
      return;
    }

    issuedSessionRef.current = null;
    setCards([]);
    setFlipped(Array(PACK_SIZE).fill(false));
    setNotice("");
    setSessionId(nextSessionId);
  }

  return (
    <div className="poRoot">
      <div className="poPackStage">
        <div className="poPackHero">
          <img
            src={pack.artSrc}
            alt={pack.title}
            onError={(event) => {
              event.currentTarget.src = pack.fallbackArtSrc;
            }}
          />
        </div>

        <div className="poPackTitle">
          <span>{pack.title}</span>
          <strong>{openedCount}/{cards.length || PACK_SIZE}</strong>
        </div>
      </div>

      <div className="poBoard">
        <div className="poCardsRow">
          {cards.map((card, index) => (
            <Card3D
              key={card.instanceId}
              card={card}
              flipped={Boolean(flipped[index])}
              onFlip={() => flipOne(index)}
              index={index}
            />
          ))}
        </div>
      </div>

      {notice ? <div className="shopNotice poNotice">{notice}</div> : null}

      <div className="poFooter">
        <button className="poBtn" onClick={() => nav("/shop")} type="button">МАРКЕТ</button>
        <button className="poBtn" onClick={revealAll} type="button" disabled={allRevealed || cards.length === 0}>
          ОТКРЫТЬ ВСЕ
        </button>
        <button className="poBtn poBtnPrimary" onClick={openAnother} type="button">
          ОТКРЫТЬ ЕЩЕ
          <div className="poBtnSub">{pack.price} монет</div>
        </button>
        <button className="poBtn" onClick={() => nav("/inventory")} type="button">ИНВЕНТАРЬ</button>
      </div>
    </div>
  );
}
