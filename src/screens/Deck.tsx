import { useMemo, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore, type OwnedCard } from "../useGameStore";
import TiltCard from "../components/TiltCard";

type DeckKind = "main" | "character" | "boost";
type SlotKey = "character" | `boost_${number}` | `main_${number}`;

type Card = {
  id: string; // instanceId
  title: string;
  kind: DeckKind;
  frontSrc: string;
  rarity?: string;
  isFoil: boolean;
  edition?: "serial" | "foil_serial";
  marketValue?: number;
  cost?: number;
  attack?: number;
  health?: number;
};

const RARITY_SCORE: Record<string, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  mythic: 4,
  legendary: 5,
  chromatic: 6,
  exotic: 7,
  divine: 8,
  forgotten: 9,
  archaic: 10,
};

function kindOf(card: OwnedCard): DeckKind {
  const t = (card.type ?? "").toLowerCase();
  if (t.includes("персонаж") || t.includes("character")) return "character";
  if (t.includes("бонус") || t.includes("bonus") || t.includes("усилен") || t.includes("boost")) return "boost";
  return "main";
}

function rarityScore(card: Card) {
  return RARITY_SCORE[String(card.rarity ?? "common").toLowerCase()] ?? 0;
}

function powerScore(card: Card) {
  return (card.cost ?? 0) * 6 + (card.attack ?? 0) * 4 + (card.health ?? 0) * 3;
}

function compareBestCards(a: Card, b: Card) {
  const rarityDiff = rarityScore(b) - rarityScore(a);
  if (rarityDiff !== 0) return rarityDiff;

  const powerDiff = powerScore(b) - powerScore(a);
  if (powerDiff !== 0) return powerDiff;

  return a.title.localeCompare(b.title);
}

function DeckCardVisual({ card, compact = false }: { card: Card; compact?: boolean }) {
  return (
    <TiltCard
      rarity={card.rarity}
      isFoil={card.isFoil}
      maskSrc={card.frontSrc}
      maxTilt={compact ? 6 : 9}
      className={`deckTiltCard ${compact ? "isCompact" : ""}`}
    >
      <img
        className="deckCardImg"
        src={card.frontSrc}
        alt={card.title}
        draggable={false}
      />
      {card.isFoil ? <div className="foilBadge deckFoilBadge">FOIL</div> : null}
    </TiltCard>
  );
}

function slotKind(slot: SlotKey): DeckKind {
  if (slot === "character") return "character";
  if (slot.startsWith("boost_")) return "boost";
  return "main";
}

type SlotsSnapshot = {
  charId: string | null;
  boostsIds: (string | null)[];
  mainsIds: (string | null)[];
};

