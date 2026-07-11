import type { PackOpeningAction, PackOpeningState } from "./types";

export const initialPackOpeningState: PackOpeningState = {
  phase: "sealed",
  currentCardIndex: 0,
  revealedCardIndexes: [],
};

export function packOpeningReducer(
  state: PackOpeningState,
  action: PackOpeningAction,
): PackOpeningState {
  switch (action.type) {
    case "RESET":
      return initialPackOpeningState;

    case "START_OPENING":
      if (state.phase !== "sealed") return state;
      return { ...state, phase: "opening" };

    case "OPENING_COMPLETE":
      if (state.phase !== "opening") return state;
      return {
        ...state,
        phase: "reveal",
        revealedCardIndexes: [0],
      };

    case "NEXT_CARD":
      if (state.phase !== "reveal") return state;
      if (state.currentCardIndex >= action.totalCards - 1) {
        return { ...state, phase: "summary" };
      }
      return { ...state, phase: "transition" };

    case "SHOW_NEXT_CARD": {
      if (state.phase !== "transition") return state;
      const nextIndex = state.currentCardIndex + 1;
      return {
        ...state,
        phase: "reveal",
        currentCardIndex: nextIndex,
        revealedCardIndexes: state.revealedCardIndexes.includes(nextIndex)
          ? state.revealedCardIndexes
          : [...state.revealedCardIndexes, nextIndex],
      };
    }

    default:
      return state;
  }
}
