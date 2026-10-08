/**
 * Curated deals for the coached practice hand, deterministic E2E tests and screenshots
 * (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` → `crazyEightsEngine.setup`
 * with the default 3-player table, exactly as `/games/crazy-eights/play?seed=<n>` and the
 * practice hand do (a number and its decimal string hash to the same deal). Bots use
 * `createRng('bot-<seed>')`, as the controller does.
 *
 * "Following the coach" means playing `coach(state, 0).suggestion` on every learner turn,
 * against normal bots. Every property described here is asserted with the real engine in
 * seeds.test.ts; each seed is the smallest one (from simulating 1–5000) with its property,
 * except the practice seed, which was picked for the lesson it tells.
 */
export const CRAZY_EIGHTS_SEEDS = {
  /**
   * The coached practice hand: 2♠ K♠ 8♥ 7♣ Q♦ against a K♦ starter. The opening choice is a
   * suit match (Q♦), a rank switch (K♠) or the wild 8♥; the coach switches with the K♠,
   * later saves the Eight until nothing else matches and names Clubs with it, and the
   * learner goes out in 5 plays without drawing — a 2-unit win against normal bots (it
   * also wins against easy bots).
   */
  practice: 1344,
  /** The quickest win: following the coach goes out in 5 plays (13 moves in all). */
  quickWin: 36,
  /** The quickest loss: following the coach, a bot still goes out first (15 moves). */
  quickLoss: 89,
  /** The coach's very first suggestion is a wild Eight, so the suit chooser opens. */
  eightFirst: 3,
  /** Nothing in the opening hand matches: the learner's only move is to draw. */
  mustDraw: 8,
  /** Following the coach, the learner goes out with an Eight (the "lucky last card"). */
  eightFinish: 38,
  /** Following the coach, the stock runs out and nobody can play: a blocked game. */
  blocked: 9,
} as const satisfies Record<string, number>;

export type CrazyEightsSeedName = keyof typeof CRAZY_EIGHTS_SEEDS;
