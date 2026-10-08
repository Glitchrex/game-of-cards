/**
 * Pure Hearts rule helpers shared by the engine, the bots/coach and the tests.
 * Nothing in here touches state shape beyond the small inputs it is given, so
 * every rule can be unit-tested in isolation.
 */
import {
  cardName,
  cardShort,
  rankNumberAceHigh,
  suitOf,
  SUIT_NAMES,
  SUIT_SINGULAR,
  type CardCode,
  type Suit,
} from '@/games/core/cards';
import type { MoveCheck, PlayerId } from '@/games/core/types';
import type { HeartsPassDirection, HeartsPlay } from './engine';

export const SEATS = 4;
export const HAND_SIZE = 13;
export const TRICKS_PER_HAND = 13;
export const PASS_SIZE = 3;
/** 13 Hearts × 1 point + the Queen of Spades × 13 points. */
export const TOTAL_POINTS = 26;
export const QUEEN_OF_SPADES: CardCode = 'QS';
export const TWO_OF_CLUBS: CardCode = '2C';
export const PASS_DIRECTIONS: readonly HeartsPassDirection[] = ['left', 'right', 'across', 'hold'];

const OK: MoveCheck = { ok: true };
const no = (reason: string): MoveCheck => ({ ok: false, reason });

/** Penalty points a single card is worth: 1 per Heart, 13 for the Queen of Spades. */
export function cardPoints(card: CardCode): number {
  if (card === QUEEN_OF_SPADES) return 13;
  return suitOf(card) === 'H' ? 1 : 0;
}

export function isPointCard(card: CardCode): boolean {
  return cardPoints(card) > 0;
}

export function pointsIn(cards: readonly CardCode[]): number {
  let total = 0;
  for (const c of cards) total += cardPoints(c);
  return total;
}

/** Ace-high rank used for every comparison in Hearts (2 = 2 … A = 14). */
export const rank = rankNumberAceHigh;

/** How many seats clockwise the 3 passed cards travel. */
export function passOffset(direction: HeartsPassDirection): number {
  switch (direction) {
    case 'left':
      return 1;
    case 'across':
      return 2;
    case 'right':
      return 3;
    case 'hold':
      return 0;
  }
}

/** The seat that receives `seat`'s passed cards. */
export function passTarget(seat: PlayerId, direction: HeartsPassDirection): PlayerId {
  return (seat + passOffset(direction)) % SEATS;
}

/** The seat whose passed cards `seat` receives. */
export function passSource(seat: PlayerId, direction: HeartsPassDirection): PlayerId {
  return (seat - passOffset(direction) + SEATS) % SEATS;
}

/** The play currently winning a (possibly partial) trick: highest card of the led suit. */
export function winningPlay(plays: readonly HeartsPlay[]): HeartsPlay {
  const first = plays[0];
  if (!first) throw new Error('winningPlay: the trick is empty');
  const led = suitOf(first.card);
  let best = first;
  for (const p of plays) {
    if (suitOf(p.card) === led && rank(p.card) > rank(best.card)) best = p;
  }
  return best;
}

/** Everything the play rules need to know about the table. */
export interface PlayContext {
  /** Cards already played to the current trick, in order. */
  trick: readonly HeartsPlay[];
  /** 0-based index of the current trick (0 = the first trick). */
  trickIndex: number;
  /** Has a Heart been played on an earlier trick (or earlier in this one)? */
  heartsBroken: boolean;
}

