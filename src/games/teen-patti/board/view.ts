/**
 * Pure view helpers for the Teen Patti Board: what each seat may show, deal timing, the
 * last thing a seat did and the action bar's prices. Nothing here touches React.
 *
 * Hidden information: only `revealedSeats` decides which hands are drawn face up. The
 * learner's own cards are face up once they have seen them (or the hand is over); other
 * hands only at a show / pot-limit showdown. Packed hands are never turned over.
 */
import { cardName, type CardCode } from '@/games/core/cards';
import { type PlayerId } from '@/games/core/types';
import { joinNames } from '@/components/play/personas';
import { t, type TKey } from '@/games/teen-patti/i18n';
import {
  canRaise,
  hitsPotLimit,
  moveCost,
  rankHand,
  activeSeats,
  type TeenPattiMove,
  type TeenPattiMoveType,
  type TeenPattiState,
} from '../engine';

/** Seconds between two cards of the opening deal. */
export const DEAL_STAGGER = 0.11;

/** Seats whose cards are face up on the table right now (as the learner may see them). */
export function revealedSeats(
  state: TeenPattiState,
  human: PlayerId,
  over: boolean,
): ReadonlySet<PlayerId> {
  const out = new Set<PlayerId>();
  if (state.seen[human] || over) out.add(human);
  if (over && state.outcome) for (const s of state.outcome.showdown) out.add(s);
  return out;
}

/**
 * Seconds before card `index` of `seat` flies in: one card at a time, starting on the
 * dealer's left, three times round the table (exactly how setup deals them).
 */
export function dealDelay(state: TeenPattiState, seat: PlayerId, index: number): number {
  const order = (seat - state.dealer - 1 + state.players) % state.players;
  return (index * state.players + order) * DEAL_STAGGER;
}

/** "Seven of Spades, Seven of Hearts and Two of Clubs". */
export function cardList(cards: readonly CardCode[]): string {
  return joinNames(cards.map(cardName));
}

/** The name of a hand, e.g. "Pair of Sevens" (only call it for revealed hands). */
export function handName(cards: readonly CardCode[]): string {
  return rankHand(cards).name;
}

export interface LastAction {
  key: TKey;
  n: number;
}

/** The last thing `seat` did this hand ("Blind chaal 2", "Saw cards", "Packed"), or null. */
export function lastAction(state: TeenPattiState, seat: PlayerId): LastAction | null {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const a = state.history[i];
    if (!a || a.player !== seat) continue;
    switch (a.type) {
      case 'see':
        return { key: 'teenPatti.seat.last.see', n: 0 };
      case 'pack':
        return { key: 'teenPatti.seat.last.pack', n: 0 };
      case 'show':
        return { key: 'teenPatti.seat.last.show', n: a.amount };
      case 'chaal':
        return {
          key: a.blind ? 'teenPatti.seat.last.blindChaal' : 'teenPatti.seat.last.chaal',
          n: a.amount,
        };
      case 'raise':
        return {
          key: a.blind ? 'teenPatti.seat.last.blindRaise' : 'teenPatti.seat.last.raise',
          n: a.amount,
        };
    }
  }
  return null;
}

/** Index of the most recent bet (chaal / raise / show) in the history, or -1. */
export function lastBetIndex(state: TeenPattiState): number {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const a = state.history[i];
    if (a && a.amount > 0) return i;
  }
  return -1;
}

export type BetType = Exclude<TeenPattiMoveType, 'see'>;

export interface Price {
  /** Boots the learner would put in right now (after the pot-limit cap). */
  cost: number;
  /** This bet would bring the pot to the limit (ending the betting). */
  capped: boolean;
}

/** What each betting button costs the learner at this moment. */
export function prices(state: TeenPattiState, human: PlayerId): Record<BetType, Price> {
  const price = (type: BetType): Price => {
    const move = { type } as TeenPattiMove;
    return { cost: moveCost(state, human, move), capped: hitsPotLimit(state, human, move) };
  };
  return {
    chaal: price('chaal'),
    raise: price('raise'),
    show: price('show'),
    pack: { cost: 0, capped: false },
  };
}

/** Why a betting button cannot be used at all this hand state (for its small hint line). */
export function structuralHint(state: TeenPattiState, type: BetType): TKey | null {
  if (type === 'raise' && !canRaise(state)) return 'teenPatti.actions.raiseMax';
  if (type === 'show' && activeSeats(state).length !== 2) return 'teenPatti.actions.showOnlyTwo';
  return null;
}

/** "3 boots" / "1 boot". */
export function bootsText(n: number): string {
  return n === 1 ? t('teenPatti.pot.bootsOne') : t('teenPatti.pot.boots', { n });
}

/**
 * A key that changes with every new deal (so the opening deal animates again when the
 * practice hand restarts). Moves keep the same `hands` array, a fresh setup makes a new one;
 * the Board tracks that identity rather than the (hidden) cards themselves.
 */
export function sameDeal(a: TeenPattiState, b: TeenPattiState): boolean {
  return a.hands === b.hands;
}
