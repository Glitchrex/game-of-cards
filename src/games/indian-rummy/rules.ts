/**
 * Indian Rummy (13-card points rummy) — state, setup, legality and transitions.
 * See docs/RULES_DECISIONS.md → Indian Rummy and docs/engine-notes/indian-rummy.md.
 *
 * Seats are numbered clockwise; seat 0 is the learner in play mode. The player on the
 * dealer's left (the next seat number) takes the first turn. A turn is: draw one card (closed
 * stock or open pile), then discard one — or declare (discard the 14th card and show the
 * other 13 in valid groups). Before drawing you may instead drop out (20 points before your
 * first draw of the game, 40 later). 1 betting unit = 1 point.
 */
import {
  type CardCode,
  type Rank,
  cardName,
  isCardCode,
  makeDeck,
  sortHand,
} from '@/games/core/cards';
import { type Rng, rngFromState, shuffle } from '@/games/core/rng';
import type { GameConfig, MoveCheck, PlayerId } from '@/games/core/types';
import {
  DEADWOOD_CAP,
  canDeclareAfterOneDiscard,
  deadwoodOf,
  declareProblem,
  isJokerFor,
  isValidHand,
  rawDeadwoodOf,
  wildRankFor,
} from './melds';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const DEFAULT_PLAYERS = 2;
export const HAND_SIZE = 13;
/** Two standard decks plus two printed jokers. */
export const DECK_SIZE = 106;
export const FIRST_DROP_POINTS = 20;
export const MIDDLE_DROP_POINTS = 40;
/** Turns (draw + discard) after which an undeclared game is scored by deadwood. */
export const DEFAULT_MAX_TURNS = 200;
/** Worst case for the learner in stake units (1 unit = 1 point). */
export const MAX_LOSS_UNITS = DEADWOOD_CAP;

export type DrawSource = 'stock' | 'discard';

/**
 * Moves. `draw` with `from: 'wild'` is an attempt to take the face-up wild-joker card: it is
 * never legal, but boards may submit it so the learner gets an explanation.
 */
export type IndianRummyMove =
  | { type: 'draw'; from: DrawSource | 'wild' }
  | { type: 'discard'; card: CardCode }
  | { type: 'declare'; discard: CardCode }
  | { type: 'drop' };

export type IndianRummyMoveType = IndianRummyMove['type'];
export type DropKind = 'first' | 'middle';
export type EndKind = 'declare' | 'drop' | 'turn-cap';

export interface IndianRummyOutcome {
  kind: EndKind;
  winners: PlayerId[];
  /**
   * Points counted against each seat: deadwood (capped at 80) or 20/40 for a drop. The
   * declarer (or last player left) counts 0; at the turn cap winners show their deadwood.
   */
  points: number[];
  /** Net points per seat: losers pay their points, winners share the total. Sums to 0. */
  net: number[];
  declarer: PlayerId | null;
}

export interface IndianRummyOptions {
  /** Dealing seat (the next seat plays first). Default: chosen by the seed. */
  dealer?: number;
  /** Turn cap (default 200). */
  maxTurns?: number;
}

export interface IndianRummyState {
  players: number;
  dealer: PlayerId;
  /** Cards per seat. A dropped seat keeps its 13 cards face down, out of play. */
  hands: CardCode[][];
  /** Closed stock, face down; the next card drawn is the LAST element. */
  stock: CardCode[];
  /** Open pile, face up; the top card is the LAST element. */
  discard: CardCode[];
  /** The face-up wild-joker card under the stock (out of play). */
  wildCard: CardCode;
  /** Every card of this rank is a joker (Aces when the wild-joker card is a printed joker). */
  wildRank: Rank;
  turn: PlayerId;
  phase: 'draw' | 'discard';
  /** What the current player drew this turn (a stock card is private to that seat). */
  drawn: { from: DrawSource; card: CardCode } | null;
  /** Whether each seat has drawn at least once this game (first vs middle drop). */
  hasDrawn: boolean[];
  drops: (DropKind | null)[];
  /** Completed turns (discard or declare) per seat. */
  turnsTaken: number[];
  /** Completed turns at the table. */
  turnCount: number;
  maxTurns: number;
  /** Highest raw deadwood (ungrouped points, ignoring the pure-sequence rule) per seat. */
  peakDeadwood: number[];
  /** How many times the open pile was shuffled into a new stock. */
  reshuffles: number;
  /** Serialised RNG for reshuffles. */
  rngState: number;
  /** The card a declarer discarded to finish. */
  finishCard: CardCode | null;
  outcome: IndianRummyOutcome | null;
}

