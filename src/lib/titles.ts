/**
 * Context-aware selection of win titles, roasts and post-roast tips.
 *
 * Every entry in `content/titles.ts` lists conditions that must ALL hold. Eligible entries
 * are scored by the sum of their condition weights (more specific = higher); we then
 * sample uniformly among the entries scoring within `SELECTION_MARGIN` of the best score,
 * which keeps the most fitting lines on top while still giving variety. The previously
 * shown line (`lastId`) is always excluded, so the same line never appears twice in a row.
 *
 * The weights form these tiers (each only shares the pool with the tier just below it):
 *
 *   firstWin 100 > game + special/tag 85 > streak5 60 > special/tag 45 > game 40 > base 30
 *
 * so an ordinary result mixes the game's own lines with the generic ones, a special
 * moment (comeback, bust, …) shows its own lines plus the game's lines, and the generic
 * lines step aside whenever something special happened.
 *
 * Everything here is pure and deterministic given the `random` function.
 */
import {
  CHANCE_GAMES,
  roasts,
  titles,
  type Roast,
  type RoastCondition,
  type TitleCondition,
  type WinTitle,
} from '@content/titles';
import { type ResultFlags } from '@/games/core/types';
import { type StatsSnapshot } from '@/store/stats';

export interface TitleContext {
  gameSlug: string;
  gameName: string;
  /** Net Jeet change for this game (positive = won). */
  netJeet: number;
  /** Jeet value of one stake unit. */
  stake: number;
  flags: ResultFlags;
  /** Stats snapshot taken BEFORE this game was recorded. */
  statsBefore: StatsSnapshot;
  /** True when netJeet beats the previous all-time biggest win. */
  isBiggestWin: boolean;
}

/** Entries scoring within this many points of the best eligible score share the pool. */
export const SELECTION_MARGIN = 10;

/**
 * Fallback for engines that leave `flags.bigPot` undefined: a win/loss counts as "big"
 * at this many stake units (the ResultFlags default). An engine's own true/false always
 * wins, because a "unit" means very different amounts per game (one Hold'em chip, one
 * Rummy point, one Blackjack bet).
 */
const BIG_POT_UNITS = 3;

/** `generic` (and `decisions` for roasts): fits any result. */
const BASE_WEIGHT = 30;
/** `game:<slug>`: fits any result of that game. */
const GAME_WEIGHT = 40;
/** Result flags and stats moments (comeback, bust, streak3, …). */
const SPECIAL_WEIGHT = 45;
/** `tag:<tag>`: an engine-specific moment (always paired with its game in the content). */
const TAG_WEIGHT = 45;

type FixedTitleCondition = Exclude<TitleCondition, `game:${string}` | `tag:${string}`>;
type FixedRoastCondition = Exclude<RoastCondition, `game:${string}` | `tag:${string}`>;

const TITLE_WEIGHTS: Record<FixedTitleCondition, number> = {
  firstWin: 100,
  streak5: 60,
  streak3: SPECIAL_WEIGHT,
  comeback: SPECIAL_WEIGHT,
  bigPot: SPECIAL_WEIGHT,
  biggestWin: SPECIAL_WEIGHT,
  closeFinish: SPECIAL_WEIGHT,
  luckyLastCard: SPECIAL_WEIGHT,
  perfect: SPECIAL_WEIGHT,
  generic: BASE_WEIGHT,
};

const ROAST_WEIGHTS: Record<FixedRoastCondition, number> = {
  bust: SPECIAL_WEIGHT,
  folded: SPECIAL_WEIGHT,
  bigLoss: SPECIAL_WEIGHT,
  closeLoss: SPECIAL_WEIGHT,
  streakBroken: SPECIAL_WEIGHT,
  losingStreak3: SPECIAL_WEIGHT,
  decisions: BASE_WEIGHT,
  generic: BASE_WEIGHT,
};

const CHANCE_GAME_SET: ReadonlySet<string> = new Set(CHANCE_GAMES);

/** Returns the part after `prefix`, or null when `condition` doesn't start with it. */
function suffixAfter(condition: string, prefix: 'game:' | 'tag:'): string | null {
  return condition.startsWith(prefix) ? condition.slice(prefix.length) : null;
}

