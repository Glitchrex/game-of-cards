import { describe, expect, it } from 'vitest';
import { type CardCode, type Rank } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { simulate, type SimulationSummary } from '@/games/core/simulate';
import type { Difficulty, GameConfig, GameResult } from '@/games/core/types';
import engine, { MAX_LOSS_UNITS, type IndianRummyState } from './engine';
import { rawDeadwoodOf } from './melds';
import { fullDeck } from './rules';
import { refScore } from './test-helpers';

// ------------------------------------------------------------- invariants

const FULL = new Map<string, number>();
for (const c of fullDeck()) FULL.set(c, (FULL.get(c) ?? 0) + 1);

/** Every card accounted for exactly once; hand sizes, turn order and counters consistent. */
function checkInvariant(s: IndianRummyState): void {
  const fail = (msg: string) => {
    throw new Error(`invariant: ${msg}`);
  };
  const all: CardCode[] = [...s.hands.flat(), ...s.stock, ...s.discard, s.wildCard];
  if (s.finishCard) all.push(s.finishCard);
  if (all.length !== 106) fail(`card count ${all.length}`);
  const seen = new Map<string, number>();
  for (const c of all) seen.set(c, (seen.get(c) ?? 0) + 1);
  for (const [c, n] of FULL) if (seen.get(c) !== n) fail(`card ${c} appears ${seen.get(c) ?? 0}×`);
  if (seen.size !== FULL.size) fail('unknown card');

  const over = s.outcome !== null;
  s.hands.forEach((h, i) => {
    const holding = !over && i === s.turn && s.phase === 'discard' ? 14 : 13;
    if (h.length !== holding) fail(`seat ${i} holds ${h.length} cards, expected ${holding}`);
  });
  const wild: Rank = s.wildCard === 'X1' || s.wildCard === 'X2' ? 'A' : (s.wildCard[0] as Rank);
  if (s.wildRank !== wild) fail('wild rank does not match the wild-joker card');
  if (!over) {
    if (s.drops[s.turn]) fail('a dropped seat is to play');
    if (s.phase === 'draw') {
      if (s.drawn !== null) fail('drawn card recorded before drawing');
      if (!s.stock.length || !s.discard.length) fail('a pile is empty at the start of a turn');
    } else if (!s.drawn || !(s.hands[s.turn] ?? []).includes(s.drawn.card)) {
      fail('discard phase without the drawn card in hand');
    }
  }
  const turns = s.turnsTaken.reduce((a, b) => a + b, 0);
  if (turns !== s.turnCount) fail(`turnCount ${s.turnCount} ≠ Σ turnsTaken ${turns}`);
  if (s.turnCount > s.maxTurns) fail('past the turn cap');
  s.drops.forEach((d, i) => {
    if (d === 'first' && s.hasDrawn[i]) fail(`seat ${i} made a first drop after drawing`);
    if (d === 'middle' && !s.hasDrawn[i]) fail(`seat ${i} made a middle drop without drawing`);
  });
  if ((s.finishCard !== null) !== (s.outcome?.kind === 'declare')) fail('finish card mismatch');
  // Peak deadwood is never below a seat's current 13-card hand (declarers excepted).
  s.hands.forEach((h, i) => {
    if (h.length !== 13 || (over && s.outcome?.declarer === i)) return;
    if ((s.peakDeadwood[i] ?? 0) < rawDeadwoodOf(h, s.wildRank)) fail(`seat ${i} peak too low`);
  });
}

// ------------------------------------------------- independent scoring

function drop(kind: 'first' | 'middle'): number {
  return kind === 'first' ? 20 : 40;
}

