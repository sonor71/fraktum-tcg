import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import type { GameAction } from "../../game/core/GameAction";
import type { CardDefinition, CardInstance, StartMatchPayload } from "../../game/core/types";
import { createInitialMatchState, dispatch } from "../../game/engine/MatchEngine";
import { planNextAiAction } from "../../game/ai/SimpleAI";
import { canPlayerMakeAnyMove, cardRequiresBoardSlot, getEffectiveCardCost } from "../../game/engine/TurnManager";
import { MatchBoard } from "./MatchBoard";
import { MatchDebugConsole } from "./debug/MatchDebugConsole";
import { useMatchDebugRecorder } from "./debug/useMatchDebugRecorder";
import { createMatchDebugStateSummary, sanitizeDebugValue } from "./debug/matchDebugUtils";
import {
  getMatchRewardValues,
  getWillStatsFromUpgrades,
  useGameStore,
  type MatchOutcome,
  type MatchRewardResult,
  type OwnedCard,
  type WillMatchStats,
} from "../../useGameStore";
import type { MatchFxEvent } from "./MatchFxLayer";
import type { CardTravelEvent } from "./CardTravelLayer";
import type { TacticalRevealEvent } from "./TacticalRevealLayer";
import {
  cancelOnlineMatchmaking,
  fetchOnlineMatchRoom,
  getOpponentSnapshot,
  getOwnSnapshot,
  isOnlineMatchmakingConfigured,
  isRoomReady,
  joinOnlineMatchmaking,
  markOnlineRoomPlaying,
  subscribeToOnlineMatchRoom,
  type OnlineMatchRoom,
  type OnlinePlayerSnapshot,
  type OnlineSeat,
} from "../../services/onlineMatchmaking";
import {
  appendOnlineMatchAction,
  fetchOnlineMatchActions,
  subscribeToOnlineMatchActions,
  type OnlineMatchActionEvent,
} from "../../services/onlineMatchActions";
import "./match.css";

type MatchStateSnapshot = ReturnType<typeof createInitialMatchState>;
type MatchRouteParams = { mode?: string };
type OnlineQueueState = "idle" | "searching" | "matched" | "error";

const UI_LOG_LIMIT = 18;
const PLAY_COMMIT_DELAY_MS = 90;
const AUTO_AI_DELAY_MS = 720;
const FX_EVENT_TTL_MS = 920;
const TRAVEL_EVENT_TTL_MS = 760;
const TACTICAL_REVEAL_TTL_MS = 3200;
const AUTO_PLAYER_PASS_EMPTY_MS = 860;
const FX_LOG_LIMIT = 18;

function getOutcomeFromWinner(winner: MatchStateSnapshot["winner"]): MatchOutcome | null {
  if (winner === "player") return "win";
  if (winner === "enemy") return "loss";
  if (winner === "draw") return "draw";
  return null;
}

function pushLimited(entries: string[], message: string, limit = UI_LOG_LIMIT) {
  return [...entries, message].slice(-limit);
}

function getCardTitle(card: CardInstance) {
  const definition = card.definition as unknown as Record<string, unknown>;
  const rawTitle = definition.title ?? definition.ruTitle ?? definition.name;
  return typeof rawTitle === "string" && rawTitle.trim().length > 0
    ? rawTitle
    : card.baseId || "Card";
}

function getCardImage(card: CardInstance) {
  const definition = card.definition as unknown as Record<string, unknown>;
  const rawImage = definition.image ?? definition.imageUrl ?? definition.src ?? definition.path;
  return typeof rawImage === "string" && rawImage.trim().length > 0 ? rawImage : "/cards/card-back.png";
}

function cardExistsInDiscard(matchState: MatchStateSnapshot, side: "player" | "enemy", cardId: string) {
  return matchState[side].discard.some((card) => card.instanceId === cardId);
}

function getDomRect(selector: string) {
  if (typeof document === "undefined") return null;
  const element = document.querySelector<HTMLElement>(selector);
  return element?.getBoundingClientRect() ?? null;
}

function buildCardTravelEvents(
  previous: MatchStateSnapshot,
  current: MatchStateSnapshot,
  startId: number,
) {
  const events: CardTravelEvent[] = [];
  let nextId = startId;

  (["player", "enemy"] as const).forEach((side) => {
    const previousSlots = side === "player" ? previous.board.playerSlots : previous.board.enemySlots;
    const currentSlots = side === "player" ? current.board.playerSlots : current.board.enemySlots;

    previousSlots.forEach((beforeCard, index) => {
      if (!beforeCard) return;

      const afterCard = currentSlots[index];
      const cardStillInSameSlot = afterCard?.instanceId === beforeCard.instanceId;
      if (cardStillInSameSlot) return;

      const wasAlreadyInDiscard = cardExistsInDiscard(previous, side, beforeCard.instanceId);
      const isNowInDiscard = cardExistsInDiscard(current, side, beforeCard.instanceId);
      if (wasAlreadyInDiscard || !isNowInDiscard) return;

      const from = getDomRect(`[data-slot-side="${side}"][data-slot-index="${index}"]`);
      const to = getDomRect(`[data-pile-kind="discard"][data-pile-owner="${side}"]`);
      if (!from || !to) return;

      events.push({
        id: `travel_${Date.now()}_${nextId++}`,
        image: getCardImage(beforeCard),
        title: getCardTitle(beforeCard),
        from,
        to,
        owner: side,
        reason: beforeCard.temporaryUntilRoundEnd ? "discard" : "destroyed",
      });
    });
  });

  return {
    events,
    nextId,
  };
}

function clearTimer(timerRef: { current: number | null }) {
  if (timerRef.current === null) return;
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

function validatePlay(matchState: MatchStateSnapshot, cardInstanceId: string, slotIndex: number) {
  if (matchState.winner) {
    return "Match is already over.";
  }

  if (matchState.activePlayerId !== "player") {
    return "It is not your initiative.";
  }

  if (matchState.phase !== "main") {
    return "Roll D20 before playing cards.";
  }

  const card = matchState.player.hand.find((candidate) => candidate.instanceId === cardInstanceId);
  if (!card) {
    return "Selected card is no longer in your hand.";
  }

  if (cardRequiresBoardSlot(card)) {
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= matchState.board.playerSlots.length) {
      return "Invalid target slot.";
    }

    if (matchState.board.playerSlots[slotIndex]) {
      return `Slot ${slotIndex + 1} is occupied.`;
    }
  }

  const cost = getEffectiveCardCost(matchState, "player", card);
  if (matchState.player.will < cost) {
    return `${getCardTitle(card)} needs ${cost} Will. You have ${matchState.player.will}.`;
  }

  return null;
}


