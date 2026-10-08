/**
 * Texas Hold'em (No-Limit) rules: state shape, setup, betting legality, the pure
 * state transition, side pots and the showdown. The GameEngine object
 * (engine.ts) wires these together with the bots, descriptions, coaching and
 * result scoring.
 *
 * Seats are numbered clockwise; "left of" a seat = the next seat number.
 * Seat 0 is the learner in play mode. 1 unit = 1 chip.
 *
 * Betting (No-Limit):
 *  - Blinds 1/2 by default. With 3+ players the seat left of the button posts
 *    the small blind and the next seat the big blind; pre-flop action starts
 *    left of the big blind. Heads-up the button posts the small blind and acts
 *    first pre-flop, last after the flop.
 *  - The minimum bet is the big blind; a raise must go up by at least the last
 *    full bet/raise increment. Going all-in is allowed for any amount, but an
 *    all-in raise smaller than a full raise does not re-open the betting for
 *    players who have already acted (unless the raises facing them add up to a
 *    full raise).
 *  - Unmatched chips are returned when a betting round ends. Side pots are
 *    built from each player's total contribution.
 *  - Board cards are dealt (after a burn card) automatically when a betting
 *    round closes; when no more betting is possible the rest of the board is
 *    dealt at once.
 */
import { type CardCode, makeDeck } from '@/games/core/cards';
import { type Rng, shuffle } from '@/games/core/rng';
import type { GameConfig, PlayerId } from '@/games/core/types';
import { evaluateHand } from './hand-eval';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const DEFAULT_PLAYERS = 4;
export const DEFAULT_STACK = 100;
export const DEFAULT_SMALL_BLIND = 1;
export const DEFAULT_BIG_BLIND = 2;
/** The learner can never lose more than their starting stack (the D-04 escrow). */
export const MAX_LOSS_UNITS = DEFAULT_STACK;

export const STREETS = ['preflop', 'flop', 'turn', 'river'] as const;
export type Street = (typeof STREETS)[number];

export type TexasHoldemMove =
  /** Give up the hand and everything already put in. */
  | { type: 'fold' }
  /** Pass without betting (only when there is nothing to call). */
  | { type: 'check' }
  /** Match the current bet (or put in everything you have, if that is less). */
  | { type: 'call' }
  /** Open the betting on this street: `amount` chips (≥ the big blind unless all-in). */
  | { type: 'bet'; amount: number }
  /** Raise the bet so your total for this street becomes `to` chips. */
  | { type: 'raise'; to: number }
  /** Put every chip you have left into the pot. */
  | { type: 'all-in' };

export type TexasHoldemMoveType = TexasHoldemMove['type'];
export const MOVE_TYPES: readonly TexasHoldemMoveType[] = [
  'fold',
  'check',
  'call',
  'bet',
  'raise',
  'all-in',
];

/** One entry of the public hand log (everything here is visible to every seat). */
export type HoldemLogEntry =
  | { kind: 'blind'; player: PlayerId; blind: 'small' | 'big'; amount: number; allIn: boolean }
  | {
      kind: 'action';
      player: PlayerId;
      street: Street;
      type: TexasHoldemMoveType;
      /** Chips this action put in (0 for fold / check). */
      amount: number;
      /** The player's total bet on this street after the action. */
      to: number;
      /** What the action amounted to (an all-in can be a call, a bet or a raise). */
      effect: 'fold' | 'check' | 'call' | 'bet' | 'raise';
      /** True when a bet/raise was big enough to count as a full bet/raise. */
      full: boolean;
      /** The player has no chips left after this action. */
      allIn: boolean;
    }
  | { kind: 'deal'; street: Exclude<Street, 'preflop'>; cards: CardCode[] }
  | { kind: 'uncalled'; player: PlayerId; amount: number };

export interface HoldemPot {
  /** Chips in this pot. */
  amount: number;
  /** Seats (not folded) that can win it, in seat order. */
  eligible: PlayerId[];
  /** Seats that won it (several = split), in payout order (clockwise from the button's left). */
  winners: PlayerId[];
  /** Chips each winner received (aligned with `winners`). */
  shares: number[];
  /** Name of the winning hand, or null when nobody had to show (uncontested). */
  handName: string | null;
}

