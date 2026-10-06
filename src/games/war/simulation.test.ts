import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, type CardCode } from '@/games/core/cards';
import { type Rng } from '@/games/core/rng';
import { simulate } from '@/games/core/simulate';
import type { Difficulty, GameConfig, GameResult, PlayerId } from '@/games/core/types';
import { warEngine, type WarMove, type WarState } from './engine';

const DECK_SORTED = makeDeck().slice().sort().join(',');

// ---------------------------------------------------------------- independent rules
// Deliberately NOT imported from the engine, so the simulation re-derives everything.

const RANK_ORDER = '23456789TJQKA';
const strength = (c: string) => RANK_ORDER.indexOf(c[0] ?? '?');

interface RefBattle {
  piles: [string[], string[]];
  winner: 0 | 1 | null;
  wars: number;
  ups: [string, string][];
  downs: [string[], string[]][];
  won: string[];
  bothOut: boolean;
  ranOut: boolean;
}

/** One battle by the book: flip, war on ties (3 down + 1 up, fewer when short), collect. */
function refBattle(start: [readonly string[], readonly string[]]): RefBattle {
  const a = [...start[0]];
  const b = [...start[1]];
  const potA: string[] = [];
  const potB: string[] = [];
  const ups: [string, string][] = [];
  const downs: [string[], string[]][] = [];
  let upA = a.shift() as string;
  let upB = b.shift() as string;
  potA.push(upA);
  potB.push(upB);
  ups.push([upA, upB]);
  downs.push([[], []]);
  let wars = 0;
  let winner: 0 | 1 | null = null;
  let bothOut = false;
  let ranOut = false;
  for (;;) {
    if (strength(upA) !== strength(upB)) {
      winner = strength(upA) > strength(upB) ? 0 : 1;
      break;
    }
    wars++;
    if (a.length === 0 && b.length === 0) {
      bothOut = true;
      break;
    }
    if (a.length === 0 || b.length === 0) {
      winner = a.length === 0 ? 1 : 0;
      ranOut = true;
      break;
    }
    // Lay down min(3, cards − 1), then turn the next card up.
    const downA = a.splice(0, Math.min(3, a.length - 1));
    const downB = b.splice(0, Math.min(3, b.length - 1));
    upA = a.shift() as string;
    upB = b.shift() as string;
    potA.push(...downA, upA);
    potB.push(...downB, upB);
    downs.push([downA, downB]);
    ups.push([upA, upB]);
  }
  if (bothOut) {
    return { piles: [potA, potB], winner: null, wars, ups, downs, won: [], bothOut, ranOut };
  }
  const won = winner === 0 ? [...potA, ...potB] : [...potB, ...potA];
  const piles: [string[], string[]] = winner === 0 ? [[...a, ...won], b] : [a, [...b, ...won]];
  return { piles, winner, wars, ups, downs, won, bothOut, ranOut };
}

interface RefGame {
  piles: [string[], string[]];
  battles: number;
  winner: 0 | 1 | null;
  end: 'all-cards' | 'battle-cap' | 'both-out';
  lowest0: number;
  warsWon0: number;
  doubleWar: boolean;
  /** The final battle was a war the learner won, and without it they would not be ahead. */
  lastWarDecisive: boolean;
}

/** Replay a whole game from the deal with the reference rules. */
function refGame(initial: WarState): RefGame {
  let piles: [string[], string[]] = [[...initial.piles[0]], [...initial.piles[1]]];
  let battles = 0;
  let lowest0 = 26;
  let warsWon0 = 0;
  let doubleWar = false;
  for (;;) {
    const r = refBattle(piles);
    piles = r.piles;
    battles++;
    lowest0 = Math.min(lowest0, piles[0].length);
    if (r.wars > 0 && r.winner === 0) warsWon0++;
    if (r.wars >= 2) doubleWar = true;
    // Swap the middle's owner: the learner keeps everything else, Player 1 gains the middle.
    const lastWarDecisive =
      r.wars > 0 &&
      r.winner === 0 &&
      piles[0].length - r.won.length <= piles[1].length + r.won.length;
    const base = { piles, battles, lowest0, warsWon0, doubleWar, lastWarDecisive };
    if (r.bothOut) return { ...base, winner: null, end: 'both-out' };
    if (piles[0].length === 0) return { ...base, winner: 1, end: 'all-cards' };
    if (piles[1].length === 0) return { ...base, winner: 0, end: 'all-cards' };
    if (battles >= initial.maxBattles) {
      const [x, y] = [piles[0].length, piles[1].length];
      return { ...base, winner: x === y ? null : x > y ? 0 : 1, end: 'battle-cap' };
    }
  }
}

