/**
 * Adversarial rules audit for Indian Rummy (docs/RULES_DECISIONS.md → Indian Rummy,
 * docs/engine-notes/indian-rummy.md and the standard 13-card points-rummy rules).
 *
 * Every block names the rule it pins down and is written so that it fails if the engine gets
 * that rule wrong. The meld checks are compared against a second, independently written
 * brute-force validator (below) as well as hand-made positions with known answers.
 */
import { describe, expect, it } from 'vitest';
import { type CardCode, type Rank, cardShort } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import { IllegalMoveError } from '@/games/core/types';
import engine, {
  FIRST_DROP_POINTS,
  MAX_LOSS_UNITS,
  MIDDLE_DROP_POINTS,
  type IndianRummyMove,
  type IndianRummyState,
  bestArrangement,
  cardPoints,
  deadwoodOf,
  declareProblem,
  fullDeck,
  isJokerFor,
  isValidHand,
  wildRankFor,
} from './engine';
import { canDeclareAfterOneDiscard } from './melds';
import { completesGroup } from './strategy';
import { buildState, cards } from './test-helpers';

// --------------------------------------------------- independent validator

const ORDER = 'A23456789TJQK';

interface Card {
  printed: boolean;
  wild: boolean;
  place: number; // 1..13 (Ace = 1)
  suit: string;
  points: number;
}

function info(code: CardCode, wild: Rank): Card {
  if (code === 'X1' || code === 'X2') {
    return { printed: true, wild: false, place: 0, suit: '', points: 0 };
  }
  const place = ORDER.indexOf(code[0] ?? '') + 1;
  const isWild = code[0] === wild;
  const points = isWild ? 0 : place === 1 || place >= 10 ? 10 : place;
  return { printed: false, wild: isWild, place, suit: code[1] ?? '', points };
}

/**
 * What a concrete group of cards can be. Written from the rules, not from melds.ts: try every
 * way of letting the wild-rank cards play themselves or act as jokers, every Ace high/low, and
 * look for a window of `size` consecutive places (1..14, no wrap) that holds the naturals.
 */
function kinds(group: readonly Card[]): { set: boolean; seq: boolean; pure: boolean } {
  const out = { set: false, seq: false, pure: false };
  const size = group.length;
  if (size < 3) return out;
  const flexible = group.filter((c) => c.wild);
  const fixed = group.filter((c) => !c.wild && !c.printed);
  for (let pick = 0; pick < 1 << flexible.length; pick++) {
    const naturals = [...fixed, ...flexible.filter((_, i) => pick & (1 << i))];
    if (!naturals.length) continue; // a group needs at least one card playing itself
    const jokers = size - naturals.length;
    const first = naturals[0] as Card;
    if (
      size <= 4 &&
      naturals.every((c) => c.place === first.place) &&
      new Set(naturals.map((c) => c.suit)).size === naturals.length
    ) {
      out.set = true;
    }
    if (size > 13 || !naturals.every((c) => c.suit === first.suit)) continue;
    const aces = naturals.filter((c) => c.place === 1).length;
    for (let hi = 0; hi < 1 << aces; hi++) {
      let a = 0;
      const places = naturals.map((c) => (c.place !== 1 ? c.place : hi & (1 << a++) ? 14 : 1));
      if (new Set(places).size !== places.length) continue;
      for (let start = 1; start + size - 1 <= 14; start++) {
        if (places.every((p) => p >= start && p < start + size)) {
          out.seq = true;
          if (jokers === 0) out.pure = true;
        }
      }
    }
  }
  return out;
}

interface Verdict {
  valid: boolean;
  deadwood: number;
}

