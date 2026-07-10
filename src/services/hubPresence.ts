import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./supabaseClient";
import type { HubDirection, HubMapId, HubPoint } from "../screens/Hub/hubMaps";

export type HubPresenceStatus = "disabled" | "connecting" | "online" | "error";

export type RemoteHubPlayer = {
  clientId: string;
  playerName: string;
  avatar?: string;
  level: number;
  mapId: HubMapId;
  x: number;
  y: number;
  direction: HubDirection;
  isMoving: boolean;
  joinedAt: number;
  updatedAt: number;
};

type HubPlayerPayload = RemoteHubPlayer & {
  kind: "fraktum-hub-player";
  version: 2;
};

type HubPresenceInput = {
  mapId: HubMapId;
  playerName: string;
  avatar?: string;
  level: number;
  position: HubPoint;
  direction: HubDirection;
  isMoving: boolean;
};

const HUB_CHANNEL = "fraktum:hub:v2";
const HUB_BROADCAST_EVENT = "player_state";
const HUB_BROADCAST_SEND_MS = 90;
const HUB_HEARTBEAT_MS = 4000;
const HUB_MAP_IDS: HubMapId[] = ["hub1", "market", "archive", "arena"];

let runtimeClientId: string | null = null;

function createRuntimeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getRuntimeHubClientId() {
  if (!runtimeClientId) runtimeClientId = `hub_${createRuntimeId()}`;
  return runtimeClientId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeDirection(value: unknown): HubDirection {
  if (value === "up" || value === "down" || value === "left" || value === "right") return value;
  return "down";
}

function normalizeMapId(value: unknown): HubMapId | null {
  return HUB_MAP_IDS.includes(value as HubMapId) ? (value as HubMapId) : null;
}

function normalizePlayerPayload(value: unknown): RemoteHubPlayer | null {
  if (!isRecord(value) || value.kind !== "fraktum-hub-player") return null;

  const clientId = typeof value.clientId === "string" ? value.clientId : "";
  const mapId = normalizeMapId(value.mapId);
  const x = Number(value.x);
  const y = Number(value.y);

  if (!clientId || !mapId || !Number.isFinite(x) || !Number.isFinite(y)) return null;

  return {
    clientId,
    playerName:
      typeof value.playerName === "string" && value.playerName.trim()
        ? value.playerName.trim()
        : "FRAKTUM Player",
    avatar: typeof value.avatar === "string" ? value.avatar : undefined,
    level: Number.isFinite(Number(value.level))
      ? Math.max(1, Math.floor(Number(value.level)))
      : 1,
    mapId,
    x,
    y,
    direction: normalizeDirection(value.direction),
    isMoving: Boolean(value.isMoving),
    joinedAt: Number.isFinite(Number(value.joinedAt))
      ? Number(value.joinedAt)
      : Date.now(),
    updatedAt: Number.isFinite(Number(value.updatedAt))
      ? Number(value.updatedAt)
      : Date.now(),
  };
}

function readPresencePlayers(channel: RealtimeChannel, localClientId: string) {
  const rawState = channel.presenceState() as Record<string, unknown>;
  const players = new Map<string, RemoteHubPlayer>();

  for (const entries of Object.values(rawState)) {
    const metas = Array.isArray(entries) ? entries : [entries];

    for (const meta of metas) {
      const player = normalizePlayerPayload(meta);
      if (!player || player.clientId === localClientId) continue;

      const existing = players.get(player.clientId);
      if (!existing || player.updatedAt >= existing.updatedAt) {
        players.set(player.clientId, player);
      }
    }
  }

  return players;
}

function sortPlayers(players: Iterable<RemoteHubPlayer>) {
  return [...players].sort((a, b) => a.joinedAt - b.joinedAt);
}

export function useHubPresence({
  mapId,
  playerName,
  avatar,
  level,
  position,
  direction,
  isMoving,
}: HubPresenceInput) {
  const clientId = useMemo(getRuntimeHubClientId, []);
  const joinedAtRef = useRef(Date.now());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedRef = useRef(false);
  const latestPayloadRef = useRef<HubPlayerPayload | null>(null);
  const lastBroadcastAtRef = useRef(0);
  const pendingBroadcastTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);

  const [presenceStatus, setPresenceStatus] = useState<HubPresenceStatus>(
    isSupabaseConfigured() && supabase ? "connecting" : "disabled",
  );
  const [presenceError, setPresenceError] = useState<string | null>(null);
  const [allRemotePlayers, setAllRemotePlayers] = useState<RemoteHubPlayer[]>([]);

  const payloadBase = useMemo<Omit<HubPlayerPayload, "updatedAt">>(
    () => ({
      kind: "fraktum-hub-player",
      version: 2,
      clientId,
      playerName: playerName?.trim() || "FRAKTUM Player",
      avatar: avatar || undefined,
      level,
      mapId,
      x: Math.round(position.x * 10) / 10,
      y: Math.round(position.y * 10) / 10,
      direction,
      isMoving,
      joinedAt: joinedAtRef.current,
    }),
    [
      avatar,
      clientId,
      direction,
      isMoving,
      level,
      mapId,
      playerName,
      position.x,
      position.y,
    ],
  );

  useEffect(() => {
    latestPayloadRef.current = { ...payloadBase, updatedAt: Date.now() };
  }, [payloadBase]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setPresenceStatus("disabled");
      setPresenceError("Supabase environment variables are not configured.");
      setAllRemotePlayers([]);
      return undefined;
    }

    const client = supabase;
    let disposed = false;

    subscribedRef.current = false;
    setPresenceStatus("connecting");
    setPresenceError(null);

    const channel = client.channel(HUB_CHANNEL, {
      config: {
        presence: { key: clientId },
        broadcast: { self: false, ack: true },
      },
    });

    channelRef.current = channel;

    const mergePresenceState = () => {
      if (disposed) return;
      const presentPlayers = readPresencePlayers(channel, clientId);

      setAllRemotePlayers((current) => {
        const merged = new Map<string, RemoteHubPlayer>();

        for (const [id, presencePlayer] of presentPlayers) {
          const currentPlayer = current.find((candidate) => candidate.clientId === id);
          merged.set(
            id,
            currentPlayer && currentPlayer.updatedAt > presencePlayer.updatedAt
              ? currentPlayer
              : presencePlayer,
          );
        }

        return sortPlayers(merged.values());
      });
    };

    const sendLatestBroadcast = async () => {
      const payload = latestPayloadRef.current;
      if (!payload || disposed || !subscribedRef.current) return;

      const result = await channel.send({
        type: "broadcast",
        event: HUB_BROADCAST_EVENT,
        payload: { ...payload, updatedAt: Date.now() },
      });

      if (result !== "ok" && !disposed) {
        setPresenceError(`Hub broadcast returned: ${result}`);
      }
    };

    channel
      .on("presence", { event: "sync" }, mergePresenceState)
      .on("presence", { event: "join" }, mergePresenceState)
      .on("presence", { event: "leave" }, mergePresenceState)
      .on("broadcast", { event: HUB_BROADCAST_EVENT }, (message) => {
        if (disposed) return;

        const player = normalizePlayerPayload(message.payload);
        if (!player || player.clientId === clientId) return;

        setAllRemotePlayers((current) => {
          const next = new Map(current.map((candidate) => [candidate.clientId, candidate]));
          const existing = next.get(player.clientId);

          if (!existing || player.updatedAt >= existing.updatedAt) {
            next.set(player.clientId, player);
          }

          return sortPlayers(next.values());
        });
      })
      .subscribe((status, error) => {
        if (disposed) return;

        if (error) {
          setPresenceStatus("error");
          setPresenceError(error.message || "Supabase Hub channel error.");
          return;
        }

        if (status === "SUBSCRIBED") {
          subscribedRef.current = true;
          setPresenceStatus("online");
          setPresenceError(null);

          const payload = latestPayloadRef.current;
          if (payload) {
            void channel
              .track({ ...payload, updatedAt: Date.now() })
              .catch((trackError: unknown) => {
                if (disposed) return;
                setPresenceError(
                  trackError instanceof Error ? trackError.message : String(trackError),
                );
              });

            void sendLatestBroadcast();
          }

          mergePresenceState();

          heartbeatTimerRef.current = window.setInterval(() => {
            void sendLatestBroadcast();
          }, HUB_HEARTBEAT_MS);
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          subscribedRef.current = false;
          setPresenceStatus("error");
          setPresenceError(`Supabase Hub channel status: ${status}`);
        }
      });

    return () => {
      disposed = true;
      subscribedRef.current = false;
      setAllRemotePlayers([]);

      if (pendingBroadcastTimerRef.current !== null) {
        window.clearTimeout(pendingBroadcastTimerRef.current);
        pendingBroadcastTimerRef.current = null;
      }

      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }

      if (channelRef.current === channel) channelRef.current = null;

      void channel.untrack().catch(() => undefined);
      void client.removeChannel(channel);
    };
  }, [clientId]);

  // Presence is for membership. Re-track only when identity or map changes.
  useEffect(() => {
    const channel = channelRef.current;
    const latest = latestPayloadRef.current;
    if (!channel || !latest || !subscribedRef.current || presenceStatus !== "online") return;

    void channel.track({ ...latest, updatedAt: Date.now() }).catch((error: unknown) => {
      setPresenceError(error instanceof Error ? error.message : String(error));
    });
  }, [avatar, level, mapId, playerName, presenceStatus]);

  // Broadcast is used for movement because it is designed for frequent transient updates.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !subscribedRef.current || presenceStatus !== "online") return undefined;

    const send = async () => {
      pendingBroadcastTimerRef.current = null;

      const latest = latestPayloadRef.current;
      if (!latest || !subscribedRef.current) return;

      lastBroadcastAtRef.current = Date.now();
      const result = await channel.send({
        type: "broadcast",
        event: HUB_BROADCAST_EVENT,
        payload: { ...latest, updatedAt: Date.now() },
      });

      if (result !== "ok") {
        setPresenceError(`Hub movement broadcast returned: ${result}`);
      }
    };

    const elapsed = Date.now() - lastBroadcastAtRef.current;

    if (elapsed >= HUB_BROADCAST_SEND_MS) {
      void send();
      return undefined;
    }

    if (pendingBroadcastTimerRef.current !== null) {
      window.clearTimeout(pendingBroadcastTimerRef.current);
    }

    pendingBroadcastTimerRef.current = window.setTimeout(
      () => void send(),
      HUB_BROADCAST_SEND_MS - elapsed,
    );

    return () => {
      if (pendingBroadcastTimerRef.current !== null) {
        window.clearTimeout(pendingBroadcastTimerRef.current);
        pendingBroadcastTimerRef.current = null;
      }
    };
  }, [
    direction,
    isMoving,
    mapId,
    position.x,
    position.y,
    presenceStatus,
  ]);

  const remotePlayers = useMemo(
    () =>
      allRemotePlayers
        .filter((player) => player.mapId === mapId)
        .sort((a, b) => a.y - b.y),
    [allRemotePlayers, mapId],
  );

  return {
    clientId,
    presenceStatus,
    presenceError,
    remotePlayers,
    allRemotePlayers,
  };
}
