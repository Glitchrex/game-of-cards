/**
 * Test-only helpers for Indian Rummy.
 *
 * 1. A reference scorer written independently of melds.ts: it enumerates every subset of
 *    the hand explicitly (jokers included as real cards), classifies each subset by brute
 *    force (every way the wild-rank cards could act — as themselves or as jokers — and every
 *    Ace placement), then runs an exact cover search over those explicit groups. Slow but
 *    simple; use it on hands of up to 14 cards.
 * 2. `buildState`: a consistent hand-made position for rule tests.
 */
import { type CardCode, type Rank } from '@/games/core/cards';
import { rawDeadwoodOf, wildRankFor } from './melds';
import { type DropKind, type IndianRummyState, fullDeck } from './rules';

const RANK_ORDER = 'A23456789TJQK';
const SUIT_ORDER = 'SHDC';

function rankNo(card: string): number {
  return RANK_ORDER.indexOf(card[0] ?? '') + 1;
}

function isPrinted(card: string): boolean {
  return card === 'X1' || card === 'X2';
}

/** `wildRank` null = no wild rank at all (only printed jokers are jokers). */
function isWild(card: string, wildRank: Rank | null): boolean {
  return wildRank !== null && !isPrinted(card) && card[0] === wildRank;
}

export function refPoints(card: CardCode, wildRank: Rank | null): number {
  if (isPrinted(card) || isWild(card, wildRank)) return 0;
  const r = rankNo(card);
  if (r === 1 || r >= 10) return 10;
  return r;
}

interface Kinds {
  pure: boolean;
  seq: boolean;
  set: boolean;
}

/** Brute-force classification of one explicit group of cards. */
export function refClassify(cards: readonly CardCode[], wildRank: Rank | null): Kinds {
  const out: Kinds = { pure: false, seq: false, set: false };
  const size = cards.length;
  if (size < 3) return out;
  const flexible = cards.filter((c) => isWild(c, wildRank));
  const fixed = cards.filter((c) => !isPrinted(c) && !isWild(c, wildRank));
  for (let a = 0; a < 1 << flexible.length; a++) {
    const itself = [...fixed, ...flexible.filter((_, i) => a & (1 << i))];
    const jokers = size - itself.length;
    if (itself.length === 0) continue;
    // Set: one rank, all different suits, 3 or 4 cards in total.
    const rank = itself[0]?.[0];
    const suits = new Set(itself.map((c) => c[1]));
    if (size <= 4 && itself.every((c) => c[0] === rank) && suits.size === itself.length) {
      out.set = true;
    }
    // Sequence: one suit, distinct places in a window of `size` consecutive ranks.
    if (suits.size === 1) {
      const aces = itself.filter((c) => c[0] === 'A').length;
      for (let hi = 0; hi < 1 << aces; hi++) {
        let aceIndex = 0;
        const places = itself.map((c) => {
          const r = rankNo(c);
          if (r !== 1) return r;
          return hi & (1 << aceIndex++) ? 14 : 1;
        });
        if (new Set(places).size !== places.length) continue;
        const span = Math.max(...places) - Math.min(...places) + 1;
        if (span <= size && size <= 13) {
          out.seq = true;
          if (jokers === 0) out.pure = true;
        }
      }
    }
  }
  return out;
}

export interface RefScore {
  valid: boolean;
  /** Pure-sequence rule applied, capped at 80. */
  deadwood: number;
  /** Ignoring the pure-sequence rule, uncapped. */
  raw: number;
}

