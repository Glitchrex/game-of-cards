import { describe, expect, it, vi } from 'vitest';
import { createRng, shuffle } from '@/games/core/rng';
import { type CatalogGame } from '@/lib/content/catalog';
import { GameContentSchema, MOODS, type GameContentInput, type Mood } from '@/lib/content/schema';
import {
  PLAYER_BUCKETS,
  TIME_BUCKETS,
  fitsPlayers,
  recommendGames,
  timeBucketOf,
  type PlayersAnswer,
  type RecommendAnswers,
  type RecommendableGame,
  type Recommendation,
  type TimeAnswer,
} from './recommend';

// recommend.ts only needs the CatalogGame *type*; loading the real catalog at runtime would
// drag every content file into the client bundle of the "Pick a game" dialog.
vi.mock('@/lib/content/catalog', () => {
  throw new Error('recommend.ts must not import the catalog at runtime');
});

interface Spec {
  slug: string;
  tier: 1 | 2;
  players: [number, number, number?];
  difficulty: number;
  minutes: number;
  moods: Mood[];
  order: number;
}

/** A schema-valid catalog entry built through the real Zod schema. */
function game(s: Spec): CatalogGame {
  const [min, max, ideal] = s.players;
  const raw: GameContentInput = {
    slug: s.slug,
    name: s.slug
      .split('-')
      .map((w) => w[0]!.toUpperCase() + w.slice(1))
      .join(' '),
    origin: { country: 'Worldwide', countryCode: 'UN', region: 'global' },
    type: 'shedding',
    players: { min, max, ...(ideal === undefined ? {} : { ideal }) },
    deck: 'Standard 52-card deck',
    difficulty: s.difficulty,
    length: `${s.minutes} minutes`,
    minutes: s.minutes,
    moods: s.moods,
    hook: 'A fun game.',
    history: 'It has a history.',
    order: s.order,
    variantTaught: 'Standard.',
    variants: 'Many.',
    glossary: [
      { term: 'a', definition: 'A.' },
      { term: 'b', definition: 'B.' },
      { term: 'c', definition: 'C.' },
    ],
    lesson: Array.from({ length: 5 }, (_, i) => ({ title: `Step ${i}`, body: 'Body.' })),
    mistakes: ['x', 'y', 'z'],
    tips: ['x', 'y', 'z'],
    quiz: Array.from({ length: 5 }, () => ({
      question: 'Q?',
      options: ['A', 'B', 'C', 'D'],
      answer: 0,
      explanation: 'E.',
    })),
    seo: { description: 'A long enough description of this game for search engines to show.' },
  };
  return { ...GameContentSchema.parse(raw), tier: s.tier };
}

/** Modelled on the real catalog. */
const GAMES: readonly CatalogGame[] = Object.freeze([
  game({
    slug: 'blackjack',
    tier: 1,
    players: [1, 7, 1],
    difficulty: 2,
    minutes: 2,
    moods: ['lucky', 'brainy', 'chill'],
    order: 40,
  }),
  game({
    slug: 'klondike',
    tier: 1,
    players: [1, 1, 1],
    difficulty: 2,
    minutes: 10,
    moods: ['chill', 'brainy'],
    order: 10,
  }),
  game({
    slug: 'war',
    tier: 1,
    players: [2, 2, 2],
    difficulty: 1,
    minutes: 10,
    moods: ['lucky', 'chill'],
    order: 5,
  }),
  game({
    slug: 'teen-patti',
    tier: 1,
    players: [2, 5, 3],
    difficulty: 2,
    minutes: 5,
    moods: ['lucky', 'social'],
    order: 20,
  }),
  game({
    slug: 'gin-rummy',
    tier: 2,
    players: [2, 2, 2],
    difficulty: 3,
    minutes: 20,
    moods: ['brainy', 'competitive'],
    order: 70,
  }),
  game({
    slug: 'hearts',
    tier: 1,
    players: [3, 6, 4],
    difficulty: 3,
    minutes: 15,
    moods: ['competitive', 'brainy'],
    order: 50,
  }),
  game({
    slug: 'bridge',
    tier: 2,
    players: [4, 4, 4],
    difficulty: 5,
    minutes: 45,
    moods: ['brainy', 'competitive', 'social'],
    order: 90,
  }),
  game({
    slug: 'canasta',
    tier: 2,
    players: [2, 6, 4],
    difficulty: 4,
    minutes: 60,
    moods: ['social', 'brainy'],
    order: 80,
  }),
  game({
    slug: 'go-fish',
    tier: 1,
    players: [2, 6, 3],
    difficulty: 1,
    minutes: 10,
    moods: ['chill', 'social'],
    order: 8,
  }),
  game({
    slug: 'crazy-eights',
    tier: 1,
    players: [2, 7, 4],
    difficulty: 1,
    minutes: 10,
    moods: ['social', 'chill'],
    order: 12,
  }),
]);

