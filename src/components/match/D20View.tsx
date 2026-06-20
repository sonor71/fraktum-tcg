import { useEffect, useState } from "react";

export function D20View({ value, onRoll, disabled }: { value?: number; onRoll: () => void; disabled?: boolean }) {
  const [rolling, setRolling] = useState(false);
  const [displayValue, setDisplayValue] = useState<number | undefined>(value);

  useEffect(() => {
    if (!rolling) setDisplayValue(value);
  }, [rolling, value]);

  const handleRoll = () => {
    if (disabled || rolling) return;
    setRolling(true);
    let ticks = 0;
    const interval = window.setInterval(() => {
      ticks += 1;
      setDisplayValue(Math.floor(Math.random() * 20) + 1);
      if (ticks >= 14) {
        window.clearInterval(interval);
        onRoll();
        window.setTimeout(() => setRolling(false), 260);
      }
    }, 55);
  };

  return (
    <button className={`matchD20 ${rolling ? "is-rolling" : ""}`} type="button" onClick={handleRoll} disabled={disabled || rolling}>
      <span className="matchD20Glow" aria-hidden="true" />
      <span className="matchD20Shape" aria-hidden="true">
        <i className="face face-a" />
        <i className="face face-b" />
        <i className="face face-c" />
      </span>
      <span className="matchD20Label">D20</span>
      <strong>{displayValue ?? "—"}</strong>
    </button>
  );
}
