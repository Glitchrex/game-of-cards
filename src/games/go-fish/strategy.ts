/**
 * Go Fish bots and coach reasoning.
 *
 * Bots only ever see a `SeatView`: their own hand plus public information — hand sizes,
 * the size of the pond, the books on the table and the public part of the history (who
 * asked whom for which rank, how many cards were handed over, and any "fished wish" card
 * that was shown). They never look at other hands, the pond order, or the identity of
 * anyone else's face-down draws.
 *
 * From that history the view keeps, for every other seat and rank:
 *  - `known`: how many cards of the rank the seat is PROVEN to hold (they asked for it,
 *    caught some, or showed a fished wish). Cards only leave a hand publicly, so a proven
 *    holding stays proven until they hand the cards over or lay down the book;
 *  - `maybe`: how many of the seat's unidentified cards could be that rank — 0 right after
 *    they said "Go Fish" to it or handed it over, +1 for every face-down card they draw.
 * Together these bound the truth exactly (known ≤ actual ≤ known + maybe; the simulation
 * test checks this at every step) and give a simple chance estimate for every ask.
 *
 *  - easy:   asks for a random rank it holds from a random player who has cards.
 *  - normal: asks a PROVEN holder whenever it can (the rank it holds most of first);
 *            otherwise picks the ask with the best estimated chance, nudged towards ranks
 *            it holds more of. It never makes an ask the history shows must fail while any
 *            other ask could still work; when every ask must fail it asks for the rank most
 *            likely to be fished from the pond (the best chance to "fish its wish").
 */
import { RANK_NAMES, RANKS, type CardCode, type Rank } from '@/games/core/cards';
import type { Rng } from '@/games/core/rng';
import type { PlayerId } from '@/games/core/types';
import type { GoFishMove, GoFishState } from './engine';
import {
  BOOK_SIZE,
  booksLabel,
  cardsLabel,
  joinWords,
  rankCountWords,
  rankCounts,
  rankIndex,
  rankPlural,
  ranksHeld,
  rankWithArticle,
} from './rules';

/** Why a seat is proven to hold a rank. */
export type ProofSource = 'asked' | 'caught' | 'wish';
/** Why a seat is known to hold none of a rank. */
export type AbsenceSource = 'denied' | 'gave';

/** Everything one seat may legally know. Per-rank arrays are indexed like RANKS. */
export interface SeatView {
  seat: PlayerId;
  players: number;
  hand: CardCode[];
  /** Own cards per rank. */
  mine: number[];
  /** Cards held by every seat (public). */
  handCounts: number[];
  /** Cards left in the pond. */
  stockCount: number;
  bookCounts: number[];
  /** Per rank: the seat that laid the book down, or null while the rank is in play. */
  bookOwner: (PlayerId | null)[];
  /** [seat][rank] cards of that rank the seat is proven to hold (0 for the viewer's own seat). */
  known: number[][];
  /** [seat][rank] how many of the seat's unidentified cards could be that rank. */
  maybe: number[][];
  /** [seat] cards whose rank is not publicly known (0 for the viewer). */
  unknown: number[];
  /** Cards the viewer cannot identify: the pond plus everyone else's unknown cards. */
  pool: number;
  /** [rank] copies the viewer cannot place: 4 − own − proven holdings (0 once booked). */
  outstanding: number[];
  /** [seat][rank] how the holding in `known` was proven. */
  proof: (ProofSource | null)[][];
  /** [seat][rank] why the seat is known to hold none (cleared when they draw blind). */
  absence: (AbsenceSource | null)[][];
}

/** A move plus the plain-language reason for it (used by the coach). */
export interface Decision {
  move: GoFishMove;
  why: string;
}

/** Larger than any hand: "no information yet" for `maybe`. */
const UNLIMITED = 52;

const grid = <T>(rows: number, value: T): T[][] =>
  Array.from({ length: rows }, () => RANKS.map(() => value));

const cell = (g: readonly (readonly number[])[], s: PlayerId, r: number): number => g[s]?.[r] ?? 0;

function put<T>(g: T[][], s: PlayerId, r: number, value: T): void {
  const row = g[s];
  if (row) row[r] = value;
}