/** Exact evaluation by explicit group enumeration and exact cover (slow, simple). */
function judge(hand: readonly CardCode[], wild: Rank): Verdict {
  const cs = hand.map((c) => info(c, wild));
  const n = cs.length;
  const compatible = (a: Card, b: Card) =>
    a.printed || b.printed || a.wild || b.wild || a.place === b.place || a.suit === b.suit;
  // Every group (as a bit mask) that is a set or a sequence, by its lowest card.
  const groups: { mask: number; pure: boolean; seq: boolean }[][] = Array.from(
    { length: n },
    () => [],
  );
  const grow = (low: number, members: number[], next: number) => {
    if (members.length >= 3) {
      const k = kinds(members.map((i) => cs[i] as Card));
      if (k.set || k.seq) {
        const mask = members.reduce((m, i) => m | (1 << i), 0);
        groups[low]?.push({ mask, pure: k.pure, seq: k.seq });
      }
    }
    if (members.length === 13) return;
    for (let j = next; j < n; j++) {
      const c = cs[j] as Card;
      if (members.every((i) => compatible(cs[i] as Card, c))) grow(low, [...members, j], j + 1);
    }
  };
  for (let i = 0; i < n; i++) grow(i, [i], i + 1);
  // best[mask][pure][min(seqs,2)] = fewest points left ungrouped.
  const memo = new Map<number, number[]>();
  const solve = (mask: number): number[] => {
    const hit = memo.get(mask);
    if (hit) return hit;
    const best = [Infinity, Infinity, Infinity, Infinity, Infinity, Infinity];
    if (mask === 0) best[0] = 0;
    else {
      const low = 31 - Math.clz32(mask & -mask);
      const take = (sub: number[], cost: number, pure: boolean, seq: boolean) => {
        for (let cell = 0; cell < 6; cell++) {
          const v = (sub[cell] ?? Infinity) + cost;
          const p = pure || cell >= 3 ? 1 : 0;
          const q = Math.min(2, (cell % 3) + (seq ? 1 : 0));
          const to = p * 3 + q;
          if (v < (best[to] ?? Infinity)) best[to] = v;
        }
      };
      take(solve(mask & ~(1 << low)), (cs[low] as Card).points, false, false);
      for (const g of groups[low] ?? []) {
        if ((g.mask & mask) === g.mask) take(solve(mask & ~g.mask), 0, g.pure, g.seq);
      }
    }
    memo.set(mask, best);
    return best;
  };
  const best = solve((1 << n) - 1);
  const withPure = Math.min(best[3] ?? Infinity, best[4] ?? Infinity, best[5] ?? Infinity);
  const total = cs.reduce((a, c) => a + c.points, 0);
  return {
    valid: best[5] === 0,
    deadwood: Math.min(80, Number.isFinite(withPure) ? withPure : total),
  };
}

/** Hands rich in groups: a few suits, a band of ranks, lots of jokers and duplicates. */
function richHand(
  rng: ReturnType<typeof createRng>,
  size: number,
): { hand: CardCode[]; wild: Rank } {
  const wild = ORDER[rng.int(13)] as Rank;
  const suits = 'SHDC'.slice(0, 1 + rng.int(3));
  const lo = rng.int(13);
  const width = 4 + rng.int(6);
  const pool = shuffle(fullDeck(), rng).filter((c) => {
    if (c === 'X1' || c === 'X2') return true;
    if (c[0] === wild) return rng.next() < 0.6;
    const place = ORDER.indexOf(c[0] ?? '');
    const near = Math.min(
      Math.abs(place - lo),
      Math.abs(place + 13 - lo),
      Math.abs(place - 13 - lo),
    );
    return (suits.includes(c[1] ?? '') && near <= width) || rng.next() < 0.08;
  });
  const hand = pool.length >= size ? pool.slice(0, size) : shuffle(fullDeck(), rng).slice(0, size);
  return { hand, wild };
}

// ----------------------------------------------------------------- helpers

const STOCK: IndianRummyMove = { type: 'draw', from: 'stock' };
const OPEN: IndianRummyMove = { type: 'draw', from: 'discard' };
const DROP: IndianRummyMove = { type: 'drop' };
const discard = (card: CardCode): IndianRummyMove => ({ type: 'discard', card });
const declare = (card: CardCode): IndianRummyMove => ({ type: 'declare', discard: card });
function play(s: IndianRummyState, ...moves: IndianRummyMove[]): IndianRummyState {
  return moves.reduce((st, m) => engine.applyMove(st, m), s);
}
const valid = (list: string, wild: Rank = '7') => isValidHand(cards(list), wild);
const kindOf = (list: string, wild: Rank = '7') => {
  const groups = bestArrangement(cards(list), wild).groups;
  return groups.length === 1 ? groups[0]?.kind : groups.map((g) => g.kind).join('+');
};

/**
 * The naturals of a displayed sequence sit at consecutive places (low → high, no wrap). A
 * sequence made only of jokers is anchored by a wild-rank card playing itself.
 */
function displayedInOrder(seq: readonly CardCode[], wild: Rank): boolean {
  const len = seq.length;
  const at = (c: CardCode, i: number) => ({ i, place: ORDER.indexOf(c[0] ?? '') + 1 });
  const fits = (fixed: { i: number; place: number }[]) => {
    for (let start = 1; start + len - 1 <= 14; start++) {
      const ok = fixed.every(
        ({ i, place }) => start + i === place || (place === 1 && start + i === 14),
      );
      if (ok) return true;
    }
    return false;
  };
  const fixed = seq.flatMap((c, i) => (isJokerFor(c, wild) ? [] : [at(c, i)]));
  if (fixed.length) return fits(fixed);
  return seq.some((c, i) => c !== 'X1' && c !== 'X2' && fits([at(c, i)]));
}

