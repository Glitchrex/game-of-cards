/**
 * Curated deals for the coached practice hand, deterministic E2E tests and screenshots
 * (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` → `texasHoldemEngine.setup`
 * with the default 4 seats, exactly as `/games/texas-holdem/play?seed=<n>` and the practice
 * hand do (a number and its decimal string hash to the same deal). The bots draw their
 * decisions from `createRng('bot-<seed>')`, as the game controller does, so a learner who
 * follows the coach (or makes the same moves) sees the same hand every time.
 *
 * Every property described here is asserted with the real engine and the normal bots in
 * seeds.test.ts. They were found by simulating seeds 1–3000 with the learner following the
 * coach, keeping the smallest seed for each situation (1088 for the practice hand).
 */
export const TEXASHOLDEM_SEEDS = {
  /**
   * The coached practice hand: A♠ K♠ in the small blind. Two players fold, the coach raises
   * and Maestro Moti (K♦ J♦) calls. The flop (8♠ Q♠ K♣) gives a pair of Kings plus a flush
   * draw — bet; the turn (8♦) makes two pair — bet again; the river (5♠) completes the
   * Ace-high flush — all-in, called. The learner wins the 200-chip pot at the showdown in
   * four decisions (ten moves in all): position, raising good hands, value bets, draws and
   * the showdown.
   */
  practice: 1088,
  /** A♥ K♥: the coach raises, everyone folds → a quick +2 win without a showdown. */
  quickWin: 39,
  /** 7♦ A♠ on the button facing a raise: the coach folds, nothing was bet → a push. */
  foldPush: 12,
  /** The small blind (2♣ A♠) folds to a raise: the blind is lost → −1. */
  foldLoss: 17,
  /**
   * Q♣ Q♦ re-raises, Lakshmi Ledger moves all-in with K♠ K♥ and the coach calls: the board
   * misses both and the Kings win → the whole 100-chip stack is lost at the showdown.
   */
  showdownLoss: 778,
  /**
   * Q♠ Q♥ re-raises, Lakshmi Ledger moves all-in with A♣ A♠ and the coach calls: the board
   * (6♥ 4♥ 6♦ Q♦ 5♥) makes Queens full of Sixes → +108 chips.
   */
  showdownWin: 326,
  /**
   * A♠ A♦ against Bunty Popcorn's A♥ A♣, all-in before the flop: both make Two Pair, Aces
   * and Sixes and split the 200-chip pot → a push.
   */
  splitPot: 175,
} as const satisfies Record<string, number>;

export type TexasHoldemSeedName = keyof typeof TEXASHOLDEM_SEEDS;