/** Build the own-hand + public view for `seat` by replaying the public history. */
export function seatView(state: GoFishState, seat: PlayerId): SeatView {
  const n = state.players;
  const known = grid(n, 0);
  const maybe = grid(n, UNLIMITED);
  const proof = grid<ProofSource | null>(n, null);
  const absence = grid<AbsenceSource | null>(n, null);
  /** A face-down card arrived in `s`'s hand: it could be any rank except `except`. */
  const blindDraw = (s: PlayerId, except: number | null) => {
    for (let r = 0; r < RANKS.length; r++) {
      if (r === except) continue;
      put(maybe, s, r, cell(maybe, s, r) + 1);
      put(absence, s, r, null);
    }
  };
  let lastAsk: number | null = null;
  for (const e of state.log) {
    switch (e.type) {
      case 'ask': {
        const r = rankIndex(e.rank);
        lastAsk = r;
        // Asking proves you hold at least one card of the rank.
        if (cell(known, e.seat, r) === 0) {
          put(known, e.seat, r, 1);
          put(proof, e.seat, r, 'asked');
        }
        put(absence, e.seat, r, null);
        if (e.got > 0) {
          put(known, e.seat, r, cell(known, e.seat, r) + e.got);
          put(proof, e.seat, r, 'caught');
        }
        // The target now holds none: they said "Go Fish" or handed every one over.
        put(known, e.target, r, 0);
        put(maybe, e.target, r, 0);
        put(proof, e.target, r, null);
        put(absence, e.target, r, e.got > 0 ? 'gave' : 'denied');
        break;
      }
      case 'fish':
        // Only a fished wish is shown; any other draw stays face down (we never read it).
        if (e.wish && lastAsk !== null) {
          put(known, e.seat, lastAsk, cell(known, e.seat, lastAsk) + 1);
          put(proof, e.seat, lastAsk, 'wish');
          put(absence, e.seat, lastAsk, null);
        } else {
          blindDraw(e.seat, lastAsk);
        }
        break;
      case 'refill':
        blindDraw(e.seat, null);
        break;
      case 'book':
      case 'out':
        break;
    }
  }
  const bookOwner: (PlayerId | null)[] = RANKS.map(() => null);
  state.books.forEach((books, s) => {
    for (const b of books) bookOwner[rankIndex(b.rank)] = s;
  });
  const hand = (state.hands[seat] ?? []).slice();
  const mine = rankCounts(hand);
  const handCounts = state.hands.map((h) => h.length);
  for (let s = 0; s < n; s++) {
    for (let r = 0; r < RANKS.length; r++) {
      if (s === seat || bookOwner[r] !== null) {
        put(known, s, r, 0);
        put(maybe, s, r, 0);
        put(proof, s, r, null);
        put(absence, s, r, null);
      }
    }
  }
  const unknown = handCounts.map((count, s) =>
    s === seat ? 0 : Math.max(0, count - (known[s] ?? []).reduce((a, b) => a + b, 0)),
  );
  const pool = state.stock.length + unknown.reduce((a, b) => a + b, 0);
  const outstanding = RANKS.map((_, r) => {
    if (bookOwner[r] !== null) return 0;
    let placed = mine[r] ?? 0;
    for (let s = 0; s < n; s++) placed += cell(known, s, r);
    return Math.max(0, BOOK_SIZE - placed);
  });
  return {
    seat,
    players: n,
    hand,
    mine,
    handCounts,
    stockCount: state.stock.length,
    bookCounts: state.books.map((b) => b.length),
    bookOwner,
    known,
    maybe,
    unknown,
    pool,
    outstanding,
    proof,
    absence,
  };
}

/**
 * Estimated chance that `target` holds at least one card of `rank`, from public facts:
 * 1 for a proven holding, 0 when the history rules it out, otherwise the chance that the
 * target's unidentified cards include one of the copies nobody can place.
 */
export function holdChance(view: SeatView, target: PlayerId, rank: Rank): number {
  const r = rankIndex(rank);
  if (view.bookOwner[r] !== null || target === view.seat) return 0;
  if (cell(view.known, target, r) > 0) return 1;
  const draws = Math.min(cell(view.maybe, target, r), view.unknown[target] ?? 0);
  const copies = view.outstanding[r] ?? 0;
  const pool = view.pool;
  if (draws <= 0 || copies <= 0 || pool <= 0) return 0;
  let miss = 1;
  for (let i = 0; i < draws; i++) miss *= Math.max(0, pool - copies - i) / (pool - i);
  return 1 - miss;
}