export interface TexasHoldemOutcome {
  /** 'fold' = everyone else folded; 'showdown' = hands were compared. */
  kind: 'fold' | 'showdown';
  /** Seats that won (part of) a pot, in seat order. */
  winners: PlayerId[];
  /** Chips each seat received from the pots. */
  payouts: number[];
  /** Main pot first, then side pots. */
  pots: HoldemPot[];
  /** Seats whose hole cards were turned face up (empty for 'fold'). */
  showdown: PlayerId[];
}

export interface TexasHoldemState {
  players: number;
  button: PlayerId;
  smallBlindSeat: PlayerId;
  bigBlindSeat: PlayerId;
  smallBlind: number;
  bigBlind: number;
  startingStacks: number[];
  /** Chips each seat still has behind (not yet bet). */
  stacks: number[];
  /** Chips each seat has bet on the current street. */
  streetBets: number[];
  /** Chips each seat has put into the pot this hand (street bets included). */
  committed: number[];
  folded: boolean[];
  /**
   * The table's current bet at the moment each seat last acted on this street
   * (null = has not acted yet this street). Used for "who still has to act" and
   * for the incomplete-raise rule.
   */
  actedAt: (number | null)[];
  street: Street;
  /** The bet to match on this street. */
  currentBet: number;
  /** Size of the last full bet/raise increment on this street (starts at the big blind). */
  minRaise: number;
  /** Seat to act, or null when the hand is over. */
  toAct: PlayerId | null;
  /** Two hole cards per seat (hidden information — the UI decides what to show). */
  hands: CardCode[][];
  /** Community cards dealt so far (0, 3, 4 or 5). */
  board: CardCode[];
  /** Burn cards dealt face down before each street. */
  burned: CardCode[];
  /** Undealt cards, in dealing order (hidden information). */
  deck: CardCode[];
  /** Street on which each seat went all-in (null = never). */
  allInStreet: (Street | null)[];
  log: HoldemLogEntry[];
  outcome: TexasHoldemOutcome | null;
}

/** Options in `config.options` (a type alias so it fits `Record<string, unknown>`). */
export type TexasHoldemOptions = {
  /** Chips every seat starts with (default 100). */
  startingStack?: number;
  /** Per-seat starting stacks (overrides startingStack); length must equal the seat count. */
  stacks?: number[];
  /** Small blind (default 1). */
  smallBlind?: number;
  /** Big blind (default 2, at least the small blind). */
  bigBlind?: number;
  /** Fixed button seat (default: chosen by the seed). */
  button?: number;
  /**
   * A fixed deck order (all 52 cards) to deal from instead of shuffling — for
   * tests and curated practice hands. Cards are dealt one at a time starting
   * left of the button (two rounds), then burn + flop, burn + turn, burn + river.
   */
  deck?: string[];
};

// ------------------------------------------------------------------ setup

function positiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

interface ResolvedOptions {
  stacks: number[];
  smallBlind: number;
  bigBlind: number;
  button: number | null;
  deck: CardCode[] | null;
}

