import type { GameWorldData } from "./worldTypes";

export const WORLD_FORMAT_VERSION = 1;
export const WORLD_STORAGE_KEY = "fraktum-runtime-world-v1";
export const WORLD_BACKUP_KEY = "fraktum-runtime-world-backup-v1";

export function cloneWorld(world: GameWorldData): GameWorldData {
  return JSON.parse(JSON.stringify(world)) as GameWorldData;
}

export function isGameWorldData(value: unknown): value is GameWorldData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameWorldData>;
  return typeof candidate.version === "number" && typeof candidate.startSceneId === "string" && Array.isArray(candidate.scenes);
}

export function loadStoredWorld(fallback: GameWorldData): GameWorldData {
  try {
    const stored = localStorage.getItem(WORLD_STORAGE_KEY);
    if (!stored) return cloneWorld(fallback);
    const parsed: unknown = JSON.parse(stored);
    return isGameWorldData(parsed) ? parsed : cloneWorld(fallback);
  } catch {
    return cloneWorld(fallback);
  }
}

export function saveStoredWorld(world: GameWorldData) {
  const serialized = JSON.stringify(world);
  localStorage.setItem(WORLD_STORAGE_KEY, serialized);
  localStorage.setItem(WORLD_BACKUP_KEY, serialized);
}

export function downloadWorldJson(world: GameWorldData) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(world, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "fraktum-world.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

