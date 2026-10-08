/**
 * Andar Bahar — constants, exact odds and wording helpers (docs/RULES_DECISIONS.md →
 * Andar Bahar). Everything here is a pure function of its arguments; the engine
 * (engine.ts) wraps it in the GameEngine contract, and the tests use it directly.
 *
 * The odds are exact, not simulated. After the joker is turned up, the 51 cards left hold
 * exactly 3 cards of the joker's rank, every order equally likely. The deal stops at the
 * first of them, so with `n` unseen cards and `m` matches left the first match is card `k`
 * with probability C(n − k, m − 1) / C(n, m). The side that receives the next card gets
 * cards 1, 3, 5, … from here on, so its chance is the sum over odd `k`. Before any card is
 * dealt that is 10,725 / 20,825 ≈ 51.5% for Andar (which gets the first card) and
 * 10,100 / 20,825 ≈ 48.5% for Bahar.
 */
import { RANK_NAMES, rankOf, type CardCode, type Rank } from '@/games/core/cards';
import type { PlayerId } from '@/games/core/types';

/** The two places a card can land: Andar ("inside") and Bahar ("outside"). */
export type Side = 'andar' | 'bahar';
export const SIDES: readonly Side[] = ['andar', 'bahar'];

/** Seat 0: the learner, who bets (a bot in simulations). */
export const LEARNER: PlayerId = 0;
/** Seat 1: the dealer, whose only move is the forced deal of the next card. */
export const DEALER: PlayerId = 1;
export const SEATS = 2;

/** One standard deck, no printed jokers. */
export const DECK_SIZE = 52;
/** Cards of the joker's rank still in the deck once the joker is face up (one per other suit). */
export const MATCHING_CARDS = 3;
/** Cards left to deal after the joker is turned up. */
export const STOCK_SIZE = DECK_SIZE - 1;
/** The worst case: all three matches are the last three cards, so the deal ends on card 49. */
export const MAX_DEAL_LENGTH = STOCK_SIZE - MATCHING_CARDS + 1;

/** The variant taught always deals the first card to Andar. */
export const FIRST_SIDE: Side = 'andar';

/**
 * Winnings per unit staked: Andar pays 0.9 to 1 because it receives the first card and so
 * wins a little more often; Bahar pays 1 to 1. A losing bet loses its one unit.
 */
export const PAYOUT: Readonly<Record<Side, number>> = { andar: 0.9, bahar: 1 };
/** Betting: the only commitment is the single one-unit bet. */
export const MAX_LOSS_UNITS = 1;

/** luckyLastCard: at least this many cards were dealt before the match (the long nail-biter). */
export const LONG_DEAL_CARDS_BEFORE_MATCH = 25;
/** closeFinish: the match came within the first this-many cards. */
export const QUICK_FINISH_MAX_CARDS = 3;

export const SIDE_NAMES: Readonly<Record<Side, string>> = { andar: 'Andar', bahar: 'Bahar' };
/** What the side's name means, for beginners: "Andar (inside)". */
export const SIDE_MEANINGS: Readonly<Record<Side, string>> = { andar: 'inside', bahar: 'outside' };

export function isSide(value: unknown): value is Side {
  return value === 'andar' || value === 'bahar';
}

export function otherSide(side: Side): Side {
  return side === 'andar' ? 'bahar' : 'andar';
}

/**
 * The side that receives the card with this 0-based deal index: the deal alternates,
 * starting with Andar, so cards 0, 2, 4, … go to Andar and 1, 3, 5, … to Bahar.
 */
export function sideForCard(index: number): Side {
  return index % 2 === 0 ? FIRST_SIDE : otherSide(FIRST_SIDE);
}

/** Two cards match when they share a rank — the suit never matters. */
export function sameRank(a: CardCode, b: CardCode): boolean {
  return rankOf(a) === rankOf(b);
}

// ---------------------------------------------------------------------------
// Exact odds
// ---------------------------------------------------------------------------

/** Binomial coefficient C(n, k) (exact for every value this game needs). */
export function choose(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || n < k) return 0;
  let out = 1;
  for (let i = 1; i <= k; i++) out = (out * (n - k + i)) / i;
  return Math.round(out);
}

