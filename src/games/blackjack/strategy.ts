/**
 * Blackjack basic strategy for exactly the rules we teach: 6-deck shoe, dealer stands on
 * all 17s (S17), dealer peeks for Blackjack, double on any two cards including after a
 * split (DAS), one split only, no surrender.
 *
 * Used by the coach (suggestion + "why") and by the 'normal' bot for seat 0 in simulations.
 * It only looks at information the learner can see: their own cards and the dealer's
 * upcard. (The peek is implicit — if the round is still going, the dealer has no Blackjack,
 * and the chart below is the one computed for that situation.)
 */
import { type CardCode } from '@/games/core/cards';
import { cardPoints, handValue, isPair, upcardNumber, upcardPhrase } from './hand';

export type StrategyAction = 'hit' | 'stand' | 'double' | 'split';

/**
 * One chart cell:
 *  H = hit, S = stand, D = double (hit if doubling is not allowed),
 *  B = double (stand if doubling is not allowed), P = split.
 */
export type ChartCell = 'H' | 'S' | 'D' | 'B' | 'P';

/** What the learner is allowed to do right now (the engine fills this in). */
export interface StrategyOptions {
  /** First two cards of the hand, not split Aces, and the wallet covers another bet. */
  canDouble: boolean;
  /** An unsplit pair and the wallet covers another bet. */
  canSplit: boolean;
}

export interface StrategyAdvice {
  /** The move to make now, always one of the allowed actions. */
  action: StrategyAction;
  /** The unrestricted chart entry (differs from `action` when doubling/splitting isn't possible). */
  cell: ChartCell;
  /** Plain-language reasoning for a beginner. */
  why: string;
}

// Columns are the dealer's upcard: 2 3 4 5 6 7 8 9 10 A.
const HARD: Readonly<Record<number, string>> = {
  9: 'HDDDDHHHHH',
  10: 'DDDDDDDDHH',
  11: 'DDDDDDDDDH',
  12: 'HHSSSHHHHH',
  13: 'SSSSSHHHHH',
  14: 'SSSSSHHHHH',
  15: 'SSSSSHHHHH',
  16: 'SSSSSHHHHH',
};
// Soft totals (an Ace counted as 11). Soft 12 only happens with an unsplit A-A.
const SOFT: Readonly<Record<number, string>> = {
  12: 'HHHHHHHHHH',
  13: 'HHHDDHHHHH',
  14: 'HHHDDHHHHH',
  15: 'HHDDDHHHHH',
  16: 'HHDDDHHHHH',
  17: 'HDDDDHHHHH',
  18: 'SBBBBSSHHH',
};
// Pairs, keyed by the point value of one card (Ace = 1). Y = split, N = play as a total.
const PAIRS: Readonly<Record<number, string>> = {
  1: 'YYYYYYYYYY',
  2: 'YYYYYYNNNN',
  3: 'YYYYYYNNNN',
  4: 'NNNYYNNNNN',
  5: 'NNNNNNNNNN',
  6: 'YYYYYNNNNN',
  7: 'YYYYYYNNNN',
  8: 'YYYYYYYYYY',
  9: 'YYYYYNYYNN',
  10: 'NNNNNNNNNN',
};

function column(upcard: CardCode): number {
  return upcardNumber(upcard) - 2;
}

/** True when the chart says to split this pair against this upcard. */
export function shouldSplit(pairCardPoints: number, upcard: CardCode): boolean {
  return PAIRS[pairCardPoints]?.[column(upcard)] === 'Y';
}

/** The chart entry for a hand, ignoring whether doubling is currently allowed. */
export function chartCell(
  cards: readonly CardCode[],
  upcard: CardCode,
  canSplit: boolean,
): ChartCell {
  const first = cards[0];
  if (canSplit && first !== undefined && isPair(cards) && shouldSplit(cardPoints(first), upcard)) {
    return 'P';
  }
  const { total, soft } = handValue(cards);
  const col = column(upcard);
  if (soft) {
    if (total >= 19) return 'S';
    return (SOFT[total]?.[col] ?? 'H') as ChartCell;
  }
  if (total >= 17) return 'S';
  if (total <= 8) return 'H';
  return (HARD[total]?.[col] ?? 'H') as ChartCell;
}

/** Basic-strategy move for a hand, respecting what is allowed right now. */
export function basicStrategy(
  cards: readonly CardCode[],
  upcard: CardCode,
  opts: StrategyOptions,
): StrategyAction {
  return resolve(chartCell(cards, upcard, opts.canSplit), opts);
}

function resolve(cell: ChartCell, opts: StrategyOptions): StrategyAction {
  switch (cell) {
    case 'P':
      return 'split';
    case 'D':
      return opts.canDouble ? 'double' : 'hit';
    case 'B':
      return opts.canDouble ? 'double' : 'stand';
    case 'S':
      return 'stand';
    case 'H':
      return 'hit';
  }
}

