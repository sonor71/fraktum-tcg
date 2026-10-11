export const TUTORIAL_COMPLETED_KEY = "fraktum-match-tutorial-completed";
export function shouldDefaultTutorial(mode: string, storage: Pick<Storage, "getItem"> = localStorage) {
  return mode === "ai" && storage.getItem(TUTORIAL_COMPLETED_KEY) !== "true";
}
export function completeTutorial(storage: Pick<Storage, "setItem"> = localStorage) {
  storage.setItem(TUTORIAL_COMPLETED_KEY, "true");
}
