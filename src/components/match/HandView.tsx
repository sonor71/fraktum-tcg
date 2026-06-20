import { useState } from "react";
import type { PointerEvent } from "react";
import type { CardInstance } from "../../game/core/types";
import { CardView } from "./CardView";

type DragState = {
  cardId: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

function getDropSlotFromPoint(x: number, y: number) {
  const target = document.elementsFromPoint(x, y).find((element) => element instanceof HTMLElement && element.dataset.dropSlot !== undefined) as HTMLElement | undefined;
  const rawSlot = target?.dataset.dropSlot;
  return rawSlot === undefined ? null : Number(rawSlot);
}

export function HandView({ cards, onPlay, disabled, selectedId, onSelect, onInvalidDrop }: { cards: CardInstance[]; onPlay: (id: string, slotIndex: number) => void; disabled?: boolean; selectedId?: string | null; onSelect?: (id: string | null) => void; onInvalidDrop?: (message: string) => void }) {
  const center = (cards.length - 1) / 2;
  const [drag, setDrag] = useState<DragState | null>(null);

  const startDrag = (event: PointerEvent<HTMLDivElement>, card: CardInstance) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ cardId: card.instanceId, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY });
    onSelect?.(card.instanceId);
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    setDrag((current) => current ? { ...current, x: event.clientX, y: event.clientY } : null);
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>, card: CardInstance) => {
    if (!drag || drag.pointerId !== event.pointerId || drag.cardId !== card.instanceId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    const slotIndex = getDropSlotFromPoint(event.clientX, event.clientY);
    setDrag(null);

    if (slotIndex === null) {
      if (distance > 10) onInvalidDrop?.("Invalid target");
      return;
    }

    onPlay(card.instanceId, slotIndex);
  };

  return (
    <div className="playerHandFan" aria-label="Player hand">
      {cards.map((card, index) => {
        const offset = index - center;
        const selected = selectedId === card.instanceId;
        const dragging = drag?.cardId === card.instanceId;
        const baseTransform = `translateX(${offset * 42}px) translateY(${Math.abs(offset) * 8 - (selected ? 52 : 0)}px) rotate(${offset * 7}deg)`;
        const dragTransform = dragging ? `translate(${drag.x - drag.startX}px, ${drag.y - drag.startY - 52}px) scale(1.12)` : baseTransform;

        return (
          <div
            className={`playerHandCard ${selected ? "is-selected" : ""} ${dragging ? "is-dragging" : ""}`}
            key={card.instanceId}
            style={{ transform: dragTransform, zIndex: dragging ? 500 : selected ? 100 : index + 1 }}
            onMouseEnter={() => onSelect?.(card.instanceId)}
            onMouseLeave={() => !dragging && onSelect?.(null)}
            onPointerDown={(event) => startDrag(event, card)}
            onPointerMove={moveDrag}
            onPointerUp={(event) => endDrag(event, card)}
            onPointerCancel={() => setDrag(null)}
          >
            <CardView card={card} disabled={disabled} selected={selected} dragging={dragging} />
          </div>
        );
      })}
    </div>
  );
}
