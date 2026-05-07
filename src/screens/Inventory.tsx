import { useMemo, type CSSProperties, type DragEvent, type PointerEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore, type OwnedCard } from "../useGameStore";

type CardItem = OwnedCard & { rarity?: string };

const MAX_TILT_X = 16;
const MAX_TILT_Y = 20;

function rarityClass(rarity?: string) {
  const value = (rarity ?? "").trim().toLowerCase();

  if (value.includes("хром") || value.includes("chrom")) return "rarity-chromatic";
  if (value.includes("миф") || value.includes("myth")) return "rarity-mythic";
  if (value.includes("леген") || value.includes("legend")) return "rarity-legendary";
  if (value.includes("эпич") || value.includes("epic")) return "rarity-epic";
  if (value.includes("редк") || value.includes("rare")) return "rarity-rare";
  return "rarity-common";
}

export default function Inventory() {
  const nav = useNavigate();

  const owned = useGameStore((s) => s.ownedCards);
  const deckIds = useGameStore((s) => s.deckIds);
  const addToDeck = useGameStore((s) => s.addToDeck);

  const cards = useMemo<CardItem[]>(() => [...owned], [owned]);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [funnelHover, setFunnelHover] = useState(false);

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

  function onCardPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();

    const pxRaw = (e.clientX - rect.left) / rect.width;
    const pyRaw = (e.clientY - rect.top) / rect.height;
    const px = Math.min(Math.max(pxRaw, 0), 1);
    const py = Math.min(Math.max(pyRaw, 0), 1);

    const dx = px - 0.5;
    const dy = py - 0.5;
    const rotateY = dx * (MAX_TILT_Y * 2);
    const rotateX = -dy * (MAX_TILT_X * 2);
    const dist = Math.min(Math.hypot(dx, dy) / 0.7071, 1);
    const scale = 1.028 + dist * 0.03;
    const glow = 0.32 + dist * 0.4;
    const shineAngle = 115 + dx * 22 + dy * 16;

    el.style.setProperty("--rx", `${rotateX.toFixed(2)}deg`);
    el.style.setProperty("--ry", `${rotateY.toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(px * 100).toFixed(2)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(2)}%`);
    el.style.setProperty("--scale", scale.toFixed(3));
    el.style.setProperty("--glow", glow.toFixed(2));
    el.style.setProperty("--shine-angle", `${shineAngle.toFixed(2)}deg`);
  }

  function resetCardTilt(e: PointerEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "50%");
    el.style.setProperty("--scale", "1");
    el.style.setProperty("--glow", "0.34");
    el.style.setProperty("--shine-angle", "120deg");
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

      <div className="invTablet invTablet--clean">
        <div className="invScrollArea">
          <div className="invGrid">
            {cards.length === 0 ? (
              <div style={{ opacity: 0.7, padding: 12 }}>
                Инвентарь пуст — открой пак в магазине.
              </div>
            ) : (
              cards.map((c) => (
                <div
                  key={c.instanceId}
                  className={`invCard ${draggingId === c.instanceId ? "isDragging" : ""}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, c)}
                  onDragEnd={onDragEnd}
                  title={c.title}
                >
                  <div
                    className={`invCardVisual ${rarityClass(c.rarity)}`}
                    onPointerMove={onCardPointerMove}
                    onPointerLeave={resetCardTilt}
                    onPointerCancel={resetCardTilt}
                    style={{ ["--card-mask" as any]: `url("${c.frontSrc}")` } as CSSProperties}
                  >
                    <div className="invCardGlow" aria-hidden="true" />
                    <img className="invCardImg" src={c.frontSrc} alt={c.title} />
                    <div className="invCardFoil" aria-hidden="true" />
                    <div className="invCardShine" aria-hidden="true" />
                  </div>
                </div>
              ))
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