/** Re-derive the outcome and the learner's result from the final state alone. */
function checkResult(s: IndianRummyState, r: GameResult, seed: number): void {
  const fail = (msg: string) => {
    throw new Error(`[seed ${seed}] result: ${msg}`);
  };
  const n = s.players;
  const wild: Rank = s.wildCard === 'X1' || s.wildCard === 'X2' ? 'A' : (s.wildCard[0] as Rank);
  const active = s.drops.flatMap((d, i) => (d ? [] : [i]));
  let kind: string;
  let winners: number[];
  const points = Array.from({ length: n }, () => 0);
  s.drops.forEach((d, i) => {
    if (d) points[i] = drop(d);
  });
  if (s.finishCard) {
    kind = 'declare';
    const declarer = s.turn;
    if (!refScore(s.hands[declarer] ?? [], wild).valid) fail('declared an invalid hand');
    winners = [declarer];
    for (const i of active)
      if (i !== declarer) points[i] = refScore(s.hands[i] ?? [], wild).deadwood;
  } else if (active.length === 1) {
    kind = 'drop';
    winners = active;
  } else {
    kind = 'turn-cap';
    if (s.turnCount !== s.maxTurns) fail('ended without a declaration, a drop-out or the cap');
    for (const i of active) points[i] = refScore(s.hands[i] ?? [], wild).deadwood;
    const low = Math.min(...active.map((i) => points[i] ?? 80));
    winners = active.filter((i) => points[i] === low);
  }
  const pot = points.reduce((a, p, i) => (winners.includes(i) ? a : a + p), 0);
  const net = points.map((p, i) => (winners.includes(i) ? pot / winners.length : -p));
  const o = s.outcome;
  if (o?.kind !== kind) fail(`kind ${o?.kind} ≠ ${kind}`);
  if (JSON.stringify(o?.winners) !== JSON.stringify(winners)) fail('winners mismatch');
  if (JSON.stringify(o?.points) !== JSON.stringify(points)) fail(`points ${o?.points} ≠ ${points}`);
  if (JSON.stringify(o?.net) !== JSON.stringify(net)) fail('net mismatch');
  if (JSON.stringify(r.winners) !== JSON.stringify(winners)) fail('result winners mismatch');
  if (JSON.stringify(r.scores) !== JSON.stringify(points)) fail('scores mismatch');
  if (Math.abs(net.reduce((a, b) => a + b, 0)) > 1e-9) fail('points not conserved');
  const net0 = net[0] ?? 0;
  if (r.humanNetUnits !== net0) fail(`net ${r.humanNetUnits} ≠ ${net0}`);
  if (net0 < -MAX_LOSS_UNITS || net0 > MAX_LOSS_UNITS * (n - 1)) fail(`net ${net0} out of range`);
  const won = winners.includes(0);
  const outcome = won ? (winners.length === 1 || net0 > 0 ? 'win' : 'push') : 'loss';
  if (r.humanOutcome !== outcome) fail(`outcome ${r.humanOutcome} ≠ ${outcome}`);

  // Flags, from what actually happened.
  const f = r.flags;
  if (f.folded !== (s.drops[0] !== null)) fail('folded flag');
  if (f.bigPot !== Math.abs(net0) >= 40) fail('bigPot flag');
  if (f.bust !== (!won && !s.drops[0] && (points[0] ?? 0) >= 80)) fail('bust flag');
  const losers = active.filter((i) => !winners.includes(i));
  const close =
    outcome === 'push' ||
    (won ? losers.some((i) => (points[i] ?? 80) <= 10) : !s.drops[0] && (points[0] ?? 80) <= 10);
  if (f.closeFinish !== close) fail('closeFinish flag');
  const humanDeclared = kind === 'declare' && winners[0] === 0;
  const hand0 = s.hands[0] ?? [];
  const lucky = humanDeclared && s.drawn?.from === 'stock' && hand0.includes(s.drawn.card);
  if (f.luckyLastCard !== lucky) fail('luckyLastCard flag');
  const noJokers =
    humanDeclared && !hand0.some((c) => c === 'X1' || c === 'X2') && refScore(hand0, null).valid;
  const perfect = humanDeclared && ((s.turnsTaken[0] ?? 0) <= 3 || noJokers);
  if (f.perfect !== perfect) fail('perfect flag');
  if (f.comeback !== (outcome === 'win' && (s.peakDeadwood[0] ?? 0) >= 60)) fail('comeback flag');
  if (!f.tags?.includes(kind)) fail('missing ending tag');
  if (typeof r.summary !== 'string' || r.summary.length < 20) fail('summary');
}

// ------------------------------------------------------------------ runs

interface Tally {
  kinds: Record<string, number>;
  players: Record<number, number>;
  drops: Record<string, number>;
  reshuffled: number;
  flags: Record<string, number>;
}

function run(
  games: number,
  seedBase: number,
  config: (seed: number) => GameConfig,
  difficulty?: (seat: number) => Difficulty,
  checks = true,
): SimulationSummary & Tally {
  const tally: Tally = { kinds: {}, players: {}, drops: {}, reshuffled: 0, flags: {} };
  const summary = simulate(engine, {
    games,
    seedBase,
    config,
    difficulty,
    maxMoves: 1000,
    freezeEvery: checks ? 5 : 0,
    invariant: checks ? (state) => checkInvariant(state) : undefined,
    onGameEnd: (state, result, seed) => {
      if (checks) checkResult(state, result, seed);
      const kind = state.outcome?.kind ?? 'none';
      tally.kinds[kind] = (tally.kinds[kind] ?? 0) + 1;
      tally.players[state.players] = (tally.players[state.players] ?? 0) + 1;
      for (const d of state.drops) if (d) tally.drops[d] = (tally.drops[d] ?? 0) + 1;
      if (state.reshuffles > 0) tally.reshuffled++;
      for (const [k, v] of Object.entries(result.flags)) {
        if (v === true) tally.flags[k] = (tally.flags[k] ?? 0) + 1;
      }
    },
  });
  return { ...summary, ...tally };
}

