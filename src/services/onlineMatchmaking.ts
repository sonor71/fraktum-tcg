import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  requireSupabase,
  supabase,
  isSupabaseConfigured,
  syncSupabaseSessionFromLauncher,
} from "./supabaseClient";
import type { CardDefinition } from "../game/core/types";
import type { WillMatchStats } from "../useGameStore";
import { FRAKTUM_MAIN_DECK_SIZE } from "../game/deckRules";

export type OnlineSeat = "a" | "b";

export type OnlinePlayerSnapshot = {
  userId?: string;
  playerName: string;
  avatar?: string;
  level?: number;
  deck: CardDefinition[];
  deckSize: number;
  hero?: CardDefinition;
  bonusCards?: CardDefinition[];
  willStats: WillMatchStats;
  createdAt: string;
};

export type OnlineMatchRoomStatus =
  | "waiting"
  | "ready"
  | "playing"
  | "finished"
  | "cancelled";

export type OnlineMatchRoom = {
  id: string;
  status: OnlineMatchRoomStatus;
  seed: number;
  player_a_user_id: string;
  player_b_user_id: string | null;
  player_a_snapshot: OnlinePlayerSnapshot;
  player_b_snapshot: OnlinePlayerSnapshot | null;
  player_a_ready: boolean;
  player_b_ready: boolean;
  match_state?: unknown;
  last_action?: unknown;
  winner?: string | null;
  created_at: string;
  updated_at: string;
};

export type OnlineMatchmakingResult = {
  room: OnlineMatchRoom;
  seat: OnlineSeat;
  userId: string;
};

function getErrorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? error);
  }
  return String(error);
}

function onlineBackendError(error: unknown, context: string) {
  const message = getErrorText(error);

  if (
    message.includes("join_online_matchmaking") ||
    message.includes("PGRST202") ||
    message.includes("Could not find the function")
  ) {
    return new Error(
      `${context}: FRAKTUM backend SQL is not installed in Supabase. Run supabase/fraktum_online_backend.sql.`,
    );
  }

  if (message.toLowerCase().includes("row-level security")) {
    return new Error(
      `${context}: Supabase RLS blocked the request. Re-run fraktum_online_backend.sql.`,
    );
  }

  return new Error(`${context}: ${message}`);
}

function normalizeRoom(data: unknown): OnlineMatchRoom {
  const record = data as Record<string, unknown> | null;
  if (!record || typeof record.id !== "string" || !record.id) {
    throw new Error("Supabase returned an invalid online match room.");
  }

  const rawStatus = String(record.status || "waiting");
  const status: OnlineMatchRoomStatus =
    rawStatus === "ready" ||
    rawStatus === "playing" ||
    rawStatus === "finished" ||
    rawStatus === "cancelled"
      ? rawStatus
      : "waiting";

  return {
    id: record.id,
    status,
    seed: Number(record.seed || Date.now()),
    player_a_user_id: String(record.player_a_user_id || ""),
    player_b_user_id:
      typeof record.player_b_user_id === "string"
        ? record.player_b_user_id
        : null,
    player_a_snapshot: record.player_a_snapshot as OnlinePlayerSnapshot,
    player_b_snapshot:
      (record.player_b_snapshot ?? null) as OnlinePlayerSnapshot | null,
    player_a_ready: Boolean(record.player_a_ready),
    player_b_ready: Boolean(record.player_b_ready),
    match_state: record.match_state,
    last_action: record.last_action,
    winner: typeof record.winner === "string" ? record.winner : null,
    created_at: String(record.created_at || ""),
    updated_at: String(record.updated_at || ""),
  };
}

async function requireAuthenticatedUser() {
  const client = requireSupabase();
  await syncSupabaseSessionFromLauncher();

  const { data, error } = await client.auth.getUser();
  if (error) throw error;

  if (!data.user) {
    throw new Error(
      "You must log in through Profile → FRAKTUM Cloud before searching for an online match.",
    );
  }

  return { client, user: data.user };
}

export function isOnlineMatchmakingConfigured() {
  return isSupabaseConfigured() && Boolean(supabase);
}

export function getSeatForRoom(
  room: OnlineMatchRoom,
  userId: string,
): OnlineSeat {
  if (room.player_a_user_id === userId) return "a";
  if (room.player_b_user_id === userId) return "b";
  throw new Error("Authenticated user is not a participant of this room.");
}

