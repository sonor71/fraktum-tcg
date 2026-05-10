import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { applyMatchResult, createMatchPayload, launchUnityMatch, MATCH_PAYLOAD_KEY, pollMatchResult, simulateMatchResult, UNITY_MATCH_PATH } from "../services/matchBridge";
import { useGameStore } from "../useGameStore";

export default function MatchLauncher() {
  const nav = useNavigate();
  const playerName = useGameStore((state) => state.playerName);
  const deckIds = useGameStore((state) => state.deckIds);
  const ownedCards = useGameStore((state) => state.ownedCards);
  const applyProgress = useGameStore((state) => state.applyMatchResultToProgress);
  const [message, setMessage] = useState("");
  const valid = deckIds.length >= 10;
  const previewPayload = useMemo(() => ({ playerName, deckIds, mode: "demo", enemyId: "demo_ai", startedAt: "created on launch" }), [deckIds, playerName]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const result = pollMatchResult();
      if (result) setMessage(`Pending result: ${result.result}, ${result.xp} XP, ${result.coins} coins`);
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  function prepareAndLaunch() {
    if (!valid) return;
    createMatchPayload(playerName, deckIds, ownedCards);
    setMessage(`Payload saved to localStorage:${MATCH_PAYLOAD_KEY}. Opening ${UNITY_MATCH_PATH}...`);
    launchUnityMatch();
  }

  function applyResult() {
    const result = applyMatchResult(applyProgress);
    setMessage(result ? `Applied ${result.result}: +${result.xp} XP, +${result.coins} coins.` : "No fraktum_match_result found.");
  }

  return (
    <section className="demo-page">
      <header className="page-head"><div><p>Arena Bridge</p><h1>Match Launcher</h1></div><button onClick={() => nav("/")} type="button">Back to Hub</button></header>
      <div className="glass-panel bridge-panel"><h2>JS → Unity Payload</h2><p>Deck readiness: {deckIds.length}/20 cards. Minimum 10 cards.</p>{!valid ? <p className="warning">Build a valid deck before launching. You can seed starter cards in Settings.</p> : <p className="success">Ready for Unity demo mode.</p>}<div className="deck-actions"><button disabled={!valid} onClick={prepareAndLaunch} type="button">Create Payload & Launch Unity</button><button onClick={() => { simulateMatchResult(); setMessage("Simulated Unity result in localStorage."); }} type="button">Simulate Match Result</button><button onClick={applyResult} type="button">Apply Match Result</button></div><pre>{JSON.stringify(previewPayload, null, 2)}</pre>{message ? <p>{message}</p> : null}</div>
    </section>
  );
}
