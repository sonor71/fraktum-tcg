import { memo, useEffect, useRef, useState } from "react";
import { roomManager } from "./RoomManager";
import { useRuntimeEditorStore } from "./runtimeEditorStore";
import { downloadWorldJson, isGameWorldData } from "./worldPersistence";
import type { GameSceneData, MapObjectType, RoomData, RoomType } from "./worldTypes";
import "./developerEditor.css";

const ASSETS = [
  { id: "hub-map", name: "Hub ground", src: "/assets/hub/hub1.png", type: "ground" },
  { id: "market-map", name: "Market ground", src: "/assets/hub/market.png", type: "ground" },
  { id: "archive-map", name: "Archive ground", src: "/assets/hub/archive.png", type: "building" },
  { id: "arena-map", name: "Arena ground", src: "/assets/hub/arena.png", type: "ground" },
] as const satisfies ReadonlyArray<{ id: string; name: string; src: string; type: MapObjectType }>;
const EDITOR_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_RUNTIME_EDITOR === "true";

function slug(value: string) { return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, ""); }
function emptyRoom(id: string, name: string, input?: Partial<RoomData>): RoomData {
  return { id, name, width: 1280, height: 720, gridSize: 16, roomType: "outdoor", backgroundColor: "#081224", objects: [], colliders: [], portals: [], spawnPoints: [{ id: "default", name: "Default spawn", position: { x: 640, y: 360 }, facing: "down" }], ...input };
}

function SceneRoomTree({ onCreateScene, onCreateRoom }: { onCreateScene: () => void; onCreateRoom: () => void }) {
  const world = useRuntimeEditorStore((state) => state.world);
  const sceneId = useRuntimeEditorStore((state) => state.currentSceneId);
  const roomId = useRuntimeEditorStore((state) => state.currentRoomId);
  return <section className="devPanel devTree"><header><span>Scenes and Rooms</span><button onClick={onCreateScene}>+ Scene</button></header>
    <div className="devTreeScroll">{world.scenes.map((scene) => <div className="devScene" key={scene.id}><div className="devSceneTitle"><strong>▾ {scene.name}</strong><button onClick={() => { roomManager.loadScene(scene.id); }}>Open</button></div>{scene.rooms.map((room) => <button key={room.id} className={`devRoom ${sceneId === scene.id && roomId === room.id ? "is-active" : ""}`} onClick={() => roomManager.loadRoom(scene.id, room.id)}><i>{sceneId === scene.id && roomId === room.id ? "●" : "○"}</i><span>{room.name}<small>{room.id} · {room.width}×{room.height}</small></span></button>)}</div>)}</div>
    <button className="devWideButton" onClick={onCreateRoom} disabled={!sceneId}>+ Create room</button>
  </section>;
}

function AssetLibrary() {
  const [search, setSearch] = useState("");
  const placeObject = useRuntimeEditorStore((state) => state.placeObject);
  const filtered = ASSETS.filter((asset) => asset.name.toLowerCase().includes(search.toLowerCase()));
  const place = (asset: typeof ASSETS[number]) => placeObject({ id: `object_${crypto.randomUUID()}`, assetId: asset.src, name: asset.name, type: asset.type, position: { x: 320, y: 240 }, scale: { x: .2, y: .2 }, rotation: 0, flipX: false, flipY: false, sortingLayer: "world", sortingOrder: 0, opacity: 1, tint: "#ffffff", visible: true, locked: false });
  return <section className="devPanel devAssets"><header>Asset Library</header><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search existing assets" />
    <div className="devAssetGrid">{filtered.map((asset) => <button key={asset.id} onClick={() => place(asset)} title={`Place ${asset.name}`}><img src={asset.src} alt="" /><span>{asset.name}</span></button>)}</div><small>Click an asset to place it in the current room.</small></section>;
}

function EditorTopBar({ onImport }: { onImport: () => void }) {
  const world = useRuntimeEditorStore((state) => state.world);
  const dirty = useRuntimeEditorStore((state) => state.isDirty);
  const setMode = useRuntimeEditorStore((state) => state.setMode);
  const save = useRuntimeEditorStore((state) => state.saveWorld);
  return <div className="devTopBar"><strong>FRAKTUM <b>MAP EDITOR</b></strong><span className={dirty ? "is-dirty" : ""}>{dirty ? "Unsaved changes" : "Saved locally"}</span><div /><button onClick={save}>Save</button><button onClick={() => downloadWorldJson(world)}>Export JSON</button><button onClick={onImport}>Import JSON</button><button className="devPlay" onClick={() => setMode("play")}>▶ Play</button></div>;
}

