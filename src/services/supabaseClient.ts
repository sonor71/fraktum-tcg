import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export type FraktumSupabaseClient = SupabaseClient;
export type FraktumCloudUser = User;
export type FraktumCloudSession = Session;

function hasValidEnvValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0 && !value.includes("PASTE_") && !value.includes("YOUR_"));
}

export function isSupabaseConfigured() {
  return hasValidEnvValue(SUPABASE_URL) && hasValidEnvValue(SUPABASE_ANON_KEY);
}

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        storageKey: "fraktum.supabase.auth",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local and restart dev server."
    );
  }

  return supabase;
}
