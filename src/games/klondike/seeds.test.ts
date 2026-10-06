/**
 * The curated Klondike seeds deal exactly what their names promise — checked with the real
 * engine, seeded the way the play shell (?seed=<n>, a string) and the practice hand (a
 * number) do, and played by "following the coach" (the coach's suggestion every turn).
 */
import { rankNumber } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { type GameConfig } from '@/games/core/types';
import {
  foundationCount,
  klondikeEngine as E,
  type KlondikeMove,
  type KlondikeState,
} from './engine';
import klondikeModule from './index';
import { KLONDIKE_SEEDS } from './seeds';

const PLAY_CONFIG: GameConfig = { ...klondikeModule.defaultConfig, affordableUnits: 99 };

function dealSeed(seed: number | string, config: GameConfig = PLAY_CONFIG): KlondikeState {
  return E.setup(config, createRng(seed));
}

interface Followed {
  final: KlondikeState;
  moves: KlondikeMove[];
}

/** Play the coach's suggestion every turn until the game ends. */
function followCoach(seed: number | string): Followed {
  let s = dealSeed(seed);
  const moves: KlondikeMove[] = [];
  while (!E.isOver(s)) {
    const m = E.coach(s, 0).suggestion as KlondikeMove | undefined;
    if (!m) throw new Error('The coach had no suggestion');
    moves.push(m);
    s = E.applyMove(s, m);
    if (moves.length > 400) throw new Error('Following the coach did not finish');
  }
  return { final: s, moves };
}

const isKingToEmpty = (s: KlondikeState, m: KlondikeMove) => {
  if (m.type !== 'move' || m.to.kind !== 'tableau') return false;
  const d = s.tableau[m.to.pile]!;
  return d.faceDown.length === 0 && d.faceUp.length === 0;
};

describe('KLONDIKE_SEEDS', () => {
  it('deal the same cards from the URL string, the number and the practice config', () => {
    for (const seed of Object.values(KLONDIKE_SEEDS)) {
      const fromNumber = dealSeed(seed);
      expect(dealSeed(String(seed))).toEqual(fromNumber);
      expect(
        dealSeed(seed, { ...klondikeModule.defaultConfig, ...klondikeModule.practice.config }),
      ).toEqual(fromNumber);
      expect(dealSeed(seed, { ...PLAY_CONFIG, affordableUnits: 0 })).toEqual(fromNumber);
    }
  });

  it('practice: three Aces face up, runs, Kings into empty columns and one recycle — cleared in 118', () => {
    expect(klondikeModule.practice.seed).toBe(KLONDIKE_SEEDS.practice);
    const start = dealSeed(KLONDIKE_SEEDS.practice);
    const tops = start.tableau.map((p) => p.faceUp[0]!);
    expect(tops.map((c, i) => (rankNumber(c) === 1 ? i + 1 : null)).filter(Boolean)).toEqual([
      4, 5, 7,
    ]);

    const { final, moves } = followCoach(KLONDIKE_SEEDS.practice);
    expect(moves).toHaveLength(118);
    expect(foundationCount(final)).toBe(52);
    expect(final.recycles).toBe(1);
    expect(E.result(final)).toMatchObject({ humanOutcome: 'win', humanNetUnits: 4 });

    // The coach opens by sending the three Aces home.
    expect(moves.slice(0, 3).every((m) => m.type === 'move' && m.to.kind === 'foundation')).toBe(
      true,
    );
    // Along the way: a run of several cards moves, and a King fills an empty column.
    let s = start;
    let runs = 0;
    let kings = 0;
    for (const m of moves) {
      if (m.type === 'move' && m.from.kind === 'tableau' && m.to.kind === 'tableau') {
        if (s.tableau[m.from.pile]!.faceUp.length - m.from.index > 1) runs++;
      }
      if (isKingToEmpty(s, m)) kings++;
      s = E.applyMove(s, m);
    }
    expect(runs).toBeGreaterThan(0);
    expect(kings).toBeGreaterThanOrEqual(1);
  });

  it('quickClear: the coach clears all 52 cards in 105 moves', () => {
    const { final, moves } = followCoach(KLONDIKE_SEEDS.quickClear);
    expect(moves).toHaveLength(105);
    expect(foundationCount(final)).toBe(52);
    expect(E.result(final).flags.perfect).toBe(true);
  });

  it('quickLoss: nothing reaches a foundation and the coach stops after 39 moves', () => {
    const { final, moves } = followCoach(KLONDIKE_SEEDS.quickLoss);
    expect(moves).toHaveLength(39);
    expect(moves.at(-1)).toEqual({ type: 'resign' });
    expect(foundationCount(final)).toBe(0);
    expect(E.result(final)).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -1 });
  });

  it('partialWin: 13 cards home after 47 moves — a quarter of the stake ahead', () => {
    const { final, moves } = followCoach(KLONDIKE_SEEDS.partialWin);
    expect(moves).toHaveLength(47);
    expect(foundationCount(final)).toBe(13);
    const r = E.result(final);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBeCloseTo(0.25, 10);
  });

  it('breakEven: exactly 11 cards home — the smallest win, decided by the last card', () => {
    const { final } = followCoach(KLONDIKE_SEEDS.breakEven);
    expect(foundationCount(final)).toBe(11);
    const r = E.result(final);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBeCloseTo(3 / 52, 10);
    expect(r.flags.luckyLastCard).toBe(true);
  });
});
