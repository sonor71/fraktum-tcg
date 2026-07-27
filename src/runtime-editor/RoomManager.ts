import { useRuntimeEditorStore } from "./runtimeEditorStore";
import type { GameSceneData, PortalData, RoomData, SpawnPointData } from "./worldTypes";

export class RoomManager {
  loadScene(sceneId: string) {
    const scene = useRuntimeEditorStore.getState().world.scenes.find((item) => item.id === sceneId);
    return scene ? this.loadRoom(sceneId, scene.defaultRoomId) : false;
  }
  loadRoom(sceneId: string, roomId: string, spawnId?: string) {
    const loaded = useRuntimeEditorStore.getState().loadRoom(sceneId, roomId);
    return loaded ? this.teleportPlayerToSpawn(spawnId) : undefined;
  }
  unloadCurrentRoom() { useRuntimeEditorStore.getState().selectObject(null); }
  instantiateRoomObjects() { return this.getCurrentRoom()?.objects ?? []; }
  restoreColliders() { return this.getCurrentRoom()?.colliders ?? []; }
  restorePortals(): PortalData[] { return this.getCurrentRoom()?.portals ?? []; }
  restoreSpawnPoints(): SpawnPointData[] { return this.getCurrentRoom()?.spawnPoints ?? []; }
  teleportPlayerToSpawn(spawnId?: string) {
    const points = this.restoreSpawnPoints();
    return points.find((point) => point.id === spawnId) ?? points[0];
  }
  saveCurrentRoom() { useRuntimeEditorStore.getState().saveWorld(); }
  getCurrentScene(): GameSceneData | undefined {
    const state = useRuntimeEditorStore.getState();
    return state.world.scenes.find((scene) => scene.id === state.currentSceneId);
  }
  getCurrentRoom(): RoomData | undefined {
    const state = useRuntimeEditorStore.getState();
    return this.getCurrentScene()?.rooms.find((room) => room.id === state.currentRoomId);
  }
}

export const roomManager = new RoomManager();
