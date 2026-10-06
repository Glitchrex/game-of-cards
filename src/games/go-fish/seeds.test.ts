/**
 * Every curated seed does what seeds.ts says — on the real engine, set up exactly the way
 * GameShell (`createRng(String(seed))`) and PracticeHand (`createRng(seed)`) do, with the
 * learner following the coach and normal bots.
 */
import { createRng } from '@/games/core/rng';
import { type GameResult } from '@/games/core/types';
import { goFishEngine as E, type GoFishEvent, type GoFishMove, type GoFishState } from './engine';
import goFishModule from './index';
import { GOFISH_SEEDS } from './seeds';

interface Played {
  final: GoFishState;
  result: GameResult;
  /** The learner's asks, in order, with the events each one caused. */
  asks: { move: GoFishMove; events: GoFishEvent[]; why: string }[];
  moves: number;
}

function followCoach(seed: number | string): Played {
  const config = { ...goFishModule.defaultConfig, ...goFishModule.practice.config };
  let s = E.setup(config, createRng(seed));
  const botRng = createRng(`bot-${String(seed)}`);
  const asks: Played['asks'] = [];
  let moves = 0;
  while (!E.isOver(s)) {
    const seat = E.currentPlayer(s) ?? 0;
    const before = s.log.length;
    if (seat === 0) {
      const advice = E.coach(s, 0);
      const move = advice.suggestion as GoFishMove;
      s = E.applyMove(s, move);
      asks.push({ move, events: s.log.slice(before), why: advice.why ?? '' });
    } else {
      s = E.applyMove(s, E.botMove(s, seat, 'normal', botRng));
    }
    moves += 1;
    expect(moves).toBeLessThan(200);
  }
  return { final: s, result: E.result(s), asks, moves };
}

const firstEvent = (a: Played['asks'][number]) => a.events[0];

describe('GOFISH_SEEDS', () => {
  it('a number and its decimal string deal the same game (play mode vs practice)', () => {
    for (const seed of Object.values(GOFISH_SEEDS)) {
      const config = goFishModule.defaultConfig;
      expect(E.setup(config, createRng(String(seed)))).toEqual(E.setup(config, createRng(seed)));
    }
  });

  it('practice: a catch, then Go Fish, a known holder, a fished wish and a close 5–4–4 win', () => {
    const p = followCoach(GOFISH_SEEDS.practice);
    const [first, second] = p.asks;
    const got = (a: Played['asks'][number] | undefined) => {
      const e = a ? firstEvent(a) : undefined;
      return e?.type === 'ask' ? e.got : -1;
    };
    expect(got(first)).toBeGreaterThan(0);
    expect(got(second)).toBe(0);
    // Later the coach asks a player who is KNOWN to hold the rank (they asked for it).
    expect(p.asks.some((a) => /asked for .* earlier/.test(a.why))).toBe(true);
    expect(p.final.log.some((e) => e.type === 'fish' && e.seat === 0 && e.wish)).toBe(true);
    expect(p.result).toMatchObject({ humanOutcome: 'win', humanNetUnits: 2, scores: [5, 4, 4] });
    expect(p.result.flags.closeFinish).toBe(true);
    expect(p.asks).toHaveLength(16);
    expect(p.moves).toBeLessThanOrEqual(60);
  });

  it('soleWin: a comeback from 3 books behind to a 7–2–4 win (+2 stakes)', () => {
    const p = followCoach(GOFISH_SEEDS.soleWin);
    expect(p.result).toMatchObject({ humanOutcome: 'win', humanNetUnits: 2, scores: [7, 2, 4] });
    expect(p.result.flags).toMatchObject({ comeback: true, perfect: true });
  });

  it('sharedWin: a 5–3–5 tie for the most books shares the pot (+½ stake)', () => {
    const p = followCoach(GOFISH_SEEDS.sharedWin);
    expect(p.result).toMatchObject({
      humanOutcome: 'win',
      humanNetUnits: 0.5,
      scores: [5, 3, 5],
      winners: [0, 2],
    });
    expect(p.result.flags.tags).toContain('sharedWin');
  });

  it('loss: no books at all (0–4–9) in 10 asks', () => {
    const p = followCoach(GOFISH_SEEDS.loss);
    expect(p.result).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -1, scores: [0, 4, 9] });
    expect(p.result.flags.tags).toContain('noBooks');
    expect(p.asks).toHaveLength(10);
  });
});
