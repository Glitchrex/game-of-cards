/**
 * Teen Patti rules: state shape, setup, legality and the pure state transition.
 * The GameEngine object (engine.ts) wires these together with the bots,
 * descriptions, coaching and result scoring.
 *
 * Units: 1 unit = 1 boot. Everything (stake, pot, contributions) is counted in boots.
 */
import { type CardCode, makeDeck } from '@/games/core/cards';
import { type Rng, shuffle } from '@/games/core/rng';
import type { GameConfig, PlayerId } from '@/games/core/types';
import { compareHands } from './hand-eval';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
export const DEFAULT_PLAYERS = 3;
/** Everyone posts one boot before the deal. */
export const BOOT = 1;
/** Chaal limit: the (blind-equivalent) stake can never exceed 8 boots. */
export const DEFAULT_STAKE_LIMIT = 8;
/** Pot limit: when a bet would bring the pot to 64 boots, everyone left shows. */
export const DEFAULT_POT_LIMIT = 64;
/** Worst case for the learner (the escrow in D-04): the whole capped pot. */
export const MAX_LOSS_UNITS = DEFAULT_POT_LIMIT;
export const CARDS_PER_HAND = 3;

export type TeenPattiMoveType = 'see' | 'pack' | 'chaal' | 'raise' | 'show';

export type TeenPattiMove =
  /** Look at your cards (blind → seen). You then act again. */
  | { type: 'see' }
  /** Fold: give up the hand and everything you have put in. */
  | { type: 'pack' }
  /** Bet the current stake (blind) or twice the stake (seen). */
  | { type: 'chaal' }
  /** Bet double a chaal; the stake doubles. Only while the new stake ≤ the chaal limit. */
  | { type: 'raise' }
  /** Pay a chaal and compare hands. Only when exactly two players are left. */
  | { type: 'show' };

export const MOVE_TYPES: readonly TeenPattiMoveType[] = ['see', 'chaal', 'raise', 'show', 'pack'];

/** One entry of the public action history. */
export interface TeenPattiAction {
  player: PlayerId;
  type: TeenPattiMoveType;
  /** Boots this action put into the pot (0 for see / pack). */
  amount: number;
  /** Whether the player was still blind when acting (true for a 'see'). */
  blind: boolean;
  /** The stake (blind-equivalent, in boots) after this action. */
  stake: number;
  /** The pot after this action. */
  pot: number;
  /** True when this bet hit the pot limit and was capped. */
  capped: boolean;
}

export type TeenPattiEndKind =
  /** Everyone else packed. */
  | 'last-standing'
  /** Two players left and one asked for a show. */
  | 'show'
  /** A bet reached the pot limit: everyone still in showed. */
  | 'pot-limit';

export interface TeenPattiOutcome {
  kind: TeenPattiEndKind;
  /** Seats that won (a share of) the pot, in seat order. */
  winners: PlayerId[];
  /** Boots each seat receives from the pot (sums to the pot). */
  payouts: number[];
  /** Seats whose cards were turned face up and compared (empty for last-standing). */
  showdown: PlayerId[];
  /** Who asked for the show (kind 'show' only). */
  asker: PlayerId | null;
}

export interface TeenPattiState {
  players: number;
  /** Dealer seat (chosen by the seed); play starts on the dealer's left (next seat). */
  dealer: PlayerId;
  /** Three face-down cards per seat. */
  hands: CardCode[][];
  /** Undealt cards (never used during the hand — kept for card conservation). */
  stock: CardCode[];
  seen: boolean[];
  packed: boolean[];
  /** Boots each seat has put into the pot (boot included). */
  contributed: number[];
  pot: number;
  /** Current blind-equivalent stake in boots (1, 2, 4, 8). */
  stake: number;
  stakeLimit: number;
  potLimit: number;
  /** Seat to act, or null when the hand is over. */
  turn: PlayerId | null;
  history: TeenPattiAction[];
  outcome: TeenPattiOutcome | null;
}

/** Options in `config.options` (a type alias so it fits `Record<string, unknown>`). */
export type TeenPattiOptions = {
  /** Fixed dealer seat (default: chosen by the seed). */
  dealer?: number;
  /** Chaal limit in boots: 1, 2, 4 or 8 (default 8). */
  stakeLimit?: number;
  /** Pot limit in boots, from players + 1 up to 64 (default 64). */
  potLimit?: number;
};

interface ResolvedOptions {
  dealer: number | null;
  stakeLimit: number;
  potLimit: number;
}