// ------------------------------------------------------------------ words

/** Sentence-start name: "You" for seat 0, "Player N" otherwise. */
export function seatName(p: PlayerId): string {
  return p === 0 ? 'You' : `Player ${p}`;
}
/** Mid-sentence name. */
export function seatLower(p: PlayerId): string {
  return p === 0 ? 'you' : `Player ${p}`;
}
export function possessive(p: PlayerId): string {
  return p === 0 ? 'your' : `Player ${p}'s`;
}
/** Verb agreeing with the seat: verb(0, 'draw', 'draws') → 'draw'. */
export function verb(p: PlayerId, you: string, they: string): string {
  return p === 0 ? you : they;
}
export function points(n: number): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${v} point${n === 1 ? '' : 's'}`;
}
/** "the Queen of Spades", "a printed joker", "the 7 of Hearts (a wild joker)". */
export function cardPhrase(card: CardCode, wildRank: Rank): string {
  if (card === 'X1' || card === 'X2') return 'a printed joker';
  const base = `the ${cardName(card)}`;
  return isJokerFor(card, wildRank) ? `${base} (a wild joker)` : base;
}

// ------------------------------------------------------------------ setup

export function fullDeck(): CardCode[] {
  return [...makeDeck({ copies: 2 }), 'X1', 'X2'];
}

function readOptions(config: GameConfig): IndianRummyOptions {
  const o = config.options ?? {};
  const out: IndianRummyOptions = {};
  if (typeof o.dealer === 'number') out.dealer = o.dealer;
  if (typeof o.maxTurns === 'number') out.maxTurns = o.maxTurns;
  return out;
}

export function setupState(config: GameConfig, rng: Rng): IndianRummyState {
  const players = config.players ?? DEFAULT_PLAYERS;
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) {
    throw new RangeError(
      `Indian Rummy needs ${MIN_PLAYERS}–${MAX_PLAYERS} players (got ${String(players)})`,
    );
  }
  const opts = readOptions(config);
  if (
    opts.dealer !== undefined &&
    (!Number.isInteger(opts.dealer) || opts.dealer < 0 || opts.dealer >= players)
  ) {
    throw new RangeError(`Indian Rummy: dealer must be a seat 0–${players - 1}`);
  }
  if (opts.maxTurns !== undefined && (!Number.isInteger(opts.maxTurns) || opts.maxTurns < 1)) {
    throw new RangeError('Indian Rummy: maxTurns must be a positive integer');
  }
  const dealer = opts.dealer ?? rng.int(players);
  const deck = shuffle(fullDeck(), rng);
  const hands: CardCode[][] = Array.from({ length: players }, () => []);
  let k = 0;
  const next = (): CardCode => {
    const c = deck[k++];
    if (c === undefined) throw new Error('Indian Rummy: ran out of cards while dealing');
    return c;
  };
  // One card at a time, starting on the dealer's left.
  for (let round = 0; round < HAND_SIZE; round++) {
    for (let i = 1; i <= players; i++) hands[(dealer + i) % players]?.push(next());
  }
  const wildCard = next();
  const firstDiscard = next();
  const stock = deck.slice(k);
  const wildRank = wildRankFor(wildCard);
  const sorted = hands.map((h) => sortHand(h));
  return {
    players,
    dealer,
    hands: sorted,
    stock,
    discard: [firstDiscard],
    wildCard,
    wildRank,
    turn: (dealer + 1) % players,
    phase: 'draw',
    drawn: null,
    hasDrawn: Array.from({ length: players }, () => false),
    drops: Array.from({ length: players }, () => null),
    turnsTaken: Array.from({ length: players }, () => 0),
    turnCount: 0,
    maxTurns: opts.maxTurns ?? DEFAULT_MAX_TURNS,
    peakDeadwood: sorted.map((h) => rawDeadwoodOf(h, wildRank)),
    reshuffles: 0,
    rngState: rng.getState(),
    finishCard: null,
    outcome: null,
  };
}

// --------------------------------------------------------------- queries

export function activeSeats(state: IndianRummyState): PlayerId[] {
  const out: PlayerId[] = [];
  for (let i = 0; i < state.players; i++) if (!state.drops[i]) out.push(i);
  return out;
}

/** The next seat clockwise from `p` that has not dropped. */
export function nextActive(state: IndianRummyState, p: PlayerId): PlayerId {
  for (let i = 1; i <= state.players; i++) {
    const s = (p + i) % state.players;
    if (!state.drops[s]) return s;
  }
  return p;
}

export function topDiscard(state: IndianRummyState): CardCode | null {
  return state.discard[state.discard.length - 1] ?? null;
}

export function dropPoints(kind: DropKind): number {
  return kind === 'first' ? FIRST_DROP_POINTS : MIDDLE_DROP_POINTS;
}

/** The drop `p` would make right now (first if they have not drawn yet this game). */
export function dropKindFor(state: IndianRummyState, p: PlayerId): DropKind {
  return state.hasDrawn[p] ? 'middle' : 'first';
}

/** Distinct cards (duplicates from the two decks are interchangeable). */
export function distinctCards(cards: readonly CardCode[]): CardCode[] {
  return [...new Set(cards)];
}

function without(cards: readonly CardCode[], card: CardCode): CardCode[] {
  const i = cards.indexOf(card);
  return i < 0 ? cards.slice() : [...cards.slice(0, i), ...cards.slice(i + 1)];
}

/** `p`'s 13 cards after throwing `card` from their 14. */
export function handAfterDiscard(state: IndianRummyState, p: PlayerId, card: CardCode): CardCode[] {
  return without(state.hands[p] ?? [], card);
}

/** Cards `p` could discard to make a valid declaration (distinct, hand order). */
export function declarableDiscards(state: IndianRummyState, p: PlayerId): CardCode[] {
  const hand = state.hands[p] ?? [];
  if (hand.length !== HAND_SIZE + 1 || !canDeclareAfterOneDiscard(hand, state.wildRank)) return [];
  return distinctCards(hand).filter((c) => isValidHand(without(hand, c), state.wildRank));
}

export function legalMovesFor(state: IndianRummyState, p: PlayerId): IndianRummyMove[] {
  if (state.outcome || p !== state.turn) return [];
  if (state.phase === 'draw') {
    const moves: IndianRummyMove[] = [];
    if (state.stock.length) moves.push({ type: 'draw', from: 'stock' });
    if (state.discard.length) moves.push({ type: 'draw', from: 'discard' });
    moves.push({ type: 'drop' });
    return moves;
  }
  const hand = state.hands[p] ?? [];
  const moves: IndianRummyMove[] = distinctCards(hand).map((card) => ({ type: 'discard', card }));
  for (const card of declarableDiscards(state, p)) moves.push({ type: 'declare', discard: card });
  return moves;
}

export function moveKeyOf(move: IndianRummyMove): string {
  switch (move.type) {
    case 'draw':
      return `draw:${move.from}`;
    case 'discard':
      return `discard:${move.card}`;
    case 'declare':
      return `declare:${move.discard}`;
    case 'drop':
      return 'drop';
  }
}

// -------------------------------------------------------------- checking

export function isMove(move: unknown): move is IndianRummyMove {
  if (!move || typeof move !== 'object') return false;
  const m = move as Record<string, unknown>;
  switch (m.type) {
    case 'draw':
      return m.from === 'stock' || m.from === 'discard' || m.from === 'wild';
    case 'discard':
      return typeof m.card === 'string';
    case 'declare':
      return typeof m.discard === 'string';
    case 'drop':
      return true;
    default:
      return false;
  }
}

const NOT_A_MOVE =
  "That isn't an Indian Rummy move. On your turn you draw one card (from the closed stock or the open pile), then discard one — or declare when every card is in a group.";

/** Shared check for a card the player wants to throw (discard or declare). */
function checkThrow(state: IndianRummyState, p: PlayerId, card: string): MoveCheck | null {
  if (!isCardCode(card)) {
    return { ok: false, reason: `"${card}" isn't a card. Pick one of the cards in your hand.` };
  }
  if (!(state.hands[p] ?? []).includes(card)) {
    const who = p === 0 ? "You don't" : `Player ${p} doesn't`;
    return { ok: false, reason: `${who} have ${cardPhrase(card, state.wildRank)} in hand.` };
  }
  return null;
}

