import {
  useEffect,
  useReducer,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import type { CardRarity, OwnedCard } from "../../game/types";
import { playPackOpen, playRareDrop } from "../../services/audio";
import { CardRevealStage } from "./CardRevealStage";
import { PackShell } from "./PackShell";
import {
  initialPackOpeningState,
  packOpeningReducer,
} from "./packOpeningMachine";
import type { PackOpeningOverlayProps } from "./types";
import "./pack-opening.css";

const HIGH_RARITIES = new Set<CardRarity>([
  "epic",
  "mythic",
  "legendary",
  "chromatic",
  "exotic",
  "divine",
  "forgotten",
  "archaic",
]);

const REVEAL_INPUT_DELAY_MS: Record<CardRarity, number> = {
  common: 1050,
  rare: 1150,
  epic: 1400,
  mythic: 1650,
  legendary: 2050,
  chromatic: 2450,
  exotic: 2650,
  divine: 3050,
  forgotten: 2150,
  archaic: 2650,
};

type SummaryStyle = CSSProperties & {
  "--hpo-summary-delay": string;
};

function SummaryCard({ card, index }: { card: OwnedCard; index: number }) {
  const isFoil = card.edition === "foil_serial" || card.isFoil;
  const src = card.frontSrc || card.image || "/cards/card-back.png";

  return (
    <article
      className={`hpo-summaryCard rarity-${card.rarity} ${
        isFoil ? "is-foil" : ""
      }`}
      style={{ "--hpo-summary-delay": `${130 + index * 95}ms` } as SummaryStyle}
    >
      <div className="hpo-summaryCardArt">
        <img src={src} alt={card.title} />
        <span className="hpo-summaryCardLight" aria-hidden="true" />
        {isFoil ? <span className="hpo-summaryFoil" aria-hidden="true" /> : null}
      </div>
      <div className="hpo-summaryCardMeta">
        <strong>{card.title}</strong>
        <span>{isFoil ? "FOIL SERIAL" : card.rarity.toUpperCase()}</span>
        <small>{card.instanceId}</small>
        <small>₵ {card.marketValue.toLocaleString("ru-RU")}</small>
      </div>
    </article>
  );
}

export function PackOpeningOverlay({
  cards,
  packData,
  onClose,
  onBackToShop,
  onBuyAnother,
}: PackOpeningOverlayProps) {
  const [state, dispatch] = useReducer(
    packOpeningReducer,
    initialPackOpeningState,
  );
  const [canAdvance, setCanAdvance] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
  }, [cards, packData.packId]);

  useEffect(() => {
    if (state.phase !== "opening") return undefined;

    const timer = window.setTimeout(() => {
      dispatch({ type: "OPENING_COMPLETE" });
    }, 1650);

    return () => window.clearTimeout(timer);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "transition") return undefined;

    const timer = window.setTimeout(() => {
      dispatch({ type: "SHOW_NEXT_CARD" });
    }, 420);

    return () => window.clearTimeout(timer);
  }, [state.phase]);

  useEffect(() => {
    setCanAdvance(false);

    if (state.phase !== "reveal") return undefined;

    const card = cards[state.currentCardIndex];
    if (!card) return undefined;

    const isFoil = card.edition === "foil_serial" || card.isFoil;
    const delay =
      REVEAL_INPUT_DELAY_MS[card.rarity] +
      (isFoil ? 350 : 0);

    const timer = window.setTimeout(() => {
      setCanAdvance(true);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [cards, state.currentCardIndex, state.phase]);

  useEffect(() => {
    if (state.phase !== "reveal") return undefined;

    const card = cards[state.currentCardIndex];
    if (!card) return undefined;

    const shouldPlayRare = HIGH_RARITIES.has(card.rarity) || card.isFoil;
    if (!shouldPlayRare) return undefined;

    const timer = window.setTimeout(() => {
      playRareDrop();
    }, 260);

    return () => window.clearTimeout(timer);
  }, [cards, state.currentCardIndex, state.phase]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
    };
  }, []);

  function continueReveal() {
    if (state.phase !== "reveal" || !canAdvance) return;

    setCanAdvance(false);
    dispatch({ type: "NEXT_CARD", totalCards: cards.length });
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (
        (event.key === "Enter" || event.key === " ") &&
        state.phase === "reveal" &&
        canAdvance
      ) {
        event.preventDefault();
        continueReveal();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canAdvance, cards.length, onClose, state.phase]);

  if (!cards.length || typeof document === "undefined") return null;

  const activeCard = cards[state.currentCardIndex];

  function startOpening() {
    if (state.phase !== "sealed") return;
    playPackOpen();
    dispatch({ type: "START_OPENING" });
  }

  function handleOverlayClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (state.phase !== "reveal" || !canAdvance) return;

    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        "button, a, input, textarea, select, [role='button'], [data-hpo-no-advance]",
      )
    ) {
      return;
    }

    continueReveal();
  }

  return createPortal(
    <div
      className={`hpo-root phase-${state.phase} ${
        canAdvance ? "is-ready-to-advance" : ""
      }`}
      onClick={handleOverlayClick}
    >
      <div className="hpo-background" aria-hidden="true">
        <div className="hpo-backgroundGrid" />
        <div className="hpo-backgroundVignette" />
        <div className="hpo-backgroundGlow hpo-backgroundGlowOne" />
        <div className="hpo-backgroundGlow hpo-backgroundGlowTwo" />
        <div className="hpo-backgroundDust" />
      </div>

      <header className="hpo-header">
        <div className="hpo-brandBlock">
          <span>FRAKTUM // PACK OPENING</span>
          <strong>{packData.title}</strong>
        </div>

        <div className="hpo-progressBlock">
          <span>ОТКРЫТО</span>
          <strong>{state.revealedCardIndexes.length}/{cards.length}</strong>
        </div>

        <button
          type="button"
          className="hpo-exitButton"
          onClick={onClose}
          data-hpo-no-advance
        >
          ВЫЙТИ
        </button>
      </header>

      <main className="hpo-stage">
        <PackShell
          phase={state.phase}
          artSrc={packData.artSrc}
          fallbackArtSrc={packData.fallbackArtSrc}
          title={packData.title}
          onOpen={startOpening}
        />

        {activeCard ? (
          <CardRevealStage
            card={activeCard}
            phase={state.phase}
            cardIndex={state.currentCardIndex}
            totalCards={cards.length}
            canAdvance={canAdvance}
          />
        ) : null}
      </main>

      {state.phase === "opening" ? (
        <div className="hpo-openingCaption" aria-live="polite">
          <span>SEAL BREAK</span>
          <strong>ВСКРЫТИЕ БУСТЕРА</strong>
        </div>
      ) : null}

      {state.phase === "summary" ? (
        <section className="hpo-summary">
          <div className="hpo-summaryHeading">
            <span>PACK REVEALED</span>
            <h1>{packData.title}</h1>
            <p>Все карты добавлены в инвентарь.</p>
          </div>

          <div className="hpo-summaryGrid">
            {cards.map((card, index) => (
              <SummaryCard card={card} index={index} key={card.instanceId} />
            ))}
          </div>

          <div className="hpo-summaryActions">
            <button
              type="button"
              className="hpo-actionButton hpo-actionButtonSecondary"
              onClick={onBackToShop}
              data-hpo-no-advance
            >
              МАГАЗИН
            </button>
            <button
              type="button"
              className="hpo-actionButton hpo-actionButtonPrimary"
              onClick={onBuyAnother}
              data-hpo-no-advance
            >
              ОТКРЫТЬ ЕЩЁ
            </button>
            <button
              type="button"
              className="hpo-actionButton hpo-actionButtonSecondary"
              onClick={onClose}
              data-hpo-no-advance
            >
              ИНВЕНТАРЬ
            </button>
          </div>
        </section>
      ) : null}
    </div>,
    document.body,
  );
}
