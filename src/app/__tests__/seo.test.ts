import { type MetadataRoute } from 'next';
import manifest from '@/app/manifest';
import robots from '@/app/robots';
import { siteConfig } from '@/config/site';
import { type CatalogGame } from '@/lib/content/catalog';
import { FIXTURE_GAMES } from '@/components/landing/test-fixtures';
import { loadRealCatalog, restoreCatalog } from '@/components/landing/test-real-catalog';

const BASE = siteConfig.url.replace(/\/+$/, '');
const STATIC_PATHS = ['/basics', '/games', '/journey', '/stats', '/community', '/contact'];

function gamePaths(slug: string, tier: 1 | 2): string[] {
  const hub = `/games/${slug}`;
  return [hub, `${hub}/learn`, `${hub}/try`, `${hub}/quiz`, ...(tier === 1 ? [`${hub}/play`] : [])];
}

describe('sitemap.xml', () => {
  // The real catalog (every content file), whatever state the generated registries are in.
  let games: CatalogGame[] = [];
  let sitemap: () => MetadataRoute.Sitemap;
  beforeAll(async () => {
    games = await loadRealCatalog();
    sitemap = (await import('@/app/sitemap')).default;
  });
  afterAll(() => restoreCatalog());

  it('has real games to list', () => {
    expect(games.length).toBeGreaterThan(0);
  });

  it('lists the home page, every section and every page of every game in the catalog', () => {
    const urls = sitemap().map((e) => e.url);
    expect(urls).toContain(`${BASE}/`);
    for (const path of STATIC_PATHS) expect(urls).toContain(`${BASE}${path}`);
    for (const game of games)
      for (const path of gamePaths(game.slug, game.tier)) expect(urls).toContain(`${BASE}${path}`);
    expect(urls).toHaveLength(
      1 + STATIC_PATHS.length + games.reduce((n, g) => n + (g.tier === 1 ? 5 : 4), 0),
    );
  });

  it('uses absolute, unique URLs and never lists admin or API routes', () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const url of urls) {
      expect(url.startsWith(`${BASE}/`)).toBe(true);
      expect(url).not.toMatch(/\/(admin|api)(\/|$)/);
    }
    for (const e of entries) {
      expect(e.priority).toBeGreaterThan(0);
      expect(e.priority).toBeLessThanOrEqual(1);
    }
    expect(entries[0]).toMatchObject({ url: `${BASE}/`, priority: 1 });
  });

  it('adds the play page for Tier 1 games only', async () => {
    vi.resetModules();
    vi.doMock('@/lib/content/catalog', () => ({ getAllGames: () => FIXTURE_GAMES }));
    const { default: fixtureSitemap } = await import('@/app/sitemap');
    const urls = fixtureSitemap().map((e) => e.url);
    for (const game of FIXTURE_GAMES) {
      for (const path of gamePaths(game.slug, game.tier)) expect(urls).toContain(`${BASE}${path}`);
      const play = `${BASE}/games/${game.slug}/play`;
      if (game.tier === 1) expect(urls).toContain(play);
      else expect(urls).not.toContain(play);
    }
    expect(urls).toContain(`${BASE}/games/bridge/quiz`);
    expect(urls).not.toContain(`${BASE}/games/bridge/play`);
    vi.doUnmock('@/lib/content/catalog');
    vi.resetModules();
  });
});

describe('robots.txt', () => {
  it('allows crawling, keeps bots out of /admin and /api, and points to the sitemap', () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    expect(rules).toHaveLength(1);
    const [rule] = rules;
    expect(rule?.userAgent).toBe('*');
    expect(rule?.allow).toBe('/');
    expect(rule?.disallow).toEqual(expect.arrayContaining(['/admin', '/api']));
    expect(r.sitemap).toBe(`${BASE}/sitemap.xml`);
  });
});

describe('manifest.webmanifest', () => {
  it('names the app, uses the felt theme and the SVG icon', () => {
    const m = manifest();
    expect(m.name).toBe('Game of Cards');
    expect(m.id).toBe('/');
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
    expect(m.theme_color).toBe('#062417');
    expect(m.background_color).toBe('#062417');
    expect(m.icons).toEqual([expect.objectContaining({ src: '/icon.svg', type: 'image/svg+xml' })]);
  });
});
