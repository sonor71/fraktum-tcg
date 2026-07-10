import type { AuthChangeEvent } from "@supabase/supabase-js";
import { requireSupabase, supabase, isSupabaseConfigured, syncSupabaseSessionFromLauncher, type FraktumCloudUser } from "./supabaseClient";
import { useGameStore, type GameState } from "../useGameStore";

export const CLOUD_AUTOSYNC_CHANGED_EVENT = "fraktum:cloud-autosync-changed";

const AUTO_SYNC_STORAGE_KEY = "fraktum.cloud.autosync.enabled";
const CLOUD_SAVE_SCHEMA_VERSION = 1;

const SAVE_STATE_KEYS = [
  "playerName",
  "avatar",
  "level",
  "xp",
  "coins",
  "premium",
  "free",
  "ownedCards",
  "deckIds",
  "willUpgrades",
  "showcaseCardIds",
  "openedPacksCount",
  "matchHistory",
  "settings",
  "cardSerials",
  "friends",
  "battlePassXp",
  "claimedBattlePassRewards",
  "claimedDailyQuestIds",
  "craftedCardsCount",
  "wins",
  "pendingPackPurchases",
  "packOpenHistory",
  "auctionListings",
  "auctionSalesTotal",
] as const;

type SaveKey = (typeof SAVE_STATE_KEYS)[number];

export type CloudGameSave = {
  schemaVersion: number;
  savedAt: string;
  source: "fraktum-web";
  state: Partial<Pick<GameState, SaveKey>>;
};

export type CloudSaveMeta = {
  userId: string;
  updatedAt: string | null;
  revision: number | null;
  hasSave: boolean;
};

export type CloudAuthState = {
  configured: boolean;
  user: FraktumCloudUser | null;
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getCurrentStoreState() {
  return useGameStore.getState();
}

export function isCloudAutoSyncEnabled() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(AUTO_SYNC_STORAGE_KEY) === "1";
}

export function setCloudAutoSyncEnabled(enabled: boolean) {
  if (typeof localStorage !== "undefined") {
    if (enabled) localStorage.setItem(AUTO_SYNC_STORAGE_KEY, "1");
    else localStorage.removeItem(AUTO_SYNC_STORAGE_KEY);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CLOUD_AUTOSYNC_CHANGED_EVENT));
  }
}

export function createLocalSaveData(): CloudGameSave {
  const state = getCurrentStoreState();
  const saveState: Partial<Pick<GameState, SaveKey>> = {};

  for (const key of SAVE_STATE_KEYS) {
    saveState[key] = cloneJson(state[key]) as never;
  }

  return {
    schemaVersion: CLOUD_SAVE_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    source: "fraktum-web",
    state: saveState,
  };
}

export function applyCloudSaveData(save: unknown) {
  const record = typeof save === "object" && save !== null ? (save as Partial<CloudGameSave>) : null;
  const state = typeof record?.state === "object" && record.state !== null ? record.state : null;

  if (!state) {
    throw new Error("Cloud save is empty or has invalid format.");
  }

  const nextState: Partial<GameState> = {};

  for (const key of SAVE_STATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(state, key)) {
      nextState[key] = cloneJson(state[key]) as never;
    }
  }

  if (typeof nextState.coins === "number") {
    nextState.free = nextState.coins;
  }

  useGameStore.setState(nextState, false);
}

export async function getCloudAuthState(): Promise<CloudAuthState> {
  if (!isSupabaseConfigured() || !supabase) return { configured: false, user: null };

  await syncSupabaseSessionFromLauncher();

  const { data, error } = await supabase.auth.getUser();
  if (error) return { configured: true, user: null };

  return { configured: true, user: data.user ?? null };
}

export function onCloudAuthStateChange(callback: (user: FraktumCloudUser | null, event: AuthChangeEvent) => void) {
  if (!supabase) return () => undefined;

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null, event);
  });

  return () => data.subscription.unsubscribe();
}