/** A neutral game for controlled comparisons. */
const base: Spec = {
  slug: 'base',
  tier: 1,
  players: [2, 4],
  difficulty: 3,
  minutes: 10,
  moods: ['chill'],
  order: 50,
};
const variantOf = (patch: Partial<Spec>) => game({ ...base, ...patch });

const ask = (players: PlayersAnswer, mood: Mood, time: TimeAnswer): RecommendAnswers => ({
  players,
  mood,
  time,
});
const ranking = (
  games: readonly CatalogGame[],
  answers: RecommendAnswers,
  opts?: { preferPlayable?: boolean },
) => recommendGames(games, answers, opts).map((r) => r.game.slug);
const pick = (slug: string, answers: RecommendAnswers, games = GAMES) =>
  recommendGames(games, answers).find((r) => r.game.slug === slug);

const ALL_PLAYERS: PlayersAnswer[] = ['solo', 'two', 'small-group', 'big-group'];
const ALL_TIMES: TimeAnswer[] = ['quick', 'medium', 'long'];

describe('buckets', () => {
  it('maps player answers to seat counts', () => {
    expect(PLAYER_BUCKETS.solo).toEqual({ min: 1, max: 1 });
    expect(PLAYER_BUCKETS.two).toEqual({ min: 2, max: 2 });
    expect(PLAYER_BUCKETS['small-group']).toEqual({ min: 3, max: 4 });
    expect(PLAYER_BUCKETS['big-group'].min).toBe(5);
    expect(PLAYER_BUCKETS['big-group'].max).toBe(Number.POSITIVE_INFINITY);
  });

  it('maps minutes to time answers: quick ≤ 10 < medium ≤ 25 < long', () => {
    expect(TIME_BUCKETS.quick.upTo).toBe(10);
    expect(TIME_BUCKETS.medium.upTo).toBe(25);
    expect([1, 5, 10, 11, 25, 26, 120].map(timeBucketOf)).toEqual([
      'quick',
      'quick',
      'quick',
      'medium',
      'medium',
      'long',
      'long',
    ]);
  });

  it('fitsPlayers checks that the game range overlaps the bucket', () => {
    const range = (min: number, max: number) => ({ players: { min, max } });
    expect(fitsPlayers(range(1, 1), 'solo')).toBe(true);
    expect(fitsPlayers(range(2, 4), 'solo')).toBe(false);
    expect(fitsPlayers(range(1, 7), 'two')).toBe(true);
    expect(fitsPlayers(range(3, 6), 'two')).toBe(false);
    expect(fitsPlayers(range(4, 4), 'small-group')).toBe(true);
    expect(fitsPlayers(range(2, 3), 'small-group')).toBe(true);
    expect(fitsPlayers(range(5, 8), 'small-group')).toBe(false);
    expect(fitsPlayers(range(2, 5), 'big-group')).toBe(true);
    expect(fitsPlayers(range(2, 4), 'big-group')).toBe(false);
    expect(fitsPlayers(range(6, 10), 'big-group')).toBe(true);
  });
});

