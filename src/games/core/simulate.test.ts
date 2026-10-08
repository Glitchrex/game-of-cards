/**
 * Tests for the generic bot-vs-bot harness, using a tiny "race to N" toy engine:
 * players take turns adding 1 or 2 to a running total; whoever reaches the target wins.
 * Broken variants of the engine prove the harness catches each contract violation
 * with a clear, seed-tagged error.
 */
import { describe, expect, it } from 'vitest';
import { createRng, type Rng } from './rng';
import { deepFreeze, simulate, type SimulationOptions } from './simulate';
import {
  IllegalMoveError,
  assertLegal,
  type Difficulty,
  type GameConfig,
  type GameEngine,
  type GameResult,
  type PlayerId,
} from './types';

interface RaceState {
  total: number;
  target: number;
  players: number;
  turn: PlayerId;
  history: number[];
}
type RaceMove = number;
type RaceEngine = GameEngine<RaceState, RaceMove>;

const race: RaceEngine = {
  id: 'race',
  setup(config: GameConfig, rng: Rng): RaceState {
    const target = typeof config.options?.target === 'number' ? config.options.target : 10;
    return { total: rng.int(3), target, players: config.players, turn: 0, history: [] };
  },
  currentPlayer: (s) => (s.total >= s.target ? null : s.turn),
  legalMoves: (s, p) => (s.total >= s.target || p !== s.turn ? [] : [1, 2]),
  checkMove(s, p, m) {
    if (s.total >= s.target) return { ok: false, reason: 'The race is already over.' };
    if (p !== s.turn) return { ok: false, reason: 'It is not your turn yet.' };
    if (m !== 1 && m !== 2) return { ok: false, reason: 'You can only add 1 or 2.' };
    return { ok: true };
  },
  applyMove(s, m) {
    assertLegal(race, s, m);
    return {
      ...s,
      total: s.total + m,
      turn: (s.turn + 1) % s.players,
      history: [...s.history, m],
    };
  },
  isOver: (s) => s.total >= s.target,
  result(s): GameResult {
    const winner = (s.turn + s.players - 1) % s.players;
    const won = winner === 0;
    return {
      winners: [winner],
      humanOutcome: won ? 'win' : 'loss',
      humanNetUnits: won ? 1 : -1,
      scores: Array.from({ length: s.players }, (_, i) => (i === winner ? 1 : 0)),
      summary: won ? 'You reached the target first!' : `Player ${winner} reached the target.`,
      flags: { closeFinish: s.total === s.target },
    };
  },
  botMove(s, _p, difficulty, rng) {
    const left = s.target - s.total;
    if (difficulty === 'normal' && left <= 2) return left;
    return rng.pick([1, 2]);
  },
  describeMove: (_s, p, m) => `Player ${p} adds ${m}.`,
  coach: (s) => ({ situation: `The total is ${s.total}.`, suggestion: 1, why: 'Small steps.' }),
  moveKey: (m) => String(m),
};

const twoPlayers: GameConfig = { players: 2 };
const broken = (overrides: Partial<RaceEngine>): RaceEngine => ({ ...race, ...overrides });
const run = (engine: RaceEngine, opts: Partial<SimulationOptions<RaceState>> = {}) =>
  simulate(engine, { games: 20, config: twoPlayers, ...opts });

/** Run and return the thrown error (fails the test if nothing is thrown). */
function failure(engine: RaceEngine, opts: Partial<SimulationOptions<RaceState>> = {}): Error {
  try {
    run(engine, opts);
  } catch (err) {
    expect(err).toBeInstanceOf(Error);
    return err as Error;
  }
  throw new Error('expected simulate() to throw');
}

