/**
 * Baccarat (Punto Banco) — pure rules engine (docs/RULES_DECISIONS.md → Baccarat,
 * docs/engine-notes/baccarat.md). Structured like the Blackjack reference engine.
 *
 * Two seats: the learner (seat 0) bets, the dealer (seat 1) deals. The two HANDS on the
 * table are called "Player" and "Banker"; neither belongs to a seat — the learner simply
 * bets on one of them (or on a tie), and the dealer deals both by fixed rules.
 *
 *  1. Setup: a shoe of `options.decks` complete decks (default 8) is shuffled fresh.
 *  2. Phase 'bet': the learner bets one unit on Player, Banker or Tie:
 *     { type: 'bet', on }.
 *  3. Phase 'deal': the dealer's only legal move is { type: 'deal' }, which deals ONE card
 *     from the shoe, so the UI can animate the coup card by card. The order is Player,
 *     Banker, Player, Banker, then the Player's third card (if the rules call for one),
 *     then the Banker's third card (if the rules call for one) — see `nextHand`.
 *  4. Drawing rules (rules.ts): a two-card 8 or 9 is a natural and both hands stand.
 *     Otherwise Player draws on 0–5 and stands on 6–7; Banker then follows the standard
 *     tableau (`bankerDraws`). The deal ends after the last card the rules call for.
 *  5. The total closer to 9 wins (equal totals = tie). Payouts: Player 1 to 1, Banker 0.95
 *     to 1 (5% commission), Tie 8 to 1; Player and Banker bets push on a tie; a losing bet
 *     loses its unit. `maxLossUnits` is 1 and there are no optional extra commitments, so
 *     `config.affordableUnits` has no effect.
 *
 * Hidden information: the shoe order is in the state, as the contract requires; the UI
 * must keep it face down. Every dealt card is turned face up as it lands, so the move log
 * may name it. The learner's bot and the coach only use public facts (the bet, the face-up
 * cards and the exact odds of a fresh shoe) — never the shoe order.
 */
import { cardName, makeDeck, type CardCode } from '@/games/core/cards';
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
import { bestBet, coupOdds, houseEdges, percent } from './odds';
import {
  BET_NAMES,
  BETS,
  bankerDraws,
  bankerRuleWhy,
  cardPoints,
  CARDS_PER_DECK,
  coupWinner,
  DEALER,
  DEFAULT_DECKS,
  HAND_NAMES,
  handPhrase,
  handTotal,
  isBetOn,
  isNatural,
  LEARNER,
  MAX_DECKS,
  MIN_DECKS,
  netUnits,
  otherHand,
  outcomePhrase,
  PAYOUT_WORDS,
  playerDraws,
  playerRuleWhy,
  SEATS,
  seatName,
  verbFor,
  type BetOn,
  type CoupWinner,
  type Hand,
} from './rules';

export {
  BANKER_COMMISSION,
  bankerDraws,
  bankerRuleWhy,
  BET_NAMES,
  BETS,
  cardPoints,
  CARDS_PER_DECK,
  coupWinner,
  DEALER,
  DEFAULT_DECKS,
  HAND_NAMES,
  handPhrase,
  HANDS,
  handTotal,
  isBetOn,
  isNatural,
  LEARNER,
  MAX_CARDS_PER_COUP,
  MAX_DECKS,
  MAX_GAME_MOVES,
  MAX_LOSS_UNITS,
  MAX_WIN_UNITS,
  MIN_DECKS,
  NATURAL_MIN,
  netUnits,
  otherHand,
  outcomePhrase,
  PAYOUT,
  PAYOUT_WORDS,
  playerDraws,
  playerRuleWhy,
  SEATS,
  seatName,
  type BetOn,
  type CoupWinner,
  type Hand,
} from './rules';
export {
  bestBet,
  COUP_ODDS,
  computeCoupOdds,
  coupOdds,
  expectedNet,
  houseEdges,
  percent,
  type CoupOdds,
} from './odds';

// ---------------------------------------------------------------------------
// 1. Types
// ---------------------------------------------------------------------------

/** Game-specific options read from `config.options`. */
export interface BaccaratOptions {
  /** 52-card decks in the shoe, 1–8 (default 8, the variant we teach). */
  decks?: number;
}

