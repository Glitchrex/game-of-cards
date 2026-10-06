/**
 * Curated deals for the coached practice hand, deterministic E2E tests and screenshots
 * (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` → `blackjackEngine.setup`,
 * exactly as `/games/blackjack/play?seed=<n>` and the practice hand do (a number and its
 * decimal string hash to the same deal, so `?seed=10` deals the `naturalWin` hand).
 *
 * Every property described here is asserted with the real engine in seeds.test.ts. They
 * were found by simulating seeds 1–20000 and keeping the smallest seed for each situation.
 */
export const BLACKJACK_SEEDS = {
  /**
   * The coached practice hand: hard 13 (7♣ 6♠) against a dealer 6. Basic strategy says
   * stand; standing lets the dealer (6 + 10 = 16) draw a 10 and bust, while hitting would
   * have drawn that 10 and busted the learner — the classic "let the dealer bust" lesson.
   */
  practice: 56,
  /** The learner is dealt a natural Blackjack (J♠ A♥) and the dealer is not → 3:2 win. */
  naturalWin: 10,
  /** The dealer peeks and has Blackjack (K♥ A♦) against the learner's 14 → immediate loss. */
  dealerBlackjack: 3,
  /** Hard 16 (6♠ J♣) and the next card is a 10: hitting once busts the learner. */
  bustOnHit: 4,
  /**
   * A pair of 7s against a dealer 6: splitting makes 16 and 13, standing on both lets the
   * dealer (16) bust → both hands win.
   */
  splitWin: 864,
  /** 11 (6♥ 5♣) against a dealer 3: doubling down draws a Jack for 21 and wins two bets. */
  doubleWin: 162,
  /** 20 (K♦ K♥) against a dealer 4 + 6: standing ties the dealer's 20 → push. */
  push: 8,
  /**
   * Soft 15 (4♣ A♥) against a dealer 5: the coach says double, the Queen makes a hard 15 and
   * the dealer (5 + 7, then a 6) reaches 18 → both bets lost (an extra debit at settlement).
   */
  doubleLoss: 65,
  /**
   * A pair of 6s against a dealer 4: split, then stand on soft 17 (6 + A) and 15 (6 + 9);
   * the dealer (4 + J, then a 4) makes 18 → both split hands lose.
   */
  splitLoss: 87,
  /**
   * A pair of 7s against a dealer 2: split, then stand on soft 18 (7 + A) and 12 (7 + 5); the
   * dealer (2 + Q, then a 5) stands on 17 → one hand wins, one loses: the round is a push.
   */
  splitPush: 492,
} as const satisfies Record<string, number>;

export type BlackjackSeedName = keyof typeof BLACKJACK_SEEDS;
