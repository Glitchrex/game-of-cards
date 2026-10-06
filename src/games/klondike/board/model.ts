/**
 * Pure helpers behind the Klondike Board: pile ids and keyboard order, the learner's
 * "picked up" selection, building moves from a source and a destination, coach-mode glow
 * lookups, cascade spacing and the screen-reader zone labels. No React here.
 */
import {
  SUITS,
  SUIT_NAMES,
  cardName,
  suitOf,
  type StandardCard,
  type Suit,
} from '@/games/core/cards';
import { joinNames } from '@/components/play/personas';
import {
  BREAK_EVEN_CARDS,
  CARDS_IN_DECK,
  TABLEAU_PILES,
  UNITS_PER_CARD,
  klondikeMoveKey,
  type KlondikeMove,
  type KlondikePile,
  type KlondikeSource,
  type KlondikeState,
  type KlondikeTarget,
} from '../engine';
import { kt } from './strings';

/* ------------------------------------------------------------------ pile ids */

export type FoundationId = `f-${Suit}`;
export type ColumnId = `col-${number}`;
export type PileId = 'stock' | 'waste' | FoundationId | ColumnId;

export const COLUMNS: readonly number[] = Array.from({ length: TABLEAU_PILES }, (_, i) => i);
export const columnId = (pile: number): ColumnId => `col-${pile}`;
export const foundationId = (suit: Suit): FoundationId => `f-${suit}`;

/** Keyboard (←/→) and Tab order: stock, waste, the four foundations, then columns 1–7. */
export const PILE_ORDER: readonly PileId[] = [
  'stock',
  'waste',
  ...SUITS.map(foundationId),
  ...COLUMNS.map(columnId),
];

export function parsePile(id: string): PileId | null {
  return (PILE_ORDER as readonly string[]).includes(id) ? (id as PileId) : null;
}

export function columnOf(id: PileId): number | null {
  return id.startsWith('col-') ? Number(id.slice(4)) : null;
}

export function suitOfPile(id: PileId): Suit | null {
  return id.startsWith('f-') ? (id.slice(2) as Suit) : null;
}

/** Grid column (0–6) each top-row pile sits above: stock, waste, gap, ♠ ♥ ♦ ♣. */
const TOP_ROW_COLUMN: Partial<Record<PileId, number>> = {
  stock: 0,
  waste: 1,
  'f-S': 3,
  'f-H': 4,
  'f-D': 5,
  'f-C': 6,
};

/** ↑ / ↓ between the top row and the columns, keeping the horizontal position. */
export function verticalNeighbour(id: PileId, dir: 'up' | 'down'): PileId | null {
  const col = columnOf(id);
  if (col === null) {
    if (dir === 'up') return null;
    const g = TOP_ROW_COLUMN[id];
    return g === undefined ? null : columnId(g);
  }
  if (dir === 'down') return null;
  if (col === 0) return 'stock';
  if (col <= 2) return 'waste';
  return foundationId(SUITS[col - 3] ?? 'S');
}

export function horizontalNeighbour(id: PileId, dir: -1 | 1): PileId | null {
  const i = PILE_ORDER.indexOf(id);
  return PILE_ORDER[i + dir] ?? null;
}

/* ------------------------------------------------------------------ selection */

/** The card (or run) the learner has picked up, valid only for the position it was made in. */
export interface Selection {
  source: KlondikeSource;
  /** `state.moveCount` when it was made: any applied move clears it. */
  at: number;
}

export function sameSource(a: KlondikeSource, b: KlondikeSource): boolean {
  if (a.kind === 'waste' || b.kind === 'waste') return a.kind === b.kind;
  if (a.kind === 'foundation' || b.kind === 'foundation') {
    return a.kind === 'foundation' && b.kind === 'foundation' && a.suit === b.suit;
  }
  return a.pile === b.pile && a.index === b.index;
}

/** The pile a source lives in. */
export function pileOfSource(source: KlondikeSource): PileId {
  if (source.kind === 'waste') return 'waste';
  if (source.kind === 'foundation') return foundationId(source.suit);
  return columnId(source.pile);
}

/** The face-up cards a source picks up (bottom → top); empty when there are none. */
export function sourceCards(state: KlondikeState, source: KlondikeSource): StandardCard[] {
  if (source.kind === 'waste') return state.waste.slice(-1);
  if (source.kind === 'foundation') return state.foundations[source.suit].slice(-1);
  const pile = state.tableau[source.pile];
  if (!pile || source.index < 0) return [];
  return pile.faceUp.slice(source.index);
}

/** The top card of a pile as a source (what Enter picks up and "Send home" sends). */
export function topSource(state: KlondikeState, id: PileId): KlondikeSource | null {
  if (id === 'stock') return null;
  if (id === 'waste') return state.waste.length > 0 ? { kind: 'waste' } : null;
  const suit = suitOfPile(id);
  if (suit) return state.foundations[suit].length > 0 ? { kind: 'foundation', suit } : null;
  const col = columnOf(id);
  const pile = col === null ? undefined : state.tableau[col];
  if (col === null || !pile || pile.faceUp.length === 0) return null;
  return { kind: 'tableau', pile: col, index: pile.faceUp.length - 1 };
}

/** Where a pile receives cards, if it can (stock and waste never do). */
export function targetOf(id: PileId): KlondikeTarget | null {
  if (suitOfPile(id)) return { kind: 'foundation' };
  const col = columnOf(id);
  return col === null ? null : { kind: 'tableau', pile: col };
}

export function cardMove(source: KlondikeSource, target: KlondikeTarget): KlondikeMove {
  return { type: 'move', from: source, to: target };
}

export function homeMove(source: KlondikeSource): KlondikeMove {
  return cardMove(source, { kind: 'foundation' });
}

