import { useState } from "react";
import type { HubDirection } from "./hubMaps";

type PlayerSpriteProps = {
  direction: HubDirection;
  isMoving: boolean;
};

const DIRECTION_SPRITES: Record<HubDirection, string> = {
  down: "/assets/player/walk-down.png",
  up: "/assets/player/walk-up.png",
  left: "/assets/player/walk-left.png",
  right: "/assets/player/walk-right.png",
};

function getSpriteSource(direction: HubDirection, isMoving: boolean) {
  if (!isMoving) return "/assets/player/idle.png";
  return DIRECTION_SPRITES[direction];
}

export default function PlayerSprite({ direction, isMoving }: PlayerSpriteProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const spriteSource = getSpriteSource(direction, isMoving);

  return (
    <div className={`hubPlayerSprite is-${direction} ${isMoving ? "is-moving" : "is-idle"}`}>
      <div className="hubPlayerShadow" />
      <div className="hubPlayerFallback" aria-hidden="true">
        <span />
      </div>

      {!imageFailed ? (
        <img
          className="hubPlayerImage"
          src={spriteSource}
          alt="Fraktum pilot"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          className="hubPlayerSheet"
          aria-hidden="true"
          title="TODO: tune frameWidth/frameHeight/rows/cols in CSS when player-spritesheet.png is available."
        />
      )}
    </div>
  );
}
