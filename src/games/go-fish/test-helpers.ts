/**
 * Test-only helpers for building exact Go Fish positions. Not imported by the engine or
 * the UI.
 */
import { makeDeck, rankOf, SUITS, type CardCode, type Rank } from '@/games/core/cards';
import type { PlayerId } from '@/games/core/types';
import type { GoFishBook, GoFishBookSource, GoFishEvent, GoFishState } from './engine';
import { sortByRank } from './rules';

/** "AS KH 2C" → ['AS', 'KH', '2C'] */
export function cards(list: string): CardCode[] {
  return list.trim().split(/\s+/).filter(Boolean) as CardCode[];
}

/** "A 7 K" → ['A', '7', 'K'] */
export function ranks(list: string): Rank[] {
  return list.trim().split(/\s+/).filter(Boolean) as Rank[];
}

/** The four cards of a rank. */
export function fourOf(rank: Rank): CardCode[] {
  return SUITS.map((s) => `${rank}${s}` as CardCode);
}

export interface StateSpec {
  /** One hand per seat (the number of hands = the number of players). */
  hands: string[];
  /** Books already laid down, per seat, as ranks ("A 7"). */
  books?: string[];
  /** How the books in `books` were made (default 'catch'). */
  bookVia?: GoFishBookSource;
  /**
   * The next cards of the pond, top first. Unless `exactStock` is set, every card not in
   * a hand or a book follows them (in deck order), so all 52 cards are accounted for.
   */
  stock?: string;
  /** The pond is exactly `stock` (default empty); every other card must be in a hand or book. */
  exactStock?: boolean;
  turn?: PlayerId;
  log?: GoFishEvent[];
  maxBehind?: number;
}

/** Build a play-phase state in which every one of the 52 cards is in exactly one place. */
export function makeState(spec: StateSpec): GoFishState {
  const hands = spec.hands.map((h) => sortByRank(cards(h)));
  const players = hands.length;
  const books: GoFishBook[][] = hands.map((_, seat) =>
    ranks(spec.books?.[seat] ?? '').map((rank) => ({ rank, via: spec.bookVia ?? 'catch' })),
  );
  const used = new Set<CardCode>();
  const claim = (c: CardCode) => {
    if (used.has(c)) throw new Error(`makeState: ${c} appears twice`);
    used.add(c);
  };
  hands.flat().forEach(claim);
  books.flat().forEach((b) => fourOf(b.rank).forEach(claim));
  const top = cards(spec.stock ?? '');
  top.forEach(claim);
  const rest = makeDeck().filter((c) => !used.has(c));
  if (spec.exactStock && rest.length > 0) {
    throw new Error(`makeState: ${rest.length} cards are unaccounted for (${rest.join(' ')})`);
  }
  for (const h of hands) {
    for (const c of h) {
      if (h.filter((x) => rankOf(x) === rankOf(c)).length >= 4) {
        throw new Error(`makeState: a hand holds all four ${rankOf(c)}s (that is a book)`);
      }
    }
  }
  return {
    players,
    hands,
    stock: [...top, ...rest],
    books,
    turn: spec.turn ?? 0,
    phase: 'play',
    winners: [],
    log: spec.log ?? [],
    maxBehind: spec.maxBehind ?? 0,
  };
}

/** Every card in the state (books expanded to their four cards), sorted. */
export function allCards(s: GoFishState): string {
  return [...s.hands.flat(), ...s.stock, ...s.books.flat().flatMap((b) => fourOf(b.rank))]
    .sort()
    .join(',');
}

export const FULL_DECK = makeDeck().slice().sort().join(',');

/** Ranks not mentioned in `except`, as a books string ("A 2 3 …"). */
export function ranksExcept(except: string): string {
  const skip = new Set(ranks(except));
  return 'A 2 3 4 5 6 7 8 9 T J Q K'
    .split(' ')
    .filter((r) => !skip.has(r as Rank))
    .join(' ');
}
