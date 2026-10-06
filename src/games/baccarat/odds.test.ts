import { describe, expect, it } from 'vitest';
import {
  bestBet,
  COUP_ODDS,
  computeCoupOdds,
  coupOdds,
  expectedNet,
  houseEdges,
  percent,
} from './odds';
import { MAX_DECKS, MIN_DECKS } from './rules';

describe('exact coup odds', () => {
  it('the built-in table is exactly what the full enumeration computes, for every shoe', () => {
    for (let decks = MIN_DECKS; decks <= MAX_DECKS; decks++) {
      const exact = computeCoupOdds(decks);
      const table = COUP_ODDS[decks]!;
      for (const w of ['player', 'banker', 'tie'] as const) {
        expect(table[w], `${decks} decks, ${w}`).toBeCloseTo(exact[w], 13);
      }
      expect(exact.player + exact.banker + exact.tie).toBeCloseTo(1, 10);
      expect(coupOdds(decks)).toBe(table);
    }
  });

  it('8 decks: Banker 45.86%, Player 44.62%, Tie 9.52% (the published figures)', () => {
    const o = coupOdds(8);
    expect(o.banker).toBeCloseTo(0.458597, 6);
    expect(o.player).toBeCloseTo(0.446247, 6);
    expect(o.tie).toBeCloseTo(0.095156, 6);
    expect(percent(o.banker)).toBe('45.86%');
    expect(percent(o.player)).toBe('44.62%');
    expect(percent(o.tie)).toBe('9.52%');
  });

  it('1 deck matches the published single-deck figures too', () => {
    const o = coupOdds(1);
    expect(o.banker).toBeCloseTo(0.459624, 6);
    expect(o.player).toBeCloseTo(0.44676, 6);
    expect(o.tie).toBeCloseTo(0.093615, 6);
  });

  it('house edges: Banker ≈ 1.06%, Player ≈ 1.24%, Tie ≈ 14.4% for 8 decks', () => {
    const e = houseEdges(8);
    expect(percent(e.banker)).toBe('1.06%');
    expect(percent(e.player)).toBe('1.24%');
    expect(percent(e.tie, 1)).toBe('14.4%');
    // Edge = −EV per unit: Banker 0.95·pB − pP, Player pP − pB, Tie 8·pT − (1 − pT).
    const o = coupOdds(8);
    expect(e.banker).toBeCloseTo(-(0.95 * o.banker - o.player), 12);
    expect(e.player).toBeCloseTo(o.banker - o.player, 12);
    expect(e.tie).toBeCloseTo(1 - 9 * o.tie, 10); // pP + pB + pT = 1 up to rounding
    expect(expectedNet('banker', o)).toBeCloseTo(-e.banker, 12);
  });

  it('Banker is the best bet and Tie the worst for every shoe size', () => {
    for (let decks = MIN_DECKS; decks <= MAX_DECKS; decks++) {
      const e = houseEdges(decks);
      expect(bestBet(decks)).toBe('banker');
      expect(e.banker).toBeLessThan(e.player);
      expect(e.player).toBeLessThan(e.tie);
      expect(e.banker).toBeGreaterThan(0);
    }
  });

  it('rejects shoe sizes the game does not support', () => {
    for (const d of [0, 9, 2.5, Number.NaN]) {
      expect(() => coupOdds(d)).toThrow(RangeError);
      expect(() => computeCoupOdds(d)).toThrow(RangeError);
    }
  });
});
