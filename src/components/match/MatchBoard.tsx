import { useState } from "react";
import type { CardInstance, MatchState } from "../../game/core/types";
import { canPlayCardWithCurrentResources, getEffectiveCardCost } from "../../game/engine/TurnManager";
import { BattleLog } from "./BattleLog";
import { BoardSlot } from "./BoardSlot";
import { D20View } from "./D20View";
import { DeckPile } from "./DeckPile";
import { DiscardPile } from "./DiscardPile";
import { EnemyHandView } from "./EnemyHandView";
import { HandView } from "./HandView";
import { HeroPanel } from "./HeroPanel";
import { MatchFxLayer, type MatchFxEvent } from "./MatchFxLayer";
import { CardTravelLayer, type CardTravelEvent } from "./CardTravelLayer";
import type { MatchRewardResult } from "../../useGameStore";
import { TacticalRevealLayer, type TacticalRevealEvent } from "./TacticalRevealLayer";
import {
  MatchPresentationLayer,
  type MatchRoulettePresentation,
  type MatchTurnAnnouncement,
} from "./MatchPresentationLayer";
import { FateRouletteOverlay } from "./FateRouletteOverlay";

type MatchSide = MatchState["player"];

type MatchBoardProps = {
  state: MatchState;
  selectedCardId: string | null;
  onSelectCard: (id: string | null) => void;
  onRoll: () => void;
  onPlay: (id: string, slotIndex: number) => void;
  onPlayTopCard: () => void;
  onInvalidDrop: (message: string) => void;
  onEndTurn: () => void;
  onAiTurn: () => void;
  onRestart: () => void;
  onStartNextBattle: () => void;
  onConcede: () => void;
  onReturnToMenu: () => void;
  reward?: MatchRewardResult | null;
  aiThinking?: boolean;
  logEntries?: string[];
  fxEvents?: MatchFxEvent[];
  cardTravelEvents?: CardTravelEvent[];
  tacticalRevealEvents?: TacticalRevealEvent[];
  matchMode?: "ai" | "online" | string;
  opponentName?: string | null;
  opponentRankLabel?: string | null;
  turnAnnouncement?: MatchTurnAnnouncement | null;
  roulettePresentation?: MatchRoulettePresentation | null;
  interactionLocked?: boolean;
  onRoulettePresentationComplete?: () => void;
  onRouletteSpin: (rouletteId: string) => void;
  onRouletteReveal: (rouletteId: string, revealedAtMs: number) => void;
  onRouletteConfirm: (rouletteId: string) => void;
  onChooseAwakening: (choice: "freeCard" | "passive") => void;
};

function clampPct(value: number, max: number) {
  const safeMax = Math.max(1, max);
  return Math.max(0, Math.min(100, (value / safeMax) * 100));
}

