import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MatchBoard } from "../../components/match/MatchBoard";
import { createInitialMatchState, checkWinCondition } from "../engine/MatchEngine";

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
