/**
 * Client-safe catalog data: the serialisable poster summary, the filter state,
 * URL (de)serialisation and the client-side filter over a prebuilt index.
 *
 * The index is built on the server with `filterGames` (see catalog-index.ts),
 * so the client never bundles the full game content.
 */
import type { GameType, Mood, Region } from '@/lib/content/schema';

/** Everything a game poster needs — small and serialisable. */
export interface GameCardData {
  slug: string;
  name: string;
  aka: string[];
  country: string;
  countryCode: string;
  region: Region;
  regionLabel: string;
  type: GameType;
  typeLabel: string;
  players: { min: number; max: number };
  difficulty: number;
  length: string;
  hook: string;
  tier: 1 | 2;
}

export interface FacetOption<V extends string> {
  value: V;
  label: string;
}

/** Precomputed filter index: for every facet value, the slugs that match it. */
export interface CatalogIndex {
  cards: GameCardData[];
  /** Lower-cased search text per slug. */
  search: Record<string, string>;
  facets: {
    region: Record<string, string[]>;
    type: Record<string, string[]>;
    difficulty: Record<string, string[]>;
    players: Record<string, string[]>;
    mood: Record<string, string[]>;
    playable: string[];
  };
  options: {
    region: FacetOption<Region>[];
    type: FacetOption<GameType>[];
    mood: FacetOption<Mood>[];
    difficulty: number[];
    players: number[];
  };
}

export interface CatalogFilters {
  query: string;
  region: Region | 'all';
  type: GameType | 'all';
  difficulty: number | 'all';
  players: number | 'all';
  mood: Mood | 'all';
  playable: boolean;
}

export const DEFAULT_FILTERS: CatalogFilters = {
  query: '',
  region: 'all',
  type: 'all',
  difficulty: 'all',
  players: 'all',
  mood: 'all',
  playable: false,
};

/** Highest player-count chip; it means "this many or more" in the label. */
export const PLAYERS_MAX_CHIP = 5;

interface ParamsLike {
  get(name: string): string | null;
}

function pick<V extends string>(raw: string | null, options: FacetOption<V>[]): V | 'all' {
  const hit = options.find((o) => o.value === raw);
  return hit ? hit.value : 'all';
}

function pickNumber(raw: string | null, allowed: number[]): number | 'all' {
  if (raw === null || !/^\d+$/.test(raw)) return 'all';
  const n = Number(raw);
  return allowed.includes(n) ? n : 'all';
}

/** Read filters from a query string, ignoring unknown or invalid values. */
export function parseFilters(params: ParamsLike, options: CatalogIndex['options']): CatalogFilters {
  return {
    query: (params.get('q') ?? '').slice(0, 80),
    region: pick(params.get('region'), options.region),
    type: pick(params.get('type'), options.type),
    difficulty: pickNumber(params.get('difficulty'), options.difficulty),
    players: pickNumber(params.get('players'), options.players),
    mood: pick(params.get('mood'), options.mood),
    playable: params.get('playable') === '1',
  };
}

/** Serialise filters to a query string (defaults omitted; '' when nothing is set). */
export function filtersToQuery(f: CatalogFilters): string {
  const p = new URLSearchParams();
  const q = f.query.trim();
  if (q) p.set('q', q);
  if (f.region !== 'all') p.set('region', f.region);
  if (f.type !== 'all') p.set('type', f.type);
  if (f.difficulty !== 'all') p.set('difficulty', String(f.difficulty));
  if (f.players !== 'all') p.set('players', String(f.players));
  if (f.mood !== 'all') p.set('mood', f.mood);
  if (f.playable) p.set('playable', '1');
  return p.toString();
}

/** Number of active filters (search counts as one). */
export function countActive(f: CatalogFilters): number {
  let n = 0;
  if (f.query.trim()) n++;
  if (f.region !== 'all') n++;
  if (f.type !== 'all') n++;
  if (f.difficulty !== 'all') n++;
  if (f.players !== 'all') n++;
  if (f.mood !== 'all') n++;
  if (f.playable) n++;
  return n;
}

/** Filter the index. Equivalent to `filterGames` (verified by tests). */
export function applyFilters(index: CatalogIndex, f: CatalogFilters): GameCardData[] {
  const q = f.query.trim().toLowerCase();
  const sets: Array<Set<string>> = [];
  const add = (slugs: string[] | undefined) => sets.push(new Set(slugs ?? []));
  if (f.region !== 'all') add(index.facets.region[f.region]);
  if (f.type !== 'all') add(index.facets.type[f.type]);
  if (f.difficulty !== 'all') add(index.facets.difficulty[String(f.difficulty)]);
  if (f.players !== 'all') add(index.facets.players[String(f.players)]);
  if (f.mood !== 'all') add(index.facets.mood[f.mood]);
  if (f.playable) add(index.facets.playable);
  return index.cards.filter((card) => {
    if (q && !(index.search[card.slug] ?? '').includes(q)) return false;
    return sets.every((s) => s.has(card.slug));
  });
}

/** "🇮🇳" from "IN"; "UN" (worldwide) or anything invalid gives a globe. */
export function flagEmoji(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (code === 'UN' || !/^[A-Z]{2}$/.test(code)) return '🌐';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