function readDefinitionText(card: CardInstance | undefined | null, keys: string[], fallback = "Card") {
  const definition = card?.definition as unknown as Record<string, unknown> | undefined;
  if (!definition) return fallback;

  for (const key of keys) {
    const value = definition[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }

  return fallback;
}

function getHeroName(player: MatchSide, fallback: string) {
  return readDefinitionText(player.hero, ["title", "ruTitle", "name"], fallback);
}

function getHeroImage(player: MatchSide) {
  return readDefinitionText(player.hero, ["image", "imageUrl", "src", "path"], "/cards/card-back.png");
}

function getCardTitle(card: CardInstance | undefined | null) {
  if (!card) return "Card";
  return readDefinitionText(card, ["title", "ruTitle", "name"], card.baseId || "Card");
}

function getPhaseLabel(state: MatchState) {
  if (state.winner) return `Winner: ${state.winner}`;

  switch (state.phase) {
    case "roll":
      return "Roll phase";
    case "main":
      return "Main phase";
    case "enemy":
      return "Enemy phase";
    case "ended":
      return "Match ended";
    default:
      return String(state.phase);
  }
}

function getInitiativeLabel(state: MatchState, aiThinking: boolean) {
  if (state.winner) return "Match finished";
  if (state.activePlayerId === "enemy" && aiThinking) return "AI is thinking";
  return state.activePlayerId === "player" ? "Your initiative" : "Enemy initiative";
}

function getWinnerLabel(winner: MatchState["winner"], playerName: string, enemyName: string) {
  if (!winner) return "Match finished";
  if (winner === "draw") return "Draw";
  if (winner === "player") return `${playerName} wins`;
  if (winner === "enemy") return `${enemyName} wins`;
  return `${winner} wins`;
}

function getActionHint(
  state: MatchState,
  selectedCard: CardInstance | undefined,
  aiThinking: boolean,
  interactionLocked: boolean,
) {
  if (state.winner) return "Match ended. Restart to play again.";
  if (interactionLocked) return "Дождитесь завершения экранного события.";
  if (state.activePlayerId === "enemy") return aiThinking ? "AI turn is resolving automatically." : "Enemy initiative is ready.";
  if (state.phase === "roll") return "Click D20 or press R.";
  if (state.phase !== "main") return "Wait for your main phase.";
  if (state.activeRouletteEvent === "BLIND_TOP") return "Blind Top: click your deck to play its top card.";
  if (state.activeRouletteEvent === "HIDDEN_HAND") return "Hidden Hand: choose and play a face-down card without seeing it.";

  if (!selectedCard) return "Drag a card to an empty lower slot.";

  const cost = getEffectiveCardCost(state, "player", selectedCard);
  if (state.player.will < cost) {
    return `${getCardTitle(selectedCard)} needs ${cost} Will.`;
  }

  return `${getCardTitle(selectedCard)} selected. Drop it on a lower slot.`;
}

function WillStrip({ player, label, side }: { player: MatchSide; label: string; side: "player" | "enemy" }) {
  const max = Math.max(1, player.maxWill);
  const isHiddenEnemyWill = side === "enemy";
  const pct = isHiddenEnemyWill ? 0 : clampPct(player.will, max);

  return (
    <div className={`matchWillStrip is-${side}`} title={`${label} Will: ${isHiddenEnemyWill ? `hidden/${max}` : `${player.will}/${max}`}`}>
      <span className="matchWillLabel">{label} Will</span>
      <div className="matchWillTrack" aria-hidden="true">
        <span className="matchWillFill" style={{ width: `${pct}%` }} />
      </div>
      <b>{isHiddenEnemyWill ? `?/${max}` : `${player.will}/${max}`}</b>
    </div>
  );
}

export function MatchBoard({
  state,
  selectedCardId,
  onSelectCard,
  onRoll,
  onPlay,
  onPlayTopCard,
  onInvalidDrop,
  onEndTurn,
  onAiTurn,
  onRestart,
  onStartNextBattle,
  onConcede,
  onReturnToMenu,
  reward = null,
  aiThinking = false,
  logEntries,
  fxEvents = [],
  cardTravelEvents = [],
  tacticalRevealEvents = [],
  matchMode = "ai",
  opponentName = null,
  opponentRankLabel = null,
  turnAnnouncement = null,
  roulettePresentation = null,
  interactionLocked = false,
  onRoulettePresentationComplete = () => undefined,
  onRouletteSpin,
  onRouletteReveal,
  onRouletteConfirm,
  onChooseAwakening,
}: MatchBoardProps) {
  const [showD20Help, setShowD20Help] = useState(false);
  const selectedCard = state.player.hand.find((card) => card.instanceId === selectedCardId);
  const isBetweenBattles = state.phase === "betweenBattles" && !state.winner;
  const canPlay = state.activePlayerId === "player" && state.phase === "main" && !state.winner && !interactionLocked;
  const canRoll = state.activePlayerId === "player" && state.phase === "roll" && !state.winner && !interactionLocked;
  const blindTopActive = canPlay && state.activeRouletteEvent === "BLIND_TOP";
  const hiddenHandActive = state.activeRouletteEvent === "HIDDEN_HAND";
  const topDeckCard = blindTopActive ? state.player.deck[0] : undefined;
  const canPlayTopCard = Boolean(topDeckCard && canPlayCardWithCurrentResources(state, "player", topDeckCard));
  const selectedCardIsPlayable = Boolean(
    selectedCard &&
    canPlay &&
    !blindTopActive &&
    state.player.will >= getEffectiveCardCost(state, "player", selectedCard),
  );
  const playerName = getHeroName(state.player, "Brian");
  const isOnlineMode = matchMode === "online";
  const enemyName = isOnlineMode && opponentName?.trim() ? opponentName.trim() : getHeroName(state.enemy, "Felix");
  const enemyRankLabel = isOnlineMode ? (opponentRankLabel?.trim() || "RANK III") : "AI Rank III";
  const readablePhase = getPhaseLabel(state);
  const actionHint = getActionHint(state, selectedCard, aiThinking, interactionLocked);
  const winnerLabel = getWinnerLabel(state.winner, playerName, enemyName);
  const battleResultTitle = state.battleResult === "player" ? "ПОБЕДА" : state.battleResult === "enemy" ? "ПОРАЖЕНИЕ" : "НИЧЬЯ";
  const seriesScore = state.seriesScore ?? { player: 0, enemy: 0 };\n  const battleNumber = Math.max(1, Math.min(3, state.battleNumber ?? 1));
  const specialSourceCard = state.currentTurn?.discardPlayAvailable
    ? state.player.discard.at(-1)
    : state.currentTurn?.enemyDeckPlayCardId
      ? state.enemy.deck.find((card) => card.instanceId === state.currentTurn?.enemyDeckPlayCardId)
      : undefined;
  const specialSlotIndex = state.board.playerSlots.findIndex((slot) => !slot);
  const d20RuleText = state.lastRoll == null ? "БРОСЬ D20" : state.lastRoll <= 10
    ? `МОЖНО СЫГРАТЬ ДО ${state.lastRoll} КАРТ`
    : state.lastRoll <= 14 ? "МОЖНО СЫГРАТЬ 1 КАРТУ ИЗ СБРОСА"
    : state.lastRoll <= 16 ? "РУЛЕТКА СУДЬБЫ"
    : state.lastRoll <= 18 ? "БЕЗЛИМИТ КАРТ · WILL ×2"
    : state.lastRoll === 19 ? "КАРТА ИЗ КОЛОДЫ СОПЕРНИКА"
    : "ПРОБУЖДЕНИЕ";

  void onAiTurn;

  const arenaClassName = [
    "matchArenaShell",
    canRoll ? "can-roll" : "",
    canPlay ? "can-play" : "",
    selectedCardIsPlayable ? "can-drop-card" : "",
    aiThinking ? "is-ai-thinking" : "",
    state.winner ? "is-match-ended" : "",
    isBetweenBattles ? "is-between-battles" : "",
    state.activeRouletteEvent ? `is-roulette-${state.activeRouletteEvent.toLowerCase().replace(/_/g, "-")}` : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={arenaClassName}
      data-phase={state.phase}
      data-active-player={state.activePlayerId}
      data-winner={state.winner ?? "none"}
      aria-busy={aiThinking ? "true" : "false"}
    >
      <div className="matchArenaFrame" aria-hidden="true" />

      <MatchPresentationLayer
        turnAnnouncement={turnAnnouncement}
        roulettePresentation={roulettePresentation}
        opponentName={enemyName}
        isOnlineMode={isOnlineMode}
        onRouletteComplete={onRoulettePresentationComplete}
      />
      {state.rouletteState ? (
        <FateRouletteOverlay
          roulette={state.rouletteState}
          localPlayerId="player"
          onSpin={onRouletteSpin}
          onReveal={onRouletteReveal}
          onConfirm={onRouletteConfirm}
        />
      ) : null}

      <div className="matchArenaTopbar">
        <div className="matchTurnBlock">
          <span>Round {state.turn}</span>
          <strong>{getInitiativeLabel(state, aiThinking)}</strong>
        </div>

        <div className={`matchPhaseBadge is-${state.phase}`}>{readablePhase}</div>

        <div className="matchTurnBlock is-right">
          <span>Last D20</span>
          <strong>{state.lastRoll ?? "—"}</strong>
        </div>
      </div>
      <section className="matchSeriesHud" aria-label="Match series progress">
        <span>МАТЧ ДО 2 ПОБЕД</span>
        <b>БОЙ {battleNumber} ИЗ 3</b>
        <strong>{playerName} {seriesScore.player} : {seriesScore.enemy} {enemyName}</strong>
        <small>ЦЕЛЬ: ПЕРВЫМ ВЫИГРАТЬ 2 БОЯ</small>
      </section>

      <section className="matchMobileHud" aria-label="Mobile match status">
        <div className="matchMobileHudSide is-enemy">
          <span>{enemyName}</span>
          <b>HP {state.enemy.hp}</b>
          <small>WILL ?/{state.enemy.maxWill} · HAND {state.enemy.hand.length}</small>
        </div>
        <div className="matchMobileHudCenter">
          <span>ROUND {state.turn}</span>
          <b>{state.activePlayerId === "player" ? "ТВОЙ ХОД" : "ХОД СОПЕРНИКА"}</b>
          <small>{readablePhase} · D20 {state.lastRoll ?? "—"}</small>
        </div>
        <div className="matchMobileHudSide is-player">
          <span>{playerName}</span>
          <b>HP {state.player.hp} · WILL {state.player.will}/{state.player.maxWill}</b>
          <small>DECK {state.player.deck.length} · DISCARD {state.player.discard.length}</small>
        </div>
      </section>

      <div className="matchContextBanner" role="status" aria-live="polite">
        <strong>{d20RuleText}</strong>
        <span>КАРТЫ: {state.currentTurn?.cardsPlayed ?? 0} / {state.currentTurn?.d20Limit ?? "—"} · WILL: {state.player.will} / {state.player.maxWill}{state.currentTurn?.willCostMultiplier === 2 ? " · ×2 COST" : ""}</span>
      </div>
      {state.lastRoll === 20 && state.currentTurn && !state.currentTurn.awakeningChoice ? <div className="matchAwakeningChoice"><b>ПРОБУЖДЕНИЕ</b><button type="button" onClick={() => onChooseAwakening("freeCard")}>СЫГРАТЬ КАРТУ БЕСПЛАТНО</button><button type="button" disabled={!state.currentTurn.awakeningPassiveAvailable} onClick={() => onChooseAwakening("passive")}>АКТИВИРОВАТЬ ПАССИВКУ</button></div> : null}
      {specialSourceCard ? <button className="matchSpecialSourceAction" type="button" disabled={specialSlotIndex < 0} onClick={() => onPlay(specialSourceCard.instanceId, Math.max(0, specialSlotIndex))}>{state.currentTurn?.discardPlayAvailable ? `СЫГРАТЬ ИЗ СБРОСА: ${getCardTitle(specialSourceCard)}` : "СЫГРАТЬ СЛУЧАЙНУЮ КАРТУ СОПЕРНИКА"}</button> : null}

      {state.activeRouletteEvent ? (
        <div className="matchRouletteNotice" role="status" aria-live="polite">
          <span>FATE ROULETTE</span>
          <b>{state.activeRouletteEvent.replace(/_/g, " ")}</b>
        </div>
      ) : null}

      <section className="matchOpponentProfile" aria-label="Opponent profile">
        <div>
          <span>Opponent</span>
          <b>{enemyName}</b>
          <small>{enemyRankLabel}</small>
        </div>
        <img src={getHeroImage(state.enemy)} alt={enemyName} draggable={false} />
      </section>

      <section className="matchEnemyArc" aria-label="Enemy hand area">
        <div className="matchEnemyArcLine" aria-hidden="true" />
        <EnemyHandView count={state.enemy.hand.length} />
      </section>

      <aside className="matchSideColumn matchPlayerZone" aria-label="Player character zone" data-tutorial-id="player-hero">
        <HeroPanel player={state.player} label={playerName} alignment="left" />
      </aside>

      <aside className="matchSideColumn matchEnemyZone" aria-label="Enemy character zone" data-tutorial-id="enemy-hero">
        <HeroPanel player={state.enemy} label={enemyName} alignment="right" />
      </aside>

      <main className="matchFieldZone" aria-label="Central battlefield">
        <WillStrip player={state.enemy} label="Enemy" side="enemy" />

        <section className="matchBoardPanel" data-drop-ready={selectedCardIsPlayable ? "true" : "false"} data-tutorial-id="field">
          <div className="matchBoardRow is-enemy">
            {state.board.enemySlots.map((card, index) => (
              <BoardSlot
                card={card}
                side="enemy"
                index={index}
                key={`enemy-${index}`}
                valid={false}
              />
            ))}
          </div>

          <div className="matchBoardDivider">
            <span />
            <b>FRAKTUM FIELD</b>
            <span />
          </div>

          <div className="matchBoardRow is-player">
            {state.board.playerSlots.map((card, index) => (
              <BoardSlot
                card={card}
                side="player"
                index={index}
                key={`player-${index}`}
                valid={selectedCardIsPlayable}
                onActivate={(slotIndex) => { if (selectedCardId) onPlay(selectedCardId, slotIndex); }}
              />
            ))}
          </div>
        </section>
      </main>

      <section className="matchPlayerWillZone" aria-label="Player will" data-tutorial-id="will">
        <WillStrip player={state.player} label="Player" side="player" />
      </section>

      <section className="matchD20Zone" aria-label="D20 roll zone" data-tutorial-id="d20">
        <D20View value={state.lastRoll} onRoll={onRoll} disabled={!canRoll} />
        <button className="matchD20HelpButton" type="button" onClick={() => setShowD20Help(true)} aria-label="Правила D20">?</button>
      </section>
      {showD20Help ? <section className="matchD20Help" role="dialog" aria-modal="true"><header><b>D20 RULES</b><button onClick={() => setShowD20Help(false)}>×</button></header><dl><dt>1–10</dt><dd>До N карт</dd><dt>11–14</dt><dd>Карта из сброса</dd><dt>15–16</dt><dd>Рулетка Судьбы</dd><dt>17–18</dt><dd>Безлимит · Will ×2</dd><dt>19</dt><dd>Карта противника</dd><dt>20</dt><dd>Пробуждение</dd></dl></section> : null}

      <section className="matchPlayerActionZone is-auto-flow" aria-label="Match controls">
        <div className="matchActionStatus">
          <span>{state.winner ? "Result" : "Auto flow"}</span>
          <b>{actionHint}</b>
        </div>

        <div className="matchActionRow">
          {!isBetweenBattles ? (
            <button className="matchGhostButton is-compact is-restart" type="button" onClick={onRestart}>
              Restart
            </button>
          ) : null}
          <button className="matchGhostButton is-compact is-end-turn" data-tutorial-id="end-turn" type="button" onClick={onEndTurn} disabled={!canPlay}>
            End Turn
          </button>
          <button className="matchGhostButton is-compact is-danger" type="button" onClick={onConcede} disabled={Boolean(state.winner)}>
            Concede
          </button>
        </div>
      </section>

      <section className="matchLogZone" aria-label="Battle log">
        <BattleLog entries={logEntries ?? state.log} />
      </section>

      <section className="matchEnemyPiles" aria-label="Enemy piles">
        <DeckPile count={state.enemy.deck.length} owner="enemy" />
        <DiscardPile cards={state.enemy.discard} owner="enemy" />
      </section>

      <section className="matchPlayerPiles" aria-label="Player piles">
        <DeckPile
          count={state.player.deck.length}
          owner="player"
          onActivate={blindTopActive ? onPlayTopCard : undefined}
          disabled={blindTopActive && !canPlayTopCard}
          actionLabel={blindTopActive ? (canPlayTopCard ? "PLAY TOP" : "TOP BLOCKED") : undefined}
        />
        <DiscardPile cards={state.player.discard} owner="player" />
      </section>

      <section className="matchPlayerHandZone" aria-label="Player hand area" data-tutorial-id="hand">
        <HandView
          cards={state.player.hand}
          onPlay={onPlay}
          disabled={!canPlay || blindTopActive}
          hidden={hiddenHandActive}
          selectedId={selectedCardId}
          onSelect={onSelectCard}
          onInvalidDrop={onInvalidDrop}
        />
      </section>

      <MatchFxLayer events={fxEvents} />
      <CardTravelLayer events={cardTravelEvents} />
      <TacticalRevealLayer events={tacticalRevealEvents} />

      {aiThinking ? (
        <div className="matchAiThinkingVeil" aria-hidden="true">
          <span />
        </div>
      ) : null}

      {isBetweenBattles ? (
        <section className="matchWinnerOverlay matchBattleResultOverlay" role="dialog" aria-modal="true" aria-live="assertive">
          <div className="matchWinnerCard is-rewarded">
            <span>БОЙ {state.battleNumber ?? 1} ЗАВЕРШЁН</span>
            <h2>{battleResultTitle}</h2>
            <div className="matchBattleResultScore" aria-label="Series score">
              <b>{playerName}</b>
              <strong>{seriesScore.player} — {seriesScore.enemy}</strong>
              <b>{enemyName}</b>
            </div>
            {state.battleEndReason ? (
              <p>Причина: {state.battleEndReason}</p>
            ) : null}
            <p>Победитель боя: {state.battleResult === "player" ? playerName : state.battleResult === "enemy" ? enemyName : "ничья"}</p>
            <div className="matchWinnerActions">
              <button className="matchGoldButton" type="button" onClick={onStartNextBattle}>
                СЛЕДУЮЩИЙ БОЙ
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {state.winner ? (
        <section className="matchWinnerOverlay" role="dialog" aria-modal="true" aria-live="assertive">
          <div className="matchWinnerCard is-rewarded">
            <span>Match result</span>
            <h2>{winnerLabel}</h2>
            <p>{state.winner === "draw" ? "Both heroes fell. Rewards were calculated as a draw." : "The duel is finished. Rewards were added to your profile."}</p>

            {reward ? (
              <div className={`matchRewardPanel is-${reward.outcome}`} aria-label="Match rewards">
                <div className="matchRewardOutcome">
                  <span>{reward.outcome === "win" ? "Victory rewards" : reward.outcome === "loss" ? "Defeat rewards" : "Draw rewards"}</span>
                  <b>{reward.outcome === "win" ? "x1" : reward.outcome === "loss" ? "x0.2" : "x0.5"}</b>
                </div>

                <div className="matchRewardGrid">
                  <div>
                    <span>XP</span>
                    <b>+{reward.xp}</b>
                  </div>
                  <div>
                    <span>Coins</span>
                    <b>+{reward.coins}</b>
                  </div>
                  <div>
                    <span>Level</span>
                    <b>{reward.levelBefore} → {reward.levelAfter}</b>
                  </div>
                </div>

                <div className="matchRewardXpBar" title={`XP ${reward.xpAfter}/${reward.xpForNextAfter}`}>
                  <span style={{ width: `${Math.max(0, Math.min(100, (reward.xpAfter / Math.max(1, reward.xpForNextAfter)) * 100))}%` }} />
                </div>

                <div className="matchRewardFooter">
                  <span>{reward.leveledUp ? "LEVEL UP" : `Next level: ${reward.xpAfter}/${reward.xpForNextAfter} XP`}</span>
                  <b>Total Coins: {reward.coinsAfter}</b>
                </div>
              </div>
            ) : (
              <div className="matchRewardPanel is-loading">
                <span>Rewards are being calculated...</span>
              </div>
            )}

            <div className="matchWinnerActions">
              <button className="matchGoldButton" type="button" onClick={onReturnToMenu}>
                Claim & return to modes
              </button>
              <button className="matchGhostButton" type="button" onClick={onRestart}>
                New match
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
