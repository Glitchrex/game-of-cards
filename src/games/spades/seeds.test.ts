/**
 * The curated seeds deal exactly what their names promise — checked with the real engine,
 * seeded the way the play shell (?seed=<n>, a string) and the practice hand (a number) do,
 * with the learner following the coach against normal bots (the bot RNG is seeded the way
 * the controller seeds it, although normal bots never use it).
 */
import { createRng } from '@/games/core/rng';
import { type GameConfig, type GameResult } from '@/games/core/types';
import { spadesEngine as E, type SpadesMove, type SpadesState } from './engine';
import spadesModule from './index';
import { SPADES_SEEDS } from './seeds';

/** What GameShell passes for a 10-Jeet bet from a full wallet. */
const PLAY_CONFIG: GameConfig = { ...spadesModule.defaultConfig, affordableUnits: 99 };

function dealSeed(seed: number | string, config: GameConfig = PLAY_CONFIG): SpadesState {
  return E.setup(config, createRng(seed));
}

interface Run {
  dealt: SpadesState;
  final: SpadesState;
  result: GameResult;
  learnerMoves: SpadesMove[];
  moves: number;
}

/** Play a seed out with the learner following the coach and normal bots, as in practice. */
function followCoach(seed: number): Run {
  const dealt = dealSeed(seed);
  const botRng = createRng(`bot-${seed}`);
  let s = dealt;
  const learnerMoves: SpadesMove[] = [];
  let moves = 0;
  while (!E.isOver(s)) {
    const p = E.currentPlayer(s);
    if (p === null) throw new Error('no player to move');
    let move: SpadesMove;
    if (p === 0) {
      const advice = E.coach(s, 0);
      expect(advice.suggestion).toBeDefined();
      move = advice.suggestion as SpadesMove;
      learnerMoves.push(move);
    } else {
      move = E.botMove(s, p, 'normal', botRng);
    }
    s = E.applyMove(s, move);
    moves += 1;
  }
  return { dealt, final: s, result: E.result(s), learnerMoves, moves };
}

/** Cards the learner played as trumps (a Spade on a trick of another suit). */
function learnerTrumps(final: SpadesState): string[] {
  return final.tricks.flatMap((tr) => {
    const lead = tr.plays[0]?.card[1];
    return tr.plays
      .filter((p) => p.seat === 0 && lead !== 'S' && p.card[1] === 'S')
      .map((p) => p.card);
  });
}

describe('SPADES_SEEDS', () => {
  it('deal the same cards from the URL string, the number and the practice config', () => {
    for (const seed of Object.values(SPADES_SEEDS)) {
      const fromNumber = dealSeed(seed);
      expect(dealSeed(String(seed))).toEqual(fromNumber);
      const practice = dealSeed(seed, {
        ...spadesModule.defaultConfig,
        ...spadesModule.practice.config,
      });
      expect(practice).toEqual(fromNumber);
      expect(fromNumber.phase).toBe('bid');
      expect(fromNumber.hands.every((h) => h.length === 13)).toBe(true);
    }
  });

  it('practice: the learner bids first, trumps once and makes the bid exactly to win 60–43', () => {
    expect(spadesModule.practice.seed).toBe(SPADES_SEEDS.practice);
    const run = followCoach(SPADES_SEEDS.practice);
    expect(run.dealt.dealer).toBe(3);
    expect(E.currentPlayer(run.dealt)).toBe(0);
    expect(E.coach(run.dealt, 0).situation.length).toBeGreaterThan(0);
    expect(run.learnerMoves[0]).toEqual({ type: 'bid', tricks: 3 });
    expect(run.final.bids).toEqual([3, 2, 3, 2]);
    expect(learnerTrumps(run.final)).toHaveLength(1);
    expect(run.learnerMoves).toHaveLength(14);
    expect(run.moves).toBe(56);
    expect(run.result.humanOutcome).toBe('win');
    expect(run.result.humanNetUnits).toBe(1);
    expect(run.result.scores).toEqual([60, 43, 60, 43]);
    expect(run.result.flags.perfect).toBe(true);
    expect(run.result.flags.tags).toContain('exactBid');
    // Spades get broken during the hand, so the indicator changes.
    expect(run.final.spadesBroken).toBe(true);
  });

  it('win: the learner bids first and following the coach wins 72–40', () => {
    const { dealt, result } = followCoach(SPADES_SEEDS.win);
    expect(E.currentPlayer(dealt)).toBe(0);
    expect(result.humanOutcome).toBe('win');
    expect(result.winners).toEqual([0, 2]);
    expect(result.scores?.slice(0, 2)).toEqual([72, 40]);
  });

  it('loss: the team makes its bid exactly but still loses 50–62 (−1)', () => {
    const { dealt, result } = followCoach(SPADES_SEEDS.loss);
    expect(E.currentPlayer(dealt)).toBe(0);
    expect(result.humanOutcome).toBe('loss');
    expect(result.humanNetUnits).toBe(-1);
    expect(result.scores?.slice(0, 2)).toEqual([50, 62]);
    expect(result.flags.tags).toContain('exactBid');
  });

  it('botsBidFirst: the opponents open the bidding and win 80–41', () => {
    const { dealt, result } = followCoach(SPADES_SEEDS.botsBidFirst);
    expect(E.currentPlayer(dealt)).not.toBe(0);
    expect(result.humanOutcome).toBe('loss');
    expect(result.scores?.slice(0, 2)).toEqual([41, 80]);
  });

  it('nilWin: the coach bids Nil for the learner, it holds, and the team wins 161–60', () => {
    const { learnerMoves, final, result } = followCoach(SPADES_SEEDS.nilWin);
    expect(learnerMoves[0]).toEqual({ type: 'bid', tricks: 0 });
    expect(final.tricksWon[0]).toBe(0);
    expect(result.humanOutcome).toBe('win');
    expect(result.scores?.slice(0, 2)).toEqual([161, 60]);
    expect(result.flags.tags).toContain('nil');
    expect(result.flags.bigPot).toBe(true);
  });

  it('opponentNil: an opponent makes a Nil and the learner’s team loses 72–140', () => {
    const { final, result } = followCoach(SPADES_SEEDS.opponentNil);
    expect([final.bids[1], final.bids[3]]).toContain(0);
    expect(result.humanOutcome).toBe('loss');
    expect(result.scores?.slice(0, 2)).toEqual([72, 140]);
    expect(result.flags.tags).toContain('opponentNil');
  });

  it('set: the learner’s team falls short (−80) and loses', () => {
    const { result } = followCoach(SPADES_SEEDS.set);
    expect(result.humanOutcome).toBe('loss');
    expect(result.scores?.slice(0, 2)).toEqual([-80, 52]);
    expect(result.flags.tags).toContain('set');
    expect(result.flags.bust).toBe(true);
  });

  it('setOpponents: the opponents are set (−60) and the learner’s team wins with 71', () => {
    const { result } = followCoach(SPADES_SEEDS.setOpponents);
    expect(result.humanOutcome).toBe('win');
    expect(result.scores?.slice(0, 2)).toEqual([71, -60]);
    expect(result.flags.tags).toContain('setOpponents');
  });

  it('every curated hand plays out in 56 moves (applyMove checks each coached move is legal)', () => {
    for (const seed of Object.values(SPADES_SEEDS)) {
      const run = followCoach(seed);
      expect(run.learnerMoves).toHaveLength(14);
      expect(run.moves).toBe(56);
    }
  });
});
