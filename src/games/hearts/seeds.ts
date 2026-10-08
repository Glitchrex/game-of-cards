/**
 * Curated Hearts deals for the coached practice hand, deterministic E2E tests and
 * screenshots (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` →
 * `heartsEngine.setup({ players: 4 })`, exactly as `/games/hearts/play?seed=<n>` and the
 * practice hand do (a number and its decimal string hash to the same deal).
 *
 * "Following the coach" means the learner always plays `coach(state, 0).suggestion` (what
 * "What would a pro do?" shows) against the normal bots. Normal bots are deterministic, so
 * each seed below always ends the same way. Every claim is asserted in seeds.test.ts; they
 * were found by simulating seeds 1–3000 and keeping the smallest seed for each situation.
 */
export const HEARTS_SEEDS = {
  /**
   * The coached practice hand. The learner is dealt the Q♠, A♠ and A♥ — the coach passes
   * exactly those three danger cards, then shows following suit, a first-trick Club, being
   * void (dumping high Hearts on other players' tricks) and breaking Hearts. Following the
   * coach wins with 0 points in 14 learner moves (one pass + 13 cards).
   */
  practice: 73,
  /** Following the coach takes no points: a sole win (+3 stakes). */
  soleWin: 3,
  /** Following the coach takes 0 points, tied with Usherette Tilly: a shared win (+1 stake). */
  sharedWin: 1,
  /**
   * After the exchange the learner holds the 2♣, so the learner must lead it (the only
   * legal card); following the coach ends in a shared win (+1 stake).
   */
  leadTwoOfClubs: 2,
  /** Following the coach still loses by a single point (1 vs Auntie Bubbles' 0): −1 stake. */
  loss: 4,
  /** The Q♠ arrives in the pass and ends up in the learner's tricks: a loss with 19 points. */
  queenLoss: 8,
  /** The coach shoots the moon: the learner takes all 26 points, scores 0, everyone else 26. */
  moonShot: 1534,
  /** Auntie Bubbles shoots the moon, so the learner (with 0 points taken) scores 26 and loses. */
  opponentMoon: 78,
} as const satisfies Record<string, number>;

export type HeartsSeedName = keyof typeof HEARTS_SEEDS;
