### Spades

**Variant taught:** classic 4-player partnership Spades, one hand = one game (D-05).
Engine: `src/games/spades/engine.ts` (rules helpers in `rules.ts`, bots and coach in
`strategy.ts`); content: `content/games/spades.ts`.

**Rules implemented**

- 4 seats, clockwise (seat i+1 is on seat i's left). Partnerships: **learner (seat 0) +
  bot partner (seat 2)** against seats 1 and 3. One standard 52-card deck, no jokers.
- **Dealer** is chosen from the seed (`config.options.dealer` can fix it, 0–3). The deck
  is dealt one card at a time starting with the player on the dealer's left; 13 each.
  The deal happens in `setup()` (as in Hearts) — there is no separate deal move.
- **Bidding:** starting on the dealer's left, each player bids once, 0–13 tricks.
  **0 = Nil** ("I will win no tricks"). No Blind Nil, no minimum team bid, no
  restriction on the total of all bids.
- **Play:** the player on the dealer's left leads the first trick. **Follow suit** if
  able; otherwise play any card (trumping is never compulsory).
- **Spades are always trump:** the highest Spade in a trick wins it; with no Spade, the
  highest card of the led suit wins (Ace high). The winner leads the next trick.
- **Breaking Spades:** a Spade cannot be **led** until Spades are broken, unless the
  leader holds nothing but Spades. Spades become broken the first time **any** Spade is
  played to a trick — normally a player trumping (or discarding a Spade) on another suit,
  and also when a Spades-only hand is forced to lead one. (The forced-lead case is the
  same convention our Hearts engine uses for Hearts; tables differ on it, and it only
  matters in rare hands.)
- **Scoring** (per partnership, after 13 tricks):
  - Contract = the sum of the partners' non-Nil bids.
  - Contract made → **10 × contract + 1 per overtrick** ("bag"); failed ("set") →
    **−10 × contract** (no bags).
  - **Nil:** +100 if the Nil bidder took no tricks, −100 otherwise; scored separately
    for each Nil bidder.
  - **A Nil bidder's tricks never count toward the partner's contract** (standard), but
    **each one counts as a bag (+1)** for the team — whether or not the partner's contract
    was made. Choice documented here as required by the engine notes.
  - If both partners bid Nil the contract is 0 (trivially made, 0 points) and only the
    Nil results and bags score.
- **Winner:** the partnership with the higher score for the hand; equal scores = push.

**Betting:** ±1 unit (`humanNetUnits` = +1 win, −1 loss, 0 push), `maxLossUnits` 1. No
extra commitments exist in Spades, so `config.affordableUnits` is not used.

**Result flags (computed from what actually happened)**

- `perfect`: the learner's team made its contract **exactly** (contract > 0 and zero
  bags, i.e. no overtricks and no tricks taken by a Nil bidder), **or** a Nil bid by the
  learner or the partner succeeded (tag `nil`).
- `closeFinish`: the two team scores differ by ≤ 10 (a tie included).
- `comeback`: the learner's team made its contract after being **behind** with 4 or
  fewer tricks left — "behind" = it still needed at least 2 more tricks and more than
  half of the remaining tricks (e.g. 3 of the last 4, 2 of the last 3, the last 2).
  Needing only the very last trick is not counted as a comeback (that is
  `luckyLastCard` territory).
- `luckyLastCard`: the learner's team won, but would not have been winning had the hand
  been scored before the 13th trick.
- `bigPot`: the learner's team **won** by ≥ 100 points.
- `bust`: the learner's team lost and either was set or the learner's own Nil failed.
- `folded`: always false (nobody can fold in Spades).
- `tags`: `nil` (learner-team Nil made), `nilFailed`, `opponentNil` (an opponent's Nil
  made), `bustedNil` (an opponent's Nil failed), `set`, `setOpponents`, `exactBid`, `tie`.

**Bots** (use only their own hand + public bids and played cards)

- Easy bid: Aces + ½ × Kings + Spades beyond three, rounded, ±1 at random, at least 1
  (never Nil). Easy play: mostly the lowest legal card, sometimes the cheapest winner
  when the team still needs tricks, occasionally a random legal card.
- Normal bid: counts likely tricks (Aces; Kings with a guard; Spade honours and Spade
  length; short side suits with spare Spades to trump) and bids a little under the count
  (being set costs far more than a bag); bids Nil only with a very weak, safe hand (no
  Aces, ≤ 3 Spades none above the 9, no short Kings/Queens, low cards in every suit) and
  never when the partner already bid Nil. Normal play: wins the tricks the team needs
  (cheapest sure winner, trump when void, second hand low, third hand high), never
  overtakes a partner who is safely winning, tries to set the opponents, ducks to avoid
  bags once both contracts are settled, covers a partner's Nil, dodges tricks when it bid
  Nil, and lets an opponent's Nil bidder win tricks. The coach reuses the normal logic.

**Decisions and simplifications (and why)**

- One hand instead of a game to 500 — keeps a game around 10 minutes (D-05). With a
  single hand there is no 10-bag penalty, so bags are simply +1 each; the bots and the
  lesson still teach avoiding bags because that is what matters in a full game.
- No Blind Nil, no jokers, no minimum bid — fewer rules for a first game; all mentioned
  in the Variants note.

**Popular alternatives (Variants note)**

- Full game to 500 points (sometimes also ending at −200); every 10 bags costs 100.
- Blind Nil (±200), Big/Little Jokers as top trumps, minimum team bid of 4,
  "Suicide" Spades (one partner per team must bid Nil).
- A Nil bidder's tricks counting toward the partner's bid.
- 2- and 3-player "cutthroat" Spades without partnerships.
