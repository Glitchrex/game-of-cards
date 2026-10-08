/**
 * Shared helpers for the Blackjack tests: deal exact hands from a stacked (but complete)
 * shoe, play moves by name and let the dealer finish. Test-only — never imported by the app.
 */
import { makeDeck, removeCard, type CardCode } from '@/games/core/cards';
import type { GameConfig } from '@/games/core/types';
import {
  blackjackEngine as E,
  DEALER,
  setupWithShoe,
  type BlackjackMove,
  type BlackjackState,
} from './engine';

export type MoveType = BlackjackMove['type'];

export const ALL_MOVE_TYPES: readonly MoveType[] = [
  'hit',
  'stand',
  'double',
  'split',
  'reveal',
  'dealer-hit',
  'dealer-stand',
];

/** A complete shoe with `front` on top, in order, followed by the rest of the decks. */
export function stackedShoe(front: readonly CardCode[], decks = 6): CardCode[] {
  let rest = makeDeck({ copies: decks });
  for (const c of front) rest = removeCard(rest, c);
  return [...front, ...rest];
}

/**
 * Deal the learner `player`, the dealer `dealer` ([upcard, hole]) and put `next` on top of
 * the shoe (drawn in order by hits, doubles, splits and the dealer).
 */
export function deal(
  player: [CardCode, CardCode],
  dealer: [CardCode, CardCode],
  next: CardCode[] = [],
  config: Partial<GameConfig> = {},
): BlackjackState {
  const front = [player[0], dealer[0], player[1], dealer[1], ...next];
  const decks = (config.options?.decks as number | undefined) ?? 6;
  return setupWithShoe({ players: 2, ...config }, stackedShoe(front, decks));
}

export const mv = (type: MoveType): BlackjackMove => ({ type }) as BlackjackMove;

export function play(state: BlackjackState, ...types: MoveType[]): BlackjackState {
  return types.reduce((s, t) => E.applyMove(s, mv(t)), state);
}

/** Apply the dealer's forced moves until the round ends (the dealer always has exactly one). */
export function finishDealer(state: BlackjackState): BlackjackState {
  let s = state;
  for (let guard = 0; !E.isOver(s); guard++) {
    if (guard > 30) throw new Error('dealer did not finish');
    const moves = E.legalMoves(s, DEALER);
    if (moves.length !== 1) throw new Error(`dealer has ${moves.length} moves, expected 1`);
    s = E.applyMove(s, moves[0]!);
  }
  return s;
}

/** Every card in the state, wherever it is. */
export function allCards(s: BlackjackState): CardCode[] {
  return [...s.shoe, ...s.dealer, ...s.hands.flatMap((h) => h.cards)];
}

/**
 * Independent reference total (deliberately not using ./hand): Aces count 11, then drop to
 * 1 one at a time while the hand is over 21.
 */
export function refTotal(cards: readonly CardCode[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const r = c[0]!;
    if (r === 'A') {
      aces++;
      total += 11;
    } else if ('TJQK'.includes(r)) total += 10;
    else total += Number(r);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}
