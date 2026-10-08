import { emptyProgress } from '@/store/progress';
import { type Award } from '@/store/stats';
import {
  bestStreakText,
  buildGameRows,
  formatAwardDate,
  longestWord,
  nameFromSlug,
  shareFileName,
  sortAwards,
  streakText,
  winRate,
} from './stats-data';

describe('stat tile helpers', () => {
  it('computes a whole-number win rate (none before the first game)', () => {
    expect(winRate(0, 0)).toBeNull();
    expect(winRate(4, 7)).toBe(57);
    expect(winRate(3, 3)).toBe(100);
  });

  it('describes the current streak in words', () => {
    expect(streakText(3)).toBe('3 wins in a row');
    expect(streakText(1)).toBe('1 win in a row');
    expect(streakText(-2)).toBe('2 losses in a row');
    expect(streakText(-1)).toBe('1 loss in a row');
    expect(streakText(0)).toBe('No streak yet');
  });

  it('describes the best streak', () => {
    expect(bestStreakText(0)).toBe('—');
    expect(bestStreakText(1)).toBe('1 win');
    expect(bestStreakText(6)).toBe('6 wins');
  });
});

describe('buildGameRows', () => {
  const games = [
    { slug: 'war', name: 'War', tier: 1 as const },
    { slug: 'hearts', name: 'Hearts', tier: 1 as const },
    { slug: 'bridge', name: 'Bridge', tier: 2 as const },
  ];

  it('lists played or opened games in journey order, then retired slugs', () => {
    const rows = buildGameRows(
      games,
      {
        hearts: { played: 3, wins: 2, losses: 1, pushes: 0, biggestWin: 240 },
        'old-game': { played: 1, wins: 0, losses: 1, pushes: 0, biggestWin: 0 },
      },
      {
        bridge: { ...emptyProgress(), started: true },
        hearts: { ...emptyProgress(), lessonDone: true, exampleDone: true, quizBest: 3, wins: 2 },
      },
    );
    expect(rows.map((r) => r.slug)).toEqual(['hearts', 'bridge', 'old-game']);
    expect(rows[0]).toMatchObject({ name: 'Hearts', played: 3, wins: 2, status: 'learned' });
    expect(rows[1]).toMatchObject({ name: 'Bridge', played: 0, status: 'learning', known: true });
    expect(rows[2]).toMatchObject({ name: 'Old Game', known: false, losses: 1 });
  });

  it('is empty for a brand-new learner', () => {
    expect(buildGameRows(games, {}, {})).toEqual([]);
  });
});

describe('awards helpers', () => {
  const award = (id: string, at: number): Award => ({
    id,
    at,
    titleId: id,
    text: id,
    gameSlug: 'war',
    jeet: 10,
  });

  it('sorts newest first without mutating the store array', () => {
    const list = [award('a', 1), award('c', 3), award('b', 2)];
    expect(sortAwards(list).map((a) => a.id)).toEqual(['c', 'b', 'a']);
    expect(list.map((a) => a.id)).toEqual(['a', 'c', 'b']);
  });

  it('drops awards without a title and sorts broken timestamps last', () => {
    const list = [
      award('a', 1),
      { ...award('blank', 5), text: '  ' },
      award('nan', NaN),
      award('b', 2),
    ];
    expect(sortAwards(list).map((a) => a.id)).toEqual(['b', 'a', 'nan']);
  });

  it('never throws on a broken timestamp', () => {
    expect(formatAwardDate(NaN)).toBe('');
    expect(formatAwardDate(8.64e15 + 1)).toBe('');
  });

  it('measures the longest unbreakable word of a title', () => {
    expect(longestWord('Unbreakable')).toBe(11);
    expect(longestWord('Baazigar of the Table')).toBe(8);
    expect(longestWord('Rajinikanth-level Reflexes')).toBe(11);
    expect(longestWord('Tiến Lên Thalaivar')).toBe(9);
    expect(longestWord('')).toBe(0);
  });

  it('formats poster dates and file names', () => {
    expect(formatAwardDate(Date.UTC(2026, 9, 5, 12))).toBe('5 Oct 2026');
    expect(shareFileName('Baazigar of the Table!')).toBe('game-of-cards-baazigar-of-the-table.png');
    expect(shareFileName('Tiến Lên Thalaivar')).toBe('game-of-cards-tien-len-thalaivar.png');
    expect(shareFileName('★★★')).toBe('game-of-cards-award.png');
    expect(nameFromSlug('teen-patti')).toBe('Teen Patti');
  });
});
