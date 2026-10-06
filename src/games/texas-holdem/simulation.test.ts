import { describe, expect, it } from 'vitest';
import { type CardCode, isCardCode, isJoker, makeDeck } from '@/games/core/cards';
import { simulate, type SimulationSummary } from '@/games/core/simulate';
import type { Difficulty, GameConfig, GameResult } from '@/games/core/types';
import engine, { BIG_POT_UNITS, MAX_LOSS_UNITS, type TexasHoldemState } from './engine';
import { compareReference } from './test-helpers';

const FULL_DECK = new Set<string>(makeDeck());
const BOARD_BY_STREET = { preflop: 0, flop: 3, turn: 4, river: 5 } as const;
const BURNS_BY_BOARD: Record<number, number> = { 0: 0, 3: 1, 4: 2, 5: 3 };
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

// ------------------------------------------------------------- invariants

/** Checked after every move: cards, chips and the betting arithmetic. */
function checkInvariant(s: TexasHoldemState): void {
  const fail = (msg: string) => {
    throw new Error(`invariant: ${msg}`);
  };
  // Every card accounted for exactly once.
  if (s.hands.length !== s.players) fail('wrong number of hands');
  for (const h of s.hands) if (h.length !== 2) fail('a hand without 2 hole cards');
  const all: CardCode[] = [...s.hands.flat(), ...s.board, ...s.burned, ...s.deck];
  if (all.length !== 52) fail(`card count ${all.length}`);
  if (new Set(all).size !== 52) fail('duplicate card');
  for (const c of all) if (!isCardCode(c) || isJoker(c) || !FULL_DECK.has(c)) fail(`bad card ${c}`);
  if (BURNS_BY_BOARD[s.board.length] !== s.burned.length) fail('burn cards do not match the board');
  if (!s.outcome && s.board.length !== BOARD_BY_STREET[s.street]) fail('board size vs street');
  if (s.outcome?.kind === 'showdown' && s.board.length !== 5)
    fail('showdown without 5 board cards');

  // Chips.
  const total = sum(s.startingStacks);
  for (let i = 0; i < s.players; i++) {
    const stack = s.stacks[i] ?? -1;
    if (!Number.isInteger(stack) || stack < 0) fail(`seat ${i} stack ${stack}`);
    if ((s.streetBets[i] ?? 0) > (s.committed[i] ?? 0)) fail('street bet above total committed');
  }
  if (s.outcome) {
    if (sum(s.stacks) !== total)
      fail(`chips not conserved at the end (${sum(s.stacks)} ≠ ${total})`);
    if (sum(s.outcome.payouts) !== sum(s.committed)) fail('payouts ≠ pot');
    if (sum(s.outcome.pots.map((p) => p.amount)) !== sum(s.committed)) fail('pots ≠ pot');
    if (s.toAct !== null) fail('someone to act after the end');
  } else {
    if (sum(s.stacks) + sum(s.committed) !== total) fail('chips not conserved');
    const t = s.toAct;
    if (t === null || s.folded[t] || (s.stacks[t] ?? 0) === 0) fail('bad seat to act');
    if (s.currentBet < Math.max(...s.streetBets)) fail('current bet below a street bet');
  }

  // Replay the public log: every chip committed is explained by a blind, an action or a return.
  const committed = Array.from({ length: s.players }, () => 0);
  const folded = Array.from({ length: s.players }, () => false);
  for (const e of s.log) {
    if (e.kind === 'blind' || e.kind === 'action') {
      committed[e.player] = (committed[e.player] ?? 0) + e.amount;
      if (e.kind === 'action' && e.type === 'fold') folded[e.player] = true;
    } else if (e.kind === 'uncalled') {
      committed[e.player] = (committed[e.player] ?? 0) - e.amount;
    }
  }
  for (let i = 0; i < s.players; i++) {
    if (committed[i] !== s.committed[i])
      fail(`seat ${i} committed ${s.committed[i]} ≠ log ${committed[i]}`);
    if (folded[i] !== s.folded[i]) fail(`seat ${i} fold flag mismatch`);
    const expectedStack =
      (s.startingStacks[i] ?? 0) - (committed[i] ?? 0) + (s.outcome?.payouts[i] ?? 0);
    if (expectedStack !== s.stacks[i]) fail(`seat ${i} stack ${s.stacks[i]} ≠ ${expectedStack}`);
  }
}

// --------------------------------------------- independent re-derivation

