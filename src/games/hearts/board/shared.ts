/**
 * Small pure helpers shared by the Hearts Board and its pieces: where each seat sits, the
 * directions cards fly in from, and the words used to label zones for screen readers.
 */
import { joinNames } from '@/components/play/personas';
import { cardName, suitOf, type CardCode } from '@/games/core/cards';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/games/hearts/i18n';
import { type HeartsPassDirection, type HeartsPlay, type HeartsState } from '../engine';
import { QUEEN_OF_SPADES } from '../rules';

/** Where each seat sits around the table, seen from the learner (seat 0, bottom). */
export type SeatPosition = 'bottom' | 'left' | 'top' | 'right';
export const SEAT_POSITION: readonly SeatPosition[] = ['bottom', 'left', 'top', 'right'];

export function positionOf(seat: PlayerId): SeatPosition {
  return SEAT_POSITION[seat] ?? 'top';
}

/** Offsets (relative to a trick slot) that point towards each seat. */
export const TOWARDS: Record<SeatPosition, { x: string; y: string; rotate: number }> = {
  bottom: { x: '0%', y: '150%', rotate: 8 },
  left: { x: '-190%', y: '0%', rotate: -14 },
  top: { x: '0%', y: '-150%', rotate: -6 },
  right: { x: '190%', y: '0%', rotate: 14 },
};

/** "the Queen of Spades and the Ace of Hearts" → "Queen of Spades and Ace of Hearts". */
export function cardList(codes: readonly CardCode[]): string {
  return joinNames(codes.map((c) => cardName(c)));
}

export function pointsText(n: number): string {
  return n === 1 ? t('hearts.points.one') : t('hearts.points.many', { n });
}

/** Hearts and the Queen of Spades a seat has captured so far (public information). */
export interface Captured {
  hearts: number;
  queen: boolean;
  points: number;
}

export function capturedBy(state: HeartsState, seat: PlayerId): Captured {
  const won = state.won[seat] ?? [];
  return {
    hearts: won.filter((c) => suitOf(c) === 'H').length,
    queen: won.includes(QUEEN_OF_SPADES),
    points: state.points[seat] ?? 0,
  };
}

/** What the middle of the table shows: the trick being played, or the one just won. */
export interface TrickView {
  plays: readonly HeartsPlay[];
  /** 1-based trick number. */
  number: number;
  leader: PlayerId;
  /** The trick is finished (the last completed trick, shown until the next card). */
  complete: boolean;
  winner: PlayerId | null;
  points: number;
}

export function trickView(state: HeartsState): TrickView {
  const last = state.tricks[state.tricks.length - 1];
  if (state.trick.length > 0 || !last) {
    return {
      plays: state.trick,
      number: state.tricks.length + 1,
      leader: state.leader,
      complete: false,
      winner: null,
      points: 0,
    };
  }
  return {
    plays: last.plays,
    number: state.tricks.length,
    leader: last.leader,
    complete: true,
    winner: last.winner,
    points: last.points,
  };
}

/**
 * The 13 cards the learner was dealt (before passing). Only the learner's own, visible
 * cards are used, so it is safe to key the table by it: it changes with every new deal.
 */
export function dealtToLearner(state: HeartsState): CardCode[] {
  const received = state.received[0] ?? [];
  const now = (state.hands[0] ?? []).filter((c) => !received.includes(c));
  const played = [...state.tricks.flatMap((tr) => tr.plays), ...state.trick]
    .filter((p) => p.seat === 0 && !received.includes(p.card))
    .map((p) => p.card);
  return [...now, ...(state.passed[0] ?? []), ...played].sort();
}

export function directionText(direction: HeartsPassDirection): string {
  return direction === 'hold' ? '' : t(`hearts.direction.${direction}`);
}

export function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}
