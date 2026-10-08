/**
 * The escrow maths the play shell applies (src/lib/settle.ts, docs/DECISIONS.md D-04),
 * checked end to end against a real engine: whatever the learner does — hit, stand,
 * double, split, double after a split — and however little Jeet is left, the wallet ends
 * at exactly `balance + round(net × stake)` and never below zero.
 */
import { blackjackEngine as E } from '@/games/blackjack/engine';
import blackjackModule from '@/games/blackjack/index';
import { createRng } from '@/games/core/rng';
import { abandonRefund, affordableUnits, escrowFor, settle } from '@/lib/settle';

const { betting, defaultConfig } = blackjackModule;

interface Round {
  balance: number;
  stake: number;
  seed: number;
}

/** Plays one hand with random (but legal) learner moves, exactly as the shell would bet it. */
function playRound({ balance, stake, seed }: Round) {
  const escrow = escrowFor(stake, betting.maxLossUnits);
  const after = balance - escrow;
  const config = { ...defaultConfig, affordableUnits: affordableUnits(after, stake) };
  const pick = createRng(`moves-${seed}`);
  let state = E.setup(config, createRng(seed));
  let extraMoves = 0;
  for (let guard = 0; !E.isOver(state); guard++) {
    if (guard > 60) throw new Error(`seed ${seed} did not finish`);
    const player = E.currentPlayer(state);
    if (player === null) break;
    const moves = E.legalMoves(state, player);
    const move = moves[player === 0 ? pick.int(moves.length) : 0];
    if (!move) throw new Error(`seed ${seed}: no legal move for seat ${player}`);
    if (move.type === 'double' || move.type === 'split') extraMoves++;
    state = E.applyMove(state, move);
  }
  const result = E.result(state);
  const s = settle(escrow, stake, result.humanNetUnits);
  return { escrow, after, s, net: result.humanNetUnits, extraMoves };
}

describe('escrow settlement with the real Blackjack engine', () => {
  it('always ends at balance + net × stake and never below zero', () => {
    const rng = createRng('wallets');
    let doubledOrSplit = 0;
    let debited = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const stake = betting.stakeOptions[rng.int(betting.stakeOptions.length)]!;
      // Mostly tight wallets, so the "can't afford a double/split" limit is exercised.
      const balance = escrowFor(stake, betting.maxLossUnits) + stake * rng.int(4) + rng.int(stake);
      const { after, s, net, extraMoves } = playRound({ balance, stake, seed });

      const final = after + s.credit - s.debit;
      expect(final).toBe(balance + Math.round(net * stake));
      expect(final).toBeGreaterThanOrEqual(0);
      expect(s.debit).toBeLessThanOrEqual(after);
      expect(s.credit === 0 || s.debit === 0).toBe(true);
      if (extraMoves > 0) doubledOrSplit++;
      if (s.debit > 0) debited++;
    }
    // The random play really did reach the interesting cases.
    expect(doubledOrSplit).toBeGreaterThan(300);
    expect(debited).toBeGreaterThan(50);
  });

  it('forfeits exactly one stake when a hand is abandoned', () => {
    for (const stake of betting.stakeOptions) {
      const escrow = escrowFor(stake, betting.maxLossUnits);
      expect(escrow - abandonRefund(escrow, stake)).toBe(stake);
    }
  });
});
