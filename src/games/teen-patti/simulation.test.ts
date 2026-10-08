import { describe, expect, it } from 'vitest';
import {
  type CardCode,
  isCardCode,
  isJoker,
  makeDeck,
  rankNumberAceHigh,
  suitOf,
} from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { simulate, type SimulationSummary } from '@/games/core/simulate';
import type { Difficulty, GameConfig, GameResult } from '@/games/core/types';
import engine, { MAX_LOSS_UNITS, type TeenPattiState } from './engine';

// ------------------------------------------------------------------------
// An independent, deliberately different hand scorer (lookup-based) so the
// final result can be re-derived without trusting hand-eval.ts.
// ------------------------------------------------------------------------
const SEQUENCES = [
  '4,3,2',
  '5,4,3',
  '6,5,4',
  '7,6,5',
  '8,7,6',
  '9,8,7',
  '10,9,8',
  '11,10,9',
  '12,11,10',
  '13,12,11',
  '14,3,2', // A-2-3: second best
  '14,13,12', // A-K-Q: best
];

function independentScore(cards: readonly CardCode[]): number[] {
  const v = cards.map(rankNumberAceHigh).sort((a, b) => b - a);
  const flush = new Set(cards.map(suitOf)).size === 1;
  const seq = SEQUENCES.indexOf(v.join(','));
  const counts = new Map<number, number>();
  for (const x of v) counts.set(x, (counts.get(x) ?? 0) + 1);
  if (counts.size === 1) return [6, v[0] ?? 0];
  if (seq >= 0) return [flush ? 5 : 4, seq];
  if (flush) return [3, ...v];
  if (counts.size === 2) {
    const pair = [...counts].find(([, n]) => n === 2)?.[0] ?? 0;
    const odd = [...counts].find(([, n]) => n === 1)?.[0] ?? 0;
    return [2, pair, odd];
  }
  return [1, ...v];
}

