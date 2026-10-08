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

import { deepFreeze } from '@/games/core/simulate';
import { applyGame, useStats, type RecordedGame } from './stats';

type ReducerState = Parameters<typeof applyGame>[0];

const empty = (): ReducerState => ({
  played: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  biggestWin: 0,
  currentStreak: 0,
  bestStreak: 0,
  perGame: {},
  awards: [],
  lastTitleId: null,
  lastRoastId: null,
});

/** Fold a list of games through the pure reducer. */
function play(games: RecordedGame[], start: ReducerState = empty()): ReducerState {
  return games.reduce<ReducerState>((s, g) => ({ ...s, ...applyGame(s, g) }), start);
}

const win = (net: number, gameSlug = 'blackjack'): RecordedGame => ({
  gameSlug,
  outcome: 'win',
  net,
});
const loss = (net: number, gameSlug = 'blackjack'): RecordedGame => ({
  gameSlug,
  outcome: 'loss',
  net,
});
const push = (gameSlug = 'blackjack'): RecordedGame => ({ gameSlug, outcome: 'push', net: 0 });

const T0 = Date.UTC(2026, 4, 1);
const stats = () => useStats.getState();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  stats().reset();
  storage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('applyGame reducer', () => {
  it('counts played / wins / losses / pushes overall and per game', () => {
    const s = play([win(25), loss(-10), push(), win(5, 'war'), loss(-5, 'war'), loss(-5, 'war')]);
    expect(s).toMatchObject({ played: 6, wins: 2, losses: 3, pushes: 1 });
    expect(s.perGame).toEqual({
      blackjack: { played: 3, wins: 1, losses: 1, pushes: 1, biggestWin: 25 },
      war: { played: 3, wins: 1, losses: 2, pushes: 0, biggestWin: 5 },
    });
  });

  it('tracks win streaks as positive and losing streaks as negative', () => {
    const streaks: number[] = [];
    const best: number[] = [];
    let s = empty();
    for (const g of [win(1), win(1), win(1), loss(-1), loss(-1), win(1), loss(-1)]) {
      s = { ...s, ...applyGame(s, g) };
      streaks.push(s.currentStreak);
      best.push(s.bestStreak);
    }
    expect(streaks).toEqual([1, 2, 3, -1, -2, 1, -1]);
    expect(best).toEqual([1, 2, 3, 3, 3, 3, 3]);
  });

  it('a push neither extends nor breaks a streak', () => {
    expect(play([win(1), win(1), push(), win(1)]).currentStreak).toBe(3);
    expect(play([win(1), win(1), push(), win(1)]).bestStreak).toBe(3);
    expect(play([loss(-1), push(), loss(-1)]).currentStreak).toBe(-2);
    expect(play([push(), push()]).currentStreak).toBe(0);
  });

  it('bestStreak only ever counts wins and never decreases', () => {
    const s = play([loss(-1), loss(-1), loss(-1), loss(-1)]);
    expect(s.currentStreak).toBe(-4);
    expect(s.bestStreak).toBe(0);
    expect(play([win(1), win(1), loss(-1), win(1)]).bestStreak).toBe(2);
  });

  it('biggestWin is the largest net of any win, overall and per game', () => {
    const s = play([win(40), loss(-500), win(15), win(150, 'teen-patti'), push(), win(90)]);
    expect(s.biggestWin).toBe(150);
    expect(s.perGame.blackjack?.biggestWin).toBe(90);
    expect(s.perGame['teen-patti']?.biggestWin).toBe(150);
    // Losses never touch it.
    expect(play([loss(-999)]).biggestWin).toBe(0);
  });

  it('is pure: never mutates its input', () => {
    const before = deepFreeze(play([win(10), loss(-5, 'war')]));
    const snapshot = JSON.stringify(before);
    const after = applyGame(before, win(99, 'war'));
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(after.perGame).not.toBe(before.perGame);
    expect(after.perGame.blackjack).toBe(before.perGame.blackjack); // untouched games are shared
    expect(after.perGame.war).toEqual({ played: 2, wins: 1, losses: 1, pushes: 0, biggestWin: 99 });
  });
});