/**
 * 'bet'  — the learner is choosing Player, Banker or Tie.
 * 'deal' — the dealer is dealing, one forced move per card.
 * 'over' — the coup is decided; call result().
 */
export type BaccaratPhase = 'bet' | 'deal' | 'over';

export interface BaccaratState {
  /** Complete decks in the shoe at the start of the coup. */
  decks: number;
  /** Face-down undealt cards; shoe[0] is dealt next. HIDDEN from the learner. */
  shoe: CardCode[];
  /** The Player hand ("Punto"), face up, in the order dealt. */
  player: CardCode[];
  /** The Banker hand ("Banco"), face up, in the order dealt. */
  banker: CardCode[];
  /** The learner's bet, or null until it is placed. */
  bet: BetOn | null;
  phase: BaccaratPhase;
  /** How the coup ended; null until the last card is dealt. */
  winner: CoupWinner | null;
}

export type BaccaratMove = { type: 'bet'; on: BetOn } | { type: 'deal' };
export type BaccaratMoveType = BaccaratMove['type'];

/** Just the two face-up hands — enough for every drawing-rule query. */
export type Table = Pick<BaccaratState, 'player' | 'banker'>;

/** One face-up card, the hand it was dealt to, and its place in the deal. */
export interface DealtCard {
  card: CardCode;
  hand: Hand;
  /** 1-based position in the deal (cards 1–4 are the first two cards of each hand). */
  number: number;
  /** True for a hand's third card. */
  third: boolean;
}

/** The two totals at one moment of the coup. */
export interface TotalsSnapshot {
  player: number;
  banker: number;
}

/** The dealer's only move. Shared by every call, so it is frozen against accidental edits. */
const DEAL: BaccaratMove = Object.freeze({ type: 'deal' });

/**
 * A curated seed for the coached practice coup (`createRng(PRACTICE_SEED)` with the default
 * 8-deck config). No natural: Player starts on 2 and draws a 3 to reach 5; Banker starts on
 * 4, and because Player's third card was a 3 (2–7) the tableau says Banker draws — a 5, for
 * 9. Banker wins 9 to 5, so the coach's Banker tip pays off and every drawing rule gets
 * explained along the way (checked by the tests).
 */
export const PRACTICE_SEED = 5;

// ---------------------------------------------------------------------------
// 2. Queries (pure reads of the state, exported for the UI and tests)
// ---------------------------------------------------------------------------

/** How many cards have been dealt face up. */
export function cardsDealt(state: Table): number {
  return state.player.length + state.banker.length;
}

/** The value (0–9) of the Player's third card, or null if Player has not drawn one. */
export function playerThirdValue(state: Table): number | null {
  const third = state.player[2];
  return third === undefined ? null : cardPoints(third);
}

/** True when either hand's first two cards are a natural (8 or 9): nobody draws. */
export function naturalOnTable(state: Table): boolean {
  return isNatural(state.player.slice(0, 2)) || isNatural(state.banker.slice(0, 2));
}

/**
 * The hand that gets the next card, or null when the rules call for no more cards. Cards
 * 1–4 alternate Player, Banker, Player, Banker. Then, unless a natural is on the table,
 * Player draws on 0–5, and Banker draws according to the tableau.
 */
export function nextHand(state: Table): Hand | null {
  const { player, banker } = state;
  if (player.length < 2 || banker.length < 2) {
    return player.length <= banker.length ? 'player' : 'banker';
  }
  if (player.length > 3 || banker.length > 2) return null;
  if (naturalOnTable(state)) return null;
  if (player.length === 2 && playerDraws(handTotal(player))) return 'player';
  return bankerDraws(handTotal(banker), playerThirdValue(state)) ? 'banker' : null;
}

/** Current totals of both hands (0 for a hand with no cards yet). */
export function totals(state: Table): TotalsSnapshot {
  return { player: handTotal(state.player), banker: handTotal(state.banker) };
}

/** Every dealt card in deal order: P1, B1, P2, B2, then Player’s and Banker’s third cards. */
export function dealtInOrder(state: Table): DealtCard[] {
  const out: DealtCard[] = [];
  const push = (hand: Hand, i: number) => {
    const card = state[hand][i];
    if (card !== undefined) out.push({ card, hand, number: out.length + 1, third: i === 2 });
  };
  for (let i = 0; i < 3; i++) {
    push('player', i);
    push('banker', i);
  }
  return out;
}

