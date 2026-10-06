/**
 * Exact meld solver for 13-card Indian Rummy (docs/RULES_DECISIONS.md → Indian Rummy).
 *
 * Groups:
 *  - **pure sequence**: 3+ consecutive cards of one suit with no joker standing in for a
 *    card (a wild-rank card sitting in its own natural place keeps a sequence pure);
 *  - **sequence** (impure): 3+ consecutive cards of one suit where jokers fill gaps/ends;
 *  - **set**: 3–4 cards of one rank in different suits (jokers may stand in for suits).
 * Ace is low (A-2-3) or high (Q-K-A) but never both (no K-A-2 wrap). With two decks a hand
 * can hold duplicates; they are interchangeable but can never share one group.
 * Jokers = the two printed jokers plus every card of the wild rank.
 *
 * Algorithm. Wild-rank cards that could sit naturally in a pure sequence are tried both as
 * natural cards and as jokers; every other joker is an interchangeable "token". A memoised
 * depth-first search over the natural cards (take the lowest remaining card: leave it
 * ungrouped, or put it in one of the precomputed candidate groups whose lowest card it is)
 * returns, for each combination of (has a pure sequence?, sequences 0/1/2+), the minimum
 * points of ungrouped cards. Groups only ever use the fewest jokers they need: leftover
 * jokers score 0 and can always be added to an impure sequence (or to one of two pure ones),
 * so a hand is a valid declaration iff its (pure, 2+ sequences) cell is 0. Three spare
 * jokers that include a wild-rank card also form a sequence on their own (that card in its
 * natural place plus two jokers).
 *
 * Results are memoised in a bounded module-level cache keyed by the sorted hand — a pure
 * function cache, so engines stay deterministic.
 */
import {
  type CardCode,
  type Rank,
  SUITS,
  cardShort,
  isJoker,
  rankNumber,
  rankOf,
  suitOf,
} from '@/games/core/cards';

/** Most points a loser can ever pay. */
export const DEADWOOD_CAP = 80;

export type GroupKind = 'pure-sequence' | 'sequence' | 'set' | 'unmatched';

export interface MeldGroup {
  kind: GroupKind;
  /** Cards in display order (sequences run low → high with jokers in the gaps they fill). */
  cards: CardCode[];
}

export interface Arrangement {
  /** Pure sequences first, then sequences, sets and (last) the unmatched cards. */
  groups: MeldGroup[];
  /** All cards grouped with at least two sequences, one of them pure. */
  valid: boolean;
  /**
   * Points this hand would pay if someone else declared now: the fewest points of ungrouped
   * cards, but every card counts when no pure sequence can be made. Capped at 80.
   */
  deadwoodPoints: number;
  /** Fewest points of ungrouped cards ignoring the pure-sequence rule (uncapped). */
  rawDeadwood: number;
  /** Points of every card in the hand (jokers 0), uncapped. */
  totalPoints: number;
  /** A pure sequence can be made from this hand. */
  hasPureSequence: boolean;
  /** A pure sequence plus at least one more sequence can be made at the same time. */
  hasTwoSequences: boolean;
}

// ------------------------------------------------------------------ cards

/** The rank whose cards are wild: the indicator's rank, or Aces if it is a printed joker. */
export function wildRankFor(indicator: CardCode): Rank {
  return isJoker(indicator) ? 'A' : rankOf(indicator);
}

/** Printed jokers and every card of the wild rank are jokers. */
export function isJokerFor(card: CardCode, wildRank: Rank): boolean {
  return isJoker(card) || rankOf(card) === wildRank;
}

/** Penalty points: A, K, Q, J, 10 = 10; 2–9 face value; jokers (printed or wild) 0. */
export function cardPoints(card: CardCode, wildRank: Rank): number {
  if (isJokerFor(card, wildRank)) return 0;
  const n = rankNumber(card);
  return n === 1 || n >= 10 ? 10 : n;
}

