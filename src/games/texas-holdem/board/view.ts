/**
 * Pure helpers for the Hold'em table: what each seat shows, the bet-sizing options, deal
 * timings and the words for screen readers. Everything here reads only what the learner
 * may see — opponents' hole cards are only used once they are turned face up.
 */
import { joinNames } from '@/components/play/personas';
import { cardName, type CardCode } from '@/games/core/cards';
import { type PlayerId } from '@/games/core/types';
import { t, type TKey } from '@/lib/i18n';
import {
  betOptions,
  buildPots,
  describeHole,
  evaluateHand,
  isAllIn,
  potTotal,
  type BetOptions,
  type TexasHoldemMove,
  type TexasHoldemState,
} from '../engine';

/* ------------------------------------------------------------------ seats */

export interface PositionMarks {
  dealer: boolean;
  small: boolean;
  big: boolean;
}

export function positionMarks(state: TexasHoldemState, seat: PlayerId): PositionMarks {
  return {
    dealer: seat === state.button,
    small: seat === state.smallBlindSeat,
    big: seat === state.bigBlindSeat,
  };
}

/** Which seats' hole cards are face up: only those shown at a showdown, once the hand is over. */
export function revealedSeats(state: TexasHoldemState, over: boolean): ReadonlySet<PlayerId> {
  if (!over || !state.outcome || state.outcome.kind !== 'showdown') return new Set();
  return new Set(state.outcome.showdown);
}

export interface LastAction {
  key: TKey;
  n: number;
}

/** The seat's latest action on the current street ("Raised to 6"), or its blind before the flop. */
export function lastAction(state: TexasHoldemState, seat: PlayerId): LastAction | null {
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (!e) continue;
    if (e.kind === 'deal') return null;
    if (e.kind === 'blind' && e.player === seat) {
      return {
        key: e.blind === 'small' ? 'texasHoldem.last.small' : 'texasHoldem.last.big',
        n: e.amount,
      };
    }
    if (e.kind !== 'action' || e.player !== seat) continue;
    if (e.allIn && e.effect !== 'fold' && e.effect !== 'check') {
      return { key: 'texasHoldem.last.allIn', n: e.to };
    }
    switch (e.effect) {
      case 'fold':
        return { key: 'texasHoldem.last.fold', n: 0 };
      case 'check':
        return { key: 'texasHoldem.last.check', n: 0 };
      case 'call':
        return { key: 'texasHoldem.last.call', n: e.to };
      case 'bet':
        return { key: 'texasHoldem.last.bet', n: e.to };
      case 'raise':
        return { key: 'texasHoldem.last.raise', n: e.to };
    }
  }
  return null;
}

/* -------------------------------------------------------------- the pot */

export interface PotView {
  /** "Main pot", "Side pot", "Side pot 2". */
  label: string;
  amount: number;
  /** Winners once the hand is over (empty before). */
  winners: PlayerId[];
}

function potName(i: number, count: number): string {
  if (i === 0) return t('texasHoldem.pot.main');
  return count === 2 ? t('texasHoldem.pot.side') : t('texasHoldem.pot.sideN', { n: i });
}

/**
 * The pots worth showing separately: the final pots once the hand is over, or the main pot
 * and side pots while someone is all-in. A single pot returns an empty list (the total says it all).
 */
export function potViews(state: TexasHoldemState, over: boolean): PotView[] {
  const pots = over && state.outcome ? finalPots(state) : livePots(state);
  if (pots.length < 2) return [];
  return pots.map((p, i) => ({ label: potName(i, pots.length), ...p }));
}

function finalPots(state: TexasHoldemState): Omit<PotView, 'label'>[] {
  return (state.outcome?.pots ?? []).map((p) => ({ amount: p.amount, winners: p.winners }));
}

/**
 * Side pots only exist once a live seat is all-in. Chips nobody has matched yet (a bet still
 * to be called, the big blind before anyone calls) belong to the pot below them, not to a
 * "side pot" of their own — otherwise every unanswered bet would look like one.
 */
function livePots(state: TexasHoldemState): Omit<PotView, 'label'>[] {
  const anyAllIn = state.folded.some((f, seat) => !f && isAllIn(state, seat));
  if (!anyAllIn) return [];
  const out: Omit<PotView, 'label'>[] = [];
  for (const p of buildPots(state.committed, state.folded)) {
    const below = out[out.length - 1];
    if (p.eligible.length < 2 && below) below.amount += p.amount;
    else out.push({ amount: p.amount, winners: [] });
  }
  return out;
}

/** Chips in the middle: everything committed this hand (bets on this street included). */
export function potAmount(state: TexasHoldemState, over: boolean): number {
  if (over && state.outcome) return state.outcome.pots.reduce((a, p) => a + p.amount, 0);
  return potTotal(state);
}

/* ------------------------------------------------------------- hands */

export interface BestHand {
  /** "Pair of Kings" / "Ace-King of the same suit". */
  text: string;
  /** Made-hand category once there is a flop (null before it). */
  category: string | null;
}

export function bestHand(hole: readonly CardCode[], board: readonly CardCode[]): BestHand | null {
  if (hole.length < 2) return null;
  if (board.length < 3) {
    const words = describeHole(hole);
    return { text: words.charAt(0).toUpperCase() + words.slice(1), category: null };
  }
  const value = evaluateHand([...hole, ...board]);
  return { text: value.name, category: value.category };
}

