import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
import { getAllGames } from '@/lib/content/catalog';

type Entry = MetadataRoute.Sitemap[number];

/** Absolute URL for a site path, tolerant of a trailing slash on the configured base. */
function absolute(path: string): string {
  const base = siteConfig.url.replace(/\/+$/, '');
  return path === '/' ? `${base}/` : `${base}${path}`;
}

function entry(path: string, priority: number, changeFrequency: Entry['changeFrequency']): Entry {
  return { url: absolute(path), changeFrequency, priority };
}

/**
 * Every indexable page: the static sections, each game's hub, lesson, practice hand and
 * quiz, plus the live table for Tier 1 games. Admin and API routes are excluded (and
 * disallowed in robots.txt).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const games = getAllGames().flatMap((game) => {
    const hub = `/games/${game.slug}`;
    const pages: Entry[] = [
      entry(hub, 0.8, 'monthly'),
      entry(`${hub}/learn`, 0.7, 'monthly'),
      entry(`${hub}/try`, 0.6, 'monthly'),
      entry(`${hub}/quiz`, 0.5, 'monthly'),
    ];
    if (game.tier === 1) pages.push(entry(`${hub}/play`, 0.6, 'monthly'));
    return pages;
  });

  return [
    entry('/', 1, 'weekly'),
    entry('/basics', 0.8, 'monthly'),
    entry('/games', 0.9, 'weekly'),
    ...games,
    entry('/journey', 0.5, 'monthly'),
    entry('/stats', 0.4, 'monthly'),
    entry('/community', 0.6, 'daily'),
    entry('/contact', 0.4, 'yearly'),
  ];
}