function report(label: string, s: SimulationSummary & Tally): void {
  console.info(
    `[indian-rummy sim] ${label}: ${s.games} games, avg ${(s.totalMoves / s.games).toFixed(1)} moves ` +
      `(max ${s.maxMovesInAGame}), learner win/loss/push ${s.outcomes.win}/${s.outcomes.loss}/${s.outcomes.push}, ` +
      `net ${(s.netUnits / s.games).toFixed(2)}/game, endings ${JSON.stringify(s.kinds)}, ` +
      `drops ${JSON.stringify(s.drops)}, reshuffled ${s.reshuffled}, flags ${JSON.stringify(s.flags)}`,
  );
}

const PLAYERS = [2, 2, 2, 3, 4, 5, 6];

/** Mostly two players (as on the site), up to six; every 6th game a short turn cap. */
function variedConfig(seed: number): GameConfig {
  const players = PLAYERS[seed % PLAYERS.length] ?? 2;
  const options: Record<string, unknown> = {};
  if (seed % 6 === 0) options.maxTurns = 8 + (seed % 13);
  if (seed % 4 === 0) options.dealer = seed % players;
  return { players, options };
}

describe('Indian Rummy simulation', () => {
  it('the invariant and result checkers catch tampering', () => {
    let s = engine.setup({ players: 3 }, createRng('tamper'));
    const rng = createRng('tamper-bots');
    for (let i = 0; i < 9; i++) s = engine.applyMove(s, engine.botMove(s, s.turn, 'normal', rng));
    expect(() => checkInvariant(s)).not.toThrow();
    const dup = s.hands.map((h, i) => (i === 1 ? [s.hands[0]?.[0] ?? 'AS', ...h.slice(1)] : h));
    expect(() => checkInvariant({ ...s, hands: dup })).toThrow(/appears/);
    expect(() => checkInvariant({ ...s, stock: s.stock.slice(1) })).toThrow(/card count/);
    expect(() => checkInvariant({ ...s, turnCount: s.turnCount + 1 })).toThrow(/turnCount/);
    expect(() =>
      checkInvariant({ ...s, drops: ['first', null, null], hasDrawn: [true, true, true] }),
    ).toThrow(/first drop after drawing/);
    let over = s;
    while (!engine.isOver(over))
      over = engine.applyMove(over, engine.botMove(over, over.turn, 'normal', rng));
    const r = engine.result(over);
    expect(() => checkResult(over, r, 0)).not.toThrow();
    expect(() => checkResult(over, { ...r, humanNetUnits: r.humanNetUnits + 1 }, 0)).toThrow(/net/);
    const o = over.outcome;
    if (!o) throw new Error('game did not end');
    expect(() =>
      checkResult({ ...over, outcome: { ...o, points: o.points.map((p) => p + 1) } }, r, 0),
    ).toThrow(/points/);
    expect(() =>
      checkResult(over, { ...r, flags: { ...r.flags, bigPot: !r.flags.bigPot } }, 0),
    ).toThrow(/bigPot/);
  });

  it('1,000 mixed games (2–6 players, varied turn caps, normal/easy seats) keep every invariant', () => {
    const s = run(1000, 1, variedConfig);
    report('mixed', s);
    expect(s.games).toBe(1000);
    for (const n of [2, 3, 4, 5, 6]) expect(s.players[n]).toBeGreaterThan(100);
    // Every way a game can end actually happens.
    expect(s.kinds['declare']).toBeGreaterThan(700);
    expect(s.kinds['turn-cap']).toBeGreaterThan(30);
    expect(s.kinds['drop']).toBeGreaterThan(3);
    expect(s.drops['first']).toBeGreaterThan(10);
    expect(s.reshuffled).toBeGreaterThan(8);
    expect(s.outcomes.win).toBeGreaterThan(150);
    expect(s.outcomes.loss).toBeGreaterThan(400);
    for (const flag of [
      'perfect',
      'comeback',
      'closeFinish',
      'luckyLastCard',
      'bigPot',
      'bust',
      'folded',
    ]) {
      expect(s.flags[flag] ?? 0).toBeGreaterThan(0);
    }
  }, 90_000);

  it('all-normal and all-easy tables (default rules) also stay valid', () => {
    const cfg = (seed: number) => ({ players: PLAYERS[seed % PLAYERS.length] ?? 2 });
    const normal = run(250, 10_000, cfg, () => 'normal');
    const easy = run(250, 20_000, cfg, () => 'easy');
    report('all normal', normal);
    report('all easy', easy);
    expect(normal.games + easy.games).toBe(500);
  }, 90_000);

  it('the normal bot out-scores easy bots (and an easy learner loses to normal bots)', () => {
    const cfg = () => ({ players: 2 });
    const strong = run(900, 30_000, cfg, (seat) => (seat === 0 ? 'normal' : 'easy'), false);
    const weak = run(900, 40_000, cfg, (seat) => (seat === 0 ? 'easy' : 'normal'), false);
    report('normal learner vs easy bot', strong);
    report('easy learner vs normal bot', weak);
    expect(strong.netUnits / strong.games).toBeGreaterThan(3);
    expect(strong.outcomes.win / strong.games).toBeGreaterThan(0.53);
    expect(weak.netUnits / weak.games).toBeLessThan(-3);
  }, 90_000);
});
