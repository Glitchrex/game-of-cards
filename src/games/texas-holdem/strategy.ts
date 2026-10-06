/**
 * Texas Hold'em bot and coach logic.
 *
 * Information rules: a seat only ever reads ITS OWN hole cards plus public
 * information (the board, stacks, bets, who folded and the public action log).
 * Everything goes through `seatView`, which copies exactly that information
 * out of the state; the Monte-Carlo equity estimate deals opponents' cards and
 * the rest of the board from the cards this seat cannot see — it never peeks at
 * the real deck or anyone else's hand.
 *
 * - easy: a friendly "calling station" — calls a lot, rarely raises, checks
 *   most of the time, but folds trash to big bets.
 * - normal: a pre-flop starting-hand chart (Chen formula) adjusted by position
 *   and price; after the flop a quick Monte-Carlo equity estimate (150
 *   samples) compared with the pot odds. The estimate reads opponents' public
 *   betting: a pre-flop raiser is dealt stronger starting hands, and a player
 *   who bet or raised after the flop usually holds a pair or better (or a draw
 *   before the river) — but bluffs some of the time. Value bets strong hands,
 *   semi-bluffs some draws and makes occasional small bluffs.
 * - coach: the normal logic with every random choice replaced by its textbook
 *   default (no bluffs, no jitter) and a deterministic equity sample.
 */
import { type CardCode, suitOf } from '@/games/core/cards';
import { type Rng, createRng } from '@/games/core/rng';
import type { Difficulty, PlayerId } from '@/games/core/types';
import {
  cardId,
  evaluateHand,
  madeByBoard,
  pokerRank,
  rankPlural,
  rankWord,
  scoreCategory,
  scoreIds,
} from './hand-eval';
import {
  type BetOptions,
  type HoldemLogEntry,
  type Street,
  type TexasHoldemMove,
  type TexasHoldemState,
  betOptions,
  legalMovesFor,
  liveSeats,
  moveKeyOf,
  potTotal,
} from './rules';

export interface StrategyChoice {
  move: TexasHoldemMove;
  /** Plain-language reason a beginner understands. */
  why: string;
  /** Estimated chance of winning at a showdown (post-flop), when computed. */
  equity: number | null;
}

/** What one seat is allowed to know. */
export interface SeatView {
  seat: PlayerId;
  hole: CardCode[];
  board: CardCode[];
  street: Street;
  players: number;
  button: PlayerId;
  bigBlindSeat: PlayerId;
  bigBlind: number;
  pot: number;
  stack: number;
  streetBet: number;
  currentBet: number;
  /** Opponents still in the hand (including all-in ones). */
  opponents: PlayerId[];
  /** Opponents with chips who act after this seat on this street (pre-flop: up to the big blind). */
  behind: number;
  options: BetOptions;
  legal: TexasHoldemMove[];
  /** Bets + raises made on this street so far (the big blind does not count). */
  raises: number;
  /** Players who limped (just called the big blind) pre-flop. */
  limpers: number;
  log: readonly HoldemLogEntry[];
}

export function seatView(state: TexasHoldemState, seat: PlayerId): SeatView {
  const live = liveSeats(state);
  const n = state.players;
  let raises = 0;
  let limpers = 0;
  for (const e of state.log) {
    if (e.kind !== 'action' || e.street !== state.street) continue;
    if (e.effect === 'bet' || e.effect === 'raise') raises++;
    if (state.street === 'preflop' && e.effect === 'call' && raises === 0) limpers++;
  }
  const end = state.street === 'preflop' ? state.bigBlindSeat : state.button;
  let behind = 0;
  if (seat !== end) {
    for (let i = 1; i < n; i++) {
      const s = (seat + i) % n;
      if (live.includes(s) && (state.stacks[s] ?? 0) > 0) behind++;
      if (s === end) break;
    }
  }
  return {
    seat,
    hole: (state.hands[seat] ?? []).slice(),
    board: state.board.slice(),
    street: state.street,
    players: n,
    button: state.button,
    bigBlindSeat: state.bigBlindSeat,
    bigBlind: state.bigBlind,
    pot: potTotal(state),
    stack: state.stacks[seat] ?? 0,
    streetBet: state.streetBets[seat] ?? 0,
    currentBet: state.currentBet,
    opponents: live.filter((s) => s !== seat),
    behind,
    options: betOptions(state, seat),
    legal: legalMovesFor(state, seat),
    raises,
    limpers,
    log: state.log,
  };
}

