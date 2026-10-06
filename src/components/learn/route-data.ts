/**
 * Shared helpers for the /games/[slug]/* server routes: static params, the
 * game lookup (404 for unknown slugs) and per-route metadata.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { siteConfig } from '@/config/site';
import { getAllGames, getGame, type CatalogGame } from '@/lib/content/catalog';
import { t } from '@/lib/i18n';

export interface SlugParams {
  params: Promise<{ slug: string }>;
}

export function gameStaticParams(): { slug: string }[] {
  return getAllGames().map((g) => ({ slug: g.slug }));
}

/** The game for a route, or a 404. */
export async function requireGame(params: SlugParams['params']): Promise<CatalogGame> {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) notFound();
  return game;
}

/**
 * The game's generated share image (src/app/games/[slug]/opengraph-image.tsx).
 * Listed explicitly because a page that sets `openGraph` replaces its parents'
 * Open Graph data, file-based images included.
 */
export function gameShareImage(game: Pick<CatalogGame, 'slug' | 'name'>) {
  return {
    url: `/games/${game.slug}/opengraph-image`,
    width: 1200,
    height: 630,
    type: 'image/png',
    alt: t('catalog.og.altGame', { name: game.name, site: siteConfig.name }),
  };
}

/** Metadata for a game page; unknown slugs get an empty object (the page 404s). */
export async function gamePageMetadata(
  params: SlugParams['params'],
  build: (game: CatalogGame) => { title: string; description: string; path: string },
): Promise<Metadata> {
  const { slug } = await params;
  const game = getGame(slug);
  if (!game) return {};
  const { title, description, path } = build(game);
  const image = gameShareImage(game);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: 'website',
      siteName: siteConfig.name,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
