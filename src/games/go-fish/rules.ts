/**
 * Pure Go Fish rule helpers shared by the engine, the bots/coach and the tests.
 * Everything here works on small inputs (a hand, book counts) so each rule can be
 * unit-tested in isolation. See docs/RULES_DECISIONS.md → Go Fish.
 */
import {
  rankOf,
  RANK_NAMES,
  RANKS,
  suitOf,
  type CardCode,
  type Rank,
  type Suit,
} from '@/games/core/cards';
import type { PlayerId } from '@/games/core/types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
export const DEFAULT_PLAYERS = 3;
export const DECK_SIZE = 52;
/** Four cards of one rank make a book; a 52-card deck holds 13 books. */
export const BOOK_SIZE = 4;
export const TOTAL_BOOKS = 13;
/** Worst-case loss in stake units: a losing seat pays its 1-unit ante into the pot. */
export const MAX_LOSS_UNITS = 1;

/** Cards dealt to each player: 7 with two or three players, 5 with four or five. */
export function handSizeFor(players: number): number {
  return players <= 3 ? 7 : 5;
}

/**
 * Books needed for a "perfect" game (a landslide): more than all the opponents together,
 * i.e. 7 of the 13. Heads-up that is simply any win (7–6 is the closest possible finish),
 * so there it takes at least twice the opponent's books: 9 (9–4 or better).
 */
export function perfectBooksFor(players: number): number {
  return players === 2 ? 9 : 7;
}

/** Best possible result in stake units: a sole winner collects every other seat's ante. */
export function maxWinUnits(players: number): number {
  return players - 1;
}

export function isRank(value: unknown): value is Rank {
  return typeof value === 'string' && (RANKS as readonly string[]).includes(value);
}

/** Index of a rank in A, 2 … K order (0–12). */
export function rankIndex(rank: Rank): number {
  return RANKS.indexOf(rank);
}

const SUIT_ORDER: readonly Suit[] = ['S', 'H', 'C', 'D'];

/**
 * Display order for a Go Fish hand: grouped by rank (Ace low, A → K), then by suit
 * (♠ ♥ ♣ ♦). Canonical — the result does not depend on the input order.
 */
export function sortByRank(cards: readonly CardCode[]): CardCode[] {
  return cards
    .slice()
    .sort(
      (a, b) =>
        rankIndex(rankOf(a)) - rankIndex(rankOf(b)) ||
        SUIT_ORDER.indexOf(suitOf(a)) - SUIT_ORDER.indexOf(suitOf(b)),
    );
}

/** How many cards of `rank` are in `hand`. */
export function countRank(hand: readonly CardCode[], rank: Rank): number {
  let n = 0;
  for (const c of hand) if (rankOf(c) === rank) n++;
  return n;
}

/** Number of cards of each rank (indexed like RANKS). */
export function rankCounts(hand: readonly CardCode[]): number[] {
  const counts = RANKS.map(() => 0);
  for (const c of hand) {
    const i = rankIndex(rankOf(c));
    counts[i] = (counts[i] ?? 0) + 1;
  }
  return counts;
}

/** The distinct ranks in `hand`, in A → K order. */
export function ranksHeld(hand: readonly CardCode[]): Rank[] {
  const counts = rankCounts(hand);
  return RANKS.filter((_, i) => (counts[i] ?? 0) > 0);
}

/** Ranks of which `hand` holds all four cards (a book to lay down), in A → K order. */
export function completeRanks(hand: readonly CardCode[]): Rank[] {
  const counts = rankCounts(hand);
  return RANKS.filter((_, i) => (counts[i] ?? 0) >= BOOK_SIZE);
}

/** Seats with the most books (every tied seat is a winner). */
export function mostBooks(bookCounts: readonly number[]): PlayerId[] {
  const best = Math.max(...bookCounts);
  const out: PlayerId[] = [];
  bookCounts.forEach((n, seat) => {
    if (n === best) out.push(seat);
  });
  return out;
}

/**
 * Winner-takes-the-pot payout in stake units: every seat antes 1 unit, losers lose it and
 * the winners share the pot. A sole winner gets +(players − 1); k tied winners get
 * (players − k)/k each; if every seat ties nobody pays (0). Payouts always sum to 0.
 */
export function payoutUnits(seat: PlayerId, winners: readonly PlayerId[], players: number): number {
  if (winners.length === 0 || winners.length >= players) return 0;
  if (!winners.includes(seat)) return -1;
  return (players - winners.length) / winners.length;
}

// ------------------------------------------------------------------ words

const RANK_PLURALS: Record<Rank, string> = {
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

/** "Sevens", "Sixes", "Aces". */
export function rankPlural(rank: Rank): string {
  return RANK_PLURALS[rank];
}

/** "a Seven", "an Ace", "an Eight". */
export function rankWithArticle(rank: Rank): string {
  return `${rank === 'A' || rank === '8' ? 'an' : 'a'} ${RANK_NAMES[rank]}`;
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four'];

/** "one Seven", "two Sevens", "three Sixes". */
export function rankCountWords(n: number, rank: Rank): string {
  const word = NUMBER_WORDS[n] ?? String(n);
  return `${word} ${n === 1 ? RANK_NAMES[rank] : rankPlural(rank)}`;
}

/** "You" for the learner (seat 0), otherwise "Player N" (the UI swaps in persona names). */
export function seatLabel(seat: PlayerId): string {
  return seat === 0 ? 'You' : `Player ${seat}`;
}

/** Object form: "you" / "Player N". */
export function seatObject(seat: PlayerId): string {
  return seat === 0 ? 'you' : `Player ${seat}`;
}

/** Possessive form: "your" / "Player N's". */
export function seatPossessive(seat: PlayerId): string {
  return seat === 0 ? 'your' : `Player ${seat}'s`;
}

/** Pronoun after a seat has been named: "you" / "they". */
export function pronoun(seat: PlayerId): string {
  return seat === 0 ? 'you' : 'they';
}

/** Possessive pronoun: "your" / "their". */
export function pronounPossessive(seat: PlayerId): string {
  return seat === 0 ? 'your' : 'their';
}

/** Verb agreeing with seatLabel(): verbFor(0, 'go', 'goes') → "go". */
export function verbFor(seat: PlayerId, you: string, other: string): string {
  return seat === 0 ? you : other;
}

export function cardsLabel(n: number): string {
  return `${n} card${n === 1 ? '' : 's'}`;
}

export function booksLabel(n: number): string {
  return `${n} book${n === 1 ? '' : 's'}`;
}

/** "A, B and C" / "A, B or C". */
export function joinWords(items: readonly string[], conjunction: 'and' | 'or' = 'and'): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

/** "your Fives, Sevens or Kings" — at most `max` ranks, the ones held most first. */
export function heldRanksWords(hand: readonly CardCode[], max = 3): string {
  const counts = rankCounts(hand);
  const ranks = ranksHeld(hand)
    .slice()
    .sort((a, b) => (counts[rankIndex(b)] ?? 0) - (counts[rankIndex(a)] ?? 0))
    .slice(0, max)
    .sort((a, b) => rankIndex(a) - rankIndex(b));
  return joinWords(ranks.map(rankPlural), 'or');
}