// ---------------------------------------------------------------------------
// Plain-language explanations
// ---------------------------------------------------------------------------

/** How often the dealer busts from each upcard (6 decks, S17, after the peek), in words. */
function bustOdds(up: number): string {
  if (up === 2) return 'about 1 time in 3';
  if (up === 3) return 'a bit more than 1 time in 3';
  if (up <= 6) return 'about 4 times in 10';
  if (up <= 10) return 'only about 1 time in 4';
  return 'only about 1 time in 6';
}

function strength(up: number): string {
  if (up <= 3) return 'a fairly weak card';
  if (up <= 6) return 'a weak card';
  if (up === 11) return 'the strongest card';
  return 'a strong card';
}

/** "a 6" → "6", "an Ace" → "Ace" (for "Dealers bust a lot from 6"). */
function upcardShort(up: number): string {
  return up === 11 ? 'an Ace' : String(up);
}

function cardWord(points: number): string {
  if (points === 1) return 'Aces';
  if (points === 10) return '10s';
  return `${points}s`;
}

function splitWhy(points: number, upcard: CardCode): string {
  const up = upcardNumber(upcard);
  const upText = upcardPhrase(upcard);
  if (points === 1) {
    return (
      'Always split Aces. Together they are only a soft 12, but apart each Ace starts a new ' +
      'hand worth 11 — and any 10, J, Q or K turns it into 21. (Split Aces get one card each.)'
    );
  }
  if (points === 8) {
    return (
      'Always split 8s. Two 8s make 16, the worst total in Blackjack. Split them and each 8 ' +
      'gets a fresh start.'
    );
  }
  if (points === 9) {
    if (up <= 6) {
      return (
        `The dealer shows ${upText} — ${strength(up)} that busts ${bustOdds(up)}. 18 is good, ` +
        'but splitting puts more money out while the dealer is weak, and each 9 can grow into 19.'
      );
    }
    return (
      `A dealer ${up} often finishes on ${up + 10}, which ${up === 8 ? 'only ties' : 'beats'} ` +
      'your 18. Split, and each 9 gets a fresh chance to beat it.'
    );
  }
  if (up === 7) {
    // 2s, 3s and 7s are split against a 7 to lose less, not because the 7 is weak.
    const together =
      points === 7 ? 'a weak 14, which usually loses to a dealer 7' : `just ${points * 2}`;
    return (
      `Your two ${cardWord(points)} make ${together}. Split them: a dealer 7 often stops on ` +
      `just 17, and each ${points} gets a fresh start that can beat it.`
    );
  }
  return (
    `Your two ${cardWord(points)} make a weak ${points * 2}. The dealer shows ${upText} — ` +
    `${strength(up)} that busts ${bustOdds(up)} — so split and play two hands while the dealer ` +
    'is likely to struggle.'
  );
}

function hardWhy(
  total: number,
  action: StrategyAction,
  upcard: CardCode,
  wantedDouble: boolean,
): string {
  const up = upcardNumber(upcard);
  const upText = upcardPhrase(upcard);
  if (total >= 21) return 'You have 21 — you can’t do better. Stand.';
  if (total >= 17) {
    const busting =
      total === 20
        ? 'every card except an Ace would bust you'
        : `any card higher than ${upcardPhrase(cardFor(21 - total))} would bust you`;
    return `You have ${total}. Hitting is too risky: ${busting}. Stand and make the dealer beat you.`;
  }
  if (total >= 12) {
    if (action === 'stand') {
      const from = total === 12 || up >= 4 ? '12' : '13';
      return (
        `Dealer shows ${upText} — ${strength(up)}. Dealers bust ${up >= 4 ? 'a lot' : bustOdds(up)} ` +
        `from ${upcardShort(up)}, so stand on ${from}+ and let them bust.`
      );
    }
    if (up <= 3) {
      return (
        `With 12, only a 10-value card can bust you, and a dealer ${up} isn’t weak enough to sit ` +
        'back on. Take a card.'
      );
    }
    return (
      `Dealer shows ${upText} — ${strength(up)}. The dealer will usually finish with 17 or more, ` +
      `so your ${total} would probably lose if you stand. Take a card and try to improve` +
      (total >= 15 ? ' — you might bust, but standing loses even more often.' : '.')
    );
  }
  // 11 or less: no single card can bust the hand.
  if (action === 'double') {
    if (total === 11) {
      return (
        '11 is the best total to double on: any 10, J, Q or K gives you 21. Double your bet ' +
        `against the dealer’s ${up}.`
      );
    }
    if (total === 10) {
      return (
        '10 is a great total to double on: 10-value cards are the most common, and any of them ' +
        `gives you 20. You’re ahead of the dealer’s ${up}, so double your bet.`
      );
    }
    return (
      `9 is worth doubling against ${upText}: a 10-value card gives you 19, and the dealer ` +
      `busts ${bustOdds(up)} from ${upcardShort(up)}.`
    );
  }
  if (wantedDouble) {
    return (
      `With ${total}, no card can bust you, so take a card. Against the dealer’s ${up} this ` +
      'would be a great hand to double down on, but you can’t double right now.'
    );
  }
  if (total >= 9) {
    if (up < 7) {
      // Only 9 against a 2 lands here: 10 and 11 are doubled against every card below 7.
      return (
        `With ${total}, no card can bust you, so take a card. Don’t double, though: ${total} is ` +
        `only worth doubling against a dealer 3 to 6, and a ${up} busts a little less often.`
      );
    }
    return (
      `With ${total}, no card can bust you, so take a card. Doubling isn’t worth it here: the ` +
      `dealer’s ${up === 11 ? 'Ace' : String(up)} is too strong to risk a second bet.`
    );
  }
  return `You have only ${total}, so no card can bust you. Take a card.`;
}

