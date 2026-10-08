/**
 * Generic bot-vs-bot simulation harness used by every engine's simulation test.
 * It drives a game with botMove() for every seat and asserts the contract:
 *  - currentPlayer() is null iff isOver()
 *  - legalMoves() is non-empty whenever a player must act
 *  - every bot move is in legalMoves() and passes checkMove()
 *  - applyMove() does not mutate its input
 *  - the game terminates within maxMoves
 * Every failure is thrown as an Error whose message starts with "[seed N]" and names the
 * step and engine method involved, so a broken engine is easy to reproduce and debug.
 */
import { createRng, type Rng } from './rng';
import type { Difficulty, GameConfig, GameEngine, GameResult, PlayerId } from './types';

export interface SimulationOptions<S> {
  games: number;
  config: GameConfig | ((seed: number) => GameConfig);
  /** Difficulty per seat (default: alternate normal/easy). */
  difficulty?: (seat: PlayerId) => Difficulty;
  maxMoves?: number;
  /** Seed offset so different tests use different seeds. */
  seedBase?: number;
  /** Check input immutability on every Nth move (default every 7th; 0 disables). */
  freezeEvery?: number;
  /** Extra invariant checked after every move. Throw to fail. */
  invariant?: (state: S, step: number) => void;
  /** Called with the final state and result of every game. Throw to fail. */
  onGameEnd?: (state: S, result: GameResult, seed: number) => void;
}

export interface SimulationSummary {
  games: number;
  totalMoves: number;
  maxMovesInAGame: number;
  outcomes: { win: number; loss: number; push: number };
  netUnits: number;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

function stableStringify(v: unknown): string {
  return JSON.stringify(v);
}

/** Errors raised by the harness itself (already carry seed/step context). */
class SimulationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SimulationError';
  }
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Run `fn`; if it throws (anything other than a harness error), rethrow with the seed,
 * the phase that failed and the original message so a failing simulation is easy to debug.
 */
function guard<T>(context: string, fn: () => T, hint?: (err: unknown) => string): T {
  try {
    return fn();
  } catch (err) {
    if (err instanceof SimulationError) throw err;
    throw new SimulationError(`${context}: ${messageOf(err)}${hint?.(err) ?? ''}`, { cause: err });
  }
}

export function simulate<S, M>(
  engine: GameEngine<S, M>,
  opts: SimulationOptions<S>,
): SimulationSummary {
  const maxMoves = opts.maxMoves ?? 5000;
  const freezeEvery = opts.freezeEvery ?? 7;
  const difficulty = opts.difficulty ?? ((seat: PlayerId) => (seat % 2 === 0 ? 'normal' : 'easy'));
  const summary: SimulationSummary = {
    games: 0,
    totalMoves: 0,
    maxMovesInAGame: 0,
    outcomes: { win: 0, loss: 0, push: 0 },
    netUnits: 0,
  };

  for (let g = 0; g < opts.games; g++) {
    const seed = (opts.seedBase ?? 1) + g;
    const at = `[seed ${seed}]`;
    const fail = (message: string) => new SimulationError(`${at} ${message}`);
    const config = guard(`${at} config(seed) threw`, () =>
      typeof opts.config === 'function' ? opts.config(seed) : opts.config,
    );
    const setupRng = createRng(`setup-${seed}`);
    const botRng: Rng = createRng(`bots-${seed}`);
    let state = guard(`${at} setup() threw`, () => engine.setup(config, setupRng));
    let steps = 0;
    while (!guard(`${at} isOver() threw at step ${steps}`, () => engine.isOver(state))) {
      const ctx = `at step ${steps}`;
      const player = guard(`${at} currentPlayer() threw ${ctx}`, () => engine.currentPlayer(state));
      if (player === null) throw fail(`currentPlayer is null but game is not over (${ctx})`);
      const legal = guard(`${at} legalMoves() threw ${ctx}`, () =>
        engine.legalMoves(state, player),
      );
      if (legal.length === 0) throw fail(`player ${player} has no legal moves ${ctx}`);
      const move = guard(`${at} botMove() threw for player ${player} ${ctx}`, () =>
        engine.botMove(state, player, difficulty(player), botRng),
      );
      const key = guard(`${at} moveKey() threw ${ctx}`, () => engine.moveKey(move));
      const legalKeys = guard(`${at} moveKey() threw ${ctx}`, () =>
        legal.map((m) => engine.moveKey(m)),
      );
      if (!legalKeys.includes(key)) {
        throw fail(
          `bot chose illegal move ${key} for player ${player} ${ctx} (legal: ${legalKeys.join(', ')})`,
        );
      }
      const check = guard(`${at} checkMove() threw on ${key} ${ctx}`, () =>
        engine.checkMove(state, player, move),
      );
      if (!check.ok) throw fail(`checkMove rejected bot move ${key} ${ctx}: ${check.reason}`);
      const described = guard(`${at} describeMove() threw on ${key} ${ctx}`, () =>
        engine.describeMove(state, player, move),
      );
      if (typeof described !== 'string') {
        throw fail(`describeMove did not return a string (${ctx})`);
      }
      let before: string | undefined;
      if (freezeEvery > 0 && steps % freezeEvery === 0) {
        before = stableStringify(state);
        deepFreeze(state);
      }
      const frozen = before !== undefined;
      const next = guard(
        `${at} applyMove() threw on move ${key} ${ctx}`,
        () => engine.applyMove(state, move),
        (err) =>
          frozen && err instanceof TypeError
            ? ' — the input state was deep-frozen, so applyMove most likely tried to mutate it' +
              ' (return a new object instead)'
            : '',
      );
      if (frozen && stableStringify(state) !== before) {
        throw fail(`applyMove mutated its input state on move ${key} ${ctx}`);
      }
      state = next;
      steps++;
      if (opts.invariant) {
        const invariant = opts.invariant;
        guard(`${at} invariant failed after step ${steps}`, () => invariant(state, steps));
      }
      if (steps > maxMoves) throw fail(`game did not end within ${maxMoves} moves`);
    }
    if (
      guard(`${at} currentPlayer() threw after the game ended`, () =>
        engine.currentPlayer(state),
      ) !== null
    ) {
      throw fail('game is over but currentPlayer is not null');
    }
    const result = guard(`${at} result() threw`, () => engine.result(state));
    if (!Number.isFinite(result.humanNetUnits)) throw fail('humanNetUnits is not finite');
    if (result.humanOutcome === 'win' && result.humanNetUnits < 0) {
      throw fail('human won but net units are negative');
    }
    if (result.humanOutcome === 'loss' && result.humanNetUnits > 0) {
      throw fail('human lost but net units are positive');
    }
    if (opts.onGameEnd) {
      const onEnd = opts.onGameEnd;
      guard(`${at} onGameEnd check failed`, () => onEnd(state, result, seed));
    }
    summary.games++;
    summary.totalMoves += steps;
    summary.maxMovesInAGame = Math.max(summary.maxMovesInAGame, steps);
    summary.outcomes[result.humanOutcome]++;
    summary.netUnits += result.humanNetUnits;
  }
  return summary;
}