function suitList(suits: readonly Suit[]): string {
  const names = suits.map((s) => `a ${SUIT_SINGULAR[s]}`);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** Lowest-ranked card of `suit` in `hand` (used as an example in explanations). */
function lowestOfSuit(hand: readonly CardCode[], suit: Suit): CardCode | undefined {
  let best: CardCode | undefined;
  for (const c of hand) {
    if (suitOf(c) === suit && (best === undefined || rank(c) < rank(best))) best = c;
  }
  return best;
}

/**
 * Can `card` be played from `hand` right now? Returns a friendly, specific
 * explanation for every way it can be illegal. Rules, in the order checked:
 *  1. You can only play a card you hold.
 *  2. The first trick is led with the Two of Clubs.
 *  3. Hearts can't be led until broken, unless you hold nothing but Hearts.
 *  4. Follow suit if you can.
 *  5. No point cards on the first trick unless you hold nothing else.
 */
export function checkPlay(hand: readonly CardCode[], ctx: PlayContext, card: CardCode): MoveCheck {
  if (!hand.includes(card)) {
    return no(`You don't have the ${cardName(card)} in your hand — pick one of your own cards.`);
  }
  const firstTrick = ctx.trickIndex === 0;
  const lead = ctx.trick[0];
  if (!lead) {
    if (firstTrick && hand.includes(TWO_OF_CLUBS) && card !== TWO_OF_CLUBS) {
      return no(
        'The first trick always starts with the Two of Clubs — you hold it, so lead the 2♣.',
      );
    }
    if (suitOf(card) === 'H' && !ctx.heartsBroken) {
      const others = (['S', 'C', 'D'] as const).filter((s) => hand.some((c) => suitOf(c) === s));
      if (others.length > 0) {
        return no(
          `Hearts aren't broken yet — you can't lead a Heart until someone has played one on an earlier trick. Lead ${suitList(others)} instead.`,
        );
      }
    }
    return OK;
  }
  const led = suitOf(lead.card);
  if (suitOf(card) !== led) {
    const example = lowestOfSuit(hand, led);
    if (example) {
      return no(
        `You must follow suit: ${SUIT_NAMES[led]} were led and you still have a ${SUIT_SINGULAR[led]} (like your ${cardShort(example)}), so you have to play one.`,
      );
    }
  }
  if (firstTrick && isPointCard(card)) {
    const safe = hand.find((c) => !isPointCard(c));
    if (safe) {
      const what = card === QUEEN_OF_SPADES ? 'the Queen of Spades' : 'a Heart';
      return no(
        `No points on the first trick: you can't play ${what} on the first trick while you still have a card that isn't worth points (like your ${cardShort(safe)}).`,
      );
    }
  }
  return OK;
}

/** Every card in `hand` that may legally be played right now (hand order). */
export function legalPlays(hand: readonly CardCode[], ctx: PlayContext): CardCode[] {
  return hand.filter((c) => checkPlay(hand, ctx, c).ok);
}

export interface HandScore {
  /** Final hand score per seat after the shoot-the-moon rule. */
  scores: number[];
  /** Seat that took all 26 points, if any. */
  moonShooter: PlayerId | null;
}

/**
 * Turn raw captured points into hand scores. Shooting the moon (one seat took
 * all 26 points) scores 0 for the shooter and 26 for everyone else.
 */
export function scoreHand(rawPoints: readonly number[]): HandScore {
  const shooter = rawPoints.findIndex((p) => p === TOTAL_POINTS);
  if (shooter >= 0) {
    return {
      scores: rawPoints.map((_, i) => (i === shooter ? 0 : TOTAL_POINTS)),
      moonShooter: shooter,
    };
  }
  return { scores: rawPoints.slice(), moonShooter: null };
}

/** Seats with the lowest score (every tied seat is a winner). */
export function lowestScorers(scores: readonly number[]): PlayerId[] {
  const best = Math.min(...scores);
  const out: PlayerId[] = [];
  scores.forEach((s, i) => {
    if (s === best) out.push(i);
  });
  return out;
}

/**
 * Winner-takes-pot payout in stake units: every loser pays 1 unit into the pot
 * and the winners split it. With 4 seats: sole winner +3, two winners +1 each,
 * three winners +1/3 each, losers −1. The payouts of all seats sum to 0.
 */
export function payoutUnits(
  seat: PlayerId,
  winners: readonly PlayerId[],
  seats: number = SEATS,
): number {
  if (winners.length === 0) return 0;
  if (!winners.includes(seat)) return -1;
  return (seats - winners.length) / winners.length;
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

/** Present-tense verb agreeing with seatLabel(): ("win", "wins") → "win" for you. */
export function verbFor(seat: PlayerId, you: string, other: string): string {
  return seat === 0 ? you : other;
}

export function pointsLabel(n: number): string {
  return `${n} point${n === 1 ? '' : 's'}`;
}

/** "the Queen of Spades, the Ace of Hearts and the Two of Clubs" */
export function listCardNames(cards: readonly CardCode[]): string {
  const names = cards.map((c) => `the ${cardName(c)}`);
  if (names.length <= 1) return names[0] ?? 'no cards';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "Player 1 and Player 3" / "you, Player 1 and Player 2" */
export function listSeats(seats: readonly PlayerId[]): string {
  const names = seats.map(seatObject);
  if (names.length <= 1) return names[0] ?? 'nobody';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Plain-words direction for the coach: "on your left". */
export function directionWords(direction: HeartsPassDirection): string {
  switch (direction) {
    case 'left':
      return 'on your left';
    case 'right':
      return 'on your right';
    case 'across':
      return 'across the table';
    case 'hold':
      return 'nobody';
  }
}
