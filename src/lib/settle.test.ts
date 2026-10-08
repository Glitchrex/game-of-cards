import { abandonRefund, affordableUnits, canAfford, escrowFor, settle } from './settle';

describe('escrow settlement', () => {
  it('escrows stake × maxLossUnits', () => {
    expect(escrowFor(10, 64)).toBe(640);
    expect(escrowFor(25, 1)).toBe(25);
  });

  it('credits escrow + winnings on a win', () => {
    expect(settle(25, 25, 1.5)).toEqual({ netJeet: 38, credit: 63, debit: 0 });
    expect(settle(100, 100, 1)).toEqual({ netJeet: 100, credit: 200, debit: 0 });
  });

  it('returns escrow on a push and nothing on a full loss', () => {
    expect(settle(50, 50, 0)).toEqual({ netJeet: 0, credit: 50, debit: 0 });
    expect(settle(50, 50, -1)).toEqual({ netJeet: -50, credit: 0, debit: 0 });
  });

  it('refunds the unused part of a large escrow (pot games)', () => {
    // Teen Patti: 10 Jeet boot, 64 boots escrowed, lost 5 boots.
    expect(settle(640, 10, -5)).toEqual({ netJeet: -50, credit: 590, debit: 0 });
  });

  it('debits extra when the learner committed more than the escrow (double down)', () => {
    expect(settle(25, 25, -2)).toEqual({ netJeet: -50, credit: 0, debit: 25 });
  });

  it('computes affordable extra units and abandon refunds', () => {
    expect(affordableUnits(99, 25)).toBe(3);
    expect(affordableUnits(10, 25)).toBe(0);
    expect(abandonRefund(640, 10)).toBe(630);
    // Pot games: leaving forfeits the whole escrow (no cheap escape from a big pot).
    expect(abandonRefund(640, 10, 64)).toBe(0);
    expect(abandonRefund(25, 25, 1)).toBe(0);
    expect(abandonRefund(25, 25)).toBe(0);
    expect(canAfford(100, 25, 1)).toBe(true);
    expect(canAfford(100, 10, 64)).toBe(false);
  });
});
