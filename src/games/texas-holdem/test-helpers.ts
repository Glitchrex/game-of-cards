/**
 * Test helpers: build Hold'em hands with chosen hole cards and board by
 * stacking the deck (options.deck), then play scripted moves.
 */
import { type CardCode, makeDeck } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import type { PlayerId } from '@/games/core/types';
import engine, { type TexasHoldemMove, type TexasHoldemState } from './engine';

export const cards = (s: string) => (s.trim() ? (s.trim().split(/\s+/) as CardCode[]) : []);

export interface RigOptions {
  players: number;
  button: PlayerId;
  /** Hole cards per seat, e.g. ['AS AH', 'KD KC', …] (missing seats get filler cards). */
  hands?: string[];
  /** Up to five board cards in dealing order (flop, turn, river). */
  board?: string;
}

/**
 * A full 52-card deck order that deals `hands` and `board`: cards go one at a
 * time starting left of the button (two rounds), then burn + 3, burn + 1, burn + 1.
 */
export function rigDeck(o: RigOptions): CardCode[] {
  const wanted = new Set<CardCode>();
  const holes = Array.from({ length: o.players }, (_, i) => cards(o.hands?.[i] ?? ''));
  const board = cards(o.board ?? '');
  for (const c of [...holes.flat(), ...board]) {
    if (wanted.has(c)) throw new Error(`rigDeck: duplicate ${c}`);
    wanted.add(c);
  }
  const filler = makeDeck().filter((c) => !wanted.has(c));
  const nextFiller = () => {
    const c = filler.shift();
    if (!c) throw new Error('rigDeck: out of cards');
    return c;
  };
  const deck: CardCode[] = [];
  for (let round = 0; round < 2; round++) {
    for (let i = 1; i <= o.players; i++) {
      const seat = (o.button + i) % o.players;
      deck.push(holes[seat]?.[round] ?? nextFiller());
    }
  }
  const boardCard = (i: number) => board[i] ?? nextFiller();
  deck.push(nextFiller(), boardCard(0), boardCard(1), boardCard(2));
  deck.push(nextFiller(), boardCard(3));
  deck.push(nextFiller(), boardCard(4));
  // Fillers drawn for missing hole cards were taken first, so the rest are unused.
  deck.push(...filler);
  return deck;
}

export interface DealOptions extends RigOptions {
  stacks?: number[];
  smallBlind?: number;
  bigBlind?: number;
  affordableUnits?: number;
}

/** Set up a hand with a rigged deck. */
export function deal(o: DealOptions): TexasHoldemState {
  const options: Record<string, unknown> = { button: o.button, deck: rigDeck(o) };
  if (o.stacks) options.stacks = o.stacks;
  if (o.smallBlind !== undefined) options.smallBlind = o.smallBlind;
  if (o.bigBlind !== undefined) options.bigBlind = o.bigBlind;
  return engine.setup(
    { players: o.players, options, affordableUnits: o.affordableUnits },
    createRng('rigged'),
  );
}

/** Shorthand moves. */
export const F: TexasHoldemMove = { type: 'fold' };
export const X: TexasHoldemMove = { type: 'check' };
export const C: TexasHoldemMove = { type: 'call' };
export const A: TexasHoldemMove = { type: 'all-in' };
export const B = (amount: number): TexasHoldemMove => ({ type: 'bet', amount });
export const R = (to: number): TexasHoldemMove => ({ type: 'raise', to });

/** Apply moves in order (each by whoever is to act), asserting the expected seat when given. */
export function play(
  state: TexasHoldemState,
  ...moves: (TexasHoldemMove | [PlayerId, TexasHoldemMove])[]
): TexasHoldemState {
  let s = state;
  for (const step of moves) {
    const [seat, move] = Array.isArray(step) ? step : [null, step];
    const turn = engine.currentPlayer(s);
    if (seat !== null && turn !== seat) {
      throw new Error(`play: expected seat ${seat} to act, but it is seat ${String(turn)}`);
    }
    s = engine.applyMove(s, move);
  }
  return s;
}

/** Check / call everything down to the end of the hand. */
export function checkDown(state: TexasHoldemState): TexasHoldemState {
  let s = state;
  let guard = 0;
  while (!engine.isOver(s)) {
    const p = engine.currentPlayer(s);
    if (p === null) break;
    const legal = engine.legalMoves(s, p).map(engine.moveKey);
    s = engine.applyMove(s, legal.includes('check') ? X : C);
    if (++guard > 200) throw new Error('checkDown: runaway');
  }
  return s;
}

// ------------------------------------------------------------------------
// An independent, deliberately different hand scorer (brute force over every
// five-card combination, count-sorting) used to cross-check hand-eval.ts.
// ------------------------------------------------------------------------
const RV: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

function score5(hand: readonly CardCode[]): number[] {
  const vals = hand.map((c) => RV[c[0] ?? ''] ?? 0).sort((a, b) => b - a);
  const flush = new Set(hand.map((c) => c[1])).size === 1;
  const uniq = [...new Set(vals)];
  let straight = 0;
  if (uniq.length === 5 && (uniq[0] ?? 0) - (uniq[4] ?? 0) === 4) straight = uniq[0] ?? 0;
  if (uniq.join() === '14,5,4,3,2') straight = 5;
  const groups = uniq
    .map((r) => [vals.filter((x) => x === r).length, r] as const)
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const shape = groups.map((g) => g[0]).join('');
  const order = groups.map((g) => g[1]);
  if (straight && flush) return [8, straight];
  if (shape === '41') return [7, ...order];
  if (shape === '32') return [6, ...order];
  if (flush) return [5, ...vals];
  if (straight) return [4, straight];
  if (shape === '311') return [3, ...order];
  if (shape === '221') return [2, ...order];
  if (shape === '2111') return [1, ...order];
  return [0, ...vals];
}

function compareArrays(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Best five-of-seven (or of five/six) score as [category, tie-breaks…]. */
export function referenceScore(hand: readonly CardCode[]): number[] {
  if (hand.length === 5) return score5(hand);
  let best: number[] = [-1];
  const n = hand.length;
  const pick = (start: number, chosen: CardCode[]) => {
    if (chosen.length === 5) {
      const s = score5(chosen);
      if (compareArrays(s, best) > 0) best = s;
      return;
    }
    for (let i = start; i < n; i++) pick(i + 1, [...chosen, hand[i] as CardCode]);
  };
  pick(0, []);
  return best;
}

/** > 0 if hand `a` beats `b` according to the reference scorer. */
export function compareReference(a: readonly CardCode[], b: readonly CardCode[]): number {
  return compareArrays(referenceScore(a), referenceScore(b));
}