describe('recommendGames — player filter', () => {
  it.each<[PlayersAnswer, string[]]>([
    ['solo', ['blackjack', 'klondike']],
    ['two', ['blackjack', 'canasta', 'crazy-eights', 'gin-rummy', 'go-fish', 'teen-patti', 'war']],
    [
      'small-group',
      ['blackjack', 'bridge', 'canasta', 'crazy-eights', 'go-fish', 'hearts', 'teen-patti'],
    ],
    ['big-group', ['blackjack', 'canasta', 'crazy-eights', 'go-fish', 'hearts', 'teen-patti']],
  ])('%s → only games whose player range contains the bucket', (players, expected) => {
    for (const mood of MOODS) {
      for (const time of ALL_TIMES) {
        expect(ranking(GAMES, ask(players, mood, time)).sort()).toEqual(expected);
      }
    }
  });

  it('falls back to every game, penalised per missing seat, when none fits', () => {
    const pair = variantOf({ slug: 'pair-only', players: [2, 2] });
    const four = variantOf({ slug: 'four-only', players: [4, 4] });
    const recs = recommendGames([pair, four], ask('big-group', 'chill', 'quick'));
    expect(recs.map((r) => r.game.slug)).toEqual(['four-only', 'pair-only']);
    // 1 seat short vs 3 seats short, everything else equal: 2 points per seat.
    expect(recs[0]!.score - recs[1]!.score).toBeCloseTo(4, 10);
    expect(recs[0]!.reason).toBe(
      'Best with 4 players, quick (about 10 minutes) and wonderfully relaxed.',
    );
    expect(pick('klondike', ask('two', 'chill', 'quick'), [GAMES[1]!])?.reason).toBe(
      'Best played solo, quick (about 10 minutes) and wonderfully relaxed.',
    );
    expect(
      recommendGames([variantOf({ players: [2, 6] })], ask('solo', 'chill', 'quick'))[0]?.reason,
    ).toMatch(/^Best with 2–6 players, /);
  });

  it('returns nothing for an empty catalog', () => {
    expect(recommendGames([], ask('two', 'lucky', 'quick'))).toEqual([]);
  });
});

