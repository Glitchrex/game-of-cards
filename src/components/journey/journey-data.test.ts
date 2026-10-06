import { emptyProgress, type GameProgress } from '@/store/progress';
import { nextStepFor, summarizeJourney, type GameSummary } from './journey-data';

const GAMES: GameSummary[] = [
  { slug: 'war', name: 'War', tier: 1 },
  { slug: 'go-fish', name: 'Go Fish', tier: 1 },
  { slug: 'old-maid', name: 'Old Maid', tier: 2 },
  { slug: 'bridge', name: 'Bridge', tier: 2 },
];

const p = (over: Partial<GameProgress>): GameProgress => ({ ...emptyProgress(), ...over });
const LEARNED = { started: true, lessonDone: true, exampleDone: true, quizBest: 4 };

describe('summarizeJourney', () => {
  it('counts learned (including mastered), mastered and in-progress games', () => {
    const s = summarizeJourney(GAMES, {
      war: p({ ...LEARNED, quizBest: 5, wins: 2 }),
      'go-fish': p({ ...LEARNED }),
      'old-maid': p({ started: true }),
    });
    expect(s.statuses).toEqual(['mastered', 'learned', 'learning', 'not-started']);
    expect(s).toMatchObject({ total: 4, learned: 2, mastered: 1, inProgress: 1, nextIndex: 1 });
  });

  it('suggests the first game that is not mastered, and -1 when all are', () => {
    expect(summarizeJourney(GAMES, {}).nextIndex).toBe(0);
    const all = Object.fromEntries(
      GAMES.map((g) => [g.slug, p({ ...LEARNED, quizBest: 5, wins: 1 })]),
    );
    const s = summarizeJourney(GAMES, all);
    expect(s.mastered).toBe(4);
    expect(s.nextIndex).toBe(-1);
  });

  it('needs a win to master a Tier 1 game but not a Tier 2 one', () => {
    const s = summarizeJourney(GAMES, {
      war: p({ ...LEARNED, quizBest: 5 }),
      'old-maid': p({ ...LEARNED, quizBest: 5 }),
    });
    expect(s.statuses[0]).toBe('learned');
    expect(s.statuses[2]).toBe('mastered');
  });
});

describe('nextStepFor', () => {
  it('walks lesson → example → quiz → perfect quiz → a win', () => {
    expect(nextStepFor('war', 1, undefined)).toEqual({ id: 'learn', href: '/games/war/learn' });
    expect(nextStepFor('war', 1, p({ lessonDone: true }))).toEqual({
      id: 'try',
      href: '/games/war/try',
    });
    expect(nextStepFor('war', 1, p({ lessonDone: true, exampleDone: true, quizBest: 2 }))).toEqual({
      id: 'quiz',
      href: '/games/war/quiz',
    });
    expect(nextStepFor('war', 1, p({ ...LEARNED }))).toEqual({
      id: 'quizAgain',
      href: '/games/war/quiz',
    });
    expect(nextStepFor('war', 1, p({ ...LEARNED, quizBest: 5 }))).toEqual({
      id: 'play',
      href: '/games/war/play',
    });
  });

  it('never sends a Tier 2 game to a play page', () => {
    expect(nextStepFor('bridge', 2, p({ ...LEARNED, quizBest: 5 })).href).not.toContain('/play');
  });
});
