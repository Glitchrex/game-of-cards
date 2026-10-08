/**
 * Blackjack hand arithmetic — shared by the engine, the strategy module and the UI.
 *
 * Kept in its own module (rather than inside engine.ts) so that strategy.ts can use it
 * without importing the engine, which in turn imports the strategy (no import cycle).
 */
import { RANK_NAMES, rankOf, type CardCode } from '@/games/core/cards';

/** Blackjack never reaches beyond this total without busting. */
export const BLACKJACK_TOTAL = 21;

/**
 * Point value of one card: 2–9 count their number, 10/J/Q/K count 10, and an Ace counts
 * 1 here (handValue decides whether one Ace can be promoted to 11).
 */
export function cardPoints(card: CardCode): number {
  const rank = rankOf(card);
  if (rank === 'A') return 1;
  if (rank === 'T' || rank === 'J' || rank === 'Q' || rank === 'K') return 10;
  return Number(rank);
}

/** True for 10, J, Q and K — the cards that make Blackjack together with an Ace. */
export function isTenValue(card: CardCode): boolean {
  return cardPoints(card) === 10;
}

export function isAce(card: CardCode): boolean {
  return rankOf(card) === 'A';
}

export interface HandValue {
  /** Best total: one Ace counts 11 if that does not bust the hand, otherwise every Ace is 1. */
  total: number;
  /** True when an Ace is currently counted as 11 (so one more card can never bust the hand). */
  soft: boolean;
}

/**
 * Value of a Blackjack hand. At most one Ace can ever usefully count 11 (two would make 22),
 * so we count every Ace as 1 and then add 10 once if it fits.
 */
export function handValue(cards: readonly CardCode[]): HandValue {
  let total = 0;
  let hasAce = false;
  for (const c of cards) {
    const p = cardPoints(c);
    total += p;
    if (p === 1) hasAce = true;
  }
  if (hasAce && total + 10 <= BLACKJACK_TOTAL) return { total: total + 10, soft: true };
  return { total, soft: false };
}

/**
 * Two cards worth 21 (an Ace plus a ten-value card). This only looks at the cards: a hand
 * that came from a split is never a Blackjack, so for the learner's hands use the engine's
 * `playerHasBlackjack(state)` / `describeHand(hand)`, which know where the hand came from.
 */
export function isBlackjack(cards: readonly CardCode[]): boolean {
  return cards.length === 2 && handValue(cards).total === BLACKJACK_TOTAL;
}

export function isBust(cards: readonly CardCode[]): boolean {
  return handValue(cards).total > BLACKJACK_TOTAL;
}

/**
 * Two cards that may be split: the same value. Any two ten-value cards count as a pair
 * (King + Queen), as in most casinos; Aces pair with Aces.
 */
export function isPair(cards: readonly CardCode[]): boolean {
  const [a, b] = cards;
  return (
    cards.length === 2 && a !== undefined && b !== undefined && cardPoints(a) === cardPoints(b)
  );
}

/**
 * Plain-words total for coaching and the move log: "Blackjack", "soft 17", "hard 15",
 * "24 (bust)". Small hard totals are just the number, because "hard 8" means nothing to a
 * beginner and no Ace is involved anyway.
 *
 * `canBeBlackjack: false` is for hands made by splitting, where Ace + 10 is a plain 21.
 */
export function describeTotal(
  cards: readonly CardCode[],
  { canBeBlackjack = true }: { canBeBlackjack?: boolean } = {},
): string {
  if (canBeBlackjack && isBlackjack(cards)) return 'Blackjack';
  const { total, soft } = handValue(cards);
  if (total > BLACKJACK_TOTAL) return `${total} (bust)`;
  if (soft) return `soft ${total}`;
  const hasAce = cards.some(isAce);
  return hasAce || total >= 12 ? `hard ${total}` : `${total}`;
}

/** "an Ace", "a 6", "a 10-value card" — how a coach names the dealer's upcard. */
export function upcardPhrase(card: CardCode): string {
  if (isAce(card)) return 'an Ace';
  if (isTenValue(card)) {
    const rank = rankOf(card);
    return rank === 'T' ? 'a 10' : `a ${RANK_NAMES[rank]} (worth 10)`;
  }
  const n = cardPoints(card);
  return n === 8 ? 'an 8' : `a ${n}`;
}

/**
 * Upcard as a number from 2 to 11 (Ace = 11) — the column index used by strategy charts.
 */
export function upcardNumber(card: CardCode): number {
  const p = cardPoints(card);
  return p === 1 ? 11 : p;
}