describe('recommendGames — ranking', () => {
  it('ranks a lucky, quick two-player evening sensibly (with tie-breaks)', () => {
    const recs = recommendGames(GAMES, ask('two', 'lucky', 'quick'));
    expect(recs.map((r) => r.game.slug)).toEqual([
      'war', // lucky main mood + quick + ideal for two + easiest + playable
      'teen-patti', // ties with blackjack on score and difficulty → lower journey order first
      'blackjack',
      'go-fish',
      'crazy-eights',
      'gin-rummy',
      'canasta',
    ]);
    expect(recs[1]!.score).toBe(recs[2]!.score);
    expect(recs[0]!.score).toBe(14.1);
  });

  it('is sorted best first for every possible set of answers', () => {
    for (const players of ALL_PLAYERS) {
      for (const mood of MOODS) {
        for (const time of ALL_TIMES) {
          const recs = recommendGames(GAMES, ask(players, mood, time));
          expect(recs.length).toBeGreaterThan(0);
          for (let i = 1; i < recs.length; i++) {
            expect(recs[i - 1]!.score).toBeGreaterThanOrEqual(recs[i]!.score);
          }
          for (const r of recs) {
            expect(fitsPlayers(r.game, players)).toBe(true);
            expect(Number.isFinite(r.score)).toBe(true);
            expect(Math.round(r.score * 100) / 100).toBe(r.score);
            expect(r.reason).toMatch(/^[A-Z][^]*\.$/);
            expect(r.reason).not.toMatch(/undefined|NaN|Infinity|null/);
          }
        }
      }
    }
  });

  it('a mood match is a strong bonus: it beats easier, playable games that miss the mood', () => {
    const recs = recommendGames(GAMES, ask('two', 'brainy', 'medium'));
    expect(recs[0]!.game.slug).toBe('gin-rummy'); // Tier 2, difficulty 3 — but brainy & 20 min
    const matching = variantOf({ slug: 'matching', moods: ['lucky'], difficulty: 5, tier: 2 });
    const easier = variantOf({ slug: 'easier', moods: ['chill'], difficulty: 1, tier: 1 });
    expect(ranking([easier, matching], ask('two', 'lucky', 'quick'))).toEqual([
      'matching',
      'easier',
    ]);
  });

  it('a game’s main mood counts a little more than a secondary one', () => {
    const main = variantOf({ slug: 'main', moods: ['social', 'chill'] });
    const secondary = variantOf({ slug: 'secondary', moods: ['chill', 'social'] });
    const recs = recommendGames([secondary, main], ask('two', 'social', 'quick'));
    expect(recs.map((r) => r.game.slug)).toEqual(['main', 'secondary']);
    expect(recs[0]!.score - recs[1]!.score).toBeCloseTo(1, 10);
  });

  it('scores time by proximity without excluding long or short games', () => {
    const minutes = [2, 5, 10, 11, 15, 20, 25, 26, 30, 45, 60, 120];
    const games = minutes.map((m) => variantOf({ slug: `m${m}`, minutes: m }));
    const scoreOf = (time: TimeAnswer) =>
      Object.fromEntries(
        recommendGames(games, ask('two', 'chill', time)).map((r) => [r.game.minutes, r.score]),
      );

    for (const time of ALL_TIMES) {
      expect(recommendGames(games, ask('two', 'chill', time))).toHaveLength(minutes.length);
    }

    const quick = scoreOf('quick');
    expect(quick[2]).toBe(quick[10]);
    expect(quick[10]).toBeGreaterThan(quick[11]!);
    expect(quick[11]).toBeGreaterThan(quick[15]!);
    expect(quick[15]).toBeGreaterThan(quick[20]!);
    expect(quick[20]).toBeGreaterThan(quick[30]!);
    expect(quick[45]).toBe(quick[120]); // 4× too long or more: no time points at all

    const medium = scoreOf('medium');
    expect(medium[11]).toBe(medium[25]);
    expect(medium[25]).toBeGreaterThan(medium[10]!);
    expect(medium[10]).toBeGreaterThan(medium[5]!);
    expect(medium[25]).toBeGreaterThan(medium[26]!);
    expect(medium[26]).toBeGreaterThan(medium[45]!);

    const long = scoreOf('long');
    expect(long[26]).toBe(long[120]);
    expect(long[26]).toBeGreaterThan(long[25]!);
    expect(long[25]).toBeGreaterThan(long[15]!);
    expect(long[15]).toBeGreaterThan(long[5]!);

    // In-bucket is worth 4 points; even the nearest miss earns less.
    expect(quick[10]! - quick[120]!).toBeCloseTo(4, 10);
    expect(quick[10]! - quick[11]!).toBeGreaterThan(1);
  });

  it('gives beginner-friendly games a small bonus', () => {
    const recs = recommendGames(
      [1, 2, 3, 4, 5].map((d) => variantOf({ slug: `d${d}`, difficulty: d })),
      ask('two', 'chill', 'quick'),
    );
    expect(recs.map((r) => r.game.difficulty)).toEqual([1, 2, 3, 4, 5]);
    expect(recs[0]!.score - recs[4]!.score).toBeCloseTo(1.6, 10);
  });

  it('rewards games whose ideal player count is in the bucket', () => {
    const idealTwo = variantOf({ slug: 'ideal-two', players: [2, 6, 2] });
    const idealFour = variantOf({ slug: 'ideal-four', players: [2, 6, 4] });
    expect(ranking([idealFour, idealTwo], ask('two', 'chill', 'quick'))).toEqual([
      'ideal-two',
      'ideal-four',
    ]);
    expect(ranking([idealTwo, idealFour], ask('small-group', 'chill', 'quick'))).toEqual([
      'ideal-four',
      'ideal-two',
    ]);
  });

  it('prefers playable (Tier 1) games by default and can switch that off', () => {
    const playable = variantOf({ slug: 'playable', tier: 1, difficulty: 3 });
    const tier2Easier = variantOf({ slug: 'tier2-easier', tier: 2, difficulty: 1 });
    const answers = ask('two', 'chill', 'quick');
    expect(ranking([tier2Easier, playable], answers)).toEqual(['playable', 'tier2-easier']);
    expect(ranking([tier2Easier, playable], answers, { preferPlayable: true })).toEqual([
      'playable',
      'tier2-easier',
    ]);
    expect(ranking([playable, tier2Easier], answers, { preferPlayable: false })).toEqual([
      'tier2-easier',
      'playable',
    ]);
    const a = pick('playable', answers, [playable, tier2Easier])!;
    const b = recommendGames([playable], answers, { preferPlayable: false })[0]!;
    expect(a.score - b.score).toBeCloseTo(1.5, 10);
  });
});

