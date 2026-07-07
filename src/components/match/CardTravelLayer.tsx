import { useMemo } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

export type CardTravelEvent = {
  id: string;
  image: string;
  title: string;
  from: DOMRect;
  to: DOMRect;
  owner: "player" | "enemy";
  reason: "discard" | "destroyed";
};

type CardTravelLayerProps = {
  events: CardTravelEvent[];
};

function rectCenter(rect: DOMRect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getCardSize(rect: DOMRect) {
  const width = Math.max(48, Math.min(120, rect.width * 0.82));
  return {
    width,
    height: width * 1.4,
  };
}

export function CardTravelLayer({ events }: CardTravelLayerProps) {
  const portalRoot = typeof document === "undefined" ? null : document.body;

  const rendered = useMemo(
    () =>
      events.map((event) => {
        const fromCenter = rectCenter(event.from);
        const toCenter = rectCenter(event.to);
        const size = getCardSize(event.from);

        const left = fromCenter.x - size.width / 2;
        const top = fromCenter.y - size.height / 2;

        const travelX = toCenter.x - fromCenter.x;
        const travelY = toCenter.y - fromCenter.y;

        const style = {
          left,
          top,
          width: size.width,
          height: size.height,
          "--travel-x": `${travelX}px`,
          "--travel-y": `${travelY}px`,
        } as CSSProperties;

        return (
          <div
            className={[
              "matchCardTravel",
              `is-${event.owner}`,
              `is-${event.reason}`,
            ].filter(Boolean).join(" ")}
            style={style}
            key={event.id}
            aria-hidden="true"
          >
            <img src={event.image} alt="" draggable={false} />
            <span>{event.reason === "destroyed" ? "DESTROYED" : "DISCARD"}</span>
          </div>
        );
      }),
    [events],
  );

  if (!portalRoot || rendered.length === 0) return null;

  return createPortal(
    <div className="matchCardTravelLayer" aria-hidden="true">
      {rendered}
    </div>,
    portalRoot,
  );
}