export function checkMoveFor(state: IndianRummyState, p: PlayerId, move: unknown): MoveCheck {
  if (state.outcome) {
    return { ok: false, reason: 'The game is over — there are no more moves to make.' };
  }
  if (!isMove(move)) return { ok: false, reason: NOT_A_MOVE };
  if (!Number.isInteger(p) || p < 0 || p >= state.players) {
    return { ok: false, reason: `There is no seat ${p} at this table.` };
  }
  if (state.drops[p]) {
    return {
      ok: false,
      reason:
        p === 0
          ? "You've dropped out of this game, so you can't make any more moves — sit back and watch how it ends."
          : `Player ${p} has dropped out of this game.`,
    };
  }
  const turn = state.turn;
  if (turn !== p) {
    return {
      ok: false,
      reason:
        p === 0
          ? `It's ${possessive(turn)} turn, not yours. Wait until they have discarded.`
          : `It's ${possessive(turn)} turn, not ${possessive(p)}.`,
    };
  }
  if (state.phase === 'draw') {
    switch (move.type) {
      case 'discard':
        return {
          ok: false,
          reason:
            'Draw first! Every turn starts by taking one card — from the closed stock or the open pile. Then you discard one.',
        };
      case 'declare':
        return {
          ok: false,
          reason:
            'Draw a card first. You declare at the end of a turn: after drawing you hold 14 cards, so you discard one and show the other 13 in groups.',
        };
      case 'drop':
        return { ok: true };
      case 'draw':
        if (move.from === 'wild') {
          return {
            ok: false,
            reason:
              'The wild joker card stays face up under the stock so everyone can see which rank is wild — nobody can take it. Draw from the closed stock or the open pile instead.',
          };
        }
        if (move.from === 'discard' && !state.discard.length) {
          return {
            ok: false,
            reason: 'The open pile is empty right now — draw from the closed stock instead.',
          };
        }
        if (move.from === 'stock' && !state.stock.length) {
          return {
            ok: false,
            reason: 'The closed stock is empty — take the top card of the open pile instead.',
          };
        }
        return { ok: true };
    }
  }
  // Discard phase: the player holds 14 cards.
  switch (move.type) {
    case 'draw':
      return {
        ok: false,
        reason:
          "You've already drawn a card this turn — only one draw per turn. Now discard one card (or declare if your hand is complete).",
      };
    case 'drop':
      return {
        ok: false,
        reason:
          "You can only drop at the start of your turn, before you draw. You've drawn already, so finish this turn by discarding a card.",
      };
    case 'discard':
      return checkThrow(state, p, move.card) ?? { ok: true };
    case 'declare': {
      const bad = checkThrow(state, p, move.discard);
      if (bad) return bad;
      const hand = handAfterDiscard(state, p, move.discard);
      const problem = declareProblem(hand, state.wildRank);
      if (!problem) return { ok: true };
      const alternatives = declarableDiscards(state, p);
      const tip = alternatives[0]
        ? ` Tip: discard ${cardPhrase(alternatives[0], state.wildRank)} instead and you can declare!`
        : '';
      return {
        ok: false,
        reason: `You can't declare by throwing ${cardPhrase(move.discard, state.wildRank)} yet. ${problem}${tip}`,
      };
    }
  }
}

