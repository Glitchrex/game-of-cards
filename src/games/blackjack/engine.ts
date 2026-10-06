/**
 * Blackjack (21) — the REFERENCE engine. Other engines imitate its structure:
 *
 *   1. Types (state + moves) — plain JSON data, no classes, no functions.
 *   2. Small pure helpers that read the state ("queries") — also exported for the UI.
 *   3. Legality: ONE function per kind of move that returns a friendly reason or null.
 *      legalMoves() and checkMove() are both built from these, so they can never disagree.
 *   4. Transitions: small pure functions that return a NEW state (never mutate).
 *   5. Settlement + result flags, re-derivable from the final state.
 *   6. Words: describeMove / coach / summary in plain beginner English.
 *   7. The engine object wiring it all to GameEngine.
 *
 * Rules (docs/RULES_DECISIONS.md): 6-deck shoe shuffled fresh every round; one learner
 * (seat 0) against the dealer (seat 1). Dealer stands on all 17s (S17) and peeks for
 * Blackjack when showing an Ace or a ten-value card. Blackjack pays 3:2, a win pays 1:1,
 * equal totals push. Double on any first two cards (also after a split). Split any pair
 * once; split Aces get one card each, and 21 after a split is not a Blackjack. No surrender,
 * no insurance. A hand that reaches 21 stands automatically.
 *
 * The dealer seat only ever has ONE legal move (reveal → dealer-hit… → dealer-stand), so the
 * UI can animate the dealer one card at a time just by asking the bot for its move.
 *
 * Hidden information: the dealer's hole card (dealer[1] until `holeRevealed`) and the shoe
 * are in the state, as the engine contract requires; the UI must not show them, and the
 * learner's bot/coach logic only reads the learner's cards and the dealer's upcard.
 */
import {
  cardName,
  makeDeck,
  RANK_NAMES,
  rankOf,
  type CardCode,
  type Rank,
} from '@/games/core/cards';
import { shuffle, type Rng } from '@/games/core/rng';
import {
  assertLegal,
  type CoachAdvice,
  type Difficulty,
  type GameConfig,
  type GameEngine,
  type GameResult,
  type MoveCheck,
  type PlayerId,
  type ResultFlags,
} from '@/games/core/types';
import {
  BLACKJACK_TOTAL,
  describeTotal,
  handValue,
  isAce,
  isBlackjack,
  isPair,
  isTenValue,
  upcardPhrase,
} from './hand';
import { basicStrategy, strategyAdvice } from './strategy';

export {
  BLACKJACK_TOTAL,
  cardPoints,
  describeTotal,
  handValue,
  isAce,
  isBlackjack,
  isBust,
  isPair,
  isTenValue,
  upcardNumber,
  upcardPhrase,
  type HandValue,
} from './hand';
export {
  basicStrategy,
  chartCell,
  strategyAdvice,
  type ChartCell,
  type StrategyAction,
  type StrategyAdvice,
  type StrategyOptions,
} from './strategy';

// ---------------------------------------------------------------------------
// 1. Types and constants
// ---------------------------------------------------------------------------

/** Seat 0: the learner (a bot in simulations). */
export const LEARNER: PlayerId = 0;
/** Seat 1: the dealer, who only ever has one forced move. */
export const DEALER: PlayerId = 1;
export const SEATS = 2;

export const DEFAULT_DECKS = 6;
export const MIN_DECKS = 1;
export const MAX_DECKS = 8;
/** The dealer draws on 16 or less and stands on every 17, soft or hard (S17). */
export const DEALER_STANDS_ON = 17;
/** A natural Blackjack pays 3 to 2. */
export const BLACKJACK_PAYS = 1.5;

/** Game-specific options read from `config.options`. */
export interface BlackjackOptions {
  /** 52-card decks in the shoe, 1–8 (default 6, the variant we teach). */
  decks?: number;
}

export interface BlackjackHand {
  cards: CardCode[];
  /** Stake units riding on this hand: 1, or 2 after doubling down. */
  bet: number;
  doubled: boolean;
  /** Came from a split — so 21 in two cards is just 21, not a Blackjack. */
  fromSplit: boolean;
  /** No more decisions: stood, busted, doubled, reached 21, split Aces, or a natural. */
  done: boolean;
  /** History for the "comeback" flag: a card was drawn while this hand was a hard 12–16. */
  hitOnStiff: boolean;
  /** History for the "luckyLastCard" flag: a drawn card (hit/double) made exactly 21. */
  drewTo21: boolean;
}

/**
 * 'player' — the learner is deciding on `hands[activeHand]`.
 * 'dealer' — the dealer is revealing / drawing (one forced move at a time).
 * 'over'   — settled; call result().
 */
export type BlackjackPhase = 'player' | 'dealer' | 'over';