/** Sum of cardPoints. */
export function handPoints(hand: readonly CardCode[], wildRank: Rank): number {
  let total = 0;
  for (const c of hand) total += cardPoints(c, wildRank);
  return total;
}

// ------------------------------------------------------------- the search

const INF = Number.POSITIVE_INFINITY;
/** cell = pure * 3 + min(sequences, 2) */
const CELLS = 6;
const CELL_VALID = 5;
const K_PURE = 0;
const K_SEQ = 1;
const K_SET = 2;
const K_PARTIAL = 3;
type Kind = typeof K_PURE | typeof K_SEQ | typeof K_SET | typeof K_PARTIAL;

/** TRANS[kind][cell] = the cell after adding a group of that kind. */
const TRANS: readonly (readonly number[])[] = [K_PURE, K_SEQ, K_SET, K_PARTIAL].map((kind) =>
  Array.from({ length: CELLS }, (_, cell) => {
    if (kind === K_SET || kind === K_PARTIAL) return cell;
    const p = kind === K_PURE || cell >= 3 ? 1 : 0;
    return p * 3 + Math.min(2, (cell % 3) + 1);
  }),
);

type Mode = 'rule' | 'heuristic' | 'natural';

/**
 * Heuristic (bot) mode measures how far a hand is from a declaration rather than its
 * points: a loose card costs H_LOOSE, each card of a two-card "almost group" (a pair in two
 * suits, or two cards of one suit at most two apart) costs H_HALF, and every point adds
 * H_POINT so that high cards go first. These weights were tuned in bot-vs-bot simulations.
 */
const H_LOOSE = 10;
const H_HALF = 3;
const H_POINT = 0.25;
/** Heuristic structure penalty per cell (missing pure sequence / second sequence). */
const HEURISTIC_PENALTY: readonly number[] = [25, 20, 18, INF, 6, 0];

interface Nat {
  code: CardCode;
  suit: number;
  rank: number;
  wild: boolean;
}

interface Cand {
  mask: number;
  jokers: number;
  kind: Kind;
  cost: number;
}

interface Ctx {
  nats: Nat[];
  cost: number[];
  /** Candidate groups indexed by their lowest natural card. */
  byLow: Cand[][];
  /** Joker tokens: printed jokers and wild-rank cards used as jokers. */
  tokens: CardCode[];
  /** How many tokens are wild-rank cards (they can anchor a jokers-only sequence). */
  wildTokens: number;
  /** Free-discard searches may throw away a spare joker (declaring) or not (bot discards). */
  discardTokens: boolean;
  memo: Map<number, Float64Array>;
}

function suitIndex(card: CardCode): number {
  return SUITS.indexOf(suitOf(card));
}

function natOf(code: CardCode, wildRank: Rank): Nat {
  return { code, suit: suitIndex(code), rank: rankNumber(code), wild: rankOf(code) === wildRank };
}

function positionsOf(rank: number): number[] {
  return rank === 1 ? [1, 14] : [rank];
}