function readOptions(config: GameConfig, players: number): ResolvedOptions {
  const o = (config.options ?? {}) as Record<string, unknown>;
  const smallBlind = o.smallBlind ?? DEFAULT_SMALL_BLIND;
  const bigBlind = o.bigBlind ?? DEFAULT_BIG_BLIND;
  if (!positiveInt(smallBlind)) {
    throw new RangeError(`Hold'em option "smallBlind" must be a positive whole number`);
  }
  if (!positiveInt(bigBlind) || bigBlind < smallBlind) {
    throw new RangeError(`Hold'em option "bigBlind" must be a whole number ≥ the small blind`);
  }
  let stacks: number[];
  if (o.stacks !== undefined) {
    if (!Array.isArray(o.stacks) || o.stacks.length !== players || !o.stacks.every(positiveInt)) {
      throw new RangeError(
        `Hold'em option "stacks" must list ${players} positive whole numbers (one per seat)`,
      );
    }
    stacks = (o.stacks as number[]).slice();
  } else {
    const start = o.startingStack ?? DEFAULT_STACK;
    if (!positiveInt(start)) {
      throw new RangeError(`Hold'em option "startingStack" must be a positive whole number`);
    }
    stacks = Array.from({ length: players }, () => start);
  }
  // The learner's wallet covers MAX_LOSS_UNITS (the escrow) plus affordableUnits extra.
  if (config.affordableUnits !== undefined) {
    // A nonsense value (NaN) counts as no extra cover at all — never as a NaN stack.
    const extra = Number.isNaN(config.affordableUnits)
      ? 0
      : Math.max(0, Math.floor(config.affordableUnits));
    const cap = MAX_LOSS_UNITS + extra;
    stacks[0] = Math.min(stacks[0] ?? cap, cap);
  }
  const button = o.button;
  if (button !== undefined && !(Number.isInteger(button) && (button as number) >= 0)) {
    throw new RangeError(`Hold'em option "button" must be a seat number`);
  }
  if (typeof button === 'number' && button >= players) {
    throw new RangeError(`Hold'em option "button" (${button}) must be below ${players}`);
  }
  let deck: CardCode[] | null = null;
  if (o.deck !== undefined) {
    const full = new Set<string>(makeDeck());
    const d = o.deck;
    if (
      !Array.isArray(d) ||
      d.length !== 52 ||
      new Set(d).size !== 52 ||
      !d.every((c) => typeof c === 'string' && full.has(c))
    ) {
      throw new RangeError(`Hold'em option "deck" must be all 52 standard cards, each once`);
    }
    deck = d.slice() as CardCode[];
  }
  return {
    stacks,
    smallBlind,
    bigBlind,
    button: typeof button === 'number' ? button : null,
    deck,
  };
}

/** Pick the button, shuffle, deal two hole cards each and post the blinds. */
export function setupState(config: GameConfig, rng: Rng): TexasHoldemState {
  const players = config.players ?? DEFAULT_PLAYERS;
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) {
    throw new RangeError(
      `Texas Hold'em is set up for ${MIN_PLAYERS}–${MAX_PLAYERS} players, got ${String(players)}`,
    );
  }
  const opts = readOptions(config, players);
  const button = opts.button ?? rng.int(players);
  const deck = opts.deck ?? shuffle(makeDeck(), rng);
  const hands: CardCode[][] = Array.from({ length: players }, () => []);
  let next = 0;
  for (let round = 0; round < 2; round++) {
    for (let i = 1; i <= players; i++) {
      const c = deck[next++];
      if (c === undefined) throw new Error('Deck ran out while dealing');
      hands[(button + i) % players]?.push(c);
    }
  }
  const smallBlindSeat = players === 2 ? button : (button + 1) % players;
  const bigBlindSeat = players === 2 ? (button + 1) % players : (button + 2) % players;
  const zeros = () => Array.from({ length: players }, () => 0);
  const state: TexasHoldemState = {
    players,
    button,
    smallBlindSeat,
    bigBlindSeat,
    smallBlind: opts.smallBlind,
    bigBlind: opts.bigBlind,
    startingStacks: opts.stacks.slice(),
    stacks: opts.stacks.slice(),
    streetBets: zeros(),
    committed: zeros(),
    folded: Array.from({ length: players }, () => false),
    actedAt: Array.from({ length: players }, () => null),
    street: 'preflop',
    // The full big blind is the bet to match, even if the big blind is short.
    currentBet: opts.bigBlind,
    minRaise: opts.bigBlind,
    toAct: null,
    hands,
    board: [],
    burned: [],
    deck: deck.slice(next),
    allInStreet: Array.from({ length: players }, () => null),
    log: [],
    outcome: null,
  };
  postBlind(state, smallBlindSeat, 'small', opts.smallBlind);
  postBlind(state, bigBlindSeat, 'big', opts.bigBlind);
  // Pre-flop action starts left of the big blind (heads-up: the button / small blind).
  return settle(state, bigBlindSeat);
}