// --------------------------------------------------------------- words

const pct = (x: number) => `${Math.round(x * 100)}%`;
export const chips = (n: number) => `${n} chip${n === 1 ? '' : 's'}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "a pair of Queens", "Ace-King of the same suit", "Seven-Two in different suits". */
export function describeHole(hole: readonly CardCode[]): string {
  const [a, b] = hole;
  if (!a || !b) return 'no cards';
  const ra = pokerRank(a);
  const rb = pokerRank(b);
  if (ra === rb) return `a pair of ${rankPlural(ra)}`;
  const hi = Math.max(ra, rb);
  const lo = Math.min(ra, rb);
  const suited = suitOf(a) === suitOf(b);
  return `${rankWord(hi)}-${rankWord(lo)} ${suited ? 'of the same suit' : 'in different suits'}`;
}

/** "bet 14 chips", "raise to 30 chips", "go all-in for 35 chips", "call 4 chips", "check". */
function movePhrase(view: SeatView, move: TexasHoldemMove): string {
  switch (move.type) {
    case 'bet':
      return `bet ${chips(move.amount)}`;
    case 'raise':
      return `raise to ${chips(move.to)}`;
    case 'all-in':
      return `go all-in for ${chips(view.stack)}`;
    case 'call':
      return `call ${chips(view.options.toCall)}`;
    case 'check':
      return 'check';
    case 'fold':
      return 'fold';
  }
}

// ------------------------------------------------------- pre-flop chart

const rankOfId = (id: number) => (id % 13) + 2;
const suitOfId = (id: number) => (id / 13) | 0;

/** Chen formula score for two card ids. */
function chenIds(a: number, b: number): number {
  const hi = Math.max(rankOfId(a), rankOfId(b));
  const lo = Math.min(rankOfId(a), rankOfId(b));
  const value = (r: number) => (r === 14 ? 10 : r === 13 ? 8 : r === 12 ? 7 : r === 11 ? 6 : r / 2);
  let s = value(hi);
  if (hi === lo) {
    s = Math.max(5, s * 2);
  } else {
    if (suitOfId(a) === suitOfId(b)) s += 2;
    const gap = hi - lo - 1;
    s -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
    if (gap <= 1 && hi < 12) s += 1;
  }
  return Math.ceil(s);
}

let chenTable: Int8Array | null = null;
function chenOf(a: number, b: number): number {
  if (!chenTable) {
    chenTable = new Int8Array(52 * 52);
    for (let x = 0; x < 52; x++) for (let y = 0; y < 52; y++) chenTable[x * 52 + y] = chenIds(x, y);
  }
  return chenTable[a * 52 + b] ?? 0;
}

/**
 * Chen formula starting-hand score (about −1 … 20): high card value, doubled
 * for pairs, +2 suited, minus gaps, +1 for connected cards below a Queen.
 */
export function chenScore(hole: readonly CardCode[]): number {
  const [a, b] = hole;
  if (!a || !b) return 0;
  return chenIds(cardId(a), cardId(b));
}

/** Plain-words strength of a starting hand for the coach. */
export function startingHandWords(score: number): string {
  if (score >= 12) return 'one of the very best starting hands';
  if (score >= 10) return 'a strong starting hand';
  if (score >= 8) return 'a good starting hand';
  if (score >= 6) return 'a playable hand in the right spot';
  return 'a weak starting hand';
}

/** Minimum Chen score to open-raise, by how many players can still act behind. */
function openThreshold(behind: number, players: number): number {
  if (players === 2) return 4;
  if (behind >= 5) return 9;
  if (behind === 4) return 8;
  if (behind === 3) return 7;
  if (behind === 2) return 6;
  return 5;
}

// ------------------------------------------------------ opponent ranges

/** What an opponent's public betting suggests about their cards. */
export interface OpponentRange {
  /** Minimum Chen score of their hole cards (−10 = any two cards). */
  minChen: number;
  /** Board sizes (3/4/5) at which they bet or raised. */
  aggressiveAt: number[];
}

export const ANY_HAND: OpponentRange = { minChen: -10, aggressiveAt: [] };
/** How often a bet or raise is a bluff (ignored when reading ranges). */
const BLUFF_SHARE = 0.15;
const BOARD_SIZE: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

/** Read every live opponent's likely range from the public log (aligned with view.opponents). */
export function readRanges(view: SeatView): OpponentRange[] {
  const raises = view.opponents.map(() => 0);
  const calledRaise = view.opponents.map(() => false);
  const aggressive = view.opponents.map((): number[] => []);
  let preflopRaises = 0;
  for (const e of view.log) {
    if (e.kind !== 'action') continue;
    const i = view.opponents.indexOf(e.player);
    const raised = e.effect === 'bet' || e.effect === 'raise';
    if (e.street === 'preflop') {
      if (raised) {
        preflopRaises++;
        if (i >= 0) raises[i] = (raises[i] ?? 0) + 1;
      } else if (e.effect === 'call' && preflopRaises > 0 && i >= 0) calledRaise[i] = true;
    } else if (raised && i >= 0) {
      const at = aggressive[i];
      const size = BOARD_SIZE[e.street];
      if (at && !at.includes(size)) at.push(size);
    }
  }
  return view.opponents.map((_, i) => {
    const r = raises[i] ?? 0;
    const minChen = r >= 2 ? 10 : r === 1 ? 7 : calledRaise[i] ? 5 : ANY_HAND.minChen;
    return { minChen, aggressiveAt: aggressive[i] ?? [] };
  });
}

const scratch = new Int32Array(7);

/**
 * Did hole cards (a, b) with the first `size` board cards hold a pair or better
 * that uses a hole card — or, before the river, a flush or open-ended straight draw?
 */
function holdsSomething(
  a: number,
  b: number,
  board: readonly number[],
  size: number,
  boardCategory: number,
): boolean {
  scratch[0] = a;
  scratch[1] = b;
  for (let i = 0; i < size; i++) scratch[2 + i] = board[i] ?? 0;
  const n = 2 + size;
  if (scoreCategory(scoreIds(scratch, n)) > boardCategory) return true;
  if (size >= 5) return false;
  const sa = suitOfId(a);
  const sb = suitOfId(b);
  let ca = 0;
  let cb = 0;
  let mask = 0;
  for (let i = 0; i < n; i++) {
    const id = scratch[i] ?? 0;
    const s = suitOfId(id);
    if (s === sa) ca++;
    if (s === sb) cb++;
    mask |= 1 << rankOfId(id);
  }
  if (ca >= 4 || cb >= 4) return true;
  if (mask & (1 << 14)) mask |= 1 << 1;
  let holeMask = (1 << rankOfId(a)) | (1 << rankOfId(b));
  if (holeMask & (1 << 14)) holeMask |= 1 << 1;
  // Four in a row, open at both ends (lo − 1 and lo + 4 both exist), using a hole card.
  for (let lo = 2; lo <= 10; lo++) {
    const run = 0b1111 << lo;
    if ((mask & run) === run && holeMask & run) return true;
  }
  return false;
}

function fitsRange(
  range: OpponentRange,
  a: number,
  b: number,
  board: readonly number[],
  boardCategory: readonly number[],
): boolean {
  if (chenOf(a, b) < range.minChen) return false;
  for (const size of range.aggressiveAt) {
    if (!holdsSomething(a, b, board, size, boardCategory[size] ?? 0)) return false;
  }
  return true;
}

// -------------------------------------------------------- equity (MC)

/**
 * Chance to win at showdown, sampled only from the cards this seat cannot see
 * (`samples` deals; ties share). `opponents` is either a number of opponents
 * holding any two cards, or one OpponentRange per opponent: their sampled
 * hands are then drawn to match what their betting suggests (with a share of
 * bluffs).
 */
export function estimateEquity(
  hole: readonly CardCode[],
  board: readonly CardCode[],
  opponents: number | readonly OpponentRange[],
  samples: number,
  rng: Rng,
): number {
  const ranges =
    typeof opponents === 'number'
      ? Array.from({ length: Math.max(0, opponents) }, () => ANY_HAND)
      : opponents;
  const k = ranges.length;
  if (k === 0) return 1;
  const [c0, c1] = hole;
  if (!c0 || !c1) throw new Error('estimateEquity needs two hole cards');
  const h0 = cardId(c0);
  const h1 = cardId(c1);
  const boardIds = board.map(cardId);
  const known = new Set<number>([h0, h1, ...boardIds]);
  const pool: number[] = [];
  for (let id = 0; id < 52; id++) if (!known.has(id)) pool.push(id);
  const missing = 5 - board.length;
  if (missing + 2 * k > pool.length) throw new Error('Not enough cards to sample');
  const boardCategory: number[] = [];
  for (let size = 3; size <= boardIds.length; size++) {
    boardCategory[size] = scoreCategory(scoreIds(boardIds, size));
  }
  const ranged = ranges.map((r) => r.minChen > ANY_HAND.minChen || r.aggressiveAt.length > 0);
  const hero = new Int32Array(7);
  const opp = new Int32Array(7);
  const oppCards = new Int32Array(2 * k);
  let used = 0;
  const draw = () => {
    const j = used + rng.int(pool.length - used);
    const card = pool[j] ?? 0;
    pool[j] = pool[used] ?? 0;
    pool[used] = card;
    used++;
    return card;
  };
  let won = 0;
  for (let t = 0; t < samples; t++) {
    used = 0;
    hero[0] = h0;
    hero[1] = h1;
    for (let i = 0; i < boardIds.length; i++) hero[2 + i] = boardIds[i] ?? 0;
    for (let i = 0; i < missing; i++) hero[2 + boardIds.length + i] = draw();
    for (let o = 0; o < k; o++) {
      const range = ranges[o] ?? ANY_HAND;
      const picky = ranged[o] === true && rng.next() >= BLUFF_SHARE;
      let a = draw();
      let b = draw();
      for (let tries = 0; picky && tries < 40; tries++) {
        if (fitsRange(range, a, b, boardIds, boardCategory)) break;
        used -= 2;
        a = draw();
        b = draw();
      }
      oppCards[2 * o] = a;
      oppCards[2 * o + 1] = b;
    }
    const mine = scoreIds(hero, 7);
    for (let i = 2; i < 7; i++) opp[i] = hero[i] ?? 0;
    let best = -1;
    let ties = 0;
    for (let o = 0; o < k; o++) {
      opp[0] = oppCards[2 * o] ?? 0;
      opp[1] = oppCards[2 * o + 1] ?? 0;
      const sc = scoreIds(opp, 7);
      if (sc > best) {
        best = sc;
        ties = 0;
      } else if (sc === best) ties++;
    }
    if (mine > best) won += 1;
    else if (mine === best) won += 1 / (ties + 2);
  }
  return won / samples;
}

// --------------------------------------------------------------- draws

/** Flush / straight draws that use at least one hole card (none on the river). */
export interface Draws {
  flush: boolean;
  /** 2 = open-ended (or double inside) straight draw, 1 = inside straight draw, 0 = none. */
  straight: 0 | 1 | 2;
}

export function findDraws(hole: readonly CardCode[], board: readonly CardCode[]): Draws {
  const none: Draws = { flush: false, straight: 0 };
  if (board.length < 3 || board.length >= 5) return none;
  const all = [...hole, ...board];
  const current = evaluateHand(all);
  const holeSuits = new Set(hole.map(suitOf));
  let flush = false;
  if (current.categoryIndex < 5) {
    for (const s of holeSuits) if (all.filter((c) => suitOf(c) === s).length === 4) flush = true;
  }
  let straight: 0 | 1 | 2 = 0;
  if (current.categoryIndex < 4) {
    const ranks = new Set(all.map(pokerRank));
    if (ranks.has(14)) ranks.add(1);
    const holeRanks = new Set(hole.map(pokerRank));
    let outs = 0;
    for (let r = 2; r <= 14; r++) {
      if (ranks.has(r)) continue;
      const withR = new Set(ranks);
      withR.add(r);
      if (r === 14) withR.add(1);
      for (let hi = 14; hi >= 5; hi--) {
        let ok = true;
        let usesHole = false;
        for (let x = hi; x > hi - 5; x--) {
          if (!withR.has(x)) ok = false;
          if (holeRanks.has(x === 1 ? 14 : x)) usesHole = true;
        }
        if (ok && usesHole) {
          outs++;
          break;
        }
      }
    }
    straight = outs >= 2 ? 2 : outs === 1 ? 1 : 0;
  }
  return { flush, straight };
}

function drawWords(d: Draws): string {
  const parts: string[] = [];
  if (d.flush) parts.push('a flush draw (one more card of your suit makes a flush)');
  if (d.straight === 2) parts.push('an open-ended straight draw');
  if (d.straight === 1) parts.push('an inside straight draw');
  return parts.join(' and ');
}

/**
 * The made hand's name, noting when it comes entirely from the board ("Pair of
 * Twos (all on the board, so everyone shares it)", or "High Card, Ace" with
 * the Ace on the board) — a classic beginner trap.
 */
function madeWords(hole: readonly CardCode[], board: readonly CardCode[]): string {
  const made = evaluateHand([...hole, ...board]);
  if (board.length < 3) return made.name;
  return madeByBoard(hole, board)
    ? `${made.name} (all on the board, so everyone shares it)`
    : made.name;
}

/** Hand strength words for the coach: made hand + draws, from this seat's view. */
export function describeHoldings(hole: readonly CardCode[], board: readonly CardCode[]): string {
  if (board.length === 0) return describeHole(hole);
  const d = drawWords(findDraws(hole, board));
  return `${madeWords(hole, board)}${d ? `, plus ${d}` : ''}`;
}

// ------------------------------------------------------------- moves

function has(view: SeatView, key: string): TexasHoldemMove | undefined {
  return view.legal.find((m) => moveKeyOf(m) === key);
}

const FOLD: TexasHoldemMove = { type: 'fold' };

/** Check if free, otherwise call. */
function passive(view: SeatView): TexasHoldemMove {
  return has(view, 'check') ?? has(view, 'call') ?? FOLD;
}

/** Check if free, otherwise fold. */
function giveUp(view: SeatView): TexasHoldemMove {
  return has(view, 'check') ?? FOLD;
}

/**
 * The legal bet/raise closest to `target` (a bet amount, or a raise-to
 * total). Targets at or near the whole stack become all-in. Null when no bet
 * or raise is possible.
 */
function aggressive(view: SeatView, target: number): TexasHoldemMove | null {
  const sized = view.legal.filter((m) => m.type === 'bet' || m.type === 'raise');
  const allIn = has(view, 'all-in');
  if (allIn && target >= view.options.maxTo * 0.85) return allIn;
  let best: TexasHoldemMove | null = null;
  let bestDist = Infinity;
  for (const m of sized) {
    const size = m.type === 'bet' ? m.amount : m.type === 'raise' ? m.to : 0;
    const d = Math.abs(size - target);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best ?? allIn ?? null;
}

/** A bet of `fraction` of the pot, or a raise to that size on top of the call. */
function sizeFor(view: SeatView, fraction: number): number {
  if (view.currentBet === 0) return Math.round(view.pot * fraction);
  const owed = view.currentBet - view.streetBet;
  return Math.round(view.currentBet + (view.pot + owed) * fraction);
}

function choice(move: TexasHoldemMove, why: string, equity: number | null = null): StrategyChoice {
  return { move, why, equity };
}

// ------------------------------------------------------------ pre-flop

function preflopNormal(view: SeatView, rng: Rng | null): StrategyChoice {
  const o = view.options;
  const bb = view.bigBlind;
  let score = chenScore(view.hole);
  const words = `${capital(describeHole(view.hole))} is ${startingHandWords(score)}`;
  if (rng && rng.next() < 0.25) score += rng.next() < 0.5 ? 1 : -1;
  const stackBB = (view.stack + view.streetBet) / bb;

  if (view.raises === 0) {
    const threshold = openThreshold(view.behind, view.players);
    if (o.canCheck) {
      // Big blind, nobody raised.
      const raise =
        score >= Math.max(threshold, 10)
          ? aggressive(view, view.currentBet + bb * (2 + view.limpers))
          : null;
      if (raise) {
        return choice(
          raise,
          `${words}. Nobody raised, so ${movePhrase(view, raise)} now to build the pot while you are probably ahead.`,
        );
      }
      return choice(
        passive(view),
        `${words}. Nobody raised, so you can see the flop for free — just check.`,
      );
    }
    if (score >= threshold) {
      const shove = stackBB <= 12 ? has(view, 'all-in') : undefined;
      if (shove) {
        return choice(
          shove,
          `${words}, and your stack is short (about ${Math.round(stackBB)} big blinds). Going all-in now puts the pressure on everyone else.`,
        );
      }
      const open = aggressive(view, bb * (3 + view.limpers));
      if (open) {
        const seat =
          view.behind <= 2 ? ' Few players act after you, so you can play more hands here.' : '';
        return choice(
          open,
          `${words} for your seat.${seat} ${capital(movePhrase(view, open))}: raising builds the pot and can make weaker hands fold.`,
        );
      }
    }
    const isSmallBlind = view.streetBet > 0 && view.streetBet < bb;
    if (isSmallBlind && o.toCall <= Math.ceil(bb / 2) && score >= threshold - 3) {
      return choice(
        passive(view),
        `${words}, and you already put in the small blind — it only costs ${chips(o.toCall)} more to see the flop, a good price.`,
      );
    }
    if (view.limpers > 0 && view.behind <= 2 && score >= threshold - 1) {
      return choice(
        passive(view),
        `${words}. Other players just called, so you can join cheaply for ${chips(o.toCall)} and see the flop from a good seat.`,
      );
    }
    return choice(
      giveUp(view),
      `${words} for this seat. Folding costs you nothing more — wait for a better hand.`,
    );
  }

  // Facing a raise.
  const cost = o.toCall / Math.max(1, view.stack + view.streetBet);
  const potOdds = o.toCall / (view.pot + o.toCall);
  if (score >= 12) {
    const allIn = view.raises >= 2 || stackBB <= 25 ? has(view, 'all-in') : undefined;
    if (allIn && o.canRaise) {
      return choice(
        allIn,
        `${words}. With a hand this strong it is fine to put all your chips in now.`,
      );
    }
    const reraise = o.canRaise ? aggressive(view, view.currentBet * 3) : null;
    if (reraise) {
      return choice(
        reraise,
        `${words}. Re-raise (${movePhrase(view, reraise)}) to make the others pay to play against you.`,
      );
    }
    return choice(passive(view), `${words}. You can't raise here, so call and see the flop.`);
  }
  let need: number;
  if (potOdds <= 0.25 && cost <= 0.1) need = 5;
  else if (cost <= 0.08) need = 7;
  else if (cost <= 0.2) need = 8;
  else if (cost <= 0.4) need = 9;
  else need = 10;
  // Against a single opponent, hands are much more likely to be best: defend wider.
  if (view.opponents.length === 1) need -= 2;
  if (score >= need && o.toCall > 0) {
    return choice(
      passive(view),
      `${words}. Calling costs ${chips(o.toCall)} to win a pot of ${chips(view.pot)} — a fair price for this hand, so call and see the flop.`,
    );
  }
  return choice(
    giveUp(view),
    `${words}, and someone has raised, which usually means a good hand. Calling would cost ${chips(o.toCall)} — fold and save your chips.`,
  );
}

