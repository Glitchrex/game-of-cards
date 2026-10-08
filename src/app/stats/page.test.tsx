import { type Metadata } from 'next';
import { type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { titles } from '@content/titles';
import { fixtureGame } from '@/components/catalog/test-fixtures';
import { type GameSummary } from '@/components/journey/journey-data';
import { loadRealCatalog, restoreCatalog } from '@/components/landing/test-real-catalog';
import { type CatalogGame } from '@/lib/content/catalog';

const FIXTURES: CatalogGame[] = [
  fixtureGame({ slug: 'war', name: 'War', tier: 1, order: 10 }),
  fixtureGame({ slug: 'old-maid', name: 'Old Maid', order: 20 }),
  fixtureGame({ slug: 'bridge', name: 'Bridge', order: 30 }),
];

type PageModule = { default: () => ReactElement; metadata: Metadata };

/** The page module, reading `games` from a mocked catalog. */
async function loadPage(games: readonly CatalogGame[]): Promise<PageModule> {
  vi.resetModules();
  vi.doMock('@/lib/content/catalog', () => ({ getAllGames: () => games }));
  return (await import('./page')) as PageModule;
}

/** Captures the props the server page hands to the client dashboard. */
async function dashboardProps(games: readonly CatalogGame[]) {
  let seen: { games: GameSummary[]; titleBlurbs?: Record<string, string> } | undefined;
  vi.doMock('@/components/stats/StatsDashboard', () => ({
    StatsDashboard: (props: NonNullable<typeof seen>) => {
      seen = props;
      return null;
    },
  }));
  const { default: Page } = await loadPage(games);
  renderToString(<Page />);
  vi.doUnmock('@/components/stats/StatsDashboard');
  return seen;
}

afterEach(() => {
  vi.doUnmock('@/lib/content/catalog');
  vi.resetModules();
});

describe('/stats page', () => {
  it('server-renders the heading and a loading skeleton (stats live in localStorage)', async () => {
    const { default: Page } = await loadPage(FIXTURES);
    const html = renderToString(<Page />);
    expect(html).toContain('<h1');
    expect(html).toContain('Stats &amp; awards');
    expect(html).toContain('data-testid="stats-skeleton"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('data-testid="stats-balance"');
  });

  it('passes every catalog game (slug, name, tier) in order, plus the title blurbs', async () => {
    const props = await dashboardProps(FIXTURES);
    expect(props?.games).toEqual([
      { slug: 'war', name: 'War', tier: 1 },
      { slug: 'old-maid', name: 'Old Maid', tier: 2 },
      { slug: 'bridge', name: 'Bridge', tier: 2 },
    ]);
    // Only what the client needs crosses the server/client boundary.
    for (const g of props?.games ?? [])
      expect(Object.keys(g).sort()).toEqual(['name', 'slug', 'tier']);
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) expect(props?.titleBlurbs?.[title.id]).toBe(title.blurb);
    expect(Object.keys(props?.titleBlurbs ?? {})).toHaveLength(titles.length);
  });

  it('has page metadata with a canonical URL and keeps the site share image', async () => {
    const { metadata } = await loadPage(FIXTURES);
    expect(metadata.title).toBe('Stats & awards');
    expect(metadata.description).toMatch(/Awards Shelf/);
    expect(metadata.alternates?.canonical).toBe('/stats');
    expect(metadata.openGraph).toMatchObject({
      url: '/stats',
      siteName: 'Game of Cards',
      images: [expect.objectContaining({ url: '/opengraph-image', width: 1200, height: 630 })],
    });
    expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' });
  });

  describe('with the real catalog', () => {
    let games: CatalogGame[] = [];
    beforeAll(async () => {
      games = await loadRealCatalog();
    });
    afterAll(() => restoreCatalog());

    it('renders and hands the client every game in journey order', async () => {
      expect(games.length).toBeGreaterThan(0);
      vi.doMock('@/components/stats/StatsDashboard', () => ({
        StatsDashboard: ({ games: passed }: { games: GameSummary[] }) => (
          <ol>
            {passed.map((g) => (
              <li key={g.slug} data-slug={g.slug} />
            ))}
          </ol>
        ),
      }));
      const { default: Page } = (await import('./page')) as PageModule;
      const html = renderToString(<Page />);
      vi.doUnmock('@/components/stats/StatsDashboard');
      const slugs = [...html.matchAll(/data-slug="([a-z0-9-]+)"/g)].map((m) => m[1]);
      expect(slugs).toEqual(games.map((g) => g.slug));
    });
  });
});
