export function nextRandom(seed: number) {
  const next = (seed * 1664525 + 1013904223) >>> 0;
  return { seed: next, value: next / 4294967296 };
}

export function rollDie(seed: number, sides: number) {
  const roll = nextRandom(seed);
  return { seed: roll.seed, value: Math.floor(roll.value * sides) + 1 };
}

export function shuffleWithSeed<T>(items: T[], seed: number) {
  const result = [...items];
  let nextSeed = seed;
  for (let index = result.length - 1; index > 0; index -= 1) {
    const roll = rollDie(nextSeed, index + 1);
    nextSeed = roll.seed;
    const swapIndex = roll.value - 1;
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return { seed: nextSeed, items: result };
}
