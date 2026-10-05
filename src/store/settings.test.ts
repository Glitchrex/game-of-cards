import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { BOT_DELAY_MS, useSettings } from './settings';

/** Same rule the Community Board API enforces for voter tokens (docs/API.md). */
const VOTER_TOKEN_RE = /^[A-Za-z0-9_-]{8,100}$/;

const settings = () => useSettings.getState();
const defaults = {
  muted: true,
  fourColor: false,
  motion: 'system',
  botSpeed: 'normal',
  primerSeen: false,
  locale: 'en',
  voterToken: null,
} as const;

beforeEach(() => {
  useSettings.setState(defaults);
  storage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSettings', () => {
  it('starts muted with system motion and no voter token', () => {
    expect(useSettings.persist.hasHydrated()).toBe(false);
    expect(settings()).toMatchObject(defaults);
  });

  it('setters update their own field only', () => {
    settings().setMuted(false);
    settings().setFourColor(true);
    settings().setMotion('reduce');
    settings().setBotSpeed('fast');
    settings().setPrimerSeen(true);
    expect(settings()).toMatchObject({
      muted: false,
      fourColor: true,
      motion: 'reduce',
      botSpeed: 'fast',
      primerSeen: true,
      locale: 'en',
      voterToken: null,
    });
  });

  it('ensureVoterToken creates a valid token once and then keeps returning it', () => {
    const token = settings().ensureVoterToken();
    expect(token).toMatch(VOTER_TOKEN_RE);
    expect(settings().voterToken).toBe(token);
    expect(settings().ensureVoterToken()).toBe(token);
  });

  it('falls back to a valid token when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {});
    const token = settings().ensureVoterToken();
    expect(token).toMatch(VOTER_TOKEN_RE);
  });

  it('tokens differ between browsers (fresh stores)', () => {
    const a = settings().ensureVoterToken();
    useSettings.setState({ voterToken: null });
    const b = settings().ensureVoterToken();
    expect(a).not.toBe(b);
  });

  it('bot delays get shorter as the speed goes up', () => {
    expect(BOT_DELAY_MS.relaxed).toBeGreaterThan(BOT_DELAY_MS.normal);
    expect(BOT_DELAY_MS.normal).toBeGreaterThan(BOT_DELAY_MS.fast);
    expect(BOT_DELAY_MS.fast).toBeGreaterThan(0);
  });

  it('persists only the preference fields under "goc:settings" and rehydrates them', async () => {
    settings().setMuted(false);
    const token = settings().ensureVoterToken();
    const saved = JSON.parse(storage.get('goc:settings') ?? 'null') as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(saved).toEqual({ state: { ...defaults, muted: false, voterToken: token }, version: 1 });

    useSettings.setState(defaults);
    storage.set('goc:settings', JSON.stringify(saved));
    await useSettings.persist.rehydrate();
    expect(settings().muted).toBe(false);
    expect(settings().ensureVoterToken()).toBe(token);
  });
});
