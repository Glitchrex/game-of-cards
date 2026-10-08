/**
 * Every curated seed does what seeds.ts says, dealt exactly as the shell and the practice
 * hand deal it: `createRng(seed)` → `andarBaharEngine.setup(defaultConfig)`.
 */
import { createRng } from '@/games/core/rng';
import {
  andarBaharEngine as E,
  DEALER,
  LEARNER,
  settle,
  type AndarBaharState,
  type Side,
} from './engine';
import andarBaharModule from './index';
import { ANDARBAHAR_SEEDS } from './seeds';

function dealt(seed: number | string): AndarBaharState {
  return E.setup(andarBaharModule.defaultConfig, createRng(seed));
}

/** Bet on `side`, then let the dealer deal (one forced move per card) until the match. */
function playOut(seed: number, side: Side) {
  let s = E.applyMove(dealt(seed), { type: 'bet', side });
  let deals = 0;
  while (!E.isOver(s)) {
    expect(E.currentPlayer(s)).toBe(DEALER);
    s = E.applyMove(s, E.botMove(s, DEALER, 'normal', createRng('dealer')));
    deals += 1;
  }
  return { state: s, deals, settlement: settle(s), result: E.result(s) };
}

describe('ANDARBAHAR_SEEDS', () => {
  it.each(Object.entries(ANDARBAHAR_SEEDS))(
    '%s (%i) deals the same game from the number and from its ?seed= string',
    (_, seed) => {
      expect(dealt(String(seed))).toEqual(dealt(seed));
      expect(dealt(seed).phase).toBe('bet');
    },
  );

  it('practice: the 7♥ joker; the coach picks Andar, and Andar wins on card 9', () => {
    const start = dealt(ANDARBAHAR_SEEDS.practice);
    expect(start.joker).toBe('7H');
    expect(andarBaharModule.practice.seed).toBe(ANDARBAHAR_SEEDS.practice);
    const advice = E.coach(start, LEARNER);
    expect(advice.suggestion).toEqual({ type: 'bet', side: 'andar' });
    const { deals, settlement, result } = playOut(ANDARBAHAR_SEEDS.practice, 'andar');
    expect(deals).toBe(9);
    expect(settlement).toMatchObject({ winner: 'andar', won: true, net: 0.9, matchNumber: 9 });
    expect(settlement.matchingCard).toBe('7S');
    expect(result.humanOutcome).toBe('win');
  });

  it('quickAndarWin: the 6♦ matches the 6♠ joker on Andar as card 3', () => {
    const { settlement, result } = playOut(ANDARBAHAR_SEEDS.quickAndarWin, 'andar');
    expect(dealt(ANDARBAHAR_SEEDS.quickAndarWin).joker).toBe('6S');
    expect(settlement).toMatchObject({ winner: 'andar', matchNumber: 3, matchingCard: '6D' });
    expect(result.flags.closeFinish).toBe(true);
  });

  it('firstCardMatch: the very first card matches, on Andar', () => {
    const { settlement, result } = playOut(ANDARBAHAR_SEEDS.firstCardMatch, 'bahar');
    expect(settlement).toMatchObject({ winner: 'andar', matchNumber: 1, won: false, net: -1 });
    expect(result.flags.tags).toContain('first-card-match');
    expect(result.flags.luckyLastCard).toBe(true);
  });

  it('quickBaharWin: card 2 matches, so a Bahar bet wins 1 to 1 and an Andar bet loses', () => {
    expect(playOut(ANDARBAHAR_SEEDS.quickBaharWin, 'bahar').settlement).toMatchObject({
      winner: 'bahar',
      matchNumber: 2,
      won: true,
      net: 1,
    });
    expect(playOut(ANDARBAHAR_SEEDS.quickBaharWin, 'andar').result.humanOutcome).toBe('loss');
  });

  it('baharWin: the Q♥ matches the Q♠ joker on Bahar as card 8 — the coach’s Andar loses', () => {
    expect(dealt(ANDARBAHAR_SEEDS.baharWin).joker).toBe('QS');
    const { settlement, result } = playOut(ANDARBAHAR_SEEDS.baharWin, 'andar');
    expect(settlement).toMatchObject({ winner: 'bahar', matchNumber: 8, matchingCard: 'QH' });
    expect(result).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -1 });
  });

  it('longDeal: the T♥ matches on Bahar as card 28, a long nail-biter', () => {
    const { settlement, result } = playOut(ANDARBAHAR_SEEDS.longDeal, 'bahar');
    expect(settlement).toMatchObject({ winner: 'bahar', matchNumber: 28, matchingCard: 'TH' });
    expect(result.flags.tags).toContain('long-deal');
  });
});