// Seat 1 hands that never interfere with the positions below.
/** Pure 3♣4♣5♣, set 8♥8♦8♠ and 57 points of loose cards. */
const LOOSE = cards('3C 4C 5C 8H 8D 8S AS KD QH JC 9D 6H 2S');
/** 4♠5♠6♠ · 9♥10♥J♥ · K♠K♦K♣ · 2♥2♣2♦ + a loose 8♣ (a Q♥ completes it). */
const ALMOST = cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C 2D 8C');
/** Two pure sequences, two sets and one loose 2♠: 2 points. */
const CLOSE = cards('3C 4C 5C 8H 8D 8S AS AD AH 9D TD JD 2S');

// =================================================================== deck

describe('rule: two decks plus two printed jokers, 13 cards each', () => {
  it('the pack is 106 cards: every standard card twice and the two printed jokers', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(106);
    const counts = new Map<string, number>();
    for (const c of deck) counts.set(c, (counts.get(c) ?? 0) + 1);
    expect(counts.get('X1')).toBe(1);
    expect(counts.get('X2')).toBe(1);
    for (const r of ORDER) for (const s of 'SHDC') expect(counts.get(`${r}${s}`)).toBe(2);
  });

  it('deals one card at a time from the dealer’s left, then the wild-joker card, then the open card', () => {
    for (const players of [2, 3, 6]) {
      const dealer = players - 1;
      const seed = `audit-deal-${players}`;
      const s = engine.setup({ players, options: { dealer } }, createRng(seed));
      const deck = shuffle(fullDeck(), createRng(seed));
      const dealt: CardCode[][] = Array.from({ length: players }, () => []);
      for (let k = 0; k < players * 13; k++) {
        dealt[(dealer + 1 + (k % players)) % players]?.push(deck[k] as CardCode);
      }
      s.hands.forEach((h, seat) => expect(h.slice().sort()).toEqual(dealt[seat]?.sort()));
      expect(s.wildCard).toBe(deck[players * 13]);
      expect(s.discard).toEqual([deck[players * 13 + 1]]);
      // The rest is the closed stock; the next card drawn is its last element.
      expect(s.stock).toEqual(deck.slice(players * 13 + 2));
      expect(s.turn).toBe(0); // the seat on the dealer's left plays first
      expect(s.phase).toBe('draw');
    }
  });

  it('accepts 2–6 players only', () => {
    for (const players of [1, 7, 2.5]) {
      expect(() => engine.setup({ players }, createRng('n'))).toThrow(RangeError);
    }
    for (const players of [2, 3, 4, 5, 6]) {
      expect(engine.setup({ players }, createRng('n')).hands).toHaveLength(players);
    }
  });
});

// ================================================================= jokers

describe('rule: the wild-joker card makes its rank wild (Aces when it is a printed joker)', () => {
  it('every suit of the wild rank is a joker worth 0; other ranks are not', () => {
    expect(wildRankFor('4H')).toBe('4');
    for (const s of 'SHDC') {
      expect(isJokerFor(`4${s}` as CardCode, '4')).toBe(true);
      expect(cardPoints(`4${s}` as CardCode, '4')).toBe(0);
    }
    expect(isJokerFor('5H', '4')).toBe(false);
    expect(isJokerFor('AH', '4')).toBe(false); // Aces are wild only for a printed joker
    expect(cardPoints('AH', '4')).toBe(10);
  });

  it('a printed joker turned up makes all Aces wild (and worth 0)', () => {
    expect(wildRankFor('X1')).toBe('A');
    expect(wildRankFor('X2')).toBe('A');
    expect(isJokerFor('AS', 'A')).toBe(true);
    expect(cardPoints('AS', 'A')).toBe(0);
    // A♠ now fills a gap: 4♥ A♠ 6♥ is an (impure) sequence.
    expect(kindOf('4H AS 6H', 'A')).toBe('sequence');
    // An Ace in its own place keeps a run pure: Q♦ K♦ A♦.
    expect(kindOf('QD KD AD', 'A')).toBe('pure-sequence');
  });

  it('nobody may take the wild-joker card — in either half of the turn', () => {
    const s = buildState({ hands: [ALMOST, LOOSE], wildCard: '7C' });
    const wild: IndianRummyMove = { type: 'draw', from: 'wild' };
    expect(engine.legalMoves(s, 0).map(engine.moveKey)).not.toContain('draw:wild');
    expect(engine.checkMove(s, 0, wild).reason).toMatch(/nobody can take it/);
    expect(() => engine.applyMove(s, wild)).toThrow(IllegalMoveError);
    const after = play(s, STOCK);
    expect(engine.checkMove(after, 0, wild).ok).toBe(false);
    // The card is out of play: not in any hand, pile or stock.
    expect([...s.stock, ...s.discard, ...s.hands.flat()].filter((c) => c === '7C')).toHaveLength(
      1, // the other 7♣ of the second deck
    );
  });

  it('jokers thrown onto the open pile may be picked up', () => {
    const s = buildState({ hands: [ALMOST, LOOSE], wildCard: '7C', discard: ['2S', '7H'] });
    expect(engine.checkMove(s, 0, OPEN)).toEqual({ ok: true });
    expect(play(s, OPEN).hands[0]).toContain('7H');
  });
});

