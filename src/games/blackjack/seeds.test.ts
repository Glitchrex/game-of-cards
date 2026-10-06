/**
 * The curated seeds deal exactly what their names promise — checked with the real engine,
 * seeded the way the play shell (?seed=<n>, a string) and the practice hand (a number) do.
 */
import { createRng } from '@/games/core/rng';
import { type GameConfig } from '@/games/core/types';
import {
  blackjackEngine as E,
  dealerHasBlackjack,
  handValue,
  isPair,
  LEARNER,
  playerHasBlackjack,
  type BlackjackMove,
  type BlackjackState,
} from './engine';
import blackjackModule from './index';
import { BLACKJACK_SEEDS } from './seeds';
import { finishDealer, play } from './test-helpers';

/** What GameShell passes for a 10-Jeet bet from a full wallet. */
const PLAY_CONFIG: GameConfig = { ...blackjackModule.defaultConfig, affordableUnits: 99 };

function dealSeed(seed: number | string, config: GameConfig = PLAY_CONFIG): BlackjackState {
  return E.setup(config, createRng(seed));
}

const learner = (s: BlackjackState) => s.hands[0]!;

describe('BLACKJACK_SEEDS', () => {
  it('deal the same cards from the URL string, the number, the practice config and any wallet', () => {
    for (const seed of Object.values(BLACKJACK_SEEDS)) {
      const fromNumber = dealSeed(seed);
      expect(dealSeed(String(seed))).toEqual(fromNumber);
      const practice = dealSeed(seed, {
        ...blackjackModule.defaultConfig,
        ...blackjackModule.practice.config,
      });
      expect(practice.hands).toEqual(fromNumber.hands);
      expect(practice.dealer).toEqual(fromNumber.dealer);
      expect(dealSeed(seed, { ...PLAY_CONFIG, affordableUnits: 0 }).hands).toEqual(
        fromNumber.hands,
      );
    }
  });

  it('practice: a hard 13 against a dealer 6 — stand and let the dealer bust', () => {
    expect(blackjackModule.practice.seed).toBe(BLACKJACK_SEEDS.practice);
    const s = dealSeed(BLACKJACK_SEEDS.practice);
    expect(s.phase).toBe('player');
    expect(learner(s).cards).toEqual(['7C', '6S']);
    expect(handValue(learner(s).cards)).toEqual({ total: 13, soft: false });
    expect(isPair(learner(s).cards)).toBe(false);
    expect(s.dealer[0]).toBe('6S');

    const advice = E.coach(s, LEARNER);
    expect(advice.suggestion).toEqual({ type: 'stand' } satisfies BlackjackMove);
    expect(advice.situation).toContain('You have hard 13 (7 + 6). The dealer shows a 6.');

    const stood = E.result(finishDealer(play(s, 'stand')));
    expect(stood.humanOutcome).toBe('win');
    expect(stood.summary).toBe('The dealer busted with 26, so your 13 wins!');

    const hit = play(s, 'hit');
    expect(handValue(learner(hit).cards).total).toBeGreaterThan(21);
  });

  it('naturalWin: the learner has Blackjack and the dealer does not → paid 3 to 2', () => {
    const s = dealSeed(BLACKJACK_SEEDS.naturalWin);
    expect(playerHasBlackjack(s)).toBe(true);
    expect(dealerHasBlackjack(s)).toBe(false);
    // The round is decided at the deal: the dealer only turns the hole card over.
    expect(s.phase).toBe('dealer');
    const r = E.result(finishDealer(s));
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(1.5);
    expect(r.flags.perfect).toBe(true);
    expect(r.flags.tags).toContain('blackjack');
  });

  it('dealerBlackjack: the dealer peeks a Blackjack and the learner has none → loss at once', () => {
    const s = dealSeed(BLACKJACK_SEEDS.dealerBlackjack);
    expect(dealerHasBlackjack(s)).toBe(true);
    expect(playerHasBlackjack(s)).toBe(false);
    expect(s.phase).toBe('dealer');
    expect(E.legalMoves(s, LEARNER)).toEqual([]);
    const r = E.result(finishDealer(s));
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBe(-1);
    expect(r.flags.tags).toContain('dealerBlackjack');
  });

  it('bustOnHit: one hit from the opening deal busts the learner', () => {
    const s = dealSeed(BLACKJACK_SEEDS.bustOnHit);
    expect(s.phase).toBe('player');
    const total = handValue(learner(s).cards).total;
    expect(total).toBeGreaterThanOrEqual(12);
    expect(total).toBeLessThanOrEqual(16);
    const hit = play(s, 'hit');
    expect(handValue(learner(hit).cards).total).toBeGreaterThan(21);
    expect(hit.phase).toBe('dealer');
    const r = E.result(finishDealer(hit));
    expect(r.humanOutcome).toBe('loss');
    expect(r.flags.bust).toBe(true);
  });

  it('splitWin: a pair the coach splits; standing on both hands wins two bets', () => {
    const s = dealSeed(BLACKJACK_SEEDS.splitWin);
    expect(isPair(learner(s).cards)).toBe(true);
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'split' });
    const end = finishDealer(play(s, 'split', 'stand', 'stand'));
    expect(end.hands).toHaveLength(2);
    expect(E.result(end)).toMatchObject({ humanOutcome: 'win', humanNetUnits: 2 });
  });

  it('doubleWin: 11 against a small card; doubling down wins two bets', () => {
    const s = dealSeed(BLACKJACK_SEEDS.doubleWin);
    expect(handValue(learner(s).cards).total).toBe(11);
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'double' });
    const r = E.result(finishDealer(play(s, 'double')));
    expect(r).toMatchObject({ humanOutcome: 'win', humanNetUnits: 2 });
  });

  it('push: standing ties the dealer and the bet comes back', () => {
    const s = dealSeed(BLACKJACK_SEEDS.push);
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'stand' });
    const r = E.result(finishDealer(play(s, 'stand')));
    expect(r).toMatchObject({ humanOutcome: 'push', humanNetUnits: 0 });
  });

  it('doubleLoss: the coach doubles a soft 15 and both bets are lost', () => {
    const s = dealSeed(BLACKJACK_SEEDS.doubleLoss);
    expect(learner(s).cards).toEqual(['4C', 'AH']);
    expect(s.dealer[0]).toBe('5C');
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'double' });
    const end = finishDealer(play(s, 'double'));
    expect(learner(end)).toMatchObject({ bet: 2, doubled: true });
    expect(handValue(learner(end).cards).total).toBe(15);
    expect(handValue(end.dealer).total).toBe(18);
    expect(E.result(end)).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -2 });
  });

  it('splitLoss: two split 6s stand on 17 and 15 and both lose to 18', () => {
    const s = dealSeed(BLACKJACK_SEEDS.splitLoss);
    expect(isPair(learner(s).cards)).toBe(true);
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'split' });
    const end = finishDealer(play(s, 'split', 'stand', 'stand'));
    expect(end.hands.map((h) => handValue(h.cards).total)).toEqual([17, 15]);
    expect(handValue(end.dealer).total).toBe(18);
    expect(E.result(end)).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -2 });
  });

  it('splitPush: one split hand wins and the other loses, so the round breaks even', () => {
    const s = dealSeed(BLACKJACK_SEEDS.splitPush);
    expect(isPair(learner(s).cards)).toBe(true);
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'split' });
    const end = finishDealer(play(s, 'split', 'stand', 'stand'));
    expect(end.hands.map((h) => handValue(h.cards).total)).toEqual([18, 12]);
    expect(handValue(end.dealer).total).toBe(17);
    const r = E.result(end);
    expect(r).toMatchObject({ humanOutcome: 'push', humanNetUnits: 0 });
    expect(r.summary).toContain('you break even');
  });
});
