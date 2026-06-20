export function EnemyHandView({ count }: { count: number }) {
  return (
    <div className="enemyHandFan" aria-label={`${count} enemy cards in hand`}>
      {Array.from({ length: count }, (_, index) => {
        const center = (count - 1) / 2;
        const offset = index - center;
        return (
          <div
            className="enemyHandCard"
            key={index}
            style={{
              transform: `translateX(${offset * 34}px) translateY(${Math.abs(offset) * -4}px) rotate(${offset * -7}deg)`,
              zIndex: count - index,
            }}
          >
            <img src="/cards/card-back.png" alt="Enemy card back" />
          </div>
        );
      })}
    </div>
  );
}