function CreateModal({ kind, close }: { kind: "scene" | "room"; close: () => void }) {
  const currentSceneId = useRuntimeEditorStore((state) => state.currentSceneId);
  const createScene = useRuntimeEditorStore((state) => state.createScene);
  const createRoom = useRuntimeEditorStore((state) => state.createRoom);
  const [name, setName] = useState(kind === "scene" ? "New Scene" : "New Room");
  const [id, setId] = useState(kind === "scene" ? "new_scene" : "new_room");
  const [width, setWidth] = useState(1280); const [height, setHeight] = useState(720);
  const [roomType, setRoomType] = useState<RoomType>("outdoor"); const [error, setError] = useState("");
  const submit = (event: React.FormEvent) => { event.preventDefault(); const safeId = slug(id); if (!safeId) return setError("A valid unique ID is required.");
    if (kind === "scene") { const first = emptyRoom("main", "Main Room", { width, height, roomType }); const scene: GameSceneData = { id: safeId, name: name.trim(), defaultRoomId: first.id, backgroundColor: "#081224", rooms: [first] }; if (!createScene(scene)) return setError("Scene ID already exists."); }
    else { if (!createRoom(currentSceneId, emptyRoom(safeId, name.trim(), { width, height, roomType }))) return setError("Room ID already exists in this scene."); } close(); };
  return <div className="devModalBackdrop" onMouseDown={close}><form className="devModal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><header>Create {kind}</header><label>Name<input value={name} onChange={(event) => { setName(event.target.value); setId(slug(event.target.value)); }} /></label><label>ID<input value={id} onChange={(event) => setId(event.target.value)} /></label><div className="devFormRow"><label>Width<input type="number" min="320" value={width} onChange={(event) => setWidth(Number(event.target.value))} /></label><label>Height<input type="number" min="240" value={height} onChange={(event) => setHeight(Number(event.target.value))} /></label></div><label>Room type<select value={roomType} onChange={(event) => setRoomType(event.target.value as RoomType)}><option>outdoor</option><option>indoor</option><option>dungeon</option><option>special</option></select></label>{error && <p>{error}</p>}<footer><button type="button" onClick={close}>Cancel</button><button type="submit">Create</button></footer></form></div>;
}

export const RoomObjectLayer = memo(function RoomObjectLayer() {
  const world = useRuntimeEditorStore((state) => state.world); const sceneId = useRuntimeEditorStore((state) => state.currentSceneId); const roomId = useRuntimeEditorStore((state) => state.currentRoomId); const selected = useRuntimeEditorStore((state) => state.selectedObjectId); const select = useRuntimeEditorStore((state) => state.selectObject);
  const room = world.scenes.find((scene) => scene.id === sceneId)?.rooms.find((item) => item.id === roomId);
  return <>{room?.objects.filter((object) => object.visible).map((object) => <img key={object.id} className={`runtimeMapObject ${selected === object.id ? "is-selected" : ""}`} src={object.assetId} alt={object.name} onPointerDown={(event) => { event.stopPropagation(); select(object.id); }} style={{ left: object.position.x, top: object.position.y, width: object.width, height: object.height, opacity: object.opacity, zIndex: object.sortingOrder, transform: `translate(-50%, -50%) rotate(${object.rotation}deg) scale(${object.scale.x * (object.flipX ? -1 : 1)}, ${object.scale.y * (object.flipY ? -1 : 1)})` }} />)}</>;
});

export default function DeveloperEditor() {
  const mode = useRuntimeEditorStore((state) => state.mode); const replaceWorld = useRuntimeEditorStore((state) => state.replaceWorld); const [modal, setModal] = useState<"scene" | "room" | null>(null); const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!EDITOR_ENABLED) return; const key = (event: KeyboardEvent) => { if (event.key === "F10") { event.preventDefault(); useRuntimeEditorStore.getState().toggleEditor(); } if (event.ctrlKey && event.key.toLowerCase() === "s" && mode === "edit") { event.preventDefault(); useRuntimeEditorStore.getState().saveWorld(); } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, [mode]);
  const importFile = async (file?: File) => { if (!file) return; try { const parsed: unknown = JSON.parse(await file.text()); if (isGameWorldData(parsed)) replaceWorld(parsed); } finally { if (fileRef.current) fileRef.current.value = ""; } };
  if (!EDITOR_ENABLED || mode !== "edit") return null;
  return <div className="developerEditor"><EditorTopBar onImport={() => fileRef.current?.click()} /><input ref={fileRef} hidden type="file" accept="application/json,.json" onChange={(event) => void importFile(event.target.files?.[0])} /><div className="devLeftRail"><SceneRoomTree onCreateScene={() => setModal("scene")} onCreateRoom={() => setModal("room")} /><AssetLibrary /></div><aside className="devInspector devPanel"><header>Selection Inspector</header><p>Stage 1 foundation</p><small>Select an asset to place it. Object transforms, collider handles, portals, undo/redo and validation will be added only after approval for stage 2.</small><dl><dt>Mode</dt><dd>Select / Place</dd><dt>Grid snap</dt><dd>16 px</dd></dl></aside><div className="devStatus">F10 close · Ctrl+S save · Character controls locked</div>{modal && <CreateModal kind={modal} close={() => setModal(null)} />}</div>;
}
