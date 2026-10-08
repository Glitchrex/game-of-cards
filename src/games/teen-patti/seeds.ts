/**
 * Curated deals for the coached practice hand, deterministic E2E tests and screenshots
 * (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` → `teenPattiEngine.setup`
 * with the module's default 3-seat config, exactly as `/games/teen-patti/play?seed=<n>` and
 * the practice hand do; the bots draw from `createRng('bot-<seed>')` (the controller's bot
 * stream), so a number and its decimal string replay the same hand.
 *
 * Each story assumes the learner follows the coach ("What would a pro do?") and the bots
 * play at the normal level (the bet panel's default). Every claim is asserted with the real
 * engine in seeds.test.ts; they were found by simulating seeds 1–400 and keeping the
 * smallest seed for each situation.
 */
export const TEENPATTI_SEEDS = {
  /**
   * The coached practice hand (10 moves, 3 by the learner). Bindiya Bioscope (seat 2) raises
   * blind, the learner chaals blind for 2 and everyone chaals once more; then the learner
   * sees a Pair of Kings and raises (the stake goes 2 → 4). Chacha Chaalbaaz (seat 1) sees
   * and packs; Bindiya sees and asks for a show, and the Kings beat a Pair of Fours: +16
   * boots. It shows blind and seen prices, seeing, raising, packing and a show.
   */
  practice: 48,
  /**
   * One blind chaal is all it takes: seat 1 sees and packs, seat 2 sees and asks for a show,
   * and the learner's unseen High card, Ace beats a King-high hand: +6 boots, won blind.
   */
  blindWin: 9,
  /** One blind chaal, then both bots see their cards and pack: last player standing, +4. */
  everyonePacks: 55,
  /**
   * One blind chaal, seat 1 packs and seat 2 asks for a show — and its Ace-high hand beats
   * the learner's Ace-high on the second card: −2 boots.
   */
  quickLoss: 12,
  /** The learner chaals blind, sees a High card, Eight and packs on the coach's advice: −2. */
  packed: 20,
  /**
   * A big pot: the learner sees a Colour (Queen high) and raises twice; the next chaal brings
   * the pot to the 64-boot limit and everyone still in shows. Seat 1's Sequence wins: −36.
   */
  potLimit: 56,
} as const satisfies Record<string, number>;

export type TeenPattiSeedName = keyof typeof TEENPATTI_SEEDS;
