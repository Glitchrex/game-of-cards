import { describe, expect, it } from 'vitest';
import { makeDeck, rankNumberAceHigh, suitOf, type CardCode } from '@/games/core/cards';
import { simulate } from '@/games/core/simulate';
import type { Difficulty, GameResult } from '@/games/core/types';
import { heartsEngine, type HeartsPassDirection, type HeartsState } from './engine';

const DECK = makeDeck();
const DECK_SORTED = [...DECK].sort().join(',');

/** Independent point value (deliberately not imported from the engine). */
const value = (c: CardCode) => (c === 'QS' ? 13 : suitOf(c) === 'H' ? 1 : 0);
const sumValue = (cards: readonly CardCode[]) => cards.reduce((a, c) => a + value(c), 0);

/** Every card is in exactly one place at every step. */
function checkConservation(s: HeartsState): void {
  const places: CardCode[] = [...s.hands.flat(), ...s.trick.map((p) => p.card), ...s.won.flat()];
  if (s.phase === 'pass') for (const p of s.passed) if (p) places.push(...p);
  if (places.length !== 52 || [...places].sort().join(',') !== DECK_SORTED) {
    throw new Error(`card conservation broken (${places.length} cards)`);
  }
  // Captured piles match the trick history exactly.
  const fromTricks: CardCode[][] = [[], [], [], []];
  for (const t of s.tricks) fromTricks[t.winner]!.push(...t.plays.map((p) => p.card));
  for (let seat = 0; seat < 4; seat++) {
    if ([...s.won[seat]!].sort().join() !== [...fromTricks[seat]!].sort().join()) {
      throw new Error(`won pile of seat ${seat} does not match its tricks`);
    }
    if (s.points[seat] !== sumValue(s.won[seat]!)) {
      throw new Error(`points of seat ${seat} do not match captured cards`);
    }
  }
  // Point conservation: 26 penalty points in hands, in transit, on the table or captured.
  const pending = s.phase === 'pass' ? s.passed.flatMap((p) => p ?? []) : [];
  const total =
    s.points.reduce((a, b) => a + b, 0) +
    sumValue(s.hands.flat()) +
    sumValue(s.trick.map((p) => p.card)) +
    sumValue(pending);
  if (total !== 26) throw new Error(`point conservation broken: ${total}`);
}

function checkStructure(s: HeartsState): void {
  const completed = s.tricks.length;
  if (s.phase === 'pass') {
    if (completed !== 0 || s.trick.length !== 0) throw new Error('play happened during passing');
    s.hands.forEach((h, seat) => {
      const expected = s.passed[seat] ? 10 : 13;
      if (h.length !== expected) throw new Error(`seat ${seat} holds ${h.length} while passing`);
    });
    if (s.passed.some((p, seat) => (p !== null) !== seat < s.turn)) {
      throw new Error('passes are not made in seat order');
    }
    return;
  }
  // Hand sizes follow from the number of tricks played.
  s.hands.forEach((h, seat) => {
    const inTrick = s.trick.some((p) => p.seat === seat) ? 1 : 0;
    if (h.length !== 13 - completed - inTrick)
      throw new Error(`seat ${seat} has a wrong hand size`);
  });
  if (s.phase === 'play' && s.turn !== (s.leader + s.trick.length) % 4) {
    throw new Error('turn does not follow the trick order');
  }
  // Every completed trick: 4 seats clockwise from the leader, correct winner and points.
  let leader = s.tricks[0]?.leader;
  for (const [i, t] of s.tricks.entries()) {
    if (t.leader !== leader) throw new Error(`trick ${i + 1} led by the wrong seat`);
    if (i === 0 && t.plays[0]?.card !== '2C') throw new Error('first trick not led with 2♣');
    t.plays.forEach((p, k) => {
      if (p.seat !== (t.leader + k) % 4) throw new Error(`trick ${i + 1} out of order`);
    });
    const led = suitOf(t.plays[0]!.card);
    let best = t.plays[0]!;
    for (const p of t.plays) {
      if (suitOf(p.card) === led && rankNumberAceHigh(p.card) > rankNumberAceHigh(best.card)) {
        best = p;
      }
    }
    if (t.winner !== best.seat) throw new Error(`trick ${i + 1} has the wrong winner`);
    if (t.points !== sumValue(t.plays.map((p) => p.card))) {
      throw new Error(`trick ${i + 1} has wrong points`);
    }
    leader = t.winner;
  }
  const heartSeen = [...s.tricks.flatMap((t) => t.plays), ...s.trick].some(
    (p) => suitOf(p.card) === 'H',
  );
  if (heartSeen !== s.heartsBroken) throw new Error('heartsBroken flag is wrong');
}

/**
 * Re-check the rules from the public history alone, at the end of a hand:
 *  - a player who failed to follow suit never plays that suit again;
 *  - a Heart led before Hearts were broken means the leader held only Hearts;
 *  - a point card on the first trick means that player held only point cards.
 */
