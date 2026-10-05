/**
 * Catalog tests run on fixtures: the generated content and engine registries are mocked,
 * so these tests are independent of the real (growing) content folder.
 */
import { describe, expect, it, vi } from 'vitest';

const fx = vi.hoisted(() => {
  interface Spec {
    slug: string;
    name: string;
    aka?: string[];
    country: string;
    region: string;
    type: string;
    players: [number, number];
    difficulty: number;
    minutes: number;
    moods: string[];
    order: number;
    hook: string;
    example?: boolean;
  }
  const rawGame = (s: Spec) => ({
    slug: s.slug,
    name: s.name,
    ...(s.aka ? { aka: s.aka } : {}),
    origin: { country: s.country, countryCode: 'UN', region: s.region },
    type: s.type,
    players: { min: s.players[0], max: s.players[1] },
    deck: 'Standard 52-card deck',
    difficulty: s.difficulty,
    length: `${s.minutes} minutes`,
    minutes: s.minutes,
    moods: s.moods,
    hook: s.hook,
    history: 'A long and interesting history.',
    order: s.order,
    variantTaught: 'The standard rules.',
    variants: 'Plenty of house rules exist.',
    glossary: [
      { term: 'trick', definition: 'One card from each player.' },
      { term: 'suit', definition: 'Spades, Hearts, Diamonds or Clubs.' },
      { term: 'deal', definition: 'Handing out the cards.' },
    ],
    lesson: Array.from({ length: 5 }, (_, i) => ({
      title: `Step ${i + 1}`,
      body: 'Learn the [[deal]].',
    })),
    mistakes: ['One', 'Two', 'Three'],
    tips: ['Tip one', 'Tip two', 'Tip three'],
    quiz: Array.from({ length: 5 }, () => ({
      question: 'Which?',
      options: ['A', 'B', 'C', 'D'],
      answer: 1,
      explanation: 'Because.',
    })),
    ...(s.example
      ? {
          example: {
            intro: 'Let us play.',
            steps: Array.from({ length: 4 }, () => ({
              narration: 'Play a [[trick]].',
              scene: { zones: [{ id: 'hand', cards: ['AS', 'KH'] }] },
            })),
            outro: 'Well played!',
          },
        }
      : {}),
    seo: {
      description: `Learn ${s.name} step by step with animated lessons, a coached hand and a quiz.`,
    },
  });

  const raw: Record<string, unknown> = {
    'teen-patti': rawGame({
      slug: 'teen-patti',
      name: 'Teen Patti',
      aka: ['Flush', '3 Patti'],
      country: 'India',
      region: 'south-asia',
      type: 'comparing',
      players: [3, 6],
      difficulty: 2,
      minutes: 5,
      moods: ['lucky', 'social'],
      order: 20,
      hook: 'Three cards, big bluffs and a pot in the middle.',
    }),
    bridge: rawGame({
      slug: 'bridge',
      name: 'Bridge',
      country: 'United Kingdom',
      region: 'europe',
      type: 'trick-taking',
      players: [4, 4],
      difficulty: 5,
      minutes: 30,
      moods: ['brainy', 'competitive'],
      order: 90,
      hook: 'The great partnership game of bidding and tricks.',
      example: true,
    }),
    klondike: rawGame({
      slug: 'klondike',
      name: 'Klondike',
      aka: ['Solitaire', 'Patience'],
      country: 'United States',
      region: 'north-america',
      type: 'solitaire',
      players: [1, 1],
      difficulty: 2,
      minutes: 10,
      moods: ['chill', 'brainy'],
      order: 10,
      hook: 'The classic one-player game: build four piles from Ace to King.',
    }),
    'go-fish': rawGame({
      slug: 'go-fish',
      name: 'Go Fish',
      country: 'Worldwide',
      region: 'global',
      type: 'fishing',
      players: [2, 6],
      difficulty: 1,
      minutes: 10,
      moods: ['chill', 'social'],
      order: 10,
      hook: 'Ask for cards, collect sets of four — perfect for kids.',
    }),
    scopa: rawGame({
      slug: 'scopa',
      name: 'Scopa',
      country: 'Italy',
      region: 'europe',
      type: 'fishing',
      players: [2, 4],
      difficulty: 3,
      minutes: 20,
      moods: ['social', 'competitive'],
      order: 60,
      hook: 'Sweep the table by capturing cards that add up.',
      example: true,
    }),
    hearts: rawGame({
      slug: 'hearts',
      name: 'Hearts',
      country: 'United States',
      region: 'north-america',
      type: 'trick-taking',
      players: [3, 6],
      difficulty: 3,
      minutes: 15,
      moods: ['competitive', 'brainy'],
      order: 50,
      hook: 'Dodge every heart and the dreaded Queen of Spades.',
    }),
  };
  const tier1 = ['teen-patti', 'klondike', 'go-fish', 'hearts'];
  return { rawGame, raw, tier1 };
});

