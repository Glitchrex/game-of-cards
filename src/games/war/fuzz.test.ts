/**
 * Fuzzing War from positions a normal deal rarely reaches: very uneven piles, decks rigged
 * so the face-up cards keep tying (long war chains, short piles, both players running out
 * together) and random battle caps. Every step is checked for crashes, stuck states,
 * non-termination, card loss or duplication, input mutation, hidden-card leaks in the
 * move log and illegal coach suggestions; every ending for an honest result.
 */
import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, rankOf, type CardCode } from '@/games/core/cards';
import { createRng, shuffle, type Rng } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { MAX_BATTLES_LIMIT, warEngine, type WarMove } from './engine';
import { stateWith } from './test-helpers';

const SORTED = makeDeck().slice().sort().join();

/** Piles of random, uneven sizes (1–51 cards for the learner). */
function unevenSplit(rng: Rng): [CardCode[], CardCode[]] {
  const deck = shuffle(makeDeck(), rng);
  const k = 1 + rng.int(51);
  return [deck.slice(0, k), deck.slice(k)];
}

/**
 * Player 1's pile copies the ranks of the learner's pile for its first `m` cards, so the
 * opening flip and every war's face-up cards keep tying (and so do the face-down ones).
 */
function mirrored(rng: Rng): [CardCode[], CardCode[]] {
  const deck = shuffle(makeDeck(), rng);
  const mine = deck.filter((c) => c[1] === 'S' || c[1] === 'H');
  const rest = deck.filter((c) => c[1] === 'D' || c[1] === 'C');
  const theirs: CardCode[] = [];
  const m = rng.int(27);
  for (const c of mine.slice(0, m)) {
    const j = rest.findIndex((x) => rankOf(x) === rankOf(c));
    if (j < 0) break;
    theirs.push(...rest.splice(j, 1));
  }
  return [mine, [...theirs, ...shuffle(rest, rng)]];
}

interface FuzzStats {
  games: number;
  moves: number;
  ends: Record<string, number>;
  outcomes: Record<string, number>;
  shortWars: number;
  longestChain: number;
}

