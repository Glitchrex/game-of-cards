/**
 * Query-string parsing for /games/[slug]/play (server-safe, no React).
 * `?seed=` makes the deal deterministic for E2E tests (docs/DECISIONS.md D-15);
 * `?difficulty=` preselects the bot difficulty.
 */
import { type Difficulty } from '@/games/core/types';

export type SearchParams = Record<string, string | string[] | undefined>;

const SEED_RE = /^[A-Za-z0-9_-]{1,64}$/;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A safe seed string, or undefined for a random deal. */
export function parseSeed(value: string | string[] | undefined): string | undefined {
  const raw = first(value)?.trim();
  return raw && SEED_RE.test(raw) ? raw : undefined;
}

export function parseDifficulty(value: string | string[] | undefined): Difficulty | undefined {
  const raw = first(value)?.trim().toLowerCase();
  return raw === 'easy' || raw === 'normal' ? raw : undefined;
}

export function parsePlayParams(query: SearchParams): { seed?: string; difficulty?: Difficulty } {
  return { seed: parseSeed(query.seed), difficulty: parseDifficulty(query.difficulty) };
}