function checkHistoryLegality(s: HeartsState): void {
  const plays = s.tricks.map((t) => t.plays);
  const laterPlays = (seat: number, fromTrick: number) =>
    plays
      .slice(fromTrick)
      .flat()
      .filter((p) => p.seat === seat)
      .map((p) => p.card);
  let broken = false;
  plays.forEach((trick, i) => {
    const led = suitOf(trick[0]!.card);
    if (led === 'H' && !broken && laterPlays(trick[0]!.seat, i).some((c) => suitOf(c) !== 'H')) {
      throw new Error(`trick ${i + 1}: Hearts led before broken while holding other suits`);
    }
    for (const p of trick.slice(1)) {
      if (suitOf(p.card) !== led && laterPlays(p.seat, i + 1).some((c) => suitOf(c) === led)) {
        throw new Error(`trick ${i + 1}: seat ${p.seat} revoked (did not follow ${led})`);
      }
      if (i === 0 && value(p.card) > 0 && laterPlays(p.seat, 1).some((c) => value(c) === 0)) {
        throw new Error(
          `seat ${p.seat} played points on the first trick while holding a safe card`,
        );
      }
    }
    if (trick.some((p) => suitOf(p.card) === 'H')) broken = true;
  });
}

/** Score the finished hand from the trick history only, then compare with result(). */
function checkResult(s: HeartsState, r: GameResult): void {
  const raw = [0, 0, 0, 0];
  for (const t of s.tricks) raw[t.winner]! += sumValue(t.plays.map((p) => p.card));
  if (raw.reduce((a, b) => a + b, 0) !== 26) throw new Error('raw points do not total 26');
  const shooter = raw.indexOf(26);
  const scores = shooter >= 0 ? raw.map((_, i) => (i === shooter ? 0 : 26)) : raw;
  const best = Math.min(...scores);
  const winners = [0, 1, 2, 3].filter((i) => scores[i] === best);
  const payout = (seat: number) =>
    winners.includes(seat) ? (4 - winners.length) / winners.length : -1;
  expect(r.scores).toEqual(scores);
  expect(r.winners).toEqual(winners);
  expect(r.humanOutcome).toBe(winners.includes(0) ? 'win' : 'loss');
  expect(r.humanNetUnits).toBeCloseTo(payout(0), 12);
  // Chip conservation: the pot is zero-sum across the four seats.
  expect([0, 1, 2, 3].reduce((a, seat) => a + payout(seat), 0)).toBeCloseTo(0, 12);
  expect(r.humanNetUnits).toBeGreaterThanOrEqual(-1);
  expect(r.humanNetUnits).toBeLessThanOrEqual(3);
  expect(scores.reduce((a, b) => a + b, 0)).toBe(shooter >= 0 ? 78 : 26);
  // Flags agree with what happened.
  const won = winners.includes(0);
  const tookQueen = s.tricks.some((t) => t.winner === 0 && t.plays.some((p) => p.card === 'QS'));
  expect(r.flags.perfect).toBe(scores[0] === 0);
  expect(r.flags.bigPot).toBe(won && winners.length === 1);
  expect(r.flags.comeback).toBe(won && raw[0]! >= 13);
  expect(r.flags.bust).toBe(!won && tookQueen);
  expect(r.flags.folded).toBe(false);
  expect(r.flags.tags?.includes('shootTheMoon')).toBe(shooter === 0);
  expect(r.flags.tags?.includes('opponentShotMoon')).toBe(shooter > 0);
  expect(r.summary.length).toBeGreaterThan(20);
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
    name: 'easy learner vs normal bots',
    difficulty: (s) => (s === 0 ? 'easy' : 'normal'),
    seedBase: 30_001,
  },
];
const GAMES_PER_BATCH = 300;

const directionFor = (seed: number): HeartsPassDirection =>
  (['left', 'left', 'left', 'right', 'across', 'hold'] as const)[seed % 6]!;

describe('hearts simulation', () => {
  it(`plays ${BATCHES.length * GAMES_PER_BATCH} bot games without breaking any rule`, () => {
    let games = 0;
    let moves = 0;
    let moons = 0;
    let ties = 0;
    const outcomes = { win: 0, loss: 0, push: 0 };
    for (const batch of BATCHES) {
      const summary = simulate(heartsEngine, {
        games: GAMES_PER_BATCH,
        seedBase: batch.seedBase,
        config: (seed) => ({ players: 4, options: { passDirection: directionFor(seed) } }),
        difficulty: batch.difficulty,
        maxMoves: 60,
        invariant: (s) => {
          checkConservation(s);
          checkStructure(s);
        },
        onGameEnd: (s, r) => {
          expect(s.tricks).toHaveLength(13);
          checkHistoryLegality(s);
          checkResult(s, r);
          if (s.points.includes(26)) moons++;
          if (r.winners.length > 1) ties++;
        },
      });
      expect(summary.games).toBe(GAMES_PER_BATCH);
      expect(summary.maxMovesInAGame).toBeLessThanOrEqual(56);
      games += summary.games;
      moves += summary.totalMoves;
      outcomes.win += summary.outcomes.win;
      outcomes.loss += summary.outcomes.loss;
      outcomes.push += summary.outcomes.push;
    }
    expect(games).toBe(1200);
    expect(outcomes.push).toBe(0); // Hearts always has a lowest score
    expect(moons).toBeGreaterThan(0);
    expect(ties).toBeGreaterThan(0);
    console.info(
      `hearts sim: ${games} games, avg ${(moves / games).toFixed(1)} moves, ` +
        `outcomes ${JSON.stringify(outcomes)}, moons ${moons}, shared wins ${ties}`,
    );
  }, 120_000);
});