/** The most recently dealt card, or null before the first card. */
export function lastDealt(state: Table): DealtCard | null {
  return dealtInOrder(state).at(-1) ?? null;
}

/**
 * Both totals once each hand has two cards, then again after each third card — the
 * moments a watcher compares the hands. Empty until the first four cards are out.
 */
export function totalsHistory(state: Table): TotalsSnapshot[] {
  const { player, banker } = state;
  if (player.length < 2 || banker.length < 2) return [];
  const p2 = handTotal(player.slice(0, 2));
  const b2 = handTotal(banker.slice(0, 2));
  const out: TotalsSnapshot[] = [{ player: p2, banker: b2 }];
  const p3 = player.length === 3 ? handTotal(player) : p2;
  if (player.length === 3) out.push({ player: p3, banker: b2 });
  if (banker.length === 3) out.push({ player: p3, banker: handTotal(banker) });
  return out;
}

// ---------------------------------------------------------------------------
// 3. Legality — friendly reasons; each returns null when the move is allowed.
// ---------------------------------------------------------------------------

const MOVE_TYPES: readonly BaccaratMoveType[] = ['bet', 'deal'];

function isMoveType(value: unknown): value is BaccaratMoveType {
  return (MOVE_TYPES as readonly unknown[]).includes(value);
}

function moveTypeOf(move: unknown): unknown {
  return typeof move === 'object' && move !== null ? (move as { type?: unknown }).type : undefined;
}

const NOT_A_MOVE =
  'That isn’t a Baccarat move. You bet on Player, Banker or Tie, and the dealer deals the cards.';

function noSuchSeat(player: PlayerId): string {
  return `There’s no Player ${player} at this table — it’s just you and the dealer.`;
}

function overReason(state: BaccaratState): string {
  const { winner } = state;
  if (winner === null) return 'This coup is over. Start a new game to play again.';
  const t = totals(state);
  return `This coup is over — ${outcomePhrase(winner, t.player, t.banker)}. Start a new game to play again.`;
}

const LOCKED = 'Bets are locked once the dealing starts';

function betProblem(state: BaccaratState, player: PlayerId, on: unknown): string | null {
  // Who is betting matters before what they bet on: the dealer can never bet, and once the
  // deal has started no bet of any kind is accepted.
  if (player === DEALER) {
    return 'The dealer never bets — the dealer only deals the cards. Only you place a bet.';
  }
  if (state.phase === 'deal') {
    const placed = state.bet;
    if (placed === null) return `${LOCKED}. Just watch the cards!`;
    if (placed === on) {
      return (
        `Your bet on ${BET_NAMES[placed]} is already down and the dealer is dealing — ` +
        'now just watch the cards.'
      );
    }
    if (!isBetOn(on)) {
      return `${LOCKED} — your bet stays on ${BET_NAMES[placed]}. Just watch the cards!`;
    }
    return (
      `${LOCKED}, so you can’t switch from ` +
      `${BET_NAMES[placed]} to ${BET_NAMES[on]} now. Just watch the cards!`
    );
  }
  if (!isBetOn(on)) return 'Pick a bet: Player, Banker or Tie.';
  return null;
}

function dealProblem(state: BaccaratState, player: PlayerId): string | null {
  if (player === LEARNER) {
    return state.phase === 'bet'
      ? 'You don’t deal the cards — the dealer does, and only after you’ve placed your bet. ' +
          'Pick Player, Banker or Tie first.'
      : 'The dealer deals every card for you, and whether a hand gets a third card is decided ' +
          'by fixed rules — nobody chooses. Just watch!';
  }
  if (state.phase === 'bet') {
    return 'The dealer waits for your bet: no card is dealt until you’ve picked Player, Banker or Tie.';
  }
  return null;
}

function checkMove(state: BaccaratState, player: PlayerId, move: BaccaratMove): MoveCheck {
  const no = (reason: string): MoveCheck => ({ ok: false, reason });
  const type = moveTypeOf(move);
  if (!isMoveType(type)) return no(NOT_A_MOVE);
  if (player !== LEARNER && player !== DEALER) return no(noSuchSeat(player));
  if (state.phase === 'over') return no(overReason(state));
  const problem =
    type === 'bet'
      ? betProblem(state, player, (move as { on?: unknown }).on)
      : dealProblem(state, player);
  return problem === null ? { ok: true } : no(problem);
}

