import { useNavigate } from "react-router-dom";

type Pack = {
  id: string;
  title: string;
  description: string;

  // ✅ путь к картинке превью пака (из /public)
  artSrc: string;
};

const PACKS: Pack[] = [
  {
    id: "egypt",
    title: "Египетский пак",
    description: "Информация о паке",
    artSrc: "/packs/egypt.png",
  },
  {
    id: "ice",
    title: "Ледниковый пак",
    description: "Информация о паке",
    artSrc: "/packs/ice.png",
  },
  {
    id: "void",
    title: "Пак Бездны",
    description: "Информация о паке",
    artSrc: "/packs/void.png",
  },
  {
    id: "forest",
    title: "обычный",
    description: "Информация о паке",
    artSrc: "/packs/normal.png",
  },
];

function PackCard({ pack, onBuy }: { pack: Pack; onBuy: (p: Pack) => void }) {
  return (
    <div className="shopCard packCard">
      <div className="packLeft">
        {/* ✅ ТУТ БЫЛ ПУСТОЙ БЛОК. ТЕПЕРЬ ВНУТРИ КАРТИНКА */}
        <div className="packArt">
          <img
            className="packArtImg"
            src={pack.artSrc}
            alt={pack.title}
            draggable={false}
          />
        </div>

        <div className="packNameWrap">
          <div className="packName" title={pack.title}>
            {pack.title}
          </div>
          <div className="line lineShort" />
        </div>
      </div>

      <div className="packRight">
        <button className="buyBtn" onClick={() => onBuy(pack)}>
          купить
        </button>

        <div className="packInfoBlock">
          <div className="packInfoText">{pack.description}</div>
          <div className="line lineLong" />
        </div>
      </div>
    </div>
  );
}

function CurrencyCard() {
  return (
    <div className="shopCard currencyCard">
      <div className="currencyIconWrap">
        <svg className="hexSvg" viewBox="0 0 100 100" aria-hidden="true">
          <polygon points="50,6 85,26 85,74 50,94 15,74 15,26" />
        </svg>
      </div>

      <div className="currencyBuyWrap">
        <div className="currencyBuyText">купить валюту</div>
        <div className="line lineLong" />
      </div>
    </div>
  );
}

function SkinsCard() {
  return (
    <div className="shopCard skinsCard">
      <div className="skinsText">
        КАКИЕ НИБУДЬ СКИНЫ ПОКА НЕ
        <br />
        ПРИДУМАЛ ЧТО СЮДА ПОСТАВИТЬ
      </div>
    </div>
  );
}

export default function Shop() {
  const nav = useNavigate();

  const handleBuy = (pack: Pack) => {
    nav("/pack", { state: { packId: pack.id, packTitle: pack.title } });
  };

  return (
    <div className="shopRoot">
      <div className="shopHeader">
        <button className="shopBack" onClick={() => nav(-1)}>
          НАЗАД
        </button>
      </div>

      <div className="shopGrid">
        <PackCard pack={PACKS[0]} onBuy={handleBuy} />
        <PackCard pack={PACKS[1]} onBuy={handleBuy} />
        <CurrencyCard />

        <PackCard pack={PACKS[2]} onBuy={handleBuy} />
        <PackCard pack={PACKS[3]} onBuy={handleBuy} />
        <SkinsCard />
      </div>
    </div>
  );
}
