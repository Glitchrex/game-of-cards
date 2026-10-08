/**
 * Test-only: the real catalog, built from every content file in content/games, without
 * depending on the generated registries (which are empty before `npm run gen`, and only
 * list finished GameModules while the Tier 1 boards are still being built).
 *
 * A game counts as Tier 1 when it has an engine folder (src/games/<slug>/engine.ts or
 * index.ts): content validation needs to know which games skip the scripted example. The
 * registry's own rule (an index.ts) is covered by the content validation tests.
 *
 * Call it from a `beforeAll`; afterwards, dynamic imports of modules that read the catalog
 * (`await import('@/app/sitemap')`, `await import('@/app/page')`) see the same games.
 * Undo with `restoreCatalog()` in `afterAll`.
 */
import { type CatalogGame } from '@/lib/content/catalog';

type Loader = () => Promise<{ default: unknown }>;

const contentModules = import.meta.glob('../../../content/games/*.ts') as Record<string, Loader>;
const engineModules = import.meta.glob(['../../games/*/index.ts', '../../games/*/engine.ts']);

const fileName = (file: string) => file.split('/').pop()!.replace(/\.ts$/, '');

export async function loadRealCatalog(): Promise<CatalogGame[]> {
  const raw: Record<string, unknown> = {};
  for (const [file, load] of Object.entries(contentModules)) {
    const slug = fileName(file);
    if (slug === 'index' || slug.endsWith('.test')) continue;
    raw[slug] = (await load()).default;
  }
  const tier1 = [
    ...new Set(Object.keys(engineModules).map((file) => file.split('/').at(-2)!)),
  ].filter((slug) => slug !== 'core');

  vi.resetModules();
  vi.doMock('@content/games', () => ({ rawGameContent: raw }));
  vi.doMock('@/games/slugs.generated', () => ({
    TIER1_SLUGS: tier1,
    ENGINE_SLUGS: tier1,
  }));
  return (await import('@/lib/content/catalog')).getAllGames();
}

export function restoreCatalog(): void {
  vi.doUnmock('@content/games');
  vi.doUnmock('@/games/slugs.generated');
  vi.resetModules();
}
