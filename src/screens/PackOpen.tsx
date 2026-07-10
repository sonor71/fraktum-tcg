import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  PackOpeningOverlay,
  type PackOpeningPackData,
} from "../components/PackOpening";
import { getPackById } from "../data/packs";
import { getRandomCardIdsFromPool } from "../game/cards";
import type { OwnedCard } from "../game/types";
import { useGameStore } from "../useGameStore";

const PACK_SIZE = 5;

type PackRouteState = {
  packId?: string;
  packTitle?: string;
  openSessionId?: string;
};

export default function PackOpen() {
  const navigate = useNavigate();
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
      setNotice(
        "Покупка пакета не найдена, устарела или уже принадлежит другому паку.",
      );
      return;
    }

    setCards(issued);
    setNotice("");
  }, [openPurchasedPack, pack, sessionId]);

  const packData: PackOpeningPackData = {
    packId: pack.id,
    title: routeState?.packTitle || pack.title,
    artSrc: pack.artSrc,
    fallbackArtSrc: pack.fallbackArtSrc,
  };

  function openAnother() {
    const nextSessionId = purchasePack(pack.id, pack.price);

    if (!nextSessionId) {
      setNotice(
        `Не хватает монет для "${pack.title}". Нужно ${pack.price}, доступно ${coins}.`,
      );
      return;
    }

    issuedSessionRef.current = null;
    setCards([]);
    setNotice("");
    setSessionId(nextSessionId);
  }

  if (notice) {
    return (
      <div
        className="pack-open-notice"
        style={{
          minHeight: "100%",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 560, textAlign: "center" }}>
          <h2>Открытие пака недоступно</h2>
          <p>{notice}</p>
          <button type="button" onClick={() => navigate("/shop")}>
            Вернуться в магазин
          </button>
        </div>
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div style={{ minHeight: "100%", display: "grid", placeItems: "center" }}>
        Подготовка бустера…
      </div>
    );
  }

  return (
    <PackOpeningOverlay
      key={sessionId}
      cards={cards}
      packData={packData}
      onClose={() => navigate("/inventory")}
      onBackToShop={() => navigate("/shop")}
      onBuyAnother={openAnother}
    />
  );
}