describe('simulate — a healthy engine', () => {
  it('plays every game to the end and summarises the outcomes', () => {
    const summary = simulate(race, { games: 500, config: twoPlayers });
    expect(summary.games).toBe(500);
    expect(summary.outcomes.win + summary.outcomes.loss + summary.outcomes.push).toBe(500);
    expect(summary.outcomes.push).toBe(0);
    expect(summary.outcomes.win).toBeGreaterThan(0);
    expect(summary.outcomes.loss).toBeGreaterThan(0);
    expect(summary.netUnits).toBe(summary.outcomes.win - summary.outcomes.loss);
    expect(summary.maxMovesInAGame).toBeLessThanOrEqual(10);
    expect(summary.totalMoves).toBeGreaterThanOrEqual(500 * 4);
    expect(summary.totalMoves).toBeLessThanOrEqual(500 * summary.maxMovesInAGame);
  });

  it('is deterministic: the same options give the same summary and final states', () => {
    const finals = (): RaceState[] => {
      const out: RaceState[] = [];
      run(race, { games: 50, onGameEnd: (s) => void out.push(s) });
      return out;
    };
    expect(run(race, { games: 200 })).toEqual(run(race, { games: 200 }));
    expect(finals()).toEqual(finals());
  });

  it('seeds setup with createRng(`setup-${seed}`) and walks seeds from seedBase', () => {
    const seen: number[] = [];
    const starts: number[] = [];
    run(
      broken({
        setup(config, rng) {
          const s = race.setup(config, rng);
          starts.push(s.total);
          return s;
        },
      }),
      { games: 5, seedBase: 40, config: (seed) => (seen.push(seed), twoPlayers) },
    );
    expect(seen).toEqual([40, 41, 42, 43, 44]);
    expect(starts).toEqual(seen.map((seed) => createRng(`setup-${seed}`).int(3)));
  });

  it('defaults to normal bots on even seats and easy bots on odd seats', () => {
    const bySeat = new Map<PlayerId, Set<Difficulty>>();
    run(
      broken({
        botMove(s, p, d, rng) {
          if (!bySeat.has(p)) bySeat.set(p, new Set());
          bySeat.get(p)!.add(d);
          return race.botMove(s, p, d, rng);
        },
      }),
      { config: { players: 3 } },
    );
    expect(bySeat.get(0)).toEqual(new Set(['normal']));
    expect(bySeat.get(1)).toEqual(new Set(['easy']));
    expect(bySeat.get(2)).toEqual(new Set(['normal']));
  });

  it('honours a custom difficulty per seat', () => {
    const used = new Set<Difficulty>();
    run(
      broken({
        botMove(s, p, d, rng) {
          used.add(d);
          return race.botMove(s, p, d, rng);
        },
      }),
      { difficulty: () => 'easy' },
    );
    expect(used).toEqual(new Set(['easy']));
  });

  it('calls invariant after every move (steps 1..n) and onGameEnd once per game', () => {
    const steps: number[][] = [];
    const ends: { seed: number; result: GameResult }[] = [];
    run(race, {
      games: 3,
      seedBase: 7,
      invariant: (_s, step) => {
        if (step === 1) steps.push([]);
        steps.at(-1)!.push(step);
      },
      onGameEnd: (s, result, seed) => {
        expect(race.isOver(s)).toBe(true);
        ends.push({ seed, result });
      },
    });
    expect(ends.map((e) => e.seed)).toEqual([7, 8, 9]);
    expect(steps).toHaveLength(3);
    for (const list of steps) expect(list).toEqual(list.map((_, i) => i + 1));
  });

  it('deep-freezes the input of every Nth applyMove (freezeEvery)', () => {
    const frozenAt = (freezeEvery: number | undefined) => {
      const flags: boolean[] = [];
      const options: GameConfig = { players: 2, options: { target: 40 } };
      run(
        broken({
          setup: (_c, rng) => ({ ...race.setup(options, rng), total: 0 }),
          applyMove(s, m) {
            flags.push(Object.isFrozen(s) && Object.isFrozen(s.history));
            return race.applyMove(s, m);
          },
        }),
        { games: 1, config: options, ...(freezeEvery === undefined ? {} : { freezeEvery }) },
      );
      return flags;
    };
    const byDefault = frozenAt(undefined);
    byDefault.forEach((frozen, step) => expect(frozen).toBe(step % 7 === 0));
    expect(frozenAt(1).every(Boolean)).toBe(true);
    expect(frozenAt(0).some(Boolean)).toBe(false);
  });

  it('allows a game that ends on exactly maxMoves, and rejects one that needs more', () => {
    const exactlyTen = broken({
      setup: (config) => ({ total: 0, target: 10, players: config.players, turn: 0, history: [] }),
      botMove: () => 1,
    });
    expect(run(exactlyTen, { games: 3, maxMoves: 10 }).maxMovesInAGame).toBe(10);
    expect(failure(exactlyTen, { games: 3, maxMoves: 9 }).message).toBe(
      '[seed 1] game did not end within 9 moves',
    );
  });
});

