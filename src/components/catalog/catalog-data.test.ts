/**
 * The client-side filter must agree exactly with `filterGames`. The generated
 * registries are mocked so these tests run on fixtures only.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@content/games', () => ({ rawGameContent: {} }));
vi.mock('@/games/registry.generated', () => ({
  TIER1_SLUGS: [],
  ENGINE_SLUGS: [],
  gameModuleLoaders: {},
}));

import { filterGames, type CatalogFilter } from '@/lib/content/catalog';
import { createRng } from '@/games/core/rng';
import {
  DEFAULT_FILTERS,
  applyFilters,
  countActive,
  filtersToQuery,
  flagEmoji,
  parseFilters,
  type CatalogFilters,
} from './catalog-data';
import { buildCatalogIndex, toGameCardData } from './catalog-index';
import { ogText } from './og-text';
import { FIXTURE_GAMES } from './test-fixtures';

const index = buildCatalogIndex(FIXTURE_GAMES);

function toCatalogFilter(f: CatalogFilters): CatalogFilter {
  return {
    query: f.query,
    region: f.region,
    type: f.type,
    difficulty: f.difficulty,
    players: f.players,
    mood: f.mood,
    playableOnly: f.playable,
  };
}

const slugs = (games: { slug: string }[]) => games.map((g) => g.slug);

describe('buildCatalogIndex', () => {
  it('keeps catalog order and serialisable poster data', () => {
    expect(slugs(index.cards)).toEqual(slugs(FIXTURE_GAMES));
    expect(JSON.parse(JSON.stringify(index))).toEqual(index);
    expect(index.cards[0]).toEqual(toGameCardData(FIXTURE_GAMES[0]!));
    expect(index.cards[0]).toMatchObject({
      regionLabel: 'South Asia',
      typeLabel: 'Comparing',
      tier: 1,
    });
  });

  it('only offers regions, types and moods that some game has', () => {
    expect(index.options.region.map((o) => o.value)).not.toContain('east-asia');
    expect(index.options.type.map((o) => o.value)).not.toContain('casino');
    expect(index.options.type.find((o) => o.value === 'fishing')?.label).toBe('Fishing');
    expect(index.options.mood.find((o) => o.value === 'chill')?.label).toBe('Chill');
    expect(index.options.difficulty).toEqual([1, 2, 3, 4, 5]);
    expect(index.options.players).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('applyFilters', () => {
  it('matches filterGames for single filters', () => {
    const cases: Partial<CatalogFilters>[] = [
      { query: 'patti' },
      { query: '  ITALY ' },
      { query: 'thirteen' },
      { query: 'queen of spades' },
      { region: 'europe' },
      { type: 'trick-taking' },
      { difficulty: 3 },
      { players: 1 },
      { players: 5 },
      { mood: 'social' },
      { playable: true },
    ];
    for (const c of cases) {
      const f = { ...DEFAULT_FILTERS, ...c };
      expect(slugs(applyFilters(index, f)), JSON.stringify(c)).toEqual(
        slugs(filterGames(FIXTURE_GAMES, toCatalogFilter(f))),
      );
    }
  });

  it('matches filterGames for 2,000 random filter combinations', () => {
    const rng = createRng(20261005);
    const pickFrom = <T>(xs: readonly T[]): T => xs[rng.int(xs.length)]!;
    const queries = ['', '', '', 'a', 'he', 'solitaire', 'india', 'partner', 'zzz'];
    for (let i = 0; i < 2000; i++) {
      const f: CatalogFilters = {
        query: pickFrom(queries),
        region: pickFrom(['all', 'all', ...index.options.region.map((o) => o.value)] as const),
        type: pickFrom(['all', 'all', ...index.options.type.map((o) => o.value)] as const),
        difficulty: pickFrom(['all', 'all', 1, 2, 3, 4, 5] as const),
        players: pickFrom(['all', 'all', 1, 2, 3, 4, 5] as const),
        mood: pickFrom(['all', 'all', ...index.options.mood.map((o) => o.value)] as const),
        playable: rng.int(3) === 0,
      };
      expect(slugs(applyFilters(index, f))).toEqual(
        slugs(filterGames(FIXTURE_GAMES, toCatalogFilter(f))),
      );
    }
  });
});

describe('URL filters', () => {
  it('round-trips through the query string and omits defaults', () => {
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe('');
    const f: CatalogFilters = {
      query: 'hearts',
      region: 'europe',
      type: 'fishing',
      difficulty: 3,
      players: 4,
      mood: 'brainy',
      playable: true,
    };
    const qs = filtersToQuery(f);
    expect(qs).toBe(
      'q=hearts&region=europe&type=fishing&difficulty=3&players=4&mood=brainy&playable=1',
    );
    expect(parseFilters(new URLSearchParams(qs), index.options)).toEqual(f);
    expect(countActive(f)).toBe(7);
    expect(countActive(DEFAULT_FILTERS)).toBe(0);
  });

  it('ignores unknown or malformed values', () => {
    const f = parseFilters(
      new URLSearchParams(
        'region=mars&type=poker&difficulty=9&players=two&mood=angry&playable=yes',
      ),
      index.options,
    );
    expect(f).toEqual(DEFAULT_FILTERS);
  });
});

describe('flagEmoji and ogText', () => {
  it('turns country codes into regional-indicator flags, with a globe for UN', () => {
    expect(flagEmoji('IN')).toBe('🇮🇳');
    expect(flagEmoji('vn')).toBe('🇻🇳');
    expect(flagEmoji('UN')).toBe('🌐');
    expect(flagEmoji('1X')).toBe('🌐');
  });

  it('spells out suit symbols and drops emoji for the OG font', () => {
    expect(ogText('The 2♠ rules them all 🎉')).toBe('The 2 of Spades rules them all');
    expect(ogText('Tiến Lên')).toBe('Tiến Lên');
  });
});