function currentPlayer(state: BaccaratState): PlayerId | null {
  if (state.phase === 'bet') return LEARNER;
  if (state.phase === 'deal') return DEALER;
  return null;
}

function legalMoves(state: BaccaratState, player: PlayerId): BaccaratMove[] {
  if (currentPlayer(state) !== player) return [];
  if (player === DEALER) return [DEAL];
  return BETS.map((on) => ({ type: 'bet', on }));
}

// ---------------------------------------------------------------------------
// 4. Transitions (pure: always build new objects/arrays)
// ---------------------------------------------------------------------------

/** The hands after `card` lands on `hand`. */
function withCard(table: Table, hand: Hand, card: CardCode): Table {
  return {
    player: hand === 'player' ? [...table.player, card] : table.player,
    banker: hand === 'banker' ? [...table.banker, card] : table.banker,
  };
}

/** How the coup ended once no more cards are due, else null. */
function finishedWinner(table: Table): CoupWinner | null {
  if (nextHand(table) !== null) return null;
  const t = totals(table);
  return coupWinner(t.player, t.banker);
}

function deal(state: BaccaratState): BaccaratState {
  const hand = nextHand(state);
  const card = state.shoe[0];
  // Unreachable from setup(): the deal ends as soon as the rules call for no more cards,
  // and a shoe always holds far more than six.
  if (hand === null || card === undefined) {
    throw new Error('Baccarat: the rules call for no more cards in this coup.');
  }
  const table = withCard(state, hand, card);
  const winner = finishedWinner(table);
  return {
    ...state,
    ...table,
    shoe: state.shoe.slice(1),
    phase: winner === null ? 'deal' : 'over',
    winner,
  };
}

function applyMove(state: BaccaratState, move: BaccaratMove): BaccaratState {
  assertLegal(baccaratEngine, state, move);
  if (move.type === 'bet') return { ...state, bet: move.on, phase: 'deal' };
  return deal(state);
}

function readDecks(options: Record<string, unknown> | undefined): number {
  const decks = (options as BaccaratOptions | undefined)?.decks ?? DEFAULT_DECKS;
  if (!Number.isInteger(decks) || decks < MIN_DECKS || decks > MAX_DECKS) {
    throw new RangeError(
      `Baccarat: options.decks must be a whole number from ${MIN_DECKS} to ${MAX_DECKS}.`,
    );
  }
  return decks;
}

function validateConfig(config: GameConfig): number {
  if (config.players !== SEATS) {
    throw new RangeError(
      `Baccarat is one learner betting against the dealer, so it needs exactly ${SEATS} ` +
        `seats (got ${config.players}).`,
    );
  }
  return readDecks(config.options);
}

/** An ordered shoe of `decks` complete decks (built once per size; never mutated). */
const orderedShoes = new Map<number, readonly CardCode[]>();
function orderedShoe(decks: number): readonly CardCode[] {
  let shoe = orderedShoes.get(decks);
  if (!shoe) {
    shoe = Object.freeze(makeDeck({ copies: decks }));
    orderedShoes.set(decks, shoe);
  }
  return shoe;
}

function cardCounts(cards: readonly CardCode[]): Map<CardCode, number> {
  const counts = new Map<CardCode, number>();
  for (const c of cards) counts.set(c, (counts.get(c) ?? 0) + 1);
  return counts;
}

function freshState(decks: number, shoe: CardCode[]): BaccaratState {
  return { decks, shoe, player: [], banker: [], bet: null, phase: 'bet', winner: null };
}

/**
 * Start a coup from a shoe in a known order: shoe[0] goes to Player, shoe[1] to Banker,
 * shoe[2] to Player, shoe[3] to Banker, and any third cards follow in order. `setup` uses
 * the same layout with a freshly shuffled shoe; tests and curated practice hands can pass a
 * stacked one. The shoe must be exactly `options.decks` complete 52-card decks (no jokers).
 */
