import { useEffect, useMemo, useRef } from "react";

type BattleLogTone =
  | "roll"
  | "damage"
  | "heal"
  | "play"
  | "turn"
  | "bonus"
  | "draw"
  | "discard"
  | "error"
  | "system";

type BattleLogProps = {
  entries: string[];
  maxEntries?: number;
};

const TONE_META: Record<BattleLogTone, { className: string; icon: string; label: string }> = {
  roll: { className: "is-roll", icon: "◆", label: "ROLL" },
  damage: { className: "is-damage", icon: "✦", label: "DMG" },
  heal: { className: "is-heal", icon: "✚", label: "HEAL" },
  play: { className: "is-play", icon: "▰", label: "PLAY" },
  turn: { className: "is-turn", icon: "↻", label: "TURN" },
  bonus: { className: "is-bonus", icon: "◇", label: "BONUS" },
  draw: { className: "is-draw", icon: "↑", label: "DRAW" },
  discard: { className: "is-discard", icon: "↓", label: "DISCARD" },
  error: { className: "is-error", icon: "!", label: "WARN" },
  system: { className: "is-system", icon: "•", label: "SYS" },
};

const EXPLICIT_TONE_ALIASES: Record<string, BattleLogTone> = {
  ROLL: "roll",
  D20: "roll",
  DMG: "damage",
  DAMAGE: "damage",
  HEAL: "heal",
  PLAY: "play",
  TURN: "turn",
  BONUS: "bonus",
  DRAW: "draw",
  DISCARD: "discard",
  DROP: "discard",
  WARN: "error",
  ERROR: "error",
  SYS: "system",
  SYSTEM: "system",
};

function getExplicitTone(entry: string): BattleLogTone | null {
  const match = entry.match(/^\s*\[([A-Z0-9_-]+)]/i);
  if (!match) return null;

  const key = match[1].toUpperCase();
  return EXPLICIT_TONE_ALIASES[key] ?? null;
}

function stripExplicitTone(entry: string) {
  return entry.replace(/^\s*\[[A-Z0-9_-]+]\s*/i, "");
}

function classifyEntry(entry: string): BattleLogTone {
  const explicit = getExplicitTone(entry);
  if (explicit) return explicit;

  const text = entry.toLowerCase();

  if (
    text.includes("invalid") ||
    text.includes("not enough") ||
    text.includes("cannot") ||
    text.includes("can't") ||
    text.includes("could not") ||
    text.includes("failed") ||
    text.includes("cancelled") ||
    text.includes("occupied")
  ) {
    return "error";
  }

  if (text.includes("rolled") || text.includes("roll") || text.includes("d20") || text.includes("dice")) {
    return "roll";
  }

  if (
    text.includes("damage") ||
    text.includes("damaged") ||
    text.includes("dealt") ||
    text.includes("hit") ||
    text.includes("destroyed") ||
    text.includes("killed") ||
    text.includes("hero fell") ||
    text.includes("wins")
  ) {
    return "damage";
  }

  if (text.includes("heal") || text.includes("healed") || text.includes("restored") || text.includes("restore")) {
    return "heal";
  }

  if (text.includes("draw") || text.includes("draws") || text.includes("drew") || text.includes("added to hand")) {
    return "draw";
  }

  if (
    text.includes("discard") ||
    text.includes("moved to discard") ||
    text.includes("grave") ||
    text.includes("cleanup")
  ) {
    return "discard";
  }

  if (
    text.includes("played") ||
    text.includes("placed") ||
    text.includes("summoned") ||
    text.includes("used") ||
    text.includes("stays on board") ||
    text.includes("temporary")
  ) {
    return "play";
  }

  if (
    text.includes("ended") ||
    text.includes("end turn") ||
    text.includes("round") ||
    text.includes("phase") ||
    text.includes("turn") ||
    text.includes("initiative")
  ) {
    return "turn";
  }

  if (
    text.includes("bonus") ||
    text.includes("%") ||
    text.includes("buff") ||
    text.includes("reduced") ||
    text.includes("increased") ||
    text.includes("gained") ||
    text.includes("will")
  ) {
    return "bonus";
  }

  return "system";
}

function normalizeEntry(entry: string) {
  return stripExplicitTone(entry).replace(/\s+/g, " ").trim();
}

function makeStableKey(entry: string, absoluteIndex: number) {
  return `${absoluteIndex}-${entry.slice(0, 80)}`;
}

export function BattleLog({ entries, maxEntries = 12 }: BattleLogProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const safeEntries = useMemo(() => (Array.isArray(entries) ? entries : []), [entries]);
  const safeMaxEntries = Math.max(4, Math.min(12, maxEntries));

  const visible = useMemo(() => {
    const normalized = safeEntries
      .map((entry) => ({ raw: entry, clean: normalizeEntry(String(entry)) }))
      .filter((item) => item.clean.length > 0);

    return normalized.slice(-safeMaxEntries).map((item, index, list) => {
      const absoluteIndex = safeEntries.length - list.length + index;
      const tone = classifyEntry(item.raw);
      const meta = TONE_META[tone];

      return {
        entry: item.clean,
        tone,
        meta,
        absoluteIndex,
        key: makeStableKey(item.raw, absoluteIndex),
      };
    });
  }, [safeEntries, safeMaxEntries]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    list.scrollTo({
      top: list.scrollHeight,
      behavior: "smooth",
    });
  }, [visible.length, safeEntries.length]);

  return (
    <section className="matchBattleLog" aria-label="Battle log" aria-live="polite">
      <div className="matchPanelTitle">
        <span>Battle log</span>
        <b>{safeEntries.length}</b>
      </div>

      <ol ref={listRef} data-empty={visible.length === 0 ? "true" : "false"}>
        {visible.length > 0 ? (
          visible.map(({ entry, meta, tone, absoluteIndex, key }) => (
            <li
              key={key}
              className={`${meta.className} is-log-${tone}`}
              data-log-type={tone}
              data-log-index={absoluteIndex}
            >
              <span className="matchLogType" aria-hidden="true">
                <i>{meta.icon}</i>
                <b>{meta.label}</b>
              </span>

              <span className="matchLogText">{entry}</span>
            </li>
          ))
        ) : (
          <li className="is-system is-log-empty" data-log-type="system">
            <span className="matchLogType" aria-hidden="true">
              <i>•</i>
              <b>SYS</b>
            </span>
            <span className="matchLogText">Waiting for match events…</span>
          </li>
        )}
      </ol>
    </section>
  );
}