function softWhy(
  total: number,
  action: StrategyAction,
  upcard: CardCode,
  wantedDouble: boolean,
): string {
  const up = upcardNumber(upcard);
  const upText = upcardPhrase(upcard);
  const cantDouble = wantedDouble
    ? ' Doubling down would be even better here, but you can’t double right now.'
    : '';
  if (total >= 19) return `Soft ${total} is already a strong hand. Stand.`;
  if (total === 18) {
    if (action === 'double') {
      return (
        `Soft 18 against ${upText} is a chance to win more. The dealer busts ${bustOdds(up)} ` +
        'from here, and your Ace can switch from 11 to 1 so one card can’t bust you — double down.'
      );
    }
    if (action === 'stand') {
      if (up <= 6) return `Soft 18 is a solid hand against a dealer ${up}. Stand.${cantDouble}`;
      return (
        `Soft 18 is a solid hand: a dealer ${up} often stops on ${up + 10}, which your 18 ` +
        `${up === 7 ? 'beats' : 'only ties'}. Stand.`
      );
    }
    return (
      `Soft 18 isn’t enough against ${upText}, which often ends on 19 or 20. Your Ace can ` +
      'switch from 11 to 1, so one more card can’t bust you — hit.'
    );
  }
  if (action === 'double') {
    return (
      `Soft ${total} can’t bust with one more card, because your Ace can switch from 11 to 1. ` +
      `The dealer shows ${upText} — ${strength(up)} — so double down and win more.`
    );
  }
  // A dealer who doesn't bust always finishes on 17 or more, so standing on 17 or less can
  // only win when the dealer busts.
  return (
    `Soft ${total} can’t bust with one more card, because your Ace can switch from 11 to 1 — ` +
    `and standing on ${total} only wins if the dealer busts. Take a card.${cantDouble}`
  );
}

/** A representative card for a point value (used to phrase "higher than a 4"). */
function cardFor(points: number): CardCode {
  if (points === 1) return 'AS';
  if (points === 10) return 'TS';
  return `${points}S` as CardCode;
}

/**
 * Basic-strategy move plus a beginner-friendly "why". `action` is always allowed under
 * `opts`; when the ideal play (double/split) isn't possible the text says so.
 */
export function strategyAdvice(
  cards: readonly CardCode[],
  upcard: CardCode,
  opts: StrategyOptions,
): StrategyAdvice {
  const first = cards[0];
  const pair = first !== undefined && isPair(cards);
  const pairPoints = first !== undefined ? cardPoints(first) : 0;
  const cell = chartCell(cards, upcard, opts.canSplit);
  const action = resolve(cell, opts);
  if (cell === 'P') return { action, cell, why: splitWhy(pairPoints, upcard) };

  const { total, soft } = handValue(cards);
  const wantedDouble = (cell === 'D' || cell === 'B') && !opts.canDouble;
  let why = soft
    ? softWhy(total, action, upcard, wantedDouble)
    : hardWhy(total, action, upcard, wantedDouble);
  if (pair && opts.canSplit) {
    // A pair the chart says to keep together: say so first.
    if (pairPoints === 10) {
      why =
        'Keep your 20! Two 10-value cards make one of the best hands — splitting would break ' +
        'up a likely winner. Stand.';
    } else if (pairPoints === 5) {
      why = `Never split 5s — together they make 10. ${why}`;
    } else {
      why =
        `Don’t split your ${cardWord(pairPoints)} against ${upcardPhrase(upcard)}; play them ` +
        `as ${soft ? 'soft ' : ''}${total}. ${why}`;
    }
  } else if (pair && shouldSplit(pairPoints, upcard)) {
    why =
      'Splitting would be ideal, but you can’t split right now, so play this as ' +
      `${soft ? 'soft ' : ''}${total}. ${why}`;
  }
  return { action, cell, why };
}
