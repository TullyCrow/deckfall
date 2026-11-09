/**
 * Small seeded PRNG (mulberry32). The whole generator state is one 32-bit
 * integer, so it can live inside the saved game and a run can be replayed
 * exactly from its seed and its list of actions.
 */
export interface Rng {
  state: number;
  /** Float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
}

export function createRng(initialState: number): Rng {
  const rng: Rng = {
    state: initialState | 0,
    next() {
      rng.state = (rng.state + 0x6d2b79f5) | 0;
      let t = rng.state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + rng.next() * (max - min);
    },
    int(min, max) {
      return min + Math.floor(rng.next() * (max - min + 1));
    },
    chance(probability) {
      return rng.next() < probability;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('pick() from an empty list');
      return items[Math.floor(rng.next() * items.length)] as T;
    },
    weighted<T>(entries: readonly (readonly [T, number])[]): T {
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      if (entries.length === 0 || total <= 0) throw new Error('weighted() needs positive weights');
      let roll = rng.next() * total;
      for (const [value, weight] of entries) {
        roll -= weight;
        if (roll < 0) return value;
      }
      return (entries[entries.length - 1] as readonly [T, number])[0];
    },
  };
  return rng;
}

/** FNV-1a hash, so any text seed maps to a 32-bit starting state. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}
