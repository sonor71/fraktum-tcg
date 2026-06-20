import type { CardInstance } from "../../game/core/types";
import { CardView } from "./CardView";

export function BoardSlot({ card, side, index, valid }: { card: CardInstance | null; side: "enemy" | "player"; index: number; valid?: boolean }) {
  return (
    <div className={`matchBoardSlot is-${side} ${valid ? "is-valid" : ""} ${card?.temporaryUntilRoundEnd ? "is-temporary" : ""}`} title={`${side} slot ${index + 1}`} data-drop-slot={side === "player" ? index : undefined}>
      <span className="matchSlotRune" aria-hidden="true">✦</span>
      {card ? <CardView card={card} size="board" /> : <span className="matchSlotNumber">{index + 1}</span>}
    </div>
  );
}
