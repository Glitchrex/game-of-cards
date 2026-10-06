/**
 * Curated deals for the coached practice game, deterministic E2E tests and screenshots
 * (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` → `warEngine.setup`,
 * exactly as `/games/war/play?seed=<n>` and the practice hand do (a number and its decimal
 * string hash to the same deal, so `?seed=1891` deals the `quickWin` game).
 *
 * Every property described here is asserted with the real engine in seeds.test.ts. They
 * were found by playing seeds 1–3000 to the end (in War the learner only ever flips, so a
 * seed fixes the whole game) and keeping the smallest seed for each situation.
 */
export const WAR_SEEDS = {
  /**
   * The coached practice game (20 battles, see `WAR_PRACTICE_BATTLES`): the learner wins
   * the first two battles with a higher card, then battle 3 is a tie of Aces → a war, won
   * with a third Ace for all 10 cards. Battles 4 and 5 go the other way (luck cuts both
   * ways), and at the 20-battle cap the learner holds 36 cards to 16 → a win.
   */
  practice: 6,
  /** Full rules: the learner wins three wars and takes all 52 cards in just 18 battles. */
  quickWin: 1891,
  /**
   * Full rules: the opponent takes all 52 cards in 11 battles — battle 5 is a triple war
   * (26 cards), and the last war is fought by a learner with only 3 cards left.
   */
  quickLoss: 2616,
  /** Full rules: the game reaches the 60-battle cap and the learner wins on cards, 38–14. */
  capWin: 4,
  /** Full rules: battle 1 is a war (won by the learner); after 60 battles it's 26–26 → push. */
  push: 16,
  /**
   * Full rules: battle 60, the very last one, is a war of Aces the learner wins, 36–16;
   * losing it would have left a 26–26 push (the `luckyLastCard` flag).
   */
  luckyLastCard: 8,
} as const satisfies Record<string, number>;

/** The coached practice game is short: 20 battles instead of the full game's 60. */
export const WAR_PRACTICE_BATTLES = 20;

export type WarSeedName = keyof typeof WAR_SEEDS;