// ------------------------------------------------------------ transitions

function finish(
  state: IndianRummyState,
  kind: EndKind,
  declarer: PlayerId | null,
): IndianRummyOutcome {
  const n = state.players;
  const counted = Array.from({ length: n }, (_, i) => {
    const drop = state.drops[i];
    if (drop) return dropPoints(drop);
    // The declarer, or the last player left after everyone else dropped, pays nothing.
    if ((kind === 'declare' && i === declarer) || kind === 'drop') return 0;
    return deadwoodOf(state.hands[i] ?? [], state.wildRank);
  });
  let winners: PlayerId[];
  if (kind === 'declare' && declarer !== null) winners = [declarer];
  else if (kind === 'drop') winners = activeSeats(state);
  else {
    const active = activeSeats(state);
    const low = Math.min(...active.map((i) => counted[i] ?? DEADWOOD_CAP));
    winners = active.filter((i) => counted[i] === low);
  }
  const pot = counted.reduce((sum, x, i) => (winners.includes(i) ? sum : sum + x), 0);
  const share = pot / winners.length;
  // `0 - x` rather than `-x`: a loser on 0 points must net +0, never -0 ("-0" when formatted).
  const net = counted.map((x, i) => (winners.includes(i) ? share : 0 - x));
  return { kind, winners, points: counted, net, declarer };
}