export interface BlackjackState {
  decks: number;
  /** Undealt cards; the next card dealt is shoe[0]. Hidden from the learner. */
  shoe: CardCode[];
  /** dealer[0] = upcard, dealer[1] = hole card (face down until revealed), then hits. */
  dealer: CardCode[];
  holeRevealed: boolean;
  /** The learner's hands: one, or two after a split. */
  hands: BlackjackHand[];
  /** Index of the hand being played (meaningful in the 'player' phase). */
  activeHand: number;
  phase: BlackjackPhase;
  /** Extra stake units the wallet can cover for doubles/splits; null = unlimited. */
  affordableUnits: number | null;
  /** Extra stake units already committed by doubling and splitting. */
  extraUnits: number;
}

export type LearnerMoveType = 'hit' | 'stand' | 'double' | 'split';
export type DealerMoveType = 'reveal' | 'dealer-hit' | 'dealer-stand';

/** Moves carry no data: they always act on the active hand (learner) or the dealer's hand. */
export type BlackjackMove = { type: LearnerMoveType } | { type: DealerMoveType };

/** Every learner action, in button order (the UI may offer all and let checkMove explain). */
export const LEARNER_MOVE_TYPES: readonly LearnerMoveType[] = ['hit', 'stand', 'double', 'split'];
const DEALER_MOVE_TYPES: readonly DealerMoveType[] = ['reveal', 'dealer-hit', 'dealer-stand'];

// ---------------------------------------------------------------------------
// 2. Queries (pure reads of the state, exported for the UI and tests)
// ---------------------------------------------------------------------------

/** The dealer peeks for Blackjack when the upcard is an Ace or a ten-value card. */
export function dealerChecksForBlackjack(upcard: CardCode): boolean {
  return isAce(upcard) || isTenValue(upcard);
}

export function dealerUpcard(state: BlackjackState): CardCode {
  const up = state.dealer[0];
  if (up === undefined) throw new Error('Blackjack: the dealer has no upcard.');
  return up;
}

/** The dealer's cards as the learner sees them: null stands for the face-down hole card. */
export function visibleDealerCards(state: BlackjackState): (CardCode | null)[] {
  return state.dealer.map((c, i) => (i === 1 && !state.holeRevealed ? null : c));
}

/** The hand the learner is playing, or undefined outside the 'player' phase. */
export function activeHand(state: BlackjackState): BlackjackHand | undefined {
  return state.phase === 'player' ? state.hands[state.activeHand] : undefined;
}

/** A natural: the original two-card hand (never a split hand) worth 21. */
export function playerHasBlackjack(state: BlackjackState): boolean {
  const first = state.hands[0];
  return (
    state.hands.length === 1 && first !== undefined && !first.fromSplit && isBlackjack(first.cards)
  );
}

/** HIDDEN until the hole card is revealed — the UI must not use this to spoil the peek. */
export function dealerHasBlackjack(state: BlackjackState): boolean {
  return isBlackjack(state.dealer.slice(0, 2));
}

/**
 * A learner hand's total in words, for labels: "Blackjack", "soft 17", "hard 15", "24 (bust)".
 * Unlike `describeTotal(hand.cards)` it knows that Ace + 10 after a split is a plain 21.
 */
export function describeHand(hand: BlackjackHand): string {
  return describeTotal(hand.cards, { canBeBlackjack: !hand.fromSplit });
}

/** Total stake units at risk: the original bet plus every double/split. */
export function totalBetUnits(state: BlackjackState): number {
  return state.hands.reduce((sum, h) => sum + h.bet, 0);
}

function canAffordExtraBet(state: BlackjackState): boolean {
  return state.affordableUnits === null || state.extraUnits + 1 <= state.affordableUnits;
}

/** True when the dealer must play out the hand (no naturals, and some learner hand is alive). */
function dealerMustPlay(state: BlackjackState): boolean {
  if (playerHasBlackjack(state) || dealerHasBlackjack(state)) return false;
  return state.hands.some((h) => handValue(h.cards).total <= BLACKJACK_TOTAL);
}

/** The dealer's one legal move (only meaningful in the 'dealer' phase). */
function dealerForcedMove(state: BlackjackState): BlackjackMove {
  if (!state.holeRevealed) return { type: 'reveal' };
  return handValue(state.dealer).total < DEALER_STANDS_ON
    ? { type: 'dealer-hit' }
    : { type: 'dealer-stand' };
}

// ---------------------------------------------------------------------------
// 3. Legality — friendly reasons. Each returns null when the move is allowed.
// ---------------------------------------------------------------------------

const CANT_AFFORD =
  'means adding a second bet the same size as your first, and your wallet can’t cover that ' +
  'right now. You can still hit or stand.';

function doubleProblem(state: BlackjackState, hand: BlackjackHand): string | null {
  if (hand.cards.length !== 2) {
    return (
      'You can only double down on your first two cards — you’ve already taken a card on this ' +
      'hand. You can still hit or stand.'
    );
  }
  if (!canAffordExtraBet(state)) return `Doubling down ${CANT_AFFORD}`;
  return null;
}

