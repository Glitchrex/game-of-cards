/**
 * Test-only helpers for building exact Hearts positions. Not imported by the
 * engine or the UI.
 */
import { makeDeck, sortHand, suitOf, type CardCode, type Suit } from '@/games/core/cards';
import type { PlayerId } from '@/games/core/types';
import type { HeartsPlay, HeartsState, HeartsTrick } from './engine';
import {
  cardPoints,
  HAND_SIZE,
  pointsIn,
  rank,
  SEATS,
  TRICKS_PER_HAND,
  winningPlay,
} from './rules';

/** "AS KH 2C" → ['AS', 'KH', '2C'] */
export function cards(list: string): CardCode[] {
  return list.trim().split(/\s+/).filter(Boolean) as CardCode[];
}

function parseTrick(spec: string): { leader: PlayerId; cards: CardCode[] } {
  const [l, rest] = spec.split(':');
  return { leader: Number(l), cards: cards(rest ?? '') };
}

function toPlays(leader: PlayerId, list: readonly CardCode[]): HeartsPlay[] {
  return list.map((card, i) => ({ seat: (leader + i) % SEATS, card }));
}

export interface PlaySpec {
  /** Explicit hand per seat, or null to auto-fill with the remaining cards. */
  hands: (string | null)[];
  /** Completed tricks, oldest first, as "leader: c1 c2 c3 c4" (cards in play order). */
  history?: string[];
  /** The current, unfinished trick as "leader: c1 c2 …". */
  trick?: string;
  /** Leader of the first trick when there is no history (default: holder of 2♣). */
  leader?: PlayerId;
  /** Override the derived "hearts broken" flag. */
  heartsBroken?: boolean;
}

/**
 * Build a consistent play-phase state: every one of the 52 cards is in exactly
 * one hand, completed trick or the current trick, and every explicit hand has
 * the size a real game would have at that point.
 */
export function playState(spec: PlaySpec): HeartsState {
  const tricks: HeartsTrick[] = (spec.history ?? []).map((h) => {
    const t = parseTrick(h);
    const plays = toPlays(t.leader, t.cards);
    if (plays.length !== SEATS) throw new Error(`history trick "${h}" needs 4 cards`);
    return { leader: t.leader, plays, winner: winningPlay(plays).seat, points: pointsIn(t.cards) };
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
  const won: CardCode[][] = [[], [], [], []];
  const points = [0, 0, 0, 0];
  for (const t of tricks) {
    won[t.winner]?.push(...t.plays.map((p) => p.card));
    points[t.winner] = (points[t.winner] ?? 0) + t.points;
  }
  const lastWinner = tricks[tricks.length - 1]?.winner;
  const leader =
    current?.leader ?? lastWinner ?? spec.leader ?? hands.findIndex((h) => h.includes('2C'));
  const playedHeart = [...tricks.flatMap((t) => t.plays), ...trick].some(
    (p) => suitOf(p.card) === 'H',
  );
  return {
    phase: 'play',
    passDirection: 'hold',
    hands,
    passed: [null, null, null, null],
    received: [null, null, null, null],
    turn: (leader + trick.length) % SEATS,
    leader,
    trick,
    tricks,
    won,
    points,
    heartsBroken: spec.heartsBroken ?? playedHeart,
  };
}

export interface TrickOutcome {
  winner: PlayerId;
  /** Point cards that land in this trick (≤ 2, or ≤ 3 when the winner also leads). */
  pts?: string;
}

/**
 * Build a finished hand (phase 'over') from 13 trick outcomes. Every point card
 * must be assigned to exactly one trick; the helper fills the remaining 38
 * cards so that each trick's winner really holds the highest card of the led
 * suit and each trick is led by the previous winner (trick 1 leads the 2♣).
 */
export function finishedHand(outcomes: readonly TrickOutcome[]): HeartsState {
  if (outcomes.length !== TRICKS_PER_HAND) throw new Error('finishedHand needs 13 tricks');
  const assigned = outcomes.flatMap((o) => cards(o.pts ?? ''));
  const pointCards = makeDeck().filter((c) => cardPoints(c) > 0);
  if (assigned.length !== pointCards.length || !pointCards.every((c) => assigned.includes(c))) {
    throw new Error('finishedHand: assign every Heart and the Queen of Spades exactly once');
  }
  const fillers: Record<'C' | 'D' | 'S', CardCode[]> = { C: [], D: [], S: [] };
  for (const c of makeDeck()) {
    const s = suitOf(c);
    if (cardPoints(c) === 0 && s !== 'H') fillers[s as 'C' | 'D' | 'S'].push(c);
  }
  for (const pile of Object.values(fillers)) pile.sort((a, b) => rank(a) - rank(b));
  const fillerSuits = ['C', 'D', 'S'] as const;
  const biggest = (exclude?: Suit) =>
    fillerSuits
      .filter((s) => s !== exclude && fillers[s].length > 0)
      .sort((a, b) => fillers[b].length - fillers[a].length)[0];

  const tricks: HeartsTrick[] = [];
  const won: CardCode[][] = [[], [], [], []];
  const points = [0, 0, 0, 0];
  const firstWinner = outcomes[0]?.winner ?? 0;
  let leader = (firstWinner + SEATS - 1) % SEATS;
  outcomes.forEach((o, i) => {
    const pts = cards(o.pts ?? '');
    const need = o.winner === leader ? 1 : 2;
    const suit =
      i === 0
        ? 'C'
        : fillerSuits
            .filter((s) => fillers[s].length >= need)
            .sort((a, b) => fillers[b].length - fillers[a].length)[0];
    if (!suit) throw new Error(`finishedHand: ran out of filler cards at trick ${i + 1}`);
    const pile = fillers[suit];
    const winCard = pile.pop() as CardCode;
    const leadCard = o.winner === leader ? winCard : (pile.shift() as CardCode);
    const plays: HeartsPlay[] = [];
    for (let k = 0; k < SEATS; k++) {
      const seat = (leader + k) % SEATS;
      let card: CardCode | undefined;
      if (seat === leader) card = leadCard;
      else if (seat === o.winner) card = winCard;
      else card = pts.shift();
      if (!card) {
        const other = biggest(suit);
        card = other ? fillers[other].shift() : pile.shift();
      }
      if (!card) throw new Error(`finishedHand: no card for seat ${seat} at trick ${i + 1}`);
      plays.push({ seat, card });
    }
    if (pts.length > 0) throw new Error(`finishedHand: too many point cards in trick ${i + 1}`);
    const winner = winningPlay(plays).seat;
    if (winner !== o.winner) throw new Error(`finishedHand: trick ${i + 1} built wrongly`);
    const trickCards = plays.map((p) => p.card);
    const trickPoints = pointsIn(trickCards);
    tricks.push({ leader, plays, winner, points: trickPoints });
    won[winner]?.push(...trickCards);
    points[winner] = (points[winner] ?? 0) + trickPoints;
    leader = winner;
  });
  return {
    phase: 'over',
    passDirection: 'hold',
    hands: [[], [], [], []],
    passed: [null, null, null, null],
    received: [null, null, null, null],
    turn: leader,
    leader,
    trick: [],
    tricks,
    won,
    points,
    heartsBroken: true,
  };
}

/** Every Heart, high to low: "AH KH … 2H". */
export const ALL_HEARTS = 'AH KH QH JH TH 9H 8H 7H 6H 5H 4H 3H 2H';
