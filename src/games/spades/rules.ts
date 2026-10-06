/**
 * Pure Spades rule helpers shared by the engine, the bots/coach and the tests.
 * Everything here works on small inputs (a hand, a trick, the bids and trick
 * counts), so every rule can be unit-tested in isolation.
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

export const SEATS = 4;
export const HAND_SIZE = 13;
export const TRICKS_PER_HAND = 13;
/** The highest possible bid (every trick in the hand). */
export const MAX_BID = 13;
/** A bid of 0 is a Nil bid. */
export const NIL = 0;
/** Points won (or lost) for a Nil bid that succeeds (or fails). */
export const NIL_POINTS = 100;
/** Spades are always trump. */
export const TRUMP: Suit = 'S';

/** One card played to a trick. */
export interface SpadesPlay {
  seat: PlayerId;
  card: CardCode;
}

/** Team 0 = the learner (seat 0) and partner (seat 2); team 1 = seats 1 and 3. */
export type Team = 0 | 1;

/** Ace-high rank used for every comparison in Spades (2 = 2 … A = 14). */
export const rank = rankNumberAceHigh;

export const teamOf = (seat: PlayerId): Team => (seat % 2 === 0 ? 0 : 1);
export const partnerOf = (seat: PlayerId): PlayerId => (seat + 2) % SEATS;
export const nextSeat = (seat: PlayerId): PlayerId => (seat + 1) % SEATS;
export const teamSeats = (team: Team): [PlayerId, PlayerId] => (team === 0 ? [0, 2] : [1, 3]);
export const isSpade = (card: CardCode): boolean => suitOf(card) === TRUMP;

/** Does `card` beat `best` (the card currently winning a trick whose led suit is `led`)? */
export function beats(card: CardCode, best: CardCode, led: Suit): boolean {
  const s = suitOf(card);
  const b = suitOf(best);
  if (s === b) return rank(card) > rank(best);
  if (s === TRUMP) return true;
  if (b === TRUMP) return false;
  // Neither is a Spade and the suits differ: only the led suit can win.
  return s === led && b !== led;
}

/**
 * The play currently winning a (possibly partial) trick: the highest Spade if
 * any Spade was played, otherwise the highest card of the suit that was led.
 */
export function winningPlay(plays: readonly SpadesPlay[]): SpadesPlay {
  const first = plays[0];
  if (!first) throw new Error('winningPlay: the trick is empty');
  const led = suitOf(first.card);
  let best = first;
  for (const p of plays) if (beats(p.card, best.card, led)) best = p;
  return best;
}

/**
 * Does playing `card` onto the (possibly empty) `trick` break Spades? Only a Spade
 * played on a trick of ANOTHER suit does — i.e. a player who couldn't follow suit
 * trumped or threw away a Spade. Leading a Spade (allowed before Spades are broken
 * only when the leader holds nothing but Spades) and following a Spade lead do not.
 */
export function breaksSpades(trick: readonly SpadesPlay[], card: CardCode): boolean {
  const lead = trick[0];
  return lead !== undefined && !isSpade(lead.card) && isSpade(card);
}

/** Everything the play rules need to know about the table. */
export interface PlayContext {
  /** Cards already played to the current trick, in order. */
  trick: readonly SpadesPlay[];
  /** Has a Spade been played on a trick of another suit yet (see breaksSpades)? */
  spadesBroken: boolean;
}