function splitProblem(state: BlackjackState, hand: BlackjackHand): string | null {
  if (state.hands.length > 1) {
    return 'You can split only once per round — you’re already playing two hands.';
  }
  if (hand.cards.length !== 2) {
    return 'You can only split your first two cards, before you take any more.';
  }
  if (!isPair(hand.cards)) {
    const [a, b] = hand.cards.map((c) => rankWord(rankOf(c)));
    return (
      'You can only split a pair — two cards of the same value, like two 8s (any two 10-value ' +
      `cards, like a King and a Queen, count too). Your ${a} and ${b} aren’t a pair.`
    );
  }
  if (!canAffordExtraBet(state)) return `Splitting ${CANT_AFFORD}`;
  return null;
}

/** Can the learner double down right now? */
export function canDouble(state: BlackjackState): boolean {
  const hand = activeHand(state);
  return hand !== undefined && doubleProblem(state, hand) === null;
}

/** Can the learner split right now? */
export function canSplit(state: BlackjackState): boolean {
  const hand = activeHand(state);
  return hand !== undefined && splitProblem(state, hand) === null;
}

function isMoveType(value: unknown): value is BlackjackMove['type'] {
  return (
    (LEARNER_MOVE_TYPES as readonly unknown[]).includes(value) ||
    (DEALER_MOVE_TYPES as readonly unknown[]).includes(value)
  );
}

function isDealerMoveType(type: BlackjackMove['type']): type is DealerMoveType {
  return (DEALER_MOVE_TYPES as readonly string[]).includes(type);
}

function checkDealerMove(state: BlackjackState, type: DealerMoveType): string | null {
  const total = handValue(state.dealer).total;
  if (type === 'reveal') return state.holeRevealed ? 'The hole card is already face up.' : null;
  if (!state.holeRevealed) return 'The dealer must turn over the face-down hole card first.';
  if (type === 'dealer-stand' && total < DEALER_STANDS_ON) {
    return `The dealer has ${total} and must take another card — dealers always hit on 16 or less.`;
  }
  if (type === 'dealer-hit' && total >= DEALER_STANDS_ON) {
    return (
      `The dealer has ${describeTotal(state.dealer)} and must stand — dealers stand on 17 or ` +
      'more, even a soft 17.'
    );
  }
  return null;
}

/**
 * Casino options our table leaves out (docs/RULES_DECISIONS.md). A learner who has heard of
 * them gets a specific answer rather than "that isn't a move".
 */
const NOT_OFFERED = new Map<string, string>([
  [
    'surrender',
    'Surrender isn’t offered at this table — you play every hand out. (Some casinos let you ' +
      'give up half your bet; see Variants.)',
  ],
  [
    'insurance',
    'Insurance isn’t offered at this table: it’s a side bet on the dealer having Blackjack, ' +
      'and it loses money in the long run. (See Variants.)',
  ],
  [
    'even-money',
    'Even money isn’t offered at this table: it’s insurance in disguise, and a Blackjack is ' +
      'worth more when it’s paid 3 to 2.',
  ],
]);

function checkMove(state: BlackjackState, player: PlayerId, move: BlackjackMove): MoveCheck {
  const no = (reason: string): MoveCheck => ({ ok: false, reason });
  const type: unknown = (move as { type?: unknown } | null | undefined)?.type;
  if (!isMoveType(type)) {
    const notOffered = typeof type === 'string' ? NOT_OFFERED.get(type) : undefined;
    if (notOffered !== undefined) return no(notOffered);
    return no('That isn’t a Blackjack move. You can hit, stand, double down or split.');
  }
  if (player !== LEARNER && player !== DEALER) {
    return no(`There’s no Player ${player} at this table — it’s just you and the dealer.`);
  }
  if (state.phase === 'over') return no('This round is over. Deal a new hand to play again.');
  if (player === LEARNER && isDealerMoveType(type)) {
    return no('Only the dealer can do that — the dealer’s moves happen automatically.');
  }
  if (player === DEALER && !isDealerMoveType(type)) {
    return no(
      'The dealer never chooses moves — the dealer follows fixed house rules: hit on 16 or ' +
        'less, stand on 17 or more.',
    );
  }
  if (currentPlayer(state) !== player) {
    return player === LEARNER
      ? no('It’s the dealer’s turn now, not yours — watch the dealer play out their hand.')
      : no('The dealer waits until you’ve finished all your hands.');
  }
  if (isDealerMoveType(type)) {
    const problem = checkDealerMove(state, type);
    return problem ? no(problem) : { ok: true };
  }
  // currentPlayer() is the learner, so the phase is 'player' and there is an active hand.
  const hand = requireActiveHand(state);
  const problem =
    type === 'double'
      ? doubleProblem(state, hand)
      : type === 'split'
        ? splitProblem(state, hand)
        : null;
  return problem ? no(problem) : { ok: true };
}

function currentPlayer(state: BlackjackState): PlayerId | null {
  if (state.phase === 'player') return LEARNER;
  if (state.phase === 'dealer') return DEALER;
  return null;
}