// ---------------------------------------------------------------- invariants

/** Every card is in exactly one place, and nothing is ever left in the middle. */
function checkConservation(s: WarState): void {
  const all = [...s.piles[0], ...s.piles[1]];
  if (all.length !== 52 || [...all].sort().join(',') !== DECK_SORTED) {
    throw new Error(`card conservation broken (${all.length} cards)`);
  }
}

/** Bookkeeping agrees with itself. */
function checkStructure(s: WarState): void {
  const sizes = [s.piles[0].length, s.piles[1].length];
  if (s.battles !== s.history.length) throw new Error('battle count differs from history');
  if (s.battles > s.maxBattles) throw new Error('played past the battle cap');
  const over = s.phase === 'over';
  if (over !== (s.endReason !== null)) throw new Error('phase and endReason disagree');
  if (!over && s.winner !== null) throw new Error('a winner before the end');
  if (!over && (sizes[0] === 0 || sizes[1] === 0)) throw new Error('a pile is empty mid-game');
  if (!over && warEngine.currentPlayer(s) !== 0) throw new Error('seat 0 must always flip');
  if (warEngine.legalMoves(s, 1).length !== 0) throw new Error('the bot seat has a move');
  const b = s.lastBattle;
  if (s.battles === 0) {
    if (b !== null) throw new Error('a last battle before any battle');
    return;
  }
  const rec = s.history[s.history.length - 1];
  if (!b || !rec) throw new Error('missing last battle');
  if (b.number !== s.battles) throw new Error('last battle number is wrong');
  if (b.counts.join() !== sizes.join() || rec.counts.join() !== sizes.join()) {
    throw new Error('recorded pile sizes differ from the piles');
  }
  if (rec.wars !== b.wars || rec.winner !== b.winner) throw new Error('history ≠ last battle');
  const inMiddle = b.rounds.reduce((n, r) => n + 2 + r.down[0].length + r.down[1].length, 0);
  if (rec.cards !== inMiddle) throw new Error('history card count is wrong');
  if (b.winner !== null && b.won.length !== inMiddle) throw new Error('winner missed cards');
  for (const r of b.rounds) {
    for (const d of r.down) if (d.length > 3) throw new Error('more than 3 face-down cards');
  }
}

/** The step from `prev` to `next` is exactly one reference battle. */
function checkTransition(prev: WarState, next: WarState): void {
  const r = refBattle(prev.piles);
  const b = next.lastBattle;
  if (!b) throw new Error('no battle recorded');
  if (next.piles[0].join() !== r.piles[0].join() || next.piles[1].join() !== r.piles[1].join()) {
    throw new Error(`piles differ from the reference battle (battle ${next.battles})`);
  }
  if (next.battles !== prev.battles + 1) throw new Error('one flip must be one battle');
  if (b.winner !== r.winner || b.wars !== r.wars) throw new Error('battle winner/wars differ');
  if (JSON.stringify(b.rounds.map((x) => x.up)) !== JSON.stringify(r.ups)) {
    throw new Error('face-up cards differ');
  }
  if (JSON.stringify(b.rounds.map((x) => x.down)) !== JSON.stringify(r.downs)) {
    throw new Error('face-down cards differ');
  }
  if (b.won.join() !== r.won.join()) throw new Error('collection order differs');
  if (b.decidedBy !== (r.bothOut ? 'both-out' : r.ranOut ? 'out-of-cards' : 'higher-card')) {
    throw new Error('decidedBy is wrong');
  }
  // The move log never names a face-down card.
  const text = warEngine.describeMove(prev, 0, { type: 'flip' });
  for (const d of r.downs) {
    for (const c of [...d[0], ...d[1]]) {
      if (text.includes(cardName(c as CardCode))) throw new Error(`describeMove revealed ${c}`);
    }
  }
  // The coach always suggests the (only) legal move.
  const advice = warEngine.coach(prev, 0);
  if (!warEngine.checkMove(prev, 0, advice.suggestion as WarMove).ok) {
    throw new Error('coach suggested an illegal move');
  }
}

