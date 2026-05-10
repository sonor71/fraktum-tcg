import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PlayerSprite from "./PlayerSprite";
import "./hub.css";
import { HUB_MAPS, type HubExit, type HubMapId, type HubPoint } from "./hubMaps";
import { getPlayerCollisionRect, useHubMovement } from "./useHubMovement";

const TRANSITION_MS = 420;

function distance(a: HubPoint, b: HubPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}


export default function Hub() {
  const navigate = useNavigate();
  const [currentMapId, setCurrentMapId] = useState<HubMapId>("hub1");
  const [spawnPoint, setSpawnPoint] = useState<HubPoint>(HUB_MAPS.hub1.spawnPoint);
  const [mapDimensions, setMapDimensions] = useState({ width: HUB_MAPS.hub1.width, height: HUB_MAPS.hub1.height });
  const [debugMode, setDebugMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const currentMap = HUB_MAPS[currentMapId];

  const {
    viewportRef,
    position,
    camera,
    direction,
    isMoving,
    resetPosition,
    mapTransform,
  } = useHubMovement(currentMap, mapDimensions, spawnPoint);

  const nearbyExit = useMemo(() => {
    return currentMap.exits.find((exit) => distance(position, exit) <= exit.radius);
  }, [currentMap.exits, position]);

  const playerCollisionRect = useMemo(() => getPlayerCollisionRect(position), [position]);

  const enterMap = useCallback((targetMap: HubMapId, point: HubPoint) => {
    setIsTransitioning(true);
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
      const key = event.key.toLowerCase();
      if (key === "g") {
        setDebugMode((enabled) => !enabled);
        return;
      }
      if (key === "e") {
        activateExit(nearbyExit);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activateExit, nearbyExit]);

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) {
      setMapDimensions({ width: naturalWidth, height: naturalHeight });
    }
  }

  function goToHub() {
    if (currentMapId === "hub1") return;
    enterMap("hub1", HUB_MAPS.hub1.spawnPoint);
  }

  function quickMap(target: HubMapId) {
    enterMap(target, HUB_MAPS[target].spawnPoint);
  }

  return (
    <section className={`hubWorld ${debugMode ? "is-debug" : ""}`}>
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
          style={{
            width: mapDimensions.width,
            height: mapDimensions.height,
            transform: mapTransform,
          }}
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
            ? currentMap.colliders?.map((collider) => (
                <div
                  key={collider.id}
                  className="hubColliderDebug"
                  style={{
                    left: collider.x,
                    top: collider.y,
                    width: collider.width,
                    height: collider.height,
                  }}
                >
                  <span className="hubColliderDebugLabel">{collider.id}</span>
                </div>
              ))
            : null}

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
            <strong>WASD / Arrow Keys to move · G for debug zones</strong>
          </>
        )}
      </div>

      {debugMode ? (
        <div className="hubDebugPanel">
          <strong>Debug zones enabled</strong>
          <span>Map: {currentMap.id} ({mapDimensions.width}×{mapDimensions.height})</span>
          <span>Player: x {position.x.toFixed(1)}, y {position.y.toFixed(1)}</span>
          <span>Camera: x {camera.x.toFixed(1)}, y {camera.y.toFixed(1)}</span>
        </div>
      ) : null}

      <div className={`hubFade ${isTransitioning ? "is-active" : ""}`} />
    </section>
  );
}