function preflopEasy(view: SeatView, rng: Rng): StrategyChoice {
  const o = view.options;
  const score = chenScore(view.hole);
  const why = `${capital(describeHole(view.hole))}.`;
  if (o.canCheck) {
    const raise =
      score >= 12 && rng.next() < 0.3
        ? aggressive(view, view.currentBet + view.bigBlind * 2)
        : null;
    return choice(raise ?? passive(view), why);
  }
  if (view.raises === 0) {
    const raise = score >= 12 && rng.next() < 0.25 ? aggressive(view, view.bigBlind * 3) : null;
    if (raise) return choice(raise, why);
    if (score >= 2 || o.toCall <= Math.ceil(view.bigBlind / 2) || rng.next() < 0.5) {
      return choice(passive(view), why);
    }
    return choice(giveUp(view), why);
  }
  const big = o.toCall > 0.25 * (view.stack + view.streetBet) || o.toCall >= 10 * view.bigBlind;
  const raise = score >= 12 && rng.next() < 0.1 ? aggressive(view, view.currentBet * 2) : null;
  if (raise) return choice(raise, why);
  if (big) return choice(score >= 8 ? passive(view) : giveUp(view), why);
  if (score >= 3 || rng.next() < 0.5) return choice(passive(view), why);
  return choice(giveUp(view), why);
}

