import { describe, expect, it } from 'vitest';
import { makeDeck, rankNumberAceHigh, suitOf, type CardCode } from '@/games/core/cards';
import { simulate } from '@/games/core/simulate';
import type { Difficulty, GameResult } from '@/games/core/types';
import { spadesEngine, type SpadesState } from './engine';

const DECK_SORTED = [...makeDeck()].sort().join(',');

/** Independent trick winner (deliberately not imported from the engine). */
function trickWinner(plays: readonly { seat: number; card: CardCode }[]): number {
  const led = suitOf(plays[0]!.card);
  let best = plays[0]!;
  const value = (c: CardCode) =>
    (suitOf(c) === 'S' ? 200 : suitOf(c) === led ? 100 : 0) + rankNumberAceHigh(c);
  for (const p of plays) if (value(p.card) > value(best.card)) best = p;
  return best.seat;
}

/** Every card is in exactly one place at every step; counts follow the trick history. */
function checkConservation(s: SpadesState): void {
  const places: CardCode[] = [
    ...s.hands.flat(),
    ...s.trick.map((p) => p.card),
    ...s.tricks.flatMap((t) => t.plays.map((p) => p.card)),
  ];
  if (places.length !== 52 || [...places].sort().join(',') !== DECK_SORTED) {
    throw new Error(`card conservation broken (${places.length} cards)`);
  }
  const fromTricks = [0, 0, 0, 0];
  for (const t of s.tricks) fromTricks[t.winner]!++;
  if (fromTricks.join() !== s.tricksWon.join()) throw new Error('tricksWon ≠ trick history');
  // Trick conservation: every completed trick belongs to exactly one seat.
  if (s.tricksWon.reduce((a, b) => a + b, 0) !== s.tricks.length) {
    throw new Error('trick totals do not add up');
  }
}

function checkStructure(s: SpadesState): void {
  const first = (s.dealer + 1) % 4;
  const bidsMade = s.bids.filter((b) => b !== null).length;
  if (s.phase === 'bid') {
    if (s.tricks.length || s.trick.length) throw new Error('cards played during bidding');
    if (s.hands.some((h) => h.length !== 13)) throw new Error('hand size wrong while bidding');
    if (s.turn !== (first + bidsMade) % 4) throw new Error('bidding out of turn');
    // Bids are made clockwise from the dealer's left.
    for (let k = 0; k < 4; k++) {
      const seat = (first + k) % 4;
      if ((s.bids[seat] !== null) !== k < bidsMade) throw new Error('bids made out of order');
    }
    return;
  }
  if (bidsMade !== 4) throw new Error('play started before every seat bid');
  for (const b of s.bids) {
    if (!Number.isInteger(b) || b! < 0 || b! > 13) throw new Error(`invalid bid ${b}`);
  }
  const completed = s.tricks.length;
  s.hands.forEach((h, seat) => {
    const inTrick = s.trick.some((p) => p.seat === seat) ? 1 : 0;
    if (h.length !== 13 - completed - inTrick) throw new Error(`seat ${seat} hand size wrong`);
  });
  if (s.phase === 'play' && s.turn !== (s.leader + s.trick.length) % 4) {
    throw new Error('turn does not follow the trick order');
  }
  let leader = first;
  for (const [i, t] of s.tricks.entries()) {
    if (t.leader !== leader) throw new Error(`trick ${i + 1} led by the wrong seat`);
    t.plays.forEach((p, k) => {
      if (p.seat !== (t.leader + k) % 4) throw new Error(`trick ${i + 1} out of order`);
    });
    if (t.winner !== trickWinner(t.plays)) throw new Error(`trick ${i + 1} has the wrong winner`);
    leader = t.winner;
  }
  if (s.phase === 'play' && s.leader !== leader) throw new Error('wrong leader for this trick');
  // Broken = some Spade was played on a trick whose led suit was not Spades.
  const spadeOnOtherSuit = [...s.tricks.map((t) => t.plays), s.trick].some(
    (plays) =>
      plays.length > 0 &&
      suitOf(plays[0]!.card) !== 'S' &&
      plays.some((p) => suitOf(p.card) === 'S'),
  );
  if (spadeOnOtherSuit !== s.spadesBroken) throw new Error('spadesBroken flag is wrong');
}

/**
 * Re-check the play rules from the public history alone:
 *  - a player who failed to follow suit never plays that suit later (no revokes);
 *  - a Spade led before Spades were broken means the leader held nothing but Spades.
 */
