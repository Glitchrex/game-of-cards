# Klondike Solitaire — rules draft

Engine: `src/games/klondike/engine.ts` (rules core `rules.ts`, bots/coach `strategy.ts`).
Content: `content/games/klondike.ts`.

## Variant taught

Classic Klondike, **Draw-1 with unlimited passes**, one player (seat 0, no opponent):

- **Deal**: one 52-card deck, shuffled. Seven tableau columns: column _n_ gets _n_ cards
  (dealt row by row, left to right); only the top card of each column is face up. The other
  24 cards form the face-down **stock**; the **waste** starts empty; four empty
  **foundations**, one per suit.
- **Draw**: turn the top stock card face up onto the waste. Only the top waste card is
  playable.
- **Recycle**: when the stock is empty, turn the whole waste over to form a new stock (the
  cards come round again in the same order). Unlimited passes.
- **Tableau**: build down in alternating colours (a red 7 on a black 8). Any face-up run —
  the whole run or its lower part — moves as a unit. Only a **King**, or a run starting with
  a King, may go into an **empty column**.
- **Foundations**: built up by suit from the Ace to the King, **one card at a time** (from
  the waste or the top of a column). The top foundation card may come back down onto the
  tableau if it fits there.
- **Automatic flip**: when the last face-up card leaves a column, the top face-down card
  turns face up as part of the same move.
- **I'm done**: the learner may resign at any time. The game also ends automatically when
  all 52 cards are on the foundations.

## Decisions and simplifications (and why)

| Decision                                                 | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draw-1, unlimited passes                                 | The friendliest common setting: every stock card is reachable on every pass, so beginners are never cut off. Draw-3 and limited passes are described in Variants.                                                                                                                                                                                                                                                                                                                      |
| Vegas-style payout with unlimited passes                 | `docs/RULES_DECISIONS.md` keeps Vegas money (5/52 of the stake per card home) for the Jeet bet but not the casino's pass limit. With good play this is generous (see "Balance" below).                                                                                                                                                                                                                                                                                                 |
| Automatic flip of the uncovered face-down card           | Every modern app does it; flipping by hand is never a decision. It happens inside the move that uncovers it (no separate move).                                                                                                                                                                                                                                                                                                                                                        |
| No undo                                                  | Matches a real deck and keeps the payout honest. The coach and "I'm done" cover being stuck.                                                                                                                                                                                                                                                                                                                                                                                           |
| Resign is always legal                                   | The rules decision "the learner may resign at any time"; it is the only way to end a stuck deal (the engine never ends a game on its own unless it is cleared).                                                                                                                                                                                                                                                                                                                        |
| Pointless moves stay legal                               | e.g. shuffling a King between empty columns. The engine lists every legal move; the coach and bots simply never choose them.                                                                                                                                                                                                                                                                                                                                                           |
| Malformed or impossible moves are explained, not ignored | Every illegal attempt gets a specific, beginner-friendly reason (e.g. "A red 7 must go on a black 8 — the Eight of Diamonds is red too…", "Only a King can go into an empty column…", "Foundations take one card at a time…"). Reasons never claim a card is ready to go home when it isn't, an Ace refused in the columns is pointed to its foundation, and no reason depends on a hidden card. A tableau source `index` < 0 means "a face-down card" so the UI can let learners try. |

## Betting (Vegas-style)

- Stake = Jeet per unit, `maxLossUnits` 1 (escrowed before the deal, D-04).
- `humanNetUnits = 5 × foundationCards ÷ 52 − 1`: 0 cards → −1, 10 cards → −0.04,
  **11 cards → +0.06 (first profitable count)**, 26 → +1.5, 52 → **+4** (five times the stake
  back).
- `humanOutcome`: **win** if the board is cleared or the net is positive (11+ cards), else
  **loss**. Never a push (no card count gives exactly 0).
- `scores: [foundationCards]`; `winners: [0]` on a win, else `[]`.

## Result flags

