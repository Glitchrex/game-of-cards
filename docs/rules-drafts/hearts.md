### Hearts

**Variant taught:** classic 4-player Hearts ("Black Lady" scoring), one hand = one game
(D-05). Engine: `src/games/hearts/engine.ts`; content: `content/games/hearts.ts`.

**Rules implemented**

- 4 seats (learner = seat 0, three bots), one standard 52-card deck, 13 cards each.
- **Passing:** each player passes 3 cards to the **left** (seat i → seat i+1). Seats choose
  in turn order (0, 1, 2, 3); a chosen pass leaves the hand at once, but nobody receives
  anything until all four have chosen, then the cards change hands simultaneously — so no
  one can see what they will receive before passing.
- The holder of the **2♣** (after passing) leads it to the first trick.
- **Follow suit** if able; otherwise play any card.
- **First trick:** no point cards (Hearts or Q♠) unless you hold nothing else. A player
  whose hand is only point cards (Hearts and/or the Q♠) may play any of them.
- **Breaking Hearts:** a Heart cannot be led until a Heart has been played on an earlier
  trick, unless the leader holds only Hearts. The **Q♠ does not break Hearts** (the
  standard modern rule; some tables play that she does — see Variants).
- Highest card of the led suit wins (Ace high) and leads the next trick.
- **Scoring:** 1 point per Heart, 13 for the Q♠ (26 per hand). **Shooting the moon:** a
  player who takes all 26 scores 0 and every other player scores 26.
- **Winner(s):** lowest hand score; ties share the win.

**Betting (winner-takes-pot):** each loser pays 1 unit into the pot and the winners split
it: sole winner **+3 units**, two tied winners **+1** each, three tied winners **+1/3**
each, losers **−1**. The four seats' payouts always sum to 0. `maxLossUnits` 1. A push is
impossible (four-way ties can't happen: 26 or 78 points never split evenly four ways).

**Decisions and simplifications (and why)**

- One hand instead of a game to 100 points — keeps a game under ~10 minutes (D-05).
- The pass always goes left (no left/right/across/hold rotation) because there is only one
  hand. The engine also supports `options.passDirection: 'right' | 'across' | 'hold'` for
  future use; the lesson teaches only "left".
- Shooting the moon uses the "everyone else +26" form (the most common), not "shooter −26".
- No Jack of Diamonds bonus (Omnibus) and no "Q♠ breaks Hearts" house rule — both are
  mentioned in the Variants note.
- Result flags: `perfect` when the learner scores 0 (no points, or shot the moon);
  `bigPot` for a sole win (+3); `comeback` when the learner had ≥ 13 points along the way
  and still won (in practice only via shooting the moon); `closeFinish` when the learner's
  score is within 2 points of the decisive rival (the best non-winner when the learner won,
  the winner when the learner lost); `luckyLastCard` when the final trick turned the
  learner's result from not-winning into a win; `bust` when the learner lost after taking
  the Q♠; tags `shootTheMoon`, `opponentShotMoon`, `queenOfSpades`, `cleanHand`,
  `sharedWin`.

**Popular alternatives (Variants note)**

- Full game to 100 points; pass direction rotates left → right → across → hold.
- Q♠ breaks Hearts; Hearts may be led at any time; points allowed on the first trick.
- Jack of Diamonds counts −10 (Omnibus Hearts).
- Moon shooter subtracts 26 from their own score instead.
- 3, 5 or 6 players with a few low cards removed so the deck divides evenly.