function buildCtx(
  naturals: readonly Nat[],
  tokens: readonly CardCode[],
  wildTokens: number,
  mode: Mode,
  wildRank: Rank,
): Ctx {
  const nats = naturals.slice().sort((a, b) => a.suit - b.suit || a.rank - b.rank);
  const n = nats.length;
  const J = tokens.length;
  const cost = nats.map((c) => {
    const v = cardPoints(c.code, wildRank);
    if (mode === 'natural') return Math.max(1, v);
    if (mode === 'heuristic') return c.wild ? 0 : H_LOOSE + H_POINT * v;
    return v;
  });
  const byLow: Cand[][] = Array.from({ length: n }, () => []);
  const seen = new Set<number>();
  const add = (mask: number, jokers: number, kind: Kind, groupCost: number) => {
    const key = mask * 64 + jokers * 4 + kind;
    if (seen.has(key)) return;
    seen.add(key);
    const low = 31 - Math.clz32(mask & -mask);
    byLow[low]?.push({ mask, jokers, kind, cost: groupCost });
  };

  // Sequences, suit by suit (indices of one suit are contiguous after sorting).
  for (let s = 0; s < 4; s++) {
    const slots: { pos: number; i: number }[] = [];
    nats.forEach((c, i) => {
      if (c.suit === s) for (const pos of positionsOf(c.rank)) slots.push({ pos, i });
    });
    slots.sort((a, b) => a.pos - b.pos || a.i - b.i);
    const extend = (from: number, mask: number, count: number, first: number, last: number) => {
      const gaps = last - first + 1 - count;
      const need = Math.max(gaps, 3 - count);
      if (need <= J) add(mask, need, need === 0 ? K_PURE : K_SEQ, 0);
      for (let t = from; t < slots.length; t++) {
        const slot = slots[t];
        if (!slot || slot.pos <= last) continue;
        if (slot.pos - first >= 13) break;
        if (gaps + (slot.pos - last - 1) > J) break;
        if (mask & (1 << slot.i)) continue;
        extend(t + 1, mask | (1 << slot.i), count + 1, first, slot.pos);
      }
    };
    slots.forEach((slot, t) => extend(t + 1, 1 << slot.i, 1, slot.pos, slot.pos));
  }

  // Sets: 2–4 distinct suits of one rank (two naturals need one joker).
  for (let r = 1; r <= 13; r++) {
    const bySuit: number[][] = [[], [], [], []];
    nats.forEach((c, i) => {
      if (c.rank === r) bySuit[c.suit]?.push(i);
    });
    const pick = (s: number, mask: number, count: number) => {
      if (s === 4) {
        if (count >= 3) add(mask, 0, K_SET, 0);
        else if (count === 2 && J >= 1) add(mask, 1, K_SET, 0);
        return;
      }
      pick(s + 1, mask, count);
      for (const i of bySuit[s] ?? []) pick(s + 1, mask | (1 << i), count + 1);
    };
    pick(0, 0, 0);
  }

  // Heuristic only: two-card "almost groups" (pairs and close same-suit cards).
  if (mode === 'heuristic') {
    for (let a = 0; a < n; a++) {
      for (let b = a + 1; b < n; b++) {
        const x = nats[a];
        const y = nats[b];
        if (!x || !y) continue;
        let near = false;
        if (x.rank === y.rank) near = x.suit !== y.suit;
        else if (x.suit === y.suit) {
          near = positionsOf(x.rank).some((p) =>
            positionsOf(y.rank).some((q) => Math.abs(p - q) <= 2),
          );
        }
        if (near) {
          const pts = cardPoints(x.code, wildRank) + cardPoints(y.code, wildRank);
          add((1 << a) | (1 << b), 0, K_PARTIAL, 2 * H_HALF + H_POINT * pts);
        }
      }
    }
  }

  return {
    nats,
    cost,
    byLow,
    tokens: tokens.slice(),
    wildTokens,
    discardTokens: mode !== 'heuristic',
    memo: new Map(),
  };
}

/** Jokers-only sequences possible with `j` spare tokens (each needs a wild-rank anchor). */
function jokerOnlyGroups(ctx: Ctx, j: number): number {
  return Math.min(2, Math.floor(j / 3), Math.min(ctx.wildTokens, j));
}

/**
 * Minimum ungrouped points per cell for the natural cards in `mask` with `j` spare joker
 * tokens. With `f` = 1 exactly one card must also be thrown away for free (used to find the
 * best discard from 14 cards in one search): a natural non-wild card, or — when the context
 * allows it — a spare joker.
 */