export function setupWithShoe(config: GameConfig, shoe: readonly CardCode[]): BaccaratState {
  const decks = validateConfig(config);
  const expected = cardCounts(orderedShoe(decks));
  const actual = cardCounts(shoe);
  const complete =
    shoe.length === decks * CARDS_PER_DECK &&
    actual.size === expected.size &&
    [...expected].every(([c, n]) => actual.get(c) === n);
  if (!complete) {
    throw new RangeError(`Baccarat: the shoe must hold exactly ${decks} complete 52-card decks.`);
  }
  return freshState(decks, shoe.slice());
}

/**
 * A fresh coup: shuffle a new shoe (a fresh shuffle every round). The shuffled shoe is
 * complete by construction, so it skips setupWithShoe's (comparatively slow) check.
 */
function setup(config: GameConfig, rng: Rng): BaccaratState {
  const decks = validateConfig(config);
  return freshState(decks, shuffle(orderedShoe(decks), rng));
}

// ---------------------------------------------------------------------------
// 5. Settlement and result flags (all re-derivable from the final state)
// ---------------------------------------------------------------------------

export interface BaccaratSettlement {
  bet: BetOn;
  winner: CoupWinner;
  playerTotal: number;
  bankerTotal: number;
  playerNatural: boolean;
  bankerNatural: boolean;
  /** Stake units: +1 / +0.95 / +8 on a win, 0 on a push, −1 on a loss. */
  net: number;
  outcome: 'win' | 'loss' | 'push';
}

/** The payout. Only valid once the coup is over. */
export function settle(state: BaccaratState): BaccaratSettlement {
  const { bet, winner } = state;
  if (state.phase !== 'over' || bet === null || winner === null) {
    throw new Error('Baccarat: the coup is not over yet.');
  }
  const net = netUnits(bet, winner);
  const t = totals(state);
  return {
    bet,
    winner,
    playerTotal: t.player,
    bankerTotal: t.banker,
    playerNatural: isNatural(state.player),
    bankerNatural: isNatural(state.banker),
    net,
    outcome: net > 0 ? 'win' : net < 0 ? 'loss' : 'push',
  };
}

/**
 * The learner's side was behind at some moment (after the first four cards or after a
 * third card) before winning. For a Tie bet "behind" means the totals were different.
 */
function cameBack(state: BaccaratState, s: BaccaratSettlement): boolean {
  if (s.outcome !== 'win') return false;
  const history = totalsHistory(state);
  const mine = s.bet;
  if (mine === 'tie') return history.some((t) => t.player !== t.banker);
  const other = otherHand(mine);
  return history.some((t) => t[mine] < t[other]);
}

/**
 * The last card turned the result: the winning hand drew a third card, and with only its
 * first two cards it would not have beaten the other hand's final total. In a tie, the
 * last card dealt turned unequal totals into the tie.
 */
export function lastCardTurnedIt(state: BaccaratState): boolean {
  const { winner } = state;
  if (winner === null) return false;
  if (winner === 'tie') {
    const history = totalsHistory(state);
    const before = history.at(-2);
    return before !== undefined && before.player !== before.banker;
  }
  const cards = state[winner];
  if (cards.length < 3) return false;
  const loser = state[otherHand(winner)];
  return handTotal(cards.slice(0, 2)) <= handTotal(loser);
}

/** The learner won with a natural 9 on their side (for a Tie bet: a 9–9 natural tie). */
function wonWithNaturalNine(state: BaccaratState, s: BaccaratSettlement): boolean {
  if (s.outcome !== 'win') return false;
  const nine = (cards: readonly CardCode[]) => isNatural(cards) && handTotal(cards) === 9;
  if (s.bet === 'tie') return nine(state.player) && nine(state.banker);
  return nine(state[s.bet]);
}

function resultFlags(state: BaccaratState, s: BaccaratSettlement): ResultFlags {
  const tags: string[] = [];
  if (s.playerNatural || s.bankerNatural) tags.push('natural');
  if (s.winner === 'tie') tags.push('tie');
  return {
    comeback: cameBack(state, s),
    closeFinish: Math.abs(s.playerTotal - s.bankerTotal) === 1,
    luckyLastCard: lastCardTurnedIt(state),
    bigPot: Math.abs(s.net) >= 3,
    perfect: wonWithNaturalNine(state, s),
    bust: false,
    folded: false,
    tags,
  };
}

