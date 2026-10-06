/**
 * Baccarat (Punto Banco) — constants, card values, the drawing rules (the "tableau") and
 * payouts (docs/RULES_DECISIONS.md → Baccarat, docs/engine-notes/baccarat.md). Everything
 * here is a pure function of its arguments; the engine (engine.ts) wraps it in the
 * GameEngine contract, and the tests check every cell of the tableau directly.
 *
 * Card values: Ace = 1, 2–9 = face value, 10/J/Q/K = 0. A hand's total is the sum of its
 * card values modulo 10 (only the last digit counts), so totals run from 0 to 9.
 *
 * The coup: two cards each, dealt Player, Banker, Player, Banker. A two-card 8 or 9 is a
 * **natural** and both hands stand. Otherwise the Player hand draws a third card on 0–5
 * and stands on 6–7. If the Player stood, the Banker draws on 0–5 and stands on 6–7. If
 * the Player drew, the Banker follows the standard table (see `bankerDraws`). The total
 * closer to 9 wins; equal totals are a tie.
 */
import { type CardCode, isJoker, rankOf } from '@/games/core/cards';
import type { PlayerId } from '@/games/core/types';

// ---------------------------------------------------------------------------
// Seats, hands, bets
// ---------------------------------------------------------------------------

/** Seat 0: the learner, who bets (a bot in simulations). */
export const LEARNER: PlayerId = 0;
/** Seat 1: the dealer, whose only move is the forced deal of the next card. */
export const DEALER: PlayerId = 1;
export const SEATS = 2;

/** The two hands on the table. Neither belongs to a seat: the dealer deals both. */
export type Hand = 'player' | 'banker';
export const HANDS: readonly Hand[] = ['player', 'banker'];

/** What the learner can bet on. */
export type BetOn = 'player' | 'banker' | 'tie';
export const BETS: readonly BetOn[] = ['player', 'banker', 'tie'];

/** How a coup ends: one hand wins, or the totals are equal. */
export type CoupWinner = 'player' | 'banker' | 'tie';

export const HAND_NAMES: Readonly<Record<Hand, string>> = { player: 'Player', banker: 'Banker' };
export const BET_NAMES: Readonly<Record<BetOn, string>> = {
  player: 'Player',
  banker: 'Banker',
  tie: 'Tie',
};

export function isBetOn(value: unknown): value is BetOn {
  return value === 'player' || value === 'banker' || value === 'tie';
}

export function otherHand(hand: Hand): Hand {
  return hand === 'player' ? 'banker' : 'player';
}

// ---------------------------------------------------------------------------
// The shoe
// ---------------------------------------------------------------------------

/** The variant taught: an 8-deck shoe, shuffled fresh for every coup. */
export const DEFAULT_DECKS = 8;
export const MIN_DECKS = 1;
export const MAX_DECKS = 8;
export const CARDS_PER_DECK = 52;
/** A coup uses at most six cards: two each plus one third card each. */
export const MAX_CARDS_PER_COUP = 6;
/** The longest game in moves: the bet plus one forced deal per card. */
export const MAX_GAME_MOVES = 1 + MAX_CARDS_PER_COUP;

// ---------------------------------------------------------------------------
// Card values and totals
// ---------------------------------------------------------------------------

/** A two-card total of 8 or 9 is a natural. */
export const NATURAL_MIN = 8;
/** The Player hand draws on 0–5 and stands on 6 or 7. */
export const PLAYER_DRAWS_MAX = 5;
/** With no Player third card, the Banker also draws on 0–5 and stands on 6 or 7. */
export const BANKER_DRAWS_MAX_WHEN_PLAYER_STOOD = 5;

/** Baccarat value of one card: Ace = 1, 2–9 = face value, 10, Jack, Queen, King = 0. */
export function cardPoints(card: CardCode): number {
  if (isJoker(card)) throw new RangeError('Baccarat is played without jokers.');
  const rank = rankOf(card);
  if (rank === 'A') return 1;
  if (rank === 'T' || rank === 'J' || rank === 'Q' || rank === 'K') return 0;
  return Number(rank);
}

/** A hand's total: the sum of its card values, keeping only the last digit (0–9). */
export function handTotal(cards: readonly CardCode[]): number {
  let sum = 0;
  for (const c of cards) sum += cardPoints(c);
  return sum % 10;
}

/** A natural: exactly two cards totalling 8 or 9. */
export function isNatural(cards: readonly CardCode[]): boolean {
  return cards.length === 2 && handTotal(cards) >= NATURAL_MIN;
}

function checkTotal(total: number, who: string): void {
  if (!Number.isInteger(total) || total < 0 || total > 9) {
    throw new RangeError(`Baccarat: a ${who} total is a whole number from 0 to 9 (got ${total}).`);
  }
}

/**
 * Whether the Player hand takes a third card (no natural on the table): draw on 0–5,
 * stand on 6–7. An 8 or 9 never reaches this rule — it is a natural.
 */
export function playerDraws(playerTotal: number): boolean {
  checkTotal(playerTotal, 'Player');
  return playerTotal <= PLAYER_DRAWS_MAX;
}

/**
 * The standard Banker tableau. `playerThird` is the VALUE (0–9) of the Player's third
 * card, or null when the Player stood. Assumes no natural is on the table (the deal stops
 * before this rule is consulted); an 8 or 9 always stands.
 *
 *   Player stood         → Banker draws on 0–5, stands on 6–7.
 *   Player drew, Banker  0–2 → draws
 *                        3   → draws unless the Player's third card is an 8
 *                        4   → draws if the Player's third card is 2–7
 *                        5   → draws if the Player's third card is 4–7
 *                        6   → draws if the Player's third card is 6–7
 *                        7   → stands
 */
