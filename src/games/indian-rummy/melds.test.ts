import { describe, expect, it } from 'vitest';
import { type CardCode, type Rank, RANKS, makeDeck } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import {
  DEADWOOD_CAP,
  bestArrangement,
  bestDiscard,
  canDeclareAfterOneDiscard,
  cardPoints,
  deadwoodOf,
  declareProblem,
  handPoints,
  handScore,
  hasPureSequence,
  isJokerFor,
  isValidHand,
  isValidWithoutJokers,
  rawDeadwoodOf,
  wildRankFor,
} from './melds';
import { cards, refScore } from './test-helpers';

/** In most tests the wild-joker card is a 7, so every 7 is a joker. */
const W: Rank = '7';
const DECK: CardCode[] = [...makeDeck({ copies: 2 }), 'X1', 'X2'];

function groupsOf(hand: string, wild: Rank = W) {
  return bestArrangement(cards(hand), wild).groups.map((g) => ({
    kind: g.kind,
    cards: g.cards.join(' '),
  }));
}

function sortedCodes(list: readonly CardCode[]): string {
  return list.slice().sort().join(' ');
}

describe('card values and jokers', () => {
  it('scores A, K, Q, J and 10 as 10, number cards at face value and jokers as 0', () => {
    expect(cards('AS KH QD JC TS').map((c) => cardPoints(c, W))).toEqual([10, 10, 10, 10, 10]);
    expect(cards('2S 3H 4D 5C 6S 8H 9D').map((c) => cardPoints(c, W))).toEqual([
      2, 3, 4, 5, 6, 8, 9,
    ]);
    expect(cards('X1 X2 7S 7H 7D 7C').map((c) => cardPoints(c, W))).toEqual([0, 0, 0, 0, 0, 0]);
    expect(handPoints(cards('KS 9H 7D X1 2C'), W)).toBe(21);
  });

  it('makes every card of the wild-joker rank a joker — Aces when the wild card is a printed joker', () => {
    expect(wildRankFor('7C')).toBe('7');
    expect(wildRankFor('TD')).toBe('T');
    expect(wildRankFor('X1')).toBe('A');
    expect(wildRankFor('X2')).toBe('A');
    expect(isJokerFor('7H', '7')).toBe(true);
    expect(isJokerFor('8H', '7')).toBe(false);
    expect(isJokerFor('X2', '7')).toBe(true);
    expect(isJokerFor('AS', 'A')).toBe(true);
    expect(cardPoints('AS', 'A')).toBe(0);
  });
});

describe('valid declarations', () => {
  it('accepts two pure sequences plus two sets', () => {
    const hand = cards('4S 5S 6S 9H TH JH QH KS KD KC 2H 2C 2D');
    expect(isValidHand(hand, W)).toBe(true);
    expect(declareProblem(hand, W)).toBeNull();
    const a = bestArrangement(hand, W);
    expect(a.valid).toBe(true);
    expect(a.deadwoodPoints).toBe(0);
    expect(a.groups.filter((g) => g.kind === 'pure-sequence')).toHaveLength(2);
    expect(a.groups.filter((g) => g.kind === 'set')).toHaveLength(2);
  });

  it('accepts one pure sequence plus an impure sequence that uses a wild joker', () => {
    // 7♦ plays the J♥.
    const hand = cards('4S 5S 6S 9H TH 7D QH KS KD KC 2H 2C 2D');
    expect(isValidHand(hand, W)).toBe(true);
    expect(groupsOf('4S 5S 6S 9H TH 7D QH KS KD KC 2H 2C 2D')).toContainEqual({
      kind: 'sequence',
      cards: '9H TH 7D QH',
    });
  });

  it('accepts a printed joker in a set', () => {
    expect(isValidHand(cards('4S 5S 6S 9H TH JH QH KS KD X1 2H 2C 2D'), W)).toBe(true);
  });

  it('rejects a hand without any pure sequence, even if everything else is grouped', () => {
    const hand = cards('4S 7S 6S 9H TH 7D QH KS KD KC 2H 2C 2D');
    expect(isValidHand(hand, W)).toBe(false);
    expect(hasPureSequence(hand, W)).toBe(false);
    expect(declareProblem(hand, W)).toMatch(/at least one pure sequence/);
  });

  it('rejects a pure sequence with only sets beside it (sets are not sequences)', () => {
    const hand = cards('4S 5S 6S KS KD KC KH 2H 2C 2D 9H 9D 9C');
    expect(isValidHand(hand, W)).toBe(false);
    expect(declareProblem(hand, W)).toMatch(/second sequence/);
    // Everything is grouped and there is a pure sequence, so it would pay nothing.
    expect(deadwoodOf(hand, W)).toBe(0);
  });

  it('names the cards that are still loose when the two sequences are there', () => {
    const hand = cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C 3D 8C');
    expect(declareProblem(hand, W)).toMatch(
      /4 cards don’t fit into any set or sequence yet: 2♥, 3♦, 2♣ and 8♣\./,
    );
    const one = cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C 2D 8C');
    expect(declareProblem(one, W)).toMatch(/one card doesn’t fit .*: 8♣\./);
  });

  it('needs every card grouped: spare jokers are absorbed but loose naturals are not', () => {
    // 13 cards with a spare printed joker: still valid (the joker joins a sequence).
    const hand = cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C 2D X1');
    expect(isValidHand(hand, W)).toBe(true);
    const groups = bestArrangement(hand, W).groups;
    expect(groups.some((g) => g.kind === 'unmatched')).toBe(false);
    expect(groups.find((g) => g.cards.includes('X1'))?.kind).toBe('sequence');
    // With two pure sequences, the joker turns one of them impure — still valid.
    expect(groups.filter((g) => g.kind === 'pure-sequence')).toHaveLength(1);
  });

  it('lets three jokers that include a wild card form a sequence on their own', () => {
    const hand = cards('3S 4S 5S 6S KS KD KC 2H 2C 2D X1 7D 7S');
    expect(isValidHand(hand, W)).toBe(true);
    // Only printed jokers cannot anchor a group, but there are only two of them.
    expect(isValidHand(cards('3S 4S 5S 6S KS KD KC 2H 2C 2D 9D X1 X2'), W)).toBe(true);
  });
});

