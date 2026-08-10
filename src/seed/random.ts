/**
 * A tiny seeded PRNG, so `npm run seed` produces the same synthetic squad
 * every time on every machine.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function intBetween(rng: Rng, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

export function floatBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) {
    throw new Error('pick called with an empty list');
  }
  return item;
}

export function chance(rng: Rng, probability: number): boolean {
  return rng() < probability;
}
