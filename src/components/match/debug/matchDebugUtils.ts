import type { CardInstance, MatchState, PlayerId } from "../../../game/core/types";
import type {
  MatchDebugCardSummary,
  MatchDebugChange,
  MatchDebugEvent,
  MatchDebugMode,
  MatchDebugSession,
  MatchDebugSideSummary,
  MatchDebugStateSummary,
  MatchDebugZone,
} from "./matchDebugTypes";

const SECRET_KEY_PATTERN = /(token|secret|key|anon|refresh|access|authorization|supabaseUrl|supabaseKey)/i;
const GAME_VERSION = "0.0.0";

function readDefinitionText(card: CardInstance, keys: string[], fallback: string) {
  const definition = card.definition as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = definition[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function readDefinitionNumber(card: CardInstance, keys: string[], fallback = 0) {
  const definition = card.definition as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = definition[key];
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.floor(parsed));
  }
  return fallback;
}

function summarizeCard(card: CardInstance): MatchDebugCardSummary {
  return {
    instanceId: card.instanceId,
    baseId: card.baseId,
    title: readDefinitionText(card, ["title", "ruTitle", "name"], card.baseId || "Card"),
    currentHp: Math.max(0, Math.floor(Number(card.currentHealth ?? card.definition.health ?? 0) || 0)),
    cost: readDefinitionNumber(card, ["cost", "willCost"], 0),
    temporary: Boolean(card.temporaryUntilRoundEnd),
    statuses: Array.isArray(card.statuses) ? card.statuses.map(String) : [],
  };
}

function summarizeSide(state: MatchState, playerId: PlayerId): MatchDebugSideSummary {
  const side = state[playerId];
  const slots = playerId === "player" ? state.board.playerSlots : state.board.enemySlots;
  const boardCards = slots.filter((card): card is CardInstance => Boolean(card));

  return {
    id: playerId,
    hp: Math.max(0, Math.floor(Number(side.hp) || 0)),
    shield: Math.max(0, Math.floor(Number(side.shield) || 0)),
    will: Math.max(0, Math.floor(Number(side.will) || 0)),
    maxWill: Math.max(0, Math.floor(Number(side.maxWill) || 0)),
    handCount: side.hand.length,
    deckCount: side.deck.length,
    discardCount: side.discard.length,
    slots: slots.map((card, index) => ({ index, card: card ? summarizeCard(card) : null })),
    zones: {
      hand: playerId === "player" ? side.hand.map(summarizeCard) : [],
      deck: playerId === "player" ? side.deck.map(summarizeCard) : [],
      discard: side.discard.map(summarizeCard),
      board: boardCards.map(summarizeCard),
    },
  };
}

export function createMatchDebugStateSummary(state: MatchState): MatchDebugStateSummary {
  return {
    matchId: state.id,
    turn: state.turn,
    phase: state.phase,
    activePlayerId: state.activePlayerId,
    winner: state.winner,
    lastRoll: state.lastRoll,
    d20Limit: state.currentTurn?.d20Limit,
    playsUsed: state.currentTurn?.playsUsed,
    activeRouletteEvent: state.activeRouletteEvent,
    stackSize: Array.isArray(state.stack) ? state.stack.length : 0,
    player: summarizeSide(state, "player"),
    enemy: summarizeSide(state, "enemy"),
    logCount: state.log.length,
  };
}

function pushChange(changes: MatchDebugChange[], change: MatchDebugChange) {
  changes.push(change);
}

function compareNumber(changes: MatchDebugChange[], label: string, category: MatchDebugChange["category"], before: number, after: number, path: string) {
  if (before === after) return;
  pushChange(changes, { category, message: `${label}: ${before} → ${after}`, path, before, after });
}

function compareString(changes: MatchDebugChange[], label: string, category: MatchDebugChange["category"], before: string | undefined, after: string | undefined, path: string) {
  if (before === after) return;
  pushChange(changes, { category, message: `${label}: ${before ?? "none"} → ${after ?? "none"}`, path, before, after });
}