/** Re-derive the result from the final state and a full replay of the deal. */
function checkResult(initial: WarState, s: WarState, r: GameResult): RefGame {
  const ref = refGame(initial);
  if (ref.piles[0].join() !== s.piles[0].join() || ref.piles[1].join() !== s.piles[1].join()) {
    throw new Error('final piles differ from the reference replay');
  }
  if (ref.battles !== s.battles || ref.end !== s.endReason || ref.winner !== s.winner) {
    throw new Error(`ending differs: ref ${ref.end}/${ref.winner} vs ${s.endReason}/${s.winner}`);
  }
  const sizes: [number, number] = [s.piles[0].length, s.piles[1].length];
  // Re-derive the winner from the final piles alone.
  const fromPiles =
    s.endReason === 'both-out'
      ? null
      : sizes[0] === 0
        ? 1
        : sizes[1] === 0
          ? 0
          : sizes[0] === sizes[1]
            ? null
            : sizes[0] > sizes[1]
              ? 0
              : 1;
  if (fromPiles !== s.winner) throw new Error('winner does not match the final piles');
  if (s.endReason === 'battle-cap' && s.battles !== s.maxBattles) {
    throw new Error('battle-cap ending before the cap');
  }
  if (s.endReason !== 'battle-cap' && s.endReason !== 'both-out' && sizes[0] && sizes[1]) {
    throw new Error('all-cards ending with both piles non-empty');
  }
  const outcome = ref.winner === 0 ? 'win' : ref.winner === 1 ? 'loss' : 'push';
  const net = outcome === 'win' ? 1 : outcome === 'loss' ? -1 : 0;
  if (r.humanOutcome !== outcome || r.humanNetUnits !== net) throw new Error('payout is wrong');
  if (r.humanNetUnits < -1 || r.humanNetUnits > 1) throw new Error('payout out of range');
  if (JSON.stringify(r.winners) !== JSON.stringify(ref.winner === null ? [] : [ref.winner])) {
    throw new Error('winners are wrong');
  }
  if (r.scores?.join() !== sizes.join()) throw new Error('scores are not the pile sizes');
  if (r.scores.reduce((x, y) => x + y, 0) !== 52) throw new Error('scores do not add up to 52');
  if (!r.summary || /undefined|NaN/.test(r.summary)) throw new Error('bad summary');
  const won = outcome === 'win';
  const expected = {
    comeback: won && ref.lowest0 <= 16,
    closeFinish: ref.end === 'battle-cap' && Math.abs(sizes[0] - sizes[1]) <= 4,
    luckyLastCard: won && ref.lastWarDecisive,
    bigPot: false,
    perfect: false,
    bust: false,
    folded: false,
  };
  for (const [k, v] of Object.entries(expected)) {
    if (r.flags[k as keyof typeof expected] !== v) throw new Error(`flag ${k} should be ${v}`);
  }
  const tags: string[] = [ref.end];
  if (ref.warsWon0 > 0) tags.push('war-won', `war-won:${ref.warsWon0}`);
  if (ref.doubleWar) tags.push('double-war');
  if (JSON.stringify(r.flags.tags) !== JSON.stringify(tags)) throw new Error('tags are wrong');
  return ref;
}

// ---------------------------------------------------------------- batches

interface Batch {
  name: string;
  games: number;
  seedBase: number;
  config: GameConfig | ((seed: number) => GameConfig);
  difficulty: (seat: PlayerId) => Difficulty;
}

const VARIED_CAPS = [1, 7, 30, 60, 120, 300];

const BATCHES: Batch[] = [
  {
    name: 'default rules, normal',
    games: 1000,
    seedBase: 1,
    config: { players: 2 },
    difficulty: () => 'normal',
  },
  {
    name: 'default rules, easy',
    games: 500,
    seedBase: 10_001,
    config: { players: 2, affordableUnits: 0 },
    difficulty: () => 'easy',
  },
  {
    name: 'varied battle caps',
    games: 300,
    seedBase: 20_001,
    config: (seed) => ({
      players: 2,
      options: { maxBattles: VARIED_CAPS[seed % VARIED_CAPS.length] },
    }),
    difficulty: (seat) => (seat === 0 ? 'easy' : 'normal'),
  },
  {
    name: 'long games (cap 1000)',
    games: 200,
    seedBase: 30_001,
    config: { players: 2, options: { maxBattles: 1000 } },
    difficulty: () => 'normal',
  },
];