function checkDeck(unseen: number, matches: number): void {
  if (!Number.isInteger(unseen) || !Number.isInteger(matches) || matches < 1 || unseen < matches) {
    throw new RangeError(
      `Andar Bahar odds need at least one matching card among the unseen cards ` +
        `(got ${matches} of ${unseen}).`,
    );
  }
}

/**
 * Exact distribution of where the first match falls: element `k − 1` is the probability
 * that the k-th card dealt from here is the first one of the joker's rank.
 */
export function firstMatchDistribution(unseen: number, matches = MATCHING_CARDS): number[] {
  checkDeck(unseen, matches);
  const total = choose(unseen, matches);
  const out: number[] = [];
  for (let k = 1; k <= unseen - matches + 1; k++) {
    out.push(choose(unseen - k, matches - 1) / total);
  }
  return out;
}

/** Exact chance that the side receiving the NEXT card ends up with the first match. */
export function nextSideWinChance(unseen: number, matches = MATCHING_CARDS): number {
  checkDeck(unseen, matches);
  let favourable = 0;
  for (let k = 1; k <= unseen - matches + 1; k += 2) favourable += choose(unseen - k, matches - 1);
  return favourable / choose(unseen, matches);
}

/**
 * Each side's exact chance of winning when `cardsDealt` cards have been dealt from a fresh
 * single deck and none of them matched the joker yet. Uses only public information: how
 * many cards are still face down, and that all three matches are among them.
 */
export function winChances(cardsDealt = 0): Record<Side, number> {
  if (!Number.isInteger(cardsDealt) || cardsDealt < 0 || cardsDealt >= MAX_DEAL_LENGTH) {
    throw new RangeError(
      `Andar Bahar: after ${cardsDealt} cards without a match the deal would already be over.`,
    );
  }
  const next = sideForCard(cardsDealt);
  const p = nextSideWinChance(STOCK_SIZE - cardsDealt);
  return next === 'andar' ? { andar: p, bahar: 1 - p } : { andar: 1 - p, bahar: p };
}

/** Average winnings per unit bet on `side` when it wins with probability `chance`. */
export function expectedNet(side: Side, chance: number): number {
  return chance * PAYOUT[side] - (1 - chance);
}

/** The bet's average result before the deal: about −0.021 for Andar and −0.030 for Bahar. */
export function expectedNetBeforeDeal(side: Side): number {
  return expectedNet(side, winChances(0)[side]);
}

/**
 * The side whose bet loses the least on average before the deal. Andar's 0.9 payout does
 * not quite cancel its first-card advantage, so this is Andar (−2.1% against −3.0%).
 */
export function bestSide(): Side {
  return expectedNetBeforeDeal('andar') >= expectedNetBeforeDeal('bahar') ? 'andar' : 'bahar';
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** "Andar (inside)". */
export function sideLabel(side: Side): string {
  return `${SIDE_NAMES[side]} (${SIDE_MEANINGS[side]})`;
}

/** "Seven", "Ace", "Ten" — the rank as a beginner says it. */
export function rankName(card: CardCode): string {
  return RANK_NAMES[rankOf(card)];
}

const PLURAL_EXCEPTIONS: Partial<Record<Rank, string>> = { '6': 'Sixes' };

/** "Sevens", "Sixes". */
export function rankPlural(card: CardCode): string {
  const rank = rankOf(card);
  return PLURAL_EXCEPTIONS[rank] ?? `${RANK_NAMES[rank]}s`;
}

/** "a Seven", "an Ace", "an Eight". */
export function aRank(card: CardCode): string {
  const name = rankName(card);
  return `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`;
}

/** "51.5%" — one decimal place, the way the coach quotes chances. */
export function percent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

/** "You" for the learner's seat, "Player N" otherwise (the UI swaps in persona names). */
export function seatName(player: PlayerId): string {
  return player === LEARNER ? 'You' : `Player ${player}`;
}

/** Present-tense verb agreeing with seatName: "You bet" / "Player 1 bets". */
export function verbFor(player: PlayerId, base: string, third: string): string {
  return player === LEARNER ? base : third;
}

/** "1 card", "12 cards". */
export function cardsWord(n: number): string {
  return `${n} card${n === 1 ? '' : 's'}`;
}
