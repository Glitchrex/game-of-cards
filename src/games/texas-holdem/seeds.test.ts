/**
 * The curated seeds deal exactly what their names promise — checked with the real engine,
 * seeded the way the play shell (?seed=<n>, a string, plus `affordableUnits`) and the
 * practice hand (a number, the practice config) do, with the bots on their normal level and
 * their own `bot-<seed>` random stream, exactly like the game controller.
 */
import { createRng } from '@/games/core/rng';
import { type Difficulty, type GameConfig, type GameResult } from '@/games/core/types';
import { texasHoldemEngine as E, type TexasHoldemMove, type TexasHoldemState } from './engine';
import holdemModule from './index';
import { TEXASHOLDEM_SEEDS } from './seeds';

/** What GameShell passes for a 1-Jeet stake from a full wallet (1000 − 100 escrow). */
const PLAY_CONFIG: GameConfig = { ...holdemModule.defaultConfig, affordableUnits: 900 };
const PRACTICE_CONFIG: GameConfig = {
  ...holdemModule.defaultConfig,
  ...holdemModule.practice.config,
};

function dealSeed(seed: number | string, config: GameConfig = PLAY_CONFIG): TexasHoldemState {
  return E.setup(config, createRng(seed));
}

interface Played {
  end: TexasHoldemState;
  result: GameResult;
  /** moveKey()s of the learner's moves, in order. */
  mine: string[];
  moves: number;
}

/** The learner follows the coach; the bots play like the controller drives them. */
function followCoach(
  seed: number | string,
  config: GameConfig = PLAY_CONFIG,
  difficulty: Difficulty = 'normal',
): Played {
  let s = dealSeed(seed, config);
  const bots = createRng(`bot-${String(seed)}`);
  const mine: string[] = [];
  let moves = 0;
  while (!E.isOver(s)) {
    const p = E.currentPlayer(s);
    if (p === null) throw new Error('nobody to act');
    let move: TexasHoldemMove;
    if (p === 0) {
      const pick = E.coach(s, 0).suggestion;
      if (!pick) throw new Error('the coach had no suggestion');
      move = pick as TexasHoldemMove;
      mine.push(E.moveKey(move));
    } else {
      move = E.botMove(s, p, difficulty, bots);
    }
    s = E.applyMove(s, move);
    moves += 1;
    if (moves > 60) throw new Error('hand did not end');
  }
  return { end: s, result: E.result(s), mine, moves };
}

