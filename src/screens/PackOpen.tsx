import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../useGameStore";

type Rarity = "Обычная" | "Редкая" | "Эпическая" | "Легендарная" | "Мифическая"|"Хроматическая";
type CardType = "Событие" | "Тактика"| "Эффект";

type PoolCard = {
  id: string;       // постоянный id (для инвентаря)
  name: string;
  rarity: Rarity;
  type: CardType;
  frontSrc: string; // лицевая сторона (картинка на всю карту)
};

type PackCard = PoolCard & {
  instanceId: string; // уникальный ключ для React
};

const BACK_SRC = "/cards/card-back.png";

const CARD_POOL: PoolCard[] = [
  {
    id: "reverse_heart",
    name: "Реверсивное сердце",
    rarity: "Мифическая",
    type: "Событие",
    frontSrc: "/cards/reverse-heart.png",
  },
  {
    id: "shadow_sword",
    name: "Меч тени",
    rarity: "Обычная",
    type: "Событие",
    frontSrc: "/cards/shadow-sword.png",
  },
  {
    id: "shield_hope",
    name: "Щит надежды",
    rarity: "Эпическая",
    type: "Событие",
    frontSrc: "/cards/shield-hope.png",
  },
  {
    id: "sandstorm",
    name: "Песчаная буря",
    rarity: "Редкая",
    type: "Событие",
    frontSrc: "/cards/sandstorm.png",
  },
  {
    id: "oracle",
    name: "Оракул",
    rarity: "Легендарная",
    type: "Тактика",
    frontSrc: "/cards/oracle.png",
  },
  {
    id: "wood_vines",
    name: "Древесные лозы",
    rarity: "Обычная",
    type: "Тактика",
    frontSrc: "/cards/wood-vines.png",
  },
    {
    id: "dragon_eye",
    name: "Dragon Eye",
    rarity: "Эпическая",
    type: "Событие",
    frontSrc: "/cards/dragon-eye.png",
  },
  {
    id: "hyper_night",
    name: "Hyper Night",
    rarity: "Хроматическая",
    type: "Событие",
    frontSrc: "/cards/hyper-night.png",
  },
  {
    id: "time_of_reckoning",
    name: "Time of Reckoning",
    rarity: "Хроматическая",
    type: "Событие",
    frontSrc: "/cards/time-of-reckoning.png",
  },
  {
    id: "seventy_one",
    name: "Seventy One",
    rarity: "Эпическая",
    type: "Событие",
    frontSrc: "/cards/seventy-one.png",
  },
  {
    id: "energy_sword",
    name: "Energy Sword",
    rarity: "Редкая",
    type: "Событие",
    frontSrc: "/cards/energy-sword.png",
  },
  {
    id: "double_speed",
    name: "Double Speed",
    rarity: "Редкая",
    type: "Тактика",
    frontSrc: "/cards/double-speed.png",
  },
  {
    id: "tree_of_life",
    name: "Tree of Life",
    rarity: "Легендарная",
    type: "Событие",
    frontSrc: "/cards/tree-of-life.png",
  },
  {
    id: "book_knowledge",
    name: "Book Knowledge",
    rarity: "Редкая",
    type: "Тактика",
    frontSrc: "/cards/book-knowledge.png",
  },
  {
    id: "amulet_of_old_sage",
    name: "Amulet of old sage",
    rarity: "Мифическая",
    type: "Эффект",
    frontSrc: "/cards/amulet-of-old-sage.png",
  },
];

function pickRandomPack(size = 5): PackCard[] {
  if (CARD_POOL.length === 0) return [];

  // почти без дублей: перемешали пул и взяли первые size
  const copy = [...CARD_POOL];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  const picked: PoolCard[] = [];
  while (picked.length < size) {
    if (copy.length > 0) picked.push(copy.shift()!);
    else picked.push(CARD_POOL[Math.floor(Math.random() * CARD_POOL.length)]);
  }

  const stamp = Date.now();
  return picked.map((c, i) => ({ ...c, instanceId: `${c.id}_${stamp}_${i}` }));
}

function Card3D({
  card,
  flipped,
  onFlip,
  index,
}: {
  card: PackCard;
  flipped: boolean;
  onFlip: () => void;
  index: number;
}) {
  return (
    <button
      type="button"
      className={`poCard ${flipped ? "isFlipped" : ""}`}
      onClick={onFlip}
      style={{ ["--i" as any]: index }}
      aria-label={flipped ? `Карта: ${card.name}` : "Открыть карту"}
      title={flipped ? card.name : "Нажми, чтобы открыть"}
    >
      <div className="poCardInner">
        {/* BACK (рубашка) */}
        <div className="poFace poBack">
          <img className="poBackImg" src={BACK_SRC} alt="Рубашка карты" />
          <div className="poBackHint">нажми</div>
        </div>

        {/* FRONT (картинка на ВСЮ карту) */}
        <div className="poFace poFront">
  <img className="poFrontImg" src={card.frontSrc} alt={card.name} />
            <div className="poNameBar">
              <div className="poName" title={card.name}>
                {card.name}
              </div>
              <div className="poLine" />
            </div>
          </div>
        </div>
    </button>
  );
}

export default function PackOpen() {
  const nav = useNavigate();
  const grantCards = useGameStore((s) => s.grantCards);

  const [packKey, setPackKey] = useState(0);
  const cards = useMemo(() => pickRandomPack(5), [packKey]);

  const [flipped, setFlipped] = useState<boolean[]>(() => Array(5).fill(false));

  // Чтобы не добавить одни и те же карты дважды при повторных рендерах/кликах
  const grantedRef = useRef<Set<string>>(new Set());

  function grantToInventory(one: PackCard) {
  // уникальный ключ выдачи в рамках пака, чтобы не выдавать повторно при кликах
  const key = `${packKey}:${one.instanceId}`;
  if (grantedRef.current.has(key)) return;
  grantedRef.current.add(key);

  grantCards([{
  instanceId: one.instanceId,
  baseId: one.id,
  title: one.name,
  frontSrc: one.frontSrc,
  rarity: one.rarity,
  type: one.type,
  obtainedAt: Date.now(),
}]);
}


  function resetPack() {
    setPackKey((v) => v + 1);
    setFlipped(Array(5).fill(false));
    grantedRef.current = new Set(); // новый пак — новая выдача
  }

  function flipOne(i: number) {
    setFlipped((prev) => {
      if (prev[i]) return prev; // уже открыта
      const next = [...prev];
      next[i] = true;
      return next;
    });

    // сразу выдаём карту в инвентарь при перевороте
    grantToInventory(cards[i]);
  }

  return (
    <div className="poRoot">
      <div className="poBoard">
        <div className="poCardsRow">
          {cards.map((c, i) => (
            <Card3D
              key={c.instanceId}
              card={c}
              flipped={flipped[i]}
              onFlip={() => flipOne(i)}
              index={i}
            />
          ))}
        </div>
      </div>

      <div className="poFooter">
        <button className="poBtn" onClick={() => nav(-1)}>
          НАЗАД
        </button>

        <button className="poBtn poBtnPrimary" onClick={resetPack}>
          ОТКРЫТЬ ЕЩЁ
          <div className="poBtnSub">(СТОИМОСТЬ ПАКА)</div>
        </button>

        <button className="poBtn" onClick={() => nav("/inventory")}>
          ИНВЕНТАРЬ
        </button>
      </div>
    </div>
  );
}
