export function EnemyHandView({ count }: { count: number }) {
  const safeCount = Math.max(0, Math.min(count, 14));
  const center = (safeCount - 1) / 2;
  const spacing = safeCount > 10 ? 34 : safeCount > 7 ? 39 : 45;

  return (
    <div className="enemyHandFan" aria-label={`${count} enemy cards in hand`} data-count={safeCount}>
      {Array.from({ length: safeCount }, (_, index) => {
        const offset = index - center;
        const normalized = center <= 0 ? 0 : offset / center;
        const bendTowardEnemy = -26 + Math.abs(normalized) * 18;
        const rotation = offset * 7.25;
        const depth = 80 - Math.abs(offset);

        return (
          <div
            className="enemyHandCard"
            key={index}
            style={{
              transform: `translate3d(${offset * spacing}px, ${bendTowardEnemy}px, 0) rotate(${rotation}deg)`,
              zIndex: depth,
            }}
          >
            <div className="enemyHandCardInner">
              <img className="enemyCardBack" src="/cards/card-back.png" alt="Enemy card back" draggable={false} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