function readOptions(config: GameConfig, players: number): ResolvedOptions {
  const o = (config.options ?? {}) as Record<string, unknown>;
  const dealer = o.dealer;
  const stakeLimit = o.stakeLimit ?? DEFAULT_STAKE_LIMIT;
  const potLimit = o.potLimit ?? DEFAULT_POT_LIMIT;
  if (dealer !== undefined && !(Number.isInteger(dealer) && (dealer as number) >= 0)) {
    throw new RangeError(`Teen Patti option "dealer" must be a seat number, got ${String(dealer)}`);
  }
  if (typeof dealer === 'number' && dealer >= players) {
    throw new RangeError(`Teen Patti option "dealer" (${dealer}) must be below ${players}`);
  }
  if (![1, 2, 4, 8].includes(stakeLimit as number)) {
    throw new RangeError(
      `Teen Patti option "stakeLimit" must be 1, 2, 4 or 8, got ${String(stakeLimit)}`,
    );
  }
  if (
    !Number.isInteger(potLimit) ||
    (potLimit as number) <= players ||
    (potLimit as number) > DEFAULT_POT_LIMIT
  ) {
    throw new RangeError(
      `Teen Patti option "potLimit" must be a whole number from ${players + 1} to ${DEFAULT_POT_LIMIT}, got ${String(potLimit)}`,
    );
  }
  return {
    dealer: typeof dealer === 'number' ? dealer : null,
    stakeLimit: stakeLimit as number,
    potLimit: potLimit as number,
  };
}

/** Shuffle, pick a dealer, post boots and deal three cards to everyone. */
export function setupState(config: GameConfig, rng: Rng): TeenPattiState {
  const players = config.players ?? DEFAULT_PLAYERS;
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) {
    throw new RangeError(
      `Teen Patti is set up for ${MIN_PLAYERS}–${MAX_PLAYERS} players, got ${String(players)}`,
    );
  }
  const opts = readOptions(config, players);
  const dealer = opts.dealer ?? rng.int(players);
  const deck = shuffle(makeDeck(), rng);
  const hands: CardCode[][] = Array.from({ length: players }, () => []);
  // Deal one card at a time, starting on the dealer's left, like at a real table.
  let next = 0;
  for (let round = 0; round < CARDS_PER_HAND; round++) {
    for (let i = 1; i <= players; i++) {
      const seat = (dealer + i) % players;
      const c = deck[next++];
      if (c === undefined) throw new Error('Deck ran out while dealing');
      hands[seat]?.push(c);
    }
  }
  return {
    players,
    dealer,
    hands,
    stock: deck.slice(next),
    seen: Array.from({ length: players }, () => false),
    packed: Array.from({ length: players }, () => false),
    contributed: Array.from({ length: players }, () => BOOT),
    pot: BOOT * players,
    stake: BOOT,
    stakeLimit: opts.stakeLimit,
    potLimit: opts.potLimit,
    turn: (dealer + 1) % players,
    history: [],
    outcome: null,
  };
}

// ---------------------------------------------------------------- queries

export function isMove(move: unknown): move is TeenPattiMove {
  return (
    typeof move === 'object' &&
    move !== null &&
    MOVE_TYPES.includes((move as { type?: unknown }).type as TeenPattiMoveType)
  );
}

/** Seats still in the hand (not packed), in seat order. */
export function activeSeats(state: TeenPattiState): PlayerId[] {
  const out: PlayerId[] = [];
  for (let i = 0; i < state.players; i++) if (!state.packed[i]) out.push(i);
  return out;
}

/** Next seat after `from` (clockwise = increasing seat number) that has not packed. */
export function nextActiveSeat(state: TeenPattiState, from: PlayerId): PlayerId {
  for (let i = 1; i <= state.players; i++) {
    const seat = (from + i) % state.players;
    if (!state.packed[seat]) return seat;
  }
  return from;
}

export function canRaise(state: TeenPattiState): boolean {
  return state.stake * 2 <= state.stakeLimit;
}

/** What a bet costs before the pot-limit cap: chaal/show = stake (blind) or 2× (seen); raise doubles that. */
export function baseCost(state: TeenPattiState, player: PlayerId, type: TeenPattiMoveType): number {
  if (type === 'see' || type === 'pack') return 0;
  const chaal = state.seen[player] ? 2 * state.stake : state.stake;
  return type === 'raise' ? 2 * chaal : chaal;
}

/**
 * Boots `player` would actually put in with this move (capped so the pot never
 * goes past the pot limit). 0 for see and pack.
 */
export function moveCost(state: TeenPattiState, player: PlayerId, move: TeenPattiMove): number {
  const base = baseCost(state, player, move.type);
  return Math.min(base, Math.max(0, state.potLimit - state.pot));
}

/** True when this bet would bring the pot up to the pot limit (forcing a show of everyone left). */
export function hitsPotLimit(
  state: TeenPattiState,
  player: PlayerId,
  move: TeenPattiMove,
): boolean {
  const base = baseCost(state, player, move.type);
  return base > 0 && state.pot + base >= state.potLimit;
}

