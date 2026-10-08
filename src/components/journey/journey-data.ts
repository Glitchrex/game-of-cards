/**
 * Pure helpers for the learning journey (and the stats page's per-game table):
 * the serialisable game summary passed from server pages, journey counters and
 * the "Next up" suggestion.
 */
import { statusOf, type GameProgress, type LearnStatus } from '@/store/progress';

/** The minimum a client view needs to know about a game (built on the server). */
export interface GameSummary {
  slug: string;
  name: string;
  tier: 1 | 2;
}

export const LEARN_STATUSES: readonly LearnStatus[] = [
  'not-started',
  'learning',
  'learned',
  'mastered',
];

/** True for learned and mastered (mastering a game implies having learned it). */
export const isLearned = (s: LearnStatus) => s === 'learned' || s === 'mastered';

export interface JourneySummary {
  statuses: LearnStatus[];
  total: number;
  /** Learned or mastered. */
  learned: number;
  mastered: number;
  /** Opened but not yet learned. */
  inProgress: number;
  /** Index of the first game (in journey order) that is not mastered, or -1. */
  nextIndex: number;
}

export function summarizeJourney(
  games: readonly GameSummary[],
  progress: Readonly<Record<string, GameProgress | undefined>>,
): JourneySummary {
  const statuses = games.map((g) => statusOf(progress[g.slug], g.tier));
  return {
    statuses,
    total: games.length,
    learned: statuses.filter(isLearned).length,
    mastered: statuses.filter((s) => s === 'mastered').length,
    inProgress: statuses.filter((s) => s === 'learning').length,
    nextIndex: statuses.findIndex((s) => s !== 'mastered'),
  };
}

export type NextStepId = 'learn' | 'try' | 'quiz' | 'quizAgain' | 'play';

export interface NextStep {
  id: NextStepId;
  href: string;
}

/**
 * The single most useful thing to do next for a game that is not mastered yet:
 * lesson → example hand → quiz (≥ 3) → perfect quiz → a win vs the bots (Tier 1).
 */
export function nextStepFor(slug: string, tier: 1 | 2, p: GameProgress | undefined): NextStep {
  const hub = `/games/${slug}`;
  if (!p?.lessonDone) return { id: 'learn', href: `${hub}/learn` };
  if (!p.exampleDone) return { id: 'try', href: `${hub}/try` };
  if ((p.quizBest ?? 0) < 3) return { id: 'quiz', href: `${hub}/quiz` };
  if (p.quizBest !== 5) return { id: 'quizAgain', href: `${hub}/quiz` };
  if (tier === 1 && p.wins === 0) return { id: 'play', href: `${hub}/play` };
  return { id: 'learn', href: `${hub}/learn` };
}
