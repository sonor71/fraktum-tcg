import type { HubMapId } from "./hubMaps";

export type HubQuickRoomId = Exclude<HubMapId, "hub1">;

export const HUB_QUICK_ROOMS = [
  { id: "market", label: "Market", title: "Go to The Market" },
  { id: "arena", label: "Arena", title: "Go to The Arena" },
  { id: "archive", label: "Archive", title: "Go to The Archive" },
] as const satisfies ReadonlyArray<{
  id: HubQuickRoomId;
  label: string;
  title: string;
}>;

const HUB_MAP_IDS = new Set<HubMapId>(["hub1", "market", "archive", "arena"]);

export function getHubRoomFromSearch(search: string): HubMapId {
  const requestedRoom = new URLSearchParams(search).get("room");
  return requestedRoom && HUB_MAP_IDS.has(requestedRoom as HubMapId)
    ? requestedRoom as HubMapId
    : "hub1";
}

export function createHubRoomSearch(roomId: HubMapId): string {
  if (roomId === "hub1") return "";

  const params = new URLSearchParams();
  params.set("room", roomId);
  return `?${params.toString()}`;
}
