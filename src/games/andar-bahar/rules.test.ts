/**
 * Exact odds and small helpers. The probabilities are checked against an independent
 * brute-force enumeration of every way the three matching cards can sit in the stock.
 */
import { describe, expect, it } from 'vitest';
import {
  aRank,
  bestSide,
  cardsWord,
  choose,
  expectedNet,
  expectedNetBeforeDeal,
  firstMatchDistribution,
  isSide,
  MAX_DEAL_LENGTH,
  nextSideWinChance,
  otherSide,
  PAYOUT,
  percent,
  rankName,
  rankPlural,
  sameRank,
  seatName,
  sideForCard,
  sideLabel,
  STOCK_SIZE,
  verbFor,
  winChances,
} from './rules';

/** Brute force: every set of 3 positions (1-based) the matches can occupy among `n` cards. */
function bruteForceNextSideChance(n: number): number {
  let favourable = 0;
  let total = 0;
  for (let a = 1; a <= n; a++) {
    for (let b = a + 1; b <= n; b++) {
      for (let c = b + 1; c <= n; c++) {
        total++;
        if (a % 2 === 1) favourable++; // the first match (a) is an odd card from here
      }
    }
  }
  return favourable / total;
}

describe('exact odds', () => {
  it('Andar wins 10,725 of 20,825 equally likely deals (≈ 51.5%), Bahar 10,100 (≈ 48.5%)', () => {
    const { andar, bahar } = winChances(0);
    expect(andar).toBeCloseTo(10_725 / 20_825, 12);
    expect(bahar).toBeCloseTo(10_100 / 20_825, 12);
    expect(percent(andar)).toBe('51.5%');
    expect(percent(bahar)).toBe('48.5%');
  });

  it('matches an independent brute-force enumeration for every stock size', () => {
    for (const n of [3, 4, 5, 10, 17, 30, 51]) {
      expect(nextSideWinChance(n)).toBeCloseTo(bruteForceNextSideChance(n), 12);
    }
  });

  it('small cases by hand: with only the three matches left the next side surely wins', () => {
    expect(nextSideWinChance(3)).toBe(1);
    // 4 cards, 3 matches: first card matches with probability 3/4.
    expect(nextSideWinChance(4)).toBeCloseTo(3 / 4, 12);
    // One match among 2 cards: 50/50.
    expect(nextSideWinChance(2, 1)).toBeCloseTo(1 / 2, 12);
  });

  it('winChances follows the alternation: the side due the next card is the favourite', () => {
    for (let dealt = 0; dealt < MAX_DEAL_LENGTH; dealt++) {
      const c = winChances(dealt);
      expect(c.andar + c.bahar).toBeCloseTo(1, 12);
      const next = sideForCard(dealt);
      expect(c[next]).toBeGreaterThan(c[otherSide(next)]);
      expect(c[next]).toBeCloseTo(nextSideWinChance(STOCK_SIZE - dealt), 12);
    }
    // After 48 cards without a match only the three matches are left: card 49 decides.
    expect(winChances(48)).toEqual({ andar: 1, bahar: 0 });
  });

  it('rejects impossible positions', () => {
    expect(() => winChances(-1)).toThrow(RangeError);
    expect(() => winChances(MAX_DEAL_LENGTH)).toThrow(RangeError);
    expect(() => winChances(1.5)).toThrow(RangeError);
    expect(() => nextSideWinChance(2, 3)).toThrow(RangeError);
    expect(() => firstMatchDistribution(5, 0)).toThrow(RangeError);
  });

  it('the first-match distribution sums to 1, peaks on card 1 and averages card 13', () => {
    const d = firstMatchDistribution(STOCK_SIZE);
    expect(d).toHaveLength(MAX_DEAL_LENGTH);
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(d[0]).toBeCloseTo(3 / 51, 12);
    expect(d.at(-1)).toBeCloseTo(1 / choose(51, 3), 12);
    // E[min of 3 uniform positions among 51] = 52 / 4.
    expect(d.reduce((a, p, i) => a + p * (i + 1), 0)).toBeCloseTo(13, 10);
    for (let i = 1; i < d.length; i++) expect(d[i]!).toBeLessThan(d[i - 1]!);
  });

  it('choose() is the binomial coefficient', () => {
    expect(choose(51, 3)).toBe(20_825);
    expect(choose(50, 2)).toBe(1225);
    expect(choose(5, 0)).toBe(1);
    expect(choose(3, 5)).toBe(0);
    expect(choose(4, -1)).toBe(0);
  });
});

describe('payouts and expected value', () => {
  it('Andar pays 0.9 to 1 and Bahar 1 to 1', () => {
    expect(PAYOUT).toEqual({ andar: 0.9, bahar: 1 });
  });

  it('both bets lose a little on average: Andar ≈ −2.15%, Bahar ≈ −3.00%', () => {
    expect(expectedNetBeforeDeal('andar')).toBeCloseTo((0.9 * 10_725 - 10_100) / 20_825, 12);
    expect(expectedNetBeforeDeal('bahar')).toBeCloseTo((10_100 - 10_725) / 20_825, 12);
    expect(expectedNetBeforeDeal('andar')).toBeCloseTo(-0.0215, 4);
    expect(expectedNetBeforeDeal('bahar')).toBeCloseTo(-0.03, 4);
  });

  it('expectedNet = chance × payout − (1 − chance)', () => {
    expect(expectedNet('bahar', 0.5)).toBeCloseTo(0, 12);
    expect(expectedNet('andar', 0.5)).toBeCloseTo(-0.05, 12);
    expect(expectedNet('andar', 1)).toBeCloseTo(0.9, 12);
    expect(expectedNet('bahar', 0)).toBe(-1);
  });

  it('the side with the smaller average loss is Andar', () => {
    expect(bestSide()).toBe('andar');
    expect(expectedNetBeforeDeal(bestSide())).toBeGreaterThan(
      expectedNetBeforeDeal(otherSide(bestSide())),
    );
  });
});

describe('helpers', () => {
  it('sides and the alternation start with Andar', () => {
    expect(sideForCard(0)).toBe('andar');
    expect(sideForCard(1)).toBe('bahar');
    expect(sideForCard(48)).toBe('andar');
    expect(otherSide('andar')).toBe('bahar');
    expect(otherSide('bahar')).toBe('andar');
    expect(isSide('andar') && isSide('bahar')).toBe(true);
    expect(isSide('middle') || isSide(undefined) || isSide(0)).toBe(false);
  });

  it('only the rank decides a match, never the suit', () => {
    expect(sameRank('7H', '7S')).toBe(true);
    expect(sameRank('7H', '8H')).toBe(false);
    expect(sameRank('TD', 'TC')).toBe(true);
  });

  it('beginner wording', () => {
    expect(sideLabel('andar')).toBe('Andar (inside)');
    expect(sideLabel('bahar')).toBe('Bahar (outside)');
    expect(rankName('TD')).toBe('Ten');
    expect(rankPlural('6C')).toBe('Sixes');
    expect(rankPlural('KH')).toBe('Kings');
    expect(aRank('AS')).toBe('an Ace');
    expect(aRank('8D')).toBe('an Eight');
    expect(aRank('7C')).toBe('a Seven');
    expect(seatName(0)).toBe('You');
    expect(seatName(1)).toBe('Player 1');
    expect(verbFor(0, 'bet', 'bets')).toBe('bet');
    expect(verbFor(1, 'bet', 'bets')).toBe('bets');
    expect(cardsWord(1)).toBe('1 card');
    expect(cardsWord(7)).toBe('7 cards');
  });
});
