/**
 * Curated deals for the coached practice hand, deterministic E2E tests and screenshots
 * (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` → `indianRummyEngine.setup`
 * exactly as the shell does: the practice hand uses `{ ...defaultConfig, ...practice.config }`
 * (the bot deals, so the learner plays first) and `/games/indian-rummy/play?seed=<n>` uses
 * `defaultConfig` (the dealer comes from the seed). A number and its decimal string hash to
 * the same deal.
 *
 * "Follow the coach" means playing `engine.coach(state, 0).suggestion` on every turn, with
 * the normal bot seeded as the controller seeds it (`createRng('bot-<seed>')`). Every claim
 * here is asserted with the real engine in seeds.test.ts; each is the smallest seed in 1–400
 * with that property.
 */
export const INDIAN_RUMMY_SEEDS = {
  /**
   * The coached practice hand (practice config). The 8♦ is the wild-joker card and a printed
   * joker tops the open pile. Following the coach, the learner picks that joker up, draws the
   * second printed joker, takes the 10♣ from the open pile to make a pure sequence (9♣ 10♣ J♣),
   * and declares on their fifth turn: a pure sequence, an impure sequence held together by two
   * jokers (5♣ 6♣ + 2 jokers) and two sets (2s and Kings). Dadi Diamond pays 71 points.
   */
  practice: 10,
  /**
   * Play mode: the learner plays first and, following the coach, declares on their fourth turn
   * against the normal bot — Dadi Diamond pays 14 points.
   */
  quickWin: 3,
  /**
   * Play mode: the learner plays first, follows the coach, and the normal bot declares after
   * the learner's second turn — the learner pays 16 points for their loose cards.
   */
  quickLoss: 51,
} as const satisfies Record<string, number>;

export type IndianRummySeedName = keyof typeof INDIAN_RUMMY_SEEDS;