/**
 * Estimated chance that the top card of the pond is `rank`: the copies nobody can place,
 * spread over every face-down slot that could hold one — the pond plus other players'
 * unidentified cards that are not ruled out for this rank. When every player you can ask
 * is ruled out, all the missing copies are in the pond and this is exact.
 */
export function pondChance(view: SeatView, rank: Rank): number {
  const r = rankIndex(rank);
  const copies = view.outstanding[r] ?? 0;
  if (view.stockCount <= 0 || copies <= 0) return 0;
  let room = view.stockCount;
  for (let s = 0; s < view.players; s++) {
    if (s !== view.seat) room += Math.min(cell(view.maybe, s, r), view.unknown[s] ?? 0);
  }
  return Math.min(1, copies / room);
}

/** The seats `view.seat` may ask (others with cards), clockwise from its left. */
function targetsOf(view: SeatView): PlayerId[] {
  const out: PlayerId[] = [];
  for (let i = 1; i < view.players; i++) {
    const s = (view.seat + i) % view.players;
    if ((view.handCounts[s] ?? 0) > 0) out.push(s);
  }
  return out;
}

/** How much the normal bot favours ranks it holds more of (per card held). */
const HOLDING_BONUS = 0.15;
/** A proven holder always beats a guess (the bonus keeps "most held first" among them). */
const SURE_CATCH = 10;
/**
 * An ask the history shows must fail ranks below every ask that could work. Among such
 * asks (only when nothing else is possible) the pond chance decides, then cards held.
 */
const DOOMED = -10;
const DOOMED_HOLDING_NUDGE = 0.001;

function scoreOf(view: SeatView, rank: Rank, chance: number, held: number): number {
  if (chance >= 1) return SURE_CATCH + held;
  if (chance > 0) return chance + HOLDING_BONUS * held;
  return DOOMED + pondChance(view, rank) + DOOMED_HOLDING_NUDGE * held;
}

interface Candidate {
  move: GoFishMove;
  chance: number;
  score: number;
  order: number;
}

/** Every legal ask with its estimated chance and the normal bot's score. */
export function rateAsks(view: SeatView): Candidate[] {
  const out: Candidate[] = [];
  const ranks = ranksHeld(view.hand);
  targetsOf(view).forEach((target, ti) => {
    for (const rank of ranks) {
      const chance = holdChance(view, target, rank);
      const held = view.mine[rankIndex(rank)] ?? 0;
      out.push({
        move: { type: 'ask', target, rank },
        chance,
        score: scoreOf(view, rank, chance, held),
        order: ti * RANKS.length + rankIndex(rank),
      });
    }
  });
  return out;
}

function bestAsk(view: SeatView): Candidate {
  const asks = rateAsks(view);
  let best = asks[0];
  if (!best) throw new Error(`Go Fish: seat ${view.seat} has nobody to ask`);
  for (const c of asks.slice(1)) {
    const diff = c.score - best.score;
    if (diff > 1e-9) best = c;
    else if (Math.abs(diff) <= 1e-9) {
      // Ties: the player holding more cards, then the nearer seat / lower rank (`order`).
      const more = (view.handCounts[c.move.target] ?? 0) - (view.handCounts[best.move.target] ?? 0);
      if (more > 0 || (more === 0 && c.order < best.order)) best = c;
    }
  }
  return best;
}

// ------------------------------------------------------------------ words (viewer = "you")

/** "you" for the viewer, otherwise "Player N" (seat 0 seen by a bot is "the learner"). */
function nameOf(view: SeatView, seat: PlayerId): string {
  if (seat === view.seat) return 'you';
  return seat === 0 ? 'the learner' : `Player ${seat}`;
}

