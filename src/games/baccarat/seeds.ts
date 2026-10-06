/**
 * Curated coups for the coached practice hand, deterministic E2E tests and screenshots
 * (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` → `baccaratEngine.setup`,
 * exactly as `/games/baccarat/play?seed=<n>` and the practice hand do (a number and its
 * decimal string hash to the same shoe, so `?seed=9` deals the `tie` coup).
 *
 * The cards do not depend on the bet — the dealer deals the same coup whatever the learner
 * picks — so each seed is described by the coup itself. Every property is asserted with the
 * real engine in seeds.test.ts; each is the smallest seed (searching from 1) with that coup.
 */
export const BACCARAT_SEEDS = {
  /**
   * The coached practice coup (the engine's PRACTICE_SEED): Player K♣ 2♦ = 2 draws the 3♦
   * for 5; Banker J♣ 4♦ = 4 must check the third-card table (Player's third card is a 3, in
   * 2–7) and draws the 5♣ for 9. Banker wins 9 to 5, so following the coach (bet Banker)
   * wins, and every drawing rule gets explained on the way. One bet + six cards.
   */
  practice: 5,
  /** Banker's first two cards (6♣ 3♦) make a natural 9 against Player's 7: four cards, Banker wins. */
  bankerNatural: 1,
  /** Player's first two cards (3♦ 5♦) make a natural 8 against Banker's 2: a Banker bet loses at once. */
  playerNatural: 2,
  /**
   * Both hands finish on 8 (Player A♣ A♦ + 6♦, Banker 10♦ 5♣ + 3♥): a tie, so a Banker or
   * Player bet pushes and a Tie bet pays 8 to 1.
   */
  tie: 9,
  /** Player 5♣ A♥ = 6 stands, Banker 8♥ 9♣ = 7 stands: four cards, Banker wins 7 to 6. */
  bothStand: 10,
  /** Player 9♥ 8♠ = 7 stands; Banker A♦ 4♥ = 5 draws the 5♠ and makes 0: Player wins 7 to 0. */
  playerStandsBankerDraws: 3,
} as const satisfies Record<string, number>;

export type BaccaratSeedName = keyof typeof BACCARAT_SEEDS;
