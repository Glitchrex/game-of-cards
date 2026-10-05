import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Persisted stores grab `localStorage` when the module is created, so the in-memory
// shim must exist before ./wallet is imported (vi.hoisted runs before imports).
const storage = vi.hoisted(() => {
  const data = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: shim, configurable: true });
  return data;
});

import {
  STARTING_BALANCE,
  UDHAAR_AMOUNT,
  UDHAAR_COOLDOWN_MS,
  UDHAAR_THRESHOLD,
  udhaarStatus,
  useWallet,
} from './wallet';

const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 0, 1, 12, 0, 0);
const wallet = () => useWallet.getState();
/** Spend down to an exact balance through the real API. */
const spendTo = (target: number) => {
  const amount = wallet().balance - target;
  if (amount > 0) expect(wallet().placeBet(amount, 'test')).toBe(true);
  expect(wallet().balance).toBe(target);
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  wallet().reset();
  storage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('wallet basics', () => {
  it('does not touch storage until rehydrated (skipHydration)', () => {
    expect(useWallet.persist.hasHydrated()).toBe(false);
  });

  it('starts with 1,000 Jeet, no udhaar history and an empty ledger', () => {
    expect(STARTING_BALANCE).toBe(1000);
    expect(wallet().balance).toBe(1000);
    expect(wallet().lastUdhaarAt).toBeNull();
    expect(wallet().ledger).toEqual([]);
  });

  it('exposes the documented udhaar constants', () => {
    expect(UDHAAR_AMOUNT).toBe(500);
    expect(UDHAAR_THRESHOLD).toBe(100);
    expect(UDHAAR_COOLDOWN_MS).toBe(24 * HOUR);
  });
});

describe('placeBet', () => {
  it('debits a covered bet and logs it', () => {
    expect(wallet().placeBet(25, 'blackjack')).toBe(true);
    expect(wallet().balance).toBe(975);
    expect(wallet().ledger).toEqual([
      { at: T0, amount: -25, reason: 'bet', gameSlug: 'blackjack' },
    ]);
  });

  it('allows betting the entire balance', () => {
    expect(wallet().placeBet(1000, 'war')).toBe(true);
    expect(wallet().balance).toBe(0);
    expect(wallet().placeBet(1, 'war')).toBe(false);
  });

  it.each([
    ['more than the balance', 1001],
    ['zero', 0],
    ['a negative amount', -50],
    ['an amount that rounds to zero', 0.4],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('rejects %s without changing anything', (_label, amount) => {
    expect(wallet().placeBet(amount, 'blackjack')).toBe(false);
    expect(wallet().balance).toBe(1000);
    expect(wallet().ledger).toEqual([]);
  });

  it('rejects a bet that is only slightly over the balance', () => {
    spendTo(30);
    expect(wallet().placeBet(31, 'hearts')).toBe(false);
    expect(wallet().balance).toBe(30);
  });

  it('rounds fractional amounts to whole Jeet', () => {
    expect(wallet().placeBet(10.4, 'baccarat')).toBe(true);
    expect(wallet().balance).toBe(990);
    expect(wallet().placeBet(10.5, 'baccarat')).toBe(true);
    expect(wallet().balance).toBe(979);
    expect(wallet().ledger.map((e) => e.amount)).toEqual([-11, -10]);
  });
});

describe('credit', () => {
  it('credits payouts (default reason) and refunds', () => {
    wallet().placeBet(100, 'blackjack');
    wallet().credit(250, 'blackjack');
    wallet().credit(40, 'teen-patti', 'refund');
    expect(wallet().balance).toBe(1190);
    expect(wallet().ledger.slice(0, 2)).toEqual([
      { at: T0, amount: 40, reason: 'refund', gameSlug: 'teen-patti' },
      { at: T0, amount: 250, reason: 'payout', gameSlug: 'blackjack' },
    ]);
  });

  it('rounds and ignores zero, negative and non-finite credits', () => {
    wallet().credit(37.5, 'baccarat');
    expect(wallet().balance).toBe(1038);
    for (const bad of [0, -10, 0.2, Number.NaN, Number.POSITIVE_INFINITY]) {
      wallet().credit(bad, 'baccarat');
    }
    expect(wallet().balance).toBe(1038);
    expect(wallet().ledger).toHaveLength(1);
  });
});

describe('udhaarStatus', () => {
  const now = T0;
  it.each([
    {
      balance: 1000,
      last: null,
      expected: { eligible: false, reason: 'not-broke', msUntilNext: 0 },
    },
    {
      balance: 100,
      last: null,
      expected: { eligible: false, reason: 'not-broke', msUntilNext: 0 },
    },
    { balance: 99, last: null, expected: { eligible: true, reason: 'ok', msUntilNext: 0 } },
    { balance: 0, last: null, expected: { eligible: true, reason: 'ok', msUntilNext: 0 } },
    {
      balance: 50,
      last: now - HOUR,
      expected: { eligible: false, reason: 'cooldown', msUntilNext: 23 * HOUR },
    },
    {
      balance: 50,
      last: now - (24 * HOUR - 1),
      expected: { eligible: false, reason: 'cooldown', msUntilNext: 1 },
    },
    {
      balance: 50,
      last: now - 24 * HOUR,
      expected: { eligible: true, reason: 'ok', msUntilNext: 0 },
    },
    {
      balance: 50,
      last: now - 72 * HOUR,
      expected: { eligible: true, reason: 'ok', msUntilNext: 0 },
    },
    // Not broke wins over cooldown: there is nothing to wait for.
    {
      balance: 500,
      last: now - HOUR,
      expected: { eligible: false, reason: 'not-broke', msUntilNext: 0 },
    },
  ])('balance $balance, last claim $last → $expected.reason', ({ balance, last, expected }) => {
    expect(udhaarStatus(balance, last, now)).toEqual(expected);
  });

  it('treats a claim time in the future (clock moved back) as still cooling down', () => {
    const s = udhaarStatus(10, now + HOUR, now);
    expect(s.eligible).toBe(false);
    expect(s.reason).toBe('cooldown');
    expect(s.msUntilNext).toBe(25 * HOUR);
  });
});

describe('claimUdhaar', () => {
  it('is refused while the balance is 100 or more', () => {
    expect(wallet().claimUdhaar()).toBe(false);
    spendTo(100);
    expect(wallet().claimUdhaar()).toBe(false);
    expect(wallet().balance).toBe(100);
    expect(wallet().lastUdhaarAt).toBeNull();
  });

  it('adds 500 Jeet below 100 and records when it was claimed', () => {
    spendTo(99);
    expect(wallet().claimUdhaar()).toBe(true);
    expect(wallet().balance).toBe(599);
    expect(wallet().lastUdhaarAt).toBe(T0);
    expect(wallet().ledger[0]).toEqual({ at: T0, amount: 500, reason: 'udhaar' });
  });

  it('can be claimed only once per 24 hours', () => {
    spendTo(0);
    expect(wallet().claimUdhaar()).toBe(true);
    spendTo(20);
    vi.setSystemTime(T0 + 23 * HOUR);
    expect(wallet().claimUdhaar()).toBe(false);
    expect(wallet().claimUdhaar(T0 + 24 * HOUR - 1)).toBe(false);
    expect(wallet().balance).toBe(20);
    expect(wallet().claimUdhaar(T0 + 24 * HOUR)).toBe(true);
    expect(wallet().balance).toBe(520);
    expect(wallet().lastUdhaarAt).toBe(T0 + 24 * HOUR);
    // The cooldown restarts from the latest claim.
    spendTo(5);
    expect(wallet().claimUdhaar(T0 + 47 * HOUR)).toBe(false);
    expect(wallet().claimUdhaar(T0 + 48 * HOUR)).toBe(true);
  });

  it('uses Date.now() when no time is passed', () => {
    vi.setSystemTime(T0 + 5 * HOUR);
    spendTo(1);
    expect(wallet().claimUdhaar()).toBe(true);
    expect(wallet().lastUdhaarAt).toBe(T0 + 5 * HOUR);
  });
});

describe('ledger', () => {
  it('keeps only the 50 newest entries, newest first', () => {
    for (let i = 1; i <= 60; i++) {
      vi.setSystemTime(T0 + i);
      wallet().credit(i, `game-${i}`);
    }
    const ledger = wallet().ledger;
    expect(ledger).toHaveLength(50);
    expect(ledger[0]).toEqual({ at: T0 + 60, amount: 60, reason: 'payout', gameSlug: 'game-60' });
    expect(ledger.at(-1)?.amount).toBe(11);
    expect(wallet().balance).toBe(1000 + (60 * 61) / 2);
  });
});

describe('reset and persistence', () => {
  it('reset restores the starting wallet', () => {
    spendTo(0);
    wallet().claimUdhaar();
    wallet().reset();
    expect(wallet().balance).toBe(1000);
    expect(wallet().lastUdhaarAt).toBeNull();
    expect(wallet().ledger).toEqual([]);
  });

  it('persists only data (no functions) under "goc:wallet"', () => {
    wallet().placeBet(40, 'war');
    const saved = JSON.parse(storage.get('goc:wallet') ?? 'null') as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(saved.version).toBe(1);
    expect(saved.state).toEqual({
      balance: 960,
      lastUdhaarAt: null,
      ledger: [{ at: T0, amount: -40, reason: 'bet', gameSlug: 'war' }],
    });
  });

  it('rehydrates a saved wallet and keeps the actions working', async () => {
    storage.set(
      'goc:wallet',
      JSON.stringify({ state: { balance: 42, lastUdhaarAt: T0 - HOUR, ledger: [] }, version: 1 }),
    );
    await useWallet.persist.rehydrate();
    expect(useWallet.persist.hasHydrated()).toBe(true);
    expect(wallet().balance).toBe(42);
    expect(wallet().lastUdhaarAt).toBe(T0 - HOUR);
    expect(wallet().claimUdhaar()).toBe(false); // still cooling down after the restore
    expect(wallet().placeBet(42, 'war')).toBe(true);
    expect(wallet().balance).toBe(0);
  });
});
