/**
 * Pure Crazy Eights rule helpers shared by the engine, the bots/coach and the tests.
 * Everything here works on small inputs (a hand, the pile) so each rule can be
 * unit-tested in isolation. See docs/RULES_DECISIONS.md → Crazy Eights.
 */
import {
  cardShort,
  rankOf,
  RANK_NAMES,
  suitOf,
  SUIT_NAMES,
  SUIT_SINGULAR,
  SUITS,
  type CardCode,
  type Rank,
  type Suit,
} from '@/games/core/cards';
import type { MoveCheck, PlayerId } from '@/games/core/types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const DEFAULT_PLAYERS = 3;
export const DECK_SIZE = 52;
/** Worst-case loss in stake units: a losing seat pays 1 unit into the pot. */
export const MAX_LOSS_UNITS = 1;
/**
 * Reshuffle house rule (options.reshuffle): how many times the discard pile may be turned
 * into a new stock in one game. The cap guarantees that every game ends.
 */
export const MAX_RESHUFFLES = 3;
/** Penalty points of an Eight in a blocked game. */
export const EIGHT_POINTS = 50;

/** Cards dealt to each player: 7 with two players, 5 with three or four. */
export function handSizeFor(players: number): number {
  return players === 2 ? 7 : 5;
}

export function isEight(card: CardCode): boolean {
  return rankOf(card) === '8';
}

export function isSuit(value: unknown): value is Suit {
  return typeof value === 'string' && (SUITS as readonly string[]).includes(value);
}

/**
 * Penalty points of a card left in hand when the game is blocked:
 * Eight = 50, King/Queen/Jack/Ten = 10, Ace = 1, every other card its number.
 */
export function cardPoints(card: CardCode): number {
  const r = rankOf(card);
  if (r === '8') return EIGHT_POINTS;
  if (r === 'T' || r === 'J' || r === 'Q' || r === 'K') return 10;
  if (r === 'A') return 1;
  return Number(r);
}

export function handPoints(cards: readonly CardCode[]): number {
  let total = 0;
  for (const c of cards) total += cardPoints(c);
  return total;
}

/** The face-up pile as the play rules see it. */
export interface Pile {
  /** The top card of the discard pile. */
  top: CardCode;
  /** The suit the next card must match: the top card's suit, or the suit named for an Eight. */
  activeSuit: Suit;
}

/**
 * Can `card` be played on `pile`? Eights are always playable. Otherwise the card must
 * match the active suit, or the top card's rank (an Eight on top can only be matched by
 * its named suit or another Eight).
 */
export function canPlay(card: CardCode, pile: Pile): boolean {
  if (isEight(card)) return true;
  if (suitOf(card) === pile.activeSuit) return true;
  return !isEight(pile.top) && rankOf(card) === rankOf(pile.top);
}

/** Every card in `hand` that may be played on `pile`, in hand order. */
export function playableCards(hand: readonly CardCode[], pile: Pile): CardCode[] {
  return hand.filter((c) => canPlay(c, pile));
}

/** "a King", "an Ace", "an Eight". */
export function rankWithArticle(rank: Rank): string {
  const name = RANK_NAMES[rank];
  return `${rank === 'A' || rank === '8' ? 'an' : 'a'} ${name}`;
}

/** "a Heart", "a Spade". */
export function suitWithArticle(suit: Suit): string {
  return `a ${SUIT_SINGULAR[suit]}`;
}