function solve(ctx: Ctx, mask: number, j: number, f: number): Float64Array {
  const key = (mask * 16 + j) * 2 + f;
  const hit = ctx.memo.get(key);
  if (hit) return hit;
  let res: Float64Array = new Float64Array(CELLS).fill(INF);
  if (mask === 0) {
    if (f === 0) {
      const g = jokerOnlyGroups(ctx, j);
      for (let q = 0; q <= g; q++) res[q] = 0;
    } else if (ctx.discardTokens && j >= 1) {
      res = solve(ctx, 0, j - 1, 0);
    }
  } else {
    const lowBit = mask & -mask;
    const i = 31 - Math.clz32(lowBit);
    const child = solve(ctx, mask ^ lowBit, j, f);
    const v = ctx.cost[i] ?? 0;
    for (let c = 0; c < CELLS; c++) res[c] = (child[c] ?? INF) + v;
    if (f === 1 && ctx.nats[i]?.wild === false) {
      const thrown = solve(ctx, mask ^ lowBit, j, 0);
      for (let c = 0; c < CELLS; c++) res[c] = Math.min(res[c] ?? INF, thrown[c] ?? INF);
    }
    for (const g of ctx.byLow[i] ?? []) {
      if (g.jokers > j || (g.mask & mask) !== g.mask) continue;
      const ch = solve(ctx, mask & ~g.mask, j - g.jokers, f);
      const t = TRANS[g.kind] ?? [];
      for (let c = 0; c < CELLS; c++) {
        const x = (ch[c] ?? INF) + g.cost;
        const nc = t[c] ?? c;
        if (x < (res[nc] ?? INF)) res[nc] = x;
      }
    }
  }
  ctx.memo.set(key, res);
  return res;
}

function fullMask(ctx: Ctx): number {
  return ctx.nats.length ? 2 ** ctx.nats.length - 1 : 0;
}

function solveAll(ctx: Ctx, f: number): Float64Array {
  return solve(ctx, fullMask(ctx), ctx.tokens.length, f);
}

/** Wild-rank cards that could sit in their natural place inside a pure sequence. */
function naturalCandidates(hand: readonly CardCode[], wildRank: Rank): Map<CardCode, number> {
  const out = new Map<CardCode, number>();
  const present = new Set<string>();
  for (const c of hand) {
    if (isJokerFor(c, wildRank)) continue;
    for (const p of positionsOf(rankNumber(c))) present.add(`${suitOf(c)}${p}`);
  }
  for (const c of hand) {
    if (isJoker(c) || rankOf(c) !== wildRank) continue;
    const s = suitOf(c);
    const has = (p: number) => present.has(`${s}${p}`);
    const fits = positionsOf(rankNumber(c)).some(
      (x) => (has(x - 2) && has(x - 1)) || (has(x - 1) && has(x + 1)) || (has(x + 1) && has(x + 2)),
    );
    if (fits) out.set(c, (out.get(c) ?? 0) + 1);
  }
  return out;
}

/** One search context per way of using the wild-rank cards (natural or joker). */
function contexts(hand: readonly CardCode[], wildRank: Rank, mode: Mode): Ctx[] {
  const fixed: Nat[] = [];
  const printed: CardCode[] = [];
  const wild: CardCode[] = [];
  for (const c of hand) {
    if (isJoker(c)) printed.push(c);
    else if (rankOf(c) === wildRank) wild.push(c);
    else fixed.push(natOf(c, wildRank));
  }
  if (mode === 'natural') {
    return [buildCtx([...fixed, ...wild.map((c) => natOf(c, wildRank))], [], 0, mode, wildRank)];
  }
  const options = [...naturalCandidates(hand, wildRank)];
  const out: Ctx[] = [];
  const choose = (k: number, naturals: CardCode[]) => {
    if (k === options.length) {
      const tokens = wild.slice();
      for (const c of naturals) tokens.splice(tokens.indexOf(c), 1);
      const nats = [...fixed, ...naturals.map((c) => natOf(c, wildRank))];
      out.push(buildCtx(nats, [...printed, ...tokens], tokens.length, mode, wildRank));
      return;
    }
    const [code, copies] = options[k] ?? ['X1', 0];
    for (let m = 0; m <= copies; m++) {
      choose(k + 1, [...naturals, ...Array.from({ length: m }, () => code)]);
    }
  };
  choose(0, []);
  return out;
}

interface Table {
  cells: number[];
  totalPoints: number;
}

