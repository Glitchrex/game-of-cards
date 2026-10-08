/**
 * Seeded RNG + Fisher–Yates tests: determinism, exact resume from saved state, bounds,
 * and statistical fairness (chi-square with real p-values, not eyeballed thresholds).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRng, hashSeed, randomSeed, rngFromState, shuffle, type Rng } from './rng';

// ---------------------------------------------------------------------------
// Statistics helpers (Numerical Recipes-style regularized incomplete gamma).
// ---------------------------------------------------------------------------

function lnGamma(z: number): number {
  const c = [
    76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const cj of c) ser += cj / ++y;
  x = -tmp + Math.log((2.5066282746310005 * ser) / x);
  return x;
}

/** Regularized lower incomplete gamma P(a, x). */
function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  const gln = lnGamma(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 1000; n++) {
      ap++;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  // Continued fraction (modified Lentz) for Q, then P = 1 − Q.
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gln) * h;
}

/** Upper-tail p-value of a chi-square statistic with `df` degrees of freedom. */
function chiSquareP(stat: number, df: number): number {
  return 1 - gammaP(df / 2, stat / 2);
}

function chiSquare(observed: readonly number[], expected: number): number {
  return observed.reduce((sum, o) => sum + (o - expected) ** 2 / expected, 0);
}

/** "Not absurd": neither suspiciously bad nor suspiciously perfect. */
function expectPlausible(p: number) {
  expect(p).toBeGreaterThan(0.001);
  expect(p).toBeLessThan(0.999);
}

/** The textbook mulberry32, written independently of rng.ts. */
function referenceMulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const draw = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.next());

describe('chi-square helper (sanity check of the test tooling itself)', () => {
  it('matches published critical values', () => {
    expect(chiSquareP(3.841459, 1)).toBeCloseTo(0.05, 5);
    expect(chiSquareP(7.814728, 3)).toBeCloseTo(0.05, 5);
    expect(chiSquareP(11.34487, 3)).toBeCloseTo(0.01, 5);
    expect(chiSquareP(35.17246, 23)).toBeCloseTo(0.05, 5);
    expect(chiSquareP(49.72823, 23)).toBeCloseTo(0.001, 5);
    expect(chiSquareP(0.1, 3)).toBeCloseTo(0.991837, 5);
  });

  it('matches the closed form for 2 degrees of freedom', () => {
    for (const x of [0.5, 2, 5, 13]) expect(chiSquareP(x, 2)).toBeCloseTo(Math.exp(-x / 2), 10);
  });
});

