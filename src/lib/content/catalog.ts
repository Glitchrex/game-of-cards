/**
 * Validated, typed access to the game catalog. Importing this module parses
 * every content file with Zod — so an invalid file fails `next build`.
 */
import { rawGameContent } from '@content/games';
import { ENGINE_SLUGS, TIER1_SLUGS } from '@/games/slugs.generated';
import {
  validateGameContent,
  type GameContent,
  type GameType,
  type Mood,
  type Region,
} from './schema';

export interface CatalogGame extends GameContent {
  tier: 1 | 2;
}

function load(): CatalogGame[] {
  const tier1 = new Set(TIER1_SLUGS);
  // A game whose engine exists but whose Board/module is not wired up yet is
  // treated as engine-backed for validation (it does not need a scripted example);
  // scripts/validate-content.ts fails the build if that state is ever shipped.
  const engineBacked = new Set([...TIER1_SLUGS, ...ENGINE_SLUGS]);
  const games: CatalogGame[] = [];
  const problems: string[] = [];
  for (const [fileSlug, raw] of Object.entries(rawGameContent)) {
    const { content, issues } = validateGameContent(raw, {
      fileSlug,
      hasEngine: engineBacked.has(fileSlug),
    });
    if (issues.length || !content) {
      problems.push(...issues.map((i) => `[${i.slug}] ${i.message}`));
      continue;
    }
    games.push({ ...content, tier: tier1.has(content.slug) ? 1 : 2 });
  }
  if (problems.length) {
    throw new Error(`Invalid game content:\n${problems.join('\n')}`);
  }
  return games.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

const GAMES = load();
const BY_SLUG = new Map(GAMES.map((g) => [g.slug, g]));

export function getAllGames(): CatalogGame[] {
  return GAMES;
}

export function getGame(slug: string): CatalogGame | undefined {
  return BY_SLUG.get(slug);
}

export function isTier1(slug: string): boolean {
  return BY_SLUG.get(slug)?.tier === 1;
}

export interface CatalogFilter {
  query?: string;
  region?: Region | 'all';
  type?: GameType | 'all';
  difficulty?: number | 'all';
  players?: number | 'all';
  playableOnly?: boolean;
  mood?: Mood | 'all';
}

export function filterGames(games: readonly CatalogGame[], f: CatalogFilter): CatalogGame[] {
  const q = f.query?.trim().toLowerCase();
  return games.filter((g) => {
    if (q) {
      const hay = [g.name, ...(g.aka ?? []), g.origin.country, g.hook].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.region && f.region !== 'all' && g.origin.region !== f.region) return false;
    if (f.type && f.type !== 'all' && g.type !== f.type) return false;
    if (f.difficulty && f.difficulty !== 'all' && g.difficulty !== f.difficulty) return false;
    if (
      f.players &&
      f.players !== 'all' &&
      (g.players.min > f.players || g.players.max < f.players)
    )
      return false;
    if (f.mood && f.mood !== 'all' && !g.moods.includes(f.mood)) return false;
    if (f.playableOnly && g.tier !== 1) return false;
    return true;
  });
}