function checkHistoryLegality(s: SpadesState): void {
  const plays = s.tricks.map((t) => t.plays);
  const laterPlays = (seat: number, fromTrick: number) =>
    plays
      .slice(fromTrick)
      .flat()
      .filter((p) => p.seat === seat)
      .map((p) => p.card);
  let broken = false;
  plays.forEach((trick, i) => {
    const lead = trick[0]!;
    const led = suitOf(lead.card);
    if (led === 'S' && !broken && laterPlays(lead.seat, i).some((c) => suitOf(c) !== 'S')) {
      throw new Error(`trick ${i + 1}: Spades led before broken while holding other suits`);
    }
    for (const p of trick.slice(1)) {
      if (suitOf(p.card) !== led && laterPlays(p.seat, i + 1).some((c) => suitOf(c) === led)) {
        throw new Error(`trick ${i + 1}: seat ${p.seat} revoked (did not follow ${led})`);
      }
    }
    if (led !== 'S' && trick.some((p) => suitOf(p.card) === 'S')) broken = true;
  });
}

interface TeamTally {
  total: number;
  contract: number;
  made: boolean;
  bags: number;
  nilMade: number;
  nilFailed: number;
}

/** Score one team from the final bids and trick history only. */
function tally(s: SpadesState, seats: readonly [number, number]): TeamTally {
  const won = [0, 0, 0, 0];
  for (const t of s.tricks) won[t.winner]!++;
  let contract = 0;
  let counted = 0;
  let nilTricks = 0;
  let nilMade = 0;
  let nilFailed = 0;
  for (const seat of seats) {
    const b = s.bids[seat]!;
    if (b === 0) {
      if (won[seat] === 0) nilMade++;
      else nilFailed++;
      nilTricks += won[seat]!;
    } else {
      contract += b;
      counted += won[seat]!;
    }
  }
  const made = counted >= contract;
  const bags = (made ? counted - contract : 0) + nilTricks;
  const total = (made ? 10 * contract : -10 * contract) + bags + 100 * nilMade - 100 * nilFailed;
  return { total, contract, made, bags, nilMade, nilFailed };
}

const stats = { nilBids: 0, nilsMade: 0, sets: 0, ties: 0, bigWins: 0, comebacks: 0, lucky: 0 };

function checkResult(s: SpadesState, r: GameResult): void {
  const us = tally(s, [0, 2]);
  const them = tally(s, [1, 3]);
  expect(r.scores).toEqual([us.total, them.total, us.total, them.total]);
  const outcome = us.total > them.total ? 'win' : us.total < them.total ? 'loss' : 'push';
  expect(r.humanOutcome).toBe(outcome);
  expect(r.winners).toEqual(outcome === 'win' ? [0, 2] : outcome === 'loss' ? [1, 3] : []);
  const net = outcome === 'win' ? 1 : outcome === 'loss' ? -1 : 0;
  expect(r.humanNetUnits).toBe(net);
  // Chip conservation: the bet is zero-sum between the two partnerships.
  const oppNet = them.total > us.total ? 1 : them.total < us.total ? -1 : 0;
  expect(net + oppNet).toBe(0);
  // Payout bounds: maxLossUnits 1, at most +1.
  expect(r.humanNetUnits).toBeGreaterThanOrEqual(-1);
  expect(r.humanNetUnits).toBeLessThanOrEqual(1);
  // Score bounds: −10×13 − 200 ≤ team score ≤ 130 + 200 + 13.
  for (const t of [us, them]) {
    expect(t.total).toBeGreaterThanOrEqual(-330);
    expect(t.total).toBeLessThanOrEqual(343);
  }
  // Flags agree with what happened.
  const margin = us.total - them.total;
  const won = margin > 0;
  const exact = us.contract > 0 && us.made && us.bags === 0;
  expect(r.flags.perfect).toBe(exact || us.nilMade > 0);
  expect(r.flags.tags?.includes('nil')).toBe(us.nilMade > 0);
  expect(r.flags.closeFinish).toBe(Math.abs(margin) <= 10);
  expect(r.flags.bigPot).toBe(won && margin >= 100);
  expect(r.flags.folded).toBe(false);
  const humanNilFailed = s.bids[0] === 0 && s.tricks.some((t) => t.winner === 0);
  expect(r.flags.bust).toBe(margin < 0 && ((us.contract > 0 && !us.made) || humanNilFailed));
  expect(r.flags.tags?.includes('set')).toBe(us.contract > 0 && !us.made);
  expect(r.flags.tags?.includes('setOpponents')).toBe(them.contract > 0 && !them.made);
  // Comeback: with ≤ 4 tricks left the team still needed ≥ 2 and more than half of them.
  let behind = false;
  for (let done = 9; done < 13; done++) {
    let counted = 0;
    for (const t of s.tricks.slice(0, done)) {
      if (t.winner % 2 === 0 && s.bids[t.winner] !== 0) counted++;
    }
    const need = us.contract - counted;
    if (need >= 2 && need * 2 > 13 - done) behind = true;
  }
  expect(r.flags.comeback).toBe(won && us.contract > 0 && us.made && behind);
  // Lucky last card: not winning on the first 12 tricks, winning after the 13th.
  const before = { ...s, tricks: s.tricks.slice(0, 12) };
  const winningBefore = tally(before, [0, 2]).total > tally(before, [1, 3]).total;
  expect(r.flags.luckyLastCard).toBe(won && !winningBefore);
  if (r.flags.luckyLastCard) {
    // The last trick went to our team — or broke an opponent's Nil.
    const last = s.tricks[12]!.winner;
    const brokeNil = s.bids[last] === 0 && s.tricks.filter((t) => t.winner === last).length === 1;
    expect(last % 2 === 0 || brokeNil).toBe(true);
  }
  expect(r.summary.length).toBeGreaterThan(30);
  expect(r.summary.endsWith('.')).toBe(true);

  stats.nilBids += s.bids.filter((b) => b === 0).length;
  stats.nilsMade += us.nilMade + them.nilMade;
  stats.sets += Number(us.contract > 0 && !us.made) + Number(them.contract > 0 && !them.made);
  stats.ties += Number(outcome === 'push');
  stats.bigWins += Number(r.flags.bigPot === true);
  stats.comebacks += Number(r.flags.comeback === true);
  stats.lucky += Number(r.flags.luckyLastCard === true);
}