function cmp(a: readonly CardCode[], b: readonly CardCode[]): number {
  const x = independentScore(a);
  const y = independentScore(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// ------------------------------------------------------------- invariants

const FULL_DECK = new Set<string>(makeDeck());

/** Every card accounted for exactly once; the betting arithmetic replays from the history. */
function checkInvariant(s: TeenPattiState): void {
  const fail = (msg: string) => {
    throw new Error(`invariant: ${msg}`);
  };
  // Cards.
  if (s.hands.length !== s.players) fail('wrong number of hands');
  for (const hand of s.hands) if (hand.length !== 3) fail('hand without 3 cards');
  const all = [...s.hands.flat(), ...s.stock];
  if (all.length !== 52) fail(`card count ${all.length}`);
  if (new Set(all).size !== 52) fail('duplicate card');
  for (const c of all) if (!isCardCode(c) || isJoker(c) || !FULL_DECK.has(c)) fail(`bad card ${c}`);

  // Replay the betting from the public history.
  let stake = 1;
  let pot = s.players;
  const contributed = Array.from({ length: s.players }, () => 1);
  const seen = Array.from({ length: s.players }, () => false);
  const packed = Array.from({ length: s.players }, () => false);
  let turn = (s.dealer + 1) % s.players;
  let ended = false;
  for (const a of s.history) {
    if (ended) fail('action after the end');
    if (a.player !== turn) fail(`seat ${a.player} acted out of turn (expected ${turn})`);
    if (packed[a.player]) fail('packed player acted');
    if (a.blind !== !seen[a.player]) fail('blind flag mismatch');
    if (a.type === 'see') {
      if (seen[a.player]) fail('saw twice');
      seen[a.player] = true;
      if (a.amount !== 0) fail('see cost boots');
      continue;
    }
    if (a.type === 'pack') {
      packed[a.player] = true;
      if (a.amount !== 0) fail('pack cost boots');
    } else {
      const chaal = seen[a.player] ? 2 * stake : stake;
      const base = a.type === 'raise' ? 2 * chaal : chaal;
      if (a.type === 'raise') {
        stake *= 2;
        if (stake > s.stakeLimit) fail('raised past the chaal limit');
      }
      if (a.type === 'show' && packed.filter((x) => !x).length !== 2) fail('show with ≠ 2 players');
      const capped = pot + base >= s.potLimit;
      const pay = capped ? s.potLimit - pot : base;
      if (a.amount !== pay) fail(`bet of ${a.amount}, expected ${pay}`);
      if (a.capped !== capped) fail('capped flag mismatch');
      contributed[a.player] = (contributed[a.player] ?? 0) + pay;
      pot += pay;
      if (a.type === 'show' || capped) ended = true;
    }
    if (a.stake !== stake || a.pot !== pot) fail('history stake/pot mismatch');
    if (packed.filter((x) => !x).length === 1) ended = true;
    if (!ended) {
      do turn = (turn + 1) % s.players;
      while (packed[turn]);
    }
  }
  if (s.stake !== stake) fail('stake mismatch');
  if (s.pot !== pot) fail('pot mismatch');
  if (s.pot > s.potLimit) fail('pot above the limit');
  if (contributed.some((c, i) => c !== s.contributed[i])) fail('contributions mismatch');
  if (seen.some((x, i) => x !== s.seen[i])) fail('seen mismatch');
  if (packed.some((x, i) => x !== s.packed[i])) fail('packed mismatch');
  if (ended !== (s.outcome !== null)) fail('end state mismatch');
  if (!ended && s.turn !== turn) fail('turn mismatch');
  if (s.outcome) {
    const paid = s.outcome.payouts.reduce((a, b) => a + b, 0);
    if (paid !== s.pot) fail(`payouts ${paid} ≠ pot ${s.pot}`);
    if (s.outcome.payouts.some((x) => x < 0 || !Number.isInteger(x))) fail('bad payout');
  }
}

/** Re-derive winners, payouts and the learner's net from the final state alone. */
function checkResult(s: TeenPattiState, r: GameResult, seed: number): void {
  const fail = (msg: string) => {
    throw new Error(`[seed ${seed}] result: ${msg}`);
  };
  const active = s.packed.flatMap((p, i) => (p ? [] : [i]));
  const last = s.history[s.history.length - 1];
  let winners: number[];
  let kind: string;
  if (active.length === 1) {
    kind = 'last-standing';
    winners = active;
  } else if (last?.type === 'show') {
    kind = 'show';
    const asker = last.player;
    const other = active.find((x) => x !== asker) ?? -1;
    winners = [cmp(s.hands[asker] ?? [], s.hands[other] ?? []) > 0 ? asker : other];
  } else {
    if (!last?.capped) fail('ended without a pack, a show or the pot limit');
    kind = 'pot-limit';
    const best = active.reduce((b, x) => (cmp(s.hands[x] ?? [], s.hands[b] ?? []) > 0 ? x : b));
    winners = active.filter((x) => cmp(s.hands[x] ?? [], s.hands[best] ?? []) === 0);
  }
  const payouts = Array.from({ length: s.players }, () => 0);
  const share = Math.floor(s.pot / winners.length);
  let rest = s.pot - share * winners.length;
  for (const w of winners) payouts[w] = share;
  for (let i = 1; i <= s.players && rest > 0; i++) {
    const seat = (s.dealer + i) % s.players;
    if (winners.includes(seat)) {
      payouts[seat] = (payouts[seat] ?? 0) + 1;
      rest--;
    }
  }
  const nets = payouts.map((p, i) => p - (s.contributed[i] ?? 0));
  const net = nets[0] ?? 0;
  if (s.outcome?.kind !== kind) fail(`kind ${s.outcome?.kind} ≠ ${kind}`);
  if (JSON.stringify(r.winners) !== JSON.stringify(winners)) fail('winners mismatch');
  if (JSON.stringify(s.outcome?.payouts) !== JSON.stringify(payouts)) fail('payouts mismatch');
  if (JSON.stringify(r.scores) !== JSON.stringify(nets)) fail('scores mismatch');
  if (nets.reduce((a, b) => a + b, 0) !== 0) fail('boots not conserved');
  if (r.humanNetUnits !== net) fail(`net ${r.humanNetUnits} ≠ ${net}`);
  if (net < -MAX_LOSS_UNITS || net > MAX_LOSS_UNITS) fail(`net ${net} outside ±${MAX_LOSS_UNITS}`);
  const outcome = net > 0 ? 'win' : net < 0 ? 'loss' : 'push';
  if (r.humanOutcome !== outcome) fail('outcome mismatch');
  if (r.flags.folded !== s.packed[0]) fail('folded flag');
  if (r.flags.bigPot !== Math.abs(net) >= 8) fail('bigPot flag');
  const trail = independentScore(s.hands[0] ?? [])[0] === 6;
  if (r.flags.perfect !== (trail && net > 0)) fail('perfect flag');
  if (r.flags.bust !== (kind === 'show' && last?.player === 0 && !winners.includes(0))) {
    fail('bust flag');
  }
  if (r.flags.tags?.includes('blind-win') !== (net > 0 && !s.seen[0])) fail('blind-win tag');
  if (r.flags.comeback) {
    const someoneBetter = s.hands.some((hand, i) => i > 0 && cmp(hand, s.hands[0] ?? []) > 0);
    if (!someoneBetter || net <= 0) fail('comeback flag without a better hand');
  }
  if ((r.flags.closeFinish || r.flags.luckyLastCard) && !s.outcome?.showdown.includes(0)) {
    fail('close/lucky finish without the learner in the show');
  }
  if (typeof r.summary !== 'string' || r.summary.length < 20) fail('summary');
}

// ------------------------------------------------------------------ runs

interface Tally {
  kinds: Record<string, number>;
  players: Record<number, number>;
}

function run(
  games: number,
  seedBase: number,
  config: (seed: number) => GameConfig,
  difficulty?: (seat: number) => Difficulty,
): SimulationSummary & Tally {
  const tally: Tally = { kinds: {}, players: {} };
  const summary = simulate(engine, {
    games,
    seedBase,
    config,
    difficulty,
    maxMoves: 200,
    freezeEvery: 3,
    invariant: (state) => checkInvariant(state),
    onGameEnd: (state, result, seed) => {
      checkResult(state, result, seed);
      const kind = state.outcome?.kind ?? 'none';
      tally.kinds[kind] = (tally.kinds[kind] ?? 0) + 1;
      tally.players[state.players] = (tally.players[state.players] ?? 0) + 1;
    },
  });
  return { ...summary, ...tally };
}

function report(label: string, s: SimulationSummary & Tally): void {
  console.info(
    `[teen-patti sim] ${label}: ${s.games} games, avg ${(s.totalMoves / s.games).toFixed(1)} moves ` +
      `(max ${s.maxMovesInAGame}), learner win/loss/push ${s.outcomes.win}/${s.outcomes.loss}/${s.outcomes.push}, ` +
      `net ${(s.netUnits / s.games).toFixed(2)}/game, endings ${JSON.stringify(s.kinds)}`,
  );
}

/** 2–5 players; every 5th game a smaller pot limit, every 7th a 4-boot chaal limit. */
function variedConfig(seed: number): GameConfig {
  const players = 2 + (seed % 4);
  const options: Record<string, unknown> = {};
  if (seed % 5 === 0) options.potLimit = 16 + (seed % 3) * 8;
  if (seed % 7 === 0) options.stakeLimit = 4;
  return { players, options };
}

describe('Teen Patti simulation', () => {
  it('the invariant and result checkers catch tampering', () => {
    let s = engine.setup({ players: 3 }, createRng('tamper'));
    s = engine.applyMove(s, { type: 'chaal' });
    expect(() => checkInvariant(s)).not.toThrow();
    expect(() => checkInvariant({ ...s, pot: s.pot + 1 })).toThrow(/pot/);
    expect(() => checkInvariant({ ...s, contributed: [9, 1, 1] })).toThrow(/contributions/);
    const dup = s.hands.map((h, i) => (i === 1 ? [s.hands[0]?.[0] ?? 'AS', ...h.slice(1)] : h));
    expect(() => checkInvariant({ ...s, hands: dup })).toThrow(/duplicate/);
    expect(() => checkInvariant({ ...s, stake: 2 })).toThrow(/stake/);
    const over = engine.applyMove(engine.applyMove(s, { type: 'pack' }), { type: 'pack' });
    const r = engine.result(over);
    expect(() => checkResult(over, r, 0)).not.toThrow();
    expect(() => checkResult(over, { ...r, humanNetUnits: r.humanNetUnits + 1 }, 0)).toThrow(/net/);
    expect(() =>
      checkResult(over, { ...r, winners: r.winners.map((w) => (w + 1) % 3) }, 0),
    ).toThrow(/winners/);
  });

  it('1,600 mixed games (2–5 players, varied limits, normal/easy seats) keep every invariant', () => {
    const s = run(1600, 1, variedConfig);
    report('mixed', s);
    expect(s.games).toBe(1600);
    for (const n of [2, 3, 4, 5]) expect(s.players[n]).toBe(400);
    // Every way a hand can end actually happens.
    expect(s.kinds['last-standing']).toBeGreaterThan(100);
    expect(s.kinds['show']).toBeGreaterThan(100);
    expect(s.kinds['pot-limit']).toBeGreaterThan(50);
    expect(s.outcomes.win).toBeGreaterThan(200);
    expect(s.outcomes.loss).toBeGreaterThan(200);
    expect(s.maxMovesInAGame).toBeLessThan(120);
  }, 60_000);

  it('all-normal and all-easy tables (default rules) also stay valid', () => {
    const normal = run(
      500,
      10_000,
      (seed) => ({ players: 2 + (seed % 4) }),
      () => 'normal',
    );
    const easy = run(
      500,
      20_000,
      (seed) => ({ players: 2 + (seed % 4) }),
      () => 'easy',
    );
    report('all normal', normal);
    report('all easy', easy);
    expect(normal.games + easy.games).toBe(1000);
  }, 60_000);

  it('the normal bot out-earns easy bots (and easy loses to normal bots)', () => {
    const cfg = (seed: number) => ({ players: 3 + (seed % 2) });
    const strong = run(1500, 30_000, cfg, (seat) => (seat === 0 ? 'normal' : 'easy'));
    const weak = run(1500, 40_000, cfg, (seat) => (seat === 0 ? 'easy' : 'normal'));
    report('normal learner vs easy bots', strong);
    report('easy learner vs normal bots', weak);
    expect(strong.netUnits / strong.games).toBeGreaterThan(0.2);
    expect(weak.netUnits / weak.games).toBeLessThan(-0.2);
  }, 60_000);
});
