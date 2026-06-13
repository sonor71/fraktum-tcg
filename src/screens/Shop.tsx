import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PACKS, type PackMeta } from "../data/packs";
import { useGameStore } from "../useGameStore";

function PackCard({ pack, onBuy }: { pack: PackMeta; onBuy: (pack: PackMeta) => void }) {
  const [artSrc, setArtSrc] = useState(pack.artSrc);

  return (
    <div className="shopCard packCard">
      <div className="packLeft">
        <div className="packArt">
          <img
            className="packArtImg"
            src={artSrc}
            alt={pack.title}
            draggable={false}
            onError={() => setArtSrc(pack.fallbackArtSrc)}
          />
        </div>

        <div className="packNameWrap">
          <div className="packName" title={pack.title}>{pack.title}</div>
          <div className="line lineShort" />
        </div>
      </div>

      <div className="packRight">
        <button className="buyBtn" onClick={() => onBuy(pack)} type="button">купить</button>
        <div className="packInfoBlock">
          <div className="packInfoText">{pack.description}</div>
          <div className="packPrice">{pack.price} монет</div>
          <div className="line lineLong" />
        </div>
      </div>
    </div>
  );
}

function CurrencyCard() {
  const addCoins = useGameStore((state) => state.addCoins);
  const addPremium = useGameStore((state) => state.addPremium);

  return (
    <div className="shopCard currencyCard">
      <div className="currencyIconWrap">
        <svg className="hexSvg" viewBox="0 0 100 100" aria-hidden="true">
          <polygon points="50,6 85,26 85,74 50,94 15,74 15,26" />
        </svg>
      </div>

      <div className="currencyBuyWrap">
        <div className="currencyBuyText">тестовая валюта</div>
        <div className="shopCurrencyButtons">
          <button className="buyBtn" onClick={() => addCoins(250)} type="button">+250</button>
          <button className="buyBtn" onClick={() => addPremium(5)} type="button">+5 premium</button>
        </div>
        <div className="line lineLong" />
      </div>
    </div>
  );
}

function SkinsCard() {
  return (
    <div className="shopCard skinsCard">
      <div className="skinsText">СКИНЫ И КОСМЕТИКА<br />СКОРО В МАГАЗИНЕ</div>
    </div>
  );
}

export default function Shop() {
  const nav = useNavigate();
  const coins = useGameStore((state) => state.coins);
  const purchasePack = useGameStore((state) => state.purchasePack);
  const [warning, setWarning] = useState("");

  function handleBuy(pack: PackMeta) {
    const sessionId = purchasePack(pack.id, pack.price);
    if (!sessionId) {
      setWarning(`Не хватает монет для "${pack.title}". Нужно ${pack.price}, доступно ${coins}.`);
      return;
    }

    setWarning("");
    nav(`/pack?packId=${pack.id}`, {
      state: { packId: pack.id, packTitle: pack.title, openSessionId: sessionId },
    });
  }

  const [firstPack, secondPack, ...remainingPacks] = PACKS;

  return (
    <div className="shopRoot">
      <div className="shopHeader">
        <button className="shopBack" onClick={() => nav(-1)} type="button">НАЗАД</button>
        <div className="shopBalance">Баланс: {coins} монет</div>
      </div>

      {warning ? <div className="shopNotice">{warning}</div> : null}

      <div className="shopGrid">
        {firstPack ? <PackCard pack={firstPack} onBuy={handleBuy} /> : null}
        {secondPack ? <PackCard pack={secondPack} onBuy={handleBuy} /> : null}
        <CurrencyCard />
        {remainingPacks.map((pack) => <PackCard key={pack.id} pack={pack} onBuy={handleBuy} />)}
        <SkinsCard />
      </div>
    </div>
  );
}
