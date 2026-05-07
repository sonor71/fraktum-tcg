import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../useGameStore";

type Rarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic";
type CardType = "Персонаж" | "Событие" | "Эффект" | "Тактика";
type Pack = "Египетский" | "Ледниковый" | "Бездна" | "Лесной";
type Element = "Огонь" | "Лёд" | "Тьма" | "Природа";

type CatalogCard = {
  id: string; // baseId
  title: string;
  frontSrc: string;
  rarity: Rarity;
  type: CardType;
  pack: Pack;
  element?: Element;
};

const rarityList: Rarity[] = ["Common", "Rare", "Epic", "Legendary", "Mythic"];
const typeList: CardType[] = ["Персонаж", "Событие", "Эффект", "Тактика"];
const packList: Pack[] = ["Египетский", "Ледниковый", "Бездна", "Лесной"];
const elementList: Element[] = ["Огонь", "Лёд", "Тьма", "Природа"];

const rarityOrder: Record<Rarity, number> = {
  Common: 1,
  Rare: 2,
  Epic: 3,
  Legendary: 4,
  Mythic: 5,
};

type SortMode = "По редкости" | "По названию" | "Сначала полученные";

const BACK_FALLBACK = "/cards/card-back.png";

export default function Collection() {
  const nav = useNavigate();

  // что реально есть у игрока (экземпляры)
  const owned = useGameStore((s) => s.ownedCards);

  // set baseId, которые есть у игрока
  const ownedBaseIds = useMemo(() => {
    const set = new Set<string>();
    for (const c of owned) set.add(c.baseId);
    return set;
  }, [owned]);

  // ✅ КАТАЛОГ КАРТ (то, что “есть в игре”)
  // 1) добавил твои реальные id из PackOpen (oracle/sandstorm/wood_vines и т.д.)
  // 2) плюс демо-генератор (если хочешь — уберёшь)
  const allCards = useMemo<CatalogCard[]>(() => {
    const fixed: CatalogCard[] = [
      {
        id: "oracle",
        title: "Оракул",
        frontSrc: "/cards/oracle.png",
        rarity: "Legendary",
        type: "Тактика",
        pack: "Египетский",
        element: "Тьма",
      },
      {
        id: "sandstorm",
        title: "Песчаная буря",
        frontSrc: "/cards/sandstorm.png",
        rarity: "Rare",
        type: "Событие",
        pack: "Египетский",
        element: "Огонь",
      },
      {
        id: "wood_vines",
        title: "Древесные лозы",
        frontSrc: "/cards/wood-vines.png",
        rarity: "Common",
        type: "Тактика",
        pack: "Лесной",
        element: "Природа",
      },
      {
        id: "shadow_sword",
        title: "Меч тени",
        frontSrc: "/cards/shadow-sword.png",
        rarity: "Common",
        type: "Событие",
        pack: "Бездна",
        element: "Тьма",
      },
      {
        id: "shield_hope",
        title: "Щит надежды",
        frontSrc: "/cards/shield-hope.png",
        rarity: "Epic",
        type: "Событие",
        pack: "Ледниковый",
        element: "Лёд",
      },
      {
        id: "reverse_heart",
        title: "Реверсивное сердце",
        frontSrc: "/cards/reverse-heart.png",
        rarity: "Mythic",
        type: "Событие",
        pack: "Бездна",
        element: "Тьма",
      },
    ];

    // демо-генератор (можешь позже удалить)
    const generated: CatalogCard[] = [];
    for (let i = 1; i <= 120; i++) {
      generated.push({
        id: `C_${i}`,
        title: `Карта ${i}`,
        frontSrc: BACK_FALLBACK,
        rarity: rarityList[i % rarityList.length],
        type: typeList[i % typeList.length],
        pack: packList[i % packList.length],
        element: elementList[i % elementList.length],
      });
    }

    return [...fixed, ...generated];
  }, []);

  // фильтры
  const [sortMode, setSortMode] = useState<SortMode>("По редкости");
  const [rarity, setRarity] = useState<string>("Все");
  const [type, setType] = useState<string>("Все");
  const [pack, setPack] = useState<string>("Все");
  const [element, setElement] = useState<string>("Все");

  const filtered = useMemo(() => {
    let arr = [...allCards];

    arr = arr.filter((c) => {
      if (rarity !== "Все" && c.rarity !== rarity) return false;
      if (type !== "Все" && c.type !== type) return false;
      if (pack !== "Все" && c.pack !== pack) return false;
      if (element !== "Все" && c.element !== element) return false;
      return true;
    });

    arr.sort((a, b) => {
      const aOwned = ownedBaseIds.has(a.id) ? 1 : 0;
      const bOwned = ownedBaseIds.has(b.id) ? 1 : 0;

      if (sortMode === "Сначала полученные") {
        if (bOwned !== aOwned) return bOwned - aOwned;
        const rr = rarityOrder[b.rarity] - rarityOrder[a.rarity];
        if (rr !== 0) return rr;
        return a.title.localeCompare(b.title, "ru");
      }

      if (sortMode === "По названию") {
        const nn = a.title.localeCompare(b.title, "ru");
        if (nn !== 0) return nn;
        return rarityOrder[b.rarity] - rarityOrder[a.rarity];
      }

      const rr = rarityOrder[b.rarity] - rarityOrder[a.rarity];
      if (rr !== 0) return rr;
      return a.title.localeCompare(b.title, "ru");
    });

    return arr;
  }, [allCards, rarity, type, pack, element, sortMode, ownedBaseIds]);

  return (
    <div className="colRoot">
      {/* LEFT */}
      <aside className="colLeft">
        <div className="colLeftTitle">сортировка</div>

        <FilterRow
          label="СОРТИРОВКА"
          value={sortMode}
          onChange={(v) => setSortMode(v as SortMode)}
          options={["По редкости", "По названию", "Сначала полученные"]}
        />

        <FilterRow label="РЕДКОСТЬ" value={rarity} onChange={setRarity} options={["Все", ...rarityList]} />
        <FilterRow label="ТИП" value={type} onChange={setType} options={["Все", ...typeList]} />
        <FilterRow label="ПАК" value={pack} onChange={setPack} options={["Все", ...packList]} />
        <FilterRow
          label="СТИХИЯ"
          value={element}
          onChange={setElement}
          options={["Все", ...elementList]}
          note="пока что пуст — будет не доступно именно от стихия"
        />

        <button className="colBackBtn" onClick={() => nav(-1)}>
          НАЗАД
        </button>
      </aside>

      {/* RIGHT */}
      <section className="colRight">
        <div className="colScrollArea">
          {/* ✅ ДЕБАГ-БАР (чтобы понять почему “пусто”) */}
          <div className="colDebug">
            каталог: <b>{allCards.length}</b> • после фильтра: <b>{filtered.length}</b> • в инвентаре экземпляров:{" "}
            <b>{owned.length}</b> • типов у игрока: <b>{ownedBaseIds.size}</b>
          </div>

          {filtered.length === 0 ? (
            <div style={{ opacity: 0.7, padding: 14 }}>Ничего не найдено по фильтрам.</div>
          ) : (
            <div className="colGrid">
              {filtered.map((c) => {
                const isOwned = ownedBaseIds.has(c.id);

                return (
                  <div key={c.id} className={`colCard ${isOwned ? "" : "locked"}`} title={isOwned ? c.title : "карта не получена"}>
                    <img
                      className="colCardImg"
                      src={c.frontSrc}
                      alt={c.title}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = BACK_FALLBACK;
                      }}
                    />
                    {!isOwned ? <div className="colLockedLabel">карта не получена</div> : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FilterRow(props: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  note?: string;
}) {
  return (
    <div className="colFilter">
      <div className="colFilterTop">
        <div className="colFilterLabel">{props.label}</div>

        <div className="colSelectWrap">
          <select className="colSelect" value={props.value} onChange={(e) => props.onChange(e.target.value)}>
            {props.options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <div className="colSelectArrow" aria-hidden="true">
            ▼
          </div>
        </div>
      </div>

      {props.note ? <div className="colNote">{props.note}</div> : null}
    </div>
  );
}
