import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MatchBoard } from "../../components/match/MatchBoard";
import { createInitialMatchState, checkWinCondition } from "../engine/MatchEngine";
import { FATE_ROULETTE_RESULT_READ_MS } from "../engine/FateRoulette";

const noop = () => undefined;

function renderBoard(state = checkWinCondition({
  ...createInitialMatchState({ seed: 31, startingPlayerId: "player" }),
  enemy: { ...createInitialMatchState({ seed: 31, startingPlayerId: "player" }).enemy, hp: 0 },
})) {
  return renderToStaticMarkup(
    <MatchBoard
      state={state}
      selectedCardId={null}
      onSelectCard={noop}
      onRoll={noop}
      onPlay={noop as unknown as (id: string, slotIndex: number) => void}
      onInvalidDrop={noop as unknown as (message: string) => void}
      onEndTurn={noop}
      onAiTurn={noop}
      onRestart={noop}
      onStartNextBattle={noop}
      onConcede={noop}
      onReturnToMenu={noop}
    />,
  );
}

describe("MatchBoard between-battle overlay", () => {
  it("shows battle result and next-battle button while hiding Restart between battles", () => {
    const html = renderBoard();

    expect(html).toContain("БОЙ 1 ЗАВЕРШЁН");
    expect(html).toContain("ПОБЕДА");
    expect(html).toContain("СЛЕДУЮЩИЙ БОЙ");
    expect(html).not.toContain("Restart");
  });

  it("does not show next-battle button on final match result", () => {
    const initial = createInitialMatchState({ seed: 44, startingPlayerId: "player" });
    const ended = checkWinCondition({
      ...initial,
      seriesScore: { player: 1, enemy: 0 },
      enemy: { ...initial.enemy, hp: 0 },
    });
    const html = renderBoard(ended);

    expect(ended.phase).toBe("ended");
    expect(html).toContain("Match result");
    expect(html).not.toContain("СЛЕДУЮЩИЙ БОЙ");
  });
});


describe("FateRouletteOverlay read timer", () => {
  it("keeps player confirm disabled during the 15 second read window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const initial = createInitialMatchState({ seed: 31, startingPlayerId: "player" });
    const html = renderBoard({
      ...initial,
      phase: "roulette",
      rouletteState: { id: "roulette_test", ownerId: "player", triggerRoll: 15, stage: "result", event: "EMPTY_OUTCOME", resultIndex: 4, resultRevealedAt: 1_000, confirmAvailableAt: 1_000 + FATE_ROULETTE_RESULT_READ_MS },
    });

    expect(html).toContain("ПРОДОЛЖИТЬ · 15");
    expect(html).toContain("disabled");
    vi.useRealTimers();
  });

  it("enables player confirm after the 15 second read window without auto-closing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000 + FATE_ROULETTE_RESULT_READ_MS);
    const initial = createInitialMatchState({ seed: 31, startingPlayerId: "player" });
    const html = renderBoard({
      ...initial,
      phase: "roulette",
      rouletteState: { id: "roulette_test", ownerId: "player", triggerRoll: 15, stage: "result", event: "EMPTY_OUTCOME", resultIndex: 4, resultRevealedAt: 1_000, confirmAvailableAt: 1_000 + FATE_ROULETTE_RESULT_READ_MS },
    });

    expect(html).toContain("РУЛЕТКА СУДЬБЫ");
    expect(html).toContain(">ПРОДОЛЖИТЬ</button>");
    expect(html).not.toContain("ПРОДОЛЖИТЬ ·");
    vi.useRealTimers();
  });
});
