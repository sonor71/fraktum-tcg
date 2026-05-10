import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HubBounds, HubDirection, HubMapConfig, HubPoint } from "./hubMaps";
import { HUB_PLAYER_SPEED } from "./hubMaps";

type Camera = HubPoint;

type Size = {
  width: number;
  height: number;
};

const MOVEMENT_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);

const CAMERA_ZOOM = 1.5;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBounds(map: HubMapConfig, dimensions: Size): HubBounds {
  return map.allowedBounds ?? { x: 0, y: 0, width: dimensions.width, height: dimensions.height };
}

function getCameraTarget(player: HubPoint, viewport: Size): Camera {
  const visibleWidth = viewport.width / CAMERA_ZOOM;
  const visibleHeight = viewport.height / CAMERA_ZOOM;

  return {
    x: player.x - visibleWidth / 2,
    y: player.y - visibleHeight / 2,
  };
}

function resolveDirection(dx: number, dy: number, fallback: HubDirection): HubDirection {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  if (dy !== 0) return dy > 0 ? "down" : "up";
  return fallback;
}

export function useHubMovement(map: HubMapConfig, dimensions: Size, initialPoint: HubPoint) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const positionRef = useRef(initialPoint);
  const cameraRef = useRef<Camera>({ x: 0, y: 0 });
  const lastDirectionRef = useRef<HubDirection>("down");

  const [position, setPosition] = useState(initialPoint);
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0 });
  const [direction, setDirection] = useState<HubDirection>("down");
  const [isMoving, setIsMoving] = useState(false);
  const [viewport, setViewport] = useState<Size>({ width: 1, height: 1 });

  const resetPosition = useCallback(
    (point: HubPoint) => {
      keysRef.current.clear();

      const nextCamera = getCameraTarget(point, viewport);

      positionRef.current = point;
      cameraRef.current = nextCamera;

      setPosition(point);
      setCamera(nextCamera);
      setIsMoving(false);
    },
    [viewport]
  );

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return undefined;

    const updateViewport = () => {
      setViewport({ width: node.clientWidth, height: node.clientHeight });
    };

    updateViewport();

    const observer = new ResizeObserver(updateViewport);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!MOVEMENT_KEYS.has(key)) return;

      event.preventDefault();
      keysRef.current.add(key);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysRef.current.delete(event.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    positionRef.current = initialPoint;

    const nextCamera = getCameraTarget(initialPoint, viewport);
    cameraRef.current = nextCamera;

    setPosition(initialPoint);
    setCamera(nextCamera);
  }, [initialPoint, viewport]);

  useEffect(() => {
    let frame = 0;
    let lastTime = performance.now();

    const tick = (time: number) => {
      const deltaSeconds = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      let dx = 0;
      let dy = 0;

      const keys = keysRef.current;

      if (keys.has("w") || keys.has("arrowup")) dy -= 1;
      if (keys.has("s") || keys.has("arrowdown")) dy += 1;
      if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
      if (keys.has("d") || keys.has("arrowright")) dx += 1;

      const moving = dx !== 0 || dy !== 0;

      if (moving) {
        const length = Math.hypot(dx, dy) || 1;
        const bounds = getBounds(map, dimensions);

        const next = {
          x: clamp(
            positionRef.current.x + (dx / length) * HUB_PLAYER_SPEED * deltaSeconds,
            bounds.x,
            bounds.x + bounds.width
          ),
          y: clamp(
            positionRef.current.y + (dy / length) * HUB_PLAYER_SPEED * deltaSeconds,
            bounds.y,
            bounds.y + bounds.height
          ),
        };

        positionRef.current = next;
        setPosition(next);

        const nextDirection = resolveDirection(dx, dy, lastDirectionRef.current);
        lastDirectionRef.current = nextDirection;
        setDirection(nextDirection);
      }

      setIsMoving(moving);

      const nextCamera = getCameraTarget(positionRef.current, viewport);

      cameraRef.current = nextCamera;
      setCamera(nextCamera);

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [dimensions, map, viewport]);

  const mapTransform = useMemo(
    () =>
      `translate3d(${-camera.x * CAMERA_ZOOM}px, ${-camera.y * CAMERA_ZOOM}px, 0) scale(${CAMERA_ZOOM})`,
    [camera.x, camera.y]
  );

  return {
    viewportRef,
    position,
    camera,
    direction,
    isMoving,
    viewport,
    resetPosition,
    mapTransform,
  };
}