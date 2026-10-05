/**
 * The shared engine contract. Engines are PURE: no React, no DOM, no I/O,
 * no Date.now(), no Math.random(). All randomness comes through `Rng`.
 * State must be plain JSON-serialisable data.
 */
import type { Rng } from './rng';

export type PlayerId = number;
export type Difficulty = 'easy' | 'normal';

export interface GameConfig {
  /** Number of seats including the human (seat 0 in play mode). */
  players: number;
  /**
   * How many *extra* stake units the human's wallet can still cover beyond the
   * initial stake (used to allow/deny Blackjack doubles & splits, etc.).
   * Undefined = unlimited (simulations, practice mode).
   */
  affordableUnits?: number;
  /** Game-specific options. */
  options?: Record<string, unknown>;
}

export interface MoveCheck {
  ok: boolean;
  /** Beginner-friendly explanation shown when the move is illegal. */
  reason?: string;
}

/** Facts about how a game ended — used to pick context-aware titles & roasts. */
export interface ResultFlags {
  /** Human was behind at some point and still won. */
  comeback?: boolean;
  /** Final margin was tiny. */
  closeFinish?: boolean;
  /** The decisive card arrived at the very end / last draw. */
  luckyLastCard?: boolean;
  /** Won (or lost) a large amount relative to the stake (≥ 3 units). */
  bigPot?: boolean;
  /** Game-specific perfect play (e.g. natural Blackjack, shoot the moon, cleared Klondike). */
  perfect?: boolean;
  /** Human busted / went over / was eliminated by their own move. */
  bust?: boolean;
  /** Human folded / packed / gave up. */
  folded?: boolean;
  /** Free-form extra tags, e.g. 'blackjack', 'shootTheMoon', 'nil'. */
  tags?: string[];
}

export interface GameResult {
  winners: PlayerId[];
  /** Outcome from the human's (seat 0) point of view. */
  humanOutcome: 'win' | 'loss' | 'push';
  /**
   * Net result for the human in stake units: +1 = won one stake, −1 = lost the
   * stake, 1.5 = Blackjack 3:2, 0 = push. Jeet change = round(net × stake).
   * Must never be below −(1 + affordableUnits).
   */
  humanNetUnits: number;
  /** Optional per-seat scores (points, chips, cards left…) for the result screen. */
  scores?: number[];
  /** One plain-English sentence describing what happened. */
  summary: string;
  flags: ResultFlags;
}

export interface CoachAdvice {
  /** What is happening right now, in plain words. */
  situation: string;
  /** The move a pro would make (must be legal), if it is the player's turn. */
  suggestion?: unknown;
  /** Why that move is good, in plain words. */
  why?: string;
}

export interface GameEngine<S, M> {
  /** Must equal the game slug, e.g. 'blackjack'. */
  id: string;
  setup(config: GameConfig, rng: Rng): S;
  /** Whose decision it is right now; null when the game is over. */
  currentPlayer(state: S): PlayerId | null;
  /** Every legal move for `player` (empty if it is not their turn). */
  legalMoves(state: S, player: PlayerId): M[];
  /** Legality check with a beginner-friendly reason when illegal. */
  checkMove(state: S, player: PlayerId, move: M): MoveCheck;
  /** Pure state transition by the current player. Throws IllegalMoveError when illegal. */
  applyMove(state: S, move: M): S;
  isOver(state: S): boolean;
  /** Only valid when isOver(state). */
  result(state: S): GameResult;
  /** A legal move for `player`. 'easy' may be naive but must be legal; 'normal' should be sensible. */
  botMove(state: S, player: PlayerId, difficulty: Difficulty, rng: Rng): M;
  /** Short sentence for screen-reader announcements and the move log: "You hit and drew the 7 of Clubs." */
  describeMove(state: S, player: PlayerId, move: M): string;
  /** Plain-language coaching for `player` in the current state. suggestion should be an M. */
  coach(state: S, player: PlayerId): CoachAdvice;
  /** Stable string id for a move (used to compare moves and highlight legal ones). */
  moveKey(move: M): string;
}

export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalMoveError';
  }
}

/** Helper for engines: throw if the move is not legal. */
export function assertLegal<S, M>(
  engine: Pick<GameEngine<S, M>, 'checkMove' | 'currentPlayer'>,
  state: S,
  move: M,
): void {
  const player = engine.currentPlayer(state);
  if (player === null) throw new IllegalMoveError('The game is already over.');
  const check = engine.checkMove(state, player, move);
  if (!check.ok) throw new IllegalMoveError(check.reason ?? 'Illegal move.');
}
