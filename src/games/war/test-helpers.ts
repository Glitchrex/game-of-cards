/**
 * Helpers for building specific War positions in tests (not used by the engine).
 */
import { makeDeck, type CardCode } from '@/games/core/cards';
import {
  DEFAULT_MAX_BATTLES,
  HALF_DECK,
  warEngine,
  type Pair,
  type WarBattleRecord,
  type WarState,
} from './engine';

export const FLIP = { type: 'flip' } as const;

/** A playing position with exactly these piles (top = index 0). Cards need not total 52. */
export function stateWith(piles: Pair<CardCode[]>, extra: Partial<WarState> = {}): WarState {
  return {
    piles,
    battles: 0,
    maxBattles: DEFAULT_MAX_BATTLES,
    lastBattle: null,
    history: [],
    phase: 'play',
    winner: null,
    endReason: null,
    ...extra,
  };
}

/**
 * A full 52-card position: seat 0's pile starts with `top0`, seat 1's with `top1`, and the
 * rest of the deck (in standard order) fills seat 0 up to `size0` cards, then seat 1.
 */
export function deal52(
  top0: CardCode[],
  top1: CardCode[],
  size0: number = HALF_DECK,
  extra: Partial<WarState> = {},
): WarState {
  const used = new Set<CardCode>([...top0, ...top1]);
  if (used.size !== top0.length + top1.length) throw new Error('deal52: duplicate top cards');
  if (top0.length > size0 || top1.length > 52 - size0) throw new Error('deal52: tops too long');
  const filler = makeDeck().filter((c) => !used.has(c));
  const p0 = [...top0, ...filler.slice(0, size0 - top0.length)];
  const p1 = [...top1, ...filler.slice(size0 - top0.length)];
  return stateWith([p0, p1], extra);
}

/** History records with the given pile sizes after each battle (plain battles unless `wars`). */
export function records(
  countsAfter: Pair<number>[],
  wars: (i: number) => number = () => 0,
  winner: (i: number) => 0 | 1 | null = (i) => {
    const prev = i === 0 ? HALF_DECK : (countsAfter[i - 1]?.[0] ?? HALF_DECK);
    const now = countsAfter[i]?.[0] ?? HALF_DECK;
    return now >= prev ? 0 : 1;
  },
): WarBattleRecord[] {
  return countsAfter.map((counts, i) => ({
    winner: winner(i),
    wars: wars(i),
    cards: 2 + 8 * wars(i),
    counts: [counts[0], counts[1]],
  }));
}

/** `n` records that keep the piles at the given sizes. */
export function steadyHistory(n: number, counts: Pair<number>): WarBattleRecord[] {
  return records(Array.from({ length: n }, () => counts));
}

export function flip(state: WarState): WarState {
  return warEngine.applyMove(state, FLIP);
}

/** Play the game to the end with the learner's seat flipping every time. */
export function playOut(state: WarState): WarState[] {
  const states = [state];
  let s = state;
  while (!warEngine.isOver(s)) {
    s = flip(s);
    states.push(s);
  }
  return states;
}
