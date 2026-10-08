import { describe, expect, it } from 'vitest';
import {
  RANKS,
  SUITS,
  card,
  cardName,
  cardShort,
  isCardCode,
  isJoker,
  isRed,
  makeDeck,
  rankNumber,
  rankNumberAceHigh,
  rankOf,
  removeCard,
  sortHand,
  suitOf,
  type CardCode,
  type Rank,
} from './cards';
import { createRng, shuffle } from './rng';

const counts = (cards: readonly string[]) => {
  const m = new Map<string, number>();
  for (const c of cards) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
};

describe('makeDeck', () => {
  it('builds a standard 52-card deck of unique, valid codes by default', () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck).size).toBe(52);
    expect(deck.every(isCardCode)).toBe(true);
    expect(deck.some(isJoker)).toBe(false);
    for (const s of SUITS) expect(deck.filter((c) => suitOf(c) === s)).toHaveLength(13);
    for (const r of RANKS) expect(deck.filter((c) => rankOf(c) === r)).toHaveLength(4);
  });

  it('is ordered by suit (S, H, D, C) then rank (A..K)', () => {
    const deck = makeDeck();
    expect(deck.slice(0, 13)).toEqual(RANKS.map((r) => `${r}S`));
    expect(deck[13]).toBe('AH');
    expect(deck[26]).toBe('AD');
    expect(deck[51]).toBe('KC');
  });

  it('supports reduced rank sets (e.g. 40-card Italian-style, 24-card Euchre deck)', () => {
    const forty = makeDeck({ ranks: ['A', '2', '3', '4', '5', '6', '7', 'J', 'Q', 'K'] });
    expect(forty).toHaveLength(40);
    expect(forty.some((c) => ['8', '9', 'T'].includes(rankOf(c)))).toBe(false);

    const euchre = makeDeck({ ranks: ['9', 'T', 'J', 'Q', 'K', 'A'] });
    expect(euchre).toHaveLength(24);
    expect(new Set(euchre).size).toBe(24);
  });

  it('supports multiple copies (six-deck shoe = 312 cards, 6 of each)', () => {
    const shoe = makeDeck({ copies: 6 });
    expect(shoe).toHaveLength(312);
    const c = counts(shoe);
    expect(c.size).toBe(52);
    expect([...c.values()].every((n) => n === 6)).toBe(true);
  });

  it('adds jokers per copy', () => {
    const one = makeDeck({ jokers: 1 });
    expect(one).toHaveLength(53);
    expect(one.filter(isJoker)).toEqual(['X1']);

    const two = makeDeck({ jokers: 2 });
    expect(two).toHaveLength(54);
    expect(two.filter(isJoker)).toEqual(['X1', 'X2']);

    // Indian Rummy: two decks + one printed joker each = 106 cards.
    const rummy = makeDeck({ copies: 2, jokers: 1 });
    expect(rummy).toHaveLength(106);
    expect(rummy.filter(isJoker)).toEqual(['X1', 'X1']);

    const big = makeDeck({ copies: 2, jokers: 2 });
    expect(big).toHaveLength(108);
    expect(counts(big).get('X2')).toBe(2);
  });

  it('returns an empty deck for zero copies and a fresh array every call', () => {
    expect(makeDeck({ copies: 0, jokers: 2 })).toEqual([]);
    const a = makeDeck();
    const b = makeDeck();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

describe('isCardCode / isJoker', () => {
  it('accepts every rank+suit combination and both jokers', () => {
    for (const r of RANKS) for (const s of SUITS) expect(isCardCode(`${r}${s}`)).toBe(true);
    expect(isCardCode('X1')).toBe(true);
    expect(isCardCode('X2')).toBe(true);
  });

  it.each([
    '',
    'A',
    'AS ',
    ' AS',
    'as',
    'aS',
    'As',
    '10H',
    '1H',
    '0S',
    'ZS',
    'AX',
    'SA',
    'X3',
    'X0',
    'JK',
    'XX',
    'TDD',
  ])('rejects %j', (code) => {
    expect(isCardCode(code)).toBe(false);
  });

  it('isJoker is true only for X1 and X2', () => {
    expect(isJoker('X1')).toBe(true);
    expect(isJoker('X2')).toBe(true);
    expect(isJoker('X3')).toBe(false);
    expect(isJoker('KS')).toBe(false);
  });
});

describe('rank / suit helpers', () => {
  it('rankOf and suitOf split a code', () => {
    expect(rankOf('TD')).toBe('T');
    expect(suitOf('TD')).toBe('D');
    expect(rankOf('AS')).toBe('A');
    expect(suitOf('QC')).toBe('C');
  });

  it('rankOf/suitOf throw for jokers', () => {
    expect(() => rankOf('X1')).toThrow(/no rank/);
    expect(() => suitOf('X2')).toThrow(/no suit/);
  });

  it('rankNumber is Ace-low 1..13', () => {
    const expected: Record<Rank, number> = {
      A: 1,
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
      '6': 6,
      '7': 7,
      '8': 8,
      '9': 9,
      T: 10,
      J: 11,
      Q: 12,
      K: 13,
    };
    for (const r of RANKS) expect(rankNumber(card(r, 'H'))).toBe(expected[r]);
  });

  it('rankNumberAceHigh is 2..14 with the Ace on top', () => {
    expect(rankNumberAceHigh('AS')).toBe(14);
    expect(rankNumberAceHigh('KS')).toBe(13);
    expect(rankNumberAceHigh('2S')).toBe(2);
    expect(rankNumberAceHigh('TS')).toBe(10);
    for (const r of RANKS.slice(1)) {
      expect(rankNumberAceHigh(card(r, 'C'))).toBe(rankNumber(card(r, 'C')));
    }
  });

  it('isRed: hearts and diamonds are red; X1 is the red joker', () => {
    expect(isRed('AH')).toBe(true);
    expect(isRed('9D')).toBe(true);
    expect(isRed('AS')).toBe(false);
    expect(isRed('KC')).toBe(false);
    expect(isRed('X1')).toBe(true);
    expect(isRed('X2')).toBe(false);
  });

  it('card() builds codes', () => {
    expect(card('Q', 'H')).toBe('QH');
    expect(card('T', 'S')).toBe('TS');
  });
});

describe('cardName / cardShort', () => {
  it('names cards in plain English', () => {
    expect(cardName('QH')).toBe('Queen of Hearts');
    expect(cardName('TD')).toBe('Ten of Diamonds');
    expect(cardName('AS')).toBe('Ace of Spades');
    expect(cardName('7C')).toBe('Seven of Clubs');
    expect(cardName('X1')).toBe('Joker');
    expect(cardName('X2')).toBe('Joker');
  });

  it('gives every card of a deck a unique name', () => {
    const names = makeDeck().map(cardName);
    expect(new Set(names).size).toBe(52);
    expect(names.every((n) => /^[A-Z][a-z]+ of (Spades|Hearts|Diamonds|Clubs)$/.test(n))).toBe(
      true,
    );
  });

  it('short labels use 10 instead of T and suit symbols', () => {
    expect(cardShort('QH')).toBe('Q♥');
    expect(cardShort('TS')).toBe('10♠');
    expect(cardShort('2D')).toBe('2♦');
    expect(cardShort('AC')).toBe('A♣');
    expect(cardShort('X1')).toBe('Joker');
  });
});

describe('removeCard', () => {
  it('removes only the first occurrence and returns a new array', () => {
    const hand: readonly CardCode[] = Object.freeze(['AS', 'KH', 'AS', '2C']);
    const out = removeCard(hand, 'AS');
    expect(out).toEqual(['KH', 'AS', '2C']);
    expect(hand).toEqual(['AS', 'KH', 'AS', '2C']);
    expect(out).not.toBe(hand);
    expect(removeCard(['X1', 'X1'], 'X1')).toEqual(['X1']);
  });

  it('throws a clear error when the card is not there', () => {
    expect(() => removeCard(['AS'], 'KH')).toThrow('Card KH not found');
    expect(() => removeCard([], 'AS')).toThrow(/not found/);
  });
});

describe('sortHand', () => {
  it('sorts by suit S, H, C, D (alternating colours) then rank, Ace high by default', () => {
    expect(sortHand(['2D', 'AS', 'KH', '3S', 'TC', 'AH', '9D'])).toEqual([
      '3S',
      'AS',
      'KH',
      'AH',
      'TC',
      '2D',
      '9D',
    ]);
  });

  it('supports Ace-low ordering', () => {
    expect(sortHand(['KS', 'AS', '2S'], { aceHigh: false })).toEqual(['AS', '2S', 'KS']);
    expect(sortHand(['KS', 'AS', '2S'], { aceHigh: true })).toEqual(['2S', 'KS', 'AS']);
  });

  it('supports a custom suit order', () => {
    expect(sortHand(['AS', 'AH', 'AD', 'AC'], { suitOrder: ['C', 'D', 'H', 'S'] })).toEqual([
      'AC',
      'AD',
      'AH',
      'AS',
    ]);
  });

  it('puts jokers last in a canonical order (X1 before X2), whatever the input order', () => {
    expect(sortHand(['X2', 'KD', 'X1', '2S'])).toEqual(['2S', 'KD', 'X1', 'X2']);
    expect(sortHand(['X1', 'X2'])).toEqual(['X1', 'X2']);
    expect(sortHand(['X2', 'X1'])).toEqual(['X1', 'X2']);
  });

  it('is canonical: any shuffle of the same cards sorts to the same hand', () => {
    const deck = makeDeck({ jokers: 2 });
    const reference = sortHand(deck);
    expect(reference.slice(0, 13)).toEqual([
      '2S',
      '3S',
      '4S',
      '5S',
      '6S',
      '7S',
      '8S',
      '9S',
      'TS',
      'JS',
      'QS',
      'KS',
      'AS',
    ]);
    const rng = createRng('sort-canonical');
    for (let i = 0; i < 25; i++) expect(sortHand(shuffle(deck, rng))).toEqual(reference);
  });

  it('does not mutate its input', () => {
    const hand: readonly CardCode[] = Object.freeze(['KD', 'AS', 'X1']);
    sortHand(hand);
    expect(hand).toEqual(['KD', 'AS', 'X1']);
  });
});
