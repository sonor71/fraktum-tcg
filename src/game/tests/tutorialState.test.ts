import { describe, expect, it } from "vitest";
import { completeTutorial, shouldDefaultTutorial, TUTORIAL_COMPLETED_KEY } from "../../components/match/tutorialState";
function memoryStorage(initial?: string) { let value = initial ?? null; return { getItem: () => value, setItem: (key: string, next: string) => { expect(key).toBe(TUTORIAL_COMPLETED_KEY); value = next; } }; }
describe("match tutorial preference", () => {
  it("defaults on for the first AI match and never for PvP", () => { const storage = memoryStorage(); expect(shouldDefaultTutorial("ai", storage)).toBe(true); expect(shouldDefaultTutorial("online", storage)).toBe(false); });
  it("completion or skip persists and defaults subsequent AI matches off", () => { const storage = memoryStorage(); completeTutorial(storage); expect(shouldDefaultTutorial("ai", storage)).toBe(false); });
  it("does not prevent an explicit replay", () => { expect(new URLSearchParams("tutorial=1").get("tutorial")).toBe("1"); });
});
