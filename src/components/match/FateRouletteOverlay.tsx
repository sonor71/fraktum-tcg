import { useEffect, useMemo } from "react";
import type { FateRouletteEvent, FateRouletteState, PlayerId } from "../../game/core/types";
import { FATE_ROULETTE_EVENTS } from "../../game/engine/Rules";
import { FATE_ROULETTE_META } from "../../game/engine/FateRoulette";
import "./fate-roulette.css";

type Props = {
  roulette: FateRouletteState;
  localPlayerId?: PlayerId;
  onSpin: (rouletteId: string) => void;
  onReveal: (rouletteId: string) => void;
  onConfirm: (rouletteId: string) => void;
};

const SECTOR_ANGLE = 72;

function polar(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function sectorPath(index: number) {
  const start = index * SECTOR_ANGLE - SECTOR_ANGLE / 2;
  const end = start + SECTOR_ANGLE;
  const a = polar(300, 300, 280, start);
  const b = polar(300, 300, 280, end);
  return `M 300 300 L ${a.x} ${a.y} A 280 280 0 0 1 ${b.x} ${b.y} Z`;
}

function getFateRouletteFinalAngle(resultIndex = 0, extraRotations = 6, spinNonce = 0) {
  const centerAngle = resultIndex * SECTOR_ANGLE;
  const nonceOffset = ((spinNonce % 1000) / 1000 - 0.5) * 0.0001;
  return extraRotations * 360 - centerAngle + nonceOffset;
}

export function FateRouletteOverlay({ roulette, localPlayerId = "player", onSpin, onReveal, onConfirm }: Props) {
  const isOwner = roulette.ownerId === localPlayerId;
  const event = roulette.event;
  const meta = event ? FATE_ROULETTE_META[event] : null;
  const finalAngle = getFateRouletteFinalAngle(roulette.resultIndex, roulette.extraRotations, roulette.spinNonce);

  useEffect(() => {
    if (roulette.stage !== "spinning") return undefined;
    const timeout = window.setTimeout(() => onReveal(roulette.id), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 450 : 3800);
    return () => window.clearTimeout(timeout);
  }, [onReveal, roulette.id, roulette.stage]);

  const wheelStyle = useMemo(() => ({ "--fate-final-angle": `${finalAngle}deg` }) as React.CSSProperties, [finalAngle]);

  return (
    <section className="fateRouletteOverlay" role="dialog" aria-modal="true" aria-labelledby="fateRouletteTitle" data-stage={roulette.stage}>
      <div className="fateRouletteBackdrop" aria-hidden="true" />
      <div className="fateRouletteParticles" aria-hidden="true" />
      <div className="fateRoulettePanel">
        <header className="fateRouletteHeader">
          <span>{isOwner ? "Вы активировали Рулетку Судьбы" : "Соперник активировал Рулетку Судьбы"}</span>
          <h2 id="fateRouletteTitle">РУЛЕТКА СУДЬБЫ</h2>
          <p>{roulette.stage === "awaitingSpin" ? (isOwner ? "Нажмите, чтобы определить судьбу этого раунда" : "Ожидание вращения…") : roulette.stage === "spinning" ? "Судьба решается…" : "Результат определён"}</p>
        </header>

        <div className="fateRouletteWheelWrap">
          <div className="fateRoulettePointer" aria-hidden="true" />
          <svg className="fateRouletteWheel" viewBox="0 0 600 600" style={wheelStyle} aria-label="Колесо Рулетки Судьбы">
            <defs>
              <radialGradient id="fateHub" cx="50%" cy="45%" r="60%">
                <stop offset="0%" stopColor="#f3d28a" />
                <stop offset="58%" stopColor="#5a2433" />
                <stop offset="100%" stopColor="#070914" />
              </radialGradient>
            </defs>
            <circle cx="300" cy="300" r="292" className="fateRouletteRim" />
            {FATE_ROULETTE_EVENTS.map((sector: FateRouletteEvent, index) => {
              const selected = roulette.stage === "result" && roulette.resultIndex === index;
              const labelPoint = polar(300, 300, 178, index * SECTOR_ANGLE);
              return (
                <g key={sector} className={["fateRouletteSector", selected ? "is-selected" : "", roulette.stage === "result" && !selected ? "is-dimmed" : ""].filter(Boolean).join(" ")} data-sector-index={index} data-sector-angle="72">
                  <path d={sectorPath(index)} />
                  <text x={labelPoint.x} y={labelPoint.y - 12} textAnchor="middle" className="fateRouletteIcon">{FATE_ROULETTE_META[sector].icon}</text>
                  <text x={labelPoint.x} y={labelPoint.y + 18} textAnchor="middle" className="fateRouletteLabel">{FATE_ROULETTE_META[sector].shortTitle}</text>
                </g>
              );
            })}
            <circle cx="300" cy="300" r="72" fill="url(#fateHub)" className="fateRouletteHub" />
            <text x="300" y="311" textAnchor="middle" className="fateRouletteHubText">F</text>
          </svg>
        </div>

        <aside className="fateRouletteResult" aria-live="polite">
          {roulette.stage === "result" && meta ? (
            <>
              <span className="fateRouletteResultKicker">Выпал сектор</span>
              <h3>{meta.title}</h3>
              <p>{meta.description}</p>
              <div className="fateRouletteMetaGrid"><span>Длительность: <b>{meta.duration}</b></span><span>Затрагивает: <b>{meta.affects}</b></span></div>
              {isOwner ? <button type="button" className="fateRouletteButton" onClick={() => onConfirm(roulette.id)}>ПРОДОЛЖИТЬ</button> : <p className="fateRouletteWaiting">Соперник подтверждает результат…</p>}
            </>
          ) : roulette.stage === "awaitingSpin" ? (
            isOwner ? <button type="button" className="fateRouletteButton" onClick={() => onSpin(roulette.id)}>КРУТИТЬ РУЛЕТКУ</button> : <p className="fateRouletteWaiting">Соперник готовится к вращению…</p>
          ) : <p className="fateRouletteWaiting">Колесо замедляется. Результат появится после остановки.</p>}
        </aside>
      </div>
    </section>
  );
}
