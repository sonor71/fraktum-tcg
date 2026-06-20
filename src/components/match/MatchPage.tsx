import { useReducer, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GameAction } from "../../game/core/GameAction";
import { createInitialMatchState, dispatch } from "../../game/engine/MatchEngine";
import { MatchBoard } from "./MatchBoard";
import "./match.css";

export default function MatchPage() {
  const nav = useNavigate();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [state, send] = useReducer((current: ReturnType<typeof createInitialMatchState>, action: GameAction) => dispatch(current, action), undefined, () => createInitialMatchState());

  const playCard = (cardInstanceId: string) => {
    setSelectedCardId(cardInstanceId);
    window.setTimeout(() => {
      send({ type: "PLAY_CARD", playerId: "player", cardInstanceId });
      setSelectedCardId(null);
    }, 120);
  };

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
        onEndTurn={() => send({ type: "END_TURN", playerId: "player" })}
        onAiTurn={() => send({ type: "AI_TURN" })}
      />
    </main>
  );
}