/** Final stacks re-derived from contributions, folds and the reference hand scorer. */
function expectedFinalStacks(s: TexasHoldemState): number[] {
  const n = s.players;
  const final = s.startingStacks.map((st, i) => st - (s.committed[i] ?? 0));
  const live = Array.from({ length: n }, (_, i) => i).filter((i) => !s.folded[i]);
  const potTotal = sum(s.committed);
  if (live.length === 1) {
    final[live[0] ?? 0] = (final[live[0] ?? 0] ?? 0) + potTotal;
    return final;
  }
  const handOf = (i: number) => [...(s.hands[i] ?? []), ...s.board];
  // Peel off pots level by level, smallest live contribution first.
  const remaining = s.committed.slice();
  let eligible = live.slice();
  while (eligible.length > 0) {
    const level = Math.min(...eligible.map((i) => remaining[i] ?? 0));
    let pot = 0;
    for (let i = 0; i < n; i++) {
      const take = Math.min(remaining[i] ?? 0, level);
      pot += take;
      remaining[i] = (remaining[i] ?? 0) - take;
    }
    const nextEligible = eligible.filter((i) => (remaining[i] ?? 0) > 0);
    if (nextEligible.length === 0) {
      // Whatever folded players put in above the last live level joins this pot.
      for (let i = 0; i < n; i++) {
        pot += remaining[i] ?? 0;
        remaining[i] = 0;
      }
    }
    if (pot > 0) {
      let best = eligible[0] ?? 0;
      for (const i of eligible) if (compareReference(handOf(i), handOf(best)) > 0) best = i;
      const winners: number[] = [];
      // Clockwise from the seat left of the button, so odd chips go to the first winner.
      for (let k = 1; k <= n; k++) {
        const seat = (s.button + k) % n;
        if (eligible.includes(seat) && compareReference(handOf(seat), handOf(best)) === 0) {
          winners.push(seat);
        }
      }
      const share = Math.floor(pot / winners.length);
      let odd = pot - share * winners.length;
      for (const w of winners) {
        final[w] = (final[w] ?? 0) + share + (odd > 0 ? 1 : 0);
        odd--;
      }
    }
    eligible = nextEligible;
  }
  return final;
}

function checkEnd(s: TexasHoldemState, r: GameResult, seed: number): void {
  const where = `[seed ${seed}]`;
  const final = expectedFinalStacks(s);
  expect(s.stacks, `${where} final stacks`).toEqual(final);
  const net = (final[0] ?? 0) - (s.startingStacks[0] ?? 0);
  expect(r.humanNetUnits, `${where} net`).toBe(net);
  expect(r.humanOutcome).toBe(net > 0 ? 'win' : net < 0 ? 'loss' : 'push');
  expect(r.scores).toEqual(final.map((f, i) => f - (s.startingStacks[i] ?? 0)));
  expect(sum(r.scores ?? [])).toBe(0);
  // Payout bounds: never lose more than the starting stack, never win more than the others had.
  const start0 = s.startingStacks[0] ?? 0;
  expect(net).toBeGreaterThanOrEqual(-start0);
  expect(net).toBeLessThanOrEqual(sum(s.startingStacks) - start0);
  if (start0 <= MAX_LOSS_UNITS) expect(net).toBeGreaterThanOrEqual(-MAX_LOSS_UNITS);
  // Winners = everyone paid from a pot.
  const paid = (s.outcome?.payouts ?? []).map((x, i) => (x > 0 ? i : -1)).filter((i) => i >= 0);
  expect(r.winners).toEqual(paid);
  // Flags agree with what happened.
  expect(r.flags.folded).toBe(s.folded[0]);
  expect(r.flags.bust).toBe(s.stacks[0] === 0);
  expect(r.flags.bigPot).toBe(Math.abs(net) >= BIG_POT_UNITS);
  expect(r.flags.tags?.includes('all-in')).toBe(s.allInStreet[0] !== null);
  if (r.flags.perfect || r.flags.comeback || r.flags.luckyLastCard) expect(net).toBeGreaterThan(0);
  if (r.flags.tags?.includes('bluff-win')) expect(s.outcome?.kind).toBe('fold');
  expect(r.summary.length).toBeGreaterThan(10);
}

// ---------------------------------------------------------------- configs

