/**
 * The curated seeds deal exactly what their names promise — checked with the real engine,
 * seeded the way the play shell (?seed=<n>, a string) and the practice hand (a number) do,
 * with the learner following the coach against normal bots (the bot RNG is seeded the way
 * the controller seeds it, although normal bots never use it).
 */
import { createRng } from '@/games/core/rng';
import { type GameConfig, type GameResult } from '@/games/core/types';
import { heartsEngine as E, type HeartsMove, type HeartsState } from './engine';
import heartsModule from './index';
import { HEARTS_SEEDS } from './seeds';

/** What GameShell passes for a 10-Jeet bet from a full wallet. */
const PLAY_CONFIG: GameConfig = { ...heartsModule.defaultConfig, affordableUnits: 99 };

function dealSeed(seed: number | string, config: GameConfig = PLAY_CONFIG): HeartsState {
  return E.setup(config, createRng(seed));
}

interface Run {
  dealt: HeartsState;
  final: HeartsState;
  result: GameResult;
  learnerMoves: HeartsMove[];
  moves: number;
}

/** Play a seed out with the learner following the coach and normal bots, as in practice. */
function followCoach(seed: number): Run {
  const dealt = dealSeed(seed);
  const botRng = createRng(`bot-${seed}`);
  let s = dealt;
  const learnerMoves: HeartsMove[] = [];
  let moves = 0;
  while (!E.isOver(s)) {
    const p = E.currentPlayer(s);
    if (p === null) throw new Error('no player to move');
    let move: HeartsMove;
    if (p === 0) {
      const advice = E.coach(s, 0);
      expect(advice.suggestion).toBeDefined();
      move = advice.suggestion as HeartsMove;
      learnerMoves.push(move);
    } else {
      move = E.botMove(s, p, 'normal', botRng);
    }
    s = E.applyMove(s, move);
    moves += 1;
  }
  return { dealt, final: s, result: E.result(s), learnerMoves, moves };
}

describe('HEARTS_SEEDS', () => {
  it('deal the same cards from the URL string, the number and the practice config', () => {
    for (const seed of Object.values(HEARTS_SEEDS)) {
      const fromNumber = dealSeed(seed);
      expect(dealSeed(String(seed))).toEqual(fromNumber);
      const practice = dealSeed(seed, {
        ...heartsModule.defaultConfig,
        ...heartsModule.practice.config,
      });
      expect(practice).toEqual(fromNumber);
      // Every curated deal starts with passing to the left, the learner first.
      expect(fromNumber.phase).toBe('pass');
      expect(fromNumber.passDirection).toBe('left');
      expect(E.currentPlayer(fromNumber)).toBe(0);
    }
  });

  it('practice: Q♠ A♠ A♥ are dealt and passed, then a clean 0-point win in 14 learner moves', () => {
    expect(heartsModule.practice.seed).toBe(HEARTS_SEEDS.practice);
    const run = followCoach(HEARTS_SEEDS.practice);
    expect(run.dealt.hands[0]).toEqual(expect.arrayContaining(['QS', 'AS', 'AH']));
    expect(run.learnerMoves[0]).toEqual({ type: 'pass', cards: ['QS', 'AS', 'AH'] });
    expect(E.coach(run.dealt, 0).situation.length).toBeGreaterThan(0);
    expect(run.learnerMoves).toHaveLength(14);
    expect(run.moves).toBe(56);
    expect(run.result.humanOutcome).toBe('win');
    expect(run.result.humanNetUnits).toBe(3);
    expect(run.result.scores?.[0]).toBe(0);
    expect(run.result.flags.tags).toContain('cleanHand');
    // The hand shows being void: the learner discards Hearts on other suits' tricks.
    const discards = run.final.tricks.flatMap((tr) => {
      const lead = tr.plays[0]?.card[1];
      return tr.plays.filter((p) => p.seat === 0 && p.card[1] !== lead).map((p) => p.card);
    });
    expect(discards.some((c) => c.endsWith('H'))).toBe(true);
  });

  it('soleWin: following the coach is a sole win (+3)', () => {
    const { result } = followCoach(HEARTS_SEEDS.soleWin);
    expect(result.humanOutcome).toBe('win');
    expect(result.winners).toEqual([0]);
    expect(result.humanNetUnits).toBe(3);
    expect(result.flags.bigPot).toBe(true);
  });

  it('sharedWin: a tie with Usherette Tilly (seat 3) shares the pot (+1)', () => {
    const { result } = followCoach(HEARTS_SEEDS.sharedWin);
    expect(result.winners).toEqual([0, 3]);
    expect(result.humanNetUnits).toBe(1);
    expect(result.flags.tags).toContain('sharedWin');
  });

  it('leadTwoOfClubs: the learner holds the 2♣ after the exchange and must lead it', () => {
    let s = dealSeed(HEARTS_SEEDS.leadTwoOfClubs);
    const botRng = createRng(`bot-${HEARTS_SEEDS.leadTwoOfClubs}`);
    while (s.phase === 'pass') {
      const p = E.currentPlayer(s) ?? 0;
      s = E.applyMove(
        s,
        p === 0 ? (E.coach(s, 0).suggestion as HeartsMove) : E.botMove(s, p, 'normal', botRng),
      );
    }
    expect(E.currentPlayer(s)).toBe(0);
    expect(E.legalMoves(s, 0)).toEqual([{ type: 'play', card: '2C' }]);
    const { result } = followCoach(HEARTS_SEEDS.leadTwoOfClubs);
    expect(result.humanOutcome).toBe('win');
    expect(result.humanNetUnits).toBe(1);
  });

  it('loss: following the coach still loses by one point (−1)', () => {
    const { result } = followCoach(HEARTS_SEEDS.loss);
    expect(result.humanOutcome).toBe('loss');
    expect(result.humanNetUnits).toBe(-1);
    expect(result.scores).toEqual([1, 0, 7, 18]);
  });

  it('queenLoss: the Q♠ arrives in the pass and lands in the learner’s tricks (19 points)', () => {
    const { result, final } = followCoach(HEARTS_SEEDS.queenLoss);
    expect(final.received[0]).toContain('QS');
    expect(final.won[0]).toContain('QS');
    expect(result.humanOutcome).toBe('loss');
    expect(result.scores?.[0]).toBe(19);
    expect(result.flags.tags).toContain('queenOfSpades');
  });

  it('moonShot: the learner takes all 26 points and scores 0', () => {
    const { result } = followCoach(HEARTS_SEEDS.moonShot);
    expect(result.scores).toEqual([0, 26, 26, 26]);
    expect(result.humanNetUnits).toBe(3);
    expect(result.flags.tags).toContain('shootTheMoon');
  });

  it('opponentMoon: Auntie Bubbles (seat 1) shoots the moon and the learner loses with 26', () => {
    const { result, final } = followCoach(HEARTS_SEEDS.opponentMoon);
    expect(final.points[1]).toBe(26);
    expect(result.scores).toEqual([26, 0, 26, 26]);
    expect(result.humanOutcome).toBe('loss');
    expect(result.flags.tags).toContain('opponentShotMoon');
  });

  it('every curated hand plays out in 56 moves (applyMove checks each coached move is legal)', () => {
    for (const seed of Object.values(HEARTS_SEEDS)) {
      const run = followCoach(seed);
      expect(run.learnerMoves).toHaveLength(14);
      expect(run.moves).toBe(56);
    }
  });
});