interface Batch {
  name: string;
  difficulty: (seat: number) => Difficulty;
  seedBase: number;
}

const BATCHES: Batch[] = [
  {
    name: 'mixed (normal on even seats)',
    difficulty: (s) => (s % 2 === 0 ? 'normal' : 'easy'),
    seedBase: 1,
  },
  { name: 'all normal', difficulty: () => 'normal', seedBase: 10_001 },
  { name: 'all easy', difficulty: () => 'easy', seedBase: 20_001 },
  {
    name: 'easy learner team vs normal bots',
    difficulty: (s) => (s % 2 === 0 ? 'easy' : 'normal'),
    seedBase: 30_001,
  },
];
const GAMES_PER_BATCH = 300;

describe('spades simulation', () => {
  it(`plays ${BATCHES.length * GAMES_PER_BATCH} bot games without breaking any rule`, () => {
    let games = 0;
    let moves = 0;
    const outcomes = { win: 0, loss: 0, push: 0 };
    const perBatch: Record<string, { win: number; loss: number; push: number }> = {};
    for (const batch of BATCHES) {
      const summary = simulate(spadesEngine, {
        games: GAMES_PER_BATCH,
        seedBase: batch.seedBase,
        // Every third game fixes the dealer explicitly; the rest pick it from the seed.
        config: (seed) => ({ players: 4, options: seed % 3 === 0 ? { dealer: seed % 4 } : {} }),
        difficulty: batch.difficulty,
        maxMoves: 60,
        invariant: (s) => {
          checkConservation(s);
          checkStructure(s);
        },
        onGameEnd: (s, r) => {
          expect(s.tricks).toHaveLength(13);
          expect(s.hands.every((h) => h.length === 0)).toBe(true);
          checkHistoryLegality(s);
          checkResult(s, r);
        },
      });
      expect(summary.games).toBe(GAMES_PER_BATCH);
      expect(summary.maxMovesInAGame).toBe(56); // 4 bids + 52 cards, always
      games += summary.games;
      moves += summary.totalMoves;
      outcomes.win += summary.outcomes.win;
      outcomes.loss += summary.outcomes.loss;
      outcomes.push += summary.outcomes.push;
      perBatch[batch.name] = summary.outcomes;
    }
    expect(games).toBe(1200);
    expect(moves).toBe(1200 * 56);
    // The interesting situations really happen.
    expect(stats.nilBids).toBeGreaterThan(0);
    expect(stats.nilsMade).toBeGreaterThan(0);
    expect(stats.sets).toBeGreaterThan(0);
    expect(stats.bigWins).toBeGreaterThan(0);
    expect(stats.comebacks).toBeGreaterThan(0);
    expect(stats.lucky).toBeGreaterThan(0);
    // A normal partnership should beat an easy one most of the time.
    const mixed = perBatch['mixed (normal on even seats)']!;
    expect(mixed.win).toBeGreaterThan(mixed.loss);
    const reversed = perBatch['easy learner team vs normal bots']!;
    expect(reversed.loss).toBeGreaterThan(reversed.win);
    console.info(
      `spades sim: ${games} games, avg ${(moves / games).toFixed(1)} moves, ` +
        `outcomes ${JSON.stringify(outcomes)}, per batch ${JSON.stringify(perBatch)}, ` +
        `stats ${JSON.stringify(stats)}`,
    );
  }, 120_000);
});
