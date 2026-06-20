import { useEffect, useRef } from "react";

function eventClass(entry: string) {
  const text = entry.toLowerCase();
  if (text.includes("rolled")) return "is-roll";
  if (text.includes("damage")) return "is-damage";
  if (text.includes("heal") || text.includes("restored")) return "is-heal";
  if (text.includes("played")) return "is-play";
  if (text.includes("ended")) return "is-turn";
  if (text.includes("bonus")) return "is-bonus";
  return "";
}

export function BattleLog({ entries }: { entries: string[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const visible = entries.slice(-12);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length]);

  return (
    <section className="matchBattleLog">
      <div className="matchPanelTitle">Battle log</div>
      <ol ref={listRef}>
        {visible.map((entry, index) => <li className={eventClass(entry)} key={`${entry}-${entries.length - visible.length + index}`}>{entry}</li>)}
      </ol>
    </section>
  );
}
