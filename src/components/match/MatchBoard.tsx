import type { CardInstance, MatchState } from "../../game/core/types";
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

type MatchSide = MatchState["player"];

type MatchBoardProps = {
  state: MatchState;
  selectedCardId: string | null;
  onSelectCard: (id: string | null) => void;
  onRoll: () => void;
  onPlay: (id: string, slotIndex: number) => void;
  onInvalidDrop: (message: string) => void;
  onEndTurn: () => void;
  onAiTurn: () => void;
  onRestart: () => void;
  onConcede: () => void;
  onReturnToMenu: () => void;
  reward?: MatchRewardResult | null;
  aiThinking?: boolean;
  logEntries?: string[];
  fxEvents?: MatchFxEvent[];
  cardTravelEvents?: CardTravelEvent[];
  tacticalRevealEvents?: TacticalRevealEvent[];
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

function readDefinitionNumber(card: CardInstance | undefined | null, keys: string[], fallback = 0) {
  const definition = card?.definition as unknown as Record<string, unknown> | undefined;
  if (!definition) return fallback;

  for (const key of keys) {
    const value = definition[key];
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
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

function getCardCost(card: CardInstance | undefined | null) {
  return Math.max(0, Math.floor(readDefinitionNumber(card, ["cost", "willCost"], 0)));
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
) {
  if (state.winner) return "Match ended. Restart to play again.";
  if (state.activePlayerId === "enemy") return aiThinking ? "AI turn is resolving automatically." : "Enemy initiative is ready.";
  if (state.phase === "roll") return "Click D20 or press R.";
  if (state.phase !== "main") return "Wait for your main phase.";

  if (!selectedCard) return "Drag a card to an empty lower slot.";

  const cost = getCardCost(selectedCard);
  if (state.player.will < cost) {
    return `${getCardTitle(selectedCard)} needs ${cost} Will.`;
  }

  return `${getCardTitle(selectedCard)} selected. Drop it on a lower slot.`;
}

function WillStrip({ player, label, side }: { player: MatchSide; label: string; side: "player" | "enemy" }) {
  const max = Math.max(1, player.maxWill);
  const pct = clampPct(player.will, max);

  return (
    <div className={`matchWillStrip is-${side}`} title={`${label} Will: ${player.will}/${max}`}>
      <span className="matchWillLabel">{label} Will</span>
      <div className="matchWillTrack" aria-hidden="true">
        <span className="matchWillFill" style={{ width: `${pct}%` }} />
      </div>
      <b>{player.will}/{max}</b>
    </div>
  );
}

export function MatchBoard({
  state,
  selectedCardId,
  onSelectCard,
  onRoll,
  onPlay,
  onInvalidDrop,
  onEndTurn,
  onAiTurn,
  onRestart,
  onConcede,
  onReturnToMenu,
  reward = null,
  aiThinking = false,
  logEntries,
  fxEvents = [],
  cardTravelEvents = [],
  tacticalRevealEvents = [],
}: MatchBoardProps) {
  const selectedCard = state.player.hand.find((card) => card.instanceId === selectedCardId);
  const canPlay = state.activePlayerId === "player" && state.phase === "main" && !state.winner;
  const canRoll = state.activePlayerId === "player" && state.phase === "roll" && !state.winner;
  const selectedCardIsPlayable = Boolean(selectedCard && canPlay && state.player.will >= getCardCost(selectedCard));
  const playerName = getHeroName(state.player, "Brian");
  const enemyName = getHeroName(state.enemy, "Felix");
  const readablePhase = getPhaseLabel(state);
  const actionHint = getActionHint(state, selectedCard, aiThinking);
  const winnerLabel = getWinnerLabel(state.winner, playerName, enemyName);

  void onEndTurn;
  void onAiTurn;

  const arenaClassName = [
    "matchArenaShell",
    canRoll ? "can-roll" : "",
    canPlay ? "can-play" : "",
    selectedCardIsPlayable ? "can-drop-card" : "",
    aiThinking ? "is-ai-thinking" : "",
    state.winner ? "is-match-ended" : "",
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

      <section className="matchOpponentProfile" aria-label="Opponent profile">
        <div>
          <span>Opponent</span>
          <b>{enemyName}</b>
          <small>AI Rank III</small>
        </div>
        <img src={getHeroImage(state.enemy)} alt={enemyName} draggable={false} />
      </section>

      <section className="matchEnemyArc" aria-label="Enemy hand area">
        <div className="matchEnemyArcLine" aria-hidden="true" />
        <EnemyHandView count={state.enemy.hand.length} />
      </section>

      <aside className="matchSideColumn matchPlayerZone" aria-label="Player character zone">
        <HeroPanel player={state.player} label={playerName} alignment="left" />
      </aside>

      <aside className="matchSideColumn matchEnemyZone" aria-label="Enemy character zone">
        <HeroPanel player={state.enemy} label={enemyName} alignment="right" />
      </aside>

      <main className="matchFieldZone" aria-label="Central battlefield">
        <WillStrip player={state.enemy} label="Enemy" side="enemy" />

        <section className="matchBoardPanel" data-drop-ready={selectedCardIsPlayable ? "true" : "false"}>
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
              />
            ))}
          </div>
        </section>
      </main>

      <section className="matchPlayerWillZone" aria-label="Player will">
        <WillStrip player={state.player} label="Player" side="player" />
      </section>

      <section className="matchD20Zone" aria-label="D20 roll zone">
        <D20View value={state.lastRoll} onRoll={onRoll} disabled={!canRoll} />
      </section>

      <section className="matchPlayerActionZone is-auto-flow" aria-label="Match controls">
        <div className="matchActionStatus">
          <span>{state.winner ? "Result" : "Auto flow"}</span>
          <b>{actionHint}</b>
        </div>

        <div className="matchActionRow">
          <button className="matchGhostButton is-compact" type="button" onClick={onRestart}>
            Restart
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
        <DeckPile count={state.player.deck.length} owner="player" />
        <DiscardPile cards={state.player.discard} owner="player" />
      </section>

      <section className="matchPlayerHandZone" aria-label="Player hand area">
        <HandView
          cards={state.player.hand}
          onPlay={onPlay}
          disabled={!canPlay}
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