/** The stock's action: draw while it has cards, otherwise turn the waste over. */
export function stockMove(state: KlondikeState): KlondikeMove {
  return state.stock.length === 0 && state.waste.length > 0
    ? { type: 'recycle' }
    : { type: 'draw' };
}

/* ------------------------------------------------------------- coach lookups */

/** The moveKey prefix of every move that starts from `source` (e.g. `move:t2.3>`). */
export function sourcePrefix(source: KlondikeSource): string {
  const src =
    source.kind === 'waste'
      ? 'w'
      : source.kind === 'foundation'
        ? `f${source.suit}`
        : `t${source.pile}.${source.index}`;
  return `move:${src}>`;
}

export function anyStartsWith(keys: ReadonlySet<string>, prefix: string): boolean {
  for (const k of keys) if (k.startsWith(prefix)) return true;
  return false;
}

/** The coach's suggested card move, split into the pile it starts from and where it goes. */
export interface SuggestionView {
  move: KlondikeMove;
  /** Pile to pulse as the source (or the stock for draw / recycle). */
  from: PileId | null;
  /** Index into the column's face-up cards where the suggested run starts. */
  index: number | null;
  /** Pile to pulse as the destination. */
  to: PileId | null;
}

export function suggestionView(
  state: KlondikeState,
  legal: readonly KlondikeMove[],
  suggestedKey: string | null,
): SuggestionView | null {
  if (suggestedKey === null) return null;
  const move = legal.find((m) => klondikeMoveKey(m) === suggestedKey);
  if (!move) return null;
  if (move.type === 'draw' || move.type === 'recycle') {
    return { move, from: 'stock', index: null, to: null };
  }
  if (move.type !== 'move') return { move, from: null, index: null, to: null };
  const from = pileOfSource(move.from);
  const index = move.from.kind === 'tableau' ? move.from.index : null;
  let to: PileId | null;
  if (move.to.kind === 'tableau') to = columnId(move.to.pile);
  else {
    const base = sourceCards(state, move.from)[0];
    to = base ? foundationId(suitOf(base)) : null;
  }
  return { move, from, index, to };
}

/* ------------------------------------------------------------------- layout */

/**
 * Vertical step between cascaded cards, as a fraction of the card WIDTH. Columns tighten
 * as they grow so the tallest column stays within about 4.6 card widths of extra height.
 */
export function cascadeSteps(pile: KlondikePile): { down: number; up: number } {
  const down = pile.faceDown.length;
  const upGaps = Math.max(pile.faceUp.length - 1, 0);
  let downStep = 0.16;
  let upStep = 0.4;
  const budget = 4.6;
  const need = down * downStep + upGaps * upStep;
  if (need > budget) {
    downStep = 0.11;
    upStep = upGaps > 0 ? Math.max(0.24, (budget - down * downStep) / upGaps) : upStep;
  }
  return { down: downStep, up: upStep };
}

/** Extra height (in card widths) a column needs beyond one card. */
export function cascadeHeight(pile: KlondikePile): number {
  const { down, up } = cascadeSteps(pile);
  return pile.faceDown.length * down + Math.max(pile.faceUp.length - 1, 0) * up;
}

/* ------------------------------------------------------------------- labels */

export const cardList = (cards: readonly StandardCard[]): string =>
  joinNames(cards.map((c) => cardName(c)));

/** "Seven of Clubs" or "Seven of Clubs down to Five of Clubs, 3 cards". */
export function runText(cards: readonly StandardCard[]): string {
  const first = cards[0];
  const last = cards[cards.length - 1];
  if (!first || !last) return '';
  if (cards.length === 1) return cardName(first);
  return kt('klondike.select.run', {
    first: cardName(first),
    last: cardName(last),
    count: `${cards.length} cards`,
  });
}

function hiddenText(count: number): string {
  return count === 1 ? kt('klondike.zone.hiddenOne') : kt('klondike.zone.hiddenMany', { count });
}

export function columnLabel(state: KlondikeState, pile: number, revealAll: boolean): string {
  const p = state.tableau[pile];
  const n = pile + 1;
  if (!p || (p.faceDown.length === 0 && p.faceUp.length === 0)) {
    return kt('klondike.zone.columnEmpty', { n });
  }
  if (revealAll) {
    return kt('klondike.zone.columnCards', { n, cards: cardList([...p.faceDown, ...p.faceUp]) });
  }
  const up = cardList(p.faceUp);
  const cards =
    p.faceDown.length > 0
      ? kt('klondike.zone.then', { hidden: hiddenText(p.faceDown.length), cards: up })
      : up;
  return kt('klondike.zone.columnCards', { n, cards });
}

export function foundationLabel(state: KlondikeState, suit: Suit): string {
  const cards = state.foundations[suit];
  const top = cards[cards.length - 1];
  const name = SUIT_NAMES[suit];
  if (!top) return kt('klondike.zone.foundationEmpty', { suit: name });
  return kt('klondike.zone.foundation', {
    suit: name,
    count: cards.length === 1 ? '1 card' : `${cards.length} cards`,
    card: cardName(top),
  });
}

export function wasteLabel(state: KlondikeState): string {
  const top = state.waste[state.waste.length - 1];
  if (!top) return kt('klondike.zone.wasteEmpty');
  const n = state.waste.length;
  return kt('klondike.zone.wasteTop', {
    card: cardName(top),
    count: n === 1 ? '1 card' : `${n} cards`,
  });
}

/* ------------------------------------------------------------------- scoring */

/** Stake multiple paid back for `home` cards (5/52 each): "1.35". */
export function stakeBack(home: number): string {
  return (Math.round(home * UNITS_PER_CARD * 100) / 100).toFixed(2);
}

export { BREAK_EVEN_CARDS, CARDS_IN_DECK };
