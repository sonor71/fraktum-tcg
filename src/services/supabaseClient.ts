import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";

const RAW_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function normalizeSupabaseUrl(value: string | undefined) {
  const normalized = value?.trim().replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  return normalized || undefined;
}

const SUPABASE_URL = normalizeSupabaseUrl(RAW_SUPABASE_URL);

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
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env/.env.local or Vercel Environment Variables, then rebuild."
    );
  }

  return supabase;
}


type LauncherSessionLike = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number | null;
  token_type?: string | null;
  user?: unknown;
};

declare global {
  interface Window {
    launcher?: {
      getAuthSession?: () => Promise<LauncherSessionLike | null>;
    };
    api?: {
      getAuthSession?: () => Promise<LauncherSessionLike | null>;
    };
    sb?: {
      getSession?: () => Promise<LauncherSessionLike | null>;
    };
    __FRAKTUM_AUTH_HANDOFF_DONE__?: boolean;
  }
}

function parseSessionFromLaunchUrl(): LauncherSessionLike | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const encoded = url.searchParams.get("fraktumSession");
  if (!encoded) return null;

  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = atob(padded);
    const session = JSON.parse(json) as LauncherSessionLike;

    url.searchParams.delete("fraktumSession");
    window.history.replaceState(null, document.title, `${url.pathname}${url.search}${url.hash}`);

    return session;
  } catch (error) {
    console.warn("[FRAKTUM] Failed to parse launcher auth handoff", error);
    return null;
  }
}

function hasTokens(session: LauncherSessionLike | null | undefined): session is Required<Pick<LauncherSessionLike, "access_token" | "refresh_token">> & LauncherSessionLike {
  return Boolean(session?.access_token && session?.refresh_token);
}

export async function syncSupabaseSessionFromLauncher() {
  if (!supabase || typeof window === "undefined") return null;
  if (window.__FRAKTUM_AUTH_HANDOFF_DONE__) {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  window.__FRAKTUM_AUTH_HANDOFF_DONE__ = true;

  const existing = await supabase.auth.getSession().catch(() => null);
  if (existing?.data.session) return existing.data.session;

  const candidates: Array<LauncherSessionLike | null | undefined> = [];
  candidates.push(parseSessionFromLaunchUrl());

  try { candidates.push(await window.launcher?.getAuthSession?.()); } catch (error) { console.warn("[FRAKTUM] launcher.getAuthSession failed", error); }
  try { candidates.push(await window.api?.getAuthSession?.()); } catch (error) { console.warn("[FRAKTUM] api.getAuthSession failed", error); }
  try { candidates.push(await window.sb?.getSession?.()); } catch (error) { console.warn("[FRAKTUM] sb.getSession failed", error); }

  const session = candidates.find(hasTokens);
  if (!session) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error) {
    console.warn("[FRAKTUM] Launcher auth handoff setSession failed", error);
    return null;
  }

  window.dispatchEvent(new CustomEvent("fraktum:cloud-auth-handoff", { detail: { user: data.session?.user ?? null } }));
  return data.session;
}


// Run as soon as the game bundle starts. This is required when the game is
// launched from Electron launcher: the launcher and the game have different
// origins/localStorage, so the game must import Supabase session explicitly.
if (typeof window !== "undefined") {
  const runHandoff = () => {
    void syncSupabaseSessionFromLauncher();
  };

  if (typeof queueMicrotask === "function") queueMicrotask(runHandoff);
  else window.setTimeout(runHandoff, 0);

  window.addEventListener("focus", () => {
    void syncSupabaseSessionFromLauncher();
  });
}