function postBlind(s: TexasHoldemState, seat: PlayerId, blind: 'small' | 'big', size: number) {
  const amount = Math.min(size, s.stacks[seat] ?? 0);
  put(s, seat, amount);
  s.log.push({ kind: 'blind', player: seat, blind, amount, allIn: s.stacks[seat] === 0 });
}

// ---------------------------------------------------------------- queries

export function isMove(move: unknown): move is TexasHoldemMove {
  return (
    typeof move === 'object' &&
    move !== null &&
    MOVE_TYPES.includes((move as { type?: unknown }).type as TexasHoldemMoveType)
  );
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Every chip in the middle (previous streets + bets on this street). */
export function potTotal(state: TexasHoldemState): number {
  return sum(state.committed);
}

/** Seats still in the hand (not folded), in seat order. */
export function liveSeats(state: TexasHoldemState): PlayerId[] {
  const out: PlayerId[] = [];
  for (let i = 0; i < state.players; i++) if (!state.folded[i]) out.push(i);
  return out;
}

/** Seats still in the hand that have chips left to bet. */
export function seatsWithChips(state: TexasHoldemState): PlayerId[] {
  return liveSeats(state).filter((i) => (state.stacks[i] ?? 0) > 0);
}

export function isAllIn(state: TexasHoldemState, seat: PlayerId): boolean {
  return !state.folded[seat] && (state.stacks[seat] ?? 0) === 0;
}

/** Everything a seat needs to know about its betting options right now. */
export interface BetOptions {
  /** Chips it costs to call (already capped at the player's stack). */
  toCall: number;
  canCheck: boolean;
  canCall: boolean;
  /** Calling puts the player all-in. */
  callIsAllIn: boolean;
  /** Opening the betting is possible (no bet yet on this street). */
  canBet: boolean;
  /** Raising is possible (there is a bet, betting is open to this player, chips beyond a call). */
  canRaise: boolean;
  /** Smallest full bet (the big blind) — a smaller bet is only possible all-in. */
  minBet: number;
  /** Smallest full raise, as a street total ("raise to"). */
  minRaiseTo: number;
  /** The player's whole stack as a street total: the most they can bet or raise to. */
  maxTo: number;
  /** Going all-in is allowed. */
  canAllIn: boolean;
  /** What going all-in would count as. */
  allInEffect: 'call' | 'bet' | 'raise';
  /** Raising is blocked only because an incomplete all-in did not re-open the betting. */
  raiseClosed: boolean;
  /** Raising/betting is blocked because nobody else has chips left to respond. */
  othersAllIn: boolean;
}

export function betOptions(state: TexasHoldemState, p: PlayerId): BetOptions {
  const stack = state.stacks[p] ?? 0;
  const bet = state.streetBets[p] ?? 0;
  const owed = Math.max(0, state.currentBet - bet);
  const toCall = Math.min(owed, stack);
  const othersWithChips = seatsWithChips(state).filter((i) => i !== p).length > 0;
  const acted = state.actedAt[p] ?? null;
  const reopened = acted === null || state.currentBet - acted >= state.minRaise;
  const beyondCall = stack > owed;
  const noBet = state.currentBet === 0;
  const canBet = noBet && stack > 0 && othersWithChips;
  const canRaise = !noBet && beyondCall && reopened && othersWithChips;
  const allInEffect: BetOptions['allInEffect'] = !beyondCall ? 'call' : noBet ? 'bet' : 'raise';
  return {
    toCall,
    canCheck: owed === 0,
    canCall: owed > 0,
    callIsAllIn: owed > 0 && owed >= stack,
    canBet,
    canRaise,
    minBet: state.bigBlind,
    minRaiseTo: state.currentBet + state.minRaise,
    maxTo: bet + stack,
    canAllIn: stack > 0 && (allInEffect === 'call' || (allInEffect === 'bet' ? canBet : canRaise)),
    allInEffect,
    raiseClosed: !noBet && beyondCall && !reopened && othersWithChips,
    othersAllIn: !othersWithChips,
  };
}

/** Kind of legality problem (engine.ts turns these into friendly sentences). */
export type MoveProblem =
  | { kind: 'over' }
  | { kind: 'not-a-move' }
  | { kind: 'no-seat' }
  | { kind: 'folded' }
  | { kind: 'all-in' }
  | { kind: 'not-your-turn'; turn: PlayerId }
  | { kind: 'check-facing-bet' }
  | { kind: 'nothing-to-call' }
  | { kind: 'bet-exists' }
  | { kind: 'no-bet-to-raise' }
  | { kind: 'not-whole'; field: 'amount' | 'to' }
  | { kind: 'bet-too-small' }
  | { kind: 'bet-too-big' }
  | { kind: 'raise-not-bigger' }
  | { kind: 'raise-too-small' }
  | { kind: 'raise-too-big' }
  | { kind: 'raise-closed'; allIn: boolean }
  | { kind: 'cannot-cover-raise' }
  | { kind: 'others-all-in'; allIn: boolean };

/** Null when `move` is legal for `p`, otherwise what is wrong with it. */
export function moveProblem(
  state: TexasHoldemState,
  p: PlayerId,
  move: TexasHoldemMove,
): MoveProblem | null {
  if (state.outcome) return { kind: 'over' };
  if (!isMove(move)) return { kind: 'not-a-move' };
  if (!Number.isInteger(p) || p < 0 || p >= state.players) return { kind: 'no-seat' };
  if (state.folded[p]) return { kind: 'folded' };
  if ((state.stacks[p] ?? 0) === 0) return { kind: 'all-in' };
  const turn = state.toAct ?? 0;
  if (turn !== p) return { kind: 'not-your-turn', turn };
  const o = betOptions(state, p);
  const bet = state.streetBets[p] ?? 0;
  switch (move.type) {
    case 'fold':
      return null;
    case 'check':
      return o.canCheck ? null : { kind: 'check-facing-bet' };
    case 'call':
      return o.canCall ? null : { kind: 'nothing-to-call' };
    case 'bet': {
      if (state.currentBet > 0) return { kind: 'bet-exists' };
      if (!Number.isInteger(move.amount) || move.amount <= 0) {
        return { kind: 'not-whole', field: 'amount' };
      }
      if (o.othersAllIn) return { kind: 'others-all-in', allIn: false };
      if (move.amount > o.maxTo) return { kind: 'bet-too-big' };
      if (move.amount < o.minBet && move.amount !== o.maxTo) return { kind: 'bet-too-small' };
      return null;
    }
    case 'raise': {
      if (state.currentBet === 0) return { kind: 'no-bet-to-raise' };
      if (!Number.isInteger(move.to) || move.to <= 0) return { kind: 'not-whole', field: 'to' };
      if (o.othersAllIn) return { kind: 'others-all-in', allIn: false };
      if ((state.stacks[p] ?? 0) <= state.currentBet - bet) return { kind: 'cannot-cover-raise' };
      if (o.raiseClosed) return { kind: 'raise-closed', allIn: false };
      if (move.to <= state.currentBet) return { kind: 'raise-not-bigger' };
      if (move.to > o.maxTo) return { kind: 'raise-too-big' };
      if (move.to < o.minRaiseTo && move.to !== o.maxTo) return { kind: 'raise-too-small' };
      return null;
    }
    case 'all-in': {
      if (o.allInEffect === 'call') return null;
      if (o.othersAllIn) return { kind: 'others-all-in', allIn: true };
      if (o.allInEffect === 'raise' && o.raiseClosed) return { kind: 'raise-closed', allIn: true };
      return null;
    }
  }
}

/** Round to a whole chip. */
const chip = (x: number) => Math.round(x);

/**
 * Legal moves for `p` with a SMALL representative set of bet/raise sizes
 * (minimum, ½ pot, ¾ pot, pot) plus all-in, deduplicated. Any other whole
 * amount between the minimum and all-in is legal too (see moveProblem).
 */
export function legalMovesFor(state: TexasHoldemState, p: PlayerId): TexasHoldemMove[] {
  if (state.outcome || state.toAct !== p) return [];
  const o = betOptions(state, p);
  const moves: TexasHoldemMove[] = [{ type: 'fold' }];
  if (o.canCheck) moves.push({ type: 'check' });
  if (o.canCall) moves.push({ type: 'call' });
  const pot = potTotal(state);
  if (o.canBet) {
    const sizes = [o.minBet, pot / 2, (pot * 3) / 4, pot].map(chip);
    const seen = new Set<number>();
    for (const amount of sizes) {
      const a = Math.max(o.minBet, amount);
      if (a >= o.maxTo || seen.has(a)) continue;
      seen.add(a);
      moves.push({ type: 'bet', amount: a });
    }
  }
  if (o.canRaise) {
    // A "pot-sized" raise: call first, then raise by the size of the pot after the call.
    const owed = state.currentBet - (state.streetBets[p] ?? 0);
    const after = pot + owed;
    const tos = [o.minRaiseTo, state.currentBet + after / 2, state.currentBet + (after * 3) / 4]
      .concat([state.currentBet + after])
      .map(chip);
    const seen = new Set<number>();
    for (const to of tos) {
      const t = Math.max(o.minRaiseTo, to);
      if (t >= o.maxTo || seen.has(t)) continue;
      seen.add(t);
      moves.push({ type: 'raise', to: t });
    }
  }
  if (o.canAllIn && o.allInEffect !== 'call') moves.push({ type: 'all-in' });
  return moves;
}

export function moveKeyOf(move: TexasHoldemMove): string {
  switch (move.type) {
    case 'bet':
      return `bet:${move.amount}`;
    case 'raise':
      return `raise:${move.to}`;
    default:
      return move.type;
  }
}

// -------------------------------------------------------------- transition

function cloneState(s: TexasHoldemState): TexasHoldemState {
  return {
    ...s,
    startingStacks: s.startingStacks.slice(),
    stacks: s.stacks.slice(),
    streetBets: s.streetBets.slice(),
    committed: s.committed.slice(),
    folded: s.folded.slice(),
    actedAt: s.actedAt.slice(),
    hands: s.hands.map((h) => h.slice()),
    board: s.board.slice(),
    burned: s.burned.slice(),
    deck: s.deck.slice(),
    allInStreet: s.allInStreet.slice(),
    log: s.log.slice(),
    outcome: s.outcome,
  };
}

/** Move `amount` chips from a seat's stack into its street bet (mutates the working copy). */
function put(s: TexasHoldemState, seat: PlayerId, amount: number): void {
  if (amount <= 0) return;
  s.stacks[seat] = (s.stacks[seat] ?? 0) - amount;
  s.streetBets[seat] = (s.streetBets[seat] ?? 0) + amount;
  s.committed[seat] = (s.committed[seat] ?? 0) + amount;
  if (s.stacks[seat] === 0 && s.allInStreet[seat] === null) s.allInStreet[seat] = s.street;
}

/** Apply a legal move by the seat to act. Throws on an illegal move. */
export function transition(state: TexasHoldemState, move: TexasHoldemMove): TexasHoldemState {
  const p = state.toAct;
  if (p === null) throw new Error('The hand is over');
  const problem = moveProblem(state, p, move);
  if (problem) throw new Error(`Illegal move: ${problem.kind}`);
  const s = cloneState(state);
  const owed = s.currentBet - (s.streetBets[p] ?? 0);
  let effect: 'fold' | 'check' | 'call' | 'bet' | 'raise';
  let amount = 0;
  let full = false;
  switch (move.type) {
    case 'fold':
      s.folded[p] = true;
      effect = 'fold';
      break;
    case 'check':
      effect = 'check';
      break;
    case 'call':
      amount = Math.min(owed, s.stacks[p] ?? 0);
      effect = 'call';
      break;
    case 'bet':
      amount = move.amount;
      effect = 'bet';
      break;
    case 'raise':
      amount = move.to - (s.streetBets[p] ?? 0);
      effect = 'raise';
      break;
    case 'all-in': {
      amount = s.stacks[p] ?? 0;
      effect = amount <= owed ? 'call' : s.currentBet === 0 ? 'bet' : 'raise';
      break;
    }
  }
  put(s, p, amount);
  const to = s.streetBets[p] ?? 0;
  if (effect === 'bet' || effect === 'raise') {
    const increment = to - s.currentBet;
    full = increment >= s.minRaise;
    if (full) s.minRaise = increment;
    s.currentBet = to;
  }
  s.actedAt[p] = s.currentBet;
  s.log.push({
    kind: 'action',
    player: p,
    street: s.street,
    type: move.type,
    amount,
    to,
    effect,
    full,
    allIn: (s.stacks[p] ?? 0) === 0,
  });
  return settle(s, p);
}

/** Is `seat` still waiting to act in the current betting round? */
function pending(s: TexasHoldemState, seat: PlayerId, withChips: readonly PlayerId[]): boolean {
  if (s.folded[seat] || (s.stacks[seat] ?? 0) === 0) return false;
  const bet = s.streetBets[seat] ?? 0;
  if (withChips.length === 1) {
    // Nobody left to bet against: only an all-in bigger than ours needs an answer.
    const others = liveSeats(s).filter((i) => i !== seat);
    return bet < Math.max(0, ...others.map((i) => s.streetBets[i] ?? 0));
  }
  return s.actedAt[seat] === null || bet < s.currentBet;
}

/** First seat clockwise after `from` that still has to act, or null. */
function nextPending(s: TexasHoldemState, from: PlayerId): PlayerId | null {
  const withChips = seatsWithChips(s);
  for (let i = 1; i <= s.players; i++) {
    const seat = (from + i) % s.players;
    if (pending(s, seat, withChips)) return seat;
  }
  return null;
}

/**
 * After an action (or the blinds): end the hand if one player is left, pass the
 * turn, or close the betting round — return unmatched chips, deal the next
 * street (or the rest of the board) and go to the showdown after the river.
 * Mutates and returns the working copy `s`.
 */
function settle(s: TexasHoldemState, lastActor: PlayerId): TexasHoldemState {
  const live = liveSeats(s);
  if (live.length === 1) {
    returnUncalled(s);
    return finishByFold(s, live[0] ?? 0);
  }
  const next = nextPending(s, lastActor);
  if (next !== null) {
    s.toAct = next;
    return s;
  }
  // The betting round is over.
  returnUncalled(s);
  for (let i = 0; i < s.players; i++) s.streetBets[i] = 0;
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  for (let i = 0; i < s.players; i++) s.actedAt[i] = null;
  if (s.street === 'river') return showdown(s);
  if (seatsWithChips(s).length < 2) {
    // Nobody can bet any more: deal the rest of the board and show down.
    while (s.board.length < 5) dealStreet(s);
    return showdown(s);
  }
  dealStreet(s);
  const first = nextPending(s, s.button);
  if (first === null) throw new Error('No player to act after dealing');
  s.toAct = first;
  return s;
}

/** The biggest bet of the round, where nobody matched all of it, goes back to its owner. */
function returnUncalled(s: TexasHoldemState): void {
  let top = -1;
  let topBet = 0;
  let second = 0;
  for (let i = 0; i < s.players; i++) {
    const b = s.streetBets[i] ?? 0;
    if (b > topBet) {
      second = topBet;
      topBet = b;
      top = i;
    } else if (b > second) second = b;
  }
  if (top < 0 || topBet <= second || s.folded[top]) return;
  const amount = topBet - second;
  s.stacks[top] = (s.stacks[top] ?? 0) + amount;
  s.streetBets[top] = second;
  s.committed[top] = (s.committed[top] ?? 0) - amount;
  s.log.push({ kind: 'uncalled', player: top, amount });
}

function dealStreet(s: TexasHoldemState): void {
  const street: Exclude<Street, 'preflop'> =
    s.street === 'preflop' ? 'flop' : s.street === 'flop' ? 'turn' : 'river';
  const count = street === 'flop' ? 3 : 1;
  const burn = s.deck.shift();
  if (burn === undefined) throw new Error('Deck ran out');
  s.burned.push(burn);
  const cards: CardCode[] = [];
  for (let i = 0; i < count; i++) {
    const c = s.deck.shift();
    if (c === undefined) throw new Error('Deck ran out');
    cards.push(c);
  }
  s.board.push(...cards);
  s.street = street;
  s.log.push({ kind: 'deal', street, cards });
}

function finishByFold(s: TexasHoldemState, winner: PlayerId): TexasHoldemState {
  const pot = potTotal(s);
  const payouts = Array.from({ length: s.players }, () => 0);
  payouts[winner] = pot;
  s.stacks[winner] = (s.stacks[winner] ?? 0) + pot;
  for (let i = 0; i < s.players; i++) s.streetBets[i] = 0;
  s.toAct = null;
  s.outcome = {
    kind: 'fold',
    winners: [winner],
    payouts,
    pots: [{ amount: pot, eligible: [winner], winners: [winner], shares: [pot], handName: null }],
    showdown: [],
  };
  return s;
}

/** Seats in payout order for odd chips: clockwise starting left of the button. */
export function clockwiseFromButton(state: TexasHoldemState, seats: readonly PlayerId[]) {
  const n = state.players;
  return seats
    .slice()
    .sort((a, b) => ((a - state.button + n - 1) % n) - ((b - state.button + n - 1) % n));
}

/**
 * Split the chips into a main pot and side pots by contribution level.
 * Each pot can be won by the live (not folded) seats that put in at least
 * that level. Chips folded players put in above every live level join the top pot.
 */
export function buildPots(
  committed: readonly number[],
  folded: readonly boolean[],
): { amount: number; eligible: PlayerId[] }[] {
  const live = committed.map((_, i) => i).filter((i) => !folded[i]);
  const levels = [...new Set(live.map((i) => committed[i] ?? 0))]
    .filter((x) => x > 0)
    .sort((a, b) => a - b);
  const pots: { amount: number; eligible: PlayerId[] }[] = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const c of committed) amount += Math.min(c, level) - Math.min(c, prev);
    const eligible = live.filter((i) => (committed[i] ?? 0) >= level);
    if (amount > 0) pots.push({ amount, eligible });
    prev = level;
  }
  let leftover = 0;
  for (const c of committed) leftover += Math.max(0, c - prev);
  const last = pots[pots.length - 1];
  if (leftover > 0) {
    if (last) last.amount += leftover;
    else pots.push({ amount: leftover, eligible: live });
  }
  return pots;
}