- `perfect`: all 52 cards home.
- `comeback`: cleared after turning the waste over at least 3 times.
- `luckyLastCard`: the last card home decided the result — the learner stopped with exactly
  11 cards home (and never more), so one card fewer would have been a loss. A clear never sets
  it: by the time the last King goes up the game was won long ago. (An earlier draft used
  "the last hidden card was also the last card home", which is almost always just "the last
  hidden card was a King" — not a decisive late card, so it was dropped as dishonest.)
- `bigPot`: net ≥ 3 units (42+ cards home).
- `closeFinish`: not cleared and one card either side of breaking even (10 or 11 cards home).
- `folded`: the learner pressed "I'm done" (every non-cleared game). `bust`: never.
- `tags`: `cleared` or `resigned`; `firstPass` (cleared without ever recycling);
  `allAcesHome`; `nothingHome`.

## Bots and coach

- **normal** (also the coach's "what would a pro do?"): Aces/2s home → moves that turn over a
  face-down card (biggest hidden pile first) → safe foundation moves (both opposite-colour
  cards one rank lower already home) → transfers that unlock a hidden card, a foundation move
  or the waste card (including bringing a foundation card back down) → play the waste → draw.
  It never empties a column without a King waiting, never shuffles a lone King, never undoes
  its previous move, and holds back unsafe foundation moves until it is stuck — then it
  "banks" every card it can before resigning.
- **easy**: random choice among simple progress moves (any foundation move, any waste play,
  any move that turns over a face-down card), otherwise draw.
- **Information**: bots never look at face-down cards or at the stock before it has been seen;
  after a full pass every stock card has been shown on the waste, so remembering them is fair.
- **Stuck rule** (deterministic termination): with no useful table move, the bot draws during
  the first pass; afterwards it only draws/recycles while a remembered stock/waste card could
  be played (or still sent home). Otherwise it banks foundation moves and resigns. A backstop
  (200 moves without irreversible progress) exists but never triggers in the simulations.
- **Coach honesty**: when it suggests "I'm done" the coach says the deal _is_ stuck only when
  every stock/waste card has been seen and the rules-level `isStuck` check agrees; otherwise
  it says the deal _looks_ stuck (the heuristic found nothing useful). It never offers to let
  the learner "keep" 0 cards, and the situation line only says a card can move when one can.

## Verification

`src/games/klondike/verify.test.ts` pins every rule above with a test that fails if the rule
is wrong: the exact row-by-row deal; Draw-1 and top-of-waste only; 30 recycles in the same
order; build-down legality for all 52 × 51 card pairs; every card into an empty column (from
the waste and from a foundation); every card onto every foundation height; runs moving from
every index; the automatic flip; resign always legal; the payout, outcome and flags for every
card count 0–52; strict, pure `applyMove`; hidden-card invariance of `checkMove` reasons,
labels and coach text; describeMove naming only the card a move reveals; bot/coach decisions
unchanged when hidden cards are re-dealt along whole games; normal beating easy on the same
deals; coach-following games always ending; `isStuck` soundness; and the lesson scenes, quiz
answers and tips agreeing with the engine.

## Balance (simulation, 1,200 seeded games)

- normal bot: clears ≈ 38% of deals, wins (11+ cards) ≈ 58%, average ≈ 26 cards home,
  ≈ +1.5 units per game.
- easy bot: clears ≈ 9%, wins ≈ 40%, average ≈ 13 cards home, ≈ +0.3 units per game.
- So with unlimited passes, Vegas-style Klondike is a _positive_ game for a careful player.
  If the economy needs it to be tougher, the casino rule (a single pass through the stock)
  would be the standard lever; we did not apply it because the rules decision says unlimited.

## Popular alternatives (for the Variants note)

- **Draw-3**: three cards turned at a time, only the top one playable.
- **Casino Vegas**: one pass (Draw-1) or three passes (Draw-3), $52 per deck, $5 per card.
- **Standard scoring** in apps (e.g. 10 points per foundation card, time bonus) and undo.
- **Thoughtful solitaire**: all cards dealt face up.
- Cousins: FreeCell, Spider Solitaire.
