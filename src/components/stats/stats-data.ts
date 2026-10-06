/**
 * Pure helpers for the /stats page: tile values, the per-game table rows, award
 * ordering and share-card file names. No React, no stores.
 */
import { type GameSummary } from '@/components/journey/journey-data';
import { t } from '@/lib/i18n';
import { statusOf, type GameProgress, type LearnStatus } from '@/store/progress';
import { type Award, type GameStats } from '@/store/stats';

/** "teen-patti" → "Teen Patti" (fallback name for a slug that left the catalog). */
export function nameFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Whole-number win percentage, or null before the first game. */
export function winRate(wins: number, played: number): number | null {
  if (!Number.isFinite(played) || played <= 0) return null;
  return Math.round((Math.max(0, wins) / played) * 100);
}

/** "3 wins in a row" · "1 loss in a row" · "No streak yet". */
export function streakText(currentStreak: number): string {
  if (currentStreak === 1) return t('stats.tiles.streakWinOne');
  if (currentStreak > 1) return t('stats.tiles.streakWins', { n: currentStreak });
  if (currentStreak === -1) return t('stats.tiles.streakLossOne');
  if (currentStreak < -1) return t('stats.tiles.streakLosses', { n: -currentStreak });
  return t('stats.tiles.streakNone');
}

/** "4 wins" · "1 win" · "—" (none yet). */
export function bestStreakText(bestStreak: number): string {
  if (bestStreak <= 0) return t('stats.tiles.none');
  return bestStreak === 1
    ? t('stats.tiles.bestWinOne')
    : t('stats.tiles.bestWins', { n: bestStreak });
}

export interface GameRow {
  slug: string;
  name: string;
  tier: 1 | 2;
  /** False for slugs no longer in the catalog (shown, but not linked). */
  known: boolean;
  played: number;
  wins: number;
  losses: number;
  pushes: number;
  biggestWin: number;
  status: LearnStatus;
}

/**
 * One row per game the learner has played or opened, in journey order; stats for
 * games that are no longer in the catalog are appended at the end.
 */
export function buildGameRows(
  games: readonly GameSummary[],
  perGame: Readonly<Record<string, GameStats | undefined>>,
  progress: Readonly<Record<string, GameProgress | undefined>>,
): GameRow[] {
  const rows: GameRow[] = [];
  const seen = new Set<string>();
  const push = (slug: string, name: string, tier: 1 | 2, known: boolean) => {
    const s = perGame[slug];
    const status = statusOf(progress[slug], tier);
    if ((s?.played ?? 0) <= 0 && status === 'not-started') return;
    rows.push({
      slug,
      name,
      tier,
      known,
      played: s?.played ?? 0,
      wins: s?.wins ?? 0,
      losses: s?.losses ?? 0,
      pushes: s?.pushes ?? 0,
      biggestWin: s?.biggestWin ?? 0,
      status,
    });
  };
  for (const g of games) {
    seen.add(g.slug);
    push(g.slug, g.name, g.tier, true);
  }
  for (const slug of Object.keys(perGame).sort()) {
    if (!seen.has(slug)) push(slug, nameFromSlug(slug), 2, false);
  }
  return rows;
}

const timeOf = (award: Award) => (Number.isFinite(award.at) ? award.at : 0);

/**
 * Newest first (the store already prepends, but never trust persisted order). Entries
 * without a printable title are dropped rather than shown as blank posters.
 */
export function sortAwards(awards: readonly Award[]): Award[] {
  return awards
    .filter((a) => typeof a.text === 'string' && a.text.trim() !== '')
    .sort((a, b) => timeOf(b) - timeOf(a));
}

const AWARD_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** True when `at` is a timestamp a Date can print. */
export function isValidTime(at: number): boolean {
  return Number.isFinite(at) && !Number.isNaN(new Date(at).getTime());
}

/** "5 Oct 2026" — the date printed on posters and share cards ('' for a broken timestamp). */
export function formatAwardDate(at: number): string {
  return isValidTime(at) ? AWARD_DATE.format(new Date(at)) : '';
}

/** Length of the longest unbreakable run in a title (spaces and hyphens are break points). */
export function longestWord(text: string): number {
  return text.split(/[\s\-‐–—]+/).reduce((max, word) => Math.max(max, [...word].length), 0);
}

/** "game-of-cards-baazigar-of-the-table.png". */
export function shareFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return `game-of-cards-${slug || 'award'}.png`;
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  );
}
