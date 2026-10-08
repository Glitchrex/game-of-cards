/**
 * Seeded bot-vs-dealer simulations. Besides the generic contract checks in simulate()
 * (legal bot moves, no input mutation, termination…), every step and every final state is
 * checked against Blackjack-specific invariants, and results are re-derived by an
 * independent implementation of the rules written only for this test.
 */
import { describe, expect, it } from 'vitest';
import { makeDeck, type CardCode } from '@/games/core/cards';
import { simulate, type SimulationSummary } from '@/games/core/simulate';
import type { GameConfig, GameResult } from '@/games/core/types';
import { blackjackEngine, DEALER, LEARNER, type BlackjackState } from './engine';

// ---------------------------------------------------------------------------
// Independent reference rules (deliberately not using ./hand or ./engine helpers).
// ---------------------------------------------------------------------------

function refTotal(cards: readonly CardCode[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const r = c[0]!;
    if (r === 'A') {
      aces++;
      total += 11;
    } else if ('TJQK'.includes(r)) total += 10;
    else total += Number(r);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

const refNatural = (cards: readonly CardCode[]) => cards.length === 2 && refTotal(cards) === 21;

function refSettle(s: BlackjackState): { net: number; playerBJ: boolean; dealerBJ: boolean } {
  const playerBJ = s.hands.length === 1 && refNatural(s.hands[0]!.cards);
  const dealerBJ = refNatural(s.dealer);
  if (playerBJ) return { net: dealerBJ ? 0 : 1.5, playerBJ, dealerBJ };
  if (dealerBJ) return { net: -s.hands.reduce((n, h) => n + h.bet, 0), playerBJ, dealerBJ };
  const dealer = refTotal(s.dealer);
  let net = 0;
  for (const h of s.hands) {
    const t = refTotal(h.cards);
    if (t > 21) net -= h.bet;
    else if (dealer > 21 || t > dealer) net += h.bet;
    else if (t < dealer) net -= h.bet;
  }
  return { net, playerBJ, dealerBJ };
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

const fullShoeCounts = new Map<number, Map<CardCode, number>>();
function expectedCounts(decks: number): Map<CardCode, number> {
  let m = fullShoeCounts.get(decks);
  if (!m) {
    m = new Map();
    for (const c of makeDeck({ copies: decks })) m.set(c, (m.get(c) ?? 0) + 1);
    fullShoeCounts.set(decks, m);
  }
  return m;
}

function fail(step: number, message: string, s: BlackjackState): never {
  throw new Error(`[step ${step}] ${message}\n${JSON.stringify({ ...s, shoe: s.shoe.length })}`);
}

/** Checked after every move. */
function stepInvariant(s: BlackjackState, step: number): void {
  // Card conservation: every card of the shoe is in exactly one place.
  const expected = expectedCounts(s.decks);
  const seen = new Map<CardCode, number>();
  for (const c of [...s.shoe, ...s.dealer, ...s.hands.flatMap((h) => h.cards)]) {
    seen.set(c, (seen.get(c) ?? 0) + 1);
  }
  if (seen.size !== expected.size) fail(step, 'card kinds changed', s);
  for (const [c, n] of expected) if (seen.get(c) !== n) fail(step, `card ${c} count changed`, s);

  // Bets: one unit, +1 per double/split, within what the wallet allows.
  const totalBet = s.hands.reduce((n, h) => n + h.bet, 0);
  if (s.extraUnits !== totalBet - 1) fail(step, 'extraUnits does not match the bets', s);
  if (s.affordableUnits !== null && s.extraUnits > s.affordableUnits) {
    fail(step, 'committed more than the wallet can cover', s);
  }
  for (const h of s.hands) {
    if (h.bet !== (h.doubled ? 2 : 1)) fail(step, 'hand bet must be 1, or 2 when doubled', s);
    if (h.doubled && h.cards.length !== 3) fail(step, 'a doubled hand has exactly 3 cards', s);
    if (h.doubled && !h.done) fail(step, 'a doubled hand is finished', s);
    if (h.fromSplit && h.cards[0]![0] === 'A' && h.cards.length !== 2) {
      fail(step, 'split Aces get exactly one card each', s);
    }
    if (h.cards.length < 2) fail(step, 'every hand has at least two cards', s);
  }
  if (s.hands.length > 2) fail(step, 'more than one split', s);
  if (s.hands.length === 2 && !s.hands.every((h) => h.fromSplit)) fail(step, 'split flags', s);

  // Phases.
  if (s.phase === 'player') {
    const active = s.hands[s.activeHand];
    if (!active || active.done) fail(step, 'the active hand must be unfinished', s);
    if (refTotal(active.cards) >= 21) fail(step, 'a hand on 21+ must not be waiting for a move', s);
    if (s.hands.slice(0, s.activeHand).some((h) => !h.done)) fail(step, 'skipped a hand', s);
    if (s.holeRevealed || s.dealer.length !== 2)
      fail(step, 'dealer acted during the learner turn', s);
    if (blackjackEngine.currentPlayer(s) !== LEARNER) fail(step, 'currentPlayer', s);
  } else {
    if (s.hands.some((h) => !h.done)) fail(step, 'dealer acting while a hand is unfinished', s);
    if (s.phase === 'dealer' && blackjackEngine.currentPlayer(s) !== DEALER) {
      fail(step, 'currentPlayer', s);
    }
  }
  if (!s.holeRevealed && s.dealer.length !== 2) fail(step, 'dealer drew before revealing', s);
  // The dealer only ever drew while on 16 or less.
  for (let i = 3; i <= s.dealer.length; i++) {
    if (refTotal(s.dealer.slice(0, i - 1)) >= 17) fail(step, 'dealer hit on 17+', s);
  }
}

interface Tally {
  learnerBlackjacks: number;
  dealerBlackjacks: number;
  dealerBusts: number;
  splits: number;
  doubles: number;
}

function tallyGame(s: BlackjackState, tally: Tally): void {
  if (s.hands.length === 1 && refNatural(s.hands[0]!.cards)) tally.learnerBlackjacks++;
  if (refNatural(s.dealer)) tally.dealerBlackjacks++;
  if (refTotal(s.dealer) > 21) tally.dealerBusts++;
  if (s.hands.length === 2) tally.splits++;
  tally.doubles += s.hands.filter((h) => h.doubled).length;
}

function makeOnGameEnd(tally: Tally) {
  return (s: BlackjackState, r: GameResult, seed: number): void => {
    const where = `[seed ${seed}]`;
    const ref = refSettle(s);
    // Scoring re-derived independently.
    expect(r.humanNetUnits, `${where} net`).toBe(ref.net);
    const outcome = ref.net > 0 ? 'win' : ref.net < 0 ? 'loss' : 'push';
    expect(r.humanOutcome, `${where} outcome`).toBe(outcome);
    expect(r.winners).toEqual(outcome === 'win' ? [LEARNER] : outcome === 'loss' ? [DEALER] : []);
    // Payout bounds: never lose more than was bet (≤ 1 + affordable), never win more than
    // the bets (or 1.5 for a natural).
    const bet = 1 + s.extraUnits;
    expect(r.humanNetUnits).toBeGreaterThanOrEqual(-bet);
    expect(r.humanNetUnits).toBeLessThanOrEqual(Math.max(1.5, bet));
    expect(r.humanNetUnits).toBeGreaterThanOrEqual(-4);
    expect(r.humanNetUnits).toBeLessThanOrEqual(4);
    if (s.affordableUnits !== null) {
      expect(r.humanNetUnits).toBeGreaterThanOrEqual(-(1 + s.affordableUnits));
    }
    // Chip conservation: what the learner wins the dealer loses, unit for unit.
    const dealerNet = -r.humanNetUnits;
    expect(dealerNet + r.humanNetUnits).toBe(0);

    // The dealer's behaviour.
    const alive = s.hands.some((h) => refTotal(h.cards) <= 21);
    const dealerPlayed = !ref.playerBJ && !ref.dealerBJ && alive;
    expect(s.holeRevealed).toBe(true);
    if (dealerPlayed) expect(refTotal(s.dealer)).toBeGreaterThanOrEqual(17);
    else expect(s.dealer).toHaveLength(2);

    // Flags that can be re-derived simply.
    expect(r.flags.perfect).toBe(ref.playerBJ);
    expect(r.flags.tags?.includes('blackjack') ?? false).toBe(ref.playerBJ);
    expect(r.flags.bust).toBe(s.hands.every((h) => refTotal(h.cards) > 21));
    expect(r.flags.bigPot).toBe(Math.abs(ref.net) >= 2);
    expect(r.flags.folded).toBe(false);
    if (r.flags.comeback || r.flags.luckyLastCard) expect(r.humanOutcome).toBe('win');
    if (r.flags.closeFinish) expect(refTotal(s.dealer)).toBeLessThanOrEqual(21);
    expect(r.scores).toHaveLength(2);
    expect(r.scores?.[1]).toBe(refTotal(s.dealer));
    expect(r.summary.length).toBeGreaterThan(10);

    tallyGame(s, tally);
  };
}

const newTally = (): Tally => ({
  learnerBlackjacks: 0,
  dealerBlackjacks: 0,
  dealerBusts: 0,
  splits: 0,
  doubles: 0,
});

/** Vary the shoe size and the wallet across seeds. */
function variedConfig(seed: number): GameConfig {
  const decks = [6, 6, 6, 1, 2, 8][seed % 6];
  const affordable = [undefined, 0, 1, 2, 3, undefined, 1][seed % 7];
  return { players: 2, affordableUnits: affordable, options: { decks } };
}

function report(label: string, sum: SimulationSummary, tally: Tally): void {
  console.info(
    `[blackjack sim] ${label}: ${sum.games} games, avg ${(sum.totalMoves / sum.games).toFixed(2)} ` +
      `moves (max ${sum.maxMovesInAGame}), win/loss/push ${sum.outcomes.win}/${sum.outcomes.loss}/` +
      `${sum.outcomes.push}, net/round ${(sum.netUnits / sum.games).toFixed(4)}, ` +
      `learner BJ ${tally.learnerBlackjacks}, dealer BJ ${tally.dealerBlackjacks}, dealer busts ` +
      `${tally.dealerBusts}, splits ${tally.splits}, doubles ${tally.doubles}`,
  );
}

describe('blackjack simulations', () => {
  it('2,000 rounds with the basic-strategy bot: varied shoes and wallets, every invariant holds', () => {
    const tally = newTally();
    const sum = simulate(blackjackEngine, {
      games: 2000,
      seedBase: 1,
      config: variedConfig,
      difficulty: () => 'normal',
      maxMoves: 40,
      freezeEvery: 3,
      invariant: stepInvariant,
      onGameEnd: makeOnGameEnd(tally),
    });
    report('normal', sum, tally);
    expect(sum.games).toBe(2000);
    expect(sum.outcomes.win + sum.outcomes.loss + sum.outcomes.push).toBe(2000);
    // The strategy really uses its options.
    expect(tally.splits).toBeGreaterThan(20);
    expect(tally.doubles).toBeGreaterThan(100);
  }, 60_000);

  it('1,000 rounds with the easy bot ("hit below 15"): never doubles or splits', () => {
    const tally = newTally();
    const sum = simulate(blackjackEngine, {
      games: 1000,
      seedBase: 50_000,
      config: variedConfig,
      difficulty: () => 'easy',
      maxMoves: 40,
      invariant: stepInvariant,
      onGameEnd: makeOnGameEnd(tally),
    });
    report('easy', sum, tally);
    expect(sum.games).toBe(1000);
    expect(tally.splits).toBe(0);
    expect(tally.doubles).toBe(0);
  }, 60_000);

  it('statistical sanity: basic strategy loses only about half a percent per round', () => {
    // 6 decks, S17, DAS, one split, no surrender, 3:2 Blackjack: the house edge against
    // basic strategy is about 0.4–0.6%, so the mean net per round should sit near −0.005.
    // With 50,000 rounds the standard error is ≈ 0.005, so the band from the engine notes,
    // [−0.03, +0.01], sits about five standard errors below and three above. It catches gross
    // strategy or settlement bugs (a sign error, a bot that always stands or always hits…).
    // Smaller payout errors — a 1:1 natural moves the mean by only ≈ 0.023, a
    // 6:5 one by ≈ 0.014, H17 by ≈ 0.002 — are caught exactly instead: every round's net is
    // re-scored by the independent reference settlement above.
    const tally = newTally();
    const onGameEnd = makeOnGameEnd(tally);
    const sum = simulate(blackjackEngine, {
      games: 50_000,
      seedBase: 1_000_000,
      config: { players: 2 },
      difficulty: () => 'normal',
      maxMoves: 40,
      freezeEvery: 0,
      onGameEnd: (s, r, seed) => {
        // Every 10th game gets the full checks; the rest (for speed) scoring only.
        if (seed % 10 === 0) return onGameEnd(s, r, seed);
        if (r.humanNetUnits !== refSettle(s).net) throw new Error(`[seed ${seed}] wrong net`);
        tallyGame(s, tally);
      },
    });
    const mean = sum.netUnits / sum.games;
    report('edge (normal, 50k)', sum, tally);
    expect(mean).toBeGreaterThan(-0.03);
    expect(mean).toBeLessThan(0.01);

    // The easy bot must do clearly worse than basic strategy on the same deals.
    const easy = simulate(blackjackEngine, {
      games: 20_000,
      seedBase: 1_000_000,
      config: { players: 2 },
      difficulty: () => 'easy',
      maxMoves: 40,
      freezeEvery: 0,
    });
    const easyMean = easy.netUnits / easy.games;
    console.info(`[blackjack sim] edge (easy, 20k): net/round ${easyMean.toFixed(4)}`);
    expect(easyMean).toBeLessThan(mean - 0.01);
  }, 60_000);

  it('deals naturals at the textbook rate (≈ 4.7% of rounds with 6 decks)', () => {
    let naturals = 0;
    const games = 20_000;
    simulate(blackjackEngine, {
      games,
      seedBase: 2_000_000,
      config: { players: 2 },
      difficulty: () => 'normal',
      freezeEvery: 0,
      onGameEnd: (s) => {
        if (s.hands.length === 1 && refNatural(s.hands[0]!.cards)) naturals++;
      },
    });
    // 2 × (24/312) × (96/311) ≈ 4.75%; ±0.15% is one standard error, so allow ±0.6%.
    expect(naturals / games).toBeGreaterThan(0.0415);
    expect(naturals / games).toBeLessThan(0.0535);
  }, 60_000);
});
