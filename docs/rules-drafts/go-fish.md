### Go Fish

**Variant taught:** classic Go Fish with **books of four**, one deal = one game. Engine:
`src/games/go-fish/engine.ts` (rules helpers `rules.ts`, bots/coach `strategy.ts`);
content: `content/games/go-fish.ts`.

**Rules implemented**

- 2–5 seats (default 3: learner = seat 0 + two bots), one 52-card deck, no jokers.
  **7 cards each with 2–3 players, 5 each with 4–5.** Cards are dealt one at a time
  starting with the first player; the rest is spread face down as the **pond** (the stock).
  Play goes clockwise (seat i → seat i+1). The learner asks first by default (they sit on
  the dealer's left); `options.firstPlayer` can choose another seat (used by simulations).
- **A turn** is one move, `{ type: 'ask', target, rank }`: ask one **other** player **who
  still has cards** for a **rank you already hold**.
  - The target holds that rank → they hand over **all** of those cards and you **go
    again**.
  - Otherwise **"Go Fish!"**: draw the top card of the pond. If it is the rank you asked
    for ("fish your wish") it is shown to everyone and you **go again**; any other card
    stays hidden in your hand and the turn passes. With an empty pond there is nothing to
    draw and the turn simply passes.
  - Everything that follows an ask happens inside `applyMove` and is recorded in order in
    `state.log` (`ask` → `fish` → `book` → `refill` / `out`), so the UI can animate each step.
- **Books:** four cards of a rank are laid down face up **the moment** a player holds them —
  after a catch, after a Go Fish draw (even of a different rank than the one asked for; the
  turn still passes then), and straight after the deal.
- **Empty hands:** whenever a hand becomes empty while the pond has cards, that player
  draws one card at once — first the target who handed over their last cards, then the
  asker (whose last cards became a book), who then carries on with their turn. With an
  empty pond a player without cards is **out**: the turn passes and they are skipped (and
  cannot be asked) for the rest of the game.
- **End:** the game ends the moment all **13 books** are made (which is also exactly when
  every hand and the pond are empty). **Most books wins**; tied seats share the win.

**Betting (winner takes the pot):** every seat antes 1 unit. Learner wins alone →
**+(players − 1)** (+1 / +2 / +3 / +4 with 2 / 3 / 4 / 5 players); k tied winners including
the learner → **(players − k)/k** each (e.g. +0.5 for a two-way tie with 3 players);
otherwise **−1**. Everyone tied = push (0; impossible with 13 books and 2–5 players, but
handled). Seats' payouts always sum to 0. `maxLossUnits` 1. There are no optional extra
commitments, so `config.affordableUnits` does not affect this game.

**Result flags**

- `comeback` — the learner won after trailing the leading opponent by ≥ 3 books at some
  point (`state.maxBehind`, tracked after every move and the deal).
- `closeFinish` — the learner finished exactly 1 book ahead of (or behind) the best
  opponent.
- `luckyLastCard` — the learner won and their final book was completed by fishing their
  wish (book `via: 'wish'`). Tag `luckyFinalBook` records the same fact win or lose.
- `perfect` — the learner made ≥ 7 books (which always means a sole win).
- `bigPot` — a swing of ≥ 3 units (a sole win with 4 or 5 players).
- `bust` / `folded` — never (no such actions in Go Fish).
- Tags: `sharedWin`, `noBooks`, `fishedWish` (the learner completed a book by fishing
  their wish), `luckyFinalBook`, `ranOutOfCards` (the learner sat out with an empty pond).

**Bots** (they see only their own hand plus public information: hand sizes, pond size,
books, and the public history — who asked whom for what, how many cards were handed over,
and any fished wish that was shown; never other hands, the pond order or anyone else's
face-down draws)

- _easy_ — asks for a random rank it holds from a random player who has cards.
- _normal_ — keeps a public memory per opponent and rank: cards **proven** held (they
  asked for it, caught some, or showed a fished wish — proofs stay valid until they hand
  the cards over or book them) and how many of their unidentified cards **could** be that
  rank (0 right after they said "Go Fish" to it or handed it over; +1 for every face-down
  card they draw). It asks a proven or deduced holder whenever one exists (the rank it
  holds most of first); otherwise it picks the best estimated chance (hypergeometric over
  the cards it cannot place), nudged towards ranks it holds more of; it never repeats an
  ask the history shows must fail. The simulation checks at every step that this memory is
  sound (proven ≤ actual ≤ proven + possible). Heads-up, normal wins about 60 % of games against easy (easy wins about 35 % against normal).

**Decisions and simplifications (and why)**

- One deal instead of a running score over several deals — keeps a game to a few minutes.
- Books of four (the standard rule) rather than pairs (a toddler variant).
- **Empty-hand refill happens immediately, for whoever empties** (not only the player
  whose turn it is). The decided rule is "if your hand empties, draw a card (if the stock
  has any)". Drawing at once also for a target who handed over their last cards avoids a
  dead end that otherwise happens constantly heads-up: after taking the opponent's last
  cards you "go again" but would have nobody to ask. With this rule the player to act
  always has cards and always has someone to ask.
- An empty pond does not end the game (some tables stop there); play continues until all
  13 books are made, as decided. Players without cards then sit out.
- A Go Fish draw that completes a book of a _different_ rank is laid down at once, but
  only drawing the asked rank earns another turn.

**Popular alternatives (Variants note)**

- Pairs instead of books of four, for very young children.
- Ending the game when the pond runs out or when the first player runs out of cards.
- Dealing 5 cards even for two players; drawing five new cards when your hand empties.
- Passing the turn after every ask, even after a catch.
- Happy Families and Quartett: the same idea with special picture decks.
