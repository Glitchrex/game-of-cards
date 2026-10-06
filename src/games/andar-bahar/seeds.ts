/**
 * Curated deals for the coached practice hand, deterministic E2E tests and screenshots
 * (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` → `andarBaharEngine.setup`,
 * exactly as `/games/andar-bahar/play?seed=<n>` and the practice hand do (a number and its
 * decimal string hash to the same deal, so `?seed=2` deals the `quickAndarWin` deal).
 *
 * Every property described here is asserted with the real engine in seeds.test.ts. They
 * were found by simulating seeds 1–3000 and keeping the smallest seed for each situation.
 */
export const ANDARBAHAR_SEEDS = {
  /**
   * The coached practice deal: the joker is the 7♥ (the same joker as the lesson). The coach
   * suggests Andar; the dealer alternates Andar, Bahar, … and the 7♠ lands on Andar as card 9
   * — long enough to watch the alternation and the live odds, short enough to stay exciting.
   */
  practice: 6,
  /** The 6♠ joker; the 6♦ lands on Andar as card 3 — a quick Andar win (closeFinish). */
  quickAndarWin: 2,
  /** The very first card matches on Andar (a "first-card-match", luckyLastCard). */
  firstCardMatch: 16,
  /** The second card matches, so Bahar wins at once: an Andar bet loses, a Bahar bet wins 1:1. */
  quickBaharWin: 63,
  /** The Q♠ joker; the Q♥ lands on Bahar as card 8 — following the coach (Andar) loses. */
  baharWin: 11,
  /** A long nail-biter: the T♥ matches on Bahar as card 28 (a "long-deal"). */
  longDeal: 8,
} as const satisfies Record<string, number>;

export type AndarBaharSeedName = keyof typeof ANDARBAHAR_SEEDS;
