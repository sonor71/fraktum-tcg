import { useReducer } from "react";
import { useNavigate } from "react-router-dom";
import { createInitialMatchState, dispatch } from "../../game/engine/MatchEngine";
import type { GameAction } from "../../game/core/GameAction";
import { MatchBoard } from "./MatchBoard";
import "./match.css";
export default function MatchPage() { const nav = useNavigate(); const [state, send] = useReducer((s: ReturnType<typeof createInitialMatchState>, a: GameAction) => dispatch(s, a), undefined, () => createInitialMatchState()); return <main className="tsMatchPage"><header><button type="button" onClick={() => nav("/play")}>Back</button><h1>FRAKTUM React Match</h1></header><MatchBoard state={state} onRoll={() => send({ type: "ROLL_D20", playerId: "player" })} onPlay={(cardInstanceId) => send({ type: "PLAY_CARD", playerId: "player", cardInstanceId })} onEndTurn={() => send({ type: "END_TURN", playerId: "player" })} onAiTurn={() => send({ type: "AI_TURN" })} /></main>; }
