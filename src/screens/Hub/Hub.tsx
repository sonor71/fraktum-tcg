import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PlayerSprite from "./PlayerSprite";
import "./hub.css";
import {
  HUB_MAPS,
  type HubCollider,
  type HubExit,
  type HubMapId,
  type HubOcclusionZone,
  type HubPoint,
} from "./hubMaps";
import { getPlayerCollisionRect, HUB_CAMERA_ZOOM, useHubMovement } from "./useHubMovement";

const TRANSITION_MS = 420;
const MIN_ZONE_SIZE = 4;

type EditorModeType = "collider" | "occlusion";
type SelectedZone = { type: EditorModeType; id: string } | null;
type HubRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function distance(a: HubPoint, b: HubPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createInitialColliderState(): Record<HubMapId, HubCollider[]> {
  return {
    hub1: [...(HUB_MAPS.hub1.colliders ?? [])],
    market: [...(HUB_MAPS.market.colliders ?? [])],
    archive: [...(HUB_MAPS.archive.colliders ?? [])],
    arena: [...(HUB_MAPS.arena.colliders ?? [])],
  };
}

function createInitialOcclusionState(): Record<HubMapId, HubOcclusionZone[]> {
  return {
    hub1: [...(HUB_MAPS.hub1.occlusionZones ?? [])],
    market: [...(HUB_MAPS.market.occlusionZones ?? [])],
    archive: [...(HUB_MAPS.archive.occlusionZones ?? [])],
    arena: [...(HUB_MAPS.arena.occlusionZones ?? [])],
  };
}

function normalizeZoneRect(start: HubPoint, end: HubPoint): HubRect {
  const x = Math.round(Math.min(start.x, end.x));
  const y = Math.round(Math.min(start.y, end.y));
  const width = Math.round(Math.abs(end.x - start.x));
  const height = Math.round(Math.abs(end.y - start.y));

  return { x, y, width, height };
}

function rectanglesOverlap(a: HubRect, b: HubRect) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function formatZoneArrayForExport(label: "colliders" | "occlusionZones", zones: Array<HubRect & { id: string }>) {
  if (zones.length === 0) return `${label}: []`;

  const lines = zones.map((zone) => {
    return `  { id: ${JSON.stringify(zone.id)}, x: ${Math.round(zone.x)}, y: ${Math.round(zone.y)}, width: ${Math.round(zone.width)}, height: ${Math.round(zone.height)} },`;
  });

  return `${label}: [\n${lines.join("\n")}\n]`;
}

function formatHubZonesForExport(colliders: HubCollider[], occlusionZones: HubOcclusionZone[]) {
  return `${formatZoneArrayForExport("colliders", colliders)}\n${formatZoneArrayForExport("occlusionZones", occlusionZones)}`;
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

function getNextZoneId(prefix: string, zones: { id: string }[]) {
  let index = zones.length + 1;
  let id = `${prefix}-${index}`;

  while (zones.some((zone) => zone.id === id)) {
    index += 1;
    id = `${prefix}-${index}`;
  }

  return id;
}

export default function Hub() {
  const navigate = useNavigate();
  const mapLayerRef = useRef<HTMLDivElement | null>(null);
  const [currentMapId, setCurrentMapId] = useState<HubMapId>("hub1");
  const [spawnPoint, setSpawnPoint] = useState<HubPoint>(HUB_MAPS.hub1.spawnPoint);
  const [mapDimensions, setMapDimensions] = useState({ width: HUB_MAPS.hub1.width, height: HUB_MAPS.hub1.height });
  const [debugMode, setDebugMode] = useState(false);
  const [editorEnabled, setEditorEnabled] = useState(false);
  const [editorModeType, setEditorModeType] = useState<EditorModeType>("collider");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mapColliders, setMapColliders] = useState<Record<HubMapId, HubCollider[]>>(createInitialColliderState);
  const [mapOcclusionZones, setMapOcclusionZones] = useState<Record<HubMapId, HubOcclusionZone[]>>(createInitialOcclusionState);
  const [draftZone, setDraftZone] = useState<{ type: EditorModeType; start: HubPoint; end: HubPoint } | null>(null);
  const [selectedZone, setSelectedZone] = useState<SelectedZone>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const currentMap = HUB_MAPS[currentMapId];
  const currentColliders = mapColliders[currentMapId];
  const currentOcclusionZones = mapOcclusionZones[currentMapId];

  const editableCurrentMap = useMemo(
    () => ({ ...currentMap, colliders: currentColliders, occlusionZones: currentOcclusionZones }),
    [currentMap, currentColliders, currentOcclusionZones]
  );

  const {
    viewportRef,
    position,
    camera,
    direction,
    isMoving,
    resetPosition,
    mapTransform,
  } = useHubMovement(editableCurrentMap, mapDimensions, spawnPoint);

  const nearbyExit = useMemo(() => {
    return currentMap.exits.find((exit) => distance(position, exit) <= exit.radius);
  }, [currentMap.exits, position]);

  const playerCollisionRect = useMemo(() => getPlayerCollisionRect(position), [position]);
  const isPlayerOccluded = useMemo(
    () => currentOcclusionZones.some((zone) => rectanglesOverlap(playerCollisionRect, zone)),
    [currentOcclusionZones, playerCollisionRect]
  );
  const draftZoneRect = useMemo(() => {
    if (!draftZone) return null;
    return normalizeZoneRect(draftZone.start, draftZone.end);
  }, [draftZone]);
  const exportedZones = useMemo(
    () => formatHubZonesForExport(currentColliders, currentOcclusionZones),
    [currentColliders, currentOcclusionZones]
  );

  const getMapPoint = useCallback((clientX: number, clientY: number): HubPoint | null => {
    const node = mapLayerRef.current;
    if (!node) return null;

    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    // The rect is the map layer after the current camera translate + HUB_CAMERA_ZOOM scale transform.
    // Dividing by the rendered scale converts the mouse position back into map/world coordinates.
    const renderedScaleX = rect.width / mapDimensions.width || HUB_CAMERA_ZOOM;
    const renderedScaleY = rect.height / mapDimensions.height || HUB_CAMERA_ZOOM;

    return {
      x: Math.min(Math.max((clientX - rect.left) / renderedScaleX, 0), mapDimensions.width),
      y: Math.min(Math.max((clientY - rect.top) / renderedScaleY, 0), mapDimensions.height),
    };
  }, [mapDimensions.height, mapDimensions.width]);

  const enterMap = useCallback((targetMap: HubMapId, point: HubPoint) => {
    setIsTransitioning(true);
    setSelectedZone(null);
    setDraftZone(null);
    window.setTimeout(() => {
      setCurrentMapId(targetMap);
      setSpawnPoint(point);
      setMapDimensions({ width: HUB_MAPS[targetMap].width, height: HUB_MAPS[targetMap].height });
      resetPosition(point);
      window.setTimeout(() => setIsTransitioning(false), TRANSITION_MS / 2);
    }, TRANSITION_MS);
  }, [resetPosition]);

  const activateExit = useCallback((exit: HubExit | undefined) => {
    if (!exit || isTransitioning) return;

    if (exit.type === "route") {
      navigate(exit.route);
      return;
    }

    enterMap(exit.targetMap, exit.spawnOnTarget);
  }, [enterMap, isTransitioning, navigate]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === "g") {
        setDebugMode((enabled) => !enabled);
        if (debugMode) setEditorEnabled(false);
        return;
      }
      if (key === "h") {
        setDebugMode(true);
        setEditorEnabled((enabled) => !enabled);
        return;
      }
      if (key === "c") {
        setDebugMode(true);
        setEditorEnabled(true);
        setEditorModeType("collider");
        setDraftZone(null);
        return;
      }
      if (key === "o") {
        setDebugMode(true);
        setEditorEnabled(true);
        setEditorModeType("occlusion");
        setDraftZone(null);
        return;
      }
      if (key === "delete" && editorEnabled && selectedZone) {
        event.preventDefault();

        if (selectedZone.type === "collider") {
          setMapColliders((collidersByMap) => ({
            ...collidersByMap,
            [currentMapId]: collidersByMap[currentMapId].filter((collider) => collider.id !== selectedZone.id),
          }));
        } else {
          setMapOcclusionZones((zonesByMap) => ({
            ...zonesByMap,
            [currentMapId]: zonesByMap[currentMapId].filter((zone) => zone.id !== selectedZone.id),
          }));
        }

        setSelectedZone(null);
        setCopyStatus("");
        return;
      }
      if (key === "e") {
        activateExit(nearbyExit);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activateExit, currentMapId, debugMode, editorEnabled, nearbyExit, selectedZone]);

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setMapDimensions({ width: naturalWidth, height: naturalHeight });
    }
  }

  function handleMapPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!editorEnabled || event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest("button")) return;

    const point = getMapPoint(event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedZone(null);
    setCopyStatus("");
    setDraftZone({ type: editorModeType, start: point, end: point });
  }

  function handleMapPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!editorEnabled || !draftZone) return;

    const point = getMapPoint(event.clientX, event.clientY);
    if (!point) return;

    setDraftZone((draft) => draft ? { ...draft, end: point } : draft);
  }

  function handleMapPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!editorEnabled || !draftZone) return;

    const point = getMapPoint(event.clientX, event.clientY);
    const finalDraft = point ? { ...draftZone, end: point } : draftZone;
    const rect = normalizeZoneRect(finalDraft.start, finalDraft.end);

    setDraftZone(null);

    if (rect.width < MIN_ZONE_SIZE || rect.height < MIN_ZONE_SIZE) return;

    if (finalDraft.type === "collider") {
      const id = getNextZoneId("collider", currentColliders);
      const collider = { id, ...rect };

      setMapColliders((collidersByMap) => ({
        ...collidersByMap,
        [currentMapId]: [...collidersByMap[currentMapId], collider],
      }));
      setSelectedZone({ type: "collider", id });
    } else {
      const id = getNextZoneId("occlusion", currentOcclusionZones);
      const zone = { id, ...rect };

      setMapOcclusionZones((zonesByMap) => ({
        ...zonesByMap,
        [currentMapId]: [...zonesByMap[currentMapId], zone],
      }));
      setSelectedZone({ type: "occlusion", id });
    }

    setCopyStatus("");
  }

  function handleZonePointerDown(event: React.PointerEvent<HTMLDivElement>, type: EditorModeType, id: string) {
    if (!editorEnabled) return;

    event.preventDefault();
    event.stopPropagation();
    setSelectedZone({ type, id });
    setEditorModeType(type);
    setCopyStatus("");
  }

  function copyZonesJson() {
    setCopyStatus("");

    if (!navigator.clipboard) {
      setCopyStatus("Clipboard unavailable — copy from the textarea below.");
      return;
    }

    void navigator.clipboard.writeText(exportedZones).then(
      () => setCopyStatus("Copied Hub zones JSON."),
      () => setCopyStatus("Clipboard failed — copy from the textarea below.")
    );
  }

  function goToHub() {
    if (currentMapId === "hub1") return;
    enterMap("hub1", HUB_MAPS.hub1.spawnPoint);
  }

  function quickMap(target: HubMapId) {
    enterMap(target, HUB_MAPS[target].spawnPoint);
  }

  return (
    <section className={`hubWorld ${debugMode ? "is-debug" : ""} ${editorEnabled ? "is-hub-zone-editing" : ""}`}>
      <div className="hubWorldTopOverlay">
        <div className="hubZoneTitle">
          <span>Current zone</span>
          <strong>{currentMap.title}</strong>
          {debugMode ? <small>x:{Math.round(position.x)} y:{Math.round(position.y)}</small> : null}
        </div>
        <nav className="hubQuickNav" aria-label="Hub quick navigation">
          <button type="button" onClick={goToHub}>Hub</button>
          <button type="button" onClick={() => navigate("/collection")}>Collection</button>
          <button type="button" onClick={() => navigate("/deck-builder")}>Deck Builder</button>
          <button type="button" onClick={() => quickMap("market")}>Shop</button>
          <button type="button" onClick={() => navigate("/profile")}>Profile</button>
          <button type="button" onClick={() => navigate("/settings")}>Settings</button>
        </nav>
      </div>

      <div className="hubViewport" ref={viewportRef}>
        <div
          className="hubMapLayer"
          ref={mapLayerRef}
          style={{
            width: mapDimensions.width,
            height: mapDimensions.height,
            transform: mapTransform,
          }}
          onPointerDown={handleMapPointerDown}
          onPointerMove={handleMapPointerMove}
          onPointerUp={handleMapPointerUp}
        >
          <img
            className="hubMapImage"
            src={currentMap.image}
            alt={currentMap.title}
            draggable={false}
            onLoad={handleImageLoad}
            onError={(event) => {
              event.currentTarget.style.opacity = "0";
            }}
          />
          <div className="hubMapFallback" aria-hidden="true">
            <strong>{currentMap.title}</strong>
            <span>Place PNG at {currentMap.image}</span>
          </div>

          {currentMap.exits.map((exit) => {
            const isActive = nearbyExit?.id === exit.id;
            return (
              <button
                key={exit.id}
                type="button"
                className={`hubExitZone ${isActive ? "is-active" : ""}`}
                style={{
                  left: exit.x,
                  top: exit.y,
                  width: exit.radius * 2,
                  height: exit.radius * 2,
                }}
                onClick={() => activateExit(exit)}
                aria-label={exit.prompt}
              >
                <span>{exit.label}</span>
              </button>
            );
          })}
          {debugMode
            ? currentColliders.map((collider) => {
                const isSelected = selectedZone?.type === "collider" && selectedZone.id === collider.id;
                return (
                  <div
                    key={collider.id}
                    className={`hubColliderDebug ${isSelected ? "is-selected" : ""}`}
                    style={{
                      left: collider.x,
                      top: collider.y,
                      width: collider.width,
                      height: collider.height,
                    }}
                    onPointerDown={(event) => handleZonePointerDown(event, "collider", collider.id)}
                  >
                    <span className="hubColliderDebugLabel">
                      {collider.id} x:{Math.round(collider.x)} y:{Math.round(collider.y)} w:{Math.round(collider.width)} h:{Math.round(collider.height)}
                    </span>
                  </div>
                );
              })
            : null}

          {debugMode
            ? currentOcclusionZones.map((zone) => {
                const isSelected = selectedZone?.type === "occlusion" && selectedZone.id === zone.id;
                return (
                  <div
                    key={zone.id}
                    className={`hubOcclusionDebug ${isSelected ? "is-selected" : ""}`}
                    style={{
                      left: zone.x,
                      top: zone.y,
                      width: zone.width,
                      height: zone.height,
                    }}
                    onPointerDown={(event) => handleZonePointerDown(event, "occlusion", zone.id)}
                  >
                    <span className="hubOcclusionDebugLabel">
                      {zone.id} x:{Math.round(zone.x)} y:{Math.round(zone.y)} w:{Math.round(zone.width)} h:{Math.round(zone.height)}
                    </span>
                  </div>
                );
              })
            : null}

          {debugMode && draftZoneRect ? (
            <div
              className={draftZone?.type === "occlusion" ? "hubOcclusionDraftDebug" : "hubColliderDraftDebug"}
              style={{
                left: draftZoneRect.x,
                top: draftZoneRect.y,
                width: draftZoneRect.width,
                height: draftZoneRect.height,
              }}
            />
          ) : null}

          {debugMode ? (
            <div
              className="hubPlayerCollisionDebug"
              style={{
                left: playerCollisionRect.x,
                top: playerCollisionRect.y,
                width: playerCollisionRect.width,
                height: playerCollisionRect.height,
              }}
            />
          ) : null}

          <div
            className="hubPlayerAnchor"
            style={{ left: position.x, top: position.y }}
          >
            <div className="hubPlayerLocator" aria-hidden="true" />
            <div className={`hubPlayerVisual ${isPlayerOccluded ? "is-occluded" : ""}`}>
              <PlayerSprite direction={direction} isMoving={isMoving} />
            </div>
            {nearbyExit ? <div className="hubPromptAbove">{nearbyExit.prompt}</div> : null}
          </div>
        </div>
      </div>

      <div className="hubBottomPrompt">
        {nearbyExit ? (
          <>
            <span>{nearbyExit.label}</span>
            <strong>{nearbyExit.prompt}</strong>
          </>
        ) : (
          <>
            <span>Explore</span>
            <strong>WASD / Arrow Keys to move · G debug · H editor · C colliders · O occlusion</strong>
          </>
        )}
      </div>

      {debugMode ? (
        <div className="hubDebugPanel">
          <strong>{editorEnabled ? `Hub editor: ${editorModeType}` : "Debug zones enabled"}</strong>
          <span>Map: {currentMap.id} ({mapDimensions.width}×{mapDimensions.height})</span>
          <span>Player: x {position.x.toFixed(1)}, y {position.y.toFixed(1)}</span>
          <span>Camera: x {camera.x.toFixed(1)}, y {camera.y.toFixed(1)}</span>
          <span>Colliders: {currentColliders.length} · Occlusion: {currentOcclusionZones.length}</span>
          <span>Press H editor · C colliders · O occlusion</span>
          {editorEnabled ? (
            <div className="hubColliderEditorPanel">
              <div className="hubEditorModeButtons" role="group" aria-label="Hub zone editor mode">
                <button
                  type="button"
                  className={editorModeType === "collider" ? "is-active" : ""}
                  onClick={() => setEditorModeType("collider")}
                >
                  Draw Colliders (C)
                </button>
                <button
                  type="button"
                  className={editorModeType === "occlusion" ? "is-active" : ""}
                  onClick={() => setEditorModeType("occlusion")}
                >
                  Draw Occlusion (O)
                </button>
              </div>
              <button type="button" onClick={copyZonesJson}>Copy Colliders JSON</button>
              {copyStatus ? <span>{copyStatus}</span> : null}
              <textarea
                className="hubColliderExport"
                readOnly
                value={exportedZones}
                aria-label="Exported Hub zone JSON"
                onFocus={(event) => event.currentTarget.select()}
              />
              <small>Drag on the map to draw · Click a zone to select · Delete removes selected</small>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`hubFade ${isTransitioning ? "is-active" : ""}`} />
    </section>
  );
}
