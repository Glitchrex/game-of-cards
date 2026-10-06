import { describe, expect, it } from 'vitest';
import { type CardCode, makeDeck } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import {
  CATEGORY_ORDER,
  categoryCounts,
  compareHands,
  handDecider,
  handScore,
  handStrength,
  rankHand,
} from './hand-eval';

const h = (s: string) => s.split(' ') as CardCode[];

describe('rankHand: categories and names', () => {
  it.each([
    ['KS KH KD', 'trail', 'Trail of Kings', [13]],
    ['2S 2H 2D', 'trail', 'Trail of Twos', [2]],
    ['AH KH QH', 'pure-sequence', 'Pure sequence, Ace-King-Queen', [15]],
    ['3S AS 2S', 'pure-sequence', 'Pure sequence, Ace-Two-Three', [14]],
    ['4C 3C 2C', 'pure-sequence', 'Pure sequence, Four-Three-Two', [4]],
    ['QS KH AD', 'sequence', 'Sequence, Ace-King-Queen', [15]],
    ['TD JC QH', 'sequence', 'Sequence, Queen-Jack-Ten', [12]],
    ['AS 2D 3C', 'sequence', 'Sequence, Ace-Two-Three', [14]],
    ['AH 9H 4H', 'colour', 'Colour (all Hearts), Ace high', [14, 9, 4]],
    ['7S 7H KD', 'pair', 'Pair of Sevens', [7, 13]],
    ['KD 2S 2C', 'pair', 'Pair of Twos', [2, 13]],
    ['AS 9D 4C', 'high-card', 'High card, Ace', [14, 9, 4]],
    ['TS 7D 2C', 'high-card', 'High card, Ten', [10, 7, 2]],
  ] as const)('%s → %s (%s)', (cards, category, name, values) => {
    const r = rankHand(h(cards));
    expect(r.category).toBe(category);
    expect(r.name).toBe(name);
    expect(r.values).toEqual(values);
  });

  it('does not wrap sequences around the Ace (K-A-2 is just Ace high)', () => {
    expect(rankHand(h('KS AD 2C')).category).toBe('high-card');
    expect(rankHand(h('KS AS 2S')).category).toBe('colour');
  });

  it('rejects anything but three distinct standard cards', () => {
    expect(() => rankHand(h('AS KS'))).toThrow(/exactly 3/);
    expect(() => rankHand(h('AS KS QS JS'))).toThrow(/exactly 3/);
    expect(() => rankHand(h('AS AS KD'))).toThrow(/Duplicate/);
    expect(() => rankHand(['AS', 'KD', 'X1'])).toThrow(/Invalid/);
    expect(() => rankHand(['AS', 'KD', 'ZZ' as CardCode])).toThrow(/Invalid/);
  });
});

