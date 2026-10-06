/**
 * Texas Hold'em hand evaluation: the best five-card poker hand out of up to
 * seven cards (two hole cards + up to five community cards).
 *
 * Standard ranking, strongest first: straight flush (the Ace-high one is a
 * royal flush) > four of a kind > full house > flush > straight > three of a
 * kind > two pair > pair > high card. Aces are high, but also low in the
 * "wheel" straight A-2-3-4-5 (a Five-high straight). Suits never break ties.
 *
 * `evaluateHand` returns everything the UI and the coach need (category, best
 * five cards, a plain name like "Two Pair, Kings and Sevens"); `scoreIds` is a
 * fast, allocation-light path for the bots' Monte-Carlo equity estimate.
 */
import { type CardCode, RANKS, SUITS } from '@/games/core/cards';

export const CATEGORY_ORDER = [
  'high-card',
  'pair',
  'two-pair',
  'three-of-a-kind',
  'straight',
  'flush',
  'full-house',
  'four-of-a-kind',
  'straight-flush',
] as const;
export type HandCategory = (typeof CATEGORY_ORDER)[number];

export const CATEGORY_LABELS: Record<HandCategory, string> = {
  'high-card': 'High Card',
  pair: 'Pair',
  'two-pair': 'Two Pair',
  'three-of-a-kind': 'Three of a Kind',
  straight: 'Straight',
  flush: 'Flush',
  'full-house': 'Full House',
  'four-of-a-kind': 'Four of a Kind',
  'straight-flush': 'Straight Flush',
};

/** How many leading tie-break ranks describe the hand itself; the rest are kickers. */
const CORE_LENGTH: Record<HandCategory, number> = {
  'high-card': 1,
  pair: 1,
  'two-pair': 2,
  'three-of-a-kind': 1,
  straight: 1,
  flush: 5,
  'full-house': 2,
  'four-of-a-kind': 1,
  'straight-flush': 1,
};

export interface HandValue {
  category: HandCategory;
  /** 0 (high card) … 8 (straight flush). */
  categoryIndex: number;
  /** Tie-break ranks (2–14, Ace = 14; a wheel straight is "5"), most significant first. */
  ranks: number[];
  /** Leading entries of `ranks` that define the hand; entries after it are kickers. */
  coreLength: number;
  /** One comparable number — a higher score is a better hand, equal scores tie. */
  score: number;
  /** The best five cards (all cards when fewer than five were given), in display order. */
  cards: CardCode[];
  /** Plain name, e.g. "Two Pair, Kings and Sevens" or "Straight to the Nine". */
  name: string;
  /** Ace-high straight flush. */
  isRoyal: boolean;
}

// ----------------------------------------------------------- card ↔ numbers

/** Card id 0–51: suit index × 13 + (rank − 2), with rank 2–14 (Ace high). */
const ID_OF = new Map<string, number>();
const CODE_OF: CardCode[] = [];
SUITS.forEach((s, si) => {
  for (let r = 2; r <= 14; r++) {
    const rank = RANKS[r === 14 ? 0 : r - 1] ?? 'A';
    const code = `${rank}${s}` as CardCode;
    const id = si * 13 + (r - 2);
    ID_OF.set(code, id);
    CODE_OF[id] = code;
  }
});

/** Numeric id (0–51) of a standard card. Throws on jokers / invalid codes. */
export function cardId(code: CardCode): number {
  const id = ID_OF.get(code);
  if (id === undefined) throw new Error(`Not a standard playing card: ${code}`);
  return id;
}
export function cardFromId(id: number): CardCode {
  const c = CODE_OF[id];
  if (c === undefined) throw new Error(`Bad card id ${id}`);
  return c;
}
/** Poker rank of a card, 2–14 (Ace = 14). */
export function pokerRank(code: CardCode): number {
  return (cardId(code) % 13) + 2;
}

// ------------------------------------------------------------- core logic

const BASE = 15;
const CATEGORY_WEIGHT = BASE ** 5;

/** Highest card of a five-in-a-row in `mask` (bits 2–14; Ace also plays low), or 0. */
function straightHigh(mask: number): number {
  const m = mask | (((mask >> 14) & 1) << 1);
  for (let h = 14; h >= 5; h--) {
    const need = 0b11111 << (h - 4);
    if ((m & need) === need) return h;
  }
  return 0;
}

function topRanks(mask: number, n: number, exclude: readonly number[] = []): number[] {
  const out: number[] = [];
  for (let r = 14; r >= 2 && out.length < n; r--) {
    if (mask & (1 << r) && !exclude.includes(r)) out.push(r);
  }
  return out;
}

function popcount(x: number): number {
  let n = 0;
  let v = x;
  while (v) {
    v &= v - 1;
    n++;
  }
  return n;
}

interface Analysis {
  categoryIndex: number;
  ranks: number[];
  /** Suit index used by a flush / straight flush, else −1. */
  flushSuit: number;
}

const counts = new Int8Array(15);
const suitMask = [0, 0, 0, 0];