function NameOf(view: SeatView, seat: PlayerId): string {
  const n = nameOf(view, seat);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** "your" / "the learner's" / "Player N's". */
function possessiveOf(view: SeatView, seat: PlayerId): string {
  const n = nameOf(view, seat);
  return n === 'you' ? 'your' : `${n}'s`;
}

function proofWords(view: SeatView, target: PlayerId, rank: Rank): string {
  const T = NameOf(view, target);
  const p = rankPlural(rank);
  switch (view.proof[target]?.[rankIndex(rank)]) {
    case 'caught':
      return `${T} collected ${p} earlier and hasn't handed them over since, so they still have them.`;
    case 'wish':
      return `${T} fished ${rankWithArticle(rank)} out of the pond and showed it, so they still have it.`;
    default:
      return `${T} asked for ${p} earlier — you can only ask for a rank you hold — and hasn't handed any over since, so they must still have at least one.`;
  }
}

function absenceWords(view: SeatView, rank: Rank, except: PlayerId | null): string {
  const r = rankIndex(rank);
  const denied: string[] = [];
  const gave: string[] = [];
  for (let s = 0; s < view.players; s++) {
    if (s === view.seat || s === except) continue;
    const a = view.absence[s]?.[r];
    if (a === 'denied') denied.push(nameOf(view, s));
    if (a === 'gave') gave.push(nameOf(view, s));
  }
  const out: string[] = [];
  if (denied.length > 0) {
    out.push(
      `${joinWords(denied)} already said "Go Fish" to ${rankPlural(rank)} and ${denied.length === 1 ? "hasn't" : "haven't"} drawn since, so asking again would be wasted.`,
    );
  }
  if (gave.length > 0) {
    out.push(
      `${joinWords(gave)} already handed over all their ${rankPlural(rank)}, so there's no point asking them again.`,
    );
  }
  return out.join(' ');
}

/** Plain-language reason for an ask chosen by the normal logic. */
function explain(view: SeatView, c: Candidate): string {
  const { target, rank } = c.move;
  const r = rankIndex(rank);
  const held = view.mine[r] ?? 0;
  const T = NameOf(view, target);
  const parts: string[] = [];
  if (c.chance >= 1) {
    const proven = cell(view.known, target, r);
    // Without a proof the certainty comes from counting: if the target's hand is the only
    // place left for unknown cards, every missing copy is there.
    const sure =
      proven > 0
        ? proven
        : view.pool === (view.unknown[target] ?? 0)
          ? (view.outstanding[r] ?? 0)
          : 1;
    parts.push(
      proven > 0
        ? proofWords(view, target, rank)
        : view.pool === (view.unknown[target] ?? 0)
          ? `Count the cards: the pond is empty and nobody else can be hiding any, so every ${RANK_NAMES[rank]} you can't see must be in ${possessiveOf(view, target)} hand.`
          : `Count the cards: ${T} has so many unknown cards that at least one of the ${rankPlural(rank)} you're missing has to be among them.`,
    );
    parts.push(
      held + sure >= BOOK_SIZE
        ? `You hold ${rankCountWords(held, rank)}, so this catch completes your book of ${rankPlural(rank)} — and you go again!`
        : `It's a sure catch: you hold ${rankCountWords(held, rank)}, you'll get theirs, and you go again.`,
    );
    return parts.join(' ');
  }
  if (c.chance <= 0) return explainDoomed(view, rank);
  const maxHeld = Math.max(...view.mine);
  parts.push(
    held === maxHeld && held > 1
      ? `Nobody has proven they hold one of your ranks, so go for your biggest group: you hold ${rankCountWords(held, rank)}, so a catch brings you closest to a book.`
      : held === maxHeld
        ? `Nobody has proven they hold one of your ranks, and you hold just one card of each, so every ask is a guess — ${rankPlural(rank)} are the best guess right now.`
        : `${rankPlural(rank)} are your best bet right now: you hold ${rankCountWords(held, rank)}, and nobody has shown any of the other ${view.outstanding[r] ?? 0}, so they are still hiding somewhere.`,
  );
  // If the bigger group was skipped because every ask for it must fail, say why.
  for (const other of ranksHeld(view.hand)) {
    if (held >= maxHeld || (view.mine[rankIndex(other)] ?? 0) !== maxHeld) continue;
    if (targetsOf(view).some((s) => holdChance(view, s, other) > 0)) continue;
    const why = absenceWords(view, other, null);
    parts.push(
      `Asking for your ${rankPlural(other)} can't work right now — ${why || 'nobody you can ask can have one.'}`,
    );
  }
  const rivals = targetsOf(view).filter((s) => s !== target);
  const mine = view.unknown[target] ?? 0;
  if (rivals.length > 0 && rivals.every((s) => (view.unknown[s] ?? 0) < mine)) {
    parts.push(
      `${T} has the most cards you can't account for, so they are the likeliest to have one.`,
    );
  } else if (rivals.length > 0) {
    parts.push(`${T} is as good a bet as anyone to have one.`);
  } else {
    parts.push(`${T} is the only player you can ask.`);
  }
  const avoid = absenceWords(view, rank, target);
  if (avoid) parts.push(avoid);
  return parts.join(' ');
}

/**
 * Why to make an ask that must fail: it is only chosen when every ask must fail, and then
 * every missing copy of each of your ranks is in the pond (nobody you can ask has one, and
 * players without cards have none), so the choice is the rank most likely to be fished.
 */
function explainDoomed(view: SeatView, rank: Rank): string {
  const r = rankIndex(rank);
  const copies = view.outstanding[r] ?? 0;
  const p = rankPlural(rank);
  const intro =
    'Every ask is sure to hear "Go Fish!" right now: from the asking so far, nobody you can ask can have any of your ranks.';
  const hope =
    'But Go Fish still lets you draw, and drawing the rank you asked for means you go again.';
  if (copies <= 0) return `${intro} ${hope} Ask for ${p} — at least you get a card.`;
  const where =
    copies === 1
      ? `The last ${RANK_NAMES[rank]} you haven't seen must be in the pond`
      : `The ${rankCountWords(copies, rank)} you haven't seen must be in the pond`;
  return `${intro} ${hope} ${where}, so ask for ${p}: they are your best hope to fish your wish.`;
}

/** The normal bot's choice (also the coach's suggestion), with a beginner-friendly reason. */
export function normalDecision(view: SeatView): Decision {
  const best = bestAsk(view);
  return { move: best.move, why: explain(view, best) };
}

/** The easy bot: a random rank it holds, asked of a random player who still has cards. */
export function easyMove(view: SeatView, rng: Rng): GoFishMove {
  const ranks = ranksHeld(view.hand);
  const targets = targetsOf(view);
  if (ranks.length === 0 || targets.length === 0) {
    throw new Error(`Go Fish: seat ${view.seat} has nothing to ask`);
  }
  const rank = rng.pick(ranks);
  const target = rng.pick(targets);
  return { type: 'ask', target, rank };
}

/** "two Sevens, one King and one Four" — the hand grouped by rank. */
export function handWords(hand: readonly CardCode[]): string {
  const counts = rankCounts(hand);
  return joinWords(ranksHeld(hand).map((r) => rankCountWords(counts[rankIndex(r)] ?? 0, r)));
}

/** Plain-words description of the table for `view.seat`, addressed as "you". */
export function situationWords(view: SeatView, turn: PlayerId): string {
  const parts: string[] = [];
  if (turn !== view.seat) {
    parts.push(`It's ${possessiveOf(view, turn)} turn to ask.`);
  }
  parts.push(
    view.hand.length > 0
      ? `You hold ${cardsLabel(view.hand.length)}: ${handWords(view.hand)}.`
      : 'You have no cards left.',
  );
  const myBooks = view.bookCounts[view.seat] ?? 0;
  const others = view.handCounts
    .map((cards, s) => ({ cards, s }))
    .filter((o) => o.s !== view.seat)
    .map(
      (o) =>
        `${NameOf(view, o.s)} ${o.cards === 0 ? 'is out of cards' : `holds ${cardsLabel(o.cards)}`} with ${booksLabel(view.bookCounts[o.s] ?? 0)}`,
    );
  parts.push(`You have ${booksLabel(myBooks)}. ${joinWords(others)}.`);
  parts.push(
    view.stockCount > 0
      ? `The pond has ${cardsLabel(view.stockCount)} left.`
      : 'The pond is empty, so a "Go Fish" means no draw — the turn just passes.',
  );
  const facts: string[] = [];
  for (let s = 0; s < view.players; s++) {
    if (s === view.seat) continue;
    const ranks = RANKS.filter((_, r) => cell(view.known, s, r) > 0);
    if (ranks.length > 0)
      facts.push(`${nameOf(view, s)} holds ${joinWords(ranks.map(rankPlural))}`);
  }
  if (facts.length > 0) parts.push(`From the asking so far you know that ${joinWords(facts)}.`);
  if (turn === view.seat && view.hand.length > 0) {
    const targets = targetsOf(view).map((s) => nameOf(view, s));
    parts.push(
      `Ask ${joinWords(targets, 'or')} for any rank you hold. If they have it you catch all of them and go again; if not — Go Fish!`,
    );
  }
  return parts.join(' ');
}
