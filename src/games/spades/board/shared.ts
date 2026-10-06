/**
 * Small pure helpers shared by the Spades Board and its pieces: where each seat sits, the
 * directions cards fly in from, what the middle of the table shows, the team tallies, and
 * the words used to label zones for screen readers. Everything here is public information
 * (bids, tricks won, cards already played) or the learner's own cards.
 */
import { joinNames } from '@/components/play/personas';
import { cardName, type CardCode } from '@/games/core/cards';
import { type BotPersona } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/games/spades/i18n';
import { type SpadesPlay, type SpadesState } from '../engine';
import { NIL, teamSeats, type Team } from '../rules';

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

/** "Ace of Spades and Two of Hearts". */
export function cardList(codes: readonly CardCode[]): string {
  return joinNames(codes.map((c) => cardName(c)));
}

/** Persona name for a seat ("You" for the learner). */
export function seatName(personas: readonly BotPersona[], seat: PlayerId): string {
  return personas[seat]?.name ?? (seat === 0 ? t('play.seat.you') : `Player ${seat}`);
}

/** "Nil" / "1 trick" / "4 tricks" — for screen readers and the Bid button. */
export function bidWords(bid: number): string {
  if (bid === NIL) return t('spades.bid.nil');
  return tricksWords(bid);
}

export function tricksWords(n: number): string {
  return n === 1 ? t('spades.bid.tricksOne') : t('spades.bid.tricksMany', { n });
}

/** What the middle of the table shows: the trick being played, or the one just won. */
export interface TrickView {
  plays: readonly SpadesPlay[];
  /** 1-based trick number. */
  number: number;
  leader: PlayerId;
  /** The trick is finished (the last completed trick, shown until the next card). */
  complete: boolean;
  winner: PlayerId | null;
}

export function trickView(state: SpadesState): TrickView {
  const last = state.tricks[state.tricks.length - 1];
  if (state.trick.length > 0 || !last) {
    return {
      plays: state.trick,
      number: state.tricks.length + 1,
      leader: state.leader,
      complete: false,
      winner: null,
    };
  }
  return {
    plays: last.plays,
    number: state.tricks.length,
    leader: last.leader,
    complete: true,
    winner: last.winner,
  };
}

/** One partnership's progress so far: public bids and tricks won. */
export interface TeamTally {
  team: Team;
  seats: [PlayerId, PlayerId];
  /** Both partners have bid. */
  bidsIn: boolean;
  /** Sum of the non-Nil bids made so far. */
  contract: number;
  /** Tricks won by the non-Nil partners (these count toward the contract). */
  won: number;
  /** Every trick the team has won (a Nil bidder's included). */
  allWon: number;
  /** Tricks still needed to make the contract (0 once made). */
  need: number;
  /** Nil bidders on the team and whether their Nil still holds. */
  nils: { seat: PlayerId; safe: boolean }[];
}

export function teamTally(state: SpadesState, team: Team): TeamTally {
  const seats = teamSeats(team);
  let contract = 0;
  let won = 0;
  let allWon = 0;
  const nils: TeamTally['nils'] = [];
  for (const seat of seats) {
    const bid = state.bids[seat];
    const taken = state.tricksWon[seat] ?? 0;
    allWon += taken;
    if (bid === NIL) {
      nils.push({ seat, safe: taken === 0 });
    } else {
      won += taken;
      contract += bid ?? 0;
    }
  }
  return {
    team,
    seats,
    bidsIn: seats.every((s) => state.bids[s] !== null),
    contract,
    won,
    allWon,
    need: Math.max(0, contract - won),
    nils,
  };
}

/**
 * The 13 cards the learner was dealt. Only the learner's own, visible cards are used, so
 * it is safe to key the table by it: it changes with every new deal.
 */
export function dealtToLearner(state: SpadesState): CardCode[] {
  const played = [...state.tricks.flatMap((tr) => tr.plays), ...state.trick]
    .filter((p) => p.seat === 0)
    .map((p) => p.card);
  return [...(state.hands[0] ?? []), ...played].sort();
}

export function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}
