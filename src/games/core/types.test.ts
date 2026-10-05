import { describe, expect, it } from 'vitest';
import { IllegalMoveError, assertLegal, type MoveCheck, type PlayerId } from './types';

interface S {
  turn: PlayerId | null;
}

const engine = {
  currentPlayer: (s: S) => s.turn,
  checkMove: (_s: S, player: PlayerId, move: string): MoveCheck => {
    if (move === 'ok') return { ok: true };
    if (move === 'silent') return { ok: false };
    return { ok: false, reason: `Player ${player} can't play ${move} — follow suit!` };
  },
};

describe('IllegalMoveError', () => {
  it('is a named Error subclass', () => {
    const err = new IllegalMoveError('Nope');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(IllegalMoveError);
    expect(err.name).toBe('IllegalMoveError');
    expect(err.message).toBe('Nope');
  });
});

describe('assertLegal', () => {
  it('passes for a legal move by the current player', () => {
    expect(() => assertLegal(engine, { turn: 1 }, 'ok')).not.toThrow();
  });

  it('throws the beginner-friendly reason for an illegal move, checked for the current player', () => {
    expect(() => assertLegal(engine, { turn: 2 }, '7H')).toThrow(IllegalMoveError);
    expect(() => assertLegal(engine, { turn: 2 }, '7H')).toThrow(
      "Player 2 can't play 7H — follow suit!",
    );
  });

  it('falls back to a generic message when no reason is given', () => {
    expect(() => assertLegal(engine, { turn: 0 }, 'silent')).toThrow('Illegal move.');
  });

  it('refuses any move once the game is over', () => {
    expect(() => assertLegal(engine, { turn: null }, 'ok')).toThrow(IllegalMoveError);
    expect(() => assertLegal(engine, { turn: null }, 'ok')).toThrow('The game is already over.');
  });
});
