### Teen Patti

**Variant taught:** classic **Teen Patti** (blind/seen betting, no side show) for 2–5
players, **one deal per game** (D-05). This is what the engine (`src/games/teen-patti/`) and the
lesson (`content/games/teen-patti.ts`) both implement.

**Rules as taught and implemented**

- One standard 52-card deck, no jokers. 3 seats by default (learner + 2 bots); 2–5 supported.
- The dealer is chosen by the seed. Everyone posts a **boot** of 1 unit (1 unit = 1 boot).
  Three cards each are dealt face down, one at a time, starting on the dealer's left; that
  player acts first and play continues clockwise (to the next seat number).
- Everyone starts **blind**. On your turn you may:
  - **See** — look at your cards (free). You are now **seen** and act again immediately.
  - **Chaal** — bet the current **stake** if blind, **2× the stake** if seen.
  - **Raise** — bet double a chaal (blind 2× stake, seen 4× stake); the stake doubles.
    Only allowed while the new stake stays within the **chaal limit of 8 boots** (so the
    stake goes 1 → 2 → 4 → 8).
  - **Show** — only when exactly two players are left; costs the same as a chaal. Both
    hands are compared; the better hand takes the pot; **exactly equal hands → the player
    who asked loses**. Blind players may ask for a show too.
  - **Pack** — fold; you lose what you have put in.
- **Pot limit 64 boots.** If a bet (chaal, raise or show) would bring the pot to 64 or more,
  it is reduced so the pot is exactly 64. For a chaal or raise, every player still in then
  shows: the best hand wins; equal best hands split the pot.
- **Last player standing** (everyone else packed) wins the pot without showing.
- **Hand ranking**: Trail (three of a kind) > Pure sequence (straight flush) > Sequence
  (straight) > Colour (flush) > Pair > High card. Sequences rank **A-K-Q** (highest),
  **A-2-3** (second), then K-Q-J, Q-J-10 … down to 4-3-2; sequences never wrap (K-A-2 is
  Ace high). Same category: compare card by card from the highest (Ace high); pairs compare
  the pair, then the odd card. Suits never break ties.
- **Betting / units**: humanNetUnits = boots won − boots put in. Worst case = the whole capped
  pot, so `maxLossUnits` = 64 (stake = Jeet per boot: 5/10/20).

**Decisions / simplifications and why**

- **No side show** (a seen player asking the previous seen player for a private compare).
  It adds a second, conditional compare rule that confuses first-timers; it is described in
  Variants.
- **Pot limit 64 and chaal limit 8** (boots) keep a single hand short and cap the worst case
  so the D-04 escrow (64 units) always covers the learner. They are exposed as engine options
  (`potLimit` ≤ 64, `stakeLimit` ∈ {1, 2, 4, 8}) but the site uses the defaults.
- **A show that itself hits the pot limit** is still a _requested_ show: its cost is capped,
  only the two players compare, and the asker loses an exact tie. (Only chaal/raise bets
  trigger the "everyone shows, ties split" pot-limit show.)
- **Split pots** are paid in whole boots: each winner gets an equal share and any odd boot
  goes to the winner nearest the dealer's left (the usual odd-chip convention).
- **Show cost when blind vs seen** follows the chaal price of the asker (blind = stake,
  seen = 2× stake). No rule stops a seen player asking a blind player for a show — some
  tables forbid it; we keep the single, simple rule "two left → either may ask".
- **Seeing is a move on your turn** (not "any time"), so the UI can animate it and the
  learner then chooses their bet with the cards in view.
- **Dealing happens at setup** (no forced dealer moves): every card is dealt before the first
  decision, so the UI animates the whole deal at the start of the game.
- **A-2-3 is the second-best sequence**, as fixed in `docs/RULES_DECISIONS.md`. Conventions
  vary between groups (some rank A-2-3 as the very top or the very bottom sequence); this is
  mentioned in Variants.

**Engine result flags** (for titles/roasts): `folded` = learner packed; `bigPot` = |net| ≥ 8;
`closeFinish` = the learner was in the show and it was decided by the high card, a kicker or
an exact tie; `luckyLastCard` = the learner won a show decided by the very last card
compared; `perfect` = won holding a Trail; `comeback` = won although a player who packed held
a better hand; `bust` = the learner asked for a show and lost it. Tags: `trail`,
`pure-sequence` (learner's hand), `blind-win` (won without seeing), `bluff-win` (comeback
with no show), `show`, `pot-limit`, `split-pot`, `packed-best-hand`.

**Popular alternatives** (for the Variants note): side show; table-specific boots and limits;
A-2-3 ranked differently; dealer's-choice games such as Muflis (lowest hand wins), AK47 (A, K, 4,
7 wild), joker/wild-card games and Best of Four.
