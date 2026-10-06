/** Server rendering and metadata of the /games catalog, on fixture content. */
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type * as CatalogModule from '@/lib/content/catalog';
import type { CatalogGame } from '@/lib/content/catalog';

const fx = vi.hoisted(() => ({ games: [] as CatalogGame[] }));

vi.mock('@content/games', () => ({ rawGameContent: {} }));
vi.mock('@/games/registry.generated', () => ({
  TIER1_SLUGS: [],
  ENGINE_SLUGS: [],
  gameModuleLoaders: {},
}));
vi.mock('@/lib/content/catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof CatalogModule>()),
  getAllGames: () => fx.games,
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/games',
}));

import { FIXTURE_GAMES } from '@/components/catalog/test-fixtures';
import GamesPage, { metadata } from './page';

fx.games.push(...FIXTURE_GAMES);

describe('/games', () => {
  it('has its own title, canonical and share image', () => {
    expect(metadata.title).toBe('All card games');
    expect(metadata.alternates?.canonical).toBe('/games');
    expect(metadata.openGraph).toMatchObject({ title: 'All card games', url: '/games' });
    // Setting openGraph here drops the inherited site image, so it is listed explicitly.
    expect(metadata.openGraph?.images).toEqual([
      expect.objectContaining({ url: '/opengraph-image', width: 1200, height: 630 }),
    ]);
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'All card games',
    });
  });

  it('server-renders the heading, the filters and a poster for every game', () => {
    const html = renderToString(<GamesPage />);
    expect(html).toMatch(/<h1[^>]*>Pick tonight’s game<\/h1>/);
    expect(html).toContain('data-testid="catalog-search"');
    expect(html).toContain(`All ${FIXTURE_GAMES.length} games`);
    for (const game of FIXTURE_GAMES) {
      expect(html).toContain(`data-testid="game-card-${game.slug}"`);
      expect(html).toContain(`href="/games/${game.slug}"`);
    }
  });
});