describe('sequences', () => {
  it('lets the Ace be low (A-2-3) or high (Q-K-A)', () => {
    expect(isValidHand(cards('AH 2H 3H QS KS AS KD KC KH 9H 9D 9C 9S'), W)).toBe(true);
    expect(groupsOf('AH 2H 3H QS KS AS KD KC KH 9H 9D 9C 9S')).toEqual(
      expect.arrayContaining([
        { kind: 'pure-sequence', cards: 'AH 2H 3H' },
        { kind: 'pure-sequence', cards: 'QS KS AS' },
      ]),
    );
  });

  it('never wraps round from King to Two', () => {
    const hand = cards('KC AC 2C 4S 5S 6S 9H TH JH QD QH QS 8D');
    const loose = bestArrangement(hand, W).groups.find((g) => g.kind === 'unmatched')?.cards ?? [];
    expect(sortedCodes(loose)).toBe(sortedCodes(cards('KC AC 2C 8D')));
  });

  it('allows long sequences and never uses two copies of a card in one sequence', () => {
    const long = bestArrangement(cards('8D 9D TD JD QD KD AD 4S 5S 6S 2H 2C 2S'), W);
    expect(long.valid).toBe(true);
    expect(long.groups.map((g) => g.cards.length).sort()).toEqual([3, 3, 7]);
    // 5♥ 5♥ 6♥ 7♥… the second 5♥ cannot join the same run.
    const dup = bestArrangement(cards('4H 5H 5H 6H 4S 5S 6S KS KD KC 9C 9D 9S'), W);
    expect(dup.valid).toBe(false);
    expect(dup.groups.find((g) => g.kind === 'unmatched')?.cards).toEqual(['5H']);
  });

  it('needs one suit: mixed suits never make a sequence', () => {
    const a = bestArrangement(cards('8H 9S TH 4S 5S 6S KS KD KC 2H 2C 2D 3C'), W);
    expect(sortedCodes(a.groups.find((g) => g.kind === 'unmatched')?.cards ?? [])).toBe(
      sortedCodes(cards('8H 9S TH 3C')),
    );
  });

  it('keeps a sequence pure when a wild-rank card sits in its own natural place', () => {
    // 5s are wild; 4♥ 5♥ 6♥ is still a pure sequence.
    const hand = cards('4H 5H 6H 9S TS 5C QS KD KC KH 2H 2C 2D');
    expect(isValidHand(hand, '5')).toBe(true);
    expect(bestArrangement(hand, '5').groups).toContainEqual({
      kind: 'pure-sequence',
      cards: ['4H', '5H', '6H'],
    });
    // A wild card standing in for another card makes the run impure.
    expect(isValidHand(cards('4H 5C 6H 9S TS JS QS KD KC KH 2H 2C 2D'), '5')).toBe(true);
    expect(hasPureSequence(cards('4H 5C 6H 9S TS 5D QS KD KC KH 2H 2C 2D'), '5')).toBe(false);
  });

  it('treats every Ace as a joker when the wild-joker card is a printed joker', () => {
    const wild = wildRankFor('X1');
    // A♠ fills the gap in 9♥ _ J♥; 4♣ 5♣ 6♣ is the pure sequence.
    const hand = cards('9H AS JH 4C 5C 6C KS KD KC 2H 2C 2D 8C');
    expect(isValidHand(hand, wild)).toBe(false);
    expect(isValidHand(cards('9H AS JH 4C 5C 6C KS KD KC 2H 2C 2D 3C'), wild)).toBe(true);
    // An Ace in its own place (A-2-3) is a natural Ace and keeps the run pure.
    expect(hasPureSequence(cards('AH 2H 3H 9S 9D KS KD 4C 6C 8C TD JD 5S'), wild)).toBe(true);
  });
});

describe('sets', () => {
  it('needs three or four different suits of one rank', () => {
    expect(isValidHand(cards('4S 5S 6S 9H TH JH JS JD JC JH 2C 2D 2S'), W)).toBe(true);
    // Two Hearts can never share a set, even with two decks.
    const a = bestArrangement(cards('4S 5S 6S 9H TH JH 5H 5H 5S KD KC KH 3C'), W);
    expect(a.valid).toBe(false);
    expect(a.groups.find((g) => g.kind === 'unmatched')?.cards).toContain('5H');
  });

  it('caps a set at four cards', () => {
    const a = bestArrangement(cards('4S 5S 6S 9H TH JH QS QH QD QC QS 2C 3D'), W);
    expect(a.groups.filter((g) => g.kind === 'set').every((g) => g.cards.length <= 4)).toBe(true);
    expect(a.groups.find((g) => g.kind === 'unmatched')?.cards).toEqual(
      expect.arrayContaining(['QS', '2C', '3D']),
    );
  });

  it('lets a joker stand in for a missing suit', () => {
    expect(isValidHand(cards('4S 5S 6S 9H TH JH KS KD 7C 2H 2C 2D 3C'), W)).toBe(false);
    expect(isValidHand(cards('4S 5S 6S 9H TH JH KS KD 7C 2H 2C 2D 2S'), W)).toBe(true);
  });
});

