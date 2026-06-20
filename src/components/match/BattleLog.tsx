export function BattleLog({ entries }: { entries: string[] }) { return <ol className="tsLog">{entries.slice(-12).map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ol>; }
