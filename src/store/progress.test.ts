import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  emptyProgress,
  statusOf,
  useProgress,
  type GameProgress,
  type LearnStatus,
} from './progress';

const p = (patch: Partial<GameProgress>): GameProgress => ({ ...emptyProgress(), ...patch });
const progress = () => useProgress.getState();

beforeEach(() => {
  progress().reset();
  storage.clear();
});

describe('statusOf', () => {
  const cases: [string, GameProgress | undefined, LearnStatus, LearnStatus][] = [
    // [description, progress, tier 1 status, tier 2 status]
    ['no record at all', undefined, 'not-started', 'not-started'],
    ['an empty record', emptyProgress(), 'not-started', 'not-started'],
    ['opened the lesson', p({ started: true }), 'learning', 'learning'],
    ['finished the lesson only', p({ lessonDone: true }), 'learning', 'learning'],
    ['finished the example only', p({ exampleDone: true }), 'learning', 'learning'],
    ['took the quiz and scored 0', p({ quizBest: 0 }), 'learning', 'learning'],
    ['won a game without opening any lesson', p({ wins: 2 }), 'learning', 'learning'],
    [
      'lesson + example, quiz 2/5',
      p({ started: true, lessonDone: true, exampleDone: true, quizBest: 2 }),
      'learning',
      'learning',
    ],
    [
      'lesson + example, never quizzed',
      p({ started: true, lessonDone: true, exampleDone: true }),
      'learning',
      'learning',
    ],
    [
      'lesson + quiz 5/5 but no example',
      p({ started: true, lessonDone: true, quizBest: 5, wins: 3 }),
      'learning',
      'learning',
    ],
    [
      'example + quiz 5/5 but no lesson',
      p({ started: true, exampleDone: true, quizBest: 5, wins: 3 }),
      'learning',
      'learning',
    ],
    [
      'lesson + example + quiz 3/5 (the "learned" threshold)',
      p({ started: true, lessonDone: true, exampleDone: true, quizBest: 3 }),
      'learned',
      'learned',
    ],
    [
      'learned with quiz 4/5 and wins',
      p({ started: true, lessonDone: true, exampleDone: true, quizBest: 4, wins: 5 }),
      'learned',
      'learned',
    ],
    [
      'learned with quiz 5/5 but no win yet',
      p({ started: true, lessonDone: true, exampleDone: true, quizBest: 5 }),
      'learned', // Tier 1 needs a win to master…
      'mastered', // …Tier 2 has no play mode, so 5/5 is enough.
    ],
    [
      'learned with quiz 5/5 and one win',
      p({ started: true, lessonDone: true, exampleDone: true, quizBest: 5, wins: 1 }),
      'mastered',
      'mastered',
    ],
  ];

  it.each(cases)('%s → tier 1: %s / tier 2: %s', (_label, progress, tier1, tier2) => {
    expect(statusOf(progress, 1)).toBe(tier1);
    expect(statusOf(progress, 2)).toBe(tier2);
  });
});

describe('useProgress store', () => {
  it('starts empty and does not read storage until rehydrated', () => {
    expect(useProgress.persist.hasHydrated()).toBe(false);
    expect(progress().games).toEqual({});
  });

  it('walks a Tier 1 game from not-started to mastered', () => {
    const status = () => statusOf(progress().games.hearts, 1);
    expect(status()).toBe('not-started');
    progress().markStarted('hearts');
    expect(status()).toBe('learning');
    progress().markLessonDone('hearts');
    progress().markExampleDone('hearts');
    expect(status()).toBe('learning');
    progress().recordQuiz('hearts', 3);
    expect(status()).toBe('learned');
    progress().recordQuiz('hearts', 5);
    expect(status()).toBe('learned');
    progress().recordWin('hearts');
    expect(status()).toBe('mastered');
  });

  it('walks a Tier 2 game to mastered without any wins', () => {
    const status = () => statusOf(progress().games.bridge, 2);
    progress().markLessonDone('bridge');
    expect(status()).toBe('learning');
    progress().markExampleDone('bridge');
    progress().recordQuiz('bridge', 5);
    expect(status()).toBe('mastered');
  });

  it('marking lesson/example/quiz done also marks the game as started', () => {
    progress().markLessonDone('a');
    progress().markExampleDone('b');
    progress().recordQuiz('c', 1);
    for (const slug of ['a', 'b', 'c']) expect(progress().games[slug]?.started).toBe(true);
    expect(progress().games.a).toEqual(p({ started: true, lessonDone: true }));
    expect(progress().games.b).toEqual(p({ started: true, exampleDone: true }));
    expect(progress().games.c).toEqual(p({ started: true, quizBest: 1 }));
  });

  it('keeps the best quiz score', () => {
    progress().recordQuiz('war', 3);
    progress().recordQuiz('war', 1);
    expect(progress().games.war?.quizBest).toBe(3);
    progress().recordQuiz('war', 5);
    progress().recordQuiz('war', 4);
    expect(progress().games.war?.quizBest).toBe(5);
    progress().recordQuiz('zero', 0);
    expect(progress().games.zero?.quizBest).toBe(0);
  });

  it('counts wins and keeps games independent', () => {
    progress().recordWin('war');
    progress().recordWin('war');
    progress().markLessonDone('hearts');
    expect(progress().games.war?.wins).toBe(2);
    expect(progress().games.hearts?.wins).toBe(0);
    expect(progress().games.war?.lessonDone).toBe(false);
  });

  it('never mutates previous state objects', () => {
    progress().markStarted('war');
    const before = progress().games;
    const warBefore = before.war;
    progress().recordWin('war');
    expect(progress().games).not.toBe(before);
    expect(warBefore).toEqual(p({ started: true }));
  });

  it('reset clears everything', () => {
    progress().markLessonDone('war');
    progress().reset();
    expect(progress().games).toEqual({});
  });

  it('persists only `games` under "goc:progress" and rehydrates it', async () => {
    progress().markLessonDone('klondike');
    const saved = JSON.parse(storage.get('goc:progress') ?? 'null') as {
      state: Record<string, unknown>;
      version: number;
    };
    expect(saved).toEqual({
      state: { games: { klondike: p({ started: true, lessonDone: true }) } },
      version: 1,
    });
    progress().reset();
    storage.set('goc:progress', JSON.stringify(saved));
    await useProgress.persist.rehydrate();
    expect(statusOf(progress().games.klondike, 1)).toBe('learning');
    expect(typeof progress().markStarted).toBe('function');
  });
});