// ------------------------------------------------------------ post-flop

function postflopNormal(view: SeatView, rng: Rng | null, eqRng: Rng): StrategyChoice {
  const o = view.options;
  const opps = view.opponents.length;
  const ranges = readRanges(view);
  const equity = estimateEquity(view.hole, view.board, ranges, 150, eqRng);
  const draws = findDraws(view.hole, view.board);
  const fair = 1 / (opps + 1);
  const valueAt = Math.min(0.68, 1.6 * fair + 0.05);
  const thinAt = Math.max(fair + 0.05, 0.3);
  const drawText = drawWords(draws);
  const handWords = `Your ${madeWords(view.hole, view.board)}${drawText ? ` plus ${drawText}` : ''}`;
  const payOff =
    view.street === 'river'
      ? 'a worse hand may still call and pay you'
      : 'worse hands will pay you to see more cards';
  const read = ranges.some((r) => r.minChen > ANY_HAND.minChen || r.aggressiveAt.length > 0);
  const against = read
    ? `against the hands ${opps === 1 ? "your opponent's" : "your opponents'"} betting suggests`
    : `against ${opps === 1 ? '1 opponent' : `${opps} opponents`}`;
  const winText = `wins about ${pct(equity)} of the time ${against}`;

  if (o.canCheck) {
    if (equity >= valueAt) {
      const bet = aggressive(view, sizeFor(view, 0.75));
      if (bet) {
        return choice(
          bet,
          `${handWords} ${winText}. That's strong, so ${movePhrase(view, bet)} — ${payOff}.`,
          equity,
        );
      }
    }
    if (equity >= thinAt && opps <= 2) {
      const bet = aggressive(view, sizeFor(view, 0.5));
      if (bet) {
        return choice(
          bet,
          `${handWords} ${winText} — probably the best hand. ${capital(movePhrase(view, bet))} to win chips from worse hands${view.street === 'river' ? '' : ' and make drawing hands pay'}.`,
          equity,
        );
      }
    }
    if (
      rng &&
      view.street !== 'river' &&
      (draws.flush || draws.straight === 2) &&
      rng.next() < 0.35
    ) {
      const bet = aggressive(view, sizeFor(view, 0.5));
      if (bet) {
        return choice(
          bet,
          `${handWords}. Betting now can win the pot straight away, and you can still hit your draw if called.`,
          equity,
        );
      }
    }
    if (rng && opps === 1 && rng.next() < 0.1) {
      const bet = aggressive(view, sizeFor(view, 0.4));
      if (bet) {
        return choice(
          bet,
          'A small bet can win the pot when your opponent has nothing either.',
          equity,
        );
      }
    }
    return choice(
      passive(view),
      `${handWords} ${winText}. That's not strong enough to bet, so check — it keeps the pot small${view.street === 'river' ? ' and gets you to the showdown for free' : ' and shows you the next card for free'}.`,
      equity,
    );
  }

  // Facing a bet.
  const need = o.toCall / (view.pot + o.toCall);
  const owed = view.currentBet - view.streetBet;
  const pressure = Math.min(1, owed / Math.max(1, view.pot - owed));
  const adjusted = equity * (1 - 0.1 * pressure);
  const priceText = `You must put in ${chips(o.toCall)} to win a pot of ${chips(view.pot)}, so you need to win at least ${pct(need)} of the time.`;
  if (adjusted >= valueAt + 0.05 && o.canRaise) {
    const raise = aggressive(view, sizeFor(view, 0.75));
    if (raise) {
      return choice(
        raise,
        `${handWords} ${winText}. That's very strong — ${movePhrase(view, raise)} to win a bigger pot.`,
        equity,
      );
    }
  }
  const margin = o.callIsAllIn ? 0.05 : 0.02;
  if (adjusted >= need + margin) {
    return choice(
      passive(view),
      `${priceText} ${handWords} ${winText}, so calling is worth it.`,
      equity,
    );
  }
  const implied =
    view.street !== 'river' &&
    (draws.flush || draws.straight === 2) &&
    o.toCall <= 0.08 * (view.stack + view.streetBet) &&
    adjusted >= need - 0.06;
  if (implied) {
    return choice(
      passive(view),
      `${priceText} ${handWords}: the call is cheap, and if you hit your draw you can win a lot more later.`,
      equity,
    );
  }
  return choice(
    giveUp(view),
    `${priceText} ${handWords} only ${winText}, so fold and save your chips for a better spot.`,
    equity,
  );
}