export function getOwnSnapshot(room: OnlineMatchRoom, seat: OnlineSeat) {
  return seat === "a" ? room.player_a_snapshot : room.player_b_snapshot;
}

export function getOpponentSnapshot(room: OnlineMatchRoom, seat: OnlineSeat) {
  return seat === "a" ? room.player_b_snapshot : room.player_a_snapshot;
}

export function isRoomReady(room: OnlineMatchRoom) {
  return Boolean(
    room &&
      (room.status === "ready" || room.status === "playing") &&
      room.player_a_snapshot &&
      room.player_b_snapshot &&
      room.player_a_user_id &&
      room.player_b_user_id &&
      room.player_a_ready &&
      room.player_b_ready &&
      room.player_a_snapshot.deck?.length === FRAKTUM_MAIN_DECK_SIZE &&
      room.player_b_snapshot.deck?.length === FRAKTUM_MAIN_DECK_SIZE,
  );
}

export async function joinOnlineMatchmaking(
  snapshot: OnlinePlayerSnapshot,
): Promise<OnlineMatchmakingResult> {
  try {
    const { client, user } = await requireAuthenticatedUser();

    const playerSnapshot: OnlinePlayerSnapshot = {
      ...snapshot,
      userId: user.id,
      playerName: snapshot.playerName || user.email || "FRAKTUM Player",
      createdAt: new Date().toISOString(),
    };

    const { data, error } = await client.rpc("join_online_matchmaking", {
      player_snapshot: playerSnapshot,
    });

    if (error) throw error;

    const room = normalizeRoom(Array.isArray(data) ? data[0] : data);

    return {
      room,
      seat: getSeatForRoom(room, user.id),
      userId: user.id,
    };
  } catch (error) {
    throw onlineBackendError(error, "Matchmaking failed");
  }
}

export async function fetchOnlineMatchRoom(roomId: string) {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from("online_match_rooms")
      .select("*")
      .eq("id", roomId)
      .maybeSingle();

    if (error) throw error;
    return data ? normalizeRoom(data) : null;
  } catch (error) {
    throw onlineBackendError(error, "Could not read online room");
  }
}

export async function cancelOnlineMatchmaking(roomId: string) {
  try {
    const client = requireSupabase();
    const { data, error } = await client.rpc("cancel_online_matchmaking", {
      room_id: roomId,
    });

    if (error) throw error;
    return data ? normalizeRoom(Array.isArray(data) ? data[0] : data) : null;
  } catch (error) {
    throw onlineBackendError(error, "Could not cancel matchmaking");
  }
}

export async function markOnlineRoomPlaying(roomId: string) {
  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from("online_match_rooms")
      .update({ status: "playing" })
      .eq("id", roomId)
      .in("status", ["ready", "playing"])
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data ? normalizeRoom(data) : null;
  } catch (error) {
    throw onlineBackendError(error, "Could not start online room");
  }
}

export async function finishOnlineMatch(
  roomId: string,
  winnerValue: string | null,
) {
  try {
    const client = requireSupabase();
    const { data, error } = await client.rpc("finish_online_match", {
      room_id: roomId,
      winner_value: winnerValue,
    });

    if (error) throw error;
    return data ? normalizeRoom(Array.isArray(data) ? data[0] : data) : null;
  } catch (error) {
    throw onlineBackendError(error, "Could not finish online room");
  }
}

export function subscribeToOnlineMatchRoom(
  roomId: string,
  callback: (room: OnlineMatchRoom) => void,
  onError?: (error: unknown) => void,
) {
  if (!supabase) return () => undefined;

  const client = supabase;
  let channel: RealtimeChannel | null = client
    .channel(`online_match_room:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "online_match_rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        try {
          const next = payload.new ? normalizeRoom(payload.new) : null;
          if (next) callback(next);
        } catch (error) {
          onError?.(error);
        }
      },
    )
    .subscribe((status, error) => {
      if (error) onError?.(error);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError?.(
          new Error(`Supabase room Realtime channel status: ${status}`),
        );
      }
    });

  return () => {
    if (!channel) return;
    void client.removeChannel(channel);
    channel = null;
  };
}