/** Exact reference evaluation of a hand. */
export function refScore(hand: readonly CardCode[], wildRank: Rank | null): RefScore {
  const n = hand.length;
  const size = 1 << n;
  // Bit sets of the ranks and suits of the "fixed" cards (never jokers) in every subset.
  const rankOr = new Int32Array(size);
  const suitOr = new Int32Array(size);
  const count = new Int8Array(size);
  const rankBit = hand.map((c) =>
    isPrinted(c) || isWild(c, wildRank) ? 0 : 1 << RANK_ORDER.indexOf(c[0] ?? ''),
  );
  const suitBit = hand.map((c) =>
    isPrinted(c) || isWild(c, wildRank) ? 0 : 1 << SUIT_ORDER.indexOf(c[1] ?? ''),
  );
  const groupsByLow: { mask: number; pure: boolean; seq: boolean }[][] = Array.from(
    { length: n },
    () => [],
  );
  const popcount = (x: number) => {
    let b = 0;
    for (let m = x; m; m &= m - 1) b++;
    return b;
  };
  for (let mask = 1; mask < size; mask++) {
    const low = 31 - Math.clz32(mask & -mask);
    const rest = mask & (mask - 1);
    rankOr[mask] = (rankOr[rest] ?? 0) | (rankBit[low] ?? 0);
    suitOr[mask] = (suitOr[rest] ?? 0) | (suitBit[low] ?? 0);
    count[mask] = (count[rest] ?? 0) + 1;
    if ((count[mask] ?? 0) < 3) continue;
    // Two fixed cards that differ in both rank and suit can share no group.
    if (popcount(rankOr[mask] ?? 0) > 1 && popcount(suitOr[mask] ?? 0) > 1) continue;
    const cards: CardCode[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) cards.push(hand[i] as CardCode);
    const k = refClassify(cards, wildRank);
    if (!k.set && !k.seq) continue;
    groupsByLow[low]?.push({ mask, pure: k.pure, seq: k.seq || k.pure });
  }
  const pts = hand.map((c) => refPoints(c, wildRank));
  // memo[mask] → best[pure][seqs 0..2] for covering the cards in `mask`.
  const memo = new Map<number, number[][]>();
  const go = (mask: number): number[][] => {
    const hit = memo.get(mask);
    if (hit) return hit;
    const best = [
      [Infinity, Infinity, Infinity],
      [Infinity, Infinity, Infinity],
    ];
    if (mask === 0) {
      (best[0] as number[])[0] = 0;
    } else {
      const low = 31 - Math.clz32(mask & -mask);
      const consider = (sub: number[][], cost: number, pure: boolean, seq: boolean) => {
        for (let p = 0; p < 2; p++) {
          for (let q = 0; q < 3; q++) {
            const v = (sub[p]?.[q] ?? Infinity) + cost;
            const np = pure ? 1 : p;
            const nq = Math.min(2, q + (seq ? 1 : 0));
            const row = best[np] as number[];
            if (v < (row[nq] ?? Infinity)) row[nq] = v;
          }
        }
      };
      consider(go(mask & ~(1 << low)), pts[low] ?? 0, false, false);
      for (const g of groupsByLow[low] ?? []) {
        if ((g.mask & mask) !== g.mask) continue;
        consider(go(mask & ~g.mask), 0, g.pure, g.seq);
      }
    }
    memo.set(mask, best);
    return best;
  };
  const best = go(size - 1);
  const pureRow = best[1] ?? [];
  const withPure = Math.min(...pureRow);
  const raw = Math.min(...best.flat());
  const total = pts.reduce((a, b) => a + b, 0);
  return {
    valid: pureRow[2] === 0,
    deadwood: Math.min(80, Number.isFinite(withPure) ? withPure : total),
    raw,
  };
}

/** Multiset difference: `all` minus every card in `used` (throws if a card is missing). */
export function remainingCards(all: readonly CardCode[], used: readonly CardCode[]): CardCode[] {
  const rest = all.slice();
  for (const c of used) {
    const i = rest.indexOf(c);
    if (i < 0) throw new Error(`buildState: card ${c} used more often than the deck holds`);
    rest.splice(i, 1);
  }
  return rest;
}

export interface StateSpec {
  hands: CardCode[][];
  wildCard: CardCode;
  /** Open pile, bottom → top (default: one card from the rest of the deck). */
  discard?: CardCode[];
  /** Closed stock, bottom → top (the next draw is the last card). Default: the rest of the deck. */
  stock?: CardCode[];
  /** Cards placed on top of the default stock (drawn first = last element). */
  stockTop?: CardCode[];
  turn?: number;
  phase?: 'draw' | 'discard';
  dealer?: number;
  hasDrawn?: boolean[];
  drops?: (DropKind | null)[];
  turnsTaken?: number[];
  turnCount?: number;
  maxTurns?: number;
  drawn?: IndianRummyState['drawn'];
  rngState?: number;
}

/** A consistent hand-made position: every card of the 106 is somewhere exactly once. */
export function buildState(spec: StateSpec): IndianRummyState {
  const players = spec.hands.length;
  const used = [
    ...spec.hands.flat(),
    spec.wildCard,
    ...(spec.discard ?? []),
    ...(spec.stockTop ?? []),
  ];
  let rest = remainingCards(fullDeck(), used);
  let discard = spec.discard;
  if (!discard) {
    const first = rest.find((c) => c !== 'X1' && c !== 'X2' && c[0] !== wildRankFor(spec.wildCard));
    if (!first) throw new Error('buildState: no card left for the open pile');
    discard = [first];
    rest = remainingCards(rest, [first]);
  }
  const stock = spec.stock ?? [...rest, ...(spec.stockTop ?? [])];
  const wildRank = wildRankFor(spec.wildCard);
  const n = (v: number) => Array.from({ length: players }, () => v);
  return {
    players,
    dealer: spec.dealer ?? players - 1,
    hands: spec.hands.map((h) => h.slice()),
    stock,
    discard,
    wildCard: spec.wildCard,
    wildRank,
    turn: spec.turn ?? 0,
    phase: spec.phase ?? (spec.hands[spec.turn ?? 0]?.length === 14 ? 'discard' : 'draw'),
    drawn: spec.drawn ?? null,
    hasDrawn: spec.hasDrawn ?? Array.from({ length: players }, () => false),
    drops: spec.drops ?? Array.from({ length: players }, () => null),
    turnsTaken: spec.turnsTaken ?? n(0),
    turnCount: spec.turnCount ?? (spec.turnsTaken ?? []).reduce((a, b) => a + b, 0),
    maxTurns: spec.maxTurns ?? 200,
    peakDeadwood: spec.hands.map((h) => rawDeadwoodOf(h, wildRank)),
    reshuffles: 0,
    rngState: spec.rngState ?? 12345,
    finishCard: null,
    outcome: null,
  };
}

/** Split a space-separated card list: cards('4S 5S 6S') → ['4S', '5S', '6S']. */
export function cards(list: string): CardCode[] {
  return list.split(/\s+/).filter(Boolean) as CardCode[];
}
