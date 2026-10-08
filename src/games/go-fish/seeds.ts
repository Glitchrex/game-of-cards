/**
 * Curated deals for the coached practice hand, deterministic E2E tests and screenshots
 * (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` → `goFishEngine.setup`
 * with the default three-player table, exactly as `/games/go-fish/play?seed=<n>` and the
 * practice hand do (a number and its decimal string hash to the same deal).
 *
 * Each description assumes the learner follows the coach's suggestion on every turn and
 * the bots play at the default "normal" level (the normal bot is deterministic). Every
 * property described here is asserted with the real engine in seeds.test.ts. They were
 * found by simulating seeds 1–1500.
 */
export const GOFISH_SEEDS = {
  /**
   * The coached practice hand: the very first ask catches a card, the second hears "Go
   * Fish!", later the coach points at a player who is KNOWN to hold a rank (they asked for
   * it), the learner fishes a wish from the pond — and wins a close 5–4–4 game in 16 asks.
   */
  practice: 14,
  /** A big comeback: the learner trails by 3 books, then wins 7–2–4 (perfect: 7 books). */
  soleWin: 167,
  /** A tie for the most books (5–3–5): the learner shares the pot, +½ stake. */
  sharedWin: 135,
  /** A quick loss: the learner makes no books at all (0–4–9) in 10 asks. */
  loss: 1106,
} as const satisfies Record<string, number>;

export type GoFishSeedName = keyof typeof GOFISH_SEEDS;
