/**
 * Pure helpers for the Crazy Eights Board: move keys, coach flags, zone words and the
 * key that identifies one deal. Nothing here reads hidden information — a seat's cards
 * are only ever listed for the learner, or for everyone once the game is over.
 */
import { joinNames } from '@/components/play/personas';
import { cardName, rankOf, SUIT_NAMES, SUITS, type CardCode, type Suit } from '@/games/core/cards';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/games/crazy-eights/i18n';
import {
  crazyEightsEngine as E,
  isEight,
  type CrazyEightsMove,
  type CrazyEightsState,
} from '../engine';
import { rankWithArticle, suitWithArticle } from '../rules';

export const LEARNER: PlayerId = 0;

/** Seconds the opening deal takes before the starter card turns face up. */
export const DEAL_SECONDS = 0.7;
export const GLIDE = [0.22, 1, 0.36, 1] as const;

export const keyOf = (move: CrazyEightsMove) => E.moveKey(move);

/** The move a card press makes (an Eight still needs a suit — see the suit chooser). */
export function playMove(card: CardCode, suit?: Suit): CrazyEightsMove {
  return suit ? { type: 'play', card, suit } : { type: 'play', card };
}

/** Is any legal way of playing `card` among the highlighted move keys? */
export function cardGlows(card: CardCode, highlight: ReadonlySet<string>): boolean {
  if (isEight(card)) return SUITS.some((suit) => highlight.has(keyOf(playMove(card, suit))));
  return highlight.has(keyOf(playMove(card)));
}

/** Is the coach's pick a play of `card` (with any suit)? */
export function cardSuggested(card: CardCode, suggestedKey: string | null): boolean {
  if (suggestedKey === null) return false;
  if (isEight(card)) return SUITS.some((suit) => suggestedKey === keyOf(playMove(card, suit)));
  return suggestedKey === keyOf(playMove(card));
}

/** "Two of Spades, King of Spades and Queen of Diamonds". */
export function cardList(cards: readonly CardCode[]): string {
  return joinNames(cards.map(cardName));
}

/**
 * The learner's hand as it was dealt, rebuilt from public bookkeeping of their own moves
 * (cards they played come back, cards they drew go away).
 */
function dealtHand(state: CrazyEightsState): CardCode[] {
  const held = new Set(state.hands[LEARNER] ?? []);
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (!e || e.seat !== LEARNER) continue;
    if (e.type === 'play') held.add(e.card);
    else if (e.type === 'draw') held.delete(e.card);
  }
  return [...held].sort();
}

/** A key that stays the same for one whole game and changes with every new deal. */
export function dealKey(state: CrazyEightsState): string {
  return [state.players, state.starter, ...state.buried, ...dealtHand(state)].join('-');
}

/** What the next card must be, in words (for the discard pile's accessible name). */
export function needText(state: CrazyEightsState): string {
  const top = state.discard[state.discard.length - 1];
  if (top !== undefined && isEight(top)) {
    return t('crazyEights.discard.needEight', {
      suit: SUIT_NAMES[state.activeSuit],
      singular: suitWithArticle(state.activeSuit),
    });
  }
  return t('crazyEights.discard.needNormal', {
    suit: suitWithArticle(state.activeSuit),
    rank: top ? rankWithArticle(rankOf(top)) : '',
  });
}

/** "5 cards" / "2 cards left!" / "Last card!" for a seat's count chip. */
export function countText(count: number, winner: boolean): string {
  if (winner && count === 0) return t('crazyEights.count.out');
  if (count === 1) return t('crazyEights.count.last');
  if (count === 2) return t('crazyEights.count.two');
  return t('crazyEights.count.many', { n: count });
}

/** The seat that played the card on top of the pile (null for the starter). */
export function topPlayedBy(state: CrazyEightsState): PlayerId | null {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (e?.type === 'play') return e.seat;
  }
  return null;
}

/** Is the target of a keyboard event somewhere the learner is typing? */
export function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

/** Suits in the order the chooser shows them. */
export const CHOOSER_SUITS: readonly Suit[] = SUITS;

/** How many non-Eight cards of `suit` remain in `hand` once `eight` is played. */
export function heldOfSuit(hand: readonly CardCode[], eight: CardCode, suit: Suit): number {
  return hand.filter((c) => c !== eight && !isEight(c) && c.endsWith(suit)).length;
}
