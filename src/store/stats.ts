'use client';
/** Local play statistics and the Awards Shelf. Persisted under "goc:stats". */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Award {
  id: string;
  titleId: string;
  text: string;
  film?: string;
  gameSlug: string;
  jeet: number;
  at: number;
}

export interface GameStats {
  played: number;
  wins: number;
  losses: number;
  pushes: number;
  biggestWin: number;
}

export interface RecordedGame {
  gameSlug: string;
  outcome: 'win' | 'loss' | 'push';
  /** Net Jeet change for this game. */
  net: number;
}

export interface StatsState {
  played: number;
  wins: number;
  losses: number;
  pushes: number;
  biggestWin: number;
  /** Positive = current win streak, negative = current losing streak. */
  currentStreak: number;
  bestStreak: number;
  perGame: Record<string, GameStats>;
  awards: Award[];
  lastTitleId: string | null;
  lastRoastId: string | null;
  /** Record a finished game. Returns the snapshot *before* recording (for title context). */
  recordGame: (g: RecordedGame) => StatsSnapshot;
  addAward: (a: Omit<Award, 'id' | 'at'>) => Award;
  setLastTitle: (id: string) => void;
  setLastRoast: (id: string) => void;
  reset: () => void;
}

export type StatsSnapshot = Pick<
  StatsState,
  'played' | 'wins' | 'losses' | 'pushes' | 'biggestWin' | 'currentStreak' | 'bestStreak'
> & { gameWins: number; gamePlayed: number };

const emptyGame = (): GameStats => ({ played: 0, wins: 0, losses: 0, pushes: 0, biggestWin: 0 });

const initial = {
  played: 0,
  wins: 0,
  losses: 0,
  pushes: 0,
  biggestWin: 0,
  currentStreak: 0,
  bestStreak: 0,
  perGame: {} as Record<string, GameStats>,
  awards: [] as Award[],
  lastTitleId: null as string | null,
  lastRoastId: null as string | null,
};

/** Pure reducer (exported for tests). */
export function applyGame(
  s: typeof initial,
  g: RecordedGame,
): Omit<typeof initial, 'awards' | 'lastTitleId' | 'lastRoastId'> {
  const pg = { ...(s.perGame[g.gameSlug] ?? emptyGame()) };
  pg.played++;
  let { wins, losses, pushes, currentStreak, bestStreak, biggestWin } = s;
  if (g.outcome === 'win') {
    wins++;
    pg.wins++;
    currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
    bestStreak = Math.max(bestStreak, currentStreak);
    biggestWin = Math.max(biggestWin, g.net);
    pg.biggestWin = Math.max(pg.biggestWin, g.net);
  } else if (g.outcome === 'loss') {
    losses++;
    pg.losses++;
    currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
  } else {
    pushes++;
    pg.pushes++;
  }
  return {
    played: s.played + 1,
    wins,
    losses,
    pushes,
    biggestWin,
    currentStreak,
    bestStreak,
    perGame: { ...s.perGame, [g.gameSlug]: pg },
  };
}

export const useStats = create<StatsState>()(
  persist(
    (set, get) => ({
      ...initial,
      recordGame: (g) => {
        const s = get();
        const pg = s.perGame[g.gameSlug] ?? emptyGame();
        const snapshot: StatsSnapshot = {
          played: s.played,
          wins: s.wins,
          losses: s.losses,
          pushes: s.pushes,
          biggestWin: s.biggestWin,
          currentStreak: s.currentStreak,
          bestStreak: s.bestStreak,
          gameWins: pg.wins,
          gamePlayed: pg.played,
        };
        set(applyGame(s, g));
        return snapshot;
      },
      addAward: (a) => {
        const award: Award = {
          ...a,
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          at: Date.now(),
        };
        set((s) => ({ awards: [award, ...s.awards].slice(0, 200) }));
        return award;
      },
      setLastTitle: (id) => set({ lastTitleId: id }),
      setLastRoast: (id) => set({ lastRoastId: id }),
      reset: () => set({ ...initial, perGame: {}, awards: [] }),
    }),
    {
      name: 'goc:stats',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: ({ recordGame: _r, addAward: _a, setLastTitle: _t, setLastRoast: _o, reset: _x, ...rest }) =>
        rest,
    },
  ),
);
