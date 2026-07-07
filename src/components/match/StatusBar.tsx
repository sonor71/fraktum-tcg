import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type StatusBarTone = "hp" | "will" | "shield";

type StatusBarProps = {
  label: string;
  value: number;
  max: number;
  tone: StatusBarTone;
  orientation?: "horizontal" | "vertical";
  compact?: boolean;
  showValue?: boolean;
  className?: string;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function getToneLabel(tone: StatusBarTone) {
  switch (tone) {
    case "hp":
      return "Health";
    case "will":
      return "Will";
    case "shield":
      return "Shield";
    default:
      return "Status";
  }
}

function getToneIcon(tone: StatusBarTone) {
  switch (tone) {
    case "hp":
      return "♥";
    case "will":
      return "◆";
    case "shield":
      return "◇";
    default:
      return "•";
  }
}

export function StatusBar({
  label,
  value,
  max,
  tone,
  orientation = "horizontal",
  compact = false,
  showValue = true,
  className = "",
}: StatusBarProps) {
  const safeMax = Math.max(1, Math.floor(max));
  const safeValue = clamp(Math.floor(value), 0, safeMax);
  const pct = clamp((safeValue / safeMax) * 100, 0, 100);

  const previousValue = useRef(safeValue);
  const [flash, setFlash] = useState<"gain" | "loss" | null>(null);

  useEffect(() => {
    if (safeValue === previousValue.current) return;

    setFlash(safeValue > previousValue.current ? "gain" : "loss");
    previousValue.current = safeValue;

    const id = window.setTimeout(() => setFlash(null), 420);
    return () => window.clearTimeout(id);
  }, [safeValue]);

  const tickCount = useMemo(() => {
    if (compact) return 0;
    if (safeMax <= 5) return safeMax;
    if (safeMax <= 10) return 10;
    return 12;
  }, [compact, safeMax]);

  const fillStyle = orientation === "vertical"
    ? { height: `${pct}%` }
    : { width: `${pct}%` };

  const styleVars = {
    "--status-pct": `${pct}%`,
  } as CSSProperties;

  return (
    <div
      className={[
        "matchStatusBar",
        `is-${tone}`,
        `is-${orientation}`,
        compact ? "is-compact" : "",
        flash ? `is-${flash}` : "",
        className,
      ].filter(Boolean).join(" ")}
      title={`${label}: ${safeValue}/${safeMax}`}
      aria-label={`${getToneLabel(tone)} ${safeValue} of ${safeMax}`}
      style={styleVars}
      data-value={safeValue}
      data-max={safeMax}
      data-percent={Math.round(pct)}
    >
      <div className="matchStatusBarMeta">
        <span>
          <i aria-hidden="true">{getToneIcon(tone)}</i>
          {label}
        </span>
        {showValue && <b>{safeValue}/{safeMax}</b>}
      </div>

      <div className="matchStatusTrack" aria-hidden="true">
        {tickCount > 0 && (
          <span className="matchStatusTicks">
            {Array.from({ length: tickCount }).map((_, index) => (
              <i key={`${tone}-tick-${index}`} />
            ))}
          </span>
        )}
        <span className="matchStatusFill" style={fillStyle} />
        <span className="matchStatusShine" />
        <span className="matchStatusPulse" />
      </div>
    </div>
  );
}