describe('deadwood', () => {
  it('counts only the loose cards when there is a pure sequence', () => {
    // 4♠ 5♠ 6♠, 8♥ 8♦ 8♣, 10♠ (7♥ as J♠) Q♠ — loose K♣ 5♥ 3♦ 2♥ = 20.
    const hand = cards('4S 5S 6S 8H 8D 8C TS 7H QS KC 5H 3D 2H');
    expect(deadwoodOf(hand, W)).toBe(20);
    expect(rawDeadwoodOf(hand, W)).toBe(20);
    // With a 9♠ instead of the 5♥ the 9♠ joins the run (9-10-J-Q) and only 15 is left.
    expect(deadwoodOf(cards('4S 5S 6S 8H 8D 8C TS 7H QS KC 9S 3D 2H'), W)).toBe(15);
  });

  it('counts every card when there is no pure sequence', () => {
    const hand = cards('4S 7S 6S 8H 8D 8C 2D 3C 9H 2S 5D 4C JS');
    expect(hasPureSequence(hand, W)).toBe(false);
    expect(deadwoodOf(hand, W)).toBe(handPoints(hand, W));
    expect(rawDeadwoodOf(hand, W)).toBeLessThan(handPoints(hand, W));
  });

  it('never charges more than 80 points', () => {
    const hand = cards('9S QS KS 9H JH KH TD QD 8D JC 9C KC 8S');
    expect(handPoints(hand, W)).toBeGreaterThan(DEADWOOD_CAP);
    expect(deadwoodOf(hand, W)).toBe(DEADWOOD_CAP);
    expect(bestArrangement(hand, W).deadwoodPoints).toBe(DEADWOOD_CAP);
  });

  it('chooses the grouping with the fewest points left over', () => {
    // 9♥ 9♦ 9♣ 9♠ could be a set, but 9♥ is better in 8♥ 9♥ 10♥.
    const hand = cards('8H 9H TH 9D 9C 9S 4S 5S 6S KD 2C 3C 5H');
    expect(deadwoodOf(hand, W)).toBe(10 + 2 + 3 + 5);
  });
});

