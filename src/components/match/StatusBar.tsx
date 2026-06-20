type StatusBarProps = {
  label: string;
  value: number;
  max: number;
  tone: "hp" | "will" | "shield";
};

export function StatusBar({ label, value, max, tone }: StatusBarProps) {
  const safeMax = Math.max(1, max);
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));

  return (
    <div className={`matchStatusBar is-${tone}`} title={`${label}: ${value}/${safeMax}`}>
      <div className="matchStatusBarMeta">
        <span>{label}</span>
        <b>{value}/{safeMax}</b>
      </div>
      <div className="matchStatusTrack">
        <span className="matchStatusFill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
