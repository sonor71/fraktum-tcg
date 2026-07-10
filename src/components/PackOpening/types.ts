import type { OwnedCard } from "../../game/types";

export type PackOpeningPhase =
  | "sealed"
  | "opening"
  | "reveal"
  | "transition"
  | "summary";

export type PackOpeningState = {
  phase: PackOpeningPhase;
  currentCardIndex: number;
  revealedCardIndexes: number[];
};

export type PackOpeningAction =
  | { type: "RESET" }
  | { type: "START_OPENING" }
  | { type: "OPENING_COMPLETE" }
  | { type: "NEXT_CARD"; totalCards: number }
  | { type: "SHOW_NEXT_CARD" };

export type PackOpeningPackData = {
  packId: string;
  title: string;
  artSrc: string;
  fallbackArtSrc: string;
};

export type PackOpeningOverlayProps = {
  cards: OwnedCard[];
  packData: PackOpeningPackData;
  onClose: () => void;
  onBackToShop: () => void;
  onBuyAnother: () => void;
};
