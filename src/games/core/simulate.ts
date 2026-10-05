/**
 * Generic bot-vs-bot simulation harness used by every engine's simulation test.
 * It drives a game with botMove() for every seat and asserts the contract:
 *  - currentPlayer() is null iff isOver()
 *  - legalMoves() is non-empty whenever a player must act
 *  - every bot move is in legalMoves() and passes checkMove()
 *  - applyMove() does not mutate its input
 *  - the game terminates within maxMoves
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
    const config = typeof opts.config === 'function' ? opts.config(seed) : opts.config;
    const setupRng = createRng(`setup-${seed}`);
    const botRng: Rng = createRng(`bots-${seed}`);
    let state = engine.setup(config, setupRng);
    let steps = 0;
    while (!engine.isOver(state)) {
      const player = engine.currentPlayer(state);
      if (player === null) {
        throw new Error(`[seed ${seed}] currentPlayer is null but game is not over`);
      }
      const legal = engine.legalMoves(state, player);
      if (legal.length === 0) {
        throw new Error(`[seed ${seed}] player ${player} has no legal moves at step ${steps}`);
      }
      const move = engine.botMove(state, player, difficulty(player), botRng);
      const key = engine.moveKey(move);
      if (!legal.some((m) => engine.moveKey(m) === key)) {
        throw new Error(`[seed ${seed}] bot chose illegal move ${key} at step ${steps}`);
      }
      const check = engine.checkMove(state, player, move);
      if (!check.ok) {
        throw new Error(`[seed ${seed}] checkMove rejected bot move ${key}: ${check.reason}`);
      }
      if (typeof engine.describeMove(state, player, move) !== 'string') {
        throw new Error(`[seed ${seed}] describeMove did not return a string`);
      }
      let before: string | undefined;
      if (freezeEvery > 0 && steps % freezeEvery === 0) {
        before = stableStringify(state);
        deepFreeze(state);
      }
      const next = engine.applyMove(state, move);
      if (before !== undefined && stableStringify(state) !== before) {
        throw new Error(`[seed ${seed}] applyMove mutated its input state`);
      }
      state = next;
      steps++;
      opts.invariant?.(state, steps);
      if (steps > maxMoves) throw new Error(`[seed ${seed}] game did not end within ${maxMoves} moves`);
    }
    if (engine.currentPlayer(state) !== null) {
      throw new Error(`[seed ${seed}] game is over but currentPlayer is not null`);
    }
    const result = engine.result(state);
    if (!Number.isFinite(result.humanNetUnits)) {
      throw new Error(`[seed ${seed}] humanNetUnits is not finite`);
    }
    if (result.humanOutcome === 'win' && result.humanNetUnits < 0) {
      throw new Error(`[seed ${seed}] human won but net units are negative`);
    }
    if (result.humanOutcome === 'loss' && result.humanNetUnits > 0) {
      throw new Error(`[seed ${seed}] human lost but net units are positive`);
    }
    opts.onGameEnd?.(state, result, seed);
    summary.games++;
    summary.totalMoves += steps;
    summary.maxMovesInAGame = Math.max(summary.maxMovesInAGame, steps);
    summary.outcomes[result.humanOutcome]++;
    summary.netUnits += result.humanNetUnits;
  }
  return summary;
}
