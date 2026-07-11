import { useEffect, useState, type CSSProperties } from "react";
import type { PackOpeningPhase } from "./types";

type FragmentStyle = CSSProperties & {
  "--hpo-fragment-index": number;
  "--hpo-fragment-angle": string;
  "--hpo-fragment-width": string;
  "--hpo-fragment-height": string;
  "--hpo-fragment-delay": string;
};

export function PackShell({
  phase,
  artSrc,
  fallbackArtSrc,
  title,
  onOpen,
}: {
  phase: PackOpeningPhase;
  artSrc: string;
  fallbackArtSrc: string;
  title: string;
  onOpen: () => void;
}) {
  const [resolvedArtSrc, setResolvedArtSrc] = useState(artSrc);

  useEffect(() => {
    setResolvedArtSrc(artSrc);
  }, [artSrc]);

  const isSealed = phase === "sealed";

  return (
    <section className={`hpo-packScene phase-${phase}`} aria-label={title}>
      <div className="hpo-packAmbient" aria-hidden="true">
        <span className="hpo-packAmbientRing hpo-packAmbientRingOne" />
        <span className="hpo-packAmbientRing hpo-packAmbientRingTwo" />
        <span className="hpo-packAmbientRay hpo-packAmbientRayOne" />
        <span className="hpo-packAmbientRay hpo-packAmbientRayTwo" />
      </div>

      <button
        type="button"
        className="hpo-packButton"
        onClick={onOpen}
        disabled={!isSealed}
        aria-label={isSealed ? `Открыть бустер ${title}` : `${title} открывается`}
      >
        <span className="hpo-packGlow" aria-hidden="true" />

        <span className="hpo-packWhole">
          <img
            src={resolvedArtSrc}
            alt={title}
            draggable={false}
            onError={() => setResolvedArtSrc(fallbackArtSrc)}
          />
          <span className="hpo-packGloss" aria-hidden="true" />
          <span className="hpo-packEdgeLight" aria-hidden="true" />
        </span>

        <span className="hpo-packSplit hpo-packSplitTop" aria-hidden="true">
          <img src={resolvedArtSrc} alt="" draggable={false} />
        </span>

        <span className="hpo-packSplit hpo-packSplitBottom" aria-hidden="true">
          <img src={resolvedArtSrc} alt="" draggable={false} />
        </span>

        <span className="hpo-packCutLine" aria-hidden="true" />
        <span className="hpo-packFlash" aria-hidden="true" />
        <span className="hpo-packShockwave hpo-packShockwaveOne" aria-hidden="true" />
        <span className="hpo-packShockwave hpo-packShockwaveTwo" aria-hidden="true" />
        <span className="hpo-packFragments" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => (
            <span
              key={index}
              style={{
                "--hpo-fragment-index": index,
                "--hpo-fragment-angle": `${index * 20}deg`,
                "--hpo-fragment-width": `${3 + (index % 4)}px`,
                "--hpo-fragment-height": `${8 + (index % 5) * 2}px`,
                "--hpo-fragment-delay": `${420 + index * 12}ms`,
              } as FragmentStyle}
            />
          ))}
        </span>
      </button>

      {isSealed ? (
        <div className="hpo-packPrompt">
          <span className="hpo-packPromptPulse" aria-hidden="true" />
          <strong>НАЖМИТЕ НА БУСТЕР</strong>
          <small>Анимация открытия запустится автоматически</small>
        </div>
      ) : null}
    </section>
  );
}