function legalMoves(state: BlackjackState, player: PlayerId): BlackjackMove[] {
  if (currentPlayer(state) !== player) return [];
  if (player === DEALER) return [dealerForcedMove(state)];
  const moves: BlackjackMove[] = [{ type: 'hit' }, { type: 'stand' }];
  if (canDouble(state)) moves.push({ type: 'double' });
  if (canSplit(state)) moves.push({ type: 'split' });
  return moves;
}

// ---------------------------------------------------------------------------
// 4. Transitions (pure: always build new objects/arrays)
// ---------------------------------------------------------------------------

function drawCard(shoe: readonly CardCode[]): { card: CardCode; shoe: CardCode[] } {
  const card = shoe[0];
  // Unreachable in practice: even a 1-deck shoe holds far more cards than one round can use.
  if (card === undefined) throw new Error('Blackjack: the shoe is empty.');
  return { card, shoe: shoe.slice(1) };
}

function replaceAt<T>(items: readonly T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

function newHand(cards: CardCode[], fromSplit: boolean, done: boolean): BlackjackHand {
  return { cards, bet: 1, doubled: false, fromSplit, done, hitOnStiff: false, drewTo21: false };
}

/** Move on to the next unfinished hand, or hand over to the dealer when none is left. */
function advance(state: BlackjackState): BlackjackState {
  let i = state.activeHand;
  while (i < state.hands.length && state.hands[i]?.done) i++;
  if (i < state.hands.length) return { ...state, activeHand: i };
  return { ...state, phase: 'dealer' };
}

function requireActiveHand(state: BlackjackState): BlackjackHand {
  const hand = activeHand(state);
  if (!hand) throw new Error('Blackjack: no active hand.');
  return hand;
}

/** Hit (one card, keep playing unless 21+) or double (one card, bet ×2, hand finished). */
function learnerDraw(state: BlackjackState, double: boolean): BlackjackState {
  const hand = requireActiveHand(state);
  const before = handValue(hand.cards);
  const { card, shoe } = drawCard(state.shoe);
  const cards = [...hand.cards, card];
  const after = handValue(cards).total;
  const next: BlackjackHand = {
    ...hand,
    cards,
    bet: double ? hand.bet * 2 : hand.bet,
    doubled: hand.doubled || double,
    done: double || after >= BLACKJACK_TOTAL,
    hitOnStiff: hand.hitOnStiff || (!before.soft && before.total >= 12 && before.total <= 16),
    drewTo21: hand.drewTo21 || after === BLACKJACK_TOTAL,
  };
  return advance({
    ...state,
    shoe,
    hands: replaceAt(state.hands, state.activeHand, next),
    extraUnits: state.extraUnits + (double ? hand.bet : 0),
  });
}

function stand(state: BlackjackState): BlackjackState {
  const hand = requireActiveHand(state);
  return advance({
    ...state,
    hands: replaceAt(state.hands, state.activeHand, { ...hand, done: true }),
  });
}

/**
 * Split the pair into two hands of one bet each and deal each its second card straight
 * away. Split Aces get just that one card; any split hand that lands on 21 stands.
 */
function split(state: BlackjackState): BlackjackState {
  const hand = requireActiveHand(state);
  const [a, b] = hand.cards;
  if (a === undefined || b === undefined) throw new Error('Blackjack: split needs two cards.');
  const first = drawCard(state.shoe);
  const second = drawCard(first.shoe);
  const aces = isAce(a);
  const make = (c1: CardCode, c2: CardCode) =>
    newHand([c1, c2], true, aces || handValue([c1, c2]).total === BLACKJACK_TOTAL);
  return advance({
    ...state,
    shoe: second.shoe,
    hands: [make(a, first.card), make(b, second.card)],
    activeHand: 0,
    extraUnits: state.extraUnits + hand.bet,
  });
}

function reveal(state: BlackjackState): BlackjackState {
  const next: BlackjackState = { ...state, holeRevealed: true };
  return dealerMustPlay(next) ? next : { ...next, phase: 'over' };
}

function dealerHit(state: BlackjackState): BlackjackState {
  const { card, shoe } = drawCard(state.shoe);
  const dealer = [...state.dealer, card];
  const bust = handValue(dealer).total > BLACKJACK_TOTAL;
  return { ...state, shoe, dealer, phase: bust ? 'over' : 'dealer' };
}

function applyMove(state: BlackjackState, move: BlackjackMove): BlackjackState {
  assertLegal(blackjackEngine, state, move);
  switch (move.type) {
    case 'hit':
      return learnerDraw(state, false);
    case 'double':
      return learnerDraw(state, true);
    case 'stand':
      return stand(state);
    case 'split':
      return split(state);
    case 'reveal':
      return reveal(state);
    case 'dealer-hit':
      return dealerHit(state);
    case 'dealer-stand':
      return { ...state, phase: 'over' };
  }
}

function readDecks(options: Record<string, unknown> | undefined): number {
  const decks = (options as BlackjackOptions | undefined)?.decks ?? DEFAULT_DECKS;
  if (!Number.isInteger(decks) || decks < MIN_DECKS || decks > MAX_DECKS) {
    throw new RangeError(
      `Blackjack: options.decks must be a whole number from ${MIN_DECKS} to ${MAX_DECKS}.`,
    );
  }
  return decks;
}

function readAffordable(units: number | undefined): number | null {
  if (units === undefined || units === Number.POSITIVE_INFINITY) return null;
  if (Number.isNaN(units)) throw new RangeError('Blackjack: affordableUnits must be a number.');
  return Math.max(0, Math.floor(units));
}

function validateConfig(config: GameConfig): { decks: number; affordableUnits: number | null } {
  if (config.players !== SEATS) {
    throw new RangeError(
      `Blackjack is one learner against the dealer, so it needs exactly ${SEATS} seats ` +
        `(got ${config.players}).`,
    );
  }
  return {
    decks: readDecks(config.options),
    affordableUnits: readAffordable(config.affordableUnits),
  };
}

/** Count of each card code — used to check that a shoe is made of complete decks. */
function cardCounts(cards: readonly CardCode[]): Map<CardCode, number> {
  const counts = new Map<CardCode, number>();
  for (const c of cards) counts.set(c, (counts.get(c) ?? 0) + 1);
  return counts;
}

/**
 * Deal a round from a shoe in a known order: shoe[0] goes to the learner, shoe[1] is the
 * dealer's upcard, shoe[2] the learner's second card, shoe[3] the hole card, and later
 * cards are drawn in order. `setup` uses it with a freshly shuffled shoe; tests and curated
 * practice hands can pass a stacked one. The shoe must be exactly `decks` complete decks.
 */
export function setupWithShoe(config: GameConfig, shoe: readonly CardCode[]): BlackjackState {
  const { decks, affordableUnits } = validateConfig(config);
  const expected = cardCounts(makeDeck({ copies: decks }));
  const actual = cardCounts(shoe);
  const complete =
    shoe.length === decks * 52 &&
    actual.size === expected.size &&
    [...expected].every(([card, n]) => actual.get(card) === n);
  if (!complete) {
    throw new RangeError(`Blackjack: the shoe must hold exactly ${decks} complete 52-card decks.`);
  }
  // Deal like a casino: learner, dealer upcard, learner, dealer hole card.
  const [p1, up, p2, hole] = shoe as readonly [CardCode, CardCode, CardCode, CardCode];
  const cards = [p1, p2];
  const dealer = [up, hole];
  // The peek: with an Ace or ten-value upcard the dealer checks the hole card at once. A
  // dealer Blackjack, or a learner Blackjack, ends the round right after the deal — the
  // dealer only turns the hole card over (a forced 'reveal' move), nobody draws.
  const dealerNatural = dealerChecksForBlackjack(up) && isBlackjack(dealer);
  const roundDecided = dealerNatural || isBlackjack(cards);
  return {
    decks,
    shoe: shoe.slice(4),
    dealer,
    holeRevealed: false,
    hands: [newHand(cards, false, roundDecided)],
    activeHand: 0,
    phase: roundDecided ? 'dealer' : 'player',
    affordableUnits,
    extraUnits: 0,
  };
}

/** A fresh round: shuffle `decks` complete decks (a new shoe every round) and deal. */
function setup(config: GameConfig, rng: Rng): BlackjackState {
  const { decks } = validateConfig(config);
  return setupWithShoe(config, shuffle(makeDeck({ copies: decks }), rng));
}

// ---------------------------------------------------------------------------
// 5. Settlement and result flags
// ---------------------------------------------------------------------------

export type HandOutcome = 'blackjack' | 'win' | 'push' | 'loss';

export interface HandSettlement {
  total: number;
  bust: boolean;
  doubled: boolean;
  outcome: HandOutcome;
  /** Stake units won (+) or lost (−) on this hand. */
  net: number;
}

export interface RoundSettlement {
  hands: HandSettlement[];
  dealerTotal: number;
  dealerBust: boolean;
  dealerBlackjack: boolean;
  playerBlackjack: boolean;
  /** Sum of every hand's net — the learner's humanNetUnits. */
  net: number;
}

/** Per-hand payouts. Only valid once the round is over (it reads the hole card). */
export function settleRound(state: BlackjackState): RoundSettlement {
  if (state.phase !== 'over') throw new Error('Blackjack: the round is not over yet.');
  const dealerTotal = handValue(state.dealer).total;
  const dealerBust = dealerTotal > BLACKJACK_TOTAL;
  const dealerBlackjack = dealerHasBlackjack(state);
  const playerBlackjack = playerHasBlackjack(state);
  const hands = state.hands.map((h): HandSettlement => {
    const total = handValue(h.cards).total;
    const bust = total > BLACKJACK_TOTAL;
    const settle = (outcome: HandOutcome, net: number): HandSettlement => ({
      total,
      bust,
      doubled: h.doubled,
      outcome,
      net,
    });
    if (playerBlackjack) {
      return dealerBlackjack ? settle('push', 0) : settle('blackjack', BLACKJACK_PAYS * h.bet);
    }
    // The peek means a dealer Blackjack is found before any double/split: only the
    // original bet is lost.
    if (dealerBlackjack || bust) return settle('loss', -h.bet);
    if (dealerBust || total > dealerTotal) return settle('win', h.bet);
    if (total < dealerTotal) return settle('loss', -h.bet);
    return settle('push', 0);
  });
  const net = hands.reduce((sum, h) => sum + h.net, 0);
  return { hands, dealerTotal, dealerBust, dealerBlackjack, playerBlackjack, net };
}

function resultFlags(state: BlackjackState, s: RoundSettlement): ResultFlags {
  const won = (i: number) => {
    const o = s.hands[i]?.outcome;
    return o === 'win' || o === 'blackjack';
  };
  // The "story" flags describe a winning round (with split hands, one hand can win while
  // the round as a whole still loses — that is no comeback).
  const roundWon = s.net > 0;
  const tags: string[] = [];
  if (s.playerBlackjack) tags.push('blackjack');
  if (s.dealerBlackjack) tags.push('dealerBlackjack');
  if (s.dealerBust) tags.push('dealerBust');
  if (state.hands.length > 1) tags.push('split');
  if (state.hands.some((h) => h.doubled)) tags.push('doubled');
  const decidedByTotals = !s.playerBlackjack && !s.dealerBlackjack && !s.dealerBust;
  return {
    // Won a hand that sat on a hard 12–16 and drew to it.
    comeback: roundWon && state.hands.some((h, i) => h.hitOnStiff && won(i)),
    // Won by exactly one point (e.g. 19 against 18), or lost by one.
    closeFinish:
      decidedByTotals && s.hands.some((h) => !h.bust && Math.abs(h.total - s.dealerTotal) === 1),
    // Hit (or doubled) into exactly 21 and won, or the dealer busted on their last card
    // while the learner was standing on a modest 16 or less.
    luckyLastCard:
      roundWon &&
      (state.hands.some((h, i) => h.drewTo21 && won(i)) ||
        (s.dealerBust && s.hands.some((h) => !h.bust && h.total <= 16))),
    bigPot: Math.abs(s.net) >= 2,
    perfect: s.playerBlackjack,
    bust: s.hands.every((h) => h.bust),
    folded: false,
    tags,
  };
}

const COUNT_WORDS = ['no', 'one', 'two', 'three', 'four'];
function bets(n: number): string {
  return `${COUNT_WORDS[n] ?? String(n)} bet${n === 1 ? '' : 's'}`;
}

function summarize(s: RoundSettlement): string {
  if (s.playerBlackjack && s.dealerBlackjack) {
    return 'You and the dealer both have Blackjack, so it’s a push and your bet comes back.';
  }
  if (s.dealerBlackjack) {
    return (
      'The dealer has Blackjack (an Ace and a 10-value card), so the round ended right after ' +
      'the deal and you lose your bet.'
    );
  }
  if (s.playerBlackjack)
    return 'Blackjack! Your first two cards make 21, and Blackjack pays 3 to 2.';
  const [only, second] = s.hands;
  if (only && !second) {
    const bet = only.doubled ? 'doubled bet' : 'bet';
    switch (only.outcome) {
      case 'loss':
        return only.bust
          ? `You went over 21 with ${only.total}, so you bust and lose your ${bet}.`
          : `The dealer’s ${s.dealerTotal} beats your ${only.total}, so you lose your ${bet}.`;
      case 'push':
        return `You and the dealer both have ${only.total} — it’s a push, so your bet comes back.`;
      default: {
        const extra = only.doubled ? ' — twice your bet, because you doubled down' : '';
        return s.dealerBust
          ? `The dealer busted with ${s.dealerTotal}, so your ${only.total} wins${extra}!`
          : `Your ${only.total} beats the dealer’s ${s.dealerTotal} — you win${extra}!`;
      }
    }
  }
  const phrase = (h: HandSettlement) => {
    const d = h.doubled ? ' (doubled)' : '';
    if (h.bust) return `busted with ${h.total}${d}`;
    if (h.outcome === 'win') return `won with ${h.total}${d}`;
    if (h.outcome === 'push') return `tied on ${h.total}${d}`;
    return `lost with ${h.total}${d}`;
  };
  const dealerPart = s.dealerBust
    ? ` — the dealer busted with ${s.dealerTotal}`
    : s.hands.every((h) => h.bust)
      ? ''
      : ` against the dealer’s ${s.dealerTotal}`;
  const overall =
    s.net > 0
      ? `you come out ${bets(s.net)} ahead`
      : s.net < 0
        ? `you lose ${bets(-s.net)}`
        : 'you break even';
  const parts = s.hands.map(phrase);
  return `You played two hands: the first ${parts[0]} and the second ${parts[1]}${dealerPart}, so ${overall}.`;
}

function result(state: BlackjackState): GameResult {
  const s = settleRound(state);
  const humanOutcome = s.net > 0 ? 'win' : s.net < 0 ? 'loss' : 'push';
  const alive = s.hands.filter((h) => !h.bust).map((h) => h.total);
  const learnerScore = alive.length > 0 ? Math.max(...alive) : (s.hands[0]?.total ?? 0);
  return {
    winners: humanOutcome === 'win' ? [LEARNER] : humanOutcome === 'loss' ? [DEALER] : [],
    humanOutcome,
    humanNetUnits: s.net,
    scores: [learnerScore, s.dealerTotal],
    summary: summarize(s),
    flags: resultFlags(state, s),
  };
}

// ---------------------------------------------------------------------------
// 6. Words: move log, coaching
// ---------------------------------------------------------------------------

/** "Ace", "10", "King", "7" — how a beginner names a card's rank. */
function rankWord(rank: Rank): string {
  if (rank === 'T') return '10';
  if (rank === 'A' || rank === 'J' || rank === 'Q' || rank === 'K') return RANK_NAMES[rank];
  return rank;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function rankPlural(rank: Rank): string {
  const name = RANK_NAMES[rank];
  return name === 'Six' ? 'Sixes' : `${name}s`;
}

/** A total read aloud: "18", "soft 17", "21", "24 — bust". */
function spokenTotal(cards: readonly CardCode[]): string {
  const { total, soft } = handValue(cards);
  if (total > BLACKJACK_TOTAL) return `${total} — bust`;
  return soft && total < BLACKJACK_TOTAL ? `soft ${total}` : String(total);
}

/** Exciting totals (21 or a bust) end the sentence with "!". */
function punctuation(cards: readonly CardCode[]): string {
  return handValue(cards).total >= BLACKJACK_TOTAL ? '!' : '.';
}

function seatName(player: PlayerId): string {
  return player === LEARNER ? 'You' : `Player ${player}`;
}

const MOVE_VERBS: Record<BlackjackMove['type'], string> = {
  hit: 'hit',
  stand: 'stand',
  double: 'double down',
  split: 'split',
  reveal: 'turn over the hole card',
  'dealer-hit': 'draw a card',
  'dealer-stand': 'stand',
};

/** " with your first hand" while playing split hands, else "". */
function whichHand(state: BlackjackState): string {
  if (state.hands.length < 2) return '';
  return state.activeHand === 0 ? ' with your first hand' : ' with your second hand';
}

function describeMove(state: BlackjackState, player: PlayerId, move: BlackjackMove): string {
  const type: unknown = (move as { type?: unknown } | null | undefined)?.type;
  if (!isMoveType(type)) return 'That isn’t a Blackjack move.';
  const who = seatName(player);
  if (!checkMove(state, player, move).ok) return `${who} can’t ${MOVE_VERBS[type]} right now.`;
  const next = state.shoe[0];
  switch (type) {
    case 'hit':
    case 'double': {
      const hand = requireActiveHand(state);
      if (next === undefined) return `${who} ${MOVE_VERBS[type]}.`;
      const cards = [...hand.cards, next];
      const verb = type === 'hit' ? 'hit' : 'doubled down';
      const tail = type === 'double' ? ' Your bet is doubled and this hand is finished.' : '';
      return `${who} ${verb}${whichHand(state)} and drew the ${cardName(next)}, making ${spokenTotal(cards)}${punctuation(cards)}${tail}`;
    }
    case 'stand':
      return `${who} stand on ${spokenTotal(requireActiveHand(state).cards)}${whichHand(state)}.`;
    case 'split': {
      const [a, b] = requireActiveHand(state).cards;
      const c1 = state.shoe[0];
      const c2 = state.shoe[1];
      if (!a || !b || !c1 || !c2) return `${who} split.`;
      const ra = rankOf(a);
      const rb = rankOf(b);
      const pair =
        ra === rb ? `pair of ${rankPlural(ra)}` : `${RANK_NAMES[ra]} and ${RANK_NAMES[rb]}`;
      const aces = isAce(a) ? ' Split Aces get just one card each.' : '';
      return (
        `${who} split your ${pair} into two hands: the first gets the ${cardName(c1)} and ` +
        `the second gets the ${cardName(c2)}.${aces}`
      );
    }
    case 'reveal': {
      const hole = state.dealer[1];
      if (!hole) return `${who} turns over the hole card.`;
      const has = isBlackjack(state.dealer)
        ? `${who} has Blackjack!`
        : `${who} has ${spokenTotal(state.dealer)}${punctuation(state.dealer)}`;
      return `${who} turns over the hole card: the ${cardName(hole)}. ${has}`;
    }
    case 'dealer-hit': {
      if (next === undefined) return `${who} draws a card.`;
      const after = [...state.dealer, next];
      return `${who} draws the ${cardName(next)}, making ${spokenTotal(after)}${punctuation(after)}`;
    }
    case 'dealer-stand':
      return `${who} stands on ${spokenTotal(state.dealer)}.`;
  }
}

function listMoves(moves: readonly BlackjackMove[]): string {
  const words = moves.map((m) => MOVE_VERBS[m.type]);
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
}

/** What the learner sees while the dealer plays (never reveals the hole card early). */
function dealerTurnSituation(state: BlackjackState): string {
  if (!state.holeRevealed) {
    // Everything said here is public: with an Ace or 10-value upcard the dealer has already
    // peeked (and a dealer who finds Blackjack flips it at once), and with any other upcard
    // a dealer Blackjack is impossible.
    const up = dealerUpcard(state);
    const upWord = rankWord(rankOf(up));
    if (playerHasBlackjack(state)) {
      if (dealerHasBlackjack(state)) {
        return (
          `You have Blackjack — but the dealer peeked under the ${upWord} and has one too, so ` +
          'it’s a push and your bet comes back.'
        );
      }
      const noDealerBlackjack = dealerChecksForBlackjack(up)
        ? `the dealer peeked under the ${upWord} and has no Blackjack`
        : `a dealer ${upWord} can’t make Blackjack`;
      return (
        `You have Blackjack! ${capitalise(noDealerBlackjack)}, so you win 3 to 2. The dealer ` +
        'just turns over the hole card.'
      );
    }
    if (dealerHasBlackjack(state)) {
      return (
        `The dealer peeked under the ${upWord} and is turning the hole card over straight ` +
        'away — that means the dealer has Blackjack.'
      );
    }
    if (state.hands.every((h) => handValue(h.cards).total > BLACKJACK_TOTAL)) {
      return 'You went over 21, so the round is decided — the dealer just turns over the hole card.';
    }
    return (
      'Your turn is over. The dealer turns over the face-down hole card, then must hit on 16 ' +
      'or less and stand on 17 or more.'
    );
  }
  const total = handValue(state.dealer).total;
  return total < DEALER_STANDS_ON
    ? `The dealer has ${describeTotal(state.dealer)}. Dealers must take a card on 16 or less, so the dealer draws.`
    : `The dealer has ${describeTotal(state.dealer)} and must stand — dealers stand on 17 or more, even a soft 17.`;
}

function coach(state: BlackjackState, player: PlayerId): CoachAdvice {
  if (state.phase === 'over') return { situation: result(state).summary };
  if (player !== LEARNER && player !== DEALER) {
    return {
      situation: `There’s no Player ${player} at this table — it’s just you and the dealer.`,
    };
  }
  if (player === DEALER) {
    if (state.phase !== 'dealer') {
      return { situation: 'The dealer waits until the learner has finished every hand.' };
    }
    return {
      situation: dealerTurnSituation(state),
      suggestion: dealerForcedMove(state),
      why: 'The dealer has no choices: turn over the hole card, hit on 16 or less, stand on 17 or more.',
    };
  }
  if (state.phase === 'dealer') return { situation: dealerTurnSituation(state) };

  const hand = requireActiveHand(state);
  const up = dealerUpcard(state);
  const opts = { canDouble: canDouble(state), canSplit: canSplit(state) };
  const advice = strategyAdvice(hand.cards, up, opts);
  const which =
    state.hands.length > 1
      ? `You’re playing your ${state.activeHand === 0 ? 'first' : 'second'} of two hands. `
      : '';
  const cards = hand.cards.map((c) => rankWord(rankOf(c))).join(' + ');
  const peek = dealerChecksForBlackjack(up) ? ' and has already checked: no Blackjack' : '';
  return {
    situation:
      `${which}You have ${describeTotal(hand.cards)} (${cards}). The dealer shows ` +
      `${upcardPhrase(up)}${peek}. You can ${listMoves(legalMoves(state, LEARNER))}.`,
    suggestion: { type: advice.action } satisfies BlackjackMove,
    why: advice.why,
  };
}

function botMove(
  state: BlackjackState,
  player: PlayerId,
  difficulty: Difficulty,
  _rng: Rng,
): BlackjackMove {
  const legal = legalMoves(state, player);
  const forced = legal[0];
  if (forced === undefined) {
    throw new Error(`Blackjack: botMove called for ${seatName(player)}, who has no move now.`);
  }
  if (player === DEALER) return forced;
  const hand = requireActiveHand(state);
  // Easy: the classic "hit below 15" rule of thumb — never doubles or splits.
  if (difficulty === 'easy') return { type: handValue(hand.cards).total < 15 ? 'hit' : 'stand' };
  // Normal: basic strategy, using only the learner's own cards and the dealer's upcard.
  const opts = { canDouble: canDouble(state), canSplit: canSplit(state) };
  return { type: basicStrategy(hand.cards, dealerUpcard(state), opts) };
}

// ---------------------------------------------------------------------------
// 7. The engine
// ---------------------------------------------------------------------------

export const blackjackEngine: GameEngine<BlackjackState, BlackjackMove> = {
  id: 'blackjack',
  setup,
  currentPlayer,
  legalMoves,
  checkMove,
  applyMove,
  isOver: (state) => state.phase === 'over',
  result,
  botMove,
  describeMove,
  coach,
  moveKey: (move) => move.type,
};

export default blackjackEngine;