/** What may be played on `pile`, in plain words: "a Heart or a King — or a wild Eight". */
export function needWords(pile: Pile): string {
  if (isEight(pile.top)) return `${suitWithArticle(pile.activeSuit)} — or another Eight`;
  return `${suitWithArticle(pile.activeSuit)} or ${rankWithArticle(rankOf(pile.top))} — or a wild Eight`;
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

/** Verb agreeing with seatLabel(): verbFor(0, 'win', 'wins') → "win". */
export function verbFor(seat: PlayerId, you: string, other: string): string {
  return seat === 0 ? you : other;
}

export function cardsLabel(n: number): string {
  return `${n} card${n === 1 ? '' : 's'}`;
}

export function pointsLabel(n: number): string {
  return `${n} point${n === 1 ? '' : 's'}`;
}

/** "A, B and C" / "A, B or C". */
export function joinWords(items: readonly string[], conjunction: 'and' | 'or' = 'and'): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

/** "the 3♥, the K♣ or the 8♠" */
export function shortList(cards: readonly CardCode[], conjunction: 'and' | 'or' = 'and'): string {
  return joinWords(
    cards.map((c) => `the ${cardShort(c)}`),
    conjunction,
  );
}

/** "you and Player 2" */
export function listSeats(seats: readonly PlayerId[]): string {
  return joinWords(seats.map(seatObject)) || 'nobody';
}

const OK: MoveCheck = { ok: true };
const no = (reason: string): MoveCheck => ({ ok: false, reason });

/** Everything the play rules need to explain a card play. */
export interface PlayContext extends Pile {
  /** Seat that played the Eight on top (and named the suit); null when the top isn't an Eight. */
  namedBy: PlayerId | null;
  /** Can the player draw right now (stock not empty, or a reshuffle is available)? */
  canDraw: boolean;
}

/** The friendly "what you could do instead" hint added to a rejected play. */
function insteadHint(hand: readonly CardCode[], ctx: PlayContext): string {
  const playable = playableCards(hand, ctx);
  const nonEight = playable.find((c) => !isEight(c));
  const eight = playable.find((c) => isEight(c));
  if (nonEight) return ` Your ${cardShort(nonEight)} would work.`;
  if (eight) return ` Your ${cardShort(eight)} is wild, so you could play that and name a suit.`;
  return ctx.canDraw
    ? ' Nothing in your hand matches, so draw a card from the stock.'
    : ' Nothing in your hand matches and the stock is empty, so you have to pass.';
}

/**
 * Can `card` (with the named `suit`, for an Eight) be played from `hand` on the pile?
 * Returns a specific, beginner-friendly reason for every way the play can be illegal:
 *  1. You can only play a card you hold.
 *  2. An Eight needs a named suit (one of the four suits).
 *  3. Only an Eight names a suit.
 *  4. The card must match the active suit or the top card's rank (or be an Eight).
 */
export function checkPlayCard(
  hand: readonly CardCode[],
  ctx: PlayContext,
  card: CardCode,
  suit: unknown,
): MoveCheck {
  if (!hand.includes(card)) {
    return no(`You don't have the ${cardShort(card)} — pick a card from your own hand.`);
  }
  if (isEight(card)) {
    if (suit === undefined || suit === null) {
      return no(
        `Eights are wild! Choose the suit the next player must follow — Spades, Hearts, Diamonds or Clubs — when you play your ${cardShort(card)}.`,
      );
    }
    if (!isSuit(suit)) {
      return no(
        'Pick one of the four suits for your Eight to name: Spades, Hearts, Diamonds or Clubs.',
      );
    }
    return OK;
  }
  if (suit !== undefined && suit !== null) {
    return no(
      `Only an Eight lets you name a new suit — the ${cardShort(card)} simply plays as ${suitWithArticle(suitOf(card))}.`,
    );
  }
  if (canPlay(card, ctx)) return OK;
  const hint = insteadHint(hand, ctx);
  if (isEight(ctx.top)) {
    const named = SUIT_NAMES[ctx.activeSuit];
    if (suitOf(card) === suitOf(ctx.top)) {
      const namer = ctx.namedBy === null ? 'its player' : seatObject(ctx.namedBy);
      return no(
        `The Eight on the pile is ${suitWithArticle(suitOf(ctx.top))}, but ${namer} named ${named} — so you need ${suitWithArticle(ctx.activeSuit)} or another Eight.${hint}`,
      );
    }
    const who =
      ctx.namedBy === null
        ? 'An Eight was played and'
        : `${seatLabel(ctx.namedBy)} played an Eight and`;
    return no(
      `${who} named ${named}, so you need ${suitWithArticle(ctx.activeSuit)} or another Eight — the ${cardShort(card)} won't do.${hint}`,
    );
  }
  return no(
    `The ${cardShort(card)} doesn't match the ${cardShort(ctx.top)}: you need ${needWords(ctx)}.${hint}`,
  );
}

/** Seats with the lowest total (every tied seat is a winner). */
export function lowestSeats(totals: readonly number[]): PlayerId[] {
  const best = Math.min(...totals);
  const out: PlayerId[] = [];
  totals.forEach((t, i) => {
    if (t === best) out.push(i);
  });
  return out;
}

/**
 * Winner-takes-the-pot payout in stake units: every loser pays 1 unit and the winners
 * share the pot. A sole winner gets +(players − 1); k tied winners get (players − k)/k each;
 * if every seat ties nobody pays (0). The payouts of all seats always sum to 0.
 */
export function payoutUnits(seat: PlayerId, winners: readonly PlayerId[], players: number): number {
  if (winners.length === 0 || winners.length >= players) return 0;
  if (!winners.includes(seat)) return -1;
  return (players - winners.length) / winners.length;
}

/** Count of non-Eight cards per suit. */
export function suitCounts(hand: readonly CardCode[]): Record<Suit, number> {
  const counts: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 };
  for (const c of hand) if (!isEight(c)) counts[suitOf(c)]++;
  return counts;
}
