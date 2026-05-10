import { useEffect, useReducer, useRef, useState } from "react";
import { useGameStore } from "../../useGameStore";
import { getNextAiAction } from "../../game/match/ai";
import { matchReducer } from "../../game/match/reducer";
import { createInitialMatch } from "../../game/match/setup";

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useMatchController() {
  const ownedCards = useGameStore((store) => store.ownedCards);
  const deckIds = useGameStore((store) => store.deckIds);

  const [state, dispatch] = useReducer(
    matchReducer,
    null,
    () => createInitialMatch(ownedCards, deckIds)
  );
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [diceRollingOwner, setDiceRollingOwner] = useState<"player" | "ai" | null>(null);
  const stateRef = useRef(state);
  const handledTurnIntroRef = useRef<string>("");

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (state.phase !== "turn_intro" || state.winner) return undefined;

    const introKey = `${state.matchId}:${state.activePlayer}:${state.round}`;
    if (handledTurnIntroRef.current === introKey) return undefined;
    handledTurnIntroRef.current = introKey;

    let cancelled = false;
    const warmupTimeout = window.setTimeout(() => {
      if (cancelled) return;
      setDiceRollingOwner(state.activePlayer);
      setDiceValue(Math.floor(Math.random() * 20) + 1);
    }, 0);

    const intervalId = window.setInterval(() => {
      if (cancelled) return;
      setDiceValue(Math.floor(Math.random() * 20) + 1);
    }, 70);

    const settleTimeout = window.setTimeout(() => {
      if (cancelled) return;
      window.clearInterval(intervalId);
      const finalRoll = Math.floor(Math.random() * 20) + 1;
      setDiceValue(finalRoll);
      window.setTimeout(() => {
        if (cancelled) return;
        dispatch({ type: "APPLY_ROLL", owner: state.activePlayer, roll: finalRoll });
        setDiceRollingOwner(null);
      }, 240);
    }, 900);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.clearTimeout(warmupTimeout);
      window.clearTimeout(settleTimeout);
    };
  }, [state.activePlayer, state.matchId, state.phase, state.round, state.winner]);

  useEffect(() => {
    if (state.phase !== "ai_turn" || state.activePlayer !== "ai" || state.winner) return undefined;

    let cancelled = false;

    const runAi = async () => {
      await sleep(450);

      while (!cancelled) {
        const nextAction = getNextAiAction(stateRef.current);
        dispatch(nextAction);
        if (nextAction.type === "END_TURN") {
          break;
        }
        await sleep(480);
      }
    };

    void runAi();

    return () => {
      cancelled = true;
    };
  }, [state.activePlayer, state.phase, state.winner]);

  return {
    state,
    diceValue,
    diceRollingOwner,
    actions: {
      playHandCard(cardInstanceId: string) {
        if (state.activePlayer !== "player" || state.phase !== "player_turn") return;
        dispatch({ type: "PLAY_CARD", owner: "player", source: "hand", cardInstanceId });
      },
      playGraveyardCard(cardInstanceId: string) {
        if (state.activePlayer !== "player" || state.phase !== "player_turn") return;
        dispatch({ type: "PLAY_CARD", owner: "player", source: "graveyard", cardInstanceId });
      },
      playBlindEnemyCard() {
        if (state.activePlayer !== "player" || state.phase !== "player_turn") return;
        if (!state.turn.enemyDeckPlayCardId) return;
        dispatch({
          type: "PLAY_CARD",
          owner: "player",
          source: "enemy_deck",
          cardInstanceId: state.turn.enemyDeckPlayCardId,
        });
      },
      playAwakeningFreeCard(source: "hand" | "graveyard", cardInstanceId: string) {
        if (state.activePlayer !== "player" || state.phase !== "player_turn") return;
        dispatch({
          type: "PLAY_CARD",
          owner: "player",
          source,
          cardInstanceId,
          free: true,
        });
      },
      useAwakeningPassive() {
        if (state.activePlayer !== "player" || state.phase !== "player_turn") return;
        dispatch({ type: "USE_AWAKENING_PASSIVE", owner: "player" });
      },
      attack(attackerId: string, target: { kind: "hero" } | { kind: "unit"; unitId: string }) {
        if (state.activePlayer !== "player" || state.phase !== "player_turn") return;
        dispatch({ type: "ATTACK", owner: "player", attackerId, target });
      },
      endTurn() {
        if (state.activePlayer !== "player" || state.phase !== "player_turn") return;
        dispatch({ type: "END_TURN", owner: "player" });
      },
    },
  };
}
