import type { CardInstance } from "../../game/core/types";
import { CardView } from "./CardView";

export function BoardSlot({ card, side, index, valid }: { card: CardInstance | null; side: "enemy" | "player"; index: number; valid?: boolean }) {
  return (
    <div className={`matchBoardSlot is-${side} ${valid ? "is-valid" : ""}`} title={`${side} slot ${index + 1}`}>
      <span className="matchSlotRune" aria-hidden="true">✦</span>
      {card ? <CardView card={card} size="board" /> : <span className="matchSlotNumber">{index + 1}</span>}
    </div>
  );
}
