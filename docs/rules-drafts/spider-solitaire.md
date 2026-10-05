### Spider Solitaire

**Variant taught:** One-suit Spider (the "Easy/Beginner" level in most apps), followed by a
lesson step on how two-suit and four-suit Spider differ. Rules otherwise follow the standard
game (Pagat; classic Windows Spider).

**Rules as taught**

- Cards: 104 (two decks' worth). In one-suit Spider every card is a Spade: eight full sets of
  A–K. Ranks low → high: A, 2–10, J, Q, K.
- Deal: 54 cards into ten columns — the first four columns get 6 cards, the other six get 5 — with
  only the last card of each column face up. The remaining 50 cards are the stock (five deals of
  ten).
- Building: a face-up card may go on a card exactly one rank higher (6 on 7). Nothing goes on an
  Ace; a King can only move into an empty column.
- Runs: cards in descending order in the same suit form a run that moves as one unit, with no
  size limit; the lower part of a run may also be moved on its own.
- Face-down cards turn over automatically when uncovered.
- Empty columns: any card or run may move in.
- Dealing: at any time, deal ten cards from the stock, one face up onto every column — but not
  while any column is empty.
- A complete King-to-Ace run in one suit is removed to the foundation (most apps do it
  automatically). Removing all eight runs wins.

**Simplifications / editorial decisions**

- One-suit first, as the brief asks: it lets beginners learn the layout, runs, empty columns and
  the stock without suit headaches. The final lesson step ("Level up") explains the two rules
  that change with more suits: any card may still be placed on one rank higher regardless of
  suit, but only same-suit runs move together and only same-suit King-to-Ace runs are removed.
- Card codes: one-suit scenes use only Spades, with duplicates (multiple decks). Face-down
  stock placeholders are K♠ backs.
- Scoring (Windows-style: start at 500, −1 per move, +100 per finished run) is mentioned only in
  Variants, not taught.
- We note that removal of a finished run is automatic "in most apps" rather than stating it as
  compulsory.
- "No dealing with an empty column" is taught as the standard rule; apps that relax it are
  mentioned in Variants.
- History is hedged: inventor unknown; the eight-legs name origin is "often said"; Microsoft
  bundled Spider with Windows "around the turn of the millennium" with one- and two-suit levels.

**Scripted example (consistency notes)**

- One suit (Spades), joined after the first stock deal (4 deals left). Columns (bottom → end,
  face-down cards listed first): C1 [5 Q 2 J] 7; C2 [9 3 K] 6; C3 [A 8] 10 6; C4 [4 Q] 9 8.
- Decision 1: move C2's 6♠ (flips a hidden card: K♠) rather than C3's 6♠ (reveals only the known
  10♠).
- Decision 2: move the run 7♠ 6♠ from C1 onto C4's 8♠ (flips J♠ in C1). No more moves → deal.
- Deal (3 deals left): 10♠ onto C1, Q♠ onto C2, 5♠ onto C3, a stray 9♠ onto C4's 9-8-7-6 run.
- Decision 3: move the stray 9♠ onto C1's 10♠; then J♠ 10♠ 9♠ onto C2's Q♠ (C1 flips 2♠).
- Fast-forward (one more deal, 2 left): C2 is K♠ down to 6♠ over [9 3]; C4 is [4 Q] 9 5 4 3 2 A;
  column 3 empty.
- Decision 4: move 5♠–A♠ onto the 6♠ → full run removed (1 of 8); C2 flips 3♠. Dealing is not
  allowed while column 3 is empty.
- Decision 5: fill the empty column with C4's 9♠ (flips the Q♠) — then the stock can be dealt.

**Popular alternatives (in Variants)**

- Two-suit (Spades + Hearts) and four-suit (classic, two ordinary decks) Spider; Spiderette (one
  deck, Klondike-style layout); app differences (undo, dealing with an empty column, Windows-style
  scoring).