describe('recommendGames — tie-breaks and determinism', () => {
  it('breaks score ties by Tier 1 first', () => {
    const t2 = variantOf({ slug: 'aaa-tier2', tier: 2 });
    const t1 = variantOf({ slug: 'zzz-tier1', tier: 1 });
    const recs = recommendGames([t2, t1], ask('two', 'chill', 'quick'), { preferPlayable: false });
    expect(recs[0]!.score).toBe(recs[1]!.score);
    expect(recs.map((r) => r.game.slug)).toEqual(['zzz-tier1', 'aaa-tier2']);
  });

  it('breaks score ties by lower difficulty next', () => {
    // Contrived so the difficulty bonus exactly offsets a time near-miss (after rounding):
    // hard = 4 (in bucket) + 0; easy = 3 − 1.5·log2(1.32) + 1.6 ≈ 4.00.
    const hard = variantOf({ slug: 'aaa-hard', difficulty: 5, minutes: 10, order: 1 });
    const easy = variantOf({ slug: 'zzz-easy', difficulty: 1, order: 99 });
    const easyNearMiss: CatalogGame = { ...easy, minutes: 13.2 };
    const recs = recommendGames([hard, easyNearMiss], ask('two', 'chill', 'quick'));
    expect(recs[0]!.score).toBe(recs[1]!.score);
    expect(recs.map((r) => r.game.slug)).toEqual(['zzz-easy', 'aaa-hard']);
  });

  it('then by journey order, then by slug', () => {
    const late = variantOf({ slug: 'aaa-late', order: 90 });
    const early = variantOf({ slug: 'zzz-early', order: 10 });
    expect(ranking([late, early], ask('two', 'chill', 'quick'))).toEqual(['zzz-early', 'aaa-late']);
    const b = variantOf({ slug: 'bbb' });
    const a = variantOf({ slug: 'aaa' });
    expect(ranking([b, a], ask('two', 'chill', 'quick'))).toEqual(['aaa', 'bbb']);
  });

  it('is deterministic and independent of the input order', () => {
    const rng = createRng('recommend-order');
    for (const players of ALL_PLAYERS) {
      for (const mood of MOODS) {
        for (const time of ALL_TIMES) {
          const answers = ask(players, mood, time);
          const reference = recommendGames(GAMES, answers);
          expect(recommendGames(GAMES, answers)).toEqual(reference);
          expect(recommendGames(shuffle(GAMES, rng), answers)).toEqual(reference);
        }
      }
    }
  });

  it('does not mutate the games list or the games', () => {
    const before = JSON.stringify(GAMES);
    recommendGames(GAMES, ask('small-group', 'social', 'long'));
    expect(JSON.stringify(GAMES)).toBe(before);
    expect(Object.isFrozen(GAMES)).toBe(true);
  });

  it('accepts slim game objects and returns them with their own type', () => {
    const slim: RecommendableGame[] = GAMES.map(
      ({ slug, tier, players, difficulty, minutes, moods, order }) => ({
        slug,
        tier,
        players,
        difficulty,
        minutes,
        moods,
        order,
      }),
    );
    for (const players of ALL_PLAYERS) {
      for (const mood of MOODS) {
        const answers = ask(players, mood, 'medium');
        const full = recommendGames(GAMES, answers);
        const lean: Recommendation<RecommendableGame>[] = recommendGames(slim, answers);
        expect(lean.map((r) => [r.game.slug, r.score, r.reason])).toEqual(
          full.map((r) => [r.game.slug, r.score, r.reason]),
        );
        expect(lean.every((r) => slim.includes(r.game))).toBe(true);
      }
    }
  });

  it('returns the catalog objects themselves (no copies)', () => {
    const recs = recommendGames(GAMES, ask('solo', 'chill', 'quick'));
    for (const r of recs) expect(GAMES).toContain(r.game);
  });
});