describe('useStats store', () => {
  it('starts empty', () => {
    expect(useStats.persist.hasHydrated()).toBe(false);
    expect(stats()).toMatchObject(empty());
  });

  it('recordGame returns the snapshot from BEFORE the game, then records it', () => {
    const first = stats().recordGame(win(50));
    expect(first).toEqual({
      played: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      biggestWin: 0,
      currentStreak: 0,
      bestStreak: 0,
      gameWins: 0,
      gamePlayed: 0,
    });
    stats().recordGame(win(20));
    stats().recordGame(loss(-30, 'hearts'));
    const fourth = stats().recordGame(win(5, 'hearts'));
    expect(fourth).toEqual({
      played: 3,
      wins: 2,
      losses: 1,
      pushes: 0,
      biggestWin: 50,
      currentStreak: -1,
      bestStreak: 2,
      gameWins: 0, // hearts so far: one loss
      gamePlayed: 1,
    });
    expect(stats()).toMatchObject({ played: 4, wins: 3, currentStreak: 1, bestStreak: 2 });
    expect(stats().perGame.hearts).toEqual({
      played: 2,
      wins: 1,
      losses: 1,
      pushes: 0,
      biggestWin: 5,
    });
  });

  it('the snapshot lets callers detect "first win" and "new biggest win"', () => {
    const before = stats().recordGame(win(30, 'war'));
    expect(before.gameWins === 0 && before.wins === 0).toBe(true); // first win ever
    const next = stats().recordGame(win(80, 'war'));
    expect(80 > next.biggestWin).toBe(true); // beat the previous record of 30
    expect(next.gameWins).toBe(1);
  });

  it('addAward stamps id and time and keeps the newest first (max 200)', () => {
    const a = stats().addAward({
      titleId: 't-1',
      text: 'King of the Table',
      film: 'Some Film',
      gameSlug: 'blackjack',
      jeet: 150,
    });
    expect(a).toMatchObject({ titleId: 't-1', gameSlug: 'blackjack', jeet: 150, at: T0 });
    expect(a.id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    vi.setSystemTime(T0 + 1000);
    const b = stats().addAward({ titleId: 't-2', text: 'Ace', gameSlug: 'war', jeet: 10 });
    expect(b.id).not.toBe(a.id);
    expect(stats().awards.map((x) => x.titleId)).toEqual(['t-2', 't-1']);

    for (let i = 0; i < 210; i++) {
      stats().addAward({ titleId: `bulk-${i}`, text: 'x', gameSlug: 'war', jeet: 1 });
    }
    expect(stats().awards).toHaveLength(200);
    expect(stats().awards[0]?.titleId).toBe('bulk-209');
    expect(new Set(stats().awards.map((x) => x.id)).size).toBe(200);
  });

  it('remembers the last title and roast', () => {
    stats().setLastTitle('title-7');
    stats().setLastRoast('roast-3');
    expect(stats().lastTitleId).toBe('title-7');
    expect(stats().lastRoastId).toBe('roast-3');
  });

  it('reset wipes stats, awards and last ids', () => {
    stats().recordGame(win(10));
    stats().addAward({ titleId: 't', text: 'x', gameSlug: 'war', jeet: 1 });
    stats().setLastTitle('t');
    stats().reset();
    expect(stats()).toMatchObject(empty());
    expect(stats().perGame).toEqual({});
  });

  it('persists data only under "goc:stats" and rehydrates it', async () => {
    stats().recordGame(win(70, 'baccarat'));
    const saved = JSON.parse(storage.get('goc:stats') ?? 'null') as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(saved.version).toBe(1);
    expect(Object.keys(saved.state).sort()).toEqual(
      [
        'awards',
        'bestStreak',
        'biggestWin',
        'currentStreak',
        'lastRoastId',
        'lastTitleId',
        'losses',
        'perGame',
        'played',
        'pushes',
        'wins',
      ].sort(),
    );
    expect(Object.values(saved.state).some((v) => typeof v === 'function')).toBe(false);

    stats().reset();
    storage.set('goc:stats', JSON.stringify(saved));
    await useStats.persist.rehydrate();
    expect(stats()).toMatchObject({ played: 1, wins: 1, biggestWin: 70, currentStreak: 1 });
    expect(typeof stats().recordGame).toBe('function');
  });
});