/** Shuffle the open pile (except its top card) into a new closed stock. */
function reshuffle(state: IndianRummyState): void {
  const top = state.discard[state.discard.length - 1];
  if (top === undefined || state.discard.length < 2) return;
  const rng = rngFromState(state.rngState);
  state.stock = shuffle(state.discard.slice(0, -1), rng);
  state.discard = [top];
  state.rngState = rng.getState();
  state.reshuffles += 1;
}

function cloneState(s: IndianRummyState): IndianRummyState {
  return {
    ...s,
    hands: s.hands.map((h) => h.slice()),
    stock: s.stock.slice(),
    discard: s.discard.slice(),
    drawn: s.drawn ? { ...s.drawn } : null,
    hasDrawn: s.hasDrawn.slice(),
    drops: s.drops.slice(),
    turnsTaken: s.turnsTaken.slice(),
    peakDeadwood: s.peakDeadwood.slice(),
    outcome: s.outcome,
  };
}

/** Apply a move already known to be legal for the current player. */
export function transition(state: IndianRummyState, move: IndianRummyMove): IndianRummyState {
  const s = cloneState(state);
  const p = s.turn;
  const hand = s.hands[p] ?? [];
  switch (move.type) {
    case 'draw': {
      const from: DrawSource = move.from === 'discard' ? 'discard' : 'stock';
      const pile = from === 'stock' ? s.stock : s.discard;
      const card = pile.pop();
      if (card === undefined) throw new Error(`Indian Rummy: the ${from} pile is empty`);
      hand.push(card);
      s.hasDrawn[p] = true;
      s.phase = 'discard';
      s.drawn = { from, card };
      return s;
    }
    case 'discard': {
      s.hands[p] = without(hand, move.card);
      s.discard.push(move.card);
      s.turnsTaken[p] = (s.turnsTaken[p] ?? 0) + 1;
      s.turnCount += 1;
      s.drawn = null;
      s.peakDeadwood[p] = Math.max(
        s.peakDeadwood[p] ?? 0,
        rawDeadwoodOf(s.hands[p] ?? [], s.wildRank),
      );
      if (!s.stock.length) reshuffle(s);
      if (s.turnCount >= s.maxTurns) {
        s.outcome = finish(s, 'turn-cap', null);
        return s;
      }
      s.turn = nextActive(s, p);
      s.phase = 'draw';
      return s;
    }
    case 'declare': {
      s.hands[p] = without(hand, move.discard);
      s.finishCard = move.discard;
      s.turnsTaken[p] = (s.turnsTaken[p] ?? 0) + 1;
      s.turnCount += 1;
      s.outcome = finish(s, 'declare', p);
      return s;
    }
    case 'drop': {
      s.drops[p] = dropKindFor(s, p);
      s.drawn = null;
      if (activeSeats(s).length === 1) {
        s.outcome = finish(s, 'drop', null);
        return s;
      }
      s.turn = nextActive(s, p);
      s.phase = 'draw';
      return s;
    }
  }
}
