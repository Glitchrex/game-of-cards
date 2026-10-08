import { describe, expect, it } from 'vitest';
import { makeDeck } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import {
  CATEGORY_ORDER,
  cardFromId,
  cardId,
  compareHands,
  decidedByKicker,
  evaluate7,
  evaluateHand,
  scoreIds,
} from './hand-eval';
import { cards, compareReference, referenceScore } from './test-helpers';

const ev = (s: string) => evaluateHand(cards(s));
const beats = (a: string, b: string) => compareHands(ev(a), ev(b));

describe('categories and names', () => {
  const examples: [string, string, string][] = [
    ['AS KS QS JS TS 2D 3C', 'straight-flush', 'Royal Flush'],
    ['9H 8H 7H 6H 5H KD KC', 'straight-flush', 'Straight Flush to the Nine'],
    ['AD 2D 3D 4D 5D KD QD', 'straight-flush', 'Straight Flush to the Five'],
    ['QS QH QD QC 2S 3H 9D', 'four-of-a-kind', 'Four of a Kind, Queens'],
    ['KS KH KD 7C 7S 2D 3H', 'full-house', 'Full House, Kings full of Sevens'],
    ['AH 9H 6H 4H 2H KC KD', 'flush', 'Flush, Ace high'],
    ['9C 8D 7S 6H 5C 2D 2H', 'straight', 'Straight to the Nine'],
    ['AC 2D 3S 4H 5C 9D KH', 'straight', 'Straight to the Five'],
    ['7C 7D 7S AH 9C 4D 2H', 'three-of-a-kind', 'Three of a Kind, Sevens'],
    ['KC KD 7S 7H 9C 4D 2H', 'two-pair', 'Two Pair, Kings and Sevens'],
    ['6C 6D AS 7H 9C 4D 2H', 'pair', 'Pair of Sixes'],
    ['AC JD 9S 7H 5C 4D 2H', 'high-card', 'High Card, Ace'],
  ];
  it.each(examples)('%s is %s (%s)', (hand, category, name) => {
    const v = ev(hand);
    expect(v.category).toBe(category);
    expect(v.categoryIndex).toBe(CATEGORY_ORDER.indexOf(v.category));
    expect(v.name).toBe(name);
    expect(v.cards).toHaveLength(5);
    expect(new Set(v.cards).size).toBe(5);
    for (const c of v.cards) expect(cards(hand)).toContain(c);
  });

  it('ranks the categories in the standard order', () => {
    const ordered = examples.map(([h]) => ev(h));
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1];
      const b = ordered[i];
      if (!a || !b) throw new Error('missing');
      expect(a.categoryIndex).toBeGreaterThanOrEqual(b.categoryIndex);
    }
    expect(beats('AS KS QS JS TS 2D 3C', '9H 8H 7H 6H 5H KD KC')).toBeGreaterThan(0);
    expect(ev('AS KS QS JS TS 2D 3C').isRoyal).toBe(true);
    expect(ev('9H 8H 7H 6H 5H KD KC').isRoyal).toBe(false);
  });

  it('picks the best five cards to show', () => {
    expect(ev('KS KH KD 7C 7S 2D 3H').cards).toEqual(['KS', 'KH', 'KD', '7C', '7S']);
    expect(ev('AC 2D 3S 4H 5C 9D KH').cards).toEqual(['5C', '4H', '3S', '2D', 'AC']);
    // Six hearts: only the top five count.
    expect(ev('AH KH 9H 6H 4H 2H 3C').cards).toEqual(['AH', 'KH', '9H', '6H', '4H']);
  });
});