/** The best five cards of every seat that won a pot at the showdown (all lit up together). */
export function winningCards(state: TexasHoldemState, over: boolean): ReadonlySet<CardCode> {
  const out = new Set<CardCode>();
  const o = state.outcome;
  if (!over || !o || o.kind !== 'showdown' || state.board.length < 5) return out;
  const main = o.pots.find((p) => p.eligible.length > 1) ?? o.pots[0];
  for (const w of main?.winners ?? []) {
    const hole = state.hands[w] ?? [];
    for (const c of evaluateHand([...hole, ...state.board]).cards) out.add(c);
  }
  return out;
}

/** "Ace of Spades and King of Spades". */
export function cardList(cards: readonly CardCode[]): string {
  return joinNames(cards.map(cardName));
}

/* ------------------------------------------------------------ bet sizing */

export type SizeId = 'min' | 'half' | 'threeQuarters' | 'pot' | 'max';

export interface SizeOption {
  id: SizeId;
  /** A bet amount, or a raise-to total. */
  amount: number;
}

export interface Sizing {
  /** Opening the betting on this street ('bet') or raising an existing bet ('raise'). */
  kind: 'bet' | 'raise';
  min: number;
  max: number;
  /** Quick sizes, clamped into [min, max] (Max is always the whole stack). */
  options: SizeOption[];
  /** Betting or raising is possible for the learner right now. */
  available: boolean;
  bet: BetOptions;
}

/**
 * The slider range and quick sizes for seat `p`, worked out exactly like the engine's
 * representative sizes (minimum, ½ pot, ¾ pot, pot — a pot-sized raise is call + the pot
 * after the call), so a quick size carries the same moveKey as the engine's legal move.
 */
export function sizing(state: TexasHoldemState, p: PlayerId): Sizing {
  const o = betOptions(state, p);
  const kind = state.currentBet === 0 ? 'bet' : 'raise';
  const max = Math.max(0, o.maxTo);
  const floor = kind === 'bet' ? o.minBet : o.minRaiseTo;
  const min = Math.min(floor, max);
  const pot = potTotal(state);
  let raw: number[];
  if (kind === 'bet') {
    raw = [o.minBet, pot / 2, (pot * 3) / 4, pot];
  } else {
    const owed = state.currentBet - (state.streetBets[p] ?? 0);
    const after = pot + owed;
    raw = [
      o.minRaiseTo,
      state.currentBet + after / 2,
      state.currentBet + (after * 3) / 4,
      state.currentBet + after,
    ];
  }
  const ids: SizeId[] = ['min', 'half', 'threeQuarters', 'pot'];
  const options: SizeOption[] = ids.map((id, i) => ({
    id,
    amount: Math.min(max, Math.max(floor, Math.round(raw[i] ?? floor))),
  }));
  options.push({ id: 'max', amount: max });
  return {
    kind,
    min,
    max,
    options,
    available: kind === 'bet' ? o.canBet : o.canRaise,
    bet: o,
  };
}

/** The move the confirm button makes for `amount` chips. */
export function sizedMove(kind: 'bet' | 'raise', amount: number): TexasHoldemMove {
  return kind === 'bet' ? { type: 'bet', amount } : { type: 'raise', to: amount };
}

/** The amount in a sized moveKey ("bet:9" → 9, "raise:12" → 12), or null. */
export function sizedKeyAmount(key: string | null, kind: 'bet' | 'raise'): number | null {
  if (!key) return null;
  const m = /^(bet|raise):(\d+)$/.exec(key);
  if (!m || m[1] !== kind) return null;
  return Number(m[2]);
}

/* ------------------------------------------------------------- timings */

/** Seconds between hole cards in the opening deal (one at a time, from the button's left). */
export const DEAL_STAGGER = 0.07;
/** Seconds between the three cards of the flop. */
export const BOARD_STAGGER = 0.14;
/** Extra seconds between streets dealt in one go (an all-in run-out). */
export const RUNOUT_STREET_GAP = 0.45;

/** When hole card `round` (0 or 1) of `seat` leaves the deck in the opening deal. */
export function holeDealDelay(state: TexasHoldemState, seat: PlayerId, round: number): number {
  const n = state.players;
  const order = (seat - state.button - 1 + n * 2) % n;
  return (round * n + order) * DEAL_STAGGER;
}

/**
 * When board card `index` starts flying, relative to the move that dealt it. Streets dealt
 * by the same move (a run-out after an all-in) follow each other with a short pause.
 */
export function boardDealDelay(state: TexasHoldemState, index: number): number {
  let lastAction = -1;
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (e && (e.kind === 'action' || e.kind === 'blind')) {
      lastAction = i;
      break;
    }
  }
  let dealtBefore = 0;
  let street = 0;
  for (let i = 0; i < state.log.length; i++) {
    const e = state.log[i];
    if (!e || e.kind !== 'deal') continue;
    const end = dealtBefore + e.cards.length;
    if (index < end) {
      const within = index - dealtBefore;
      const inBatch = i > lastAction;
      return (inBatch ? street * RUNOUT_STREET_GAP : 0) + within * BOARD_STAGGER;
    }
    dealtBefore = end;
    if (i > lastAction) street += 1;
  }
  return 0;
}

/** A key that changes with every new deal, from what the learner can see. */
export function roundKey(state: TexasHoldemState): string {
  return [
    state.players,
    state.button,
    (state.hands[0] ?? []).join(''),
    state.startingStacks.join('.'),
  ].join('-');
}