function fuzzGame(seed: number, stats: FuzzStats): void {
  const rng = createRng(`war-fuzz-${seed}`);
  const kind = seed % 3;
  const piles =
    kind === 0
      ? unevenSplit(rng)
      : kind === 1
        ? mirrored(rng)
        : warEngine.setup({ players: 2 }, rng).piles;
  const maxBattles = 1 + rng.int(kind === 2 ? 120 : MAX_BATTLES_LIMIT);
  let state = stateWith(piles, { maxBattles });
  let steps = 0;
  const fail = (what: string) => {
    throw new Error(`[fuzz seed ${seed}, battle ${steps + 1}] ${what}`);
  };
  while (!warEngine.isOver(state)) {
    if (warEngine.currentPlayer(state) !== 0) fail('seat 0 must flip while the game runs');
    const legal = warEngine.legalMoves(state, 0);
    if (legal.length !== 1 || legal[0]?.type !== 'flip') fail('flip must be the only move');
    if (warEngine.legalMoves(state, 1).length !== 0) fail('the bot seat has a move');
    const move = warEngine.botMove(state, 0, rng.int(2) === 0 ? 'easy' : 'normal', rng);
    if (!warEngine.checkMove(state, 0, move).ok) fail('checkMove rejected the bot move');
    const advice = warEngine.coach(state, 0);
    if (!warEngine.checkMove(state, 0, advice.suggestion as WarMove).ok) {
      fail('the coach suggested an illegal move');
    }
    const text = warEngine.describeMove(state, 0, move);
    if (/undefined|NaN|null|\[object/.test(`${text} ${advice.situation} ${advice.why ?? ''}`)) {
      fail(`broken wording: ${text}`);
    }
    const frozen = steps % 3 === 0;
    const before = frozen ? JSON.stringify(state) : '';
    if (frozen) deepFreeze(state);
    const next = warEngine.applyMove(state, move);
    if (frozen && JSON.stringify(state) !== before) fail('applyMove mutated its input');
    const battle = next.lastBattle;
    if (!battle) return fail('no battle recorded');
    for (const round of battle.rounds) {
      for (const hidden of [...round.down[0], ...round.down[1]]) {
        if (text.includes(cardName(hidden))) fail(`describeMove named face-down ${hidden}`);
      }
    }
    if (battle.rounds.some((r, i) => i > 0 && (r.down[0].length < 3 || r.down[1].length < 3))) {
      stats.shortWars++;
    }
    stats.longestChain = Math.max(stats.longestChain, battle.wars);
    state = next;
    steps++;
    if ([...state.piles[0], ...state.piles[1]].sort().join() !== SORTED) {
      fail('a card was lost or duplicated');
    }
    if (state.battles !== steps || state.battles > maxBattles) fail('wrong battle count');
    if (!warEngine.isOver(state) && (!state.piles[0].length || !state.piles[1].length)) {
      fail('an empty pile in a running game');
    }
  }
  expect(warEngine.currentPlayer(state)).toBeNull();
  expect(warEngine.legalMoves(state, 0)).toEqual([]);
  expect(warEngine.checkMove(state, 0, { type: 'flip' }).ok).toBe(false);
  expect(() => warEngine.applyMove(state, { type: 'flip' })).toThrow();
  expect(warEngine.coach(state, 0).suggestion).toBeUndefined();
  const result = warEngine.result(state);
  const [mine, theirs] = [state.piles[0].length, state.piles[1].length];
  const expected =
    state.endReason === 'both-out' || mine === theirs ? 'push' : mine > theirs ? 'win' : 'loss';
  expect(result.humanOutcome).toBe(expected);
  expect(result.humanNetUnits).toBe({ win: 1, loss: -1, push: 0 }[expected]);
  expect(result.scores).toEqual([mine, theirs]);
  if (state.endReason === 'battle-cap') expect(state.battles).toBe(maxBattles);
  if (state.endReason === 'all-cards') expect(Math.min(mine, theirs)).toBe(0);
  if (result.flags.luckyLastCard) {
    expect(result.humanOutcome).toBe('win');
    expect(state.lastBattle?.wars).toBeGreaterThan(0);
  }
  if (result.flags.comeback) expect(result.humanOutcome).toBe('win');
  if (result.flags.closeFinish) expect(state.endReason).toBe('battle-cap');
  expect(result.summary).not.toMatch(/undefined|NaN|null/);
  stats.games++;
  stats.moves += steps;
  stats.ends[state.endReason ?? '?'] = (stats.ends[state.endReason ?? '?'] ?? 0) + 1;
  stats.outcomes[expected] = (stats.outcomes[expected] ?? 0) + 1;
}

describe('war fuzzing', () => {
  it('survives 1,500 games from uneven, tie-rigged and capped positions', () => {
    const stats: FuzzStats = {
      games: 0,
      moves: 0,
      ends: {},
      outcomes: {},
      shortWars: 0,
      longestChain: 0,
    };
    for (let seed = 1; seed <= 1500; seed++) fuzzGame(seed, stats);
    expect(stats.games).toBe(1500);
    // The rigged decks really do reach the rare paths.
    expect(stats.ends['both-out']).toBeGreaterThan(0);
    expect(stats.ends['all-cards']).toBeGreaterThan(0);
    expect(stats.ends['battle-cap']).toBeGreaterThan(0);
    expect(stats.shortWars).toBeGreaterThan(0);
    expect(stats.longestChain).toBeGreaterThanOrEqual(4);
    console.info(
      `war fuzz: ${stats.games} games, avg ${(stats.moves / stats.games).toFixed(1)} moves, ` +
        `endings ${JSON.stringify(stats.ends)}, outcomes ${JSON.stringify(stats.outcomes)}, ` +
        `short wars ${stats.shortWars}, longest war chain ${stats.longestChain}`,
    );
  }, 120_000);
});