describe('comparisons and tie-breaks', () => {
  it('the wheel (A-2-3-4-5) is the lowest straight', () => {
    expect(beats('6C 5D 4S 3H 2C KD KH', 'AC 2D 3S 4H 5C KD QH')).toBeGreaterThan(0);
    expect(beats('AC KD QS JH TC 2D 3H', 'KC QD JS TH 9C 2D 3H')).toBeGreaterThan(0);
  });

  it('a straight never wraps around (Q-K-A-2-3 is not a straight)', () => {
    expect(ev('QC KD AS 2H 3C 8D 9H').category).toBe('high-card');
  });

  it('flush beats straight; full house beats flush; straight flush beats four of a kind', () => {
    expect(beats('AH 9H 6H 4H 2H KC KD', '9C 8D 7S 6H 5C 2D 2H')).toBeGreaterThan(0);
    expect(beats('2S 2H 2D 3C 3S 9D 8H', 'AH 9H 6H 4H 2H KC KD')).toBeGreaterThan(0);
    expect(beats('5H 4H 3H 2H AH KD KC', 'AS AH AD AC KS QD JH')).toBeGreaterThan(0);
  });

  it('compares kickers card by card', () => {
    expect(beats('AS AD KH 9C 4S', 'AH AC QH JC TS')).toBeGreaterThan(0);
    expect(beats('KS KD 7H 7C AS', 'KH KC 7D 7S QS')).toBeGreaterThan(0);
    expect(beats('AH 9H 6H 4H 3H', 'AS 9S 6S 4S 2S')).toBeGreaterThan(0);
    // Four of a kind on the board: the best fifth card decides.
    expect(beats('QS QH QD QC 9S 2D 3C', 'QS QH QD QC 8S 2D 3C')).toBeGreaterThan(0);
  });

  it('only the best five cards play: extra cards cannot break a tie', () => {
    // Board A-K-Q-J-T straight: both players play the board.
    const board = 'AS KD QH JC TS';
    expect(beats(`2C 3D ${board}`, `4H 5S ${board}`)).toBe(0);
    // Two pair on board + higher kicker in hand wins.
    expect(beats('AC 2D KS KH 7S 7H 4C', 'QC 3D KS KH 7S 7H 4C')).toBeGreaterThan(0);
  });

  it('with three pairs, the best two pairs and the best kicker count', () => {
    const v = ev('KS KH 7D 7C 4S 4H AD');
    expect(v.name).toBe('Two Pair, Kings and Sevens');
    expect(v.ranks).toEqual([13, 7, 14]);
  });

  it('two sets of three make a full house with the higher set on top', () => {
    expect(ev('9S 9H 9D 4C 4S 4H 2D').name).toBe('Full House, Nines full of Fours');
  });

  it('suits never break a tie', () => {
    expect(beats('AS KS 9D 5C 3H 2D 7C', 'AH KH 9C 5D 3S 2H 7D')).toBe(0);
  });
});

describe('decidedByKicker', () => {
  it('is true only when the same hand is separated by a kicker', () => {
    expect(decidedByKicker(ev('AS AD KH 9C 4S'), ev('AH AC QH JC TS'))).toBe(true);
    expect(decidedByKicker(ev('AS AD KH 9C 4S'), ev('KS KD QH JC TS'))).toBe(false);
    expect(decidedByKicker(ev('AS KD 9H 7C 4S'), ev('AH QD JH 7S 4D'))).toBe(true);
    expect(decidedByKicker(ev('AS KD 9H 7C 4S'), ev('KH QD JH 7S 4D'))).toBe(false);
    expect(decidedByKicker(ev('AH 9H 6H 4H 3H'), ev('AS 9S 6S 4S 2S'))).toBe(false);
    expect(decidedByKicker(ev('9C 8D 7S 6H 5C'), ev('8C 7D 6S 5H 4C'))).toBe(false);
    expect(decidedByKicker(ev('AS AD KH 9C 4S'), ev('AH AC KD 9S 4D'))).toBe(false);
    expect(decidedByKicker(ev('KS KD 7H 7C AS'), ev('KH KC 7D 7S QS'))).toBe(true);
  });
});

describe('input checks and fewer cards', () => {
  it('evaluate7 needs 5–7 cards; evaluateHand works with fewer', () => {
    expect(() => evaluate7(cards('AS KS'))).toThrow(RangeError);
    expect(() => evaluate7(cards('AS KS QS JS TS 9S 8S 7S'))).toThrow(RangeError);
    expect(ev('QS QH').name).toBe('Pair of Queens');
    expect(ev('AS 7D').name).toBe('High Card, Ace');
    expect(ev('AS 7D').cards).toEqual(['AS', '7D']);
  });

  it('rejects duplicates and jokers', () => {
    expect(() => ev('AS AS KD QC JH')).toThrow();
    expect(() => evaluateHand(['X1', 'AS', 'KS', 'QS', 'JS'])).toThrow();
  });

  it('card ids round-trip', () => {
    for (const c of makeDeck()) expect(cardFromId(cardId(c))).toBe(c);
  });
});

describe('agrees with an independent brute-force evaluator', () => {
  it('on 3,000 random 7-card hand pairs (and the fast id path agrees too)', () => {
    const rng = createRng('hand-eval-cross-check');
    for (let t = 0; t < 3000; t++) {
      const deck = shuffle(makeDeck(), rng);
      const a = deck.slice(0, 7);
      const b = deck.slice(7, 14);
      const ours = Math.sign(compareHands(evaluate7(a), evaluate7(b)));
      const theirs = Math.sign(compareReference(a, b));
      expect(ours, `${a.join(' ')} vs ${b.join(' ')}`).toBe(theirs);
      expect(scoreIds(a.map(cardId), 7)).toBe(evaluate7(a).score);
      expect(evaluate7(a).categoryIndex).toBe(referenceScore(a)[0]);
    }
  });
});
