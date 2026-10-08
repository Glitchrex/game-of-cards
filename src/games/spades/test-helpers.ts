/**
 * Test-only helpers for building exact Spades positions. Not imported by the
 * engine or the UI.
 */
import { makeDeck, rankNumberAceHigh, sortHand, type CardCode } from '@/games/core/cards';
import type { PlayerId } from '@/games/core/types';
import type { SpadesPlay, SpadesState, SpadesTrick } from './engine';
import { HAND_SIZE, isSpade, SEATS, TRICKS_PER_HAND, winningPlay } from './rules';

/** "AS KH 2C" → ['AS', 'KH', '2C'] */
export function cards(list: string): CardCode[] {
  return list.trim().split(/\s+/).filter(Boolean) as CardCode[];
}

function parseTrick(spec: string): { leader: PlayerId; cards: CardCode[] } {
  const [l, rest] = spec.split(':');
  return { leader: Number(l), cards: cards(rest ?? '') };
}

function toPlays(leader: PlayerId, list: readonly CardCode[]): SpadesPlay[] {
  return list.map((card, i) => ({ seat: (leader + i) % SEATS, card }));
}

export interface PlaySpec {
  /** Explicit hand per seat, or null to auto-fill with the remaining cards. */
  hands: (string | null)[];
  /** Final bids (default 3 each). */
  bids?: number[];
  /** Dealer (default 3, so seat 0 bids and leads first). */
  dealer?: PlayerId;
  /** Completed tricks, oldest first, as "leader: c1 c2 c3 c4" (cards in play order). */
  history?: string[];
  /** The current, unfinished trick as "leader: c1 c2 …". */
  trick?: string;
  /** Override the derived "Spades broken" flag (derived: a Spade was played on another suit). */
  spadesBroken?: boolean;
}

/**
 * Build a consistent play-phase state: every one of the 52 cards is in exactly
 * one hand, completed trick or the current trick, and every explicit hand has
 * the size a real game would have at that point.
 */
export function playState(spec: PlaySpec): SpadesState {
  const dealer = spec.dealer ?? 3;
  const tricks: SpadesTrick[] = (spec.history ?? []).map((h) => {
    const t = parseTrick(h);
    const plays = toPlays(t.leader, t.cards);
    if (plays.length !== SEATS) throw new Error(`history trick "${h}" needs 4 cards`);
    return { leader: t.leader, plays, winner: winningPlay(plays).seat };
  });
  const current = spec.trick ? parseTrick(spec.trick) : null;
  const trick = current ? toPlays(current.leader, current.cards) : [];
  const used = new Set<CardCode>();
  const claim = (c: CardCode) => {
    if (used.has(c)) throw new Error(`playState: ${c} appears twice`);
    used.add(c);
  };
  tricks.forEach((t) => t.plays.forEach((p) => claim(p.card)));
  trick.forEach((p) => claim(p.card));
  const explicit = spec.hands.map((h) => (h === null ? null : cards(h)));
  explicit.forEach((h) => h?.forEach(claim));
  const pool = makeDeck().filter((c) => !used.has(c));
  const sizeFor = (seat: PlayerId) =>
    HAND_SIZE - tricks.length - (trick.some((p) => p.seat === seat) ? 1 : 0);
  const hands = explicit.map((h, seat) => {
    const size = sizeFor(seat);
    if (h) {
      if (h.length !== size) {
        throw new Error(`playState: seat ${seat} should hold ${size} cards, got ${h.length}`);
      }
      return sortHand(h);
    }
    return sortHand(pool.splice(0, size));
  });
  if (pool.length > 0) throw new Error(`playState: ${pool.length} cards unaccounted for`);
  const tricksWon = [0, 0, 0, 0];
  for (const t of tricks) tricksWon[t.winner] = (tricksWon[t.winner] ?? 0) + 1;
  const lastWinner = tricks[tricks.length - 1]?.winner;
  const leader = current?.leader ?? lastWinner ?? (dealer + 1) % SEATS;
  // Broken = a Spade was played on a trick of another suit (a Spade lead does not count).
  const spadePlayed = [...tricks.map((t) => t.plays), trick].some(
    (plays) =>
      plays[0] !== undefined && !isSpade(plays[0].card) && plays.some((p) => isSpade(p.card)),
  );
  return {
    phase: 'play',
    dealer,
    hands,
    bids: spec.bids ?? [3, 3, 3, 3],
    turn: (leader + trick.length) % SEATS,
    leader,
    trick,
    tricks,
    tricksWon,
    spadesBroken: spec.spadesBroken ?? spadePlayed,
  };
}