describe('TEXASHOLDEM_SEEDS', () => {
  it('deal the same cards from the URL string, the number, the practice config and any wallet', () => {
    for (const seed of Object.values(TEXASHOLDEM_SEEDS)) {
      const fromNumber = dealSeed(seed);
      expect(dealSeed(String(seed))).toEqual(fromNumber);
      const practice = dealSeed(seed, PRACTICE_CONFIG);
      expect(practice.hands).toEqual(fromNumber.hands);
      expect(practice.button).toBe(fromNumber.button);
      expect(dealSeed(seed, { ...PLAY_CONFIG, affordableUnits: 0 }).stacks).toEqual(
        fromNumber.stacks,
      );
      // The same hand plays out from the string seed the play shell passes.
      expect(followCoach(String(seed)).mine).toEqual(followCoach(seed).mine);
    }
  });

  it('practice: A♠ K♠ raised, bet twice and shoved on the river flush — four decisions, a win', () => {
    expect(holdemModule.practice.seed).toBe(TEXASHOLDEM_SEEDS.practice);
    const s = dealSeed(TEXASHOLDEM_SEEDS.practice, PRACTICE_CONFIG);
    expect(s.players).toBe(4);
    expect(s.hands[0]).toEqual(['AS', 'KS']);
    expect(s.smallBlindSeat).toBe(0);
    expect(E.coach(s, 0).situation).toContain('You hold A♠ K♠');

    const played = followCoach(TEXASHOLDEM_SEEDS.practice, PRACTICE_CONFIG);
    expect(played.mine).toEqual(['raise:6', 'bet:9', 'bet:23', 'all-in']);
    expect(played.moves).toBe(10);
    expect(played.end.board).toEqual(['8S', 'QS', 'KC', '8D', '5S']);
    expect(played.end.outcome?.kind).toBe('showdown');
    expect(played.result).toMatchObject({ humanOutcome: 'win', humanNetUnits: 100 });
    expect(played.result.summary).toBe(
      "At the showdown your Flush, Ace high beat Player 1's Two Pair, Kings and Eights, and you won the 200-chip pot.",
    );
  });

  it('practice also ends in a win against easy bots (if the practice level ever changes)', () => {
    const played = followCoach(TEXASHOLDEM_SEEDS.practice, PRACTICE_CONFIG, 'easy');
    expect(played.mine[0]).toMatch(/^raise:/);
    expect(played.result.humanOutcome).toBe('win');
  });

  it('quickWin: the coach raises and everyone folds', () => {
    const played = followCoach(TEXASHOLDEM_SEEDS.quickWin);
    expect(played.end.hands[0]).toEqual(['AH', 'KH']);
    expect(played.mine).toEqual(['raise:6']);
    expect(played.end.outcome?.kind).toBe('fold');
    expect(played.result).toMatchObject({ humanOutcome: 'win', humanNetUnits: 2 });
    expect(played.result.flags.tags).toContain('bluff-win');
  });

  it('foldPush: folding on the button before putting anything in breaks even', () => {
    const s = dealSeed(TEXASHOLDEM_SEEDS.foldPush);
    expect(s.button).toBe(0);
    const played = followCoach(TEXASHOLDEM_SEEDS.foldPush);
    expect(played.mine).toEqual(['fold']);
    expect(played.result).toMatchObject({ humanOutcome: 'push', humanNetUnits: 0 });
    expect(played.result.flags.folded).toBe(true);
  });

  it('foldLoss: the small blind folds to a raise and loses the blind', () => {
    expect(dealSeed(TEXASHOLDEM_SEEDS.foldLoss).smallBlindSeat).toBe(0);
    const played = followCoach(TEXASHOLDEM_SEEDS.foldLoss);
    expect(played.mine).toEqual(['fold']);
    expect(played.result).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -1 });
  });

  it('showdownLoss: Queens run into Kings all-in — the whole stack is lost', () => {
    const played = followCoach(TEXASHOLDEM_SEEDS.showdownLoss);
    expect(played.end.hands[0]).toEqual(['QC', 'QD']);
    expect(played.end.hands[2]).toEqual(['KS', 'KH']);
    expect(played.mine).toEqual(['raise:17', 'call']);
    expect(played.end.outcome).toMatchObject({ kind: 'showdown', winners: [2] });
    expect(played.result).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -100 });
    expect(played.result.flags.bust).toBe(true);
  });

  it('showdownWin: Queens full of Sixes beat Aces all-in → +108', () => {
    const played = followCoach(TEXASHOLDEM_SEEDS.showdownWin);
    expect(played.end.hands[0]).toEqual(['QS', 'QH']);
    expect(played.mine).toEqual(['raise:16', 'call']);
    expect(played.end.board).toEqual(['6H', '4H', '6D', 'QD', '5H']);
    expect(played.result).toMatchObject({ humanOutcome: 'win', humanNetUnits: 108 });
    expect(played.result.summary).toContain('Full House, Queens full of Sixes');
  });

  it('splitPot: Aces against Aces split the pot — a push', () => {
    const played = followCoach(TEXASHOLDEM_SEEDS.splitPot);
    expect(played.end.hands[0]).toEqual(['AS', 'AD']);
    expect(played.end.hands[3]).toEqual(['AH', 'AC']);
    expect(played.mine).toEqual(['raise:18', 'call']);
    expect(played.end.outcome?.pots[0]?.winners.slice().sort()).toEqual([0, 3]);
    expect(played.result).toMatchObject({ humanOutcome: 'push', humanNetUnits: 0 });
    expect(played.result.flags.tags).toContain('split-pot');
  });
});
