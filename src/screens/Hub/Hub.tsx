import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import PlayerSprite from "./PlayerSprite";
import "./hub.css";
import { HUB_MAPS, type HubCollider, type HubExit, type HubMapId, type HubPoint } from "./hubMaps";
import { getPlayerCollisionRect, HUB_CAMERA_ZOOM, useHubMovement } from "./useHubMovement";

const TRANSITION_MS = 420;
const MIN_COLLIDER_SIZE = 4;

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

function normalizeColliderRect(start: HubPoint, end: HubPoint) {
  const x = Math.round(Math.min(start.x, end.x));
  const y = Math.round(Math.min(start.y, end.y));
  const width = Math.round(Math.abs(end.x - start.x));
  const height = Math.round(Math.abs(end.y - start.y));

  return { x, y, width, height };
}

function formatCollidersForExport(colliders: HubCollider[]) {
  if (colliders.length === 0) return "colliders: []";

  const lines = colliders.map((collider) => {
    return `  { id: ${JSON.stringify(collider.id)}, x: ${Math.round(collider.x)}, y: ${Math.round(collider.y)}, width: ${Math.round(collider.width)}, height: ${Math.round(collider.height)} },`;
  });

  return `colliders: [\n${lines.join("\n")}\n]`;
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, [contenteditable='true']"));
}

function getNextColliderId(colliders: HubCollider[]) {
  const prefix = "collider";
  let index = colliders.length + 1;
  let id = `${prefix}-${index}`;

  while (colliders.some((collider) => collider.id === id)) {
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
  const [colliderEditMode, setColliderEditMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mapColliders, setMapColliders] = useState<Record<HubMapId, HubCollider[]>>(createInitialColliderState);
  const [draftCollider, setDraftCollider] = useState<{ start: HubPoint; end: HubPoint } | null>(null);
  const [selectedColliderId, setSelectedColliderId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const currentMap = HUB_MAPS[currentMapId];
  const currentColliders = mapColliders[currentMapId];

  const editableCurrentMap = useMemo(
    () => ({ ...currentMap, colliders: currentColliders }),
    [currentMap, currentColliders]
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
  const draftColliderRect = useMemo(() => {
    if (!draftCollider) return null;
    return normalizeColliderRect(draftCollider.start, draftCollider.end);
  }, [draftCollider]);
  const exportedColliders = useMemo(() => formatCollidersForExport(currentColliders), [currentColliders]);

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
    setSelectedColliderId(null);
    setDraftCollider(null);
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
        if (debugMode) setColliderEditMode(false);
        return;
      }
      if (key === "h") {
        setDebugMode(true);
        setColliderEditMode((enabled) => !enabled);
        return;
      }
      if (key === "delete" && colliderEditMode && selectedColliderId) {
        event.preventDefault();
        setMapColliders((collidersByMap) => ({
          ...collidersByMap,
          [currentMapId]: collidersByMap[currentMapId].filter((collider) => collider.id !== selectedColliderId),
        }));
        setSelectedColliderId(null);
        setCopyStatus("");
        return;
      }
      if (key === "e") {
        activateExit(nearbyExit);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activateExit, colliderEditMode, currentMapId, debugMode, nearbyExit, selectedColliderId]);

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setMapDimensions({ width: naturalWidth, height: naturalHeight });
    }
  }

  function handleMapPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!colliderEditMode || event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest("button")) return;

    const point = getMapPoint(event.clientX, event.clientY);
    if (!point) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedColliderId(null);
    setCopyStatus("");
    setDraftCollider({ start: point, end: point });
  }

  function handleMapPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!colliderEditMode || !draftCollider) return;

    const point = getMapPoint(event.clientX, event.clientY);
    if (!point) return;

    setDraftCollider((draft) => draft ? { ...draft, end: point } : draft);
  }

  function handleMapPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!colliderEditMode || !draftCollider) return;

    const point = getMapPoint(event.clientX, event.clientY);
    const finalDraft = point ? { ...draftCollider, end: point } : draftCollider;
    const rect = normalizeColliderRect(finalDraft.start, finalDraft.end);

    setDraftCollider(null);

    if (rect.width < MIN_COLLIDER_SIZE || rect.height < MIN_COLLIDER_SIZE) return;

    const id = getNextColliderId(currentColliders);
    const collider = { id, ...rect };

    setMapColliders((collidersByMap) => ({
      ...collidersByMap,
      [currentMapId]: [...collidersByMap[currentMapId], collider],
    }));
    setSelectedColliderId(id);
    setCopyStatus("");
  }

  function handleColliderPointerDown(event: React.PointerEvent<HTMLDivElement>, colliderId: string) {
    if (!colliderEditMode) return;

    event.preventDefault();
    event.stopPropagation();
    setSelectedColliderId(colliderId);
    setCopyStatus("");
  }

  function copyCollidersJson() {
    setCopyStatus("");

    if (!navigator.clipboard) {
      setCopyStatus("Clipboard unavailable — copy from the textarea below.");
      return;
    }

    void navigator.clipboard.writeText(exportedColliders).then(
      () => setCopyStatus("Copied colliders JSON."),
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
    <section className={`hubWorld ${debugMode ? "is-debug" : ""} ${colliderEditMode ? "is-collider-editing" : ""}`}>
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
                const isSelected = selectedColliderId === collider.id;
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
                    onPointerDown={(event) => handleColliderPointerDown(event, collider.id)}
                  >
                    <span className="hubColliderDebugLabel">
                      {collider.id} x:{Math.round(collider.x)} y:{Math.round(collider.y)} w:{Math.round(collider.width)} h:{Math.round(collider.height)}
                    </span>
                  </div>
                );
              })
            : null}

          {debugMode && draftColliderRect ? (
            <div
              className="hubColliderDraftDebug"
              style={{
                left: draftColliderRect.x,
                top: draftColliderRect.y,
                width: draftColliderRect.width,
                height: draftColliderRect.height,
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
            <PlayerSprite direction={direction} isMoving={isMoving} />
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
            <strong>WASD / Arrow Keys to move · G for debug zones · H for collider editor</strong>
          </>
        )}
      </div>

      {debugMode ? (
        <div className="hubDebugPanel">
          <strong>{colliderEditMode ? "Collider editor enabled" : "Debug zones enabled"}</strong>
          <span>Map: {currentMap.id} ({mapDimensions.width}×{mapDimensions.height})</span>
          <span>Player: x {position.x.toFixed(1)}, y {position.y.toFixed(1)}</span>
          <span>Camera: x {camera.x.toFixed(1)}, y {camera.y.toFixed(1)}</span>
          <span>Colliders: {currentColliders.length} · Press H to {colliderEditMode ? "exit" : "edit"}</span>
          {colliderEditMode ? (
            <div className="hubColliderEditorPanel">
              <button type="button" onClick={copyCollidersJson}>Copy Colliders JSON</button>
              {copyStatus ? <span>{copyStatus}</span> : null}
              <textarea
                className="hubColliderExport"
                readOnly
                value={exportedColliders}
                aria-label="Exported collider JSON"
                onFocus={(event) => event.currentTarget.select()}
              />
              <small>Drag on the map to draw · Click a collider to select · Delete removes selected</small>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={`hubFade ${isTransitioning ? "is-active" : ""}`} />
    </section>
  );
}