function summarize(s: BaccaratSettlement): string {
  const yours = `your ${BET_NAMES[s.bet]} bet`;
  let lead: string;
  if (s.winner === 'tie') {
    const naturals = s.playerNatural && s.bankerNatural ? ' with naturals' : '';
    lead = `Both hands finished on ${s.playerTotal}${naturals} — a tie`;
  } else {
    const [mine, theirs] =
      s.winner === 'player' ? [s.playerTotal, s.bankerTotal] : [s.bankerTotal, s.playerTotal];
    const natural = (s.winner === 'player' ? s.playerNatural : s.bankerNatural)
      ? ' with a natural'
      : '';
    lead = `${HAND_NAMES[s.winner]} won ${mine} to ${theirs}${natural}`;
  }
  if (s.outcome === 'push') return `${lead} — so ${yours} is a push and comes back to you.`;
  if (s.outcome === 'loss') return `${lead}, so ${yours} loses.`;
  if (s.bet === 'banker') {
    return `${lead}, so ${yours} wins 0.95 to 1 (even money minus the 5% commission).`;
  }
  return `${lead}, so ${yours} wins ${PAYOUT_WORDS[s.bet]}!`;
}

function result(state: BaccaratState): GameResult {
  const s = settle(state);
  return {
    winners: s.outcome === 'win' ? [LEARNER] : s.outcome === 'loss' ? [DEALER] : [],
    humanOutcome: s.outcome,
    humanNetUnits: s.net,
    summary: summarize(s),
    flags: resultFlags(state, s),
  };
}

// ---------------------------------------------------------------------------
// 6. Words: move log, coaching
// ---------------------------------------------------------------------------

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function describeDeal(state: BaccaratState, player: PlayerId): string {
  const who = seatName(player);
  const deals = verbFor(player, 'deal', 'deals');
  const hand = nextHand(state);
  const card = state.shoe[0];
  if (hand === null || card === undefined) return `${who} ${deals} the next card.`;
  const name = HAND_NAMES[hand];
  // Every card is dealt face up, so naming it reveals nothing hidden.
  const third = state[hand].length === 2;
  const base = third
    ? `${who} ${deals} ${name} a third card, the ${cardName(card)}`
    : `${who} ${deals} the ${cardName(card)} to ${name}`;
  const after = withCard(state, hand, card);
  const cards = after[hand];
  const status = cards.length >= 2 ? ` — ${handPhrase(hand, cards)}` : '';
  const winner = finishedWinner(after);
  if (winner === null) return `${base}${status}.`;
  const t = totals(after);
  return `${base}${status}. ${capitalize(outcomePhrase(winner, t.player, t.banker))}.`;
}

function describeMove(state: BaccaratState, player: PlayerId, move: BaccaratMove): string {
  const type = moveTypeOf(move);
  if (!isMoveType(type)) return 'That isn’t a Baccarat move.';
  const who = seatName(player);
  if (!checkMove(state, player, move).ok) {
    if (type === 'bet' && !isBetOn((move as { on?: unknown }).on)) {
      return 'That isn’t a bet at this table — you can bet on Player, Banker or Tie.';
    }
    return `${who} can’t ${type === 'bet' ? 'bet' : 'deal'} right now.`;
  }
  if (move.type === 'bet') {
    return `${who} ${verbFor(player, 'bet', 'bets')} on ${BET_NAMES[move.on]}, which pays ${PAYOUT_WORDS[move.on]}.`;
  }
  return describeDeal(state, player);
}

const BET_SITUATION =
  'Two hands are about to be dealt: one called Player and one called Banker. The hand whose ' +
  'total is closer to 9 wins. Bet on Player, on Banker, or on a Tie (both totals equal). ' +
  'After your bet the dealer deals every card automatically, by fixed rules — you don’t ' +
  'make any more choices.';

function betWhy(decks: number): string {
  const odds = coupOdds(decks);
  const edge = houseEdges(decks);
  return (
    `Banker is the kindest bet on the table. It wins a little more often — about ` +
    `${percent(odds.banker)} of coups, against ${percent(odds.player)} for Player, with ` +
    `${percent(odds.tie)} ties — because Banker draws last and its drawing rules are a bit ` +
    `smarter. Even after the 5% commission, the house edge on Banker is only about ` +
    `${percent(edge.banker)}: on average you lose about 1 Jeet for every 100 you bet. ` +
    `Player’s edge is about ${percent(edge.player)}. Tie pays a big 8 to 1, but ties are so ` +
    `rare that its edge is about ${percent(edge.tie, 1)} — by far the worst bet. Whatever ` +
    `you pick, it’s still luck: the drawing is automatic and nothing you do changes the cards.`
  );
}

