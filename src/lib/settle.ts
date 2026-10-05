/**
 * Escrow betting maths (docs/DECISIONS.md D-04). Pure functions — the GameShell
 * calls them and applies the results to the wallet store.
 *
 * 1. Before the deal the shell escrows `stake × maxLossUnits` from the wallet.
 * 2. Engines may let the learner commit extra units (Blackjack doubles/splits) up to
 *    `affordableUnits`, i.e. what the remaining balance can cover.
 * 3. At the end: final = escrow + round(net × stake). Positive → credited back,
 *    negative (only possible with extra commitments) → debited.
 * 4. Abandoning a game mid-way forfeits exactly one stake (escrow − stake is refunded).
 */
export function escrowFor(stake: number, maxLossUnits: number): number {
  return Math.round(stake * maxLossUnits);
}

export function affordableUnits(balanceAfterEscrow: number, stake: number): number {
  if (stake <= 0) return 0;
  return Math.max(0, Math.floor(balanceAfterEscrow / stake));
}

export interface Settlement {
  /** Net Jeet change for the whole game (what the learner won or lost). */
  netJeet: number;
  /** Amount to credit back to the wallet (≥ 0). */
  credit: number;
  /** Extra amount to debit from the wallet (≥ 0). */
  debit: number;
}

export function settle(escrow: number, stake: number, netUnits: number): Settlement {
  const netJeet = Math.round(netUnits * stake);
  const final = escrow + netJeet;
  return final >= 0 ? { netJeet, credit: final, debit: 0 } : { netJeet, credit: 0, debit: -final };
}

/** Refund when a game is abandoned before it ends: everything except one stake. */
export function abandonRefund(escrow: number, stake: number): number {
  return Math.max(0, escrow - Math.round(stake));
}

/** Whether the wallet can cover the escrow for this stake. */
export function canAfford(balance: number, stake: number, maxLossUnits: number): boolean {
  return balance >= escrowFor(stake, maxLossUnits) && stake > 0;
}
