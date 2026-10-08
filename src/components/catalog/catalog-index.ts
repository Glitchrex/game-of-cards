/**
 * Server-side catalog index builder. Uses `filterGames` from the catalog for
 * every facet value, so the client filter (applyFilters) matches it exactly
 * without shipping the full game content to the browser.
 *
 * Import this only from server components / route files.
 */
import { filterGames, type CatalogGame } from '@/lib/content/catalog';
import { GAME_TYPE_LABELS, GAME_TYPES, MOODS, REGION_LABELS, REGIONS } from '@/lib/content/schema';
import { t } from '@/lib/i18n';
import { PLAYERS_MAX_CHIP, type CatalogIndex, type GameCardData } from './catalog-data';

/** The poster summary of one game. */
export function toGameCardData(game: CatalogGame): GameCardData {
  return {
    slug: game.slug,
    name: game.name,
    aka: game.aka ?? [],
    country: game.origin.country,
    countryCode: game.origin.countryCode,
    region: game.origin.region,
    regionLabel: REGION_LABELS[game.origin.region],
    type: game.type,
    typeLabel: GAME_TYPE_LABELS[game.type],
    players: { min: game.players.min, max: game.players.max },
    difficulty: game.difficulty,
    length: game.length,
    hook: game.hook,
    tier: game.tier,
  };
}

/** Same text `filterGames` searches: name, aka, country and hook. */
function searchText(game: CatalogGame): string {
  return [game.name, ...(game.aka ?? []), game.origin.country, game.hook].join(' ').toLowerCase();
}

const slugs = (games: CatalogGame[]) => games.map((g) => g.slug);

export function buildCatalogIndex(games: readonly CatalogGame[]): CatalogIndex {
  const region: Record<string, string[]> = {};
  for (const r of REGIONS) region[r] = slugs(filterGames(games, { region: r }));
  const type: Record<string, string[]> = {};
  for (const ty of GAME_TYPES) type[ty] = slugs(filterGames(games, { type: ty }));
  const mood: Record<string, string[]> = {};
  for (const m of MOODS) mood[m] = slugs(filterGames(games, { mood: m }));
  const difficultyValues = [1, 2, 3, 4, 5];
  const difficulty: Record<string, string[]> = {};
  for (const d of difficultyValues) difficulty[d] = slugs(filterGames(games, { difficulty: d }));
  const playerValues = Array.from({ length: PLAYERS_MAX_CHIP }, (_, i) => i + 1);
  const players: Record<string, string[]> = {};
  for (const p of playerValues) players[p] = slugs(filterGames(games, { players: p }));

  return {
    cards: games.map(toGameCardData),
    search: Object.fromEntries(games.map((g) => [g.slug, searchText(g)])),
    facets: {
      region,
      type,
      difficulty,
      players,
      mood,
      playable: slugs(filterGames(games, { playableOnly: true })),
    },
    options: {
      // Only offer regions/types/moods that at least one game has.
      region: REGIONS.filter((r) => (region[r]?.length ?? 0) > 0).map((r) => ({
        value: r,
        label: REGION_LABELS[r],
      })),
      type: GAME_TYPES.filter((ty) => (type[ty]?.length ?? 0) > 0).map((ty) => ({
        value: ty,
        label: GAME_TYPE_LABELS[ty],
      })),
      mood: MOODS.filter((m) => (mood[m]?.length ?? 0) > 0).map((m) => ({
        value: m,
        label: t(`catalog.filters.moods.${m}`),
      })),
      difficulty: difficultyValues,
      players: playerValues,
    },
  };
}
