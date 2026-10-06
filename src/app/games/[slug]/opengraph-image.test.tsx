/**
 * The per-game share image: one static PNG per game, rendered with next/og's
 * bundled font only. A glyph the font lacks (a suit symbol, an emoji) makes
 * next/og fetch a fallback font or emoji over the network, so the real content
 * text is checked too.
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { describe, expect, it, vi } from 'vitest';
import { ogText } from '@/components/catalog/og-text';
import type { CatalogGame } from '@/lib/content/catalog';
import { GAME_TYPE_LABELS, validateGameContent } from '@/lib/content/schema';
import { fixtureGame } from '@/components/catalog/test-fixtures';

const fx = vi.hoisted(() => ({ games: [] as CatalogGame[] }));

vi.mock('@/lib/content/catalog', () => ({
  getAllGames: () => fx.games,
  getGame: (slug: string) => fx.games.find((g) => g.slug === slug),
}));

import Image, {
  alt,
  contentType,
  dynamicParams,
  generateStaticParams,
  size,
} from './opengraph-image';

fx.games.push(
  fixtureGame({ slug: 'teen-patti', name: 'Teen Patti', tier: 1, hook: 'Bluff with A♠ K♥ 🎉' }),
  fixtureGame({ slug: 'durak', name: 'Durak', country: 'Russia', countryCode: 'RU' }),
);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Runs `render` and returns every non-data: URL fetched meanwhile. */
async function remoteFetches(render: () => Promise<void>): Promise<string[]> {
  const spy = vi.spyOn(globalThis, 'fetch');
  try {
    await render();
    return spy.mock.calls
      .map(([input]) => (input instanceof Request ? input.url : String(input)))
      .filter((url) => !url.startsWith('data:'));
  } finally {
    spy.mockRestore();
  }
}

describe('/games/[slug]/opengraph-image', () => {
  it('is a static 1200×630 PNG for every game and nothing else', () => {
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe('image/png');
    expect(alt).toMatch(/Game of Cards/);
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual([{ slug: 'teen-patti' }, { slug: 'durak' }]);
  });

  it('renders a real PNG for Tier 1 and Tier 2 games without network requests', async () => {
    const remote = await remoteFetches(async () => {
      for (const slug of ['teen-patti', 'durak']) {
        const res = await Image({ params: Promise.resolve({ slug }) });
        expect(res.headers.get('content-type')).toBe('image/png');
        const bytes = new Uint8Array(await res.arrayBuffer());
        expect(Array.from(bytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        expect(view.getUint32(16)).toBe(1200);
        expect(view.getUint32(20)).toBe(630);
        expect(bytes.byteLength).toBeGreaterThan(10_000);
      }
    });
    // The fixture hook has suit symbols and an emoji: they are spelled out / dropped.
    expect(remote).toEqual([]);
  });

  it('only uses glyphs the bundled font has for every real game', async () => {
    const dir = path.resolve(import.meta.dirname, '../../../../content/games');
    const files = readdirSync(dir).filter(
      (f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'),
    );
    const lines: string[] = [];
    for (const file of files) {
      const mod = (await import(path.join(dir, file))) as { default: unknown };
      const fileSlug = file.replace(/\.ts$/, '');
      const { content } = validateGameContent(mod.default, { fileSlug, hasEngine: true });
      if (!content) throw new Error(`${fileSlug}: invalid content`);
      lines.push(
        ogText(content.name),
        ogText(content.hook),
        ogText(`${content.origin.country} · ${GAME_TYPE_LABELS[content.type]}`),
      );
    }
    expect(lines.length).toBeGreaterThan(0);
    // One image with every line (text outside the canvas is still shaped, so a
    // missing glyph anywhere triggers a fetch).
    const remote = await remoteFetches(async () => {
      const res = new ImageResponse(
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 24 }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'flex' }}>
              {line}
            </div>
          ))}
        </div>,
        size,
      );
      await res.arrayBuffer();
    });
    expect(remote).toEqual([]);
  });
});