export default function Deck() {
  const nav = useNavigate();

  const owned = useGameStore((s) => s.ownedCards);
  const deckIds = useGameStore((s) => s.deckIds);
  const setDeckIds = useGameStore((s) => s.setDeckIds);
  const removeFromDeck = useGameStore((s) => s.removeFromDeck);

  // пул — инвентарь игрока
  const pool = useMemo<Card[]>(
    () =>
      owned.map((c) => {
        const extended = c as OwnedCard & {
          cost?: number;
          attack?: number;
          health?: number;
        };

        return {
          id: c.instanceId,
          title: c.title,
          kind: kindOf(c),
          frontSrc: c.frontSrc,
          rarity: c.rarity,
          isFoil: Boolean(c.isFoil || c.edition === "foil_serial"),
          edition: c.edition,
          marketValue: c.marketValue,
          cost: extended.cost,
          attack: extended.attack,
          health: extended.health,
        };
      }),
    [owned]
  );

  const byId = useMemo(() => new Map(pool.map((c) => [c.id, c])), [pool]);

  // карты колоды по порядку deckIds
  const deckCards = useMemo(() => {
    return deckIds
      .map((id) => byId.get(id) ?? null)
      .filter((x): x is Card => Boolean(x));
  }, [deckIds, byId]);

  // раскладываем по слотам (как у тебя)
  const character = useMemo(
    () => deckCards.find((c) => c.kind === "character") ?? null,
    [deckCards]
  );
  const boosts = useMemo(
    () => deckCards.filter((c) => c.kind === "boost").slice(0, 4),
    [deckCards]
  );
  const mains = useMemo(
    () => deckCards.filter((c) => c.kind === "main").slice(0, 18),
    [deckCards]
  );

  const boostSlots = useMemo<(Card | null)[]>(() => {
    const arr = Array.from({ length: 4 }).map(() => null as Card | null);
    for (let i = 0; i < Math.min(4, boosts.length); i++) arr[i] = boosts[i];
    return arr;
  }, [boosts]);

  const mainSlots = useMemo<(Card | null)[]>(() => {
    const arr = Array.from({ length: 18 }).map(() => null as Card | null);
    for (let i = 0; i < Math.min(18, mains.length); i++) arr[i] = mains[i];
    return arr;
  }, [mains]);

  // drag UI
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverSlot, setHoverSlot] = useState<SlotKey | null>(null);

  function allowDrop(e: DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function setPayload(e: DragEvent, payload: { id: string; fromSlot?: SlotKey }) {
    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  }

  function readPayload(e: DragEvent): { id: string; fromSlot?: SlotKey } | null {
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (!obj?.id) return null;
      return obj;
    } catch {
      return { id: raw };
    }
  }

  function onDragStartPool(e: DragEvent<HTMLDivElement>, card: Card) {
    setDragId(card.id);
    setPayload(e, { id: card.id });
  }

  function onDragStartSlot(e: DragEvent<HTMLDivElement>, slot: SlotKey, card: Card) {
    setDragId(card.id);
    setPayload(e, { id: card.id, fromSlot: slot });
  }

  function onDragEnd() {
    setDragId(null);
    setHoverSlot(null);
  }

  function getSlotsSnapshot(): SlotsSnapshot {
    return {
      charId: character?.id ?? null,
      boostsIds: boostSlots.map((c) => c?.id ?? null),
      mainsIds: mainSlots.map((c) => c?.id ?? null),
    };
  }

  function setSlotId(snap: SlotsSnapshot, slot: SlotKey, value: string | null) {
    if (slot === "character") {
      snap.charId = value;
      return;
    }
    if (slot.startsWith("boost_")) {
      const i = Number(slot.split("_")[1]);
      snap.boostsIds = [...snap.boostsIds];
      snap.boostsIds[i] = value;
      return;
    }
    const i = Number(slot.split("_")[1]);
    snap.mainsIds = [...snap.mainsIds];
    snap.mainsIds[i] = value;
  }

  function getSlotId(snap: SlotsSnapshot, slot: SlotKey) {
    if (slot === "character") return snap.charId;
    if (slot.startsWith("boost_")) return snap.boostsIds[Number(slot.split("_")[1])] ?? null;
    return snap.mainsIds[Number(slot.split("_")[1])] ?? null;
  }

  // убираем карту из всех слотов ЕЁ ТИПА (чтобы не было дублей)
  function removeFromKindEverywhere(snap: SlotsSnapshot, id: string, kind: DeckKind) {
    if (kind === "character") {
      if (snap.charId === id) snap.charId = null;
      return;
    }
    if (kind === "boost") {
      snap.boostsIds = snap.boostsIds.map((x) => (x === id ? null : x));
      return;
    }
    snap.mainsIds = snap.mainsIds.map((x) => (x === id ? null : x));
  }

  function applySlots(snap: SlotsSnapshot) {
    const next: string[] = [];
    if (snap.charId) next.push(snap.charId);
    for (const id of snap.boostsIds) if (id) next.push(id);
    for (const id of snap.mainsIds) if (id) next.push(id);
    setDeckIds(next);
  }

  function dropToSlot(e: DragEvent, targetSlot: SlotKey) {
    e.preventDefault();
    const payload = readPayload(e);
    if (!payload) return;

    const card = byId.get(payload.id) ?? null;
    if (!card) return;

    const targetKind = slotKind(targetSlot);

    // можно дропать только подходящий тип
    if (card.kind !== targetKind) return;

    const snap = getSlotsSnapshot();

    // 1) тащим ИЗ слота -> swap/перенос (ТОЛЬКО внутри одного типа)
    if (payload.fromSlot) {
      const fromSlot = payload.fromSlot;

      if (slotKind(fromSlot) !== targetKind) return;

      const fromId = getSlotId(snap, fromSlot);
      if (!fromId) return;

      const toId = getSlotId(snap, targetSlot);

      if (!toId) {
        // перенос в пустой слот
        setSlotId(snap, targetSlot, fromId);
        setSlotId(snap, fromSlot, null);
        applySlots(snap);
        setHoverSlot(null);
        return;
      }

      // swap
      setSlotId(snap, targetSlot, fromId);
      setSlotId(snap, fromSlot, toId);
      applySlots(snap);
      setHoverSlot(null);
      return;
    }

    // 2) тащим ИЗ пула -> кладём в слот (убираем из других слотов этого типа)
    removeFromKindEverywhere(snap, card.id, targetKind);
    setSlotId(snap, targetSlot, card.id);
    applySlots(snap);
    setHoverSlot(null);
  }

  function autoBuild() {
    const chars = pool.filter((c) => c.kind === "character").sort(compareBestCards).slice(0, 1);
    const boostsPick = pool.filter((c) => c.kind === "boost").sort(compareBestCards).slice(0, 4);

    const remainingDeckSpace = Math.max(0, 20 - chars.length - boostsPick.length);
    const mainsPick = pool
      .filter((c) => c.kind === "main")
      .sort(compareBestCards)
      .slice(0, Math.min(18, remainingDeckSpace));

    setDeckIds([...chars, ...boostsPick, ...mainsPick].map((c) => c.id));
  }

  function save() {
    alert("Сохранено (zustand persist).");
  }

  // пул: карты, которых нет в deckIds
  const notInDeck = useMemo(() => {
    const set = new Set(deckIds);
    return pool.filter((c) => !set.has(c.id));
  }, [pool, deckIds]);

  const mainsPool = notInDeck.filter((c) => c.kind === "main").slice(0, 10);
  const boostsPool = notInDeck.filter((c) => c.kind === "boost").slice(0, 6);
  const charsPool = notInDeck.filter((c) => c.kind === "character").slice(0, 6);

  return (
    <div className="deckRoot">
      <aside className="deckLeft">
        {/* character */}
        <div className="deckLeftBlock deckCharacterBlock">
          <div
            className={`deckCharSlot ${hoverSlot === "character" ? "isHover" : ""}`}
            onDragOver={allowDrop}
            onDrop={(e) => dropToSlot(e, "character")}
            onDragEnter={() => setHoverSlot("character")}
            onDragLeave={() => setHoverSlot(null)}
            title="Перетащи персонажа сюда"
          >
            <div className="deckSlotInner" />
            {character ? (
              <div
                draggable
                className={`deckPlaced ${dragId === character.id ? "isDragging" : ""}`}
                onDragStart={(e) => onDragStartSlot(e, "character", character)}
                onDragEnd={onDragEnd}
                title="Потяни и кинь на другой слот — swap"
              >
                <DeckCardVisual card={character} />
                <button className="deckRemoveBtn" onClick={() => removeFromDeck(character.id)} type="button">
                  x
                </button>
                <div className="deckSlotInstance">{character.id}</div>
              </div>
            ) : null}
          </div>
        </div>

        {/* boosts */}
        <div className="deckLeftBlock deckBoostsBlock">
          <div className="deckBoostsGrid">
            {Array.from({ length: 4 }).map((_, i) => {
              const key = `boost_${i}` as const;
              const b = boostSlots[i] ?? null;

              return (
                <div
                  key={key}
                  className={`deckBoostSlot ${hoverSlot === key ? "isHover" : ""}`}
                  onDragOver={allowDrop}
                  onDrop={(e) => dropToSlot(e, key)}
                  onDragEnter={() => setHoverSlot(key)}
                  onDragLeave={() => setHoverSlot(null)}
                  title="Перетащи усиление"
                >
                  <div className="deckSlotInner" />
                  {b ? (
                    <div
                      draggable
                      className={`deckPlaced ${dragId === b.id ? "isDragging" : ""}`}
                      onDragStart={(e) => onDragStartSlot(e, key, b)}
                      onDragEnd={onDragEnd}
                      title="Потяни и кинь на другой слот — swap"
                    >
                      <DeckCardVisual card={b} compact />
                      <button className="deckRemoveBtn" onClick={() => removeFromDeck(b.id)} type="button">
                        x
                      </button>
                      <div className="deckSlotInstance small">{b.id}</div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="deckLeftButtons">
          <button className="deckBtn" onClick={save}>
            СОХРАНИТЬ
          </button>
          <button className="deckBtn" onClick={autoBuild}>
            СОБРАТЬ ИЗ<br />ЛУЧШИХ КАРТ
          </button>
          <button className="deckBtn" onClick={() => nav("/inventory")}>
            НАЗАД В ИНВЕНТАРЬ
          </button>
        </div>

        {/* пул */}
        <div className="deckDemoPool">
          <div className="deckDemoTitle">Инвентарь (перетащи в слоты)</div>

          <div className="deckDemoRow">
            <div className="deckDemoTag">Персонажи</div>
            <div className="deckMiniRow">
              {charsPool.map((c) => (
                <div
                  key={c.id}
                  className={`deckMiniCard ${c.isFoil ? "isFoilMini" : ""} ${dragId === c.id ? "isDragging" : ""}`}
                  draggable
                  onDragStart={(e) => onDragStartPool(e, c)}
                  onDragEnd={onDragEnd}
                  title={c.isFoil ? `${c.title} · FOIL SERIAL` : c.title}
                >
                  <img className="deckMiniCardImg" src={c.frontSrc} alt="" draggable={false} />
                  {c.isFoil ? <span className="deckMiniFoilBadge">F</span> : null}
                  <span className="deckMiniKindBadge">C</span>
                </div>
              ))}
            </div>
          </div>

          <div className="deckDemoRow">
            <div className="deckDemoTag">Усиления</div>
            <div className="deckMiniRow">
              {boostsPool.map((c) => (
                <div
                  key={c.id}
                  className={`deckMiniCard ${c.isFoil ? "isFoilMini" : ""} ${dragId === c.id ? "isDragging" : ""}`}
                  draggable
                  onDragStart={(e) => onDragStartPool(e, c)}
                  onDragEnd={onDragEnd}
                  title={c.isFoil ? `${c.title} · FOIL SERIAL` : c.title}
                >
                  <img className="deckMiniCardImg" src={c.frontSrc} alt="" draggable={false} />
                  {c.isFoil ? <span className="deckMiniFoilBadge">F</span> : null}
                  <span className="deckMiniKindBadge">B</span>
                </div>
              ))}
            </div>
          </div>

          <div className="deckDemoRow">
            <div className="deckDemoTag">Основные</div>
            <div className="deckMiniRow">
              {mainsPool.map((c) => (
                <div
                  key={c.id}
                  className={`deckMiniCard ${c.isFoil ? "isFoilMini" : ""} ${dragId === c.id ? "isDragging" : ""}`}
                  draggable
                  onDragStart={(e) => onDragStartPool(e, c)}
                  onDragEnd={onDragEnd}
                  title={c.isFoil ? `${c.title} · FOIL SERIAL` : c.title}
                >
                  <img className="deckMiniCardImg" src={c.frontSrc} alt="" draggable={false} />
                  {c.isFoil ? <span className="deckMiniFoilBadge">F</span> : null}
                  <span className="deckMiniKindBadge">M</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* mains grid */}
      <section className="deckRight">
        <div className="deckMainGrid">
          {mainSlots.map((c, i) => {
            const key = `main_${i}` as const;
            return (
              <div
                key={key}
                className={`deckMainSlot ${hoverSlot === key ? "isHover" : ""}`}
                onDragOver={allowDrop}
                onDrop={(e) => dropToSlot(e, key)}
                onDragEnter={() => setHoverSlot(key)}
                onDragLeave={() => setHoverSlot(null)}
                title="Перетащи основную карту / swap"
              >
                <div className="deckSlotInner" />
                {c ? (
                  <div
                    draggable
                    className={`deckPlaced ${dragId === c.id ? "isDragging" : ""}`}
                    onDragStart={(e) => onDragStartSlot(e, key, c)}
                    onDragEnd={onDragEnd}
                  title="Потяни и кинь на другой слот — swap"
                >
                  <DeckCardVisual card={c} />
                  <button className="deckRemoveBtn" onClick={() => removeFromDeck(c.id)} type="button">
                    x
                  </button>
                  <div className="deckSlotInstance">{c.id}</div>
                </div>
              ) : null}
            </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