describe('war simulation', () => {
  it(`plays ${BATCHES.reduce((n, b) => n + b.games, 0)} games without breaking any rule`, () => {
    let games = 0;
    let moves = 0;
    const outcomes = { win: 0, loss: 0, push: 0 };
    const ends = { 'all-cards': 0, 'battle-cap': 0, 'both-out': 0 };
    const flags = { comeback: 0, closeFinish: 0, luckyLastCard: 0 };
    let defaultGames = 0;
    let defaultMoves = 0;
    let wars = 0;
    let ranOut = 0;
    let shortWars = 0;
    for (const batch of BATCHES) {
      let initial: WarState | null = null;
      let prev: WarState | null = null;
      const recording = {
        ...warEngine,
        setup(config: GameConfig, rng: Rng) {
          initial = warEngine.setup(config, rng);
          prev = initial;
          checkConservation(initial);
          checkStructure(initial);
          return initial;
        },
      };
      const summary = simulate(recording, {
        games: batch.games,
        seedBase: batch.seedBase,
        config: batch.config,
        difficulty: batch.difficulty,
        maxMoves: 1000,
        invariant: (s) => {
          checkConservation(s);
          checkStructure(s);
          if (!prev) throw new Error('no previous state');
          checkTransition(prev, s);
          prev = s;
          const b = s.lastBattle;
          if (b) {
            wars += b.wars;
            if (b.rounds.some((r, i) => i > 0 && (r.down[0].length < 3 || r.down[1].length < 3))) {
              shortWars++;
            }
            if (b.decidedBy === 'out-of-cards') ranOut++;
          }
        },
        onGameEnd: (s, r) => {
          if (!initial) throw new Error('setup was not recorded');
          checkResult(initial, s, r);
          ends[s.endReason ?? 'battle-cap']++;
          if (r.flags.comeback) flags.comeback++;
          if (r.flags.closeFinish) flags.closeFinish++;
          if (r.flags.luckyLastCard) flags.luckyLastCard++;
          if (s.maxBattles === 60) {
            defaultGames++;
            defaultMoves += s.battles;
          }
        },
      });
      expect(summary.games).toBe(batch.games);
      games += summary.games;
      moves += summary.totalMoves;
      outcomes.win += summary.outcomes.win;
      outcomes.loss += summary.outcomes.loss;
      outcomes.push += summary.outcomes.push;
    }
    expect(games).toBeGreaterThanOrEqual(1000);
    // Every interesting ending and flag actually happens.
    expect(ends['all-cards']).toBeGreaterThan(0);
    expect(ends['battle-cap']).toBeGreaterThan(0);
    expect(outcomes.win).toBeGreaterThan(0);
    expect(outcomes.loss).toBeGreaterThan(0);
    expect(outcomes.push).toBeGreaterThan(0);
    expect(flags.comeback).toBeGreaterThan(0);
    expect(flags.closeFinish).toBeGreaterThan(0);
    expect(flags.luckyLastCard).toBeGreaterThan(0);
    expect(wars).toBeGreaterThan(0);
    expect(shortWars).toBeGreaterThan(0);
    expect(ranOut).toBeGreaterThan(0);
    // Pure luck: the learner's seat wins about as often as it loses.
    expect(Math.abs(outcomes.win - outcomes.loss)).toBeLessThan(games * 0.1);
    console.info(
      `war sim: ${games} games, avg ${(moves / games).toFixed(1)} moves ` +
        `(default 60-cap games: ${defaultGames}, avg ${(defaultMoves / defaultGames).toFixed(1)} battles), ` +
        `outcomes ${JSON.stringify(outcomes)}, endings ${JSON.stringify(ends)}, ` +
        `flags ${JSON.stringify(flags)}, wars ${wars}, short wars ${shortWars}, ran out ${ranOut}`,
    );
  }, 60_000);
});
