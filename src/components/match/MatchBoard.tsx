import type { MatchState } from "../../game/core/types";
import { BattleLog } from "./BattleLog";
import { BoardSlot } from "./BoardSlot";
import { D20View } from "./D20View";
import { DeckPile } from "./DeckPile";
import { DiscardPile } from "./DiscardPile";
import { EnemyHandView } from "./EnemyHandView";
import { HandView } from "./HandView";
import { HeroPanel } from "./HeroPanel";

export function MatchBoard({ state, selectedCardId, onSelectCard, onRoll, onPlay, onInvalidDrop, onEndTurn, onAiTurn, logEntries }: { state: MatchState; selectedCardId: string | null; onSelectCard: (id: string | null) => void; onRoll: () => void; onPlay: (id: string, slotIndex: number) => void; onInvalidDrop: (message: string) => void; onEndTurn: () => void; onAiTurn: () => void; logEntries?: string[] }) {
  const canPlay = state.activePlayerId === "player" && state.phase === "main";
  const canRoll = state.activePlayerId === "player" && state.phase === "roll";

  return (
    <div className="matchArenaShell">
      <div className="matchArenaTopbar">
        <div>
          <span>Turn {state.turn}</span>
          <strong>{state.activePlayerId === "player" ? "Your initiative" : "Enemy initiative"}</strong>
        </div>
        <div className={`matchPhaseBadge is-${state.phase}`}>{state.winner ? `Winner: ${state.winner}` : state.phase}</div>
      </div>

      <div className="matchArenaGrid">
        <aside className="matchSideColumn is-left">
          <HeroPanel player={state.enemy} label="AI Opponent" alignment="left" />
          <div className="matchPileRow">
            <DeckPile count={state.enemy.deck.length} owner="enemy" />
            <DiscardPile cards={state.enemy.discard} owner="enemy" />
          </div>
        </aside>

        <main className="matchCenterColumn">
          <EnemyHandView count={state.enemy.hand.length} />

          <section className="matchBoardPanel">
            <div className="matchBoardRow is-enemy">
              {state.board.enemySlots.map((card, index) => <BoardSlot card={card} side="enemy" index={index} key={`enemy-${index}`} valid={canPlay && Boolean(selectedCardId)} />)}
            </div>

            <div className="matchBoardDivider">
              <span />
              <b>FRAKTUM FIELD</b>
              <span />
            </div>

            <div className="matchBoardRow is-player">
              {state.board.playerSlots.map((card, index) => <BoardSlot card={card} side="player" index={index} key={`player-${index}`} valid={canPlay && Boolean(selectedCardId)} />)}
            </div>
          </section>

          <div className="matchControlDock">
            <D20View value={state.lastRoll} onRoll={onRoll} disabled={!canRoll} />
            <div className="matchActionStack">
              <button className="matchGoldButton" type="button" onClick={onEndTurn} disabled={state.activePlayerId !== "player"}>End turn</button>
              <button className="matchGhostButton" type="button" onClick={onAiTurn} disabled={state.activePlayerId !== "enemy"}>Run AI</button>
            </div>
            <BattleLog entries={logEntries ?? state.log} />
          </div>
        </main>

        <aside className="matchSideColumn is-right">
          <HeroPanel player={state.player} label="Player" alignment="right" />
          <div className="matchPileRow">
            <DiscardPile cards={state.player.discard} owner="player" />
            <DeckPile count={state.player.deck.length} owner="player" />
          </div>
        </aside>
      </div>

      <HandView cards={state.player.hand} onPlay={onPlay} disabled={!canPlay} selectedId={selectedCardId} onSelect={onSelectCard} onInvalidDrop={onInvalidDrop} />
    </div>
  );
}
