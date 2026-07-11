import type { CSSProperties } from "react";
import type { CardRarity } from "../../game/types";

const PARTICLE_COUNT: Record<CardRarity, number> = {
  common: 18,
  rare: 28,
  epic: 40,
  mythic: 50,
  legendary: 68,
  chromatic: 82,
  exotic: 90,
  divine: 108,
  forgotten: 54,
  archaic: 76,
};

type ParticleVars = CSSProperties & {
  "--hpo-particle-angle": string;
  "--hpo-particle-distance": string;
  "--hpo-particle-delay": string;
  "--hpo-particle-size": string;
  "--hpo-particle-spin": string;
};

type RayVars = CSSProperties & {
  "--hpo-ray-angle": string;
  "--hpo-ray-delay": string;
};

type GlyphVars = CSSProperties & {
  "--hpo-glyph-angle": string;
  "--hpo-glyph-counter-angle": string;
  "--hpo-glyph-delay": string;
};

type PillarVars = CSSProperties & {
  "--hpo-pillar-left": string;
  "--hpo-pillar-skew": string;
  "--hpo-pillar-delay": string;
};

type GlitchVars = CSSProperties & {
  "--hpo-glitch-left": string;
  "--hpo-glitch-top": string;
  "--hpo-glitch-width": string;
  "--hpo-glitch-delay": string;
};

export function RarityBurst({
  rarity,
  isFoil,
}: {
  rarity: CardRarity;
  isFoil: boolean;
}) {
  const count = PARTICLE_COUNT[rarity] + (isFoil ? 18 : 0);

  return (
    <div
      className={`hpo-rarityFx rarity-${rarity} ${isFoil ? "is-foil" : ""}`}
      aria-hidden="true"
    >
      <div className="hpo-rarityBackdrop" />
      <div className="hpo-rarityFlash" />
      <div className="hpo-rarityHalo hpo-rarityHaloOuter" />
      <div className="hpo-rarityHalo hpo-rarityHaloInner" />
      <div className="hpo-rarityRing hpo-rarityRingOne" />
      <div className="hpo-rarityRing hpo-rarityRingTwo" />
      <div className="hpo-rarityRing hpo-rarityRingThree" />
      <div className="hpo-rarityAurora" />
      <div className="hpo-rarityVoid" />
      <div className="hpo-raritySplit hpo-raritySplitLeft" />
      <div className="hpo-raritySplit hpo-raritySplitRight" />
      <div className="hpo-rarityPillars">
        {Array.from({ length: 7 }, (_, index) => {
          const style: PillarVars = {
            "--hpo-pillar-left": `${24 + index * 8.5}%`,
            "--hpo-pillar-skew": `${(index - 3) * 2}deg`,
            "--hpo-pillar-delay": `${index * 90}ms`,
          };
          return <span key={index} style={style} />;
        })}
      </div>
      <div className="hpo-rarityRays">
        {Array.from({ length: 32 }, (_, index) => {
          const style: RayVars = {
            "--hpo-ray-angle": `${index * 11.25}deg`,
            "--hpo-ray-delay": `${(index % 8) * 28}ms`,
          };
          return <span key={index} style={style} />;
        })}
      </div>
      <div className="hpo-rarityGlyphs">
        {Array.from({ length: 12 }, (_, index) => {
          const style: GlyphVars = {
            "--hpo-glyph-angle": `${index * 30}deg`,
            "--hpo-glyph-counter-angle": `${index * -30}deg`,
            "--hpo-glyph-delay": `${index * 70}ms`,
          };
          return <span key={index} style={style}>◈</span>;
        })}
      </div>
      <div className="hpo-rarityGlitch">
        {Array.from({ length: 12 }, (_, index) => {
          const style: GlitchVars = {
            "--hpo-glitch-left": `${8 + index * 7}%`,
            "--hpo-glitch-top": `${12 + (index % 6) * 13}%`,
            "--hpo-glitch-width": `${40 + (index % 4) * 32}px`,
            "--hpo-glitch-delay": `${index * 80}ms`,
          };
          return <span key={index} style={style} />;
        })}
      </div>
      <div className="hpo-rarityParticles">
        {Array.from({ length: count }, (_, index) => {
          const angle = (index / count) * 360 + ((index * 19) % 17);
          const distance = 130 + ((index * 41) % 300);
          const delay = -((index * 47) % 1200);
          const size = 2 + ((index * 13) % 8);
          const spin = (index * 67) % 360;
          const style: ParticleVars = {
            "--hpo-particle-angle": `${angle}deg`,
            "--hpo-particle-distance": `${distance}px`,
            "--hpo-particle-delay": `${delay}ms`,
            "--hpo-particle-size": `${size}px`,
            "--hpo-particle-spin": `${spin}deg`,
          };

          return <span key={index} style={style} />;
        })}
      </div>
    </div>
  );
}
