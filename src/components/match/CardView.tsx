import type { CSSProperties } from "react";
import type { CardInstance } from "../../game/core/types";
import { getWillCostByRarity } from "../../game/rarityWillCost";
import "./match.css";

type CardViewProps = {
  card: CardInstance;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  size?: "hand" | "board" | "pile";
  dragging?: boolean;
  faceDown?: boolean;
};

type CardDefinitionMeta = CardInstance["definition"] & {
  rarity?: string;
  type?: string;
  ruTitle?: string;
  image?: string;
  imageUrl?: string;
  src?: string;
  path?: string;
  description?: string;
  cost?: number;
  willCost?: number;
  health?: number;
};

function clampNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readString(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }

  return fallback;
}

function normalizeCssToken(value: unknown, fallback: string) {
  const raw = typeof value === "string" && value.trim().length > 0 ? value : fallback;
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function getCardHp(card: CardInstance) {
  const maxHp = Math.max(0, clampNumber(card.definition.health));
  const currentHp = Math.max(0, clampNumber(card.currentHealth, maxHp));
  const hasHp = maxHp > 0 || currentHp > 0;

  return {
    currentHp,
    maxHp: maxHp > 0 ? maxHp : currentHp,
    hasHp,
  };
}

function getHpStateClass(currentHp: number, maxHp: number) {
  if (maxHp <= 0) return "";

  const ratio = currentHp / maxHp;
  if (ratio <= 0.25) return "is-critical-hp";
  if (ratio <= 0.5) return "is-damaged-hp";
  return "is-healthy-hp";
}

export function CardView({
  card,
  onClick,
  disabled = false,
  selected = false,
  size = "hand",
  dragging = false,
  faceDown = false,
}: CardViewProps) {
  const definition = card.definition as CardDefinitionMeta;
  const definitionRecord = definition as unknown as Record<string, unknown>;
  const { currentHp, maxHp, hasHp } = getCardHp(card);

  const title = readString(definitionRecord, ["title", "ruTitle", "name"], card.baseId || "Unknown card");
  const description = readString(definitionRecord, ["description", "text", "effectText"]);
  const image = readString(definitionRecord, ["image", "imageUrl", "src", "path"], "/cards/card-back.png");
  const rarity = readString(definitionRecord, ["rarity"], "common");
  const cost = getWillCostByRarity(rarity);
  const type = readString(definitionRecord, ["type"], "card");
  const hpStateClass = getHpStateClass(currentHp, maxHp);

  const cardStyle = {
    "--card-hp-ratio": maxHp > 0 ? currentHp / maxHp : 0,
    transform: "none",
  } as CSSProperties;

  const className = [
    "matchCardView",
    `is-${size}`,
    `is-rarity-${normalizeCssToken(rarity, "common")}`,
    `is-type-${normalizeCssToken(type, "card")}`,
    hpStateClass,
    selected ? "is-selected" : "",
    dragging ? "is-dragging" : "",
    disabled ? "is-disabled" : "",
    card.temporaryUntilRoundEnd ? "is-temporary" : "",
    faceDown ? "is-face-down" : "",
  ].filter(Boolean).join(" ");

  const hpLabel = maxHp > 0 ? `${currentHp}/${maxHp}` : `${currentHp}`;
  const readableDescription = description ? `: ${description}` : "";

  return (
    <button
      className={className}
      style={cardStyle}
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={faceDown ? "Hidden card" : `${title}${readableDescription}`}
      data-card-id={card.instanceId}
      data-card-base-id={faceDown ? undefined : card.baseId}
      data-card-title={faceDown ? "Hidden card" : title}
      data-card-cost={faceDown ? undefined : cost}
      data-card-hp={faceDown ? undefined : hasHp ? currentHp : undefined}
      aria-label={faceDown ? "Hidden card" : `${title}. Will cost ${cost}${hasHp ? `. HP ${hpLabel}` : ""}`}
    >
      <img className="matchCardImage" src={faceDown ? "/cards/card-back.png" : image} alt={faceDown ? "Hidden card" : title} draggable={false} />

      {!faceDown ? (
        <span className="matchCardBadge is-cost" aria-hidden="true">
          {cost}
        </span>
      ) : null}

      {!faceDown && hasHp ? (
        <span className="matchCardBadge is-hp" aria-hidden="true">
          {size === "pile" ? currentHp : hpLabel}
        </span>
      ) : null}

      {!faceDown && card.temporaryUntilRoundEnd ? (
        <span className="matchCardBadge is-temp" aria-hidden="true">
          TEMP
        </span>
      ) : null}

      {disabled ? <span className="matchCardDisabledVeil" aria-hidden="true" /> : null}
      <span className="matchCardShine" aria-hidden="true" />
    </button>
  );
}