function normalizeCloudEmail(email: string) {
  const normalized = email.trim().toLowerCase();

  if (!normalized || !normalized.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  return normalized;
}

function normalizeCloudCode(code: string) {
  const normalized = code.trim().replace(/\s+/g, "");

  if (!normalized) {
    throw new Error("Enter the code from your email.");
  }

  return normalized;
}

export async function requestCloudEmailCode(email: string, displayName?: string) {
  const client = requireSupabase();
  const normalizedEmail = normalizeCloudEmail(email);
  const normalizedName = displayName?.trim() || getCurrentStoreState().playerName || "FRAKTUM Player";

  const { error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      data: {
        display_name: normalizedName,
        player_name: normalizedName,
      },
    },
  });

  if (error) throw error;

  return {
    email: normalizedEmail,
    displayName: normalizedName,
  };
}

export async function verifyCloudEmailCode(email: string, code: string, displayName?: string) {
  const client = requireSupabase();
  const normalizedEmail = normalizeCloudEmail(email);
  const token = normalizeCloudCode(code);

  const { data, error } = await client.auth.verifyOtp({
    email: normalizedEmail,
    token,
    type: "email",
  });

  if (error) throw error;
  if (!data.session || !data.user) {
    throw new Error("Supabase verified the code but did not create a session.");
  }

  // Authentication is already complete at this point. A profile-table issue
  // must never make the UI report that login failed.
  try {
    await ensureCloudProfile(displayName);
  } catch (profileError) {
    console.warn("[FRAKTUM] Login succeeded, but profile sync failed", profileError);
  }

  return data.user;
}

/**
 * Backward-compatible wrapper for old UI code.
 * FRAKTUM now uses email code login, so this only sends the code.
 */
export async function signInCloud(email: string, _password?: string) {
  await requestCloudEmailCode(email);
  return null;
}

/**
 * Backward-compatible wrapper for old UI code.
 * FRAKTUM now creates accounts through email code login, without passwords.
 */
export async function signUpCloud(email: string, _password: string | undefined, displayName: string) {
  await requestCloudEmailCode(email, displayName);
  return null;
}

export async function signOutCloud() {
  const client = requireSupabase();
  setCloudAutoSyncEnabled(false);
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function ensureCloudProfile(displayName?: string) {
  const client = requireSupabase();
  await syncSupabaseSessionFromLauncher();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;

  const user = userData.user;
  if (!user) throw new Error("No authenticated Supabase user.");

  const state = getCurrentStoreState();
  const resolvedName = displayName?.trim() || state.playerName || user.email || "FRAKTUM Player";

  const { error } = await client.from("game_profiles").upsert(
    {
      user_id: user.id,
      display_name: resolvedName,
      avatar_url: state.avatar || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
  return user;
}

export async function pushLocalSaveToCloud() {
  const client = requireSupabase();
  const user = await ensureCloudProfile();
  const saveData = createLocalSaveData();

  const { data: existing, error: readError } = await client
    .from("game_saves")
    .select("revision")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) throw readError;

  const nextRevision = Math.max(1, Number(existing?.revision || 0) + 1);
  const { error } = await client.from("game_saves").upsert(
    {
      user_id: user.id,
      save_data: saveData,
      revision: nextRevision,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;

  setCloudAutoSyncEnabled(true);
  return { userId: user.id, revision: nextRevision, saveData };
}

export async function getCloudSaveMeta(): Promise<CloudSaveMeta | null> {
  const client = requireSupabase();
  await syncSupabaseSessionFromLauncher();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;

  const user = userData.user;
  if (!user) return null;

  const { data, error } = await client
    .from("game_saves")
    .select("updated_at, revision")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    userId: user.id,
    updatedAt: typeof data?.updated_at === "string" ? data.updated_at : null,
    revision: typeof data?.revision === "number" ? data.revision : null,
    hasSave: Boolean(data),
  };
}

export async function pullCloudSaveToLocal() {
  const client = requireSupabase();
  await syncSupabaseSessionFromLauncher();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;

  const user = userData.user;
  if (!user) throw new Error("No authenticated Supabase user.");

  const { data, error } = await client
    .from("game_saves")
    .select("save_data, updated_at, revision")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data?.save_data) throw new Error("Cloud save is empty. Upload local save first.");

  applyCloudSaveData(data.save_data);
  return {
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
    revision: typeof data.revision === "number" ? data.revision : null,
  };
}
