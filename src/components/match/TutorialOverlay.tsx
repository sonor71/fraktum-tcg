import { useEffect, useLayoutEffect, useState } from "react";

export type TutorialStep = { id: string; target: string; text: string; action?: "roll" | "card" | "slot" | "end" };
type Props = { step: TutorialStep; onNext: () => void; onSkip: () => void };

export function TutorialOverlay({ step, onNext, onSkip }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const update = () => setRect(document.querySelector<HTMLElement>(`[data-tutorial-id="${step.target}"]`)?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener("resize", update); window.addEventListener("orientationchange", update);
    const timer = window.setInterval(update, 350);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("orientationchange", update); window.clearInterval(timer); };
  }, [step]);
  useEffect(() => {
    if (!step.action || !rect) return;
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    target?.closest<HTMLElement>(`[data-tutorial-id="${step.target}"]`)?.classList.add("is-tutorial-target");
    return () => target?.closest<HTMLElement>(`[data-tutorial-id="${step.target}"]`)?.classList.remove("is-tutorial-target");
  }, [rect, step]);
  const gap = 12; const tooltipTop = rect ? Math.min(window.innerHeight - 150, rect.bottom + gap) : 80; const tooltipLeft = rect ? Math.max(12, Math.min(window.innerWidth - 320, rect.left + rect.width / 2 - 150)) : 20;
  return <div className={`tutorialOverlay ${step.action ? "is-interactive" : ""}`}><div className="tutorialShade" />{rect ? <div className="tutorialSpotlight" style={{ left: rect.left - 8, top: rect.top - 8, width: rect.width + 16, height: rect.height + 16 }} /> : null}<section className="tutorialTooltip" style={{ left: tooltipLeft, top: tooltipTop }}><b>ОБУЧЕНИЕ</b><p>{step.text}</p><footer><button onClick={onSkip}>Пропустить</button>{!step.action ? <button onClick={onNext}>Далее</button> : <span>Выполни действие</span>}</footer></section></div>;
}