vi.mock('@content/games', () => ({ rawGameContent: fx.raw }));
vi.mock('@/games/registry.generated', () => ({ TIER1_SLUGS: fx.tier1, gameModuleLoaders: {} }));

import { filterGames, getAllGames, getGame, isTier1, type CatalogFilter } from './catalog';

const slugs = (f: CatalogFilter) => filterGames(getAllGames(), f).map((g) => g.slug);

describe('catalog loading', () => {
  it('validates and sorts every game by journey order, then name', () => {
    expect(getAllGames().map((g) => g.slug)).toEqual([
      'go-fish', // order 10, "Go Fish" < "Klondike"
      'klondike',
      'teen-patti',
      'hearts',
      'scopa',
      'bridge',
    ]);
  });

  it('derives the tier from the engine registry', () => {
    const tiers = Object.fromEntries(getAllGames().map((g) => [g.slug, g.tier]));
    expect(tiers).toEqual({
      'go-fish': 1,
      klondike: 1,
      'teen-patti': 1,
      hearts: 1,
      scopa: 2,
      bridge: 2,
    });
  });

  it('getGame and isTier1 look games up by slug', () => {
    expect(getGame('bridge')?.name).toBe('Bridge');
    expect(getGame('nope')).toBeUndefined();
    expect(isTier1('hearts')).toBe(true);
    expect(isTier1('bridge')).toBe(false);
    expect(isTier1('nope')).toBe(false);
  });

  it('exposes parsed content with defaults applied', () => {
    expect(getGame('klondike')?.featured).toBe(false);
    expect(getGame('bridge')?.example?.steps[0]?.scene.zones[0]?.layout).toBe('row');
  });
});