// ================================================================== turns

describe('rule: a turn is draw one (stock or open pile), then discard one — or declare', () => {
  const s = buildState({
    hands: [ALMOST, LOOSE],
    wildCard: '7C',
    discard: ['KH', '3D'],
    stockTop: ['QH'],
  });

  it('draws the top card of the chosen pile', () => {
    expect(play(s, STOCK).hands[0]?.slice(-1)).toEqual(['QH']);
    expect(play(s, OPEN).hands[0]?.slice(-1)).toEqual(['3D']);
    expect(play(s, OPEN).discard).toEqual(['KH']);
  });

  it('one draw per turn, then a discard; you may not discard or declare before drawing', () => {
    expect(engine.checkMove(s, 0, discard('8C')).ok).toBe(false);
    expect(engine.checkMove(s, 0, declare('8C')).ok).toBe(false);
    const after = play(s, STOCK);
    expect(engine.checkMove(after, 0, STOCK).ok).toBe(false);
    expect(engine.checkMove(after, 0, OPEN).ok).toBe(false);
    expect(
      engine.legalMoves(after, 0).every((m) => m.type === 'discard' || m.type === 'declare'),
    ).toBe(true);
  });

  it('the discard goes face up on the open pile and play passes to the left', () => {
    const three = buildState({ hands: [ALMOST, LOOSE, CLOSE], wildCard: '7C', stockTop: ['3H'] });
    const next = play(three, STOCK, discard('3H'));
    expect(next.discard.slice(-1)).toEqual(['3H']);
    expect(next.turn).toBe(1);
    expect(play(next, STOCK, discard(next.stock[next.stock.length - 1] as CardCode)).turn).toBe(2);
  });

  it('you may throw back the card you just took from the open pile (no house rule against it)', () => {
    const took = play(s, OPEN);
    expect(engine.checkMove(took, 0, discard('3D'))).toEqual({ ok: true });
  });
});

// ================================================================= groups

describe('rule: sequences — 3+ in a row in one suit; Ace low or high, never wrapping', () => {
  it('a run in one suit is a pure sequence; mixed suits are not a sequence', () => {
    expect(kindOf('4H 5H 6H')).toBe('pure-sequence');
    expect(kindOf('5H 6H 7D 8H')).toBe('sequence'); // the 7♦ stands in for the 7♥
    expect(kindOf('4H 5H 6H', '9')).toBe('pure-sequence');
    expect(kindOf('4H 5S 6H')).not.toBe('pure-sequence');
    expect(kindOf('4H 5H')).toBe('unmatched');
  });

  it('A-2-3 and Q-K-A are sequences; K-A-2 is not — not even with a joker', () => {
    expect(kindOf('AS 2S 3S')).toBe('pure-sequence');
    expect(kindOf('QS KS AS')).toBe('pure-sequence');
    expect(kindOf('KS AS 2S')).toBe('unmatched');
    // K♠ 2♠ + joker could only be K-A-2 (a wrap): not a group.
    expect(kindOf('KS 2S X1')).toBe('unmatched');
    // …but K♠ A♠ + joker is Q-K-A and A♠ 2♠ + joker is A-2-3.
    expect(kindOf('KS AS X1')).toBe('sequence');
    expect(kindOf('AS 2S X1')).toBe('sequence');
  });

  it('runs of any length, Ace low or high; a run never wraps past the Ace', () => {
    expect(kindOf('TH JH QH KH AH', '5')).toBe('pure-sequence');
    expect(kindOf('AH 2H 3H 4H 5H', '9')).toBe('pure-sequence');
    expect(kindOf('AH 2H 3H 4H 6H 7H 8H', '5')).toBe('pure-sequence+pure-sequence');
    expect(kindOf('AH 2H 3H 4H 6H 7H 8H', '9')).toBe('pure-sequence+pure-sequence');
    // All 13 Hearts A…K (the 5♥ is wild) is a declaration on its own: two runs, both pure-able.
    expect(valid('AH 2H 3H 4H 5H 6H 7H 8H 9H TH JH QH KH', '5')).toBe(true);
    // Q-K-A-2-3 is not one run: only one of its two halves can be grouped.
    const wrap = bestArrangement(cards('QH KH AH 2H 3H'), '5');
    expect(wrap.groups.map((g) => g.cards.length).sort()).toEqual([2, 3]);
    // A…K plus a second Ace (14 places) is never a single group.
    const both = bestArrangement(cards('AH 2H 3H 4H 5H 6H 7H 8H 9H TH JH QH KH AH'), '5');
    expect(both.groups.every((g) => g.cards.length <= 13)).toBe(true);
  });

  it('a wild-rank card in its own natural place keeps a sequence pure', () => {
    expect(kindOf('6S 7S 8S')).toBe('pure-sequence');
    expect(kindOf('6S 7D 8S')).toBe('sequence');
    // Two copies of a card never sit in one run.
    expect(kindOf('6S 6S 7S')).not.toBe('pure-sequence');
  });

  it('jokers fill gaps or ends: one natural card and two jokers make a sequence', () => {
    expect(kindOf('9H X1 JH')).toBe('sequence');
    expect(kindOf('9H TH X2')).toBe('sequence');
    expect(kindOf('9H X1 X2')).toBe('sequence');
    expect(kindOf('9H 7S X2')).toBe('sequence');
  });
});

