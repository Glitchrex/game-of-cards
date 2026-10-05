### Crazy Eights

**Variant taught:** classic Crazy Eights with no action cards, one hand = one game (D-05
style). Engine: `src/games/crazy-eights/engine.ts`; content: `content/games/crazy-eights.ts`.

**Rules implemented**

- 2–4 seats (default 3: learner = seat 0 + two bots), one 52-card deck, no jokers.
  **7 cards each with 2 players, 5 each with 3–4.** Cards are dealt one at a time starting
  with the first player; play goes clockwise (seat i → seat i+1).
- The learner plays first by default (they sit on the dealer's left).
  `options.firstPlayer` can choose another seat (used by simulations).
- **Starter card:** the top card of the stock is turned up to start the discard pile. If it
  is an Eight it is **buried** at a random spot in the bottom half of the stock and the next
  card is turned instead (repeat if needed). Buried Eights are public (`state.buried`).
- **A turn:** play one card that matches the top card's **suit or rank**. Matching by rank
  switches the suit to the new card's suit.
- **Eights are wild:** an Eight may be played on anything, and its player **names the next
  suit** (any of the four, including the Eight's own). After an Eight only the **named**
  suit or another Eight may be played — the Eight's printed suit no longer counts.
  A suit is named even when the Eight is your last card (the game ends at once anyway).
- **Drawing:** you may draw one card instead of playing whenever the stock has cards, even
  if you could play. After drawing you keep the turn and may play any legal card (not only
  the drawn one) or draw again. If nothing in your hand can be played you must draw, one
  card at a time, until you can.
- **Passing:** only when the stock is empty and nothing in your hand can be played.
- **Winning:** the first player to empty their hand wins immediately.
- **Blocked game:** if the stock is empty and **nobody** can play, the game ends at once —
  exactly the position a full round of passes would reveal, so the engine skips those
  pointless passes. Everyone counts the cards left in hand: **Eight 50, K/Q/J/10 10, Ace 1,
  other cards their number**; the **lowest total wins** and tied seats share the win.
  (Because an Eight can always be played, nobody holding an Eight can ever be stuck, so the
  50-point Eight only shows up in the end-of-game `scores` after somebody goes out.)

**Betting (winner takes the pot):** every seat antes 1 unit; each loser pays 1 unit and the
winner(s) share the pot. Learner goes out → **+(players − 1)** units (+1 / +2 / +3 with
2 / 3 / 4 players); anyone else wins → **−1**. In a blocked game k tied winners get
(players − k)/k each (e.g. +0.5 for a two-way tie with 3 players); if every seat ties it
is a push (0). Seats' payouts always sum to 0. `maxLossUnits` 1. There are no optional
extra commitments, so `config.affordableUnits` does not affect this game.

**Result flags**

- `perfect` — the learner won without drawing a single card (tag `neverDrew` is set
  whenever the learner never drew, win or lose).
- `luckyLastCard` — the learner went out with an Eight (tag `eightFinish`).
- `comeback` — the learner won after being ≥ 3 cards behind the leader (the opponent with
  the fewest cards) at some point (`state.maxBehind`).
- `closeFinish` — when someone went out: the runner-up had 1 card left (an opponent when
  the learner won; the learner when they lost). In a blocked game: the learner's total was
  within 3 points of the decisive rival, or the learner shared the win.
- `bigPot` — a swing of ≥ 3 units (only a 4-player win).
- `bust` / `folded` — never (no such actions in Crazy Eights).
- Tags: `wentOut` or `blocked`, `eightFinish`, `neverDrew`, `caughtWithEight` (learner lost
  while holding an Eight), `reshuffled` (house rule used), `sharedWin`.

**Bots** (they only see their own hand plus public information: the pile, hand sizes,
stock size and the public history — who played what, and which suit was needed when
someone drew)

- _easy_ — plays the first playable card in hand order (an Eight whenever it comes first,
  naming a random suit it holds), otherwise draws, otherwise passes.
- _normal_ — goes out whenever it can; saves Eights until nothing else matches; among the
  ordinary playable cards prefers the one that leaves it the most cards of the resulting
  suit (so matching by rank switches to its strongest suit), then the higher-penalty card;
  slightly prefers a suit the next player had to draw on (strongly when that player holds
  ≤ 2 cards); names its longest suit for an Eight (ties: more points, then a suit the next
  player seems to lack); draws only when it has nothing to play. In simulations normal
  beats easy clearly (≈ 56 % vs 42 % heads-up from seat 0).

**Decisions and simplifications (and why)**

- One hand instead of a multi-hand points race — keeps a game to a few minutes.
- No action cards (2 = pick up two, Jack = skip, Queen = reverse …) — they belong to
  UNO-style variants; the classic game has only the wild Eight.
- Unlimited drawing (no "draw three then pass" limit) — the most common standard rule.
- No reshuffle by default: the decided rule is "if the stock is empty and you cannot play,
  you pass", plus the blocked-game scoring above. The engine also supports the common
  house rule `options.reshuffle: true`: when someone draws from an empty stock, the discard
  pile except its top card is shuffled (seeded, via `state.rngState`) into a new stock. It
  is capped at `MAX_RESHUFFLES` = 3 per game so every game still terminates; after that the
  standard pass/blocked rules apply. The lesson teaches only the default.
- The learner always has the first turn by default (simple and friendly for beginners).

**Popular alternatives (Variants note)**

- Action cards borrowed from UNO / Switch / Mau-Mau: 2s (pick up two), Jacks (skip),
  Queens (reverse), Aces (change suit).
- Draw limits (e.g. at most three cards, then pass).
- Reshuffling the discard pile into a new stock when the stock runs out.
- Multi-hand scoring: whoever goes out scores the cards left in the other hands
  (Eights 50, K/Q/J/10 10, Aces 1, others face value); first to an agreed total wins.
- Two decks shuffled together for five or more players.