function hasPlayablePlayerCard(matchState: MatchStateSnapshot) {
  return canPlayerMakeAnyMove(matchState, "player");
}


function getTacticalRevealEvents(matchState: MatchStateSnapshot): TacticalRevealEvent[] {
  const record = matchState as unknown as Record<string, unknown>;
  return Array.isArray(record.tacticalRevealEvents) ? record.tacticalRevealEvents as TacticalRevealEvent[] : [];
}

function getCardCurrentHp(card: CardInstance | null | undefined) {
  if (!card) return 0;

  const definition = card.definition as unknown as Record<string, unknown>;
  const max = Math.max(0, Math.floor(Number(definition.health ?? 0)) || 0);
  const raw = Number(card.currentHealth ?? max);
  return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : max;
}

function pushFx(
  events: MatchFxEvent[],
  idSeed: { value: number },
  tone: MatchFxEvent["tone"],
  anchor: MatchFxEvent["anchor"],
  text: string,
) {
  events.push({
    id: `fx_${Date.now()}_${idSeed.value++}`,
    tone,
    anchor,
    text,
  });
}

function collectSideFx(
  events: MatchFxEvent[],
  idSeed: { value: number },
  previous: MatchStateSnapshot,
  current: MatchStateSnapshot,
  side: "player" | "enemy",
) {
  const before = previous[side];
  const after = current[side];
  const heroAnchor = `${side}-hero` as MatchFxEvent["anchor"];
  const willAnchor = `${side}-will` as MatchFxEvent["anchor"];

  const hpDelta = after.hp - before.hp;
  if (hpDelta < 0) pushFx(events, idSeed, "damage", heroAnchor, `${hpDelta}`);
  if (hpDelta > 0) pushFx(events, idSeed, "heal", heroAnchor, `+${hpDelta}`);

  const shieldDelta = (after.shield ?? 0) - (before.shield ?? 0);
  if (shieldDelta > 0) pushFx(events, idSeed, "shield", heroAnchor, `+${shieldDelta} SHIELD`);
  if (shieldDelta < 0) pushFx(events, idSeed, "shield", heroAnchor, `${shieldDelta} SHIELD`);

  const willDelta = after.will - before.will;
  if (willDelta > 0) pushFx(events, idSeed, "will", willAnchor, `+${willDelta} WILL`);
  if (willDelta < 0) pushFx(events, idSeed, "will", willAnchor, `${willDelta} WILL`);
}

function collectBoardFx(
  events: MatchFxEvent[],
  idSeed: { value: number },
  previous: MatchStateSnapshot,
  current: MatchStateSnapshot,
  side: "player" | "enemy",
) {
  const previousSlots = side === "player" ? previous.board.playerSlots : previous.board.enemySlots;
  const currentSlots = side === "player" ? current.board.playerSlots : current.board.enemySlots;

  currentSlots.forEach((card, index) => {
    const before = previousSlots[index];
    const anchor = `slot-${side}-${index}` as MatchFxEvent["anchor"];

    if (!before && card) {
      pushFx(events, idSeed, card.temporaryUntilRoundEnd ? "play" : "sys", anchor, card.temporaryUntilRoundEnd ? "TEMP" : "PLAY");
      return;
    }

    if (before && !card) {
      pushFx(events, idSeed, "discard", anchor, before.temporaryUntilRoundEnd ? "DISCARD" : "DESTROYED");
      return;
    }

    if (!before || !card || before.instanceId !== card.instanceId) return;

    const hpDelta = getCardCurrentHp(card) - getCardCurrentHp(before);
    if (hpDelta < 0) pushFx(events, idSeed, "damage", anchor, `${hpDelta}`);
    if (hpDelta > 0) pushFx(events, idSeed, "heal", anchor, `+${hpDelta}`);
  });
}

function buildFxEvents(previous: MatchStateSnapshot, current: MatchStateSnapshot, startId: number) {
  const events: MatchFxEvent[] = [];
  const idSeed = { value: startId };

  collectSideFx(events, idSeed, previous, current, "player");
  collectSideFx(events, idSeed, previous, current, "enemy");
  collectBoardFx(events, idSeed, previous, current, "player");
  collectBoardFx(events, idSeed, previous, current, "enemy");

  if (previous.lastRoll !== current.lastRoll && typeof current.lastRoll === "number") {
    pushFx(events, idSeed, "will", "d20", `${current.lastRoll}`);
  }

  return {
    events,
    nextId: idSeed.value,
  };
}


function safeNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOwnedCardText(card: OwnedCard, keys: string[], fallback = "") {
  const record = card as unknown as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }

  return fallback;
}

function normalizeMatchCardType(value: unknown) {
  const raw = String(value ?? "effect").trim().toLowerCase();

  if (raw === "hero" || raw === "character" || raw === "персонаж") return "character";
  if (raw === "bonus" || raw === "upgrade" || raw === "бонус" || raw === "улучшение") return "bonus";
  if (raw === "event" || raw === "событие") return "event";
  if (raw === "tactic" || raw === "тактика") return "tactic";
  if (raw === "effect" || raw === "эффект") return "effect";

  return raw || "effect";
}

function ownedCardToMatchDefinition(card: OwnedCard): CardDefinition {
  const record = card as unknown as Record<string, unknown>;
  const baseId = readOwnedCardText(card, ["baseId", "id"], card.instanceId);
  const title = readOwnedCardText(card, ["title", "ruTitle", "name"], baseId);
  const image = readOwnedCardText(card, ["frontSrc", "image", "imageUrl", "src", "path"], "/cards/card-back.png");
  const type = normalizeMatchCardType(record.type);
  const cost = Math.max(0, Math.floor(safeNumber(record.cost ?? record.willCost, 0)));
  const attack = Math.max(0, Math.floor(safeNumber(record.attack, 0)));
  const health = Math.max(0, Math.floor(safeNumber(record.health, 0)));

  return {
    id: baseId,
    title,
    ruTitle: title,
    name: title,
    type,
    rarity: readOwnedCardText(card, ["rarity"], "common"),
    cost,
    willCost: cost,
    attack,
    health,
    image,
    imageUrl: image,
    src: image,
    path: image,
    description: readOwnedCardText(card, ["description", "text", "effectText"], ""),
    effectKey: readOwnedCardText(card, ["effectKey"], ""),
    effects: Array.isArray(record.effects) ? record.effects : undefined,
    collection: readOwnedCardText(card, ["collection"], ""),
    inventoryInstanceId: card.instanceId,
    edition: record.edition,
    isFoil: record.isFoil,
    foilColor: record.foilColor,
  } as unknown as CardDefinition;
}

