/**
 * Seeded, serialisable pseudo-random number generator (mulberry32) plus a fair
 * Fisher–Yates shuffle. Engines must take all randomness from an `Rng` so that
 * tests and simulations are fully deterministic.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Uniformly pick one element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Current internal state; `rngFromState(getState())` resumes the same stream. */
  getState(): number;
}

function mulberry32(initial: number): Rng {
  let a = initial >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (maxExclusive: number) => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`rng.int expects a positive integer, got ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  };
  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('rng.pick on empty array');
      return items[int(items.length)] as T;
    },
    getState: () => a,
  };
}

/** Hash an arbitrary seed (number or string) into a 32-bit state. */
export function hashSeed(seed: number | string): number {
  const s = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Create a generator from a seed. Same seed → same sequence. */
export function createRng(seed: number | string): Rng {
  return mulberry32(hashSeed(seed));
}

/** Resume a generator from `rng.getState()`. */
export function rngFromState(state: number): Rng {
  return mulberry32(state);
}

/** Fair Fisher–Yates shuffle. Returns a new array; the input is not modified. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** A non-deterministic seed for real play (crypto-backed when available). */
export function randomSeed(): number {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  }
  return Math.floor(Math.random() * 2 ** 32);
}
