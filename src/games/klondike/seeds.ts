/**
 * Curated Klondike deals for the coached practice hand, deterministic E2E tests and
 * screenshots (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` →
 * `klondikeEngine.setup({ players: 1 })`, exactly as `/games/klondike/play?seed=<n>` and the
 * practice hand do (a number and its decimal string deal the same cards).
 *
 * "Following the coach" means playing `engine.coach(state, 0).suggestion` every turn — what
 * a learner gets by pressing "What would a pro do?" (or "Play it for me") each time. Every
 * claim below is asserted with the real engine in seeds.test.ts; the seeds were found by
 * simulating seeds 1–3000 that way.
 */
export const KLONDIKE_SEEDS = {
  /**
   * The coached practice hand: three Aces face up in the opening deal (columns 4, 5 and 7),
   * so the learner sends them home and turns over hidden cards straight away; then runs move
   * between columns, Kings fill empty columns, the waste is turned over once, and the coach
   * clears all 52 cards in 118 moves.
   */
  practice: 249,
  /** Following the coach clears the board fastest of all: 52 cards home in 105 moves. */
  quickClear: 1502,
  /**
   * A short game the coach cannot rescue: it finds no card to send home and says "I'm done"
   * after 39 moves — the whole stake is lost (a roast).
   */
  quickLoss: 98,
  /** A short partial win: the coach banks 13 cards and stops after 47 moves (net +0.25). */
  partialWin: 2903,
  /** Exactly 11 cards home — the smallest win (net 5 × 11 ÷ 52 − 1 = +3/52), the "last card decided it" flag. */
  breakEven: 148,
} as const satisfies Record<string, number>;

export type KlondikeSeedName = keyof typeof KLONDIKE_SEEDS;
