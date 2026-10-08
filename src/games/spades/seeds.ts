/**
 * Curated Spades deals for the coached practice hand, deterministic E2E tests and
 * screenshots (docs/DECISIONS.md D-15). A seed goes through `createRng(seed)` →
 * `spadesEngine.setup({ players: 4 })`, exactly as `/games/spades/play?seed=<n>` and the
 * practice hand do (a number and its decimal string hash to the same deal). The dealer is
 * part of the deal, so the seed also decides who bids first.
 *
 * "Following the coach" means the learner always plays `coach(state, 0).suggestion` (what
 * "What would a pro do?" shows) against the normal bots. Normal bots are deterministic, so
 * each seed below always ends the same way. Every claim is asserted in seeds.test.ts; they
 * were found by simulating seeds 1–400 and keeping the smallest seed for each situation.
 */
export const SPADES_SEEDS = {
  /**
   * The coached practice hand. Lady Limelight (seat 3) deals, so the learner bids first
   * and leads the first trick. The coach bids 3, the team
   * contract is 6 against the opponents' 4, the learner trumps once when void, and the
   * team makes its bid exactly to win 60–43 (14 learner moves: one bid and 13 cards).
   */
  practice: 74,
  /** The learner bids first; following the coach wins 72–40. */
  win: 10,
  /** The learner bids first; the team makes its bid exactly but still loses 50–62. */
  loss: 1,
  /** The opponents bid first; following the coach loses 41–80. */
  botsBidFirst: 2,
  /** The coach bids Nil for the learner, the Nil holds and the team wins 161–60. */
  nilWin: 94,
  /** An opponent bids Nil and makes it: the learner's team loses 72–140. */
  opponentNil: 4,
  /** The learner's team is set (−80) and loses to 52. */
  set: 5,
  /** The opponents are set (−60) and the learner's team wins with 71. */
  setOpponents: 3,
} as const satisfies Record<string, number>;

export type SpadesSeedName = keyof typeof SPADES_SEEDS;
