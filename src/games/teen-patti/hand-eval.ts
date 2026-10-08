/**
 * Teen Patti three-card hand evaluation (pure, no state).
 *
 * Ranking, strongest first (docs/RULES_DECISIONS.md):
 *   Trail (three of a kind) > Pure sequence (straight flush) > Sequence (straight)
 *   > Colour (flush) > Pair > High card.
 * Sequence order: A-K-Q is the highest, A-2-3 the second highest, then
 * K-Q-J, Q-J-10 … down to 4-3-2. Sequences never wrap (K-A-2 is not one).
 * Within a category hands compare card by card from the highest (Ace high);
 * suits never break ties.
 */
import {
  type CardCode,
  type Rank,
  RANKS,
  RANK_NAMES,
  SUITS,
  SUIT_NAMES,
  card,
  isCardCode,
  isJoker,
  rankNumberAceHigh,
  suitOf,
} from '@/games/core/cards';

export type HandCategory = 'trail' | 'pure-sequence' | 'sequence' | 'colour' | 'pair' | 'high-card';

/** Categories from weakest to strongest (index = strength). */
export const CATEGORY_ORDER: readonly HandCategory[] = [
  'high-card',
  'pair',
  'colour',
  'sequence',
  'pure-sequence',
  'trail',
];

/** Friendly category names for the UI. */
export const CATEGORY_LABELS: Record<HandCategory, string> = {
  trail: 'Trail',
  'pure-sequence': 'Pure sequence',
  sequence: 'Sequence',
  colour: 'Colour',
  pair: 'Pair',
  'high-card': 'High card',
};

export interface HandRank {
  category: HandCategory;
  /**
   * Tie-break values, compared left to right (higher wins). Ace = 14.
   * trail: [rank]; sequences: [sequence strength] (A-K-Q = 15, A-2-3 = 14,
   * otherwise the top card); colour / high-card: the three ranks high → low;
   * pair: [pair rank, odd card].
   */
  values: number[];
  /** Plain-English name, e.g. "Trail of Kings", "Pair of Sevens". */
  name: string;
}

/** How a comparison between two hands was decided. */
export type HandDecider =
  /** Different categories (e.g. a Pair beats a High card). */
  | 'category'
  /** Same category, decided by the main rank (trail, sequence or pair rank). */
  | 'rank'
  /** Same category (high card / colour), decided by the highest card. */
  | 'high-card'
  /** Same category and same main rank, decided by a lower ("kicker") card. */
  | 'kicker'
  /** Exactly equal hands. */
  | 'tie';

const A_K_Q = 15;
const A_2_3 = 14;

const RANK_BY_VALUE: Record<number, Rank> = {};
for (const r of RANKS) RANK_BY_VALUE[rankNumberAceHigh(card(r, 'S'))] = r;

const PLURALS: Record<Rank, string> = {
  A: 'Aces',
  '2': 'Twos',
  '3': 'Threes',
  '4': 'Fours',
  '5': 'Fives',
  '6': 'Sixes',
  '7': 'Sevens',
  '8': 'Eights',
  '9': 'Nines',
  T: 'Tens',
  J: 'Jacks',
  Q: 'Queens',
  K: 'Kings',
};

function rankName(value: number): string {
  const r = RANK_BY_VALUE[value];
  return r ? RANK_NAMES[r] : String(value);
}

function rankPlural(value: number): string {
  const r = RANK_BY_VALUE[value];
  return r ? PLURALS[r] : String(value);
}

interface Evaluated {
  category: HandCategory;
  values: number[];
}

/**
 * Core evaluation from three Ace-high rank values (sorted high → low) and
 * whether all three cards share a suit.
 */
function evaluateSorted(a: number, b: number, c: number, flush: boolean): Evaluated {
  if (a === b && b === c) return { category: 'trail', values: [a] };
  let seq = 0;
  if (a === 14 && b === 13 && c === 12) seq = A_K_Q;
  else if (a === 14 && b === 3 && c === 2) seq = A_2_3;
  else if (a - b === 1 && b - c === 1) seq = a;
  if (seq > 0) return { category: flush ? 'pure-sequence' : 'sequence', values: [seq] };
  if (flush) return { category: 'colour', values: [a, b, c] };
  if (a === b) return { category: 'pair', values: [a, c] };
  if (b === c) return { category: 'pair', values: [b, a] };
  return { category: 'high-card', values: [a, b, c] };
}

function sequenceWords(seq: number): string {
  if (seq === A_K_Q) return 'Ace-King-Queen';
  if (seq === A_2_3) return 'Ace-Two-Three';
  return `${rankName(seq)}-${rankName(seq - 1)}-${rankName(seq - 2)}`;
}

function nameOf(e: Evaluated, suit: string): string {
  const [v0 = 0] = e.values;
  switch (e.category) {
    case 'trail':
      return `Trail of ${rankPlural(v0)}`;
    case 'pure-sequence':
      return `Pure sequence, ${sequenceWords(v0)}`;
    case 'sequence':
      return `Sequence, ${sequenceWords(v0)}`;
    case 'colour':
      return `Colour (all ${suit}), ${rankName(v0)} high`;
    case 'pair':
      return `Pair of ${rankPlural(v0)}`;
    case 'high-card':
      return `High card, ${rankName(v0)}`;
  }
}

