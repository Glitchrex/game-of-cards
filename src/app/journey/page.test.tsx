import { type Metadata } from 'next';
import { type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { fixtureGame } from '@/components/catalog/test-fixtures';
import { loadRealCatalog, restoreCatalog } from '@/components/landing/test-real-catalog';
import { type CatalogGame } from '@/lib/content/catalog';

type PageModule = { default: () => ReactElement; metadata: Metadata };

const stopSlugs = (html: string) =>
  [...html.matchAll(/data-testid="journey-node-([a-z0-9-]+)"/g)].map((m) => m[1]);

const FIXTURES: CatalogGame[] = [
  fixtureGame({ slug: 'war', name: 'War', tier: 1, order: 10 }),
  fixtureGame({ slug: 'old-maid', name: 'Old Maid', order: 20 }),
  fixtureGame({ slug: 'bridge', name: 'Bridge', order: 30 }),
];

async function loadPage(games: readonly CatalogGame[]): Promise<PageModule> {
  vi.resetModules();
  vi.doMock('@/lib/content/catalog', () => ({ getAllGames: () => games }));
  return (await import('./page')) as PageModule;
}

afterEach(() => {
  vi.doUnmock('@/lib/content/catalog');
  vi.resetModules();
});

describe('/journey page', () => {
  it('passes every game (name, tier) to the map and renders neutral stops on the server', async () => {
    const { default: Page } = await loadPage(FIXTURES);
    const html = renderToString(<Page />);
    expect(html).toContain('Your learning journey');
    expect(stopSlugs(html)).toEqual(['war', 'old-maid', 'bridge']);
    expect(html).toContain('href="/games/old-maid"');
    expect(html).toContain('Old Maid');
    // Only War is playable vs bot, so exactly one Play chip.
    expect(html.match(/>Play</g)).toHaveLength(1);
    // Statuses come from localStorage, so the server renders neutral stops (still links,
    // with a position + name label) and a busy summary.
    expect(html.match(/data-status="pending"/g)).toHaveLength(3);
    expect(html).toContain('aria-label="2. Old Maid"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('data-testid="journey-summary"');
  });

  it('has page metadata with a canonical URL and keeps the site share image', async () => {
    const { metadata } = await loadPage(FIXTURES);
    expect(metadata.title).toBe('Your learning journey');
    expect(metadata.description).toMatch(/every card game/i);
    expect(metadata.alternates?.canonical).toBe('/journey');
    expect(metadata.openGraph).toMatchObject({
      url: '/journey',
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

    it('server-renders a linked stop for every catalog game, in the content order', async () => {
      expect(games.length).toBeGreaterThan(0);
      const { default: Page } = (await import('./page')) as PageModule;
      const html = renderToString(<Page />);
      expect(stopSlugs(html)).toEqual(games.map((g) => g.slug));
      const orders = games.map((g) => g.order);
      expect(orders).toEqual([...orders].sort((a, b) => a - b));
      for (const g of games) expect(html).toContain(`href="/games/${g.slug}"`);
      // A Play chip for exactly the Tier 1 games.
      expect(html.match(/>Play</g) ?? []).toHaveLength(games.filter((g) => g.tier === 1).length);
    });
  });
});
