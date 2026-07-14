import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "../../useGameStore";
import {
  resolvePassportFromDetail,
  resolvePassportFromElement,
} from "./cardPassportModel";
import type { CardPassportData, OpenPassportDetail } from "./cardPassportTypes";
import "./cardPassport.css";

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  startRotationY: number;
  startRotationX: number;
  velocityY: number;
  moved: boolean;
}

const CUSTOM_EVENT_NAME = "fraktum:open-card-passport";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function nearestCardSide(degrees: number) {
  return Math.round(degrees / 180) * 180;
}

function priceLabel(card: CardPassportData) {
  if (card.onlinePrice === null) return "НЕТ АКТИВНЫХ ПРЕДЛОЖЕНИЙ";
  if (card.onlinePrice === undefined) return "РЫНОЧНЫЕ ДАННЫЕ НЕДОСТУПНЫ";
  return `${card.onlinePrice.toLocaleString("ru-RU")} ${card.currencyLabel}`;
}

export function CardPassportHost() {
  const ownedCards = useGameStore((state) => state.ownedCards);
  const [card, setCard] = useState<CardPassportData | null>(null);
  const [rotationY, setRotationY] = useState(0);
  const [rotationX, setRotationX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const inertiaFrameRef = useRef<number | null>(null);

  const stopInertia = useCallback(() => {
    if (inertiaFrameRef.current !== null) {
      window.cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    stopInertia();
    setCard(null);
    setIsDragging(false);
    dragRef.current = null;
  }, [stopInertia]);

  const open = useCallback((nextCard: CardPassportData) => {
    stopInertia();
    setRotationX(0);
    setRotationY(0);
    setIsDragging(false);
    dragRef.current = null;
    setCard(nextCard);
  }, [stopInertia]);

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".fraktumPassportOverlay")) return;

      const resolved = resolvePassportFromElement(event.target, ownedCards);
      if (!resolved) return;

      event.preventDefault();
      event.stopPropagation();
      open(resolved);
    };

    const onCustomOpen = (event: Event) => {
      const customEvent = event as CustomEvent<OpenPassportDetail>;
      const resolved = resolvePassportFromDetail(customEvent.detail, ownedCards);
      if (resolved) open(resolved);
    };

    document.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener(CUSTOM_EVENT_NAME, onCustomOpen);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener(CUSTOM_EVENT_NAME, onCustomOpen);
    };
  }, [open, ownedCards]);

  useEffect(() => {
    if (!card) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [card, close]);

  useEffect(() => () => stopInertia(), [stopInertia]);

  if (!card) return null;

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    stopInertia();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: performance.now(),
      startRotationY: rotationY,
      startRotationX: rotationX,
      velocityY: 0,
      moved: false,
    };

    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const now = performance.now();
    const elapsed = Math.max(8, now - drag.lastTime);

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) drag.moved = true;

    drag.velocityY = ((event.clientX - drag.lastX) / elapsed) * 17;
    drag.lastX = event.clientX;
    drag.lastTime = now;

    setRotationY(drag.startRotationY + deltaX * 0.58);
    setRotationX(clamp(drag.startRotationX - deltaY * 0.18, -16, 16));
  };

  const startInertia = (initialVelocity: number) => {
    let velocity = initialVelocity;
    let current = rotationY;

    const animate = () => {
      current += velocity;
      velocity *= 0.92;
      setRotationY(current);
      setRotationX((value) => value * 0.86);

      if (Math.abs(velocity) > 0.12) {
        inertiaFrameRef.current = window.requestAnimationFrame(animate);
        return;
      }

      inertiaFrameRef.current = null;
      setRotationX(0);
      setRotationY(nearestCardSide(current));
    };

    inertiaFrameRef.current = window.requestAnimationFrame(animate);
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    setIsDragging(false);

    if (!drag.moved) {
      setRotationX(0);
      setRotationY((value) => nearestCardSide(value) + 180);
      return;
    }

    if (Math.abs(drag.velocityY) >= 0.8) {
      startInertia(drag.velocityY);
    } else {
      setRotationX(0);
      setRotationY((value) => nearestCardSide(value));
    }
  };

  return createPortal(
    <div
      className="fraktumPassportOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className={`fraktumPassport fraktumPassport--${card.rarity}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Паспорт карты ${card.name}`}
      >
        <header className="fraktumPassport__topbar">
          <div className="fraktumPassport__code" title={card.code}>
            {card.code}
          </div>

          <div className="fraktumPassport__price">
            <span>ОНЛАЙН-ЦЕНА:</span>
            <strong>{priceLabel(card)}</strong>
          </div>

          <button
            className="fraktumPassport__close"
            type="button"
            onClick={close}
            aria-label="Закрыть паспорт карты"
          >
            ×
          </button>
        </header>

        <div className="fraktumPassport__body">
          <div className="fraktumPassport__cardZone">
            <div className="fraktumPassport__cardGlow" aria-hidden="true" />

            <div
              className={`fraktumPassport__cardStage${isDragging ? " is-dragging" : ""}`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPointer}
              onPointerCancel={finishPointer}
              onContextMenu={(event) => event.preventDefault()}
              title="Зажмите ЛКМ и двигайте мышь. Короткий клик переворачивает карту."
            >
              <div
                className="fraktumPassport__card3d"
                style={{ transform: `rotateX(${rotationX}deg) rotateY(${rotationY}deg)` }}
              >
                <div className="fraktumPassport__face fraktumPassport__face--front">
                  <img src={card.frontImage} alt={card.name} draggable={false} />
                </div>

                <div className="fraktumPassport__face fraktumPassport__face--back">
                  <img src={card.backImage} alt="Рубашка карты" draggable={false} />
                </div>
              </div>
            </div>

            <div className="fraktumPassport__hint">
              ЛКМ + движение — вращение · Клик — переворот
            </div>
          </div>

          <aside className="fraktumPassport__info">
            <div className="fraktumPassport__identity">
              <h1>{card.name}</h1>

              <div className="fraktumPassport__traits">
                <span className={`fraktumPassport__element is-${card.element}`}>
                  {card.elementLabel}
                </span>
                <span className="fraktumPassport__separator">·</span>
                <span className={`fraktumPassport__kind is-${card.kind}`}>
                  {card.kindLabel}
                </span>
                <span className="fraktumPassport__separator">·</span>
                <span className="fraktumPassport__will">◆ {card.willCost} ВОЛИ</span>
              </div>
            </div>

            <div className="fraktumPassport__scroll">
              <section className="fraktumPassport__section">
                <h2>ЧТО ДЕЛАЕТ</h2>
                <p>{card.effectText}</p>
              </section>

              <section className="fraktumPassport__section">
                <h2>ПРАВИЛА ИСПОЛЬЗОВАНИЯ</h2>
                <p>{card.usageRules}</p>
              </section>

              {card.history?.trim() ? (
                <section className="fraktumPassport__section">
                  <h2>ИСТОРИЯ</h2>
                  <p>{card.history}</p>
                </section>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </div>,
    document.body,
  );
}