describe('recommendGames — reasons', () => {
  it.each<[string, RecommendAnswers, string]>([
    [
      'war',
      ask('two', 'lucky', 'quick'),
      'Perfect for 2 players, quick (about 10 minutes) and full of lucky moments.',
    ],
    [
      'teen-patti',
      ask('two', 'lucky', 'quick'),
      'Great for 2 players, quick (about 5 minutes) and full of lucky moments.',
    ],
    [
      'hearts',
      ask('small-group', 'competitive', 'medium'),
      'Perfect for 3–4 players, just the right length (about 15 minutes) and packed with friendly rivalry.',
    ],
    [
      'bridge',
      ask('small-group', 'brainy', 'long'),
      'Perfect for 4 players, a nice long game (about 45 minutes) and full of clever decisions.',
    ],
    [
      'blackjack',
      ask('solo', 'chill', 'quick'),
      'Perfect for playing solo, quick (about 2 minutes) and wonderfully relaxed.',
    ],
    [
      'crazy-eights',
      ask('big-group', 'social', 'quick'),
      'Great for 5–7 players, quick (about 10 minutes) and great for chatting and laughing together.',
    ],
    [
      'canasta',
      ask('two', 'social', 'quick'),
      'Great for 2 players, a bit longer than you asked (about 60 minutes) and great for chatting and laughing together.',
    ],
    [
      'blackjack',
      ask('two', 'lucky', 'long'),
      'Great for 2 players, a little quicker than you asked (about 2 minutes) and full of lucky moments.',
    ],
    // Mood not offered by the game → describe what the game *is* (its main mood).
    [
      'klondike',
      ask('solo', 'lucky', 'quick'),
      'Perfect for playing solo, quick (about 10 minutes) and wonderfully relaxed.',
    ],
    [
      'gin-rummy',
      ask('two', 'social', 'medium'),
      'Perfect for 2 players, just the right length (about 20 minutes) and full of clever decisions.',
    ],
  ])('%s with %j', (slug, answers, reason) => {
    expect(pick(slug, answers)?.reason).toBe(reason);
  });

  it('uses the singular for a one-minute game', () => {
    const recs = recommendGames([variantOf({ minutes: 1 })], ask('two', 'chill', 'quick'));
    expect(recs[0]?.reason).toBe(
      'Great for 2 players, quick (about 1 minute) and wonderfully relaxed.',
    );
  });

  it('describes the overlap of the game range and a big group', () => {
    const party = variantOf({ slug: 'party', players: [3, 10, 6] });
    expect(pick('party', ask('big-group', 'chill', 'quick'), [party])?.reason).toBe(
      'Perfect for 5–10 players, quick (about 10 minutes) and wonderfully relaxed.',
    );
  });
});