function hasOwn<K extends string>(record: Record<K, number>, key: string): key is K {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/** Shared handling of `game:<slug>` / `tag:<tag>` conditions; null for anything else. */
function prefixedHolds(condition: string, ctx: TitleContext): boolean | null {
  const game = suffixAfter(condition, 'game:');
  if (game !== null) return ctx.gameSlug === game;
  const tag = suffixAfter(condition, 'tag:');
  if (tag !== null) return ctx.flags.tags?.includes(tag) ?? false;
  return null;
}

/** The engine's bigPot flag; without one, won (or lost, `sign = -1`) ≥ BIG_POT_UNITS stakes. */
function isBigResult(ctx: TitleContext, sign: 1 | -1): boolean {
  if (ctx.flags.bigPot !== undefined) return ctx.flags.bigPot;
  return ctx.stake > 0 && sign * ctx.netJeet >= BIG_POT_UNITS * ctx.stake;
}

/** Whether a single title condition holds for this (winning) game. */
export function titleConditionHolds(c: TitleCondition, ctx: TitleContext): boolean {
  const prefixed = prefixedHolds(c, ctx);
  if (prefixed !== null) return prefixed;
  const { flags, statsBefore } = ctx;
  const streakAfterWin = statsBefore.currentStreak > 0 ? statsBefore.currentStreak + 1 : 1;
  switch (c) {
    case 'generic':
      return true;
    case 'firstWin':
      return statsBefore.wins === 0;
    case 'streak3':
      return streakAfterWin >= 3;
    case 'streak5':
      return streakAfterWin >= 5;
    case 'comeback':
      return flags.comeback === true;
    case 'closeFinish':
      return flags.closeFinish === true;
    case 'luckyLastCard':
      return flags.luckyLastCard === true;
    case 'perfect':
      return flags.perfect === true;
    case 'bigPot':
      return isBigResult(ctx, 1);
    case 'biggestWin':
      return ctx.isBiggestWin && statsBefore.wins > 0;
    default:
      return false;
  }
}

/** Whether a single roast condition holds for this (losing) game. */
export function roastConditionHolds(c: RoastCondition, ctx: TitleContext): boolean {
  const prefixed = prefixedHolds(c, ctx);
  if (prefixed !== null) return prefixed;
  const { flags, statsBefore } = ctx;
  switch (c) {
    case 'generic':
      return true;
    case 'decisions':
      return !CHANCE_GAME_SET.has(ctx.gameSlug);
    case 'bust':
      return flags.bust === true;
    case 'folded':
      return flags.folded === true;
    case 'bigLoss':
      return isBigResult(ctx, -1);
    case 'closeLoss':
      return flags.closeFinish === true;
    case 'streakBroken':
      return statsBefore.currentStreak >= 2;
    case 'losingStreak3':
      return statsBefore.currentStreak <= -2;
    default:
      return false;
  }
}

/** Specificity weight of a title condition (higher = more specific). */
export function titleConditionWeight(c: TitleCondition): number {
  if (suffixAfter(c, 'game:') !== null) return GAME_WEIGHT;
  if (suffixAfter(c, 'tag:') !== null) return TAG_WEIGHT;
  return hasOwn(TITLE_WEIGHTS, c) ? TITLE_WEIGHTS[c] : 0;
}

/** Specificity weight of a roast condition (higher = more specific). */
export function roastConditionWeight(c: RoastCondition): number {
  if (suffixAfter(c, 'game:') !== null) return GAME_WEIGHT;
  if (suffixAfter(c, 'tag:') !== null) return TAG_WEIGHT;
  return hasOwn(ROAST_WEIGHTS, c) ? ROAST_WEIGHTS[c] : 0;
}

function randomIndex(random: () => number, length: number): number {
  const r = random();
  const unit = Number.isFinite(r) ? Math.min(Math.max(r, 0), 1) : 0;
  return Math.min(length - 1, Math.floor(unit * length));
}

/**
 * The pool `selectEntry` samples from (exported for tests and previews):
 *
 * 1. Candidates = entries (other than `lastId`) whose conditions all hold.
 * 2. Score = sum of condition weights; pool = candidates within SELECTION_MARGIN of the top,
 *    in source order.
 *
 * Degenerate fallbacks (never reached with the real content, which has generic lines for
 * every result): if only `lastId` is eligible it is repeated rather than showing a line
 * that doesn't fit; if nothing is eligible at all, every entry other than `lastId` is used.
 */
export function selectionPool<C extends string, T extends { id: string; when: readonly C[] }>(
  entries: readonly T[],
  holds: (c: C) => boolean,
  weight: (c: C) => number,
  lastId: string | null,
): T[] {
  const scored: { entry: T; score: number }[] = [];
  let lastEligible: T | null = null;
  let best = -Infinity;
  for (const entry of entries) {
    if (!entry.when.every(holds)) continue;
    if (entry.id === lastId) {
      lastEligible = entry;
      continue;
    }
    const score = entry.when.reduce((sum, c) => sum + weight(c), 0);
    scored.push({ entry, score });
    if (score > best) best = score;
  }
  if (scored.length > 0) {
    return scored.filter((s) => s.score >= best - SELECTION_MARGIN).map((s) => s.entry);
  }
  if (lastEligible !== null) return [lastEligible];
  const others = entries.filter((e) => e.id !== lastId);
  return others.length > 0 ? others : [...entries];
}

/**
 * Generic selection used by pickTitle / pickRoast: a uniform pick (via `random`) from
 * `selectionPool`. Deterministic for a given `random` sequence.
 */
export function selectEntry<C extends string, T extends { id: string; when: readonly C[] }>(
  entries: readonly T[],
  holds: (c: C) => boolean,
  weight: (c: C) => number,
  lastId: string | null,
  random: () => number = Math.random,
): T {
  if (entries.length === 0) throw new RangeError('selectEntry needs at least one entry');
  const pool = selectionPool(entries, holds, weight, lastId);
  return pool[randomIndex(random, pool.length)] as T;
}

/** Every win title `pickTitle` could return for this context. */
export function titlePool(ctx: TitleContext, lastId: string | null): WinTitle[] {
  return selectionPool(titles, (c) => titleConditionHolds(c, ctx), titleConditionWeight, lastId);
}

/** Every roast `pickRoast` could return for this context. */
export function roastPool(ctx: TitleContext, lastId: string | null): Roast[] {
  return selectionPool(roasts, (c) => roastConditionHolds(c, ctx), roastConditionWeight, lastId);
}

/** The best-fitting win title for this game, never equal to `lastId`. */
export function pickTitle(
  ctx: TitleContext,
  lastId: string | null,
  random: () => number = Math.random,
): WinTitle {
  return selectEntry(
    titles,
    (c) => titleConditionHolds(c, ctx),
    titleConditionWeight,
    lastId,
    random,
  );
}

/** The best-fitting roast for this lost game, never equal to `lastId`. */
export function pickRoast(
  ctx: TitleContext,
  lastId: string | null,
  random: () => number = Math.random,
): Roast {
  return selectEntry(
    roasts,
    (c) => roastConditionHolds(c, ctx),
    roastConditionWeight,
    lastId,
    random,
  );
}

/**
 * Rotating tip after a roast. With no (or an unknown) `lastTip` a random tip starts the
 * rotation; otherwise the next tip in list order is returned, so the learner cycles
 * through every tip and never sees the same one twice in a row (when ≥ 2 distinct tips
 * exist). Returns '' for an empty list.
 */
export function pickTip(
  tips: readonly string[],
  lastTip: string | null,
  random: () => number = Math.random,
): string {
  if (tips.length === 0) return '';
  const lastIndex = lastTip === null ? -1 : tips.indexOf(lastTip);
  if (lastIndex === -1) return tips[randomIndex(random, tips.length)] as string;
  for (let step = 1; step < tips.length; step++) {
    const tip = tips[(lastIndex + step) % tips.length] as string;
    if (tip !== lastTip) return tip;
  }
  return lastTip as string;
}

export interface TitleContextInput {
  gameSlug: string;
  gameName: string;
  /** GameResult.humanNetUnits. */
  humanNetUnits: number;
  /** Jeet per stake unit. */
  stake: number;
  /** GameResult.flags. */
  flags: ResultFlags;
  /** The snapshot returned by useStats.getState().recordGame(...). */
  statsBefore: StatsSnapshot;
}

/**
 * Convenience builder so every caller derives the context the same way:
 * netJeet = round(humanNetUnits × stake) (as in GameResult docs) and isBiggestWin =
 * a positive net that beats the previous all-time biggest win.
 */
export function buildTitleContext(input: TitleContextInput): TitleContext {
  const raw = Math.round(input.humanNetUnits * input.stake);
  const netJeet = Number.isFinite(raw) ? raw : 0;
  return {
    gameSlug: input.gameSlug,
    gameName: input.gameName,
    netJeet,
    stake: input.stake,
    flags: input.flags,
    statsBefore: input.statsBefore,
    isBiggestWin: netJeet > 0 && netJeet > input.statsBefore.biggestWin,
  };
}
