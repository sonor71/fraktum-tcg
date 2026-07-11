import type { MatchState, PlayerId } from "../../../game/core/types";
import type { OnlineSeat } from "../../../services/onlineMatchmaking";

export type MatchDebugMode = "ai" | "online";

export type MatchDebugSource =
  | "player"
  | "ai"
  | "online_local"
  | "online_remote"
  | "engine"
  | "system"
  | "warning"
  | "error";

export type MatchDebugLevel = "info" | "warning" | "error";

export type MatchDebugCategory =
  | "match"
  | "action"
  | "turn"
  | "phase"
  | "roll"
  | "card"
  | "damage"
  | "heal"
  | "will"
  | "draw"
  | "discard"
  | "board"
  | "effect"
  | "online"
  | "state"
  | "error";

export type MatchDebugZone = "hand" | "deck" | "discard" | "board" | "unknown";

export type MatchDebugCardSummary = {
  instanceId: string;
  baseId: string;
  title: string;
  currentHp: number;
  cost: number;
  temporary: boolean;
  statuses: string[];
};

export type MatchDebugSlotSummary = {
  index: number;
  card: MatchDebugCardSummary | null;
};

export type MatchDebugSideSummary = {
  id: PlayerId;
  hp: number;
  shield: number;
  will: number;
  maxWill: number;
  handCount: number;
  deckCount: number;
  discardCount: number;
  slots: MatchDebugSlotSummary[];
  zones?: Partial<Record<MatchDebugZone, MatchDebugCardSummary[]>>;
};

export type MatchDebugStateSummary = {
  matchId: string;
  turn: number;
  phase: MatchState["phase"];
  activePlayerId: PlayerId;
  winner?: MatchState["winner"];
  lastRoll?: number;
  d20Limit?: number | "unlimited";
  playsUsed?: number;
  activeRouletteEvent?: string;
  stackSize: number;
  player: MatchDebugSideSummary;
  enemy: MatchDebugSideSummary;
  logCount: number;
};

export type MatchDebugChange = {
  category: MatchDebugCategory;
  level?: MatchDebugLevel;
  message: string;
  path?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
};

export type MatchDebugEvent = {
  id: string;
  sequence: number;
  timestamp: number;
  elapsedMs: number;
  matchId: string;
  matchMode: MatchDebugMode;
  roomId?: string;
  seat?: string;
  source: MatchDebugSource;
  level: MatchDebugLevel;
  category: MatchDebugCategory;
  actionType?: string;
  message: string;
  action?: unknown;
  before?: MatchDebugStateSummary;
  after?: MatchDebugStateSummary;
  changes?: MatchDebugChange[];
  metadata?: Record<string, unknown>;
};

export type MatchDebugSession = {
  schemaVersion: 1;
  gameVersion: string;
  matchId: string;
  mode: MatchDebugMode;
  roomId?: string;
  seat?: string;
  playerNames: { player: string; enemy: string };
  startTime: number;
  endTime?: number;
  events: MatchDebugEvent[];
  finalState?: MatchDebugStateSummary;
};

export type MatchDebugRecordInput = {
  source: MatchDebugSource;
  level?: MatchDebugLevel;
  category: MatchDebugCategory;
  actionType?: string;
  message: string;
  action?: unknown;
  before?: MatchDebugStateSummary;
  after?: MatchDebugStateSummary;
  changes?: MatchDebugChange[];
  metadata?: Record<string, unknown>;
};

export type MatchDebugContext = {
  enabled: boolean;
  matchMode: MatchDebugMode;
  roomId?: string;
  seat?: OnlineSeat | null;
  playerNames: { player: string; enemy: string };
};
