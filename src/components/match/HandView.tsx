import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, PointerEvent } from "react";
import type { CardInstance } from "../../game/core/types";
import { CardView } from "./CardView";

type HandViewProps = {
  cards: CardInstance[];
  onPlay: (id: string, slotIndex: number) => void;
  disabled?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onInvalidDrop?: (message: string) => void;
};

type DragState = {
  cardId: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  grabX: number;
  grabY: number;
  width: number;
  height: number;
  hasMoved: boolean;
};

type DropSlotResult = {
  slotIndex: number;
  element: HTMLElement | null;
};

const MOVE_THRESHOLD = 7;

function parseSlotIndex(value: string | undefined) {
  if (value === undefined) return null;

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function getDropSlotFromPoint(x: number, y: number): DropSlotResult | null {
  if (typeof document === "undefined") return null;

  const elements = document.elementsFromPoint(x, y);

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;

    const explicitDrop = element.closest<HTMLElement>("[data-drop-slot]");
    const explicitIndex = parseSlotIndex(explicitDrop?.dataset.dropSlot);
    if (explicitIndex !== null) {
      return { slotIndex: explicitIndex, element: explicitDrop };
    }

    const playerSlot = element.closest<HTMLElement>('[data-slot-side="player"][data-slot-index]');
    if (!playerSlot) continue;
    if (playerSlot.dataset.slotState === "occupied") continue;

    const fallbackIndex = parseSlotIndex(playerSlot.dataset.slotIndex);
    if (fallbackIndex !== null) {
      return { slotIndex: fallbackIndex, element: playerSlot };
    }
  }

  return null;
}

function clearDropHover() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".matchBoardSlot.is-drag-over").forEach((element) => {
    element.classList.remove("is-drag-over");
  });
}

function setDropHover(element: HTMLElement | null) {
  clearDropHover();
  element?.classList.add("is-drag-over");
}

function getCardTitle(card: CardInstance) {
  return card.definition.title || card.definition.ruTitle || card.baseId || "Card";
}

function getHandPose(index: number, count: number, selected: boolean) {
  if (count <= 1) {
    return {
      x: 0,
      y: selected ? -78 : 0,
      rotation: 0,
      scale: selected ? 1.12 : 1,
      zIndex: selected ? 220 : 120,
    };
  }

  const center = (count - 1) / 2;
  const offset = index - center;
  const abs = Math.abs(offset);
  const normalized = Math.min(1, abs / Math.max(1, center));
  const spacing = Math.max(48, Math.min(82, 740 / Math.max(1, count - 1)));
  const arcY = Math.pow(normalized, 1.65) * 34;
  const rotation = Math.max(-28, Math.min(28, offset * 6.2));

  return {
    x: offset * spacing,
    y: arcY - (selected ? 78 : 0),
    rotation,
    scale: selected ? 1.12 : 1,
    zIndex: selected ? 240 : Math.round(150 - abs * 4 + index),
  };
}

function buildFanTransform(pose: ReturnType<typeof getHandPose>) {
  return `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rotation}deg) scale(${pose.scale})`;
}

export function HandView({
  cards,
  onPlay,
  disabled = false,
  selectedId,
  onSelect,
  onInvalidDrop,
}: HandViewProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragCard = useMemo(
    () => cards.find((card) => card.instanceId === drag?.cardId) ?? null,
    [cards, drag?.cardId],
  );

  const startDrag = (event: PointerEvent<HTMLDivElement>, card: CardInstance) => {
    if (disabled || event.button !== 0) return;

    const cardElement = event.currentTarget.querySelector<HTMLElement>(".matchCardView") ?? event.currentTarget;
    const rect = cardElement.getBoundingClientRect();

    event.preventDefault();
    event.stopPropagation();

    setDrag({
      cardId: card.instanceId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      grabX: event.clientX - rect.left,
      grabY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      hasMoved: false,
    });

    onSelect?.(card.instanceId);
  };

  useEffect(() => {
    if (!drag) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      event.preventDefault();

      const dropSlot = getDropSlotFromPoint(event.clientX, event.clientY);
      setDropHover(dropSlot?.element ?? null);

      setDrag((current) => {
        if (!current || current.pointerId !== event.pointerId) return current;

        const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
        return {
          ...current,
          x: event.clientX,
          y: event.clientY,
          hasMoved: current.hasMoved || distance > MOVE_THRESHOLD,
        };
      });
    };

    const finishDrag = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== drag.pointerId) return;
      event.preventDefault();

      const dropSlot = getDropSlotFromPoint(event.clientX, event.clientY);
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      const shouldTreatAsDrag = drag.hasMoved || distance > MOVE_THRESHOLD;
      const releasedCardId = drag.cardId;
      const releasedCard = cards.find((card) => card.instanceId === releasedCardId);

      clearDropHover();
      setDrag(null);

      if (dropSlot === null) {
        if (shouldTreatAsDrag) {
          const cardName = releasedCard ? getCardTitle(releasedCard) : "Card";
          onInvalidDrop?.(`${cardName}: drop on an empty player slot.`);
        }
        return;
      }

      onPlay(releasedCardId, dropSlot.slotIndex);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      clearDropHover();
      setDrag(null);
      onInvalidDrop?.("Card play cancelled.");
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", finishDrag, { passive: false });
    window.addEventListener("pointercancel", finishDrag, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      clearDropHover();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cards, drag, onInvalidDrop, onPlay]);

  if (cards.length === 0) {
    return (
      <div className="playerHandFan is-empty" aria-label="Player hand">
        <div className="playerHandEmpty">HAND EMPTY</div>
      </div>
    );
  }

  return (
    <div className={`playerHandFan ${drag ? "is-drag-active" : ""}`} aria-label="Player hand">
      {cards.map((card, index) => {
        const selected = selectedId === card.instanceId;
        const dragging = drag?.cardId === card.instanceId;
        const pose = getHandPose(index, cards.length, selected && !dragging);
        const style = {
          transform: buildFanTransform(pose),
          zIndex: dragging ? 0 : pose.zIndex,
          opacity: dragging ? 0.12 : 1,
          pointerEvents: dragging ? "none" : undefined,
        } as CSSProperties;

        return (
          <div
            className={`playerHandCard ${selected ? "is-selected" : ""} ${dragging ? "is-dragging-source" : ""}`}
            key={card.instanceId}
            style={style}
            onMouseEnter={() => !drag && onSelect?.(card.instanceId)}
            onMouseLeave={() => !drag && onSelect?.(null)}
            onPointerDown={(event) => startDrag(event, card)}
          >
            <CardView card={card} disabled={disabled} selected={selected && !dragging} />
          </div>
        );
      })}

      {drag && dragCard && typeof document !== "undefined"
        ? createPortal(
            <div
              className="playerHandDragLayer"
              style={{
                left: drag.x - drag.grabX,
                top: drag.y - drag.grabY,
                width: drag.width,
                height: drag.height,
              }}
            >
              <CardView card={dragCard} selected dragging />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
