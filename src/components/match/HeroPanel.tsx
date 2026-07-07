import type { CSSProperties } from "react";
import type { CardInstance, PlayerState } from "../../game/core/types";
import { BonusSlots } from "./BonusSlots";
import { StatusBar } from "./StatusBar";

type HeroPanelProps = {
  player: PlayerState;
  label: string;
  alignment?: "left" | "right";
};

type HeroDefinitionMeta = CardInstance["definition"] & {
  title?: string;
  ruTitle?: string;
  name?: string;
  image?: string;
  imageUrl?: string;
  src?: string;
  description?: string;
  effectKey?: string;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function percent(value: number, max: number) {
  return clamp((value / Math.max(1, max)) * 100, 0, 100);
}

function readDefinitionString(definition: unknown, keys: string[], fallback = "") {
  const record = (definition ?? {}) as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }

  return fallback;
}

function extractBonusPercent(card: CardInstance) {
  const definition = card.definition as HeroDefinitionMeta;
  const text = `${definition.description ?? ""} ${definition.effectKey ?? ""}`;
  const match = text.match(/([+-]?\d+)\s*%/);

  if (!match) return 10;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 10;
}

function getBonusTotal(cards: CardInstance[]) {
  if (!Array.isArray(cards) || cards.length === 0) return 0;
  return cards.reduce((sum, card) => sum + extractBonusPercent(card), 0);
}

function getHeroSubtitle(player: PlayerState) {
  if (player.id === "enemy") return "AI RANK III";
  return "FRAKTUM ADEPT";
}

function getPanelTitle(player: PlayerState, fallback: string) {
  const definition = player.hero?.definition;
  const title = readDefinitionString(definition, ["title", "ruTitle", "name"], fallback);
  return title || fallback;
}

function getHeroImage(player: PlayerState) {
  const definition = player.hero?.definition;
  return readDefinitionString(definition, ["image", "imageUrl", "src"], "/cards/card-back.png");
}

function getHealthState(hpPct: number) {
  if (hpPct <= 0) return "dead";
  if (hpPct <= 25) return "critical";
  if (hpPct <= 55) return "damaged";
  return "stable";
}

export function HeroPanel({ player, label, alignment = "left" }: HeroPanelProps) {
  const hpMax = Math.max(1, player.maxHp);
  const hp = clamp(player.hp, 0, hpMax);
  const hpPct = percent(hp, hpMax);

  const shield = Math.max(0, player.shield);
  const shieldMax = Math.max(10, shield, Math.ceil(hpMax * 0.5));
  const shieldPct = percent(shield, shieldMax);

  const willMax = Math.max(1, player.maxWill);
  const will = clamp(player.will, 0, willMax);
  const willPct = percent(will, willMax);

  const bonusCards = Array.isArray(player.bonusCards) ? player.bonusCards : [];
  const bonusTotal = getBonusTotal(bonusCards);
  const heroTitle = getPanelTitle(player, label);
  const heroImage = getHeroImage(player);
  const healthState = getHealthState(hpPct);

  const styleVars = {
    "--hero-hp": `${hpPct}%`,
    "--hero-shield": `${shieldPct}%`,
    "--hero-will": `${willPct}%`,
  } as CSSProperties;

  return (
    <section
      className={[
        "matchHeroPanel",
        `is-${alignment}`,
        `is-${player.id}`,
        `is-${healthState}`,
      ].filter(Boolean).join(" ")}
      style={styleVars}
      aria-label={`${label}: HP ${hp}/${hpMax}, shield ${shield}, will ${will}/${willMax}`}
      data-hp-state={healthState}
      data-hp={hp}
      data-shield={shield}
      data-will={will}
    >
      <div className="matchHeroCorners" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>

      <header className="matchHeroIdentity">
        <div className="matchHeroIdentityText">
          <span className="matchHeroRank">{getHeroSubtitle(player)}</span>
          <h2>{label}</h2>
          <small>{heroTitle}</small>
        </div>

        <div className="matchShieldPip" title={`Shield ${shield}`} aria-label={`Shield ${shield}`}>
          <span aria-hidden="true">◆</span>
          <b>{shield}</b>
        </div>
      </header>

      <div className="matchHeroCombat">
        <div className="matchHeroPortrait" title={heroTitle}>
          <img src={heroImage} alt={heroTitle} draggable={false} />
          <span className="matchHeroPortraitGlow" aria-hidden="true" />
          <div className="matchHeroNameplate" aria-hidden="true">
            <b>{label}</b>
            <span>{player.id === "enemy" ? "ENEMY" : "PLAYER"}</span>
          </div>
        </div>

        <div className="matchHeroMeters" aria-hidden="false">
          <div className="matchHeroMeterGroup is-hp-meter">
            <StatusBar
              label="HP"
              value={hp}
              max={hpMax}
              tone="hp"
              orientation="vertical"
              compact
              showValue={false}
            />
            <b className="matchHeroMeterValue">{hp}/{hpMax}</b>
          </div>

          <div className="matchHeroMeterGroup is-shield-meter">
            <StatusBar
              label="Shield"
              value={shield}
              max={shieldMax}
              tone="shield"
              orientation="vertical"
              compact
              showValue={false}
            />
            <b className="matchHeroMeterValue">{shield}</b>
          </div>
        </div>
      </div>

      <div className="matchHeroStatRow" aria-label="Hero stats">
        <span>
          <small>HP</small>
          <b>{hp}/{hpMax}</b>
        </span>
        <span>
          <small>SHD</small>
          <b>{shield}</b>
        </span>
        <span>
          <small>WILL</small>
          <b>{will}/{willMax}</b>
        </span>
      </div>

      <div className="matchBonusWrap">
        <div className="matchBonusLabel">
          <span>Bonus cards</span>
          <b>+{bonusTotal}%</b>
        </div>

        <BonusSlots cards={bonusCards} slotCount={4} compact />
      </div>
    </section>
  );
}
