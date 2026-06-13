import { useEffect, useState } from "react";
import type { HubDirection } from "./hubMaps";

type PlayerSpriteProps = {
  direction: HubDirection;
  isMoving: boolean;
};

const PLAYER_FRAME_WIDTH = 96;
const PLAYER_FRAME_HEIGHT = 80;
const PLAYER_FRAME_COUNT = 8;
const PLAYER_RENDER_SCALE = 1.5;

const IDLE_FRAME_MS = 170;
const RUN_FRAME_MS = 90;

const SPRITES: Record<"idle" | "run", Record<HubDirection, string>> = {
  idle: {
    down: "/assets/hub/player/idle_down.png",
    up: "/assets/hub/player/idle_up.png",
    left: "/assets/hub/player/idle_left.png",
    right: "/assets/hub/player/idle_right.png",
  },
  run: {
    down: "/assets/hub/player/run_down.png",
    up: "/assets/hub/player/run_up.png",
    left: "/assets/hub/player/run_left.png",
    right: "/assets/hub/player/run_right.png",
  },
};

export default function PlayerSprite({ direction, isMoving }: PlayerSpriteProps) {
  const [frame, setFrame] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);

  const state = isMoving ? "run" : "idle";
  const spriteSource = SPRITES[state][direction];

  useEffect(() => {
    setImageFailed(false);
    setFrame(0);
  }, [spriteSource]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFrame((current) => (current + 1) % PLAYER_FRAME_COUNT);
    }, isMoving ? RUN_FRAME_MS : IDLE_FRAME_MS);

    return () => window.clearInterval(interval);
  }, [isMoving]);

  return (
    <div
      className={`hubPlayerSprite is-${direction} ${isMoving ? "is-moving" : "is-idle"}`}
      style={{
        width: PLAYER_FRAME_WIDTH,
        height: PLAYER_FRAME_HEIGHT,
        transform: `translate(-50%, -100%) scale(${PLAYER_RENDER_SCALE})`,
      }}
    >
      <div className="hubPlayerShadow" />

      {imageFailed ? (
        <div className="hubPlayerFallback" aria-hidden="true">
          <span />
        </div>
      ) : (
        <div
          className="hubPlayerImage"
          role="img"
          aria-label="Fraktum pilot"
          style={{
            width: PLAYER_FRAME_WIDTH,
            height: PLAYER_FRAME_HEIGHT,
            backgroundImage: `url(${spriteSource})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${PLAYER_FRAME_WIDTH * PLAYER_FRAME_COUNT}px ${PLAYER_FRAME_HEIGHT}px`,
            backgroundPosition: `${-frame * PLAYER_FRAME_WIDTH}px 0px`,
            imageRendering: "pixelated",
          }}
        >
          <img
            src={spriteSource}
            alt=""
            aria-hidden="true"
            draggable={false}
            onError={() => setImageFailed(true)}
            style={{ display: "none" }}
          />
        </div>
      )}
    </div>
  );
}
