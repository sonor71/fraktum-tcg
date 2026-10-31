import { create } from "zustand";
import { DEFAULT_GAME_WORLD } from "./defaultWorld";
import { cloneWorld, loadStoredWorld, saveStoredWorld } from "./worldPersistence";
import type { GameSceneData, GameWorldData, MapObjectData, RoomData, RuntimeMode, WorldAssetData } from "./worldTypes";

type RuntimeEditorState = {
  mode: RuntimeMode;
  world: GameWorldData;
  currentSceneId: string;
  currentRoomId: string;
  selectedObjectId: string | null;
  isDirty: boolean;
  toggleEditor: () => void;
  setMode: (mode: RuntimeMode) => void;
  loadRoom: (sceneId: string, roomId: string) => boolean;
  createScene: (scene: GameSceneData) => boolean;
  createRoom: (sceneId: string, room: RoomData) => boolean;
  placeObject: (object: MapObjectData) => void;
  updateObject: (id: string, changes: Partial<MapObjectData>) => void;
  deleteObject: (id: string) => void;
  updateRoom: (changes: Partial<RoomData>) => void;
  addAsset: (asset: WorldAssetData) => void;
  selectObject: (id: string | null) => void;
  replaceWorld: (world: GameWorldData) => void;
  saveWorld: () => void;
};

const initialWorld = typeof window === "undefined" ? cloneWorld(DEFAULT_GAME_WORLD) : loadStoredWorld(DEFAULT_GAME_WORLD);
const initialScene = initialWorld.scenes.find((scene) => scene.id === initialWorld.startSceneId) ?? initialWorld.scenes[0];

export const useRuntimeEditorStore = create<RuntimeEditorState>((set, get) => ({
  mode: "play",
  world: initialWorld,
  currentSceneId: initialScene?.id ?? "",
  currentRoomId: initialScene?.defaultRoomId ?? "",
  selectedObjectId: null,
  isDirty: false,
  toggleEditor: () => set((state) => ({ mode: state.mode === "edit" ? "play" : "edit", selectedObjectId: null })),
  setMode: (mode) => set({ mode, selectedObjectId: null }),
  loadRoom: (sceneId, roomId) => {
    const scene = get().world.scenes.find((item) => item.id === sceneId);
    if (!scene?.rooms.some((room) => room.id === roomId)) return false;
    set({ currentSceneId: sceneId, currentRoomId: roomId, selectedObjectId: null });
    return true;
  },
  createScene: (scene) => {
    if (get().world.scenes.some((item) => item.id === scene.id)) return false;
    set((state) => ({ world: { ...state.world, scenes: [...state.world.scenes, scene] }, currentSceneId: scene.id, currentRoomId: scene.defaultRoomId, isDirty: true }));
    return true;
  },
  createRoom: (sceneId, room) => {
    const scene = get().world.scenes.find((item) => item.id === sceneId);
    if (!scene || scene.rooms.some((item) => item.id === room.id)) return false;
    set((state) => ({ world: { ...state.world, scenes: state.world.scenes.map((item) => item.id === sceneId ? { ...item, rooms: [...item.rooms, room] } : item) }, currentSceneId: sceneId, currentRoomId: room.id, isDirty: true }));
    return true;
  },
  placeObject: (object) => set((state) => ({
    world: { ...state.world, scenes: state.world.scenes.map((scene) => scene.id !== state.currentSceneId ? scene : { ...scene, rooms: scene.rooms.map((room) => room.id !== state.currentRoomId ? room : { ...room, objects: [...room.objects, object] }) }) },
    selectedObjectId: object.id, isDirty: true,
  })),
  updateObject: (id, changes) => set((state) => ({
    world: { ...state.world, scenes: state.world.scenes.map((scene) => scene.id !== state.currentSceneId ? scene : { ...scene, rooms: scene.rooms.map((room) => room.id !== state.currentRoomId ? room : { ...room, objects: room.objects.map((object) => object.id === id ? { ...object, ...changes } : object) }) }) },
    isDirty: true,
  })),
  deleteObject: (id) => set((state) => ({
    world: { ...state.world, scenes: state.world.scenes.map((scene) => scene.id !== state.currentSceneId ? scene : { ...scene, rooms: scene.rooms.map((room) => room.id !== state.currentRoomId ? room : { ...room, objects: room.objects.filter((object) => object.id !== id) }) }) },
    selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    isDirty: true,
  })),
  updateRoom: (changes) => set((state) => ({
    world: { ...state.world, scenes: state.world.scenes.map((scene) => scene.id !== state.currentSceneId ? scene : { ...scene, rooms: scene.rooms.map((room) => room.id === state.currentRoomId ? { ...room, ...changes } : room) }) },
    isDirty: true,
  })),
  addAsset: (asset) => set((state) => ({ world: { ...state.world, assets: [...(state.world.assets ?? []).filter((item) => item.id !== asset.id), asset] }, isDirty: true })),
  selectObject: (selectedObjectId) => set({ selectedObjectId }),
  replaceWorld: (world) => {
    const scene = world.scenes.find((item) => item.id === world.startSceneId) ?? world.scenes[0];
    set({ world: cloneWorld(world), currentSceneId: scene?.id ?? "", currentRoomId: scene?.defaultRoomId ?? "", selectedObjectId: null, isDirty: true });
  },
  saveWorld: () => { saveStoredWorld(get().world); set({ isDirty: false }); },
}));

if (typeof window !== "undefined") {
  window.setInterval(() => { const state = useRuntimeEditorStore.getState(); if (state.isDirty) state.saveWorld(); }, 30_000);
}
