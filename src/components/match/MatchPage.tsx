import { useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GameAction } from "../../game/core/GameAction";
import { createInitialMatchState, dispatch } from "../../game/engine/MatchEngine";
import { MatchBoard } from "./MatchBoard";
import "./match.css";

export default function MatchPage() {
  const nav = useNavigate();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [uiLog, setUiLog] = useState<string[]>([]);
  const [state, send] = useReducer((current: ReturnType<typeof createInitialMatchState>, action: GameAction) => dispatch(current, action), undefined, () => createInitialMatchState());

  const playCard = (cardInstanceId: string, slotIndex: number) => {
    setSelectedCardId(cardInstanceId);
    window.setTimeout(() => {
      send({ type: "PLAY_CARD", playerId: "player", cardInstanceId, target: { type: "slot", playerId: "player", slotIndex } });
      setSelectedCardId(null);
    }, 120);
  };

  const addUiLog = (message: string) => setUiLog((entries) => [...entries, message].slice(-6));

  return (
    <main className="matchPage">
      <div className="matchBackdrop" aria-hidden="true" />
      <header className="matchHeader">
        <button className="matchBackButton" type="button" onClick={() => nav("/play")}>← Back to modes</button>
        <div>
          <span>React / TypeScript Arena</span>
          <h1>FRAKTUM Duel</h1>
        </div>
      </header>
      <MatchBoard
        state={state}
        selectedCardId={selectedCardId}
        onSelectCard={setSelectedCardId}
        onRoll={() => send({ type: "ROLL_D20", playerId: "player" })}
        onPlay={playCard}
        onInvalidDrop={addUiLog}
        logEntries={[...state.log, ...uiLog]}
        onEndTurn={() => send({ type: "END_TURN", playerId: "player" })}
        onAiTurn={() => send({ type: "AI_TURN" })}
      />
    </main>
  );
}