export function bankerDraws(bankerTotal: number, playerThird: number | null): boolean {
  checkTotal(bankerTotal, 'Banker');
  if (playerThird !== null) checkTotal(playerThird, 'third-card');
  if (bankerTotal >= NATURAL_MIN) return false;
  if (playerThird === null) return bankerTotal <= BANKER_DRAWS_MAX_WHEN_PLAYER_STOOD;
  switch (bankerTotal) {
    case 0:
    case 1:
    case 2:
      return true;
    case 3:
      return playerThird !== 8;
    case 4:
      return playerThird >= 2 && playerThird <= 7;
    case 5:
      return playerThird >= 4 && playerThird <= 7;
    case 6:
      return playerThird === 6 || playerThird === 7;
    default:
      return false;
  }
}

/** Which hand is closer to 9, or a tie on equal totals. */
export function coupWinner(playerTotal: number, bankerTotal: number): CoupWinner {
  if (playerTotal > bankerTotal) return 'player';
  if (bankerTotal > playerTotal) return 'banker';
  return 'tie';
}

// ---------------------------------------------------------------------------
// Payouts
// ---------------------------------------------------------------------------

/**
 * Winnings per unit on a winning bet: Player pays 1 to 1, Banker 0.95 to 1 (1 to 1 less
 * the 5% commission), Tie 8 to 1.
 */
export const PAYOUT: Readonly<Record<BetOn, number>> = { player: 1, banker: 0.95, tie: 8 };
/** The house's commission on a winning Banker bet. */
export const BANKER_COMMISSION = 0.05;
/** Betting: the only commitment is the single one-unit bet. */
export const MAX_LOSS_UNITS = 1;
/** The best possible result: a winning Tie bet. */
export const MAX_WIN_UNITS = PAYOUT.tie;

/** "8 to 1", "0.95 to 1" — how the payout is said at the table. */
export const PAYOUT_WORDS: Readonly<Record<BetOn, string>> = {
  player: '1 to 1',
  banker: '0.95 to 1',
  tie: '8 to 1',
};

/**
 * Net stake units for a bet once the coup is decided: the payout on a win, −1 on a loss.
 * Player and Banker bets **push** (0, the bet comes back) when the coup is a tie.
 */
export function netUnits(bet: BetOn, winner: CoupWinner): number {
  if (bet === winner) return PAYOUT[bet];
  if (winner === 'tie') return 0;
  return -1;
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** "You" for the learner's seat, "Player N" otherwise (the UI swaps in persona names). */
export function seatName(player: PlayerId): string {
  return player === LEARNER ? 'You' : `Player ${player}`;
}

/** Present-tense verb agreeing with seatName: "You bet" / "Player 1 deals". */
export function verbFor(player: PlayerId, base: string, third: string): string {
  return player === LEARNER ? base : third;
}

/** "Player wins, 7 to 5" / "Banker wins, 6 to 2" / "it’s a tie at 6". */
export function outcomePhrase(
  winner: CoupWinner,
  playerTotal: number,
  bankerTotal: number,
): string {
  if (winner === 'tie') return `it’s a tie at ${playerTotal}`;
  const [mine, theirs] =
    winner === 'player' ? [playerTotal, bankerTotal] : [bankerTotal, playerTotal];
  return `${HAND_NAMES[winner]} wins, ${mine} to ${theirs}`;
}

/** "Player has 5" / "Banker has a natural 9" — after the hand has at least two cards. */
export function handPhrase(hand: Hand, cards: readonly CardCode[]): string {
  const total = handTotal(cards);
  return isNatural(cards)
    ? `${HAND_NAMES[hand]} has a natural ${total}`
    : `${HAND_NAMES[hand]} has ${total}`;
}

/** Plain-language reason for the Player's draw/stand decision on `total` (no natural). */
export function playerRuleWhy(total: number): string {
  return playerDraws(total)
    ? `Player has ${total}, and Player always draws a third card on 0–5.`
    : `Player has ${total}, and Player always stands on 6 or 7.`;
}

/**
 * Plain-language reason for the Banker's draw/stand decision on `total` (no natural), given
 * the value of the Player's third card (null when the Player stood).
 */
export function bankerRuleWhy(total: number, playerThird: number | null): string {
  const draws = bankerDraws(total, playerThird);
  const verdict = draws ? 'so Banker draws a third card' : 'so Banker stands';
  if (playerThird === null) {
    return `Player stood, and then Banker follows the same rule — draw on 0–5, stand on 6 or 7. Banker has ${total}, ${verdict}.`;
  }
  const third = `Player’s third card was worth ${playerThird}`;
  switch (total) {
    case 0:
    case 1:
    case 2:
      return `Banker has ${total}, and Banker always draws on 0–2, ${verdict}.`;
    case 3:
      return `Banker has 3, which draws unless Player’s third card was an 8. ${third}, ${verdict}.`;
    case 4:
      return `Banker has 4, which draws only if Player’s third card was 2–7. ${third}, ${verdict}.`;
    case 5:
      return `Banker has 5, which draws only if Player’s third card was 4–7. ${third}, ${verdict}.`;
    case 6:
      return `Banker has 6, which draws only if Player’s third card was a 6 or 7. ${third}, ${verdict}.`;
    default:
      return `Banker has ${total}, and Banker always stands on 7, ${verdict}.`;
  }
}