describe('rule: sets — 3 or 4 cards of one rank, all in different suits', () => {
  it('three or four suits make a set; two of one suit never do', () => {
    expect(kindOf('9H 9D 9C')).toBe('set');
    expect(kindOf('9H 9D 9C 9S')).toBe('set');
    expect(kindOf('9H 9H 9C')).toBe('unmatched');
    expect(kindOf('9H 9D')).toBe('unmatched');
  });

  it('a joker may replace a missing suit, but not a repeated one', () => {
    expect(kindOf('9H 9D 7S')).toBe('set');
    expect(kindOf('9H 9D X1')).toBe('set');
    expect(kindOf('9H 9H X1')).toBe('unmatched');
  });

  it('a set holds at most four cards, so five 9s never form one group', () => {
    const a = bestArrangement(cards('9H 9D 9C 9S 9H'), '7');
    expect(a.groups.find((g) => g.kind === 'set')?.cards).toHaveLength(4);
    expect(a.groups.find((g) => g.kind === 'unmatched')?.cards).toEqual(['9H']);
  });
});

describe('rule: a declaration needs all 13 cards grouped, two sequences, one of them pure', () => {
  it('two pure sequences and two sets: valid', () => {
    expect(valid('4S 5S 6S 9H TH JH QH KS KD KC 2H 2C 2D')).toBe(true);
  });

  it('one pure and one impure sequence: valid; two impure sequences: not valid', () => {
    expect(valid('4S 5S 6S 9H TH 7D QH KS KD KC 2H 2C 2D')).toBe(true);
    expect(valid('4S 7C 6S 9H TH 7D QH KS KD KC 2H 2C 2D')).toBe(false);
    expect(declareProblem(cards('4S 7C 6S 9H TH 7D QH KS KD KC 2H 2C 2D'), '7')).toMatch(
      /need at least one pure sequence/,
    );
  });

  it('a pure sequence with only sets beside it is not enough (sets are not sequences)', () => {
    const hand = cards('4S 5S 6S KS KD KC KH 2H 2C 2D 9H 9D 9C');
    expect(isValidHand(hand, '7')).toBe(false);
    expect(declareProblem(hand, '7')).toMatch(/need a second sequence/);
  });

  it('every card must be grouped — a single loose card blocks the declaration and is named', () => {
    const hand = cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C 2D 8C');
    expect(isValidHand(hand, '7')).toBe(false);
    expect(declareProblem(hand, '7')).toMatch(
      /one card doesn’t fit into any set or sequence yet: 8♣\./,
    );
  });

  it('spare jokers are absorbed, and three jokers including a wild card count as a sequence', () => {
    // Pure 4♠5♠6♠ + two sets: the jokers-only group X1 X2 7♦ is the second sequence.
    expect(valid('4S 5S 6S 9H 9D 9C KS KD KC KH X1 X2 7D')).toBe(true);
    // Without it there is only one sequence.
    expect(valid('4S 5S 6S 9H 9D 9C KS KD KC KH 9S 2H 2D')).toBe(false);
    // 4♠5♠6♠ + three sets + X1: the spare joker joins the run (it stays a sequence).
    expect(valid('4S 5S 6S 9H 9D 9C KS KD KC 2H 2C 2D X1')).toBe(false); // only one sequence
    expect(valid('4S 5S 6S 9H TH JH QH KS KD KC 2H 2C X1')).toBe(true);
  });

  it('the meld solver agrees with an independent brute-force validator on rich hands', () => {
    const rng = createRng('audit-melds');
    let validSeen = 0;
    for (let i = 0; i < 260; i++) {
      const { hand, wild } = richHand(rng, 13);
      const ref = judge(hand, wild);
      const got = { valid: isValidHand(hand, wild), deadwood: deadwoodOf(hand, wild) };
      if (got.valid !== ref.valid || got.deadwood !== ref.deadwood) {
        throw new Error(`${hand.join(' ')} (wild ${wild}): ${JSON.stringify({ got, ref })}`);
      }
      expect(declareProblem(hand, wild) === null).toBe(ref.valid);
      if (ref.valid) validSeen++;
    }
    expect(validSeen).toBeGreaterThan(10);
  });

  it('“can declare after one discard” agrees with trying all 14 discards independently', () => {
    const rng = createRng('audit-14');
    let yes = 0;
    for (let i = 0; i < 70; i++) {
      const { hand, wild } = richHand(rng, 14);
      const any = hand.some(
        (_, k) => judge([...hand.slice(0, k), ...hand.slice(k + 1)], wild).valid,
      );
      expect(canDeclareAfterOneDiscard(hand, wild)).toBe(any);
      if (any) yes++;
    }
    expect(yes).toBeGreaterThan(3);
  });
});