describe('hashSeed', () => {
  it('is 32-bit FNV-1a', () => {
    expect(hashSeed('')).toBe(0x811c9dc5);
    expect(hashSeed('a')).toBe(0xe40c292c);
    expect(hashSeed('foobar')).toBe(0xbf9cf968);
  });

  it('treats a number like its decimal string and always returns a uint32', () => {
    expect(hashSeed(42)).toBe(hashSeed('42'));
    for (const s of [0, 1, -1, 2 ** 40, 'setup-1', 'ü-unicode']) {
      const h = hashSeed(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });
});

describe('createRng determinism', () => {
  it('produces the same stream for the same seed', () => {
    expect(draw(createRng(12345), 1000)).toEqual(draw(createRng(12345), 1000));
    expect(draw(createRng('hearts-77'), 1000)).toEqual(draw(createRng('hearts-77'), 1000));
  });

  it('produces different streams for different seeds', () => {
    const a = draw(createRng(1), 50);
    const b = draw(createRng(2), 50);
    const c = draw(createRng('1x'), 50);
    expect(a).not.toEqual(b);
    expect(a).not.toEqual(c);
    expect(new Set([...a, ...b, ...c]).size).toBe(150);
  });

  it('is exactly mulberry32 seeded with the FNV-1a hash of the seed', () => {
    for (const seed of [0, 7, 'blackjack', 2 ** 32 - 1]) {
      const ref = referenceMulberry32(hashSeed(seed));
      const rng = createRng(seed);
      for (let i = 0; i < 200; i++) expect(rng.next()).toBe(ref());
    }
  });

  it('rngFromState(s) is mulberry32 started from state s', () => {
    for (const state of [0, 1, 123456789, 0xffffffff]) {
      const ref = referenceMulberry32(state);
      const rng = rngFromState(state);
      for (let i = 0; i < 100; i++) expect(rng.next()).toBe(ref());
    }
  });
});

describe('getState / rngFromState', () => {
  it('resumes the exact same stream after any number of draws', () => {
    for (const skip of [0, 1, 37, 1000]) {
      const original = createRng(`resume-${skip}`);
      draw(original, skip);
      const saved = original.getState();
      const resumed = rngFromState(saved);
      expect(draw(resumed, 250)).toEqual(draw(original, 250));
    }
  });

  it('resumes correctly after mixed int / pick / shuffle usage', () => {
    const original = createRng('mixed');
    original.int(52);
    original.pick(['a', 'b', 'c']);
    shuffle([1, 2, 3, 4, 5, 6, 7, 8], original);
    const resumed = rngFromState(original.getState());
    for (let i = 0; i < 100; i++) {
      expect(resumed.int(1000)).toBe(original.int(1000));
      expect(resumed.pick(['x', 'y', 'z'])).toBe(original.pick(['x', 'y', 'z']));
    }
    expect(shuffle([1, 2, 3, 4, 5], resumed)).toEqual(shuffle([1, 2, 3, 4, 5], original));
  });

  it('survives a JSON round trip (state is a plain uint32)', () => {
    const rng = createRng('json');
    draw(rng, 10);
    const state = rng.getState();
    expect(Number.isInteger(state)).toBe(true);
    expect(state).toBeGreaterThanOrEqual(0);
    expect(state).toBeLessThan(2 ** 32);
    const restored = JSON.parse(JSON.stringify({ rngState: state })) as { rngState: number };
    expect(draw(rngFromState(restored.rngState), 20)).toEqual(draw(rng, 20));
  });

  it('getState does not advance the generator and restoring does not touch the original', () => {
    const rng = createRng('peek');
    const s1 = rng.getState();
    expect(rng.getState()).toBe(s1);
    const copy = rngFromState(s1);
    draw(copy, 5);
    expect(rng.getState()).toBe(s1);
    const v = rng.next();
    expect(rng.getState()).not.toBe(s1);
    expect(rngFromState(s1).next()).toBe(v);
  });
});

describe('next', () => {
  it('stays in [0, 1) and is roughly uniform over 20 buckets', () => {
    const rng = createRng('uniform-next');
    const buckets = new Array<number>(20).fill(0);
    let sum = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const v = rng.next();
      expect(v >= 0 && v < 1).toBe(true);
      sum += v;
      buckets[Math.floor(v * 20)]!++;
    }
    expect(sum / n).toBeCloseTo(0.5, 2);
    expectPlausible(chiSquareP(chiSquare(buckets, n / 20), 19));
  });
});

describe('int', () => {
  it('int(1) is always 0', () => {
    const rng = createRng('int1');
    for (let i = 0; i < 500; i++) expect(rng.int(1)).toBe(0);
  });

  it('returns integers in [0, max) for many bounds', () => {
    const rng = createRng('int-bounds');
    for (const max of [2, 3, 7, 10, 13, 52, 104, 1000, 2 ** 31, 2 ** 32]) {
      for (let i = 0; i < 2000; i++) {
        const v = rng.int(max);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(max);
      }
    }
  });

  it('hits both ends of the range and is uniform (die roll, 60k draws)', () => {
    const rng = createRng('die');
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60_000; i++) counts[rng.int(6)]!++;
    expect(counts.every((c) => c > 0)).toBe(true);
    expectPlausible(chiSquareP(chiSquare(counts, 10_000), 5));
  });

  it('consumes exactly one next() per call: int(n) = floor(next() × n)', () => {
    const a = createRng('one-draw');
    const b = createRng('one-draw');
    for (let i = 0; i < 200; i++) expect(a.int(37)).toBe(Math.floor(b.next() * 37));
  });

  it.each([0, -1, -52, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'throws a RangeError for %s',
    (bad) => {
      const rng = createRng('bad-int');
      expect(() => rng.int(bad)).toThrow(RangeError);
      expect(() => rng.int(bad)).toThrow(/positive integer/);
    },
  );
});

describe('pick', () => {
  it('returns every element with roughly equal frequency and never anything else', () => {
    const items = ['S', 'H', 'D', 'C'] as const;
    const rng = createRng('pick');
    const counts = new Map<string, number>();
    for (let i = 0; i < 40_000; i++) {
      const v = rng.pick(items);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(['C', 'D', 'H', 'S']);
    expectPlausible(
      chiSquareP(
        chiSquare(
          items.map((s) => counts.get(s) ?? 0),
          10_000,
        ),
        3,
      ),
    );
  });

  it('returns the only element of a single-item array and does not mutate the input', () => {
    const rng = createRng('pick-one');
    const items = Object.freeze([{ id: 1 }]);
    expect(rng.pick(items)).toBe(items[0]);
    expect(items).toEqual([{ id: 1 }]);
  });

  it('throws a RangeError on an empty array', () => {
    expect(() => createRng('empty').pick([])).toThrow(RangeError);
  });

  it('is deterministic for a given seed', () => {
    const items = Array.from({ length: 52 }, (_, i) => i);
    const a = createRng('pick-det');
    const b = createRng('pick-det');
    for (let i = 0; i < 100; i++) expect(a.pick(items)).toBe(b.pick(items));
  });
});

describe('shuffle', () => {
  it('does not mutate the input and always returns a new array', () => {
    const input = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const out = shuffle(input, createRng('no-mutate'));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(out).not.toBe(input);
    const empty: number[] = [];
    const single = [42];
    expect(shuffle(empty, createRng(1))).not.toBe(empty);
    expect(shuffle(empty, createRng(1))).toEqual([]);
    expect(shuffle(single, createRng(1))).not.toBe(single);
    expect(shuffle(single, createRng(1))).toEqual([42]);
  });

  it('returns a permutation of the input (duplicates preserved)', () => {
    const rng = createRng('perm');
    const input = ['a', 'b', 'b', 'c', 'c', 'c', 'd', 'e', 'f', 'g'];
    for (let i = 0; i < 200; i++) {
      const out = shuffle(input, rng);
      expect(out).toHaveLength(input.length);
      expect(out.slice().sort()).toEqual(input.slice().sort());
    }
  });

  it('is deterministic for the same seed and differs between seeds', () => {
    const deck = Array.from({ length: 52 }, (_, i) => i);
    expect(shuffle(deck, createRng('deal-9'))).toEqual(shuffle(deck, createRng('deal-9')));
    expect(shuffle(deck, createRng('deal-9'))).not.toEqual(shuffle(deck, createRng('deal-10')));
  });

  it('uses exactly n − 1 draws for n items (so streams stay in sync)', () => {
    const a = createRng('draw-count');
    const b = createRng('draw-count');
    shuffle([1, 2, 3, 4, 5, 6, 7], a);
    draw(b, 6);
    expect(a.getState()).toBe(b.getState());
  });

  describe('fairness over 60,000 shuffles of 4 items', () => {
    const N = 60_000;
    const items = ['A', 'B', 'C', 'D'] as const;

    function tally(shuffler: (xs: readonly string[], rng: Rng) => string[], seed: string) {
      const rng = createRng(seed);
      // positionCounts[position][itemIndex]
      const positionCounts = items.map(() => items.map(() => 0));
      const permutationCounts = new Map<string, number>();
      for (let i = 0; i < N; i++) {
        const out = shuffler(items, rng);
        out.forEach((item, pos) => {
          positionCounts[pos]![items.indexOf(item as (typeof items)[number])]!++;
        });
        const key = out.join('');
        permutationCounts.set(key, (permutationCounts.get(key) ?? 0) + 1);
      }
      return { positionCounts, permutationCounts };
    }

    const fair = tally(shuffle, 'fisher-yates-fairness');

    it('every item is equally likely in every position (chi-square per position)', () => {
      fair.positionCounts.forEach((counts) => {
        expect(counts.reduce((a, b) => a + b, 0)).toBe(N);
        expectPlausible(chiSquareP(chiSquare(counts, N / 4), 3));
      });
      // …and every item lands in each position within 3% of the expected 15,000.
      for (const counts of fair.positionCounts) {
        for (const c of counts) expect(Math.abs(c - N / 4) / (N / 4)).toBeLessThan(0.03);
      }
    });

    it('all 24 permutations appear with roughly equal frequency', () => {
      const counts = [...fair.permutationCounts.values()];
      expect(fair.permutationCounts.size).toBe(24);
      const expected = N / 24; // 2,500
      for (const c of counts) expect(Math.abs(c - expected) / expected).toBeLessThan(0.1);
      expectPlausible(chiSquareP(chiSquare(counts, expected), 23));
    });

    it('the same statistics reject a classic biased shuffle (proves the test has teeth)', () => {
      // "Swap every position with ANY position": 4^4 = 256 paths onto 24 permutations.
      const naive = (xs: readonly string[], rng: Rng) => {
        const out = xs.slice();
        for (let i = 0; i < out.length; i++) {
          const j = rng.int(out.length);
          [out[i], out[j]] = [out[j] as string, out[i] as string];
        }
        return out;
      };
      const biased = tally(naive, 'fisher-yates-fairness');
      const counts = [...biased.permutationCounts.values()];
      expect(chiSquareP(chiSquare(counts, N / 24), 23)).toBeLessThan(1e-12);
    });
  });
});

describe('randomSeed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a uint32 from crypto.getRandomValues', () => {
    const seeds = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const s = randomSeed();
      expect(Number.isInteger(s)).toBe(true);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(2 ** 32);
      seeds.add(s);
    }
    expect(seeds.size).toBeGreaterThan(1);
  });

  it('falls back to Math.random when Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(randomSeed()).toBe(2 ** 31);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
