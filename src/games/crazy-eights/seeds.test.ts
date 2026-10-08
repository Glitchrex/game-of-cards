/**
 * The curated seeds deal exactly what their names promise — checked with the real engine,
 * seeded the way the play shell (?seed=<n>, a string) and the practice hand (a number) do,
 * with bots drawing their randomness from `createRng('bot-<seed>')` like the controller.
 */
import { createRng } from '@/games/core/rng';
import { type Difficulty, type GameConfig } from '@/games/core/types';
import {
  crazyEightsEngine as E,
  isEight,
  type CrazyEightsMove,
  type CrazyEightsState,
} from './engine';
import crazyEightsModule from './index';
import { CRAZY_EIGHTS_SEEDS } from './seeds';

/** What GameShell passes for a 10-Jeet bet from a full wallet. */
const PLAY_CONFIG: GameConfig = { ...crazyEightsModule.defaultConfig, affordableUnits: 99 };

function dealSeed(seed: number | string, config: GameConfig = PLAY_CONFIG): CrazyEightsState {
  return E.setup(config, createRng(seed));
}

interface Played {
  final: CrazyEightsState;
  /** The learner's moves, in order. */
  mine: CrazyEightsMove[];
  moves: number;
}

/** Follow the coach on every learner turn against `difficulty` bots, to the end. */
function followCoach(seed: number, difficulty: Difficulty = 'normal'): Played {
  let s = dealSeed(seed);
  const bots = createRng(`bot-${String(seed)}`);
  const mine: CrazyEightsMove[] = [];
  let moves = 0;
  while (!E.isOver(s)) {
    const p = E.currentPlayer(s)!;
    const move =
      p === 0 ? (E.coach(s, 0).suggestion as CrazyEightsMove) : E.botMove(s, p, difficulty, bots);
    if (p === 0) mine.push(move);
    s = E.applyMove(s, move);
    moves++;
    if (moves > 500) throw new Error('runaway game');
  }
  return { final: s, mine, moves };
}

describe('CRAZY_EIGHTS_SEEDS', () => {
  it('deal the same cards from the URL string, the number, the practice config and any wallet', () => {
    for (const seed of Object.values(CRAZY_EIGHTS_SEEDS)) {
      const fromNumber = dealSeed(seed);
      expect(dealSeed(String(seed))).toEqual(fromNumber);
      expect(
        dealSeed(seed, {
          ...crazyEightsModule.defaultConfig,
          ...crazyEightsModule.practice.config,
        }),
      ).toEqual(fromNumber);
      expect(dealSeed(seed, { ...PLAY_CONFIG, affordableUnits: 0 })).toEqual(fromNumber);
    }
  });

  it('practice: a suit match, a rank switch or a wild Eight — the coach wins in 5 plays', () => {
    expect(crazyEightsModule.practice.seed).toBe(CRAZY_EIGHTS_SEEDS.practice);
    const s = dealSeed(CRAZY_EIGHTS_SEEDS.practice);
    expect(s.players).toBe(3);
    expect(s.hands[0]).toEqual(['2S', 'KS', '8H', '7C', 'QD']);
    expect(s.discard).toEqual(['KD']);
    const keys = E.legalMoves(s, 0).map((m) => E.moveKey(m));
    expect(keys).toEqual(
      expect.arrayContaining(['play:KS', 'play:QD', 'play:8H:S', 'play:8H:C', 'draw']),
    );
    expect(E.coach(s, 0).suggestion).toEqual({ type: 'play', card: 'KS' });

    const { final, mine, moves } = followCoach(CRAZY_EIGHTS_SEEDS.practice);
    expect(mine.map((m) => E.moveKey(m))).toEqual([
      'play:KS',
      'play:QD',
      'play:8H:C',
      'play:7C',
      'play:2S',
    ]);
    expect(moves).toBe(22);
    const result = E.result(final);
    expect(result).toMatchObject({ humanOutcome: 'win', humanNetUnits: 2 });
    expect(result.flags.perfect).toBe(true);
    // The bots draw and play an Eight along the way, so the learner sees both happen.
    expect(final.log.some((e) => e.seat !== 0 && e.type === 'draw')).toBe(true);
    expect(final.log.some((e) => e.seat !== 0 && e.type === 'play' && isEight(e.card))).toBe(true);
    // It is a win against easy bots too.
    expect(E.result(followCoach(CRAZY_EIGHTS_SEEDS.practice, 'easy').final).humanOutcome).toBe(
      'win',
    );
  });

  it('quickWin: following the coach goes out in 5 plays', () => {
    const { final, mine, moves } = followCoach(CRAZY_EIGHTS_SEEDS.quickWin);
    expect(mine).toHaveLength(5);
    expect(mine.every((m) => m.type === 'play')).toBe(true);
    expect(moves).toBe(13);
    expect(E.result(final)).toMatchObject({ humanOutcome: 'win', humanNetUnits: 2 });
  });

  it('quickLoss: following the coach, a bot still goes out first', () => {
    const { final, mine, moves } = followCoach(CRAZY_EIGHTS_SEEDS.quickLoss);
    expect(moves).toBe(15);
    expect(mine).toHaveLength(6);
    expect(final.endReason).toBe('out');
    expect(E.result(final)).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -1 });
  });

  it('eightFirst: the coach’s first suggestion is a wild Eight', () => {
    const move = E.coach(dealSeed(CRAZY_EIGHTS_SEEDS.eightFirst), 0).suggestion as CrazyEightsMove;
    expect(move.type).toBe('play');
    expect(move.type === 'play' && isEight(move.card) && move.suit !== undefined).toBe(true);
  });

  it('mustDraw: nothing in the opening hand fits, so drawing is the only move', () => {
    const s = dealSeed(CRAZY_EIGHTS_SEEDS.mustDraw);
    expect(E.legalMoves(s, 0)).toEqual([{ type: 'draw' }]);
  });

  it('eightFinish: following the coach goes out with an Eight', () => {
    const { final } = followCoach(CRAZY_EIGHTS_SEEDS.eightFinish);
    const result = E.result(final);
    expect(result.humanOutcome).toBe('win');
    expect(result.flags.luckyLastCard).toBe(true);
    const last = final.log[final.log.length - 1];
    expect(last?.type === 'play' && isEight(last.card)).toBe(true);
  });

  it('blocked: following the coach, the stock runs out and nobody can play', () => {
    const { final } = followCoach(CRAZY_EIGHTS_SEEDS.blocked);
    expect(final.endReason).toBe('blocked');
    expect(final.stock).toHaveLength(0);
    expect(E.result(final).flags.tags).toContain('blocked');
  });
});
