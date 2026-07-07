import type { AuthChangeEvent } from "@supabase/supabase-js";
import { requireSupabase, supabase, isSupabaseConfigured, type FraktumCloudUser } from "./supabaseClient";
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

export async function signInCloud(email: string, password: string) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  await ensureCloudProfile();
  return data.user;
}

export async function signUpCloud(email: string, password: string, displayName: string) {
  const client = requireSupabase();
  const normalizedName = displayName.trim() || getCurrentStoreState().playerName || "FRAKTUM Player";
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        display_name: normalizedName,
        player_name: normalizedName,
      },
    },
  });

  if (error) throw error;
  await ensureCloudProfile(normalizedName);
  return data.user;
}

export async function signOutCloud() {
  const client = requireSupabase();
  setCloudAutoSyncEnabled(false);
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function ensureCloudProfile(displayName?: string) {
  const client = requireSupabase();
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