function cardLabel(card: MatchDebugCardSummary | null) {
  return card ? `${card.title} (${card.instanceId})` : "empty";
}

function collectZones(summary: MatchDebugStateSummary, side: PlayerId) {
  const result = new Map<string, MatchDebugZone>();
  const sideSummary = summary[side];

  const zoneOrder: MatchDebugZone[] = ["hand", "board", "discard", "deck"];
  zoneOrder.forEach((zone) => {
    sideSummary.zones?.[zone]?.forEach((card) => result.set(card.instanceId, zone));
  });

  sideSummary.slots.forEach((slot) => {
    if (slot.card) result.set(slot.card.instanceId, "board");
  });

  return result;
}

function detectActionOrLogSource(before: MatchDebugStateSummary, after: MatchDebugStateSummary, actionType?: string, newLogLines: string[] = []) {
  if (actionType) return true;
  if (newLogLines.some((line) => /(damage|dealt|played|effect|attack|heal|fell|skip penalty|dmg)/i.test(line))) return true;
  const boardHadAttacker = [...before.player.slots, ...before.enemy.slots].some((slot) => (slot.card?.currentHp ?? 0) > 0);
  return boardHadAttacker && before.phase !== after.phase;
}

export function diffMatchStates(
  previousState: MatchState | MatchDebugStateSummary,
  nextState: MatchState | MatchDebugStateSummary,
  actionType?: string,
  newLogLines: string[] = [],
): MatchDebugChange[] {
  const before = "player" in previousState && "enemy" in previousState && "logCount" in previousState
    ? previousState as MatchDebugStateSummary
    : createMatchDebugStateSummary(previousState as MatchState);
  const after = "player" in nextState && "enemy" in nextState && "logCount" in nextState
    ? nextState as MatchDebugStateSummary
    : createMatchDebugStateSummary(nextState as MatchState);
  const changes: MatchDebugChange[] = [];

  compareNumber(changes, "Turn", "turn", before.turn, after.turn, "turn");
  compareString(changes, "Phase", "phase", before.phase, after.phase, "phase");
  compareString(changes, "Active player", "turn", before.activePlayerId, after.activePlayerId, "activePlayerId");
  compareString(changes, "Winner", "match", before.winner, after.winner, "winner");
  if (before.lastRoll !== after.lastRoll) compareNumber(changes, "Last D20", "roll", before.lastRoll ?? 0, after.lastRoll ?? 0, "lastRoll");

  (["player", "enemy"] as const).forEach((side) => {
    const label = side === "player" ? "Player" : "Enemy";
    compareNumber(changes, `${label} HP`, after[side].hp > before[side].hp ? "heal" : "damage", before[side].hp, after[side].hp, `${side}.hp`);
    compareNumber(changes, `${label} Shield`, "will", before[side].shield, after[side].shield, `${side}.shield`);
    compareNumber(changes, `${label} Will`, "will", before[side].will, after[side].will, `${side}.will`);
    compareNumber(changes, `${label} hand`, "draw", before[side].handCount, after[side].handCount, `${side}.handCount`);
    compareNumber(changes, `${label} deck`, "draw", before[side].deckCount, after[side].deckCount, `${side}.deckCount`);
    compareNumber(changes, `${label} discard`, "discard", before[side].discardCount, after[side].discardCount, `${side}.discardCount`);

    after[side].slots.forEach((slot, index) => {
      const previousSlot = before[side].slots[index];
      if (!previousSlot) return;
      const beforeCard = previousSlot.card;
      const afterCard = slot.card;
      if (beforeCard?.instanceId !== afterCard?.instanceId) {
        pushChange(changes, {
          category: "board",
          message: `${label} slot ${index + 1}: ${cardLabel(beforeCard)} → ${cardLabel(afterCard)}`,
          path: `${side}.slots.${index}`,
          before: beforeCard,
          after: afterCard,
        });
      } else if (beforeCard && afterCard && beforeCard.currentHp !== afterCard.currentHp) {
        pushChange(changes, {
          category: afterCard.currentHp > beforeCard.currentHp ? "heal" : "damage",
          message: `${label} slot ${index + 1} HP: ${beforeCard.currentHp} → ${afterCard.currentHp}`,
          path: `${side}.slots.${index}.currentHp`,
          before: beforeCard.currentHp,
          after: afterCard.currentHp,
          metadata: { instanceId: afterCard.instanceId, baseId: afterCard.baseId },
        });
      }
    });
  });

  (["player", "enemy"] as const).forEach((side) => {
    const beforeZones = collectZones(before, side);
    const afterZones = collectZones(after, side);
    beforeZones.forEach((zone, instanceId) => {
      const nextZone = afterZones.get(instanceId);
      if (!nextZone) {
        pushChange(changes, {
          category: "card",
          level: "warning",
          message: `Card ${instanceId}: ${zone} → unknown`,
          metadata: { side, instanceId, warning: "Card disappeared from visible zones." },
        });
      } else if (zone !== nextZone) {
        pushChange(changes, { category: "card", message: `Card ${instanceId}: ${zone} → ${nextZone}`, metadata: { side, instanceId } });
      }
    });
  });

  const hpChanged = before.player.hp !== after.player.hp || before.enemy.hp !== after.enemy.hp;
  if (hpChanged && !detectActionOrLogSource(before, after, actionType, newLogLines)) {
    pushChange(changes, {
      category: "error",
      level: "warning",
      message: "HP changed without a clearly detected visible source.",
    });
  }

  (["player", "enemy"] as const).forEach((side) => {
    if (after[side].handCount < before[side].handCount) {
      const hasDestination = changes.some((change) => ["board", "discard", "card"].includes(change.category));
      if (!hasDestination && !actionType) {
        pushChange(changes, {
          category: "card",
          level: "warning",
          message: "Card left hand without a detected destination.",
          metadata: { side },
        });
      }
    }
  });

  return changes;
}