/** Categorise `n` cards given by parallel rank (2–14) / suit (0–3) arrays. */
function analyze(rs: ArrayLike<number>, ss: ArrayLike<number>, n: number): Analysis {
  counts.fill(0);
  suitMask[0] = suitMask[1] = suitMask[2] = suitMask[3] = 0;
  let rankMask = 0;
  for (let i = 0; i < n; i++) {
    const r = rs[i] ?? 0;
    const s = ss[i] ?? 0;
    counts[r] = (counts[r] ?? 0) + 1;
    suitMask[s] = (suitMask[s] ?? 0) | (1 << r);
    rankMask |= 1 << r;
  }
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (popcount(suitMask[s] ?? 0) >= 5) flushSuit = s;
  if (flushSuit >= 0) {
    const sf = straightHigh(suitMask[flushSuit] ?? 0);
    if (sf) return { categoryIndex: 8, ranks: [sf], flushSuit };
  }
  let quad = 0;
  const trips: number[] = [];
  const pairs: number[] = [];
  for (let r = 14; r >= 2; r--) {
    const c = counts[r] ?? 0;
    if (c === 4) quad = r;
    else if (c === 3) trips.push(r);
    else if (c === 2) pairs.push(r);
  }
  if (quad)
    return { categoryIndex: 7, ranks: [quad, ...topRanks(rankMask, 1, [quad])], flushSuit: -1 };
  const t0 = trips[0];
  if (t0 !== undefined && (trips.length > 1 || pairs.length > 0)) {
    return { categoryIndex: 6, ranks: [t0, Math.max(trips[1] ?? 0, pairs[0] ?? 0)], flushSuit: -1 };
  }
  if (flushSuit >= 0) {
    return { categoryIndex: 5, ranks: topRanks(suitMask[flushSuit] ?? 0, 5), flushSuit };
  }
  const st = straightHigh(rankMask);
  if (st) return { categoryIndex: 4, ranks: [st], flushSuit: -1 };
  if (t0 !== undefined) {
    return { categoryIndex: 3, ranks: [t0, ...topRanks(rankMask, 2, [t0])], flushSuit: -1 };
  }
  const p0 = pairs[0];
  const p1 = pairs[1];
  if (p0 !== undefined && p1 !== undefined) {
    return { categoryIndex: 2, ranks: [p0, p1, ...topRanks(rankMask, 1, [p0, p1])], flushSuit: -1 };
  }
  if (p0 !== undefined) {
    return { categoryIndex: 1, ranks: [p0, ...topRanks(rankMask, 3, [p0])], flushSuit: -1 };
  }
  return { categoryIndex: 0, ranks: topRanks(rankMask, 5), flushSuit: -1 };
}

function scoreOf(a: Analysis): number {
  let score = a.categoryIndex * CATEGORY_WEIGHT;
  for (let i = 0; i < 5; i++) score += (a.ranks[i] ?? 0) * BASE ** (4 - i);
  return score;
}

/** Category index (0 = high card … 8 = straight flush) of a score from `scoreIds` / `evaluateHand`. */
export function scoreCategory(score: number): number {
  return Math.floor(score / CATEGORY_WEIGHT);
}

/**
 * Fast score for the Monte-Carlo path: `ids[0..n)` are card ids (see `cardId`).
 * Same ordering as `evaluateHand(...).score`.
 */
export function scoreIds(ids: ArrayLike<number>, n: number): number {
  const rs = scratchRanks;
  const ss = scratchSuits;
  for (let i = 0; i < n; i++) {
    const id = ids[i] ?? 0;
    rs[i] = (id % 13) + 2;
    ss[i] = (id / 13) | 0;
  }
  return scoreOf(analyze(rs, ss, n));
}
const scratchRanks = new Int8Array(7);
const scratchSuits = new Int8Array(7);

// ------------------------------------------------------------- full detail

const RANK_WORD: Record<number, string> = {
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
  14: 'Ace',
};
/** "Ace", "Six". */
export function rankWord(r: number): string {
  return RANK_WORD[r] ?? String(r);
}
/** "Aces", "Sixes". */
export function rankPlural(r: number): string {
  return r === 6 ? 'Sixes' : `${rankWord(r)}s`;
}

function nameOf(category: HandCategory, ranks: readonly number[], royal: boolean): string {
  const [a = 0, b = 0] = ranks;
  switch (category) {
    case 'straight-flush':
      return royal ? 'Royal Flush' : `Straight Flush to the ${rankWord(a)}`;
    case 'four-of-a-kind':
      return `Four of a Kind, ${rankPlural(a)}`;
    case 'full-house':
      return `Full House, ${rankPlural(a)} full of ${rankPlural(b)}`;
    case 'flush':
      return `Flush, ${rankWord(a)} high`;
    case 'straight':
      return `Straight to the ${rankWord(a)}`;
    case 'three-of-a-kind':
      return `Three of a Kind, ${rankPlural(a)}`;
    case 'two-pair':
      return `Two Pair, ${rankPlural(a)} and ${rankPlural(b)}`;
    case 'pair':
      return `Pair of ${rankPlural(a)}`;
    case 'high-card':
      return `High Card, ${rankWord(a)}`;
  }
}