describe('compareHands: ranking order', () => {
  it('orders the six categories Trail > Pure sequence > Sequence > Colour > Pair > High card', () => {
    const ladder = [
      '2S 2H 2D', // lowest trail
      '4C 3C 2C', // lowest pure sequence
      '4S 3H 2D', // lowest sequence
      '5H 3H 2H', // lowest colour
      '2S 2H 3D', // lowest pair
      'AS KD JC', // best high card
    ].map(h);
    for (let i = 0; i + 1 < ladder.length; i++) {
      expect(compareHands(ladder[i] ?? [], ladder[i + 1] ?? [])).toBeGreaterThan(0);
      expect(compareHands(ladder[i + 1] ?? [], ladder[i] ?? [])).toBeLessThan(0);
    }
    expect(CATEGORY_ORDER).toEqual([
      'high-card',
      'pair',
      'colour',
      'sequence',
      'pure-sequence',
      'trail',
    ]);
  });

  it('ranks sequences A-K-Q, then A-2-3, then K-Q-J down to 4-3-2', () => {
    const order = [
      'AS KD QC',
      'AS 2D 3C',
      'KS QD JC',
      'QS JD TC',
      'JS TD 9C',
      'TS 9D 8C',
      '9S 8D 7C',
      '8S 7D 6C',
      '7S 6D 5C',
      '6S 5D 4C',
      '5S 4D 3C',
      '4S 3D 2C',
    ].map(h);
    for (let i = 0; i + 1 < order.length; i++) {
      expect(compareHands(order[i] ?? [], order[i + 1] ?? [])).toBeGreaterThan(0);
    }
    // The same order holds for pure sequences.
    expect(compareHands(h('AH 2H 3H'), h('KH QH JH'))).toBeGreaterThan(0);
    expect(compareHands(h('AH KH QH'), h('AS 2S 3S'))).toBeGreaterThan(0);
  });

  it('a higher trail beats a lower one; Aces are the highest trail', () => {
    expect(compareHands(h('AS AH AD'), h('KS KH KD'))).toBeGreaterThan(0);
    expect(compareHands(h('3S 3H 3D'), h('2S 2H 2D'))).toBeGreaterThan(0);
  });

  it('pairs compare by the pair first, then the odd card', () => {
    expect(compareHands(h('KS KH 2D'), h('QS QH AD'))).toBeGreaterThan(0);
    expect(compareHands(h('7S 7H KD'), h('7D 7C QS'))).toBeGreaterThan(0);
    expect(compareHands(h('AS AH 3D'), h('AD AC 3S'))).toBe(0);
  });

  it('high cards and colours compare card by card, highest first', () => {
    expect(compareHands(h('AS 4D 2C'), h('KS QD 9H'))).toBeGreaterThan(0);
    expect(compareHands(h('AS KD 9C'), h('AH KC 7D'))).toBeGreaterThan(0);
    expect(compareHands(h('AH 9H 4H'), h('AS 9S 3S'))).toBeGreaterThan(0);
    expect(compareHands(h('AH 9H 4H'), h('AS 9S 4S'))).toBe(0);
  });

  it('suits never break ties', () => {
    expect(compareHands(h('AS KD 9C'), h('AH KC 9D'))).toBe(0);
    expect(compareHands(h('QS KH AD'), h('QD KC AH'))).toBe(0);
  });

  it('a sequence beats a colour (straight beats flush in Teen Patti)', () => {
    expect(compareHands(h('4S 5H 6D'), h('AH KH JH'))).toBeGreaterThan(0);
  });

  it('accepts already-ranked hands', () => {
    expect(compareHands(rankHand(h('KS KH KD')), h('AS AH QD'))).toBeGreaterThan(0);
    expect(handScore(rankHand(h('KS KH KD')))).toBe(handScore(h('KS KH KD')));
  });

  it('agrees with handScore on a random sample', () => {
    const rng = createRng('compare-sample');
    for (let i = 0; i < 400; i++) {
      const d = shuffle(makeDeck(), rng);
      const a = d.slice(0, 3);
      const b = d.slice(3, 6);
      expect(Math.sign(compareHands(a, b))).toBe(Math.sign(handScore(a) - handScore(b)));
    }
  });
});

describe('handDecider', () => {
  it('reports how a show was decided', () => {
    expect(handDecider(h('7S 7H KD'), h('AS 9D 4C')).decider).toBe('category');
    expect(handDecider(h('KS KH 2D'), h('QS QH AD')).decider).toBe('rank');
    expect(handDecider(h('KS QD JC'), h('QS JD TC')).decider).toBe('rank');
    expect(handDecider(h('AS 9D 4C'), h('KH QD 8C'))).toEqual({
      decider: 'high-card',
      index: 0,
      lastCard: false,
    });
    expect(handDecider(h('AS KD 9C'), h('AH QC 7D'))).toEqual({
      decider: 'kicker',
      index: 1,
      lastCard: false,
    });
    expect(handDecider(h('AS KD 9C'), h('AH KC 7D'))).toEqual({
      decider: 'kicker',
      index: 2,
      lastCard: true,
    });
    expect(handDecider(h('7S 7H KD'), h('7D 7C QS'))).toEqual({
      decider: 'kicker',
      index: 1,
      lastCard: true,
    });
    expect(handDecider(h('AS KD 9C'), h('AH KC 9D')).decider).toBe('tie');
  });
});

describe('hand statistics', () => {
  it('counts every category correctly over all 22,100 hands', () => {
    expect(categoryCounts()).toEqual({
      trail: 52,
      'pure-sequence': 48,
      sequence: 720,
      colour: 1096,
      pair: 3744,
      'high-card': 16440,
    });
  });

  it('handStrength runs from ~0 for the worst hand to ~1 for a Trail of Aces', () => {
    expect(handStrength(h('AS AH AD'))).toBeGreaterThan(0.999);
    expect(handStrength(h('5S 3D 2C'))).toBeLessThan(0.002);
    // Any pair beats every high-card hand (~74% of all hands).
    expect(handStrength(h('2S 2H 3D'))).toBeGreaterThan(0.74);
    expect(handStrength(h('AS KD JC'))).toBeLessThan(0.75);
  });

  it('handStrength is monotonic with hand order', () => {
    const rng = createRng('strength-sample');
    for (let i = 0; i < 300; i++) {
      const d = shuffle(makeDeck(), rng);
      const a = d.slice(0, 3);
      const b = d.slice(3, 6);
      const c = compareHands(a, b);
      if (c > 0) expect(handStrength(a)).toBeGreaterThan(handStrength(b));
      else if (c < 0) expect(handStrength(a)).toBeLessThan(handStrength(b));
      else expect(handStrength(a)).toBe(handStrength(b));
    }
  });
});