describe('filterGames', () => {
  it('returns every game (in order, as a new array) for an empty filter', () => {
    const all = getAllGames();
    const out = filterGames(all, {});
    expect(out).toEqual(all);
    expect(out).not.toBe(all);
    expect(
      slugs({
        query: '   ',
        region: 'all',
        type: 'all',
        difficulty: 'all',
        players: 'all',
        mood: 'all',
        playableOnly: false,
      }),
    ).toEqual(all.map((g) => g.slug));
  });

  it('searches name, aka, country and hook — case-insensitively and trimmed', () => {
    expect(slugs({ query: 'HEARTS' })).toEqual(['hearts']);
    expect(slugs({ query: '  patience ' })).toEqual(['klondike']);
    expect(slugs({ query: 'flush' })).toEqual(['teen-patti']);
    expect(slugs({ query: 'italy' })).toEqual(['scopa']);
    expect(slugs({ query: 'queen of spades' })).toEqual(['hearts']);
    expect(slugs({ query: 'united' })).toEqual(['klondike', 'hearts', 'bridge']);
    expect(slugs({ query: 'mahjong' })).toEqual([]);
  });

  it('filters by region', () => {
    expect(slugs({ region: 'europe' })).toEqual(['scopa', 'bridge']);
    expect(slugs({ region: 'south-asia' })).toEqual(['teen-patti']);
    expect(slugs({ region: 'east-asia' })).toEqual([]);
  });

  it('filters by type', () => {
    expect(slugs({ type: 'fishing' })).toEqual(['go-fish', 'scopa']);
    expect(slugs({ type: 'trick-taking' })).toEqual(['hearts', 'bridge']);
  });

  it('filters by exact difficulty', () => {
    expect(slugs({ difficulty: 2 })).toEqual(['klondike', 'teen-patti']);
    expect(slugs({ difficulty: 5 })).toEqual(['bridge']);
    expect(slugs({ difficulty: 4 })).toEqual([]);
  });

  it('filters by player count inside each game’s min..max range', () => {
    expect(slugs({ players: 1 })).toEqual(['klondike']);
    expect(slugs({ players: 2 })).toEqual(['go-fish', 'scopa']);
    expect(slugs({ players: 4 })).toEqual(['go-fish', 'teen-patti', 'hearts', 'scopa', 'bridge']);
    expect(slugs({ players: 6 })).toEqual(['go-fish', 'teen-patti', 'hearts']);
    expect(slugs({ players: 7 })).toEqual([]);
  });

  it('filters by mood', () => {
    expect(slugs({ mood: 'chill' })).toEqual(['go-fish', 'klondike']);
    expect(slugs({ mood: 'lucky' })).toEqual(['teen-patti']);
    expect(slugs({ mood: 'competitive' })).toEqual(['hearts', 'scopa', 'bridge']);
  });

  it('playableOnly keeps Tier 1 games only', () => {
    expect(slugs({ playableOnly: true })).toEqual(['go-fish', 'klondike', 'teen-patti', 'hearts']);
  });

  it('combines filters with AND', () => {
    expect(slugs({ region: 'north-america', playableOnly: true, players: 4 })).toEqual(['hearts']);
    expect(slugs({ mood: 'social', type: 'fishing', difficulty: 3 })).toEqual(['scopa']);
    expect(slugs({ query: 'cards', mood: 'chill' })).toEqual(['go-fish']);
    expect(slugs({ region: 'europe', playableOnly: true })).toEqual([]);
  });

  it('does not mutate the input list', () => {
    const all = getAllGames();
    const copy = all.slice();
    filterGames(all, { mood: 'lucky', playableOnly: true });
    expect(all).toEqual(copy);
  });
});

describe('invalid content fails loudly', () => {
  it('throws one error listing every problem in every file', async () => {
    vi.resetModules();
    const broken = fx.rawGame({
      slug: 'broken',
      name: 'Broken',
      country: 'Nowhere',
      region: 'global',
      type: 'shedding',
      players: [2, 4],
      difficulty: 9,
      minutes: 5,
      moods: ['chill'],
      order: 1,
      hook: 'Oops.',
    });
    const mismatched = fx.rawGame({
      slug: 'renamed',
      name: 'Renamed',
      country: 'Nowhere',
      region: 'global',
      type: 'shedding',
      players: [2, 4],
      difficulty: 1,
      minutes: 5,
      moods: ['chill'],
      order: 2,
      hook: 'Slug and file disagree.',
      example: true,
    });
    const noExample = fx.rawGame({
      slug: 'no-example',
      name: 'No Example',
      country: 'Nowhere',
      region: 'global',
      type: 'shedding',
      players: [2, 4],
      difficulty: 1,
      minutes: 5,
      moods: ['chill'],
      order: 3,
      hook: 'Tier 2 without a scripted example.',
    });
    vi.doMock('@content/games', () => ({
      rawGameContent: { ...fx.raw, broken, 'old-name': mismatched, 'no-example': noExample },
    }));
    await expect(import('./catalog')).rejects.toThrow(
      new RegExp(
        [
          '^Invalid game content:',
          '\\[broken\\] difficulty: .+',
          '\\[renamed\\] slug "renamed" does not match file name "old-name"',
          '\\[no-example\\] Tier 2 game \\(no engine\\) must include a scripted example$',
        ].join('\n'),
      ),
    );
    vi.doUnmock('@content/games');
  });
});