/** Legal moves for the seat to act, in a stable display order. */
export function legalMovesFor(state: TeenPattiState, player: PlayerId): TeenPattiMove[] {
  if (state.outcome || state.turn !== player) return [];
  const moves: TeenPattiMove[] = [];
  if (!state.seen[player]) moves.push({ type: 'see' });
  moves.push({ type: 'chaal' });
  if (canRaise(state)) moves.push({ type: 'raise' });
  if (activeSeats(state).length === 2) moves.push({ type: 'show' });
  moves.push({ type: 'pack' });
  return moves;
}

// ---------------------------------------------------------------- transition

/**
 * Split `pot` between `winners`; odd boots go one at a time to the winners
 * closest to the dealer's left.
 */
export function splitPot(state: TeenPattiState, winners: PlayerId[], pot: number): number[] {
  const payouts = Array.from({ length: state.players }, () => 0);
  if (winners.length === 0) return payouts;
  const share = Math.floor(pot / winners.length);
  let remainder = pot - share * winners.length;
  for (const w of winners) payouts[w] = share;
  for (let i = 1; i <= state.players && remainder > 0; i++) {
    const seat = (state.dealer + i) % state.players;
    if (winners.includes(seat)) {
      payouts[seat] = (payouts[seat] ?? 0) + 1;
      remainder--;
    }
  }
  return payouts;
}

function handOf(state: TeenPattiState, seat: PlayerId): CardCode[] {
  return state.hands[seat] ?? [];
}

/** Best hand(s) among `seats` (all seats that tie for best). */
export function bestSeats(state: TeenPattiState, seats: readonly PlayerId[]): PlayerId[] {
  let best: PlayerId[] = [];
  for (const s of seats) {
    const top = best[0];
    if (top === undefined) {
      best = [s];
      continue;
    }
    const c = compareHands(handOf(state, s), handOf(state, top));
    if (c > 0) best = [s];
    else if (c === 0) best.push(s);
  }
  return best.sort((a, b) => a - b);
}

function finish(
  state: TeenPattiState,
  kind: TeenPattiEndKind,
  winners: PlayerId[],
  showdown: PlayerId[],
  asker: PlayerId | null,
): TeenPattiState {
  return {
    ...state,
    turn: null,
    outcome: { kind, winners, payouts: splitPot(state, winners, state.pot), showdown, asker },
  };
}

/**
 * Apply a move for the seat to act WITHOUT re-checking legality (the engine's
 * applyMove calls assertLegal first). Never mutates `state`.
 */
export function transition(state: TeenPattiState, move: TeenPattiMove): TeenPattiState {
  const p = state.turn;
  if (p === null) return state;
  const wasBlind = !state.seen[p];
  if (move.type === 'see') {
    const seen = state.seen.slice();
    seen[p] = true;
    return {
      ...state,
      seen,
      history: [
        ...state.history,
        {
          player: p,
          type: 'see',
          amount: 0,
          blind: true,
          stake: state.stake,
          pot: state.pot,
          capped: false,
        },
      ],
    };
  }
  if (move.type === 'pack') {
    const packed = state.packed.slice();
    packed[p] = true;
    const next: TeenPattiState = {
      ...state,
      packed,
      history: [
        ...state.history,
        {
          player: p,
          type: 'pack',
          amount: 0,
          blind: wasBlind,
          stake: state.stake,
          pot: state.pot,
          capped: false,
        },
      ],
    };
    const left = activeSeats(next);
    if (left.length === 1) return finish(next, 'last-standing', left, [], null);
    return { ...next, turn: nextActiveSeat(next, p) };
  }
  // chaal / raise / show: a bet.
  const capped = hitsPotLimit(state, p, move);
  const pay = moveCost(state, p, move);
  const stake = move.type === 'raise' ? state.stake * 2 : state.stake;
  const contributed = state.contributed.slice();
  contributed[p] = (contributed[p] ?? 0) + pay;
  const pot = state.pot + pay;
  const next: TeenPattiState = {
    ...state,
    contributed,
    pot,
    stake,
    history: [
      ...state.history,
      { player: p, type: move.type, amount: pay, blind: wasBlind, stake, pot, capped },
    ],
  };
  const left = activeSeats(next);
  if (move.type === 'show') {
    const other = left.find((s) => s !== p) ?? p;
    // Equal hands: the player who asked for the show loses.
    const winner = compareHands(handOf(next, p), handOf(next, other)) > 0 ? p : other;
    return finish(
      next,
      'show',
      [winner],
      [p, other].sort((a, b) => a - b),
      p,
    );
  }
  if (capped) return finish(next, 'pot-limit', bestSeats(next, left), left, null);
  return { ...next, turn: nextActiveSeat(next, p) };
}