function buildPlayerDeckForMatch(ownedCards: OwnedCard[], deckIds: string[]) {
  const ownedByInstanceId = new Map(ownedCards.map((card) => [card.instanceId, card]));
  const usedBaseIds = new Set<string>();

  const deck = deckIds
    .map((deckId) => ownedByInstanceId.get(deckId))
    .filter((card): card is OwnedCard => Boolean(card))
    .filter((card) => {
      if (usedBaseIds.has(card.baseId)) return false;
      usedBaseIds.add(card.baseId);
      return true;
    })
    .map(ownedCardToMatchDefinition);

  return deck.length === 20 ? deck : [];
}

function buildMatchPayloadFromDeck(
  ownedCards: OwnedCard[],
  deckIds: string[],
  willStats: WillMatchStats,
  seed = Date.now(),
): StartMatchPayload {
  const playerDeck = buildPlayerDeckForMatch(ownedCards, deckIds);
  const payload = playerDeck.length === 20
    ? { seed, playerDeck, playerWillStats: willStats }
    : { seed, playerWillStats: willStats, deckError: "A FRAKTUM match requires a 20-card unique deck." };

  return payload as unknown as StartMatchPayload;
}

function buildOnlinePlayerSnapshot(
  playerName: string,
  ownedCards: OwnedCard[],
  deckIds: string[],
  willStats: WillMatchStats,
  level: number,
  avatar?: string,
): OnlinePlayerSnapshot {
  const deck = buildPlayerDeckForMatch(ownedCards, deckIds);

  return {
    playerName: playerName || "FRAKTUM Player",
    avatar,
    level,
    deck,
    deckSize: deck.length,
    willStats,
    createdAt: new Date().toISOString(),
  };
}

function buildMatchPayloadFromOnlineRoom(
  room: OnlineMatchRoom,
  seat: OnlineSeat,
  fallbackWillStats: WillMatchStats,
): StartMatchPayload {
  const own = getOwnSnapshot(room, seat);
  const opponent = getOpponentSnapshot(room, seat);

  return {
    seed: Number(room.seed || Date.now()),
    playerDeck: own?.deck && own.deck.length === 20 ? own.deck : undefined,
    enemyDeck: opponent?.deck && opponent.deck.length === 20 ? opponent.deck : undefined,
    playerWillStats: own?.willStats ?? fallbackWillStats,
    enemyWillStats: opponent?.willStats ?? fallbackWillStats,
  } as unknown as StartMatchPayload;
}

function matchReducer(current: MatchStateSnapshot, action: GameAction) {
  return dispatch(current, action);
}

function remapOnlinePlayerId(value: unknown, isOwnAction: boolean) {
  if (value === "player") return isOwnAction ? "player" : "enemy";
  if (value === "enemy") return isOwnAction ? "enemy" : "player";
  return value;
}

function remapOnlineCardInstanceId(value: unknown, isOwnAction: boolean) {
  if (typeof value !== "string") return value;
  if (isOwnAction) return value.replace(/^enemy_/, "player_");
  return value.replace(/^player_/, "enemy_");
}

function cloneOnlineAction(action: unknown): Record<string, unknown> | null {
  if (!action || typeof action !== "object") return null;
  return JSON.parse(JSON.stringify(action)) as Record<string, unknown>;
}

function mapOnlineActionForLocalClient(event: OnlineMatchActionEvent, ownSeat: OnlineSeat): GameAction | null {
  const action = cloneOnlineAction(event.action);
  if (!action) return null;

  if (action.type === "START_MATCH" || action.type === "AI_TURN") return null;

  const isOwnAction = event.actor_seat === ownSeat;

  if ("playerId" in action) {
    action.playerId = remapOnlinePlayerId(action.playerId, isOwnAction);
  }

  if ("cardInstanceId" in action) {
    action.cardInstanceId = remapOnlineCardInstanceId(action.cardInstanceId, isOwnAction);
  }

  const target = action.target;
  if (target && typeof target === "object") {
    const targetRecord = target as Record<string, unknown>;
    if ("playerId" in targetRecord) {
      targetRecord.playerId = remapOnlinePlayerId(targetRecord.playerId, isOwnAction);
    }
  }

  return action as unknown as GameAction;
}