/** A bidding-phase state with explicit hands (null = auto-fill) and bids so far. */
export function bidState(spec: {
  hands?: (string | null)[];
  dealer?: PlayerId;
  bids?: (number | null)[];
}): SpadesState {
  const dealer = spec.dealer ?? 3;
  const base = playState({ hands: spec.hands ?? [null, null, null, null], dealer });
  const bids = spec.bids ?? [null, null, null, null];
  const made = bids.filter((b) => b !== null).length;
  return {
    ...base,
    phase: 'bid',
    bids,
    turn: (dealer + 1 + made) % SEATS,
    leader: (dealer + 1) % SEATS,
  };
}

/**
 * Build a finished hand (phase 'over') in which trick i was won by `winners[i]`.
 * Tricks 1–12 are single-suit tricks (Hearts, Diamonds, Clubs, then Spades,
 * ranks 3–A); trick 13 holds the four Twos and is won with the 2♠ (or led with
 * it when the leader wins). Each trick is led by the previous trick's winner.
 */
export function finishedHand(spec: {
  bids: number[];
  winners: readonly PlayerId[];
  dealer?: PlayerId;
}): SpadesState {
  if (spec.winners.length !== TRICKS_PER_HAND) throw new Error('finishedHand needs 13 winners');
  const dealer = spec.dealer ?? 3;
  const byRank = (a: CardCode, b: CardCode) => rankNumberAceHigh(a) - rankNumberAceHigh(b);
  const groups: CardCode[][] = [];
  for (const suit of ['H', 'D', 'C', 'S'] as const) {
    const ranks = makeDeck()
      .filter((c) => c[1] === suit && c[0] !== '2')
      .sort(byRank);
    for (let k = 0; k < 3; k++) groups.push(ranks.slice(k * 4, k * 4 + 4));
  }
  const tricks: SpadesTrick[] = [];
  let leader = (dealer + 1) % SEATS;
  spec.winners.forEach((winner, i) => {
    let order: CardCode[];
    if (i < 12) {
      const group = groups[i] as CardCode[];
      const top = group[3] as CardCode;
      const rest = group.slice(0, 3);
      order = [];
      for (let k = 0; k < SEATS; k++) {
        const seat = (leader + k) % SEATS;
        order.push(seat === winner ? top : (rest.shift() as CardCode));
      }
    } else {
      const others: CardCode[] = ['2H', '2D', '2C'];
      order = [];
      for (let k = 0; k < SEATS; k++) {
        const seat = (leader + k) % SEATS;
        order.push(seat === winner ? '2S' : (others.shift() as CardCode));
      }
    }
    const plays = toPlays(leader, order);
    if (winningPlay(plays).seat !== winner) throw new Error(`finishedHand: trick ${i + 1} wrong`);
    tricks.push({ leader, plays, winner });
    leader = winner;
  });
  const tricksWon = [0, 0, 0, 0];
  for (const t of tricks) tricksWon[t.winner] = (tricksWon[t.winner] ?? 0) + 1;
  return {
    phase: 'over',
    dealer,
    hands: [[], [], [], []],
    bids: spec.bids.slice(),
    turn: leader,
    leader,
    trick: [],
    tricks,
    tricksWon,
    spadesBroken: true,
  };
}

/** Trick winners in seat order: seat i wins `counts[i]` tricks (seat 0's first, then seat 1's …). */
export function winnersFor(counts: readonly number[]): PlayerId[] {
  const out: PlayerId[] = [];
  counts.forEach((n, seat) => {
    for (let k = 0; k < n; k++) out.push(seat);
  });
  if (out.length !== TRICKS_PER_HAND) throw new Error('winnersFor: counts must add up to 13');
  return out;
}