function assertThreeCards(cards: readonly CardCode[]): void {
  if (cards.length !== 3) {
    throw new Error(`A Teen Patti hand has exactly 3 cards (got ${cards.length})`);
  }
  for (const c of cards) {
    if (!isCardCode(c) || isJoker(c)) throw new Error(`Invalid Teen Patti card: ${c}`);
  }
  if (new Set(cards).size !== 3) throw new Error(`Duplicate card in hand: ${cards.join(' ')}`);
}

/** Rank a three-card hand. Throws on anything other than 3 distinct standard cards. */
export function rankHand(cards: readonly CardCode[]): HandRank {
  assertThreeCards(cards);
  const vals = cards.map(rankNumberAceHigh).sort((x, y) => y - x);
  const suits = cards.map(suitOf);
  const flush = suits[0] === suits[1] && suits[1] === suits[2];
  const e = evaluateSorted(vals[0] ?? 0, vals[1] ?? 0, vals[2] ?? 0, flush);
  const suit = SUIT_NAMES[suits[0] ?? 'S'];
  return { category: e.category, values: e.values, name: nameOf(e, suit) };
}

function isHandRank(h: readonly CardCode[] | HandRank): h is HandRank {
  return !Array.isArray(h) && typeof (h as HandRank).category === 'string';
}

function toRank(h: readonly CardCode[] | HandRank): HandRank {
  return isHandRank(h) ? h : rankHand(h);
}

/**
 * Compare two hands (cards or already-ranked). Positive when `a` is stronger,
 * negative when `b` is stronger, 0 when they are exactly equal.
 */
export function compareHands(
  a: readonly CardCode[] | HandRank,
  b: readonly CardCode[] | HandRank,
): number {
  const ra = toRank(a);
  const rb = toRank(b);
  const cd = CATEGORY_ORDER.indexOf(ra.category) - CATEGORY_ORDER.indexOf(rb.category);
  if (cd !== 0) return cd;
  const n = Math.max(ra.values.length, rb.values.length);
  for (let i = 0; i < n; i++) {
    const d = (ra.values[i] ?? 0) - (rb.values[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Explain how the comparison between two hands was decided, plus the index
 * of the tie-break value that decided it (null for category wins and ties).
 */
export function handDecider(
  a: readonly CardCode[] | HandRank,
  b: readonly CardCode[] | HandRank,
): { decider: HandDecider; index: number | null; lastCard: boolean } {
  const ra = toRank(a);
  const rb = toRank(b);
  if (ra.category !== rb.category) return { decider: 'category', index: null, lastCard: false };
  for (let i = 0; i < ra.values.length; i++) {
    if ((ra.values[i] ?? 0) !== (rb.values[i] ?? 0)) {
      const cardByCard = ra.category === 'high-card' || ra.category === 'colour';
      const decider: HandDecider = i === 0 ? (cardByCard ? 'high-card' : 'rank') : 'kicker';
      return { decider, index: i, lastCard: ra.values.length > 1 && i === ra.values.length - 1 };
    }
  }
  return { decider: 'tie', index: null, lastCard: false };
}

/** A single comparable integer for a hand (higher = stronger). */
export function handScore(h: readonly CardCode[] | HandRank): number {
  const r = toRank(h);
  return scoreOf(r.category, r.values);
}

function scoreOf(category: HandCategory, values: readonly number[]): number {
  return (
    CATEGORY_ORDER.indexOf(category) * 4096 +
    (values[0] ?? 0) * 256 +
    (values[1] ?? 0) * 16 +
    (values[2] ?? 0)
  );
}

/** Sorted scores of all C(52,3) = 22,100 possible hands, built on first use. */
let allScores: Int32Array | null = null;

function scoreTable(): Int32Array {
  if (allScores) return allScores;
  const deck: { v: number; s: number }[] = [];
  SUITS.forEach((s, si) => {
    for (const r of RANKS) deck.push({ v: rankNumberAceHigh(card(r, s)), s: si });
  });
  const scores = new Int32Array(22100);
  let k = 0;
  for (let i = 0; i < deck.length; i++) {
    for (let j = i + 1; j < deck.length; j++) {
      for (let m = j + 1; m < deck.length; m++) {
        const x = deck[i];
        const y = deck[j];
        const z = deck[m];
        if (!x || !y || !z) continue;
        const sorted = [x.v, y.v, z.v].sort((p, q) => q - p);
        const e = evaluateSorted(
          sorted[0] ?? 0,
          sorted[1] ?? 0,
          sorted[2] ?? 0,
          x.s === y.s && y.s === z.s,
        );
        scores[k++] = scoreOf(e.category, e.values);
      }
    }
  }
  scores.sort();
  allScores = scores;
  return scores;
}

function lowerBound(arr: Int32Array, x: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((arr[mid] ?? 0) < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Probability (0–1) that this hand beats one random three-card hand from a
 * full deck (ties count half). Uses only the hand itself — safe for bots.
 */
export function handStrength(h: readonly CardCode[] | HandRank): number {
  const table = scoreTable();
  const s = handScore(h);
  const below = lowerBound(table, s);
  const upTo = lowerBound(table, s + 1);
  return (below + (upTo - below) / 2) / table.length;
}

/** How many of the 22,100 possible hands fall in each category (for tests and lessons). */
export function categoryCounts(): Record<HandCategory, number> {
  const out: Record<HandCategory, number> = {
    trail: 0,
    'pure-sequence': 0,
    sequence: 0,
    colour: 0,
    pair: 0,
    'high-card': 0,
  };
  for (const s of scoreTable()) {
    const cat = CATEGORY_ORDER[Math.floor(s / 4096)];
    if (cat) out[cat]++;
  }
  return out;
}
