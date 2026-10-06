/**
 * Test-only helpers for building exact Crazy Eights positions. Not imported by the
 * engine or the UI.
 */
import { makeDeck, sortHand, suitOf, type CardCode, type Suit } from '@/games/core/cards';
import type { PlayerId } from '@/games/core/types';
import type { CrazyEightsEvent, CrazyEightsState } from './engine';

/** "AS KH 2C" → ['AS', 'KH', '2C'] */
export function cards(list: string): CardCode[] {
  return list.trim().split(/\s+/).filter(Boolean) as CardCode[];
}

export interface StateSpec {
  /** One hand per seat (the number of hands = the number of players). */
  hands: string[];
  /** Top card of the discard pile. */
  top: string;
  /** Cards directly under the top card, oldest first. */
  under?: string;
  /**
   * The stock, next card first. Omitted = every remaining card (in deck order).
   * When given, the remaining cards are placed at the bottom of the discard pile so that
   * all 52 cards are still accounted for.
   */
  stock?: string;
  /** The suit to follow (default: the top card's suit). Required when the top is an Eight. */
  activeSuit?: Suit;
  /** Seat that played the Eight on top (adds a matching play to the log). */
  namedBy?: PlayerId;
  turn?: PlayerId;
  reshuffle?: boolean;
  reshuffles?: number;
  draws?: number[];
  drawnThisTurn?: number;
  maxBehind?: number;
  log?: CrazyEightsEvent[];
  rngState?: number;
}

/** Build a play-phase state in which every one of the 52 cards is in exactly one place. */
export function makeState(spec: StateSpec): CrazyEightsState {
  const hands = spec.hands.map((h) => sortHand(cards(h), { aceHigh: false }));
  const top = spec.top as CardCode;
  const under = cards(spec.under ?? '');
  const explicitStock = spec.stock === undefined ? null : cards(spec.stock);
  const used = new Set<CardCode>();
  const claim = (c: CardCode) => {
    if (used.has(c)) throw new Error(`makeState: ${c} appears twice`);
    used.add(c);
  };
  hands.flat().forEach(claim);
  claim(top);
  under.forEach(claim);
  explicitStock?.forEach(claim);
  const rest = makeDeck().filter((c) => !used.has(c));
  const stock = explicitStock ?? rest;
  const discard = [...(explicitStock ? rest : []), ...under, top];
  const activeSuit = spec.activeSuit ?? suitOf(top);
  const log: CrazyEightsEvent[] = [...(spec.log ?? [])];
  if (spec.namedBy !== undefined) {
    log.push({ type: 'play', seat: spec.namedBy, card: top, suit: activeSuit });
  }
  const players = hands.length;
  return {
    players,
    hands,
    stock,
    discard,
    starter: discard[0] ?? top,
    buried: [],
    activeSuit,
    turn: spec.turn ?? 0,
    phase: 'play',
    winners: [],
    endReason: null,
    log,
    draws: spec.draws ?? hands.map(() => 0),
    drawnThisTurn: spec.drawnThisTurn ?? 0,
    maxBehind: spec.maxBehind ?? 0,
    reshuffle: spec.reshuffle ?? false,
    reshuffles: spec.reshuffles ?? 0,
    rngState: spec.rngState ?? 12345,
  };
}

/** Every card in the state, sorted (for conservation checks). */
export function allCards(s: CrazyEightsState): string {
  return [...s.hands.flat(), ...s.stock, ...s.discard].sort().join(',');
}

export const FULL_DECK = makeDeck().slice().sort().join(',');