export function sanitizeDebugValue(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 5) return "[MaxDepth]";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "undefined") return undefined;
  if (typeof value === "function") return "[Function]";
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) return value.slice(0, 80).map((entry) => sanitizeDebugValue(entry, depth + 1, seen));

  const record = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  Object.entries(record).forEach(([key, entry]) => {
    if (SECRET_KEY_PATTERN.test(key)) {
      output[key] = "[REDACTED]";
      return;
    }
    output[key] = sanitizeDebugValue(entry, depth + 1, seen);
  });
  return output;
}

export function formatDebugElapsed(elapsedMs: number) {
  const seconds = Math.floor(elapsedMs / 1000);
  const ms = Math.floor(elapsedMs % 1000).toString().padStart(3, "0");
  return `${seconds}.${ms}s`;
}

export function buildDebugText(events: MatchDebugEvent[]) {
  return events.map((event) => {
    const changes = event.changes?.map((change) => `    - ${change.message}`).join("\n") ?? "";
    return `#${event.sequence} ${formatDebugElapsed(event.elapsedMs)} [${event.level}] [${event.source}] ${event.category}${event.actionType ? `/${event.actionType}` : ""}: ${event.message}${changes ? `\n${changes}` : ""}`;
  }).join("\n");
}

export function buildDebugFilename(mode: MatchDebugMode, matchId: string, extension: "txt" | "json") {
  const safeDate = new Date().toISOString().replace(/[:.]/g, "-");
  const safeMatchId = matchId.replace(/[^a-z0-9_-]/gi, "_").slice(0, 48);
  return `fraktum-match-${mode}-${safeMatchId}-${safeDate}.${extension}`;
}

export function isMatchDebugAllowed() {
  if (typeof window === "undefined") return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("matchDebug") === "1") return true;
  if (window.localStorage.getItem("fraktum.matchDebugEnabled") === "1") return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".vercel.app") || import.meta.env.DEV;
}

export function makeDebugSession(input: Omit<MatchDebugSession, "schemaVersion" | "gameVersion">): MatchDebugSession {
  return { schemaVersion: 1, gameVersion: GAME_VERSION, ...input };
}