describe('isValidWithoutJokers', () => {
  it('is true only when no joker has to stand in for another card', () => {
    expect(isValidWithoutJokers(cards('4S 5S 6S 9H TH JH QH KS KD KC 2H 2C 2D'), W)).toBe(true);
    expect(isValidWithoutJokers(cards('4S 5S 6S 9H TH 7D QH KS KD KC 2H 2C 2D'), W)).toBe(false);
    expect(isValidWithoutJokers(cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C 2D X1'), W)).toBe(false);
    // A wild 7 in its own place is not standing in for anything.
    expect(isValidWithoutJokers(cards('6S 7S 8S 9H TH JH KS KD KC 2H 2C 2D 2S'), W)).toBe(true);
  });
});

// --------------------------------------------------------------- random hands

function randomHands(
  count: number,
  size: number,
  seed: string,
): { hand: CardCode[]; wild: Rank }[] {
  const rng = createRng(seed);
  const out: { hand: CardCode[]; wild: Rank }[] = [];
  for (let i = 0; i < count; i++) {
    const wild = RANKS[i % RANKS.length] as Rank;
    let pool = DECK;
    // Bias a third of the hands towards long runs and a third towards sets.
    if (i % 3 === 0) {
      const suits = i % 2 ? ['H'] : ['H', 'S'];
      pool = DECK.filter(
        (c) => c === 'X1' || c === 'X2' || suits.includes(c[1] ?? '') || c[0] === wild,
      );
    } else if (i % 3 === 1) {
      const ranks = shuffle(RANKS, rng).slice(0, 5) as string[];
      pool = DECK.filter(
        (c) => c === 'X1' || c === 'X2' || ranks.includes(c[0] ?? '') || c[0] === wild,
      );
    }
    out.push({ hand: shuffle(pool, rng).slice(0, size), wild });
  }
  return out;
}

describe('agreement with an independent brute-force scorer', () => {
  it('matches validity, deadwood and raw deadwood on 600 varied hands', () => {
    let valid = 0;
    for (const { hand, wild } of randomHands(600, 13, 'melds-cross')) {
      const ref = refScore(hand, wild);
      const a = bestArrangement(hand, wild);
      expect({ hand, valid: a.valid, deadwood: a.deadwoodPoints, raw: a.rawDeadwood }).toEqual({
        hand,
        valid: ref.valid,
        deadwood: ref.deadwood,
        raw: ref.raw,
      });
      // The arrangement uses exactly the hand's cards, and its loose points are the deadwood.
      expect(sortedCodes(a.groups.flatMap((g) => g.cards))).toBe(sortedCodes(hand));
      const loose = a.groups.find((g) => g.kind === 'unmatched')?.cards ?? [];
      // With a pure sequence the loose cards are exactly what the hand pays (before the cap);
      // without one the display shows the best grouping anyway (and every card counts).
      if (a.hasPureSequence) expect(Math.min(80, handPoints(loose, wild))).toBe(a.deadwoodPoints);
      else expect(handPoints(loose, wild)).toBe(a.rawDeadwood);
      if (a.valid) valid++;
    }
    expect(valid).toBeGreaterThan(40);
  }, 60_000);

  it('every group in a displayed arrangement really is that kind of group', () => {
    for (const { hand, wild } of randomHands(300, 13, 'melds-groups')) {
      for (const g of bestArrangement(hand, wild).groups) {
        if (g.kind === 'unmatched') continue;
        const ref = refScore(g.cards, wild);
        // A group on its own is a complete cover with zero raw deadwood…
        expect(ref.raw).toBe(0);
        // …and a pure sequence on its own has a pure reading.
        if (g.kind === 'pure-sequence') expect(refScore(g.cards, wild).deadwood).toBe(0);
      }
    }
  }, 60_000);
});

describe('one-discard searches (14 cards)', () => {
  it('canDeclareAfterOneDiscard agrees with trying every discard', () => {
    const hands = randomHands(300, 14, 'melds-14');
    // Add some 14-card hands that are one card from complete.
    hands.push({ hand: cards('4S 5S 6S 9H TH JH QH KS KD KC 2H 2C 2D 8C'), wild: W });
    hands.push({ hand: cards('4S 5S 6S 9H TH 7D QH KS KD KC 2H 2C 2D X1'), wild: W });
    let any = 0;
    for (const { hand, wild } of hands) {
      const brute = hand.some((_, i) =>
        isValidHand(
          hand.filter((__, j) => j !== i),
          wild,
        ),
      );
      expect(canDeclareAfterOneDiscard(hand, wild)).toBe(brute);
      if (brute) any++;
    }
    expect(any).toBeGreaterThan(5);
  });

  it('bestDiscard finds the lowest-scoring discard and never throws a joker', () => {
    for (const { hand, wild } of randomHands(200, 14, 'melds-discard')) {
      const choice = bestDiscard(hand, wild);
      expect(isJokerFor(choice.discard, wild)).toBe(false);
      let best = Infinity;
      hand.forEach((c, i) => {
        if (isJokerFor(c, wild)) return;
        best = Math.min(
          best,
          handScore(
            hand.filter((_, j) => j !== i),
            wild,
          ),
        );
      });
      expect(choice.score).toBeCloseTo(best, 9);
      const after = hand.slice();
      after.splice(after.indexOf(choice.discard), 1);
      expect(handScore(after, wild)).toBeCloseTo(best, 9);
    }
  });

  it('handScore prefers a hand with a pure sequence and connected cards', () => {
    const withPure = handScore(cards('4S 5S 6S 9H 9D KC 2D 3C TH 2S 5D QC 8H'), W);
    const without = handScore(cards('4S JS 6S 9H 9D KC 2D 3C TH 2S 5D QC 8H'), W);
    expect(withPure).toBeLessThan(without);
    const pair = handScore(cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C QD QH'), W);
    const split = handScore(cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C QD 8C'), W);
    expect(pair).toBeLessThan(split);
  });
});

describe('speed', () => {
  it('evaluates a 13-card hand in well under a millisecond on average', () => {
    // A fresh seed, so none of these hands is in the evaluation cache yet.
    const hands = randomHands(400, 13, 'melds-speed');
    const start = performance.now();
    for (const { hand, wild } of hands) bestArrangement(hand, wild);
    const avg = (performance.now() - start) / hands.length;
    // Typically ~0.1 ms; generous bound for busy CI machines.
    expect(avg).toBeLessThan(3);
  });
});