function postflopEasy(view: SeatView, rng: Rng): StrategyChoice {
  const o = view.options;
  const made = evaluateHand([...view.hole, ...view.board]);
  const boardOnly = evaluateHand(view.board);
  const improves = made.categoryIndex > boardOnly.categoryIndex;
  const draws = findDraws(view.hole, view.board);
  const strong = improves && made.categoryIndex >= 2;
  const decent = (improves && made.categoryIndex >= 1) || draws.flush || draws.straight === 2;
  const why = `Your ${made.name}.`;
  if (o.canCheck) {
    const bet =
      strong && rng.next() < 0.4
        ? aggressive(view, sizeFor(view, 0.5))
        : decent && rng.next() < 0.15
          ? aggressive(view, view.bigBlind)
          : null;
    return choice(bet ?? passive(view), why);
  }
  const owed = view.currentBet - view.streetBet;
  const big =
    owed >= 0.6 * Math.max(1, view.pot - owed) || o.toCall >= 0.35 * (view.stack + view.streetBet);
  const raise = strong && o.canRaise && rng.next() < 0.1 ? aggressive(view, o.minRaiseTo) : null;
  if (raise) return choice(raise, why);
  if (!decent && !strong) {
    if (big) return choice(giveUp(view), why);
    return choice(rng.next() < 0.6 ? passive(view) : giveUp(view), why);
  }
  if (!strong && big && o.toCall >= 0.5 * (view.stack + view.streetBet)) {
    return choice(rng.next() < 0.5 ? passive(view) : giveUp(view), why);
  }
  return choice(passive(view), why);
}