describe('simulate — catching broken engines', () => {
  it('a bot that plays an illegal move', () => {
    const err = failure(broken({ botMove: () => 3 }));
    expect(err.message).toBe(
      '[seed 1] bot chose illegal move 3 for player 0 at step 0 (legal: 1, 2)',
    );
  });

  it('a bot whose move is listed as legal but rejected by checkMove', () => {
    const err = failure(
      broken({
        checkMove: (s, p, m) =>
          m === 2 ? { ok: false, reason: 'Two is too greedy.' } : race.checkMove(s, p, m),
        botMove: () => 2,
      }),
    );
    expect(err.message).toBe(
      '[seed 1] checkMove rejected bot move 2 at step 0: Two is too greedy.',
    );
  });

  it('applyMove that assigns to its input state', () => {
    const err = failure(
      broken({
        applyMove(s, m) {
          s.total += m;
          s.turn = (s.turn + 1) % s.players;
          return s;
        },
      }),
    );
    expect(err.message).toMatch(/^\[seed 1\] applyMove\(\) threw on move [12] at step 0: /);
    expect(err.message).toMatch(/most likely tried to mutate it/);
    expect(err.cause).toBeInstanceOf(TypeError);
  });

  it('applyMove that pushes into an array of its input state', () => {
    const err = failure(
      broken({
        applyMove(s, m) {
          s.history.push(m);
          return { ...s, total: s.total + m, turn: (s.turn + 1) % s.players };
        },
      }),
    );
    expect(err.message).toMatch(/^\[seed 1\] applyMove\(\) threw on move [12] at step 0: .*mutate/);
  });

  it('a mutation that freezing cannot block is still detected by comparing snapshots', () => {
    // A container that is already (shallowly) frozen is skipped by deepFreeze, so the
    // array inside it stays writable — the before/after JSON comparison catches it.
    type LogState = RaceState & { log: { moves: number[] } };
    const logEngine: GameEngine<LogState, RaceMove> = {
      ...(race as unknown as GameEngine<LogState, RaceMove>),
      setup: (config, rng) => ({ ...race.setup(config, rng), log: Object.freeze({ moves: [] }) }),
      applyMove(s, m) {
        s.log.moves.push(m);
        return { ...s, ...race.applyMove(s, m), log: s.log };
      },
    };
    expect(() => simulate(logEngine, { games: 1, config: twoPlayers })).toThrow(
      /^\[seed 1\] applyMove mutated its input state on move [12] at step 0$/,
    );
  });

  it('mutation on an unfrozen step is caught when freezeEvery is 1', () => {
    const sneaky = broken({
      applyMove(s, m) {
        if (s.history.length === 3) s.history.push(m);
        return race.applyMove(s, m);
      },
      setup: (config) => ({ total: 0, target: 10, players: config.players, turn: 0, history: [] }),
    });
    // Sampling every 7th move misses step 3 because each step copies `history`…
    expect(() => run(sneaky, { games: 1 })).not.toThrow();
    // …checking every move finds it.
    expect(failure(sneaky, { games: 1, freezeEvery: 1 }).message).toMatch(
      /^\[seed 1\] applyMove\(\) threw on move [12] at step 3: .*mutate/,
    );
  });

  it('an engine that never ends', () => {
    const endless = broken({
      currentPlayer: (s) => s.turn,
      legalMoves: (s, p) => (p === s.turn ? [1, 2] : []),
      checkMove: (s, p, m) =>
        p === s.turn && (m === 1 || m === 2) ? { ok: true } : { ok: false, reason: 'no' },
      applyMove: (s, m) => ({ ...s, total: s.total + m, turn: (s.turn + 1) % s.players }),
      isOver: () => false,
      botMove: (_s, _p, _d, rng) => rng.pick([1, 2]),
    });
    expect(failure(endless, { maxMoves: 50 }).message).toBe(
      '[seed 1] game did not end within 50 moves',
    );
    expect(failure(endless).message).toBe('[seed 1] game did not end within 5000 moves');
  });

  it('currentPlayer() null while the game is not over', () => {
    expect(failure(broken({ currentPlayer: () => null })).message).toBe(
      '[seed 1] currentPlayer is null but game is not over (at step 0)',
    );
  });

  it('a player with no legal moves', () => {
    expect(failure(broken({ legalMoves: () => [] })).message).toBe(
      '[seed 1] player 0 has no legal moves at step 0',
    );
  });

  it('currentPlayer() still set after the game is over', () => {
    expect(failure(broken({ currentPlayer: (s) => s.turn })).message).toBe(
      '[seed 1] game is over but currentPlayer is not null',
    );
  });

  it('describeMove() that does not return a string', () => {
    const err = failure(broken({ describeMove: () => undefined as unknown as string }));
    expect(err.message).toBe('[seed 1] describeMove did not return a string (at step 0)');
  });

  it('results whose outcome and net units disagree', () => {
    const withResult = (patch: Partial<GameResult>) =>
      broken({ result: (s) => ({ ...race.result(s), ...patch }) });
    expect(failure(withResult({ humanOutcome: 'win', humanNetUnits: -1 })).message).toBe(
      '[seed 1] human won but net units are negative',
    );
    expect(failure(withResult({ humanOutcome: 'loss', humanNetUnits: 2 })).message).toBe(
      '[seed 1] human lost but net units are positive',
    );
    expect(failure(withResult({ humanNetUnits: Number.NaN })).message).toBe(
      '[seed 1] humanNetUnits is not finite',
    );
    expect(failure(withResult({ humanNetUnits: Number.POSITIVE_INFINITY })).message).toBe(
      '[seed 1] humanNetUnits is not finite',
    );
  });

  it('reports the exact seed that failed', () => {
    const ended: number[] = [];
    const err = failure(
      broken({
        botMove: (s, p, d, rng) => (s.target === 99 ? 7 : race.botMove(s, p, d, rng)),
      }),
      {
        games: 10,
        config: (seed) => ({ players: 2, options: { target: seed === 4 ? 99 : 10 } }),
        onGameEnd: (_s, _r, seed) => void ended.push(seed),
      },
    );
    expect(err.message).toMatch(/^\[seed 4\] bot chose illegal move 7/);
    expect(ended).toEqual([1, 2, 3]);
  });

  it('wraps exceptions thrown by engine methods with seed, phase and step', () => {
    const boom = () => {
      throw new Error('boom');
    };
    const botErr = failure(broken({ botMove: boom }));
    expect(botErr.message).toBe('[seed 1] botMove() threw for player 0 at step 0: boom');
    expect((botErr.cause as Error).message).toBe('boom');

    expect(failure(broken({ setup: boom })).message).toBe('[seed 1] setup() threw: boom');
    expect(failure(broken({ legalMoves: boom })).message).toBe(
      '[seed 1] legalMoves() threw at step 0: boom',
    );
    expect(failure(broken({ result: boom })).message).toBe('[seed 1] result() threw: boom');
    expect(failure(race, { config: boom }).message).toBe('[seed 1] config(seed) threw: boom');
  });

  it('does not blame mutation when applyMove throws on an unfrozen state', () => {
    const err = failure(
      broken({
        applyMove: () => {
          throw new IllegalMoveError('Not like that.');
        },
      }),
      { freezeEvery: 0 },
    );
    expect(err.message).toMatch(
      /^\[seed 1\] applyMove\(\) threw on move [12] at step 0: Not like that\.$/,
    );
    expect(err.cause).toBeInstanceOf(IllegalMoveError);
  });

  it('tags failing invariant and onGameEnd checks with the seed', () => {
    const invErr = failure(race, {
      seedBase: 3,
      invariant: (_s, step) => {
        if (step === 2) throw new Error('total went backwards');
      },
    });
    expect(invErr.message).toBe('[seed 3] invariant failed after step 2: total went backwards');

    const endErr = failure(race, {
      onGameEnd: (s) => {
        if (s.history.length > 0) throw new Error('scores do not add up');
      },
    });
    expect(endErr.message).toBe('[seed 1] onGameEnd check failed: scores do not add up');
  });
});

describe('deepFreeze', () => {
  it('freezes nested objects and arrays and returns the same reference', () => {
    const value = { a: { b: [1, { c: 2 }] }, d: [[3]] };
    expect(deepFreeze(value)).toBe(value);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.a)).toBe(true);
    expect(Object.isFrozen(value.a.b)).toBe(true);
    expect(Object.isFrozen(value.a.b[1])).toBe(true);
    expect(Object.isFrozen(value.d[0])).toBe(true);
    expect(() => {
      (value.a.b as unknown[]).push(4);
    }).toThrow(TypeError);
  });

  it('passes primitives and null through', () => {
    expect(deepFreeze(5)).toBe(5);
    expect(deepFreeze('x')).toBe('x');
    expect(deepFreeze(null)).toBeNull();
    expect(deepFreeze(undefined)).toBeUndefined();
  });
});
