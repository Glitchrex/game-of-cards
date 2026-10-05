### FreeCell

**Variant taught:** Standard FreeCell, as in the classic Windows version and as described on
Pagat: one 52-card deck, eight columns, four free cells, four foundations, building down in
alternating colours.

**Rules as taught**

- Deck: one standard 52-card deck, no jokers. Ranks low → high: A, 2–10, J, Q, K.
- Deal: every card face up into eight columns. The first four columns get 7 cards and the other
  four get 6 (4 × 7 + 4 × 6 = 52). Four free cells and four foundations start empty.
- Movable cards: only the card at the end (uncovered end) of a column, or a card in a free cell.
- A card may move:
  - onto the end of another column if it is one rank lower and the opposite colour (red 9 on
    black 10);
  - into an empty free cell (each cell holds exactly one card, any card);
  - onto its foundation: foundations are built up by suit from Ace to King.
- Empty columns: any card, or any run, may move into an empty column (unlike Klondike, not just
  Kings).
- Runs / "supermove": officially one card moves at a time. As in almost every app, we teach the
  shortcut of moving a whole run at once when it could be done card by card: the maximum is
  (empty free cells + 1) × 2^(empty columns). A column you are moving the run _into_ does not
  count as an empty column for the doubling.
- In the classic Windows version a card that reaches a foundation stays there.
- Win: all 52 cards on the foundations. Almost every deal is winnable.

**Simplifications / editorial decisions**

- The supermove formula is taught in friendly words ("empty free cells + 1, doubled for each
  empty column") with the "not counting the destination column" caveat as a lesson tip, not in
  the main text.
- We say foundation cards stay put "in the classic version" and note in Variants that some apps
  let you take them back down; we do not teach taking cards back.
- Auto-moving safe cards to the foundations is an app convenience, mentioned only in Variants.
- No scoring is taught (FreeCell is normally just won or lost).
- History is limited to well-documented points and hedged: Baker's Game (built by suit) as the
  ancestor, described by Martin Gardner "in the 1960s"; Paul Alfille switched it to alternating
  colours and programmed it on the PLATO system in 1978; Microsoft bundled it with Windows "in
  the 1990s"; of the 32,000 numbered classic deals, deal #11982 is the famous unwinnable one.
- Origin given as United States (where the modern game was created on PLATO).

**Scripted example (consistency notes)**

- Opening deal, relevant columns (bottom → end): C1 K♠ 6♥ 10♣ 2♦ A♥ 8♠ 4♦; C4 Q♥ 3♠ J♣ 7♣ 2♠
  10♠ 9♥; C5 7♠ 9♦ 5♦ K♥ A♦ 3♥; C6 8♦ K♣ 4♣ Q♠ 6♦ 5♣.
- Decision 1: 4♦ onto 5♣ (not a free cell; the buried A♥ cannot move).
- Decision 2: 8♠ onto 9♥ (grows the run 10♠ 9♥ 8♠). A♥ goes home; C1 ends with 2♦.
- Decision 3: 3♥ (over the A♦, no black 4 free) into a free cell → A♦ and 2♦ go home.
- Fast-forward: 2♥, 3♥, 3♦ and A♠ home; Q♣ parked in a free cell (3 cells empty). C7 is
  9♣ 5♥ J♦.
- Decision 4: supermove of 10♠ 9♥ 8♠ onto J♦ (3 empty cells → up to 4 cards); 2♠ goes home.
- Fast-forward: column 3 empty; C2 is 6♣ A♣ K♦.
- Decision 5: K♦ into the empty column (not the Q♣, not a free cell) → A♣ home, Q♣ from its cell
  onto the K♦. All four Aces home, all free cells empty.

**Popular alternatives (in Variants)**

- Baker's Game (build by suit); FreeCell with 3, 2 or 1 free cells; Eight Off (eight cells, by
  suit); Seahaven Towers (ten columns, only Kings into empty columns); two-deck FreeCell games;
  app conveniences (auto-move to foundations, undo, taking foundation cards back).