/** Players 2–6 and a mix of table options, all derived from the seed. */
function variedConfig(seed: number): GameConfig {
  const players = 2 + (seed % 5);
  const variant = Math.floor(seed / 5) % 4;
  if (variant === 0) {
    // Unequal stacks → side pots.
    const stacks = Array.from({ length: players }, (_, i) => 5 + ((seed * 37 + i * 53) % 196));
    return { players, options: { stacks } };
  }
  if (variant === 1) return { players, options: { startingStack: 30 } };
  if (variant === 2) return { players, options: { smallBlind: 5, bigBlind: 10 } };
  return { players };
}

interface Stats {
  showdowns: number;
  /** Games that ended with a main pot plus at least one side pot. */
  sidePots: number;
  /** Games where some pot was split between equal hands. */
  splitPots: number;
  flags: Record<string, number>;
}

function run(
  games: number,
  seedBase: number,
  config: GameConfig | ((seed: number) => GameConfig),
  difficulty?: (seat: number) => Difficulty,
): { summary: SimulationSummary; stats: Stats } {
  const stats: Stats = { showdowns: 0, sidePots: 0, splitPots: 0, flags: {} };
  const summary = simulate(engine, {
    games,
    seedBase,
    config,
    difficulty,
    maxMoves: 400,
    invariant: (s) => checkInvariant(s),
    onGameEnd: (s, r, seed) => {
      checkEnd(s, r, seed);
      if (s.outcome?.kind === 'showdown') stats.showdowns++;
      if ((s.outcome?.pots.length ?? 0) > 1) stats.sidePots++;
      if (s.outcome?.pots.some((p) => p.winners.length > 1)) stats.splitPots++;
      for (const [k, v] of Object.entries(r.flags)) {
        if (v === true) stats.flags[k] = (stats.flags[k] ?? 0) + 1;
      }
      for (const t of r.flags.tags ?? []) stats.flags[`#${t}`] = (stats.flags[`#${t}`] ?? 0) + 1;
    },
  });
  return { summary, stats };
}

function report(name: string, { summary, stats }: ReturnType<typeof run>): void {
  console.info(
    `[texas-holdem sim] ${name}: ${summary.games} games, avg ${(summary.totalMoves / summary.games).toFixed(1)} moves (max ${summary.maxMovesInAGame}), ` +
      `learner win/loss/push ${summary.outcomes.win}/${summary.outcomes.loss}/${summary.outcomes.push}, ` +
      `learner net ${summary.netUnits} chips, showdowns ${stats.showdowns}, side pots ${stats.sidePots}, ` +
      `split pots ${stats.splitPots}, learner flags ${JSON.stringify(stats.flags)}`,
  );
}

describe('Texas Hold’em simulation', () => {
  it(
    'default tables (4 seats, 100 chips): 400 games, normal/easy bots',
    { timeout: 60_000 },
    () => {
      const res = run(400, 1, { players: 4 });
      report('default', res);
      expect(res.summary.games).toBe(400);
      expect(res.stats.showdowns).toBeGreaterThan(50);
      const o = res.summary.outcomes;
      expect(o.win).toBeGreaterThan(0);
      expect(o.loss).toBeGreaterThan(0);
      expect(o.push).toBeGreaterThan(0);
    },
  );

  it(
    'varied tables (2–6 seats, uneven stacks, short stacks, bigger blinds): 500 games, all normal',
    { timeout: 60_000 },
    () => {
      const res = run(500, 10_000, variedConfig, () => 'normal');
      report('varied/normal', res);
      expect(res.summary.games).toBe(500);
      expect(res.stats.showdowns).toBeGreaterThan(50);
      expect(res.stats.splitPots).toBeGreaterThan(0);
    },
  );

  it('varied tables: 300 games, all easy', { timeout: 60_000 }, () => {
    const res = run(300, 20_000, variedConfig, () => 'easy');
    report('varied/easy', res);
    expect(res.summary.games).toBe(300);
    expect(res.stats.showdowns).toBeGreaterThan(100);
    // Calling stations with uneven stacks reach multi-way all-ins: side pots happen.
    expect(res.stats.sidePots).toBeGreaterThan(0);
    expect(res.stats.flags['#side-pot'] ?? 0).toBe(res.stats.sidePots);
  });

  it(
    'heads-up with uneven stacks: 300 games, easy learner vs normal bot',
    { timeout: 60_000 },
    () => {
      const res = run(
        300,
        30_000,
        (seed) => ({ players: 2, options: { stacks: [100, 10 + (seed % 140)] } }),
        (seat) => (seat === 0 ? 'easy' : 'normal'),
      );
      report('heads-up', res);
      expect(res.summary.games).toBe(300);
      expect(res.stats.flags.bust ?? 0).toBeGreaterThan(0);
    },
  );
});
