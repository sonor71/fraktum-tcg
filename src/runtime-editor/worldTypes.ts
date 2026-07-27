export type RuntimeMode = "play" | "edit";
export type RoomType = "outdoor" | "indoor" | "dungeon" | "special";
export type MapObjectType = "ground" | "path" | "tree" | "bush" | "rock" | "building" | "stall" | "campfire" | "gate" | "door" | "chest" | "table" | "decoration" | "npc" | "effect" | "light" | "customSprite";
export type PointData = { x: number; y: number };

export interface WorldAssetData {
  id: string;
  name: string;
  source: string;
  type: MapObjectType;
  width: number;
  height: number;
  importedAt: string;
}

export interface ColliderData {
  id: string;
  type: "box" | "circle" | "polygon";
  offset: PointData;
  size?: { width: number; height: number };
  radius?: number;
  points?: PointData[];
  isTrigger: boolean;
  enabled: boolean;
  collisionLayer: string;
  metadata?: Record<string, unknown>;
}

export interface MapObjectData {
  id: string;
  assetId: string;
  name: string;
  type: MapObjectType;
  position: PointData;
  scale: PointData;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  width?: number;
  height?: number;
  sortingLayer: string;
  sortingOrder: number;
  opacity: number;
  tint: string;
  visible: boolean;
  locked: boolean;
  collider?: ColliderData;
  animationId?: string;
  shaderPreset?: string;
  metadata?: Record<string, unknown>;
}

export interface SpawnPointData {
  id: string;
  name: string;
  position: PointData;
  facing: "up" | "down" | "left" | "right";
  cameraOffset?: PointData;
  onEnterEventId?: string;
}

export interface PortalData {
  id: string;
  name: string;
  position: PointData;
  size: { width: number; height: number };
  destinationSceneId: string;
  destinationRoomId: string;
  destinationSpawnId: string;
  conditionId?: string;
  transitionType: "none" | "fade" | "blackFade" | "whiteFade" | "slide";
  transitionDuration: number;
  enabled: boolean;
  oneWay: boolean;
  preserveFacing: boolean;
  metadata?: Record<string, unknown>;
}

export interface RoomData {
  id: string;
  name: string;
  width: number;
  height: number;
  gridSize: number;
  roomType: RoomType;
  backgroundColor: string;
  musicOverride?: string;
  lightingOverride?: string;
  objects: MapObjectData[];
  colliders: ColliderData[];
  spawnPoints: SpawnPointData[];
  portals: PortalData[];
  metadata?: Record<string, unknown>;
}

export interface GameSceneData {
  id: string;
  name: string;
  defaultRoomId: string;
  musicId?: string;
  ambientPreset?: string;
  lightingPreset?: string;
  backgroundColor?: string;
  rooms: RoomData[];
}

export interface GameWorldData {
  version: number;
  startSceneId: string;
  scenes: GameSceneData[];
  assets?: WorldAssetData[];
}
