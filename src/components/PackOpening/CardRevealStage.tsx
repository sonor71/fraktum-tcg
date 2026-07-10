import { useEffect, useState } from "react";
import type { CardRarity, OwnedCard } from "../../game/types";
import { RarityBurst } from "./RarityBurst";
import type { PackOpeningPhase } from "./types";

const CARD_BACK_SRC = "/cards/card-back.png";

const RARITY_COPY: Record<
  CardRarity,
  { title: string; subtitle: string; code: string }
> = {
  common: {
    title: "ОБЫЧНАЯ",
    subtitle: "Стабильная сигнатура",
    code: "STANDARD DROP",
  },
  rare: {
    title: "РЕДКАЯ",
    subtitle: "Обнаружен усиленный резонанс",
    code: "RARE SIGNAL",
  },
  epic: {
    title: "ЭПИЧЕСКАЯ",
    subtitle: "Фиолетовый импульс подтверждён",
    code: "EPIC SURGE",
  },
  mythic: {
    title: "МИФИЧЕСКАЯ",
    subtitle: "Нестабильная красная аномалия",
    code: "MYTHIC BREACH",
  },
  legendary: {
    title: "ЛЕГЕНДАРНАЯ",
    subtitle: "Золотой протокол активирован",
    code: "LEGENDARY RELIC",
  },
  chromatic: {
    title: "ХРОМАТИЧЕСКАЯ",
    subtitle: "Призматический спектр разрушен",
    code: "CHROMATIC BREAK",
  },
  exotic: {
    title: "ЭКЗОТИЧЕСКАЯ",
    subtitle: "Двойная энергия неизвестного класса",
    code: "EXOTIC ANOMALY",
  },
  divine: {
    title: "БОЖЕСТВЕННАЯ",
    subtitle: "Протокол вознесения завершён",
    code: "DIVINE ASCENSION",
  },
  forgotten: {
    title: "ЗАБЫТАЯ",
    subtitle: "Архив памяти восстановлен",
    code: "FORGOTTEN MEMORY",
  },
  archaic: {
    title: "АРХАИЧЕСКАЯ",
    subtitle: "Древний разлом отвечает",
    code: "ARCHAIC RIFT",
  },
};

export function CardRevealStage({
  card,
  phase,
  cardIndex,
  totalCards,
  canAdvance,
}: {
  card: OwnedCard;
  phase: PackOpeningPhase;
  cardIndex: number;
  totalCards: number;
  canAdvance: boolean;
}) {
  const [frontSrc, setFrontSrc] = useState(
    card.frontSrc || card.image || CARD_BACK_SRC,
  );
  const isFoil = card.edition === "foil_serial" || card.isFoil;
  const presentation = RARITY_COPY[card.rarity];
  const isVisible = phase === "reveal" || phase === "transition";

  useEffect(() => {
    setFrontSrc(card.frontSrc || card.image || CARD_BACK_SRC);
  }, [card]);

  if (!isVisible) return null;

  const isLastCard = cardIndex >= totalCards - 1;

  return (
    <section
      className={`hpo-cardRevealScene phase-${phase} rarity-${card.rarity} ${
        isFoil ? "is-foil" : ""
      }`}
      aria-live="polite"
    >
      <RarityBurst rarity={card.rarity} isFoil={isFoil} />

      <div className="hpo-rarityTitleBlock">
        <span>{presentation.code}</span>
        <h2>{presentation.title}</h2>
        <p>{presentation.subtitle}</p>
      </div>

      <div className="hpo-revealCardFrame" key={card.instanceId}>
        <div className="hpo-revealCardShadow" aria-hidden="true" />
        <div className="hpo-revealCardInner">
          <div className="hpo-revealCardFace hpo-revealCardBack">
            <img src={CARD_BACK_SRC} alt="Рубашка карты" draggable={false} />
          </div>
          <div className="hpo-revealCardFace hpo-revealCardFront">
            <img
              src={frontSrc}
              alt={card.title}
              draggable={false}
              onError={() => setFrontSrc(CARD_BACK_SRC)}
            />
            <span className="hpo-revealCardLight" aria-hidden="true" />
            {isFoil ? <span className="hpo-revealCardFoil" aria-hidden="true" /> : null}
          </div>
        </div>
      </div>

      <div className="hpo-revealMeta">
        <div>
          <span>КАРТА {cardIndex + 1} / {totalCards}</span>
          <strong>{card.title}</strong>
        </div>
        <div>
          <span>{isFoil ? "FOIL SERIAL" : card.rarity.toUpperCase()}</span>
          <strong>{card.instanceId}</strong>
        </div>
        <div>
          <span>MARKET VALUE</span>
          <strong>₵ {card.marketValue.toLocaleString("ru-RU")}</strong>
        </div>
      </div>

      {phase === "reveal" ? (
        <div
          className={`hpo-screenContinueHint ${
            canAdvance ? "is-ready" : ""
          }`}
          aria-live="polite"
        >
          <strong>
            {isLastCard ? "НАЖМИТЕ, ЧТОБЫ ПОКАЗАТЬ РЕЗУЛЬТАТ" : "НАЖМИТЕ ДЛЯ СЛЕДУЮЩЕЙ КАРТЫ"}
          </strong>
          <small>Можно нажать в любом свободном месте экрана</small>
        </div>
      ) : null}
    </section>
  );
}
