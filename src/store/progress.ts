'use client';
/** Per-game learning progress. Persisted under "goc:progress". */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type LearnStatus = 'not-started' | 'learning' | 'learned' | 'mastered';

export interface GameProgress {
  lessonDone: boolean;
  exampleDone: boolean;
  /** Best quiz score out of 5, or null if never taken. */
  quizBest: number | null;
  wins: number;
  /** True once the learner opened the lesson or example. */
  started: boolean;
}

export const emptyProgress = (): GameProgress => ({
  lessonDone: false,
  exampleDone: false,
  quizBest: null,
  wins: 0,
  started: false,
});

/**
 * not-started → learning (opened anything: lesson, example, quiz or a won game)
 * → learned (lesson + example + quiz ≥ 3)
 * → mastered (learned + quiz 5/5 + at least one win; Tier 2: learned + quiz 5/5).
 */
export function statusOf(p: GameProgress | undefined, tier: 1 | 2): LearnStatus {
  if (!p) return 'not-started';
  const learned = p.lessonDone && p.exampleDone && (p.quizBest ?? 0) >= 3;
  if (learned && p.quizBest === 5 && (tier === 2 || p.wins > 0)) return 'mastered';
  if (learned) return 'learned';
  if (p.started || p.lessonDone || p.exampleDone || p.quizBest !== null || p.wins > 0) {
    return 'learning';
  }
  return 'not-started';
}

export interface ProgressState {
  games: Record<string, GameProgress>;
  markStarted: (slug: string) => void;
  markLessonDone: (slug: string) => void;
  markExampleDone: (slug: string) => void;
  recordQuiz: (slug: string, score: number) => void;
  recordWin: (slug: string) => void;
  reset: () => void;
}

const update = (
  games: Record<string, GameProgress>,
  slug: string,
  fn: (p: GameProgress) => GameProgress,
) => ({ games: { ...games, [slug]: fn(games[slug] ?? emptyProgress()) } });

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      games: {},
      markStarted: (slug) => set((s) => update(s.games, slug, (p) => ({ ...p, started: true }))),
      markLessonDone: (slug) =>
        set((s) => update(s.games, slug, (p) => ({ ...p, started: true, lessonDone: true }))),
      markExampleDone: (slug) =>
        set((s) => update(s.games, slug, (p) => ({ ...p, started: true, exampleDone: true }))),
      recordQuiz: (slug, score) =>
        set((s) =>
          update(s.games, slug, (p) => ({
            ...p,
            started: true,
            quizBest: Math.max(p.quizBest ?? 0, score),
          })),
        ),
      recordWin: (slug) => set((s) => update(s.games, slug, (p) => ({ ...p, wins: p.wins + 1 }))),
      reset: () => set({ games: {} }),
    }),
    {
      name: 'goc:progress',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ games: s.games }),
    },
  ),
);
