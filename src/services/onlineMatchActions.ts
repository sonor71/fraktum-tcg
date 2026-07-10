import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  requireSupabase,
  supabase,
  syncSupabaseSessionFromLauncher,
} from "./supabaseClient";
import type { GameAction } from "../game/core/GameAction";
import type { OnlineSeat } from "./onlineMatchmaking";

export type OnlineMatchActionEvent = {
  id: string;
  room_id: string;
  actor_user_id: string;
  actor_seat: OnlineSeat;
  action: GameAction;
  client_action_id: string | null;
  created_at: string;
};

type AppendOnlineMatchActionInput = {
  roomId: string;
  seat: OnlineSeat;
  action: GameAction;
  clientActionId?: string;
};

function getErrorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? error);
  }
  return String(error);
}

function normalizeEvent(value: unknown): OnlineMatchActionEvent {
  const record = value as Record<string, unknown> | null;
  if (!record || record.id === null || record.id === undefined) {
    throw new Error("Supabase returned an invalid online match event.");
  }

  const id = String(record.id);
  const roomId = String(record.room_id || "");
  const actorUserId = String(record.actor_user_id || "");

  if (!id || !roomId || !actorUserId || !record.action) {
    throw new Error("Supabase returned an incomplete online match event.");
  }

  return {
    id,
    room_id: roomId,
    actor_user_id: actorUserId,
    actor_seat: String(record.actor_seat) === "b" ? "b" : "a",
    action: record.action as GameAction,
    client_action_id:
      typeof record.client_action_id === "string"
        ? record.client_action_id
        : null,
    created_at: String(record.created_at || ""),
  };
}

export async function appendOnlineMatchAction({
  roomId,
  seat,
  action,
  clientActionId,
}: AppendOnlineMatchActionInput) {
  const client = requireSupabase();
  await syncSupabaseSessionFromLauncher();

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;

  const user = userData.user;
  if (!user) {
    throw new Error(
      "You must be signed in before sending online match actions.",
    );
  }

  const { data, error } = await client
    .from("online_match_events")
    .insert({
      room_id: roomId,
      actor_user_id: user.id,
      actor_seat: seat,
      action,
      client_action_id:
        clientActionId ??
        `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Online action insert failed: ${getErrorText(error)}`);
  }

  return normalizeEvent(data);
}

export async function fetchOnlineMatchActions(roomId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("online_match_events")
    .select("*")
    .eq("room_id", roomId)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(`Online action fetch failed: ${getErrorText(error)}`);
  }

  return (data ?? []).map(normalizeEvent);
}

export function subscribeToOnlineMatchActions(
  roomId: string,
  callback: (event: OnlineMatchActionEvent) => void,
  onError?: (error: unknown) => void,
) {
  if (!supabase) return () => undefined;

  const client = supabase;
  let channel: RealtimeChannel | null = client
    .channel(`online_match_events:${roomId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "online_match_events",
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        try {
          callback(normalizeEvent(payload.new));
        } catch (error) {
          onError?.(error);
        }
      },
    )
    .subscribe((status, error) => {
      if (error) onError?.(error);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError?.(
          new Error(`Supabase match event channel status: ${status}`),
        );
      }
    });

  return () => {
    if (!channel) return;
    void client.removeChannel(channel);
    channel = null;
  };
}
