type EnemyHandViewProps = {
  count: number;
};

type EnemyCardPose = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  zIndex: number;
};

const MAX_VISIBLE_ENEMY_CARDS = 14;

function clampEnemyHandCount(count: number) {
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.min(Math.round(count), MAX_VISIBLE_ENEMY_CARDS));
}

function getEnemyCardPose(index: number, count: number): EnemyCardPose {
  if (count <= 1) {
    return {
      x: 0,
      y: -30,
      rotation: 0,
      scale: 1,
      zIndex: 100,
    };
  }

  const center = (count - 1) / 2;
  const offset = index - center;
  const abs = Math.abs(offset);
  const normalized = Math.min(1, abs / Math.max(1, center));
  const spacing = Math.max(36, Math.min(64, 600 / Math.max(1, count - 1)));

  return {
    x: offset * spacing,
    // Top hand must bend toward the opponent/top edge, not toward the player.
    y: -42 + Math.pow(normalized, 1.55) * 34,
    rotation: Math.max(-30, Math.min(30, offset * 5.7)),
    scale: 1 - normalized * 0.055,
    zIndex: Math.round(120 - abs * 3 + index),
  };
}

function buildEnemyCardTransform(pose: EnemyCardPose) {
  return `translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rotation}deg) scale(${pose.scale})`;
}

export function EnemyHandView({ count }: EnemyHandViewProps) {
  const visibleCount = clampEnemyHandCount(count);
  const hiddenCount = Math.max(0, count - visibleCount);

  if (visibleCount === 0) {
    return (
      <div className="enemyHandFan is-empty" aria-label="Enemy hand is empty" data-count="0">
        <span className="enemyHandEmpty">ENEMY HAND EMPTY</span>
      </div>
    );
  }

  return (
    <div
      className="enemyHandFan"
      aria-label={`${count} enemy cards in hand`}
      data-count={visibleCount}
      data-hidden-count={hiddenCount}
    >
      <span className="enemyHandCountBadge" aria-hidden="true">
        {count}
      </span>

      {Array.from({ length: visibleCount }, (_, index) => {
        const pose = getEnemyCardPose(index, visibleCount);

        return (
          <div
            className="enemyHandCard"
            key={`enemy-card-back-${index}`}
            style={{
              transform: buildEnemyCardTransform(pose),
              zIndex: pose.zIndex,
            }}
            aria-hidden="true"
          >
            <div className="enemyHandCardInner">
              <span className="enemyHandCardBackFallback">F</span>
              <img
                className="enemyCardBack"
                src="/cards/card-back.png"
                alt=""
                draggable={false}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