function suitList(suits: readonly Suit[]): string {
  const names = suits.map((s) => `a ${SUIT_SINGULAR[s]}`);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** Lowest-ranked card of `suit` in `hand` (used as an example in explanations). */
export function lowestOfSuit(hand: readonly CardCode[], suit: Suit): CardCode | undefined {
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
 *  2. Spades can't be led until broken (see breaksSpades), unless you hold
 *     nothing but Spades.
 *  3. Follow suit if you can (when you can't, any card is fine — a Spade "trumps").
 */
export function checkPlay(hand: readonly CardCode[], ctx: PlayContext, card: CardCode): MoveCheck {
  if (!hand.includes(card)) {
    return {
      ok: false,
      reason: `You don't have the ${cardName(card)} in your hand — pick one of your own cards.`,
    };
  }
  const lead = ctx.trick[0];
  if (!lead) {
    if (isSpade(card) && !ctx.spadesBroken) {
      const others = (['H', 'C', 'D'] as const).filter((s) => hand.some((c) => suitOf(c) === s));
      if (others.length > 0) {
        return {
          ok: false,
          reason: `Spades aren't broken yet — you can't lead a Spade until someone has played a Spade on a trick of another suit (because they had none of the suit that was led). Lead ${suitList(others)} instead.`,
        };
      }
    }
    return { ok: true };
  }
  const led = suitOf(lead.card);
  if (suitOf(card) !== led) {
    const example = lowestOfSuit(hand, led);
    if (example) {
      const trumpNote =
        isSpade(card) && led !== TRUMP
          ? ' You may only trump with a Spade when you have no cards of the led suit.'
          : '';
      return {
        ok: false,
        reason: `You must follow suit: ${SUIT_NAMES[led]} were led and you still have a ${SUIT_SINGULAR[led]} (like your ${cardShort(example)}), so you have to play one.${trumpNote}`,
      };
    }
  }
  return { ok: true };
}

/** Every card in `hand` that may legally be played right now (hand order). */
export function legalPlays(hand: readonly CardCode[], ctx: PlayContext): CardCode[] {
  return hand.filter((c) => checkPlay(hand, ctx, c).ok);
}

/** Result of one Nil bid. */
export interface NilResult {
  seat: PlayerId;
  made: boolean;
  /** Tricks the Nil bidder took (0 when made). */
  tricks: number;
}

/** How one partnership scored the hand. */
export interface TeamScore {
  team: Team;
  /** The team's contract: the sum of its partners' non-Nil bids. */
  contract: number;
  /** Tricks won by partners who did not bid Nil — only these count toward the contract. */
  contractTricks: number;
  /** All tricks the team won (including any taken by a Nil bidder). */
  tricks: number;
  /** Whether the contract was made (always true for a contract of 0). */
  made: boolean;
  /** +10 × contract when made, −10 × contract when failed. */
  contractPoints: number;
  /**
   * Bags (1 point each): overtricks beyond a made contract, plus every trick a
   * Nil bidder took (those never count toward the partner's contract).
   */
  bags: number;
  nils: NilResult[];
  /** +100 per successful Nil, −100 per failed Nil. */
  nilPoints: number;
  /** contractPoints + bags + nilPoints. */
  total: number;
}

/**
 * Score one partnership from the four bids and the tricks each seat won.
 *  - Contract = sum of the non-Nil bids. Made → 10 × contract + 1 per overtrick
 *    (bag); failed → −10 × contract.
 *  - Nil: +100 if the bidder took no tricks, −100 otherwise. A Nil bidder's
 *    tricks never count toward the partner's contract but do count as bags.
 */
export function scoreTeam(
  team: Team,
  bids: readonly number[],
  tricksWon: readonly number[],
): TeamScore {
  let contract = 0;
  let contractTricks = 0;
  let nilTricks = 0;
  const nils: NilResult[] = [];
  for (const seat of teamSeats(team)) {
    const bid = bids[seat] ?? 0;
    const won = tricksWon[seat] ?? 0;
    if (bid === NIL) {
      nils.push({ seat, made: won === 0, tricks: won });
      nilTricks += won;
    } else {
      contract += bid;
      contractTricks += won;
    }
  }
  const made = contractTricks >= contract;
  const contractPoints = made ? 10 * contract : -10 * contract;
  const overtricks = made ? contractTricks - contract : 0;
  const bags = overtricks + nilTricks;
  const nilPoints = nils.reduce((sum, n) => sum + (n.made ? NIL_POINTS : -NIL_POINTS), 0);
  return {
    team,
    contract,
    contractTricks,
    tricks: contractTricks + nilTricks,
    made,
    contractPoints,
    bags,
    nils,
    nilPoints,
    total: contractPoints + bags + nilPoints,
  };
}

/** Both partnerships' scores: [learner's team (0 & 2), opponents (1 & 3)]. */
export function scoreHand(
  bids: readonly number[],
  tricksWon: readonly number[],
): [TeamScore, TeamScore] {
  return [scoreTeam(0, bids, tricksWon), scoreTeam(1, bids, tricksWon)];
}

/** Betting result for the learner: +1 unit if their team scores more, −1 if less, 0 on a tie. */
export function payoutUnits(learnerTeamScore: number, opponentScore: number): number {
  if (learnerTeamScore > opponentScore) return 1;
  if (learnerTeamScore < opponentScore) return -1;
  return 0;
}

/** Tricks a team still needs to make its contract (0 once made). */
export function tricksNeeded(
  team: Team,
  bids: readonly (number | null)[],
  tricksWon: readonly number[],
): number {
  let contract = 0;
  let have = 0;
  for (const seat of teamSeats(team)) {
    const bid = bids[seat];
    if (bid === null || bid === undefined || bid === NIL) continue;
    contract += bid;
    have += tricksWon[seat] ?? 0;
  }
  return Math.max(0, contract - have);
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

/** "Nil" / "1 trick" / "4 tricks". */
export function bidLabel(bid: number): string {
  if (bid === NIL) return 'Nil';
  return tricksLabel(bid);
}

export function tricksLabel(n: number): string {
  return `${n} trick${n === 1 ? '' : 's'}`;
}

export function pointsLabel(n: number): string {
  return `${n} point${n === 1 || n === -1 ? '' : 's'}`;
}

/** "the Ace of Spades" */
export function theCard(card: CardCode): string {
  return `the ${cardName(card)}`;
}