describe('displayed arrangement (for the board)', () => {
  it('shows every sequence low → high with jokers where they stand in — never past an Ace', () => {
    // Aces are wild: the two spare Aces must sit below Q♥ K♥ A♥, not after the Ace.
    const aces = bestArrangement(cards('AH AH 2H 3H QH KH AS AS 2S 3S QS KS AD 2D'), 'A');
    expect(aces.valid).toBe(true);
    for (const g of aces.groups) {
      if (g.kind === 'sequence' || g.kind === 'pure-sequence') {
        expect(displayedInOrder(g.cards, 'A'), g.cards.join(' ')).toBe(true);
      }
    }
    // A wild King anchoring a jokers-only sequence can only be Q-K-A or J-Q-K, never K-A-2.
    const kings = bestArrangement(cards('KS X1 X2 4H 5H 6H 9D TD JD 2C 2S 2H 2D'), 'K');
    expect(kings.valid).toBe(true);
    const anchored = kings.groups.find((g) => g.cards.includes('KS'));
    expect(anchored?.kind).toBe('sequence');
    expect(displayedInOrder(anchored?.cards ?? [], 'K')).toBe(true);
  });

  it('every displayed group is what its label says and the groups use each card once', () => {
    const rng = createRng('audit-display');
    for (let i = 0; i < 300; i++) {
      const { hand, wild } = richHand(rng, 13 + (i % 2));
      const a = bestArrangement(hand, wild);
      expect(a.groups.flatMap((g) => g.cards).sort()).toEqual(hand.slice().sort());
      for (const g of a.groups) {
        if (g.kind === 'unmatched') continue;
        const k = kinds(g.cards.map((c) => info(c, wild)));
        const ok = g.kind === 'set' ? k.set : g.kind === 'sequence' ? k.seq : k.pure;
        expect(ok, `${g.kind} ${g.cards.join(' ')} (wild ${wild})`).toBe(true);
        if (g.kind !== 'set') {
          expect(displayedInOrder(g.cards, wild), `${g.cards.join(' ')} (wild ${wild})`).toBe(true);
        }
      }
    }
  });
});

// ================================================================ scoring

describe('rule: losers pay their deadwood — 10 for A K Q J 10, face value, jokers 0, cap 80', () => {
  it('card values', () => {
    for (const c of ['AS', 'KS', 'QS', 'JS', 'TS'] as CardCode[])
      expect(cardPoints(c, '7')).toBe(10);
    for (let r = 2; r <= 9; r++) {
      const c = `${ORDER[r - 1]}H` as CardCode;
      expect(cardPoints(c, r === 7 ? '8' : '7')).toBe(r);
    }
    expect(cardPoints('X1', '7')).toBe(0);
    expect(cardPoints('7H', '7')).toBe(0);
  });

  it('with a pure sequence only the ungrouped cards count; without one every card counts', () => {
    // Pure 3♣4♣5♣ + set of 8s; loose A♠ K♦ Q♥ J♣ 9♦ 6♥ 2♠ = 57.
    expect(deadwoodOf(LOOSE, '7')).toBe(57);
    // Same cards but the run broken (3♣ → 3♦): no pure sequence, so all 13 count (capped 80).
    expect(deadwoodOf(cards('3D 4C 5C 8H 8D 8S AS KD QH JC 9D 6H 2S'), '7')).toBe(80);
    // No pure sequence, total under the cap: 75, not just the loose cards.
    const noPure = cards('9S QS 7H 9H JH 7D TD 2D 6D JC 3C 2H 4S');
    expect(deadwoodOf(noPure, '7')).toBe(75);
  });

  it('chooses the arrangement that leaves the fewest points', () => {
    // 5♥6♥7♥ (pure) + 7♥ could also join a set; best keeps the run and groups the 9s.
    expect(deadwoodOf(cards('5H 6H 8H 9H 9D 9C KS KD 3C 4C 2S 2D JD'), '7')).toBe(
      judge(cards('5H 6H 8H 9H 9D 9C KS KD 3C 4C 2S 2D JD'), '7').deadwood,
    );
  });

  it('the declarer collects every other player’s points; net always sums to zero', () => {
    const s = buildState({
      hands: [ALMOST, LOOSE, cards('9S QS 7H 9H JH 7D TD 2D 6D JC 3C 2H 4S')],
      wildCard: '7C',
      stockTop: ['QH'],
    });
    const over = play(s, STOCK, declare('8C'));
    expect(over.outcome?.points).toEqual([0, 57, 75]);
    expect(over.outcome?.net).toEqual([132, -57, -75]);
    expect(engine.result(over).humanNetUnits).toBe(132);
  });

  it('a losing learner pays exactly their own points and never more than 80', () => {
    const s = buildState({
      hands: [cards('3D 4C 5C 8H 8D 8S AS KD QH JC 9D 6H 2S'), ALMOST],
      wildCard: '7C',
      turn: 1,
      stockTop: ['QH'],
    });
    const r = engine.result(play(s, STOCK, declare('8C')));
    expect(r.humanNetUnits).toBe(-80);
    expect(-r.humanNetUnits).toBeLessThanOrEqual(MAX_LOSS_UNITS);
    expect(r.humanOutcome).toBe('loss');
    expect(r.flags.bust).toBe(true);
  });
});

