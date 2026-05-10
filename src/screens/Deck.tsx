import { useMemo, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore, type OwnedCard } from "../useGameStore";

type DeckKind = "main" | "character" | "boost";
type SlotKey = "character" | `boost_${number}` | `main_${number}`;

type Card = {
  id: string; // instanceId
  title: string;
  kind: DeckKind;
  frontSrc: string;
};

function kindOf(card: OwnedCard): DeckKind {
  const t = (card.type ?? "").toLowerCase();
  if (t.includes("персонаж") || t.includes("character")) return "character";
  if (t.includes("усилен") || t.includes("boost")) return "boost";
  return "main";
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
  const clearDeck = useGameStore((s) => s.clearDeck);
  const addToDeck = useGameStore((s) => s.addToDeck);

  // пул — инвентарь игрока
  const pool = useMemo<Card[]>(
    () =>
      owned.map((c) => ({
        id: c.instanceId,
        title: c.title,
        kind: kindOf(c),
        frontSrc: c.frontSrc,
      })),
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
    clearDeck();
    const chars = pool.filter((c) => c.kind === "character").slice(0, 1);
    const boostsPick = pool.filter((c) => c.kind === "boost").slice(0, 4);
    const mainsPick = pool.filter((c) => c.kind === "main").slice(0, 18);
    [...chars, ...boostsPick, ...mainsPick].forEach((c) => addToDeck(c.id));
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
                <img className="deckCardImg" src={character.frontSrc} alt={character.title} />
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
                      <img className="deckCardImg" src={b.frontSrc} alt={b.title} />
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
                  className={`deckMiniCard ${dragId === c.id ? "isDragging" : ""}`}
                  draggable
                  onDragStart={(e) => onDragStartPool(e, c)}
                  onDragEnd={onDragEnd}
                  title={c.title}
                >
                  C
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
                  className={`deckMiniCard ${dragId === c.id ? "isDragging" : ""}`}
                  draggable
                  onDragStart={(e) => onDragStartPool(e, c)}
                  onDragEnd={onDragEnd}
                  title={c.title}
                >
                  B
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
                  className={`deckMiniCard ${dragId === c.id ? "isDragging" : ""}`}
                  draggable
                  onDragStart={(e) => onDragStartPool(e, c)}
                  onDragEnd={onDragEnd}
                  title={c.title}
                >
                  M
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
                    <img className="deckCardImg" src={c.frontSrc} alt={c.title} />
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