function computeTable(hand: readonly CardCode[], wildRank: Rank, mode: Mode, f: number): Table {
  const cells = Array.from({ length: CELLS }, () => INF);
  for (const ctx of contexts(hand, wildRank, mode)) {
    const t = solveAll(ctx, f);
    for (let c = 0; c < CELLS; c++) cells[c] = Math.min(cells[c] ?? INF, t[c] ?? INF);
  }
  return { cells, totalPoints: handPoints(hand, wildRank) };
}

// ------------------------------------------------------------------ cache

const CACHE_LIMIT = 20_000;
const cache = new Map<string, Table>();

function tableFor(hand: readonly CardCode[], wildRank: Rank, mode: Mode, f = 0): Table {
  if (hand.length > 26) throw new RangeError('Indian Rummy: hand too large to evaluate');
  const key = `${mode}${f}${wildRank}${hand.slice().sort().join('')}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const table = computeTable(hand, wildRank, mode, f);
  if (cache.size >= CACHE_LIMIT) {
    let drop = CACHE_LIMIT / 4;
    for (const k of cache.keys()) {
      cache.delete(k);
      if (--drop <= 0) break;
    }
  }
  cache.set(key, table);
  return table;
}

// ------------------------------------------------------------ public API

/** All cards grouped with ≥ 2 sequences, ≥ 1 of them pure (jokers may be left over). */
export function isValidHand(hand: readonly CardCode[], wildRank: Rank): boolean {
  return tableFor(hand, wildRank, 'rule').cells[CELL_VALID] === 0;
}

/** Points this hand pays when another player declares (pure-sequence rule, cap 80). */
export function deadwoodOf(hand: readonly CardCode[], wildRank: Rank): number {
  const t = tableFor(hand, wildRank, 'rule');
  const withPure = Math.min(t.cells[4] ?? INF, t.cells[5] ?? INF);
  return Math.min(DEADWOOD_CAP, Number.isFinite(withPure) ? withPure : t.totalPoints);
}

/** A pure sequence can be made from `hand`. */
export function hasPureSequence(hand: readonly CardCode[], wildRank: Rank): boolean {
  const t = tableFor(hand, wildRank, 'rule');
  return Number.isFinite(Math.min(t.cells[4] ?? INF, t.cells[5] ?? INF));
}

/** Fewest points of ungrouped cards, ignoring the pure-sequence rule (uncapped). */
export function rawDeadwoodOf(hand: readonly CardCode[], wildRank: Rank): number {
  return Math.min(...tableFor(hand, wildRank, 'rule').cells);
}

/** A valid declaration in which no joker stands in for another card. */
export function isValidWithoutJokers(hand: readonly CardCode[], wildRank: Rank): boolean {
  if (hand.some(isJoker)) return false;
  return tableFor(hand, wildRank, 'natural').cells[CELL_VALID] === 0;
}

/** Some single discard from `hand` (normally 14 cards) leaves a valid declaration. */
export function canDeclareAfterOneDiscard(hand: readonly CardCode[], wildRank: Rank): boolean {
  return tableFor(hand, wildRank, 'rule', 1).cells[CELL_VALID] === 0;
}

function scoreOf(cells: readonly number[]): { score: number; cell: number } {
  let score = INF;
  let cell = 0;
  for (let c = 0; c < CELLS; c++) {
    const x = (cells[c] ?? INF) + (HEURISTIC_PENALTY[c] ?? INF);
    if (x < score) {
      score = x;
      cell = c;
    }
  }
  return { score, cell };
}

/**
 * Bot evaluation (lower is better): ungrouped points, two-card "almost groups" at half
 * price, plus a penalty for a missing pure sequence / second sequence.
 */
export function handScore(hand: readonly CardCode[], wildRank: Rank): number {
  return scoreOf(tableFor(hand, wildRank, 'heuristic').cells).score;
}

const discardCache = new Map<string, { score: number; discard: CardCode }>();

/**
 * The bot's best discard from `hand` (normally 14 cards) in a single search: the natural,
 * non-joker card whose removal leaves the lowest handScore. Jokers are always kept.
 */
export function bestDiscard(
  hand: readonly CardCode[],
  wildRank: Rank,
): { score: number; discard: CardCode } {
  const key = `${wildRank}${hand.slice().sort().join('')}`;
  const hit = discardCache.get(key);
  if (hit) return hit;
  let best: { score: number; discard: CardCode } | null = null;
  for (const ctx of contexts(hand, wildRank, 'heuristic')) {
    const { score, cell } = scoreOf(Array.from(solveAll(ctx, 1)));
    if (best && score >= best.score) continue;
    const thrown = thrownCard(ctx, cell);
    if (thrown) best = { score, discard: thrown };
  }
  if (!best) {
    // Only jokers left to throw (cannot happen with 14 cards): give up the first card.
    const first = hand[0];
    if (!first) throw new RangeError('Indian Rummy: cannot discard from an empty hand');
    best = { score: handScore(hand.slice(1), wildRank), discard: first };
  }
  if (discardCache.size >= CACHE_LIMIT / 4) discardCache.clear();
  discardCache.set(key, best);
  return best;
}

/** Follow an optimal free-discard path and report which natural card it throws away. */
function thrownCard(ctx: Ctx, cell: number): CardCode | null {
  let mask = fullMask(ctx);
  let j = ctx.tokens.length;
  let target = cell;
  while (mask !== 0) {
    const want = solve(ctx, mask, j, 1)[target] ?? INF;
    if (!Number.isFinite(want)) return null;
    const lowBit = mask & -mask;
    const i = 31 - Math.clz32(lowBit);
    const nat = ctx.nats[i];
    if (nat && !nat.wild && (solve(ctx, mask ^ lowBit, j, 0)[target] ?? INF) === want) {
      return nat.code;
    }
    let moved = false;
    for (const g of ctx.byLow[i] ?? []) {
      if (g.jokers > j || (g.mask & mask) !== g.mask) continue;
      const ch = solve(ctx, mask & ~g.mask, j - g.jokers, 1);
      const t = TRANS[g.kind] ?? [];
      for (let c = 0; c < CELLS; c++) {
        if (t[c] === target && (ch[c] ?? INF) + g.cost === want) {
          mask &= ~g.mask;
          j -= g.jokers;
          target = c;
          moved = true;
          break;
        }
      }
      if (moved) break;
    }
    if (!moved) mask ^= lowBit;
  }
  return null;
}

// ------------------------------------------------------- reconstruction

interface Plan {
  groups: { kind: Kind; nats: number[]; jokers: number }[];
  ungrouped: number[];
  jokerOnly: number;
}

function reconstruct(ctx: Ctx, cell: number): Plan {
  const plan: Plan = { groups: [], ungrouped: [], jokerOnly: 0 };
  let mask = fullMask(ctx);
  let j = ctx.tokens.length;
  let target = cell;
  for (;;) {
    const res = solve(ctx, mask, j, 0);
    const want = res[target] ?? INF;
    if (mask === 0) {
      plan.jokerOnly = target % 3;
      return plan;
    }
    const lowBit = mask & -mask;
    const i = 31 - Math.clz32(lowBit);
    let next: { mask: number; j: number; cell: number } | null = null;
    for (const g of ctx.byLow[i] ?? []) {
      if (g.jokers > j || (g.mask & mask) !== g.mask) continue;
      const ch = solve(ctx, mask & ~g.mask, j - g.jokers, 0);
      const t = TRANS[g.kind] ?? [];
      for (let c = 0; c < CELLS && !next; c++) {
        if (t[c] === target && (ch[c] ?? INF) + g.cost === want) {
          next = { mask: mask & ~g.mask, j: j - g.jokers, cell: c };
        }
      }
      if (next) {
        const nats: number[] = [];
        for (let b = 0; b < ctx.nats.length; b++) if (g.mask & (1 << b)) nats.push(b);
        plan.groups.push({ kind: g.kind, nats, jokers: g.jokers });
        break;
      }
    }
    if (!next) {
      plan.ungrouped.push(i);
      next = { mask: mask ^ lowBit, j, cell: target };
    }
    mask = next.mask;
    j = next.j;
    target = next.cell;
  }
}

/** Sequence cards low → high with jokers in the gaps (and any extra jokers on an end). */
function orderSequence(cards: readonly Nat[], jokers: readonly CardCode[]): CardCode[] {
  const lowPos = cards.map((c) => c.rank);
  const highPos = cards.map((c) => (c.rank === 1 ? 14 : c.rank));
  const span = (ps: number[]) => Math.max(...ps) - Math.min(...ps);
  const pos = cards.some((c) => c.rank === 1) && span(highPos) < span(lowPos) ? highPos : lowPos;
  const placed = cards
    .map((c, i) => ({ code: c.code, pos: pos[i] ?? c.rank }))
    .sort((a, b) => a.pos - b.pos);
  const spare = jokers.slice();
  const out: CardCode[] = [];
  placed.forEach((p, i) => {
    const prev = placed[i - 1];
    if (prev) for (let x = prev.pos + 1; x < p.pos; x++) out.push(spare.shift() ?? 'X1');
    out.push(p.code);
  });
  const last = placed[placed.length - 1]?.pos ?? 0;
  const room = 14 - last;
  const tail = spare.splice(0, Math.min(room, spare.length));
  return [...spare, ...out, ...tail];
}

/** Sort for the unmatched pile: by suit then rank, jokers last. */
function sortLoose(cards: CardCode[]): CardCode[] {
  return cards.sort((a, b) => {
    if (isJoker(a) || isJoker(b)) return Number(isJoker(a)) - Number(isJoker(b));
    return suitIndex(a) - suitIndex(b) || rankNumber(a) - rankNumber(b);
  });
}

/** A group being assembled for display: its natural cards and the jokers standing in. */
interface Draft {
  kind: Exclude<GroupKind, 'unmatched'>;
  nats: Nat[];
  jokers: CardCode[];
}

function arrangeFrom(ctx: Ctx, cell: number, valid: boolean): MeldGroup[] {
  const plan = reconstruct(ctx, cell);
  const printed = ctx.tokens.filter(isJoker);
  const wild: CardCode[] = ctx.tokens.filter((c) => !isJoker(c));
  // Wild-rank cards treated as natural but left ungrouped are just spare jokers.
  const loose: CardCode[] = [];
  for (const i of plan.ungrouped) {
    const nat = ctx.nats[i];
    if (!nat) continue;
    if (nat.wild) wild.push(nat.code);
    else loose.push(nat.code);
  }
  // Each jokers-only sequence is anchored by a wild-rank card; ordinary groups use printed first.
  const anchors = wild.splice(0, plan.jokerOnly);
  const pool = [...printed, ...wild];
  const drafts: Draft[] = plan.groups.map((g) => ({
    kind: g.kind === K_SET ? 'set' : g.kind === K_PURE ? 'pure-sequence' : 'sequence',
    nats: g.nats.map((i) => ctx.nats[i]).filter((x): x is Nat => x !== undefined),
    jokers: pool.splice(0, g.jokers),
  }));
  for (const anchor of anchors) {
    // The anchor plays itself (in its own place); the two jokers fill the places beside it.
    const nat: Nat = {
      code: anchor,
      suit: suitIndex(anchor),
      rank: rankNumber(anchor),
      wild: true,
    };
    drafts.push({ kind: 'sequence', nats: [nat], jokers: pool.splice(0, 2) });
  }
  if (valid && pool.length) {
    // Spare jokers join an impure sequence (or one of two pure ones, which stays a sequence).
    const target =
      drafts.find((g) => g.kind === 'sequence') ?? drafts.find((g) => g.kind === 'pure-sequence');
    if (target) {
      target.kind = 'sequence';
      target.jokers.push(...pool.splice(0));
    }
  }
  // Sequences are laid out low → high only now, so added jokers land in places that exist
  // (below the run when it already ends on an Ace) instead of being tacked on after it.
  const groups: MeldGroup[] = drafts.map((d) =>
    d.kind === 'set'
      ? { kind: 'set', cards: [...d.nats.map((x) => x.code), ...d.jokers] }
      : { kind: d.kind, cards: orderSequence(d.nats, d.jokers) },
  );
  loose.push(...pool);
  const order: Record<GroupKind, number> = {
    'pure-sequence': 0,
    sequence: 1,
    set: 2,
    unmatched: 3,
  };
  groups.sort((a, b) => order[a.kind] - order[b.kind]);
  if (loose.length) groups.push({ kind: 'unmatched', cards: sortLoose(loose) });
  return groups;
}

/**
 * The best way to arrange `hand`: a valid declaration if there is one, otherwise the
 * arrangement with the fewest deadwood points (respecting the pure-sequence rule).
 */
export function bestArrangement(hand: readonly CardCode[], wildRank: Rank): Arrangement {
  const table = tableFor(hand, wildRank, 'rule');
  const cells = table.cells;
  const valid = cells[CELL_VALID] === 0;
  const pureBest = Math.min(cells[4] ?? INF, cells[5] ?? INF);
  const hasPure = Number.isFinite(pureBest);
  const rawDeadwood = Math.min(...cells);
  // Which cell to display: valid → (pure, 2+); with a pure sequence → its best cell
  // (preferring more sequences); otherwise the best grouping without one.
  const candidates = hasPure ? [5, 4] : [2, 1, 0];
  let cell = candidates[0] ?? 0;
  for (const c of candidates) if ((cells[c] ?? INF) < (cells[cell] ?? INF)) cell = c;
  let groups: MeldGroup[] = [{ kind: 'unmatched', cards: sortLoose(hand.slice()) }];
  for (const ctx of contexts(hand, wildRank, 'rule')) {
    const t = solveAll(ctx, 0);
    if ((t[cell] ?? INF) === cells[cell] && Number.isFinite(cells[cell] ?? INF)) {
      groups = arrangeFrom(ctx, cell, valid);
      break;
    }
  }
  return {
    groups,
    valid,
    deadwoodPoints: Math.min(DEADWOOD_CAP, hasPure ? pureBest : table.totalPoints),
    rawDeadwood,
    totalPoints: table.totalPoints,
    hasPureSequence: hasPure,
    hasTwoSequences: Number.isFinite(cells[CELL_VALID] ?? INF),
  };
}

function listShort(cards: readonly CardCode[]): string {
  const names = cards.map(cardShort);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Why `hand` (13 cards) is not a valid declaration, in beginner words — or null if it is.
 */
export function declareProblem(hand: readonly CardCode[], wildRank: Rank): string | null {
  const a = bestArrangement(hand, wildRank);
  if (a.valid) return null;
  if (!a.hasPureSequence) {
    return 'You need at least one pure sequence — a run of 3 or more cards in one suit with no jokers, like 4♥ 5♥ 6♥ — and you don’t have one yet.';
  }
  if (!a.hasTwoSequences) {
    return 'You have a pure sequence, but you need a second sequence as well (this one may use a joker). Sets don’t count as sequences.';
  }
  // Show the arrangement that has both sequences and say which cards are still loose.
  let loose: CardCode[] = [];
  for (const ctx of contexts(hand, wildRank, 'rule')) {
    const t = solveAll(ctx, 0);
    const best = tableFor(hand, wildRank, 'rule').cells[CELL_VALID] ?? INF;
    if ((t[CELL_VALID] ?? INF) === best) {
      loose = arrangeFrom(ctx, CELL_VALID, false).find((g) => g.kind === 'unmatched')?.cards ?? [];
      break;
    }
  }
  const cards = loose.filter((c) => !isJokerFor(c, wildRank));
  const n = cards.length;
  return `You have the two sequences you need, but ${n === 1 ? 'one card doesn’t' : `${n} cards don’t`} fit into any set or sequence yet: ${listShort(cards)}. Every one of your 13 cards must be in a group before you can declare.`;
}