// ================================================================== drops

describe('rule: drop before drawing — 20 before your first draw, 40 later', () => {
  it('a first drop costs 20 and with two players the other player wins it', () => {
    const s = buildState({ hands: [LOOSE, ALMOST], wildCard: '7C' });
    const over = play(s, DROP);
    expect(over.outcome).toMatchObject({
      kind: 'drop',
      winners: [1],
      points: [20, 0],
      net: [-20, 20],
    });
    const r = engine.result(over);
    expect(r.humanNetUnits).toBe(-FIRST_DROP_POINTS);
    expect(r.flags.folded).toBe(true);
  });

  it('after any draw (even from the open pile) a drop is a middle drop worth 40', () => {
    let s = buildState({ hands: [LOOSE, ALMOST], wildCard: '7C', stockTop: ['3H'] });
    s = play(s, OPEN, discard('2S'), STOCK, discard('3H'));
    expect(s.turn).toBe(0);
    const over = play(s, DROP);
    expect(over.outcome?.points[0]).toBe(MIDDLE_DROP_POINTS);
    expect(engine.result(over).humanNetUnits).toBe(-40);
  });

  it('a drop is only possible at the start of your own turn', () => {
    const s = buildState({ hands: [LOOSE, ALMOST], wildCard: '7C' });
    expect(engine.checkMove(s, 1, DROP).ok).toBe(false);
    expect(engine.checkMove(play(s, STOCK), 0, DROP).ok).toBe(false);
  });

  it('with three players play goes on; the eventual declarer collects the drop too', () => {
    const s = buildState({ hands: [LOOSE, ALMOST, CLOSE], wildCard: '7C', stockTop: ['QH'] });
    const dropped = play(s, DROP);
    expect(dropped.outcome).toBeNull();
    expect(dropped.turn).toBe(1);
    expect(engine.currentPlayer(dropped)).toBe(1);
    const over = play(dropped, STOCK, declare('8C'));
    expect(over.outcome?.points).toEqual([20, 0, 2]);
    expect(over.outcome?.net).toEqual([-20, 22, -2]);
    // The dropped learner only ever loses the drop.
    expect(engine.result(over).humanNetUnits).toBe(-20);
  });

  it('when everyone else has dropped, the last player left wins every drop', () => {
    const s = buildState({ hands: [ALMOST, LOOSE, CLOSE], wildCard: '7C', turn: 1 });
    const over = play(s, DROP, DROP);
    expect(over.outcome).toMatchObject({ kind: 'drop', winners: [0], net: [40, -20, -20] });
    expect(engine.result(over).humanOutcome).toBe('win');
  });
});

// ============================================================ stock runs out

describe('rule: when the stock runs out the open pile (except its top card) is reshuffled', () => {
  it('never leaves a player without a card to draw, and keeps all 106 cards', () => {
    const base = buildState({ hands: [ALMOST, LOOSE], wildCard: '7C' });
    const s: IndianRummyState = {
      ...base,
      stock: base.stock.slice(-1),
      discard: [...base.discard, ...base.stock.slice(0, -1)],
    };
    const after = play(s, STOCK, discard('8C'));
    expect(after.discard).toEqual(['8C']);
    expect(after.stock.length).toBe(s.discard.length);
    expect(engine.legalMoves(after, 1).map(engine.moveKey)).toEqual(
      expect.arrayContaining(['draw:stock', 'draw:discard']),
    );
    const all = [...after.hands.flat(), ...after.stock, ...after.discard, after.wildCard];
    expect(all.sort()).toEqual(fullDeck().sort());
  });

  it('a declaration on the turn that empties the stock needs no reshuffle', () => {
    const base = buildState({ hands: [ALMOST, LOOSE], wildCard: '7C', stockTop: ['QH'] });
    const s: IndianRummyState = {
      ...base,
      stock: ['QH'],
      discard: [...base.discard, ...base.stock.slice(0, -1)],
    };
    const over = play(s, STOCK, declare('8C'));
    expect(over.outcome?.kind).toBe('declare');
    expect(over.reshuffles).toBe(0);
  });
});

