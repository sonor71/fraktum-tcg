export function nextRandom(seed: number) { const next = (seed * 1664525 + 1013904223) >>> 0; return { seed: next, value: next / 4294967296 }; }
export function rollDie(seed: number, sides: number) { const roll = nextRandom(seed); return { seed: roll.seed, value: Math.floor(roll.value * sides) + 1 }; }