function makeClientActionId() {
  return `client_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function MatchPage() {
  const nav = useNavigate();
  const location = useLocation();
  const { mode } = useParams<MatchRouteParams>();
  const matchMode = mode ?? (location.pathname.toLowerCase().includes("online") ? "online" : "ai");
  const isOnlineMode = matchMode === "online";
  const applyMatchResultToProgress = useGameStore((store) => store.applyMatchResultToProgress);
  const ownedCards = useGameStore((store) => store.ownedCards);
  const deckIds = useGameStore((store) => store.deckIds);
  const willUpgrades = useGameStore((store) => store.willUpgrades);
  const playerName = useGameStore((store) => store.playerName);
  const avatar = useGameStore((store) => store.avatar);
  const level = useGameStore((store) => store.level);
  const initialMatchPayload = useMemo(
    () => buildMatchPayloadFromDeck(ownedCards, deckIds, getWillStatsFromUpgrades(willUpgrades)),
    // The match must use the deck snapshot that existed when the page opened.
    // Restart uses a fresh snapshot below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [uiLog, setUiLog] = useState<string[]>([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [fxEvents, setFxEvents] = useState<MatchFxEvent[]>([]);
  const [cardTravelEvents, setCardTravelEvents] = useState<CardTravelEvent[]>([]);
  const [tacticalRevealEvents, setTacticalRevealEvents] = useState<TacticalRevealEvent[]>([]);
  const [matchReward, setMatchReward] = useState<MatchRewardResult | null>(null);
  const [onlineQueueState, setOnlineQueueState] = useState<OnlineQueueState>(() => isOnlineMode ? "idle" : "matched");
  const [onlineQueueMessage, setOnlineQueueMessage] = useState("Online mode is ready. Start matchmaking when you are ready.");
  const [onlineRoom, setOnlineRoom] = useState<OnlineMatchRoom | null>(null);
  const [onlineSeat, setOnlineSeat] = useState<OnlineSeat | null>(null);
  const [state, send] = useReducer(
    matchReducer,
    initialMatchPayload,
    createInitialMatchState,
  );

  const stateRef = useRef(state);
  const previousFxState = useRef<MatchStateSnapshot | null>(null);
  const previousAutoFlowState = useRef<MatchStateSnapshot | null>(null);
  const seenTacticalRevealIds = useRef<Set<string>>(new Set());
  const fxSeq = useRef(0);
  const travelSeq = useRef(0);
  const rewardedMatchId = useRef<string | null>(null);
  const fxTimers = useRef<number[]>([]);
  const travelTimers = useRef<number[]>([]);
  const tacticalRevealTimers = useRef<number[]>([]);
  const pendingPlayTimer = useRef<number | null>(null);
  const aiTurnTimer = useRef<number | null>(null);
  const autoPlayerTurnTimer = useRef<number | null>(null);
  const onlineQueueTimer = useRef<number | null>(null);
  const onlineRoomUnsubscribe = useRef<(() => void) | null>(null);
  const onlineActionUnsubscribe = useRef<(() => void) | null>(null);
  const onlineActionPollTimer = useRef<number | null>(null);
  const processedOnlineActionIds = useRef<Set<string>>(new Set());
  const onlineSeatRef = useRef<OnlineSeat | null>(null);
  const startedOnlineRoomId = useRef<string | null>(null);

  const opponentUi = useMemo(() => {
    const snapshot = onlineRoom && onlineSeat ? getOpponentSnapshot(onlineRoom, onlineSeat) : null;

    return {
      name: isOnlineMode ? snapshot?.playerName ?? "Opponent" : null,
      rankLabel: isOnlineMode ? `RANK ${snapshot?.level ?? "III"}` : null,
    };
  }, [isOnlineMode, onlineRoom, onlineSeat]);

  const debugRecorder = useMatchDebugRecorder({
    enabled: true,
    state,
    matchMode: isOnlineMode ? "online" : "ai",
    roomId: onlineRoom?.id,
    seat: onlineSeat,
    playerNames: { player: playerName || "Player", enemy: opponentUi.name ?? "AI" },
  });
  const recordDebug = debugRecorder.record;

  useEffect(() => {
    stateRef.current = state;

    const previous = previousFxState.current;
    if (!previous) {
      previousFxState.current = state;
      return;
    }

    const built = buildFxEvents(previous, state, fxSeq.current);
    fxSeq.current = built.nextId;

    const travel = buildCardTravelEvents(previous, state, travelSeq.current);
    travelSeq.current = travel.nextId;

    previousFxState.current = state;

    if (built.events.length > 0) {
      const eventIds = new Set(built.events.map((event) => event.id));
      setFxEvents((currentEvents) => [...currentEvents, ...built.events].slice(-FX_LOG_LIMIT));

      const timer = window.setTimeout(() => {
        setFxEvents((currentEvents) => currentEvents.filter((event) => !eventIds.has(event.id)));
        fxTimers.current = fxTimers.current.filter((candidate) => candidate !== timer);
      }, FX_EVENT_TTL_MS);

      fxTimers.current.push(timer);
    }

    if (travel.events.length > 0) {
      const eventIds = new Set(travel.events.map((event) => event.id));
      setCardTravelEvents((currentEvents) => [...currentEvents, ...travel.events].slice(-12));

      const timer = window.setTimeout(() => {
        setCardTravelEvents((currentEvents) => currentEvents.filter((event) => !eventIds.has(event.id)));
        travelTimers.current = travelTimers.current.filter((candidate) => candidate !== timer);
      }, TRAVEL_EVENT_TTL_MS);

      travelTimers.current.push(timer);
    }

    const revealEvents = getTacticalRevealEvents(state).filter((event) => !seenTacticalRevealIds.current.has(event.id));
    if (revealEvents.length > 0) {
      revealEvents.forEach((event) => seenTacticalRevealIds.current.add(event.id));
      const eventIds = new Set(revealEvents.map((event) => event.id));
      setTacticalRevealEvents((currentEvents) => [...currentEvents, ...revealEvents].slice(-8));

      const timer = window.setTimeout(() => {
        setTacticalRevealEvents((currentEvents) => currentEvents.filter((event) => !eventIds.has(event.id)));
        tacticalRevealTimers.current = tacticalRevealTimers.current.filter((candidate) => candidate !== timer);
      }, TACTICAL_REVEAL_TTL_MS);

      tacticalRevealTimers.current.push(timer);
    }
  }, [state]);

  useEffect(() => {
    const outcome = getOutcomeFromWinner(state.winner);
    if (!outcome) return;
    if (rewardedMatchId.current === state.id) return;

    rewardedMatchId.current = state.id;

    const rewardValues = getMatchRewardValues(outcome);
    const appliedReward = applyMatchResultToProgress({
      id: state.id,
      result: outcome,
      winner: state.winner,
      xp: rewardValues.xp,
      coins: rewardValues.coins,
      finishedAt: Date.now(),
    } as Parameters<typeof applyMatchResultToProgress>[0]);

    if (!appliedReward) return;

    setMatchReward(appliedReward);
    setUiLog((entries) => pushLimited(entries, `[SYS] Rewards granted: +${appliedReward.xp} XP, +${appliedReward.coins} Coins.`));
  }, [applyMatchResultToProgress, state.id, state.winner]);

  useEffect(() => {
    onlineSeatRef.current = onlineSeat;
  }, [onlineRoom, onlineSeat]);

  useEffect(() => {
    return () => {
      clearTimer(pendingPlayTimer);
      clearTimer(aiTurnTimer);
      clearTimer(autoPlayerTurnTimer);
      clearTimer(onlineQueueTimer);
      onlineRoomUnsubscribe.current?.();
      onlineRoomUnsubscribe.current = null;
      onlineActionUnsubscribe.current?.();
      onlineActionUnsubscribe.current = null;
      clearTimer(onlineActionPollTimer);
      fxTimers.current.forEach((timer) => window.clearTimeout(timer));
      fxTimers.current = [];
      travelTimers.current.forEach((timer) => window.clearTimeout(timer));
      travelTimers.current = [];
      tacticalRevealTimers.current.forEach((timer) => window.clearTimeout(timer));
      tacticalRevealTimers.current = [];
    };
  }, []);

  useEffect(() => {
    clearTimer(onlineQueueTimer);
    onlineRoomUnsubscribe.current?.();
    onlineRoomUnsubscribe.current = null;
    onlineActionUnsubscribe.current?.();
    onlineActionUnsubscribe.current = null;
    clearTimer(onlineActionPollTimer);
    processedOnlineActionIds.current = new Set();
    startedOnlineRoomId.current = null;
    setOnlineRoom(null);
    setOnlineSeat(null);
    setOnlineQueueState(isOnlineMode ? "idle" : "matched");
    setOnlineQueueMessage(
      isOnlineMode
        ? "Online mode is connected to Supabase. Login in Profile, then start matchmaking."
        : "AI match mode."
    );
  }, [isOnlineMode]);

  const addUiLog = useCallback((message: string, tone: "warn" | "sys" = "warn") => {
    const prefix = tone === "sys" ? "[SYS]" : "[WARN]";
    setUiLog((entries) => pushLimited(entries, `${prefix} ${message}`));
  }, []);

  const processOnlineActionEvents = useCallback((events: OnlineMatchActionEvent[]) => {
    const seat = onlineSeatRef.current;
    if (!seat) return;

    const sorted = [...events].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeA - timeB || a.id.localeCompare(b.id);
    });

    for (const event of sorted) {
      const duplicate = Boolean(event?.id && processedOnlineActionIds.current.has(event.id));
      const mappedAction = mapOnlineActionForLocalClient(event, seat);
      const createdAtMs = new Date(event.created_at || 0).getTime();
      recordDebug({
        source: duplicate ? "warning" : "online_remote",
        level: duplicate ? "warning" : "info",
        category: "online",
        actionType: duplicate ? "ONLINE_DUPLICATE_IGNORED" : "ONLINE_REMOTE_RECEIVE",
        message: duplicate ? `Duplicate online event ignored: ${event.id}` : `Online event received from seat ${event.actor_seat}.`,
        action: event.action,
        before: createMatchDebugStateSummary(stateRef.current),
        metadata: {
          eventId: event.id,
          actorSeat: event.actor_seat,
          createdAt: event.created_at,
          latencyMs: Number.isFinite(createdAtMs) ? Date.now() - createdAtMs : undefined,
          mappedAction,
          duplicate,
          rejected: !mappedAction,
        },
      });
      if (!event?.id || duplicate) continue;
      processedOnlineActionIds.current.add(event.id);

      if (!mappedAction) continue;
      send(mappedAction);
    }
  }, [recordDebug]);

  const submitGameAction = useCallback(async (action: GameAction) => {
    const before = createMatchDebugStateSummary(stateRef.current);
    recordDebug({
      source: isOnlineMode ? "online_local" : action.type === "AI_TURN" ? "ai" : "player",
      category: "action",
      actionType: action.type,
      message: `${isOnlineMode ? "Queue online" : "Dispatch local"} action ${action.type}.`,
      action,
      before,
    });

    if (!isOnlineMode || !onlineRoom?.id || !onlineSeat || onlineQueueState !== "matched") {
      send(action);
      return;
    }

    const clientActionId = makeClientActionId();
    recordDebug({
      source: "online_local",
      category: "online",
      actionType: "ONLINE_LOCAL_SEND",
      message: `Sending online action ${action.type}.`,
      action,
      before,
      metadata: { roomId: onlineRoom.id, seat: onlineSeat, clientActionId, sentAt: Date.now() },
    });

    try {
      await appendOnlineMatchAction({
        roomId: onlineRoom.id,
        seat: onlineSeat,
        action,
        clientActionId,
      });
      recordDebug({
        source: "online_local",
        category: "online",
        actionType: "ONLINE_LOCAL_CONFIRMED",
        message: `Online action ${action.type} confirmed by backend.`,
        action,
        metadata: { roomId: onlineRoom.id, seat: onlineSeat, clientActionId },
      });
    } catch (error) {
      recordDebug({
        source: "online_local",
        level: "error",
        category: "online",
        actionType: "ONLINE_LOCAL_ERROR",
        message: error instanceof Error ? error.message : String(error),
        action,
        metadata: { roomId: onlineRoom.id, seat: onlineSeat, clientActionId, error: sanitizeDebugValue(error) },
      });
      setUiLog((entries) => pushLimited(entries, `[WARN] Online action failed: ${error instanceof Error ? error.message : String(error)}`));
    }
  }, [recordDebug, isOnlineMode, onlineQueueState, onlineRoom?.id, onlineSeat]);

  const clearPendingPlay = useCallback(() => {
    clearTimer(pendingPlayTimer);
  }, []);

  const commitPlay = useCallback((cardInstanceId: string, slotIndex: number) => {
    const currentState = stateRef.current;
    const problem = validatePlay(currentState, cardInstanceId, slotIndex);

    if (problem) {
      recordDebug({ source: "warning", level: "warning", category: "action", actionType: "PLAY_CARD_INVALID", message: problem, before: createMatchDebugStateSummary(currentState), metadata: { cardInstanceId, slotIndex } });
      addUiLog(problem);
      setSelectedCardId(null);
      return;
    }

    void submitGameAction({
      type: "PLAY_CARD",
      playerId: "player",
      cardInstanceId,
      target: { type: "slot", playerId: "player", slotIndex },
    } as GameAction);

    setSelectedCardId(null);
  }, [addUiLog, recordDebug, submitGameAction]);

  const playCard = useCallback((cardInstanceId: string, slotIndex: number) => {
    const currentState = stateRef.current;
    const problem = validatePlay(currentState, cardInstanceId, slotIndex);

    if (problem) {
      recordDebug({ source: "warning", level: "warning", category: "action", actionType: "PLAY_CARD_INVALID", message: problem, before: createMatchDebugStateSummary(currentState), metadata: { cardInstanceId, slotIndex } });
      addUiLog(problem);
      setSelectedCardId(null);
      return;
    }

    recordDebug({ source: "player", category: "card", actionType: "CARD_SELECTED", message: `Selected card ${cardInstanceId} for slot ${slotIndex + 1}.`, before: createMatchDebugStateSummary(currentState), metadata: { cardInstanceId, slotIndex } });
    setSelectedCardId(cardInstanceId);
    clearPendingPlay();

    pendingPlayTimer.current = window.setTimeout(() => {
      pendingPlayTimer.current = null;
      commitPlay(cardInstanceId, slotIndex);
    }, PLAY_COMMIT_DELAY_MS);
  }, [addUiLog, clearPendingPlay, commitPlay, recordDebug]);

  const handleRoll = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.winner) return;

    if (currentState.activePlayerId !== "player" || currentState.phase !== "roll") {
      recordDebug({ source: "warning", level: "warning", category: "roll", actionType: "ROLL_D20_INVALID", message: "D20 can be rolled only during your roll phase.", before: createMatchDebugStateSummary(currentState) });
      addUiLog("D20 can be rolled only during your roll phase.");
      return;
    }

    setSelectedCardId(null);
    clearPendingPlay();
    void submitGameAction({ type: "ROLL_D20", playerId: "player" } as GameAction);
  }, [addUiLog, clearPendingPlay, recordDebug, submitGameAction]);

  const handleEndTurn = useCallback(() => {
    const currentState = stateRef.current;

    if (currentState.winner) return;

    if (currentState.activePlayerId !== "player") {
      recordDebug({ source: "warning", level: "warning", category: "turn", actionType: "END_TURN_INVALID", message: "It is not your turn.", before: createMatchDebugStateSummary(currentState) });
      addUiLog("It is not your turn.");
      return;
    }

    if (currentState.phase !== "main") {
      recordDebug({ source: "warning", level: "warning", category: "turn", actionType: "END_TURN_INVALID", message: "Roll D20 first. End turn is available after the main phase starts.", before: createMatchDebugStateSummary(currentState) });
      addUiLog("Roll D20 first. End turn is available after the main phase starts.");
      return;
    }

    setSelectedCardId(null);
    clearPendingPlay();
    void submitGameAction({ type: "END_TURN", playerId: "player" } as GameAction);
  }, [addUiLog, clearPendingPlay, recordDebug, submitGameAction]);

  const handleAiTurn = useCallback(() => {
    const currentState = stateRef.current;

    if (currentState.winner) return;

    if (currentState.activePlayerId !== "enemy" || currentState.phase !== "enemy") {
      addUiLog("AI can act only during enemy initiative.");
      return;
    }

    setSelectedCardId(null);
    clearPendingPlay();
    clearTimer(aiTurnTimer);
    setAiThinking(false);
    recordDebug({ source: "ai", category: "action", actionType: "AI_TURN_START", message: "Manual AI turn dispatch requested.", before: createMatchDebugStateSummary(currentState) });
    send({ type: "AI_TURN" });
  }, [addUiLog, clearPendingPlay, recordDebug]);

  const handleRestart = useCallback(() => {
    clearTimer(pendingPlayTimer);
    clearTimer(aiTurnTimer);
    clearTimer(autoPlayerTurnTimer);
    clearTimer(onlineQueueTimer);
    clearTimer(onlineActionPollTimer);
    onlineActionUnsubscribe.current?.();
    onlineActionUnsubscribe.current = null;
    fxTimers.current.forEach((timer) => window.clearTimeout(timer));
    fxTimers.current = [];
    travelTimers.current.forEach((timer) => window.clearTimeout(timer));
    travelTimers.current = [];
    tacticalRevealTimers.current.forEach((timer) => window.clearTimeout(timer));
    tacticalRevealTimers.current = [];
    previousFxState.current = null;
    setSelectedCardId(null);
    setUiLog([]);
    setFxEvents([]);
    setCardTravelEvents([]);
    setTacticalRevealEvents([]);
    seenTacticalRevealIds.current = new Set();
    setMatchReward(null);
    rewardedMatchId.current = null;
    setAiThinking(false);
    recordDebug({ source: "player", category: "match", actionType: "RESTART", message: "Player restarted match.", before: createMatchDebugStateSummary(stateRef.current) });
    send({
      type: "START_MATCH",
      payload: buildMatchPayloadFromDeck(ownedCards, deckIds, getWillStatsFromUpgrades(willUpgrades), Date.now()),
    } as GameAction);
  }, [recordDebug, deckIds, ownedCards, willUpgrades]);

  const handleReturnToMenu = useCallback(() => {
    clearTimer(pendingPlayTimer);
    clearTimer(aiTurnTimer);
    clearTimer(autoPlayerTurnTimer);
    clearTimer(onlineQueueTimer);
    clearTimer(onlineActionPollTimer);
    onlineActionUnsubscribe.current?.();
    onlineActionUnsubscribe.current = null;
    fxTimers.current.forEach((timer) => window.clearTimeout(timer));
    fxTimers.current = [];
    travelTimers.current.forEach((timer) => window.clearTimeout(timer));
    travelTimers.current = [];
    tacticalRevealTimers.current.forEach((timer) => window.clearTimeout(timer));
    tacticalRevealTimers.current = [];
    setSelectedCardId(null);
    setAiThinking(false);
    nav("/play");
  }, [nav]);

  const handleConcede = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.winner) return;

    clearTimer(pendingPlayTimer);
    clearTimer(aiTurnTimer);
    clearTimer(autoPlayerTurnTimer);
    clearTimer(onlineQueueTimer);
    setSelectedCardId(null);
    setAiThinking(false);
    void submitGameAction({ type: "CONCEDE", playerId: "player" } as GameAction);
  }, [submitGameAction]);

  const startOnlineRoomMatch = useCallback(async (room: OnlineMatchRoom, seat: OnlineSeat) => {
    if (!isRoomReady(room)) return;
    if (startedOnlineRoomId.current === room.id) return;

    clearTimer(onlineQueueTimer);

    const fallbackWillStats = getWillStatsFromUpgrades(willUpgrades);
    const payload = {
      ...buildMatchPayloadFromOnlineRoom(room, seat, fallbackWillStats),
      startingPlayerId: seat === "a" ? "player" : "enemy",
    } as unknown as StartMatchPayload;
    const own = getOwnSnapshot(room, seat);
    const opponent = getOpponentSnapshot(room, seat);

    startedOnlineRoomId.current = room.id;
    setOnlineRoom(room);
    setOnlineSeat(seat);
    setOnlineQueueState("matched");
    setOnlineQueueMessage(`Opponent found: ${opponent?.playerName ?? "unknown player"}.`);
    setUiLog((entries) => pushLimited(entries, `[SYS] Online room ${room.id.slice(0, 8)} matched. You are seat ${seat.toUpperCase()}.`));
    setUiLog((entries) => pushLimited(entries, `[SYS] ${own?.playerName ?? "You"} vs ${opponent?.playerName ?? "Opponent"}. Realtime action sync enabled.`));
    recordDebug({ source: "online_local", category: "online", actionType: "ONLINE_ROOM_MATCHED", message: `Online room matched with ${opponent?.playerName ?? "Opponent"}.`, metadata: { roomId: room.id, seat, opponentName: opponent?.playerName, ownName: own?.playerName } });

    send({
      type: "START_MATCH",
      payload,
    } as GameAction);

    try {
      await markOnlineRoomPlaying(room.id);
    } catch (error) {
      setUiLog((entries) => pushLimited(entries, `[WARN] Could not mark online room as playing: ${error instanceof Error ? error.message : String(error)}`));
    }
  }, [recordDebug, willUpgrades]);

  const startOnlineSearch = useCallback(async () => {
    clearTimer(onlineQueueTimer);
    onlineRoomUnsubscribe.current?.();
    onlineRoomUnsubscribe.current = null;
    startedOnlineRoomId.current = null;

    if (!isOnlineMatchmakingConfigured()) {
      setOnlineQueueState("error");
      setOnlineQueueMessage("Supabase is not configured. Check .env.local and restart dev server.");
      return;
    }

    setOnlineQueueState("searching");
    setOnlineQueueMessage("Connecting to Supabase matchmaking queue...");
    recordDebug({ source: "online_local", category: "online", actionType: "ONLINE_SEARCH_START", message: "Online matchmaking search started." });

    try {
      const willStats = getWillStatsFromUpgrades(willUpgrades);
      const snapshot = buildOnlinePlayerSnapshot(playerName, ownedCards, deckIds, willStats, level, avatar);

      const result = await joinOnlineMatchmaking(snapshot);
      recordDebug({ source: "online_local", category: "online", actionType: "ONLINE_ROOM_FOUND", message: `Online room ${result.room.id.slice(0, 8)} found as seat ${result.seat.toUpperCase()}.`, metadata: { roomId: result.room.id, seat: result.seat, status: result.room.status } });
      setOnlineRoom(result.room);
      setOnlineSeat(result.seat);

      if (isRoomReady(result.room)) {
        await startOnlineRoomMatch(result.room, result.seat);
        return;
      }

      setOnlineQueueMessage(`Waiting for opponent. Room ${result.room.id.slice(0, 8)} created.`);
      recordDebug({ source: "online_local", category: "online", actionType: "ONLINE_REALTIME_SUBSCRIBE", message: "Subscribing to online room realtime updates.", metadata: { roomId: result.room.id } });
      onlineRoomUnsubscribe.current = subscribeToOnlineMatchRoom(
        result.room.id,
        (nextRoom) => {
          setOnlineRoom(nextRoom);
          if (isRoomReady(nextRoom)) {
            void startOnlineRoomMatch(nextRoom, result.seat);
          }
        },
        (error) => {
          setOnlineQueueMessage(`Realtime warning: ${error instanceof Error ? error.message : String(error)}. Polling fallback is still available.`);
        },
      );

      recordDebug({ source: "online_local", category: "online", actionType: "ONLINE_POLLING_FALLBACK", message: "Online room polling fallback started.", metadata: { roomId: result.room.id, intervalMs: 2500 } });
      const pollTimer = window.setInterval(async () => {
        try {
          const nextRoom = await fetchOnlineMatchRoom(result.room.id);
          if (!nextRoom) return;
          setOnlineRoom(nextRoom);
          if (isRoomReady(nextRoom)) {
            window.clearInterval(pollTimer);
            await startOnlineRoomMatch(nextRoom, result.seat);
          }
        } catch {
          window.clearInterval(pollTimer);
        }
      }, 2500);

      onlineQueueTimer.current = pollTimer as unknown as number;
    } catch (error) {
      recordDebug({ source: "online_local", level: "error", category: "online", actionType: "ONLINE_SEARCH_ERROR", message: error instanceof Error ? error.message : String(error), metadata: { error: sanitizeDebugValue(error) } });
      setOnlineQueueState("error");
      setOnlineQueueMessage(error instanceof Error ? error.message : String(error));
    }
  }, [avatar, recordDebug, deckIds, level, ownedCards, playerName, startOnlineRoomMatch, willUpgrades]);

  const cancelOnlineSearch = useCallback(async () => {
    clearTimer(onlineQueueTimer);
    onlineRoomUnsubscribe.current?.();
    onlineRoomUnsubscribe.current = null;

    const roomId = onlineRoom?.id;
    setOnlineRoom(null);
    setOnlineSeat(null);
    startedOnlineRoomId.current = null;
    setOnlineQueueState("idle");
    setOnlineQueueMessage("Search cancelled.");
    recordDebug({ source: "online_local", category: "online", actionType: "ONLINE_SEARCH_CANCEL", message: "Online matchmaking search cancelled.", metadata: { roomId } });

    if (!roomId) return;

    try {
      await cancelOnlineMatchmaking(roomId);
    } catch (error) {
      setOnlineQueueMessage(`Search cancelled locally. Server cancel failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [recordDebug, onlineRoom?.id]);

  const handleInvalidDrop = useCallback((message: string) => {
    addUiLog(message || "Invalid target.");
    setSelectedCardId(null);
  }, [addUiLog]);

  useEffect(() => {
    clearTimer(aiTurnTimer);

    if (isOnlineMode) {
      setAiThinking(false);
      return;
    }

    if (state.activePlayerId !== "enemy" || state.phase !== "enemy" || state.winner) {
      setAiThinking(false);
      return;
    }

    setAiThinking(true);
    aiTurnTimer.current = window.setTimeout(() => {
      aiTurnTimer.current = null;
      setAiThinking(false);
      const currentState = stateRef.current;
      const action = planNextAiAction(currentState);
      if (!action) {
        recordDebug({
          source: "warning",
          level: "warning",
          category: "turn",
          actionType: "AI_DEADLOCK_WARNING",
          message: "AI planner returned no action during enemy turn; ending turn safely.",
          before: createMatchDebugStateSummary(currentState),
        });
        send({ type: "END_TURN", playerId: "enemy" });
        return;
      }
      recordDebug({ source: "ai", category: "action", actionType: "AI_ACTION_PLANNED", message: `AI planned ${action.type}.`, action, before: createMatchDebugStateSummary(currentState) });
      send(action);
    }, state.currentTurn?.playerId === "enemy" ? AUTO_AI_DELAY_MS : Math.max(150, Math.floor(AUTO_AI_DELAY_MS / 2)));

    return () => {
      clearTimer(aiTurnTimer);
    };
  }, [recordDebug, isOnlineMode, state]);

  useEffect(() => {
    clearTimer(autoPlayerTurnTimer);

    previousAutoFlowState.current = state;

    if (state.winner || state.activePlayerId !== "player" || state.phase !== "main") {
      return;
    }

    const hasPlayableCard = hasPlayablePlayerCard(state);

    if (hasPlayableCard) {
      return;
    }

    autoPlayerTurnTimer.current = window.setTimeout(() => {
      autoPlayerTurnTimer.current = null;
      const currentState = stateRef.current;
      if (currentState.winner || currentState.activePlayerId !== "player" || currentState.phase !== "main") return;
      if (hasPlayablePlayerCard(currentState)) return;
      recordDebug({ source: "system", category: "turn", actionType: "AUTO_END_TURN", message: "Auto ending player turn: no legal moves remain.", before: createMatchDebugStateSummary(currentState) });
      void submitGameAction({ type: "END_TURN", playerId: "player" } as GameAction);
    }, AUTO_PLAYER_PASS_EMPTY_MS);

    return () => {
      clearTimer(autoPlayerTurnTimer);
    };
  }, [recordDebug, state, submitGameAction]);

  useEffect(() => {
    onlineActionUnsubscribe.current?.();
    onlineActionUnsubscribe.current = null;
    clearTimer(onlineActionPollTimer);

    if (!isOnlineMode || onlineQueueState !== "matched" || !onlineRoom?.id || !onlineSeat) return;

    processedOnlineActionIds.current = new Set();

    fetchOnlineMatchActions(onlineRoom.id)
      .then(processOnlineActionEvents)
      .catch((error: unknown) => {
        setUiLog((entries) => pushLimited(entries, `[WARN] Could not fetch online actions: ${error instanceof Error ? error.message : String(error)}`));
      });

    onlineActionUnsubscribe.current = subscribeToOnlineMatchActions(
      onlineRoom.id,
      (event: OnlineMatchActionEvent) => processOnlineActionEvents([event]),
      (error: unknown) => {
        setUiLog((entries) => pushLimited(entries, `[WARN] Online action realtime warning: ${error instanceof Error ? error.message : String(error)}`));
      },
    );

    const pollTimer = window.setInterval(() => {
      fetchOnlineMatchActions(onlineRoom.id)
        .then(processOnlineActionEvents)
        .catch(() => undefined);
    }, 2000);

    onlineActionPollTimer.current = pollTimer as unknown as number;

    return () => {
      onlineActionUnsubscribe.current?.();
      onlineActionUnsubscribe.current = null;
      clearTimer(onlineActionPollTimer);
    };
  }, [isOnlineMode, onlineQueueState, onlineRoom?.id, onlineSeat, processOnlineActionEvents]);

  useEffect(() => {
    if (!selectedCardId) return;

    const currentState = stateRef.current;
    const stillInHand = currentState.player.hand.some((card) => card.instanceId === selectedCardId);
    const stillPlayablePhase = currentState.activePlayerId === "player" && currentState.phase === "main" && !currentState.winner;

    if (!stillInHand || !stillPlayablePhase) {
      setSelectedCardId(null);
    }
  }, [selectedCardId, state.activePlayerId, state.phase, state.player.hand, state.winner]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape") {
        clearPendingPlay();
        setSelectedCardId(null);
        return;
      }

      if (event.key.toLowerCase() === "r") {
        const currentState = stateRef.current;
        if (currentState.activePlayerId === "player" && currentState.phase === "roll" && !currentState.winner) {
          event.preventDefault();
          handleRoll();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearPendingPlay, handleRoll]);

  const mergedLog = useMemo(() => [...state.log, ...uiLog].slice(-18), [state.log, uiLog]);

  if (isOnlineMode && onlineQueueState !== "matched") {
    return (
      <main className="matchPage onlineMatchmakingPage">
        <div className="matchBackdrop" aria-hidden="true" />
        <header className="matchHeader">
          <button className="matchBackButton" type="button" onClick={() => nav("/play")}>← Back to modes</button>
          <div>
            <span>Supabase PvP Beta</span>
            <h1>FRAKTUM Online</h1>
          </div>
        </header>

        <section className="onlineMatchmakingCard" role="status" aria-live="polite">
          <div className="onlineMatchmakingPulse" aria-hidden="true" />
          <span className="onlineMatchmakingKicker">Competitive Online</span>
          <h2>{onlineQueueState === "searching" ? "Ищем соперника" : onlineQueueState === "error" ? "Ошибка подключения" : "Онлайн-режим открыт"}</h2>
          <p>{onlineQueueMessage}</p>

          <div className="onlineMatchmakingMeta">
            <div><span>Account</span><b>{playerName}</b></div>
            <div><span>Deck</span><b>{deckIds.length}/20</b></div>
            <div><span>Server</span><b>{isOnlineMatchmakingConfigured() ? "Supabase" : "Not configured"}</b></div>
            <div><span>Room</span><b>{onlineRoom ? onlineRoom.id.slice(0, 8) : "—"}</b></div>
            <div><span>Seat</span><b>{onlineSeat ? onlineSeat.toUpperCase() : "—"}</b></div>
          </div>

          <div className="onlineMatchmakingActions">
            {onlineQueueState === "searching" ? (
              <button className="matchGhostButton" type="button" onClick={cancelOnlineSearch}>Cancel search</button>
            ) : (
              <button className="matchGoldButton" type="button" onClick={startOnlineSearch}>Search player</button>
            )}
            <button className="matchGhostButton" type="button" onClick={() => nav("/play")}>Back</button>
          </div>
        </section>
        <MatchDebugConsole
          enabled={debugRecorder.enabled}
          isOpen={debugRecorder.isOpen}
          onToggle={() => debugRecorder.setIsOpen((current) => !current)}
          events={debugRecorder.events}
          textLog={debugRecorder.textLog}
          exportSession={debugRecorder.exportSession}
          onSnapshot={debugRecorder.addSnapshot}
          onClearView={debugRecorder.clearView}
          previousSessions={debugRecorder.previousSessions}
          onRefreshPreviousSessions={debugRecorder.refreshPreviousSessions}
        />
      </main>
    );
  }

  return (
    <main className="matchPage">
      <div className="matchBackdrop" aria-hidden="true" />
      <header className="matchHeader">
        <button className="matchBackButton" type="button" onClick={() => nav("/play")}>← Back to modes</button>
        <div>
          <span>{isOnlineMode ? "Online PvP Beta" : "React / TypeScript Arena"}</span>
          <h1>{isOnlineMode ? "FRAKTUM Online Duel" : "FRAKTUM Duel"}</h1>
        </div>
      </header>
      <MatchBoard
        state={state}
        selectedCardId={selectedCardId}
        onSelectCard={setSelectedCardId}
        onRoll={handleRoll}
        onPlay={playCard}
        onInvalidDrop={handleInvalidDrop}
        logEntries={mergedLog}
        onEndTurn={handleEndTurn}
        onAiTurn={handleAiTurn}
        onRestart={handleRestart}
        onConcede={handleConcede}
        onReturnToMenu={handleReturnToMenu}
        reward={matchReward}
        aiThinking={aiThinking}
        fxEvents={fxEvents}
        cardTravelEvents={cardTravelEvents}
        tacticalRevealEvents={tacticalRevealEvents}
        matchMode={matchMode}
        opponentName={opponentUi.name}
        opponentRankLabel={opponentUi.rankLabel}
      />
      <MatchDebugConsole
        enabled={debugRecorder.enabled}
        isOpen={debugRecorder.isOpen}
        onToggle={() => debugRecorder.setIsOpen((current) => !current)}
        events={debugRecorder.events}
        textLog={debugRecorder.textLog}
        exportSession={debugRecorder.exportSession}
        onSnapshot={debugRecorder.addSnapshot}
        onClearView={debugRecorder.clearView}
        previousSessions={debugRecorder.previousSessions}
        onRefreshPreviousSessions={debugRecorder.refreshPreviousSessions}
      />
    </main>
  );
}
