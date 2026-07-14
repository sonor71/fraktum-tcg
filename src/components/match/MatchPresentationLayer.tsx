import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { PlayerId } from "../../game/core/types";

export type MatchTurnAnnouncement = {
  id: string;
  title: string;
  subtitle: string;
  side: PlayerId;
};

export type MatchRoulettePresentation = {
  id: number;
  event: string;
  ownerId: PlayerId;
};

type MatchPresentationLayerProps = {
  turnAnnouncement: MatchTurnAnnouncement | null;
  roulettePresentation: MatchRoulettePresentation | null;
  opponentName: string;
  isOnlineMode: boolean;
  onRouletteComplete: () => void;
};

type RoulettePhase = "intro" | "spinning" | "result";

const ROULETTE_EVENTS = [
  "MERGED_DECKS",
  "WORLD_WITHOUT_WILL",
  "BLIND_TOP",
  "HIDDEN_HAND",
  "EMPTY_OUTCOME",
] as const;

const ROULETTE_LABELS: Record<string, { title: string; short: string; description: string }> = {
  MERGED_DECKS: {
    title: "СЛИЯНИЕ КОЛОД",
    short: "КОЛОДЫ",
    description: "Оставшиеся карты объединяются, перемешиваются и делятся заново.",
  },
  WORLD_WITHOUT_WILL: {
    title: "МИР БЕЗ ВОЛИ",
    short: "БЕЗ ВОЛИ",
    description: "Розыгрыш карт в этом ходу не требует Воли.",
  },
  BLIND_TOP: {
    title: "СЛЕПАЯ ВЕРШИНА",
    short: "ВЕРХ",
    description: "Играть можно только верхнюю карту своей колоды.",
  },
  HIDDEN_HAND: {
    title: "СКРЫТАЯ РУКА",
    short: "РУКА",
    description: "Карты в руке скрыты до завершения эффекта.",
  },
  EMPTY_OUTCOME: {
    title: "ПУСТОЙ ИСХОД",
    short: "ПУСТОТА",
    description: "Рулетка не изменяет правила этого хода.",
  },
};

function getRouletteMeta(event: string) {
  return ROULETTE_LABELS[event] ?? {
    title: event.replace(/_/g, " "),
    short: "СОБЫТИЕ",
    description: "Рулетка Судьбы изменила ход боя.",
  };
}

function getRouletteTargetAngle(event: string) {
  const index = Math.max(0, ROULETTE_EVENTS.indexOf(event as (typeof ROULETTE_EVENTS)[number]));
  const segmentSize = 360 / ROULETTE_EVENTS.length;
  const segmentCenter = index * segmentSize + segmentSize / 2;
  return 1440 + (360 - segmentCenter);
}

type RoulettePresentationCardProps = {
  presentation: MatchRoulettePresentation;
  opponentName: string;
  isOnlineMode: boolean;
  onComplete: () => void;
};

function RoulettePresentationCard({
  presentation,
  opponentName,
  isOnlineMode,
  onComplete,
}: RoulettePresentationCardProps) {
  const [phase, setPhase] = useState<RoulettePhase>("intro");

  useEffect(() => {
    const spinTimer = window.setTimeout(() => setPhase("spinning"), 850);
    const resultTimer = window.setTimeout(() => setPhase("result"), 3150);
    const closeTimer = window.setTimeout(onComplete, 4550);

    return () => {
      window.clearTimeout(spinTimer);
      window.clearTimeout(resultTimer);
      window.clearTimeout(closeTimer);
    };
  }, [onComplete]);

  const rouletteMeta = useMemo(() => getRouletteMeta(presentation.event), [presentation.event]);
  const ownerLabel = presentation.ownerId === "player"
    ? "ВЫ АКТИВИРОВАЛИ РУЛЕТКУ"
    : isOnlineMode
      ? `${opponentName.toUpperCase()} АКТИВИРОВАЛ РУЛЕТКУ`
      : "ИИ АКТИВИРОВАЛ РУЛЕТКУ";

  const wheelStyle = {
    "--match-roulette-target-angle": `${getRouletteTargetAngle(presentation.event)}deg`,
  } as CSSProperties;

  return (
    <section
      className={`matchPresentationOverlay is-roulette is-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-live="assertive"
    >
      <div className="matchPresentationBackdrop" aria-hidden="true" />

      <div className="matchRoulettePresentationCard">
        <span className="matchPresentationKicker">{ownerLabel}</span>
        <h2>РУЛЕТКА СУДЬБЫ</h2>

        {phase !== "intro" ? (
          <div className="matchRouletteStage">
            <div className="matchRoulettePointer" aria-hidden="true" />
            <div className="matchRouletteWheel" style={wheelStyle} aria-hidden="true">
              {ROULETTE_EVENTS.map((event, index) => (
                <span className={`matchRouletteWheelLabel is-${index}`} key={event}>
                  {ROULETTE_LABELS[event].short}
                </span>
              ))}
              <i>F</i>
            </div>
          </div>
        ) : (
          <div className="matchRouletteSigil" aria-hidden="true">F</div>
        )}

        <div className={`matchRouletteResult ${phase === "result" ? "is-visible" : ""}`}>
          <span>ВЫПАЛО СОБЫТИЕ</span>
          <strong>{rouletteMeta.title}</strong>
          <p>{rouletteMeta.description}</p>
        </div>
      </div>
    </section>
  );
}

export function MatchPresentationLayer({
  turnAnnouncement,
  roulettePresentation,
  opponentName,
  isOnlineMode,
  onRouletteComplete,
}: MatchPresentationLayerProps) {
  if (roulettePresentation) {
    return (
      <RoulettePresentationCard
        key={roulettePresentation.id}
        presentation={roulettePresentation}
        opponentName={opponentName}
        isOnlineMode={isOnlineMode}
        onComplete={onRouletteComplete}
      />
    );
  }

  if (turnAnnouncement) {
    return (
      <section
        className={`matchPresentationOverlay is-turn is-${turnAnnouncement.side}`}
        role="status"
        aria-live="assertive"
      >
        <div className="matchPresentationBackdrop" aria-hidden="true" />
        <div className="matchTurnAnnouncementCard">
          <span>{turnAnnouncement.subtitle}</span>
          <h2>{turnAnnouncement.title}</h2>
          <i aria-hidden="true" />
        </div>
      </section>
    );
  }

  return null;
}