/** Deterministic rng for the coach, seeded only from what this seat can see. */
function coachRng(view: SeatView): Rng {
  return createRng(
    `coach|${view.seat}|${view.hole.join('')}|${view.board.join('')}|${view.log.length}`,
  );
}

/**
 * Pick a move for `seat`. Always legal. Pass `rng = null` for the coach
 * (deterministic, no bluffs).
 */
export function chooseMove(
  state: TexasHoldemState,
  seat: PlayerId,
  difficulty: Difficulty,
  rng: Rng | null,
): StrategyChoice {
  const view = seatView(state, seat);
  if (view.legal.length === 0) {
    throw new Error(`Texas Hold'em: seat ${seat} has no move to make right now`);
  }
  let picked: StrategyChoice;
  if (difficulty === 'easy' && rng) {
    picked = view.street === 'preflop' ? preflopEasy(view, rng) : postflopEasy(view, rng);
  } else {
    picked =
      view.street === 'preflop'
        ? preflopNormal(view, rng)
        : postflopNormal(view, rng, rng ?? coachRng(view));
  }
  // Safety net: never return anything that is not in the legal list.
  const key = moveKeyOf(picked.move);
  if (!view.legal.some((m) => moveKeyOf(m) === key)) return { ...picked, move: passive(view) };
  return picked;
}
