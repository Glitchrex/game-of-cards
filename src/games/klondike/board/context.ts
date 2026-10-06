'use client';
/**
 * What every pile on the Klondike felt needs from the table: the position, the learner's
 * selection, coach-mode lookups and the handlers that turn taps, drops and keys into
 * `onMove` calls. Provided once by the Board so the piles stay small.
 */
import { createContext, use, type RefObject } from 'react';
import { type CardSize } from '@/components/cards';
import { type KlondikeSource, type KlondikeState } from '../engine';
import { type PileId, type Selection, type SuggestionView } from './model';

export interface TableContextValue {
  state: KlondikeState;
  busy: boolean;
  over: boolean;
  coachMode: boolean;
  highlight: ReadonlySet<string>;
  suggestion: SuggestionView | null;
  /** The learner's picked-up card or run (already checked against the position). */
  selection: Selection | null;
  /** Card art size: compact corners on narrow screens. */
  cardSize: CardSize;
  /** Reveal the face-down column cards (the game is over). */
  revealAll: boolean;
  /** True once the opening deal has been laid out (later cards animate individually). */
  dealt: boolean;
  /** Mouse/pen drag & drop is on (touch screens use tap-to-select instead). */
  dragEnabled: boolean;
  /** Prefix for shared-layout ids, unique per table. */
  layoutPrefix: string;
  stockRef: RefObject<HTMLButtonElement | null>;
  /** Register a pile's focusable element (keyboard navigation). */
  registerPile: (id: PileId) => (el: HTMLElement | null) => void;
  onPileFocus: (id: PileId) => void;
  /** Enter / Space / a tap on the pile itself. */
  activate: (id: PileId) => void;
  /** A tap on a face-up column card (chooses how deep a run to pick up). */
  tapCard: (pile: number, index: number, timeStamp: number) => void;
  /** A tap on a face-down column card. */
  tapFaceDown: (pile: number) => void;
  /** A tap on the waste's or a foundation's top card (double-tap sends it home). */
  tapTop: (id: PileId, timeStamp: number) => void;
  /** A card (or run) was dragged from `source` and released over drop target `targetId`. */
  drop: (source: KlondikeSource, targetId: string) => void;
  dragStart: () => void;
}

export const TableContext = createContext<TableContextValue | null>(null);

export function useTable(): TableContextValue {
  const ctx = use(TableContext);
  if (!ctx) throw new Error('Klondike piles must be rendered inside the Klondike table.');
  return ctx;
}
