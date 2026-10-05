### Indian Rummy (13-card Points Rummy)

**Variant taught:** 13-card **Points Rummy**, one deal per game (D-05). This is what the engine
(`src/games/indian-rummy/`) and the lesson (`content/games/indian-rummy.ts`) both implement. The
site plays it one-on-one (learner vs one bot); the engine supports 2–6 seats with the same rules.

**Rules as taught and implemented**

- **Cards:** two standard 52-card decks plus two printed jokers (106 cards). Identical cards from
  the two decks are interchangeable.
- **Deal:** the dealer is chosen by the seed (engine option `dealer`). 13 cards each, one at a
  time starting on the dealer's left. The next card is turned face up under the stock as the
  **wild-joker card**; the next starts the **open pile**; the rest is the **closed stock**. The
  player on the dealer's left (the next seat number) plays first; play goes clockwise.
- **Jokers:** every card of the wild-joker card's rank (any suit) is a joker, and so are the
  printed jokers. If the wild-joker card is itself a printed joker, **Aces are wild**. The
  wild-joker card stays out of play — nobody may take it.
- **Turn:** draw one card (top of the closed stock or top of the open pile — jokers on the
  open pile may be picked up), then discard one card face up. Instead of discarding you may
  **declare**.
- **Groups:**
  - **Pure sequence** — 3+ consecutive cards of one suit with no joker standing in. A
    wild-rank card sitting in its own natural place (5♥ in 4♥ 5♥ 6♥ when 5s are wild) keeps it
    pure.
  - **Impure sequence** — 3+ consecutive cards of one suit where jokers fill gaps or ends.
  - **Set** — 3 or 4 cards of one rank in different suits (jokers may replace missing suits;
    two cards of the same suit never share a set).
  - Ace is low (A-2-3) or high (Q-K-A); sequences never wrap (K-A-2). Any length ≥ 3.
  - A group may consist mostly of jokers: three jokers that include a wild-rank card form a
    sequence (that card in its natural place plus two jokers).
- **Declare:** after drawing, throw the 14th card and show 13 cards that are **all** in groups,
  with **at least two sequences, at least one of them pure**. The declarer wins.
- **Scoring:** every other player pays their **deadwood** — the points of the cards they cannot
  group in their best arrangement: A, K, Q, J, 10 = 10; 2–9 = face value; jokers (printed and
  wild) = 0. **If a player cannot make a pure sequence, every card counts.** Payments are
  capped at **80 points**. With more than two players the winner collects from everyone.
- **Drop:** at the start of your turn, before drawing, you may drop out: **20 points** if you
  have not drawn a card yet this game (first drop), **40 points** later (middle drop). A dropped
  player's 13 cards are set aside face down. With two players the other player wins at once;
  with more, play continues and the eventual winner collects the drop points too.
- **Stock runs out:** at the end of the turn that emptied it, the open pile except its top card
  is shuffled (seeded RNG stored in the state) to form a new closed stock.
- **Betting / units:** 1 unit = 1 point. `humanNetUnits` = +the sum of what the other players
  pay when the learner wins; −the learner's own points when they lose. Worst case = 80, so
  `maxLossUnits` = 80 (stake = Jeet per point: 1/2/5). Best case = 80 × (players − 1).

**Decisions / simplifications and why**

- **Invalid declarations are blocked** with a precise explanation (no pure sequence / no second
  sequence / which cards are still loose, plus a "discard X instead" tip when another discard
  would work) instead of the usual 80-point penalty. Beginners learn the rule without being
  punished for misreading their hand. Mentioned in Variants.
- **Deadwood when a pure sequence exists counts every other group** (sets and impure sequences
  included), even if the loser has no second sequence. This is the rule as written in
  `docs/RULES_DECISIONS.md` ("if the loser has no pure sequence, every card counts"); some
  sites additionally require a second sequence before sets count.
- **Turn cap:** if 200 turns (draw + discard) pass without a declaration — which only happens
  with very weak play — the game ends, every remaining hand is scored by deadwood (same rules
  and cap) and the lowest wins; tied lowest hands share the losers' points equally (so a
  two-player tie is a push). Keeps every game finite. The cap is the engine option `maxTurns`
  (the simulations use short caps to exercise this ending).
- **Comeback flag uses raw deadwood.** With the "no pure sequence → every card counts" rule
  almost every opening hand is worth 60+ points, so "deadwood ≥ 60 at some point" would be
  true for nearly every win. The flag therefore uses the points of the ungrouped cards in the
  best grouping, ignoring the pure-sequence rule (measured at the deal and after every
  discard).
- **No rule against discarding the card just taken from the open pile.** Some tables forbid it;
  it is not universal and does not change the strategy a beginner needs.
- **Dealing happens at setup** (no forced dealer moves), like Teen Patti: the UI animates the
  whole deal at the start.
- **Hands are dealt sorted** (suit, then rank) for display; drawn cards are appended at the end.
- **`affordableUnits`** is not used: there are no optional extra commitments beyond the
  80-point escrow (a drop costs at most 40).
- **Attempting to take the wild-joker card** is modelled as the move `{ type: 'draw', from:
'wild' }`, which is never legal — boards may submit it so the learner sees why.

**Engine result flags** (for titles/roasts): `perfect` = the learner declared on one of their
first 3 turns or with a hand that needs no joker standing in; `comeback` = the learner won
after their hand had at least 60 points of ungrouped cards (raw deadwood, not counting the
pure-sequence penalty) at some point; `closeFinish` = a loser paid ≤ 10 points (or a tie at the
turn cap); `luckyLastCard` = the learner declared using the card just drawn blind from the
closed stock; `bigPot` = |net| ≥ 40 points; `folded` = the learner dropped; `bust` = the
learner paid the full 80 points. Tags: the ending (`declare`, `drop`, `turn-cap`),
`first-drop`/`middle-drop` (learner), `opponent-dropped`, `no-jokers`, `quick-declare`,
`full-count`, `stock-finish`, `reshuffled`, `aces-wild`.

**Bots:** normal takes the open card only when it clearly improves its hand (always a joker),
throws the card whose loss hurts least by a "distance to declaring" score (loose cards cost
most, pairs and close same-suit cards less, high points slightly more; jokers are never
thrown), declares as soon as it can, drops a hopeless opening hand (no joker, no pure
sequence, hardly any connected cards — about 1 hand in 80) and very rarely makes a middle drop
(no pure sequence and no joker after 8 turns). Easy takes the open card only when it completes
a group at once, throws a random card that is not in a group, declares when it can and never
drops. Bots see only their own hand, the open pile and the wild-joker card.

**Popular alternatives** (for the Variants note): the 80-point wrong-declaration penalty; Pool
Rummy (101/201, elimination over many deals); Deals Rummy (fixed number of deals); games
without printed jokers; no picking jokers from the open pile; 25/50-point drops; 10-card
rummy; 21-card Marriage Rummy with three decks.
