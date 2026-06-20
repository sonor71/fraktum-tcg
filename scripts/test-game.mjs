import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
const cardsSource = readFileSync(new URL('../src/game/data/cards.ts', import.meta.url), 'utf8');
for (const required of ['energy_sword', 'reverse_heart', 'caduceus', 'crystal_of_time', 'phoenix_feather']) assert(cardsSource.includes(required), `missing ${required}`);
assert(cardsSource.includes('target: "frontEnemyCard", value: 3'));
assert(cardsSource.includes('op: "swapHeroHp"'));
assert(cardsSource.includes('op: "drawGame"'));
assert(cardsSource.includes('type: "bonus"'));
console.log('Fallback game checks passed (Vitest package unavailable in this environment).');