// ================================================================ turn cap

describe('decision: the turn cap scores every hand by deadwood (lowest wins, ties share)', () => {
  it('dropped players pay their drop to the lowest hand at the cap', () => {
    const s = buildState({
      hands: [LOOSE, CLOSE, ALMOST],
      wildCard: '7C',
      drops: [null, null, 'first'],
      maxTurns: 1,
      stockTop: ['3H'],
    });
    const over = play(s, STOCK, discard('3H'));
    expect(over.outcome).toMatchObject({ kind: 'turn-cap', winners: [1], points: [57, 2, 20] });
    expect(over.outcome?.net).toEqual([-57, 77, -20]);
  });
});

// ================================================================= results

describe('result summaries tell the truth', () => {
  it('a learner with no pure sequence is told every card counted — even under the 80 cap', () => {
    const noPure = cards('9S QS 7H 9H JH 7D TD 2D 6D JC 3C 2H 4S');
    const s = buildState({ hands: [noPure, ALMOST], wildCard: '7C', turn: 1, stockTop: ['QH'] });
    const r = engine.result(play(s, STOCK, declare('8C')));
    expect(r.humanNetUnits).toBe(-75);
    expect(r.summary).toMatch(/without a pure sequence every card counted/);
    expect(r.summary).not.toMatch(/loose cards/);
  });

  it('nobody is said to pay "0 points for their loose cards"', () => {
    // Pure 4♠5♠6♠ + three sets: every card grouped (but no second sequence) → pays 0.
    const grouped = cards('4S 5S 6S KS KD KC KH 2H 2C 2D 9H 9D 9C');
    expect(deadwoodOf(grouped, '7')).toBe(0);
    const lost = buildState({
      hands: [grouped, ALMOST],
      wildCard: '7C',
      turn: 1,
      stockTop: ['QH'],
    });
    const r = engine.result(play(lost, STOCK, declare('8C')));
    expect(r.humanNetUnits).toBe(0);
    expect(r.humanOutcome).toBe('loss');
    expect(r.summary).toMatch(/every one of your cards was in a group, so you paid nothing/);
    const won = buildState({ hands: [ALMOST, grouped], wildCard: '7C', stockTop: ['QH'] });
    const w = engine.result(play(won, STOCK, declare('8C')));
    expect(w.humanOutcome).toBe('win');
    expect(w.summary).toMatch(/Player 1 had every card in a group too, so they paid nothing/);
  });
});

// =================================================================== coach

describe('coach reasons are true for the position', () => {
  it('taking an open card that only fits with jokers is explained without an empty list', () => {
    // Wild 4s: the 4♠, 4♥ and the printed joker are this hand's jokers; the 6♦ has no partner.
    const hand = cards('4S 4H 8H TH 2C 3C 9C X1 3D KS 7C 9D JH');
    const s = buildState({ hands: [hand, LOOSE], wildCard: '4C', discard: ['6D'] });
    const c = engine.coach(s, 0);
    expect(c.suggestion).toEqual(OPEN);
    expect(c.why).toMatch(/^Take the 6♦ from the open pile/);
    expect(c.why).not.toMatch(/your ,|your \.|your and/);
    expect(c.why).toMatch(/joker/);
  });

  it('a card thrown out of a group is not described as fitting no group', () => {
    // 2♥3♥4♥5♥ is a pure sequence; the coach throws its spare end, the 2♥.
    const hand = cards('3S 5S 5S 2H 3H 4H 5H 3D 4D 5D 7D X2 9D 5H');
    const s = buildState({ hands: [hand, LOOSE], wildCard: '6C', phase: 'discard' });
    const c = engine.coach(s, 0);
    const move = c.suggestion as IndianRummyMove;
    expect(move.type).toBe('discard');
    const card = move.type === 'discard' ? move.card : 'X1';
    const loose =
      bestArrangement(hand, '6').groups.find((g) => g.kind === 'unmatched')?.cards ?? [];
    expect(loose).not.toContain(card);
    expect(c.why).not.toMatch(/doesn't fit with any of your groups/);
    expect(c.why).toMatch(new RegExp(`^Throw the ${cardShort(card)}: `));
  });

  it('declining an open card never claims it fits no group when it does make one', () => {
    // Wild 9s. The 5♥ makes a set with the 5♣ and 5♦ — but only by breaking two runs.
    const hand = cards('8H 2C 4C 5C 6C 8C 3D 4D JD QD 5D 6D 4D');
    const s = buildState({ hands: [hand, LOOSE], wildCard: '9C', discard: ['5H'] });
    expect(completesGroup(hand, '5H', '9')).toBe(true);
    const c = engine.coach(s, 0);
    expect(c.suggestion).toEqual(STOCK);
    expect(c.why).not.toMatch(/doesn't help your groups/);
  });
});