/** Ranks of a straight from its high card, high to low (the wheel ends with the Ace). */
function straightRanks(high: number): number[] {
  const out: number[] = [];
  for (let r = high; r > high - 5; r--) out.push(r === 1 ? 14 : r);
  return out;
}

/** Choose the actual best-five cards for display. */
function pickCards(cards: readonly CardCode[], a: Analysis, category: HandCategory): CardCode[] {
  const pool = cards.map((c) => ({ c, r: pokerRank(c), s: Math.floor(cardId(c) / 13) }));
  const used = new Set<number>();
  const take = (rank: number, count: number, suit = -1): CardCode[] => {
    const out: CardCode[] = [];
    pool.forEach((p, i) => {
      if (out.length < count && !used.has(i) && p.r === rank && (suit < 0 || p.s === suit)) {
        used.add(i);
        out.push(p.c);
      }
    });
    return out;
  };
  const [r0 = 0, r1 = 0] = a.ranks;
  switch (category) {
    case 'straight-flush':
      return straightRanks(r0).flatMap((r) => take(r, 1, a.flushSuit));
    case 'straight':
      return straightRanks(r0).flatMap((r) => take(r, 1));
    case 'flush':
      return a.ranks.flatMap((r) => take(r, 1, a.flushSuit));
    case 'four-of-a-kind':
      return [...take(r0, 4), ...a.ranks.slice(1).flatMap((r) => take(r, 1))];
    case 'full-house':
      return [...take(r0, 3), ...take(r1, 2)];
    case 'three-of-a-kind':
      return [...take(r0, 3), ...a.ranks.slice(1).flatMap((r) => take(r, 1))];
    case 'two-pair':
      return [...take(r0, 2), ...take(r1, 2), ...a.ranks.slice(2).flatMap((r) => take(r, 1))];
    case 'pair':
      return [...take(r0, 2), ...a.ranks.slice(1).flatMap((r) => take(r, 1))];
    case 'high-card':
      return a.ranks.flatMap((r) => take(r, 1));
  }
}

/**
 * Evaluate the best poker hand that can be made from 1–7 cards (straights and
 * flushes need five). Duplicate cards are rejected.
 */
export function evaluateHand(cards: readonly CardCode[]): HandValue {
  if (cards.length < 1 || cards.length > 7) {
    throw new RangeError(`Hold'em hands are made from 1–7 cards, got ${cards.length}`);
  }
  if (new Set(cards).size !== cards.length) throw new Error('Duplicate card in hand');
  const ids = cards.map(cardId);
  const rs = ids.map((id) => (id % 13) + 2);
  const ss = ids.map((id) => Math.floor(id / 13));
  const a = analyze(rs, ss, cards.length);
  const category = CATEGORY_ORDER[a.categoryIndex] ?? 'high-card';
  const royal = category === 'straight-flush' && a.ranks[0] === 14;
  return {
    category,
    categoryIndex: a.categoryIndex,
    ranks: a.ranks.slice(),
    coreLength: Math.min(CORE_LENGTH[category], a.ranks.length),
    score: scoreOf(a),
    cards: pickCards(cards, a, category),
    name: nameOf(category, a.ranks, royal),
    isRoyal: royal,
  };
}

/** The best five-card hand from exactly 5–7 cards (two hole cards + the board). */
export function evaluate7(cards: readonly CardCode[]): HandValue {
  if (cards.length < 5 || cards.length > 7) {
    throw new RangeError(`evaluate7 needs 5–7 cards, got ${cards.length}`);
  }
  return evaluateHand(cards);
}

/** > 0 if `a` beats `b`, < 0 if `b` wins, 0 for an exact tie. */
export function compareHands(a: HandValue, b: HandValue): number {
  return a.score - b.score;
}

/**
 * True when two hands are the same made hand: same category and the same
 * defining ranks (kickers ignored), e.g. both "Four of a Kind, Nines".
 */
export function sameMadeHand(a: HandValue, b: HandValue): boolean {
  if (a.categoryIndex !== b.categoryIndex) return false;
  const n = Math.min(a.coreLength, b.coreLength);
  for (let i = 0; i < n; i++) if (a.ranks[i] !== b.ranks[i]) return false;
  return true;
}

/**
 * True when the made hand comes entirely from the community cards, so every
 * player still in shares it ("playing the board") — e.g. four Nines on the
 * board, or a royal flush on the board. Hole cards may still add a kicker.
 */
export function madeByBoard(hole: readonly CardCode[], board: readonly CardCode[]): boolean {
  if (board.length === 0) return false;
  return sameMadeHand(evaluateHand([...hole, ...board]), evaluateHand(board));
}

/**
 * True when two hands of the same kind (same category and same core ranks,
 * e.g. both "Pair of Kings") were separated only by a kicker.
 */
export function decidedByKicker(a: HandValue, b: HandValue): boolean {
  if (a.score === b.score || a.categoryIndex !== b.categoryIndex) return false;
  for (let i = 0; i < a.coreLength; i++) if (a.ranks[i] !== b.ranks[i]) return false;
  return a.ranks.length > a.coreLength;
}