function showdown(s: TexasHoldemState): TexasHoldemState {
  const live = liveSeats(s);
  const scores = new Map<PlayerId, { score: number; name: string }>();
  for (const seat of live) {
    const v = evaluateHand([...(s.hands[seat] ?? []), ...s.board]);
    scores.set(seat, { score: v.score, name: v.name });
  }
  const payouts = Array.from({ length: s.players }, () => 0);
  const pots: HoldemPot[] = buildPots(s.committed, s.folded).map((pot) => {
    const best = Math.max(...pot.eligible.map((i) => scores.get(i)?.score ?? -1));
    const winners = clockwiseFromButton(
      s,
      pot.eligible.filter((i) => scores.get(i)?.score === best),
    );
    const base = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - base * winners.length;
    const shares = winners.map(() => {
      const extra = odd > 0 ? 1 : 0;
      odd -= extra;
      return base + extra;
    });
    winners.forEach((w, i) => {
      payouts[w] = (payouts[w] ?? 0) + (shares[i] ?? 0);
    });
    const contested = pot.eligible.length > 1;
    return {
      amount: pot.amount,
      eligible: pot.eligible,
      winners,
      shares,
      handName: contested ? (scores.get(winners[0] ?? 0)?.name ?? null) : null,
    };
  });
  for (let i = 0; i < s.players; i++) s.stacks[i] = (s.stacks[i] ?? 0) + (payouts[i] ?? 0);
  s.toAct = null;
  s.outcome = {
    kind: 'showdown',
    winners: payouts.map((x, i) => (x > 0 ? i : -1)).filter((i) => i >= 0),
    payouts,
    pots,
    showdown: live,
  };
  return s;
}
