/**
 * The curated seeds deal exactly what their names promise — checked with the real engine,
 * configured and seeded the way the practice hand (a number, `{ ...defaultConfig,
 * ...practice.config }`) and the play shell (`?seed=<n>`, a string, `defaultConfig`) do, with
 * the bot seeded like the controller seeds it.
 */
import { createRng } from '@/games/core/rng';
import { type GameConfig } from '@/games/core/types';
import {
  bestArrangement,
  indianRummyEngine as E,
  isJokerFor,
  type IndianRummyMove,
  type IndianRummyState,
} from './engine';
import indianRummyModule from './index';
import { INDIAN_RUMMY_SEEDS } from './seeds';

const PRACTICE_CONFIG: GameConfig = {
  ...indianRummyModule.defaultConfig,
  ...indianRummyModule.practice.config,
};
/** What GameShell passes for a 1-Jeet bet from a full wallet. */
const PLAY_CONFIG: GameConfig = { ...indianRummyModule.defaultConfig, affordableUnits: 919 };

interface Played {
  start: IndianRummyState;
  end: IndianRummyState;
  learner: IndianRummyMove[];
  log: string[];
}

/** The learner follows the coach on every turn; the normal bot plays as in the browser. */
function followTheCoach(seed: number | string, config: GameConfig): Played {
  const start = E.setup(config, createRng(seed));
  const botRng = createRng(`bot-${String(seed)}`);
  let s = start;
  const learner: IndianRummyMove[] = [];
  const log: string[] = [];
  for (let guard = 0; !E.isOver(s) && guard < 500; guard++) {
    const p = E.currentPlayer(s)!;
    const move =
      p === 0 ? (E.coach(s, 0).suggestion as IndianRummyMove) : E.botMove(s, p, 'normal', botRng);
    if (p === 0) learner.push(move);
    log.push(E.describeMove(s, p, move));
    s = E.applyMove(s, move);
  }
  return { start, end: s, learner, log };
}

describe('INDIAN_RUMMY_SEEDS', () => {
  it('deal the same cards from the URL string and the number', () => {
    for (const seed of Object.values(INDIAN_RUMMY_SEEDS)) {
      expect(E.setup(PLAY_CONFIG, createRng(String(seed)))).toEqual(
        E.setup(PLAY_CONFIG, createRng(seed)),
      );
      expect(E.setup(PRACTICE_CONFIG, createRng(String(seed)))).toEqual(
        E.setup(PRACTICE_CONFIG, createRng(seed)),
      );
    }
  });

  it('the practice config makes the bot deal, so the learner always plays first', () => {
    expect(indianRummyModule.practice.seed).toBe(INDIAN_RUMMY_SEEDS.practice);
    for (let k = 0; k < 5; k++) {
      // "Try another practice hand" uses seed + 1, seed + 2, …
      const s = E.setup(PRACTICE_CONFIG, createRng(INDIAN_RUMMY_SEEDS.practice + k));
      expect(s.dealer).toBe(1);
      expect(E.currentPlayer(s)).toBe(0);
      expect(s.phase).toBe('draw');
    }
  });

  it('practice: grab a joker, build a pure sequence from the open pile, then declare', () => {
    const { start, end, learner, log } = followTheCoach(
      INDIAN_RUMMY_SEEDS.practice,
      PRACTICE_CONFIG,
    );
    expect(start.wildCard).toBe('8D');
    expect(start.discard).toEqual(['X2']);
    // The coach's first move: pick the printed joker up from the open pile.
    expect(learner[0]).toEqual({ type: 'draw', from: 'discard' });
    expect(log[0]).toBe('You pick up a printed joker from the open pile.');
    expect(log).toContain('You pick up the Ten of Clubs from the open pile.');
    // Ten learner moves: five turns of draw + discard / declare.
    expect(learner).toHaveLength(10);
    expect(learner.at(-1)).toEqual({ type: 'declare', discard: '2D' });

    const shown = bestArrangement(end.hands[0]!, end.wildRank);
    expect(shown.valid).toBe(true);
    expect(shown.groups.map((g) => g.kind)).toEqual(['pure-sequence', 'sequence', 'set', 'set']);
    expect(shown.groups[0]!.cards).toEqual(['9C', 'TC', 'JC']);
    expect(shown.groups[1]!.cards.filter((c) => isJokerFor(c, end.wildRank))).toHaveLength(2);

    const r = E.result(end);
    expect(r).toMatchObject({ humanOutcome: 'win', humanNetUnits: 71 });
    expect(r.summary).toBe(
      'You declared a valid hand after 5 turns, so Player 1 paid you 71 points for their loose cards.',
    );
  });

  it('quickWin: the learner plays first and declares on their fourth turn (+14)', () => {
    const { start, end, learner } = followTheCoach(
      String(INDIAN_RUMMY_SEEDS.quickWin),
      PLAY_CONFIG,
    );
    expect(start.dealer).toBe(1);
    expect(learner).toHaveLength(8);
    expect(end.outcome).toMatchObject({ kind: 'declare', declarer: 0 });
    expect(E.result(end)).toMatchObject({ humanOutcome: 'win', humanNetUnits: 14 });
  });

  it('quickLoss: the bot declares after the learner’s second turn (−16)', () => {
    const { start, end, learner } = followTheCoach(
      String(INDIAN_RUMMY_SEEDS.quickLoss),
      PLAY_CONFIG,
    );
    expect(start.dealer).toBe(1);
    expect(learner).toHaveLength(4);
    expect(end.outcome).toMatchObject({ kind: 'declare', declarer: 1 });
    const r = E.result(end);
    expect(r).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -16 });
    expect(r.summary).toBe(
      'Player 1 declared a valid hand, so you paid 16 points for your loose cards.',
    );
  });

  it('the wallet setting never changes a deal (affordableUnits is unused)', () => {
    for (const seed of Object.values(INDIAN_RUMMY_SEEDS)) {
      expect(E.setup({ ...PLAY_CONFIG, affordableUnits: 0 }, createRng(seed))).toEqual(
        E.setup(PLAY_CONFIG, createRng(seed)),
      );
    }
  });
});