function handStatus(hand: Hand, cards: readonly CardCode[]): string {
  const name = HAND_NAMES[hand];
  const first = cards[0];
  if (first === undefined) return `${name} has no cards yet`;
  if (cards.length === 1) return `${name} has one card, worth ${cardPoints(first)}`;
  const count = cards.length === 2 ? 'two' : 'three';
  return isNatural(cards)
    ? `${name} has a natural ${handTotal(cards)}`
    : `${name} has ${handTotal(cards)} from ${count} cards`;
}

function dealSituation(state: BaccaratState): string {
  const bet = state.bet === null ? '' : `You bet on ${BET_NAMES[state.bet]}. `;
  const hand = nextHand(state);
  const next =
    hand === null
      ? ''
      : state[hand].length === 2
        ? ` Next, ${HAND_NAMES[hand]} gets a third card.`
        : ` The next card goes to ${HAND_NAMES[hand]}.`;
  if (cardsDealt(state) === 0) return `${bet}No cards are dealt yet.${next}`;
  return (
    `${bet}${handStatus('player', state.player)}, and ${handStatus('banker', state.banker)}.` + next
  );
}

/** Why the next card goes where it goes — the rule, in plain words. */
function nextCardWhy(state: BaccaratState): string {
  const hand = nextHand(state);
  if (state.player.length < 2 || state.banker.length < 2 || hand === null) {
    return (
      'Each hand gets two cards first, dealt one at a time: Player, Banker, Player, Banker. ' +
      'The dealer never chooses anything — every card follows fixed rules.'
    );
  }
  if (hand === 'player') {
    return `Nobody has a natural (8 or 9), so the drawing rules apply. ${playerRuleWhy(handTotal(state.player))}`;
  }
  return bankerRuleWhy(handTotal(state.banker), playerThirdValue(state));
}

function coach(state: BaccaratState, player: PlayerId): CoachAdvice {
  if (player !== LEARNER && player !== DEALER) return { situation: noSuchSeat(player) };
  if (state.phase === 'over') return { situation: result(state).summary };
  if (state.phase === 'bet') {
    if (player === DEALER) {
      return { situation: 'The dealer waits for your bet before dealing any cards.' };
    }
    const suggestion: BaccaratMove = { type: 'bet', on: bestBet(state.decks) };
    return { situation: BET_SITUATION, suggestion, why: betWhy(state.decks) };
  }
  const situation = dealSituation(state);
  const why = nextCardWhy(state);
  if (player === DEALER) return { situation, suggestion: DEAL, why };
  return {
    situation: `${situation} There’s nothing for you to decide — the dealer deals by fixed rules.`,
    why,
  };
}

function botMove(
  state: BaccaratState,
  player: PlayerId,
  difficulty: Difficulty,
  rng: Rng,
): BaccaratMove {
  if (legalMoves(state, player).length === 0) {
    throw new Error(`Baccarat: botMove called for ${seatName(player)}, who has no move now.`);
  }
  if (player === DEALER) return DEAL;
  // Normal: the bet with the smallest house edge (Banker). Easy: any bet at random.
  // Both only use public facts — never the face-down shoe.
  return { type: 'bet', on: difficulty === 'easy' ? rng.pick(BETS) : bestBet(state.decks) };
}

function moveKey(move: BaccaratMove): string {
  const type = moveTypeOf(move);
  if (type === 'bet') return `bet:${String((move as { on?: unknown }).on)}`;
  if (type === 'deal') return 'deal';
  return `invalid:${JSON.stringify(move) ?? String(move)}`;
}

// ---------------------------------------------------------------------------
// 7. The engine
// ---------------------------------------------------------------------------

export const baccaratEngine: GameEngine<BaccaratState, BaccaratMove> = {
  id: 'baccarat',
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
  moveKey,
};

export default baccaratEngine;
