import { HUB_MAPS, type HubMapId } from "../screens/Hub/hubMaps";
import { WORLD_FORMAT_VERSION } from "./worldPersistence";
import type { ColliderData, GameWorldData, PortalData, RoomData } from "./worldTypes";

const mapIds = Object.keys(HUB_MAPS) as HubMapId[];

function toRoom(mapId: HubMapId): RoomData {
  const map = HUB_MAPS[mapId];
  const colliders: ColliderData[] = (map.colliders ?? []).map((collider, index) => ({
    id: `${mapId}-${collider.id}-${index}`,
    type: "box",
    offset: { x: collider.x, y: collider.y },
    size: { width: collider.width, height: collider.height },
    isTrigger: false,
    enabled: true,
    collisionLayer: "world",
  }));
  const portals: PortalData[] = map.exits.filter((exit) => exit.type === "map-transition").map((exit) => ({
    id: exit.id,
    name: exit.label,
    position: { x: exit.x - exit.radius, y: exit.y - exit.radius },
    size: { width: exit.radius * 2, height: exit.radius * 2 },
    destinationSceneId: "fraktum_hub",
    destinationRoomId: exit.targetMap,
    destinationSpawnId: "default",
    transitionType: "fade",
    transitionDuration: 420,
    enabled: true,
    oneWay: false,
    preserveFacing: false,
    metadata: { legacyExitId: exit.id },
  }));
  return {
    id: map.id,
    name: map.title,
    width: map.width,
    height: map.height,
    gridSize: 16,
    roomType: mapId === "archive" ? "indoor" : "outdoor",
    backgroundColor: "#081224",
    objects: [], colliders, portals,
    spawnPoints: [{ id: "default", name: "Default spawn", position: map.spawnPoint, facing: "down" }],
    metadata: { backgroundAsset: map.image, legacyMapId: mapId },
  };
}

export const DEFAULT_GAME_WORLD: GameWorldData = {
  version: WORLD_FORMAT_VERSION,
  startSceneId: "fraktum_hub",
  scenes: [{
    id: "fraktum_hub",
    name: "Fraktum Hub",
    defaultRoomId: "hub1",
    ambientPreset: "hub",
    lightingPreset: "default",
    backgroundColor: "#081224",
    rooms: mapIds.map(toRoom),
  }],
};

