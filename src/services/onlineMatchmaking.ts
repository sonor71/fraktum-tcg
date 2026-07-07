import type { RealtimeChannel } from "@supabase/supabase-js";
import { requireSupabase, supabase, isSupabaseConfigured } from "./supabaseClient";
import type { CardDefinition } from "../game/core/types";
import type { WillMatchStats } from "../useGameStore";

export type OnlineSeat = "a" | "b";

export type OnlinePlayerSnapshot = {
  userId?: string;
  playerName: string;
  avatar?: string;
  level?: number;
  deck: CardDefinition[];
  deckSize: number;
  willStats: WillMatchStats;
  createdAt: string;
};

export type OnlineMatchRoomStatus = "waiting" | "ready" | "playing" | "finished" | "cancelled";

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

function normalizeRoom(data: unknown): OnlineMatchRoom {
  const record = data as Record<string, unknown> | null;
  if (!record || typeof record.id !== "string") {
    throw new Error("Supabase returned an invalid online match room.");
  }

  return {
    id: String(record.id),
    status: String(record.status || "waiting") as OnlineMatchRoomStatus,
    seed: Number(record.seed || Date.now()),
    player_a_user_id: String(record.player_a_user_id || ""),
    player_b_user_id: typeof record.player_b_user_id === "string" ? record.player_b_user_id : null,
    player_a_snapshot: record.player_a_snapshot as OnlinePlayerSnapshot,
    player_b_snapshot: (record.player_b_snapshot ?? null) as OnlinePlayerSnapshot | null,
    player_a_ready: Boolean(record.player_a_ready),
    player_b_ready: Boolean(record.player_b_ready),
    match_state: record.match_state,
    last_action: record.last_action,
    winner: typeof record.winner === "string" ? record.winner : null,
    created_at: String(record.created_at || ""),
    updated_at: String(record.updated_at || ""),
  };
}

export function isOnlineMatchmakingConfigured() {
  return isSupabaseConfigured() && Boolean(supabase);
}

export function getSeatForRoom(room: OnlineMatchRoom, userId: string): OnlineSeat {
  return room.player_a_user_id === userId ? "a" : "b";
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
    room.player_b_user_id,
  );
}

export async function joinOnlineMatchmaking(snapshot: OnlinePlayerSnapshot): Promise<OnlineMatchmakingResult> {
  const client = requireSupabase();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;

  const user = userData.user;
  if (!user) {
    throw new Error("You must login in Profile before searching for an online match.");
  }

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
}

export async function fetchOnlineMatchRoom(roomId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("online_match_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeRoom(data) : null;
}

export async function cancelOnlineMatchmaking(roomId: string) {
  const client = requireSupabase();
  const { error } = await client.rpc("cancel_online_matchmaking", {
    room_id: roomId,
  });

  if (error) throw error;
}

export async function markOnlineRoomPlaying(roomId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("online_match_rooms")
    .update({ status: "playing", updated_at: new Date().toISOString() })
    .eq("id", roomId)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeRoom(data) : null;
}

export function subscribeToOnlineMatchRoom(
  roomId: string,
  callback: (room: OnlineMatchRoom) => void,
  onError?: (error: unknown) => void,
) {
  if (!supabase) return () => undefined;

  let channel: RealtimeChannel | null = supabase
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
      if (status === "CHANNEL_ERROR") onError?.(new Error("Supabase Realtime channel error."));
    });

  return () => {
    if (!channel || !supabase) return;
    void supabase.removeChannel(channel);
    channel = null;
  };
}
