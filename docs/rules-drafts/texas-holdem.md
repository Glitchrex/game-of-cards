### Texas Hold'em Poker (No-Limit)

**Variant taught:** standard **No-Limit Texas Hold'em**, **one hand per game** (D-05), for 2–6
players (4 by default: the learner + 3 bots). This is what the engine
(`src/games/texas-holdem/`) and the lesson (`content/games/texas-holdem.ts`) both implement.

**Rules as taught and implemented**

- One standard 52-card deck, no jokers. Everyone starts with **100 chips**. Seats are numbered
  clockwise; "left of" a seat is the next seat number.
- The **dealer button** is chosen by the seed. With 3+ players the seat left of the button
  posts the **small blind (1)** and the next seat the **big blind (2)**. **Heads-up** the button
  posts the small blind and the other player the big blind. A player whose stack is smaller
  than a blind posts what they have and is all-in; the bet to match pre-flop is still the full
  big blind.
- Two **hole cards** each, dealt one at a time starting left of the button.
- **Four betting rounds**: pre-flop, flop (3 community cards), turn (1), river (1). A burn card
  is dealt face down before each street.
  - Pre-flop action starts left of the big blind (heads-up: the button/small blind acts first).
    The big blind has the **option** to check or raise when nobody raised.
  - From the flop on, the first player still in (with chips) left of the button acts first;
    heads-up the big blind acts first and the button last.
  - A round ends when every player still in with chips has acted and matched the current bet
    (or everyone else has folded). Players who are all-in are skipped.
- **Moves**: fold, check (nothing to call), call (all-in for less if short), bet (no bet yet on
  this street), raise (to a street total), all-in.
  - **Minimum bet** = the big blind. **Minimum raise** = the size of the last full bet or raise
    on this street (e.g. blinds 1/2, raise to 6 → the next raise is to at least 10). Any whole
    amount between the minimum and all-in is legal (the UI has a slider); `legalMoves` lists a
    small representative set: minimum, ½ pot, ¾ pot, pot (a "pot raise" = call + the pot after
    the call), all-in — deduplicated, with sizes at or above the stack folded into all-in.
  - **All-in** is allowed for any amount, including less than a full bet or raise. An all-in
    that raises by **less than a full raise does not re-open the betting** for players who have
    already acted on this street: when the action returns to them they may only call or fold —
    unless the raises they now face add up to at least a full raise (TDA rule). Players who have
    not acted yet may raise, to at least the all-in amount + the last full raise.
  - When every other player still in is all-in, nobody can bet or raise any more (there is no one
    to respond); a player facing such an all-in may only call or fold.
- **Unmatched chips are returned**: when a round ends (or everyone folds to a bet), the part of
  the biggest bet that nobody matched goes back to its owner.
- When at most one player still has chips, the rest of the board is dealt at once and the hand
  goes to the showdown.
- **Side pots**: the chips are split by contribution level into a main pot and side pots; each
  pot can be won only by players still in who put in at least that level. Chips that folded
  players put in above every live player's level join the top pot.
- **Showdown**: every player still in shows. Best five-card hand out of seven (two hole cards +
  five community cards, any combination, including "playing the board"). Ranking: straight
  flush (royal flush = Ace-high) > four of a kind > full house > flush > straight > three of a
  kind > two pair > pair > high card. Aces are high, and low only in the wheel A-2-3-4-5
  (a Five-high straight); straights never wrap (Q-K-A-2-3 is not a straight). Same category:
  compare the defining ranks, then kickers. Suits never break ties.
- **Split pots**: exactly equal best hands share the pot; odd chips go one each to the winners in
  clockwise order starting with the first winner left of the button (per pot).
- **Units / betting**: 1 unit = 1 chip. `humanNetUnits` = final stack − starting stack;
  `maxLossUnits` = 100 (the starting stack; stake = Jeet per chip: 1/2/5). Outcome: win if the
  net is positive, loss if negative, push if zero (e.g. folding before posting a blind, or an
  even split).

**Decisions / simplifications and why**

- **One hand per game** (D-05) keeps a game short; the button is picked at random each game
  instead of rotating. Real games deal hand after hand (explained in Variants).
- **No antes, no straddles, fixed 1/2 blinds**, 100-chip (50 big blind) stacks — the most
  common friendly cash-game shape and small enough numbers for beginners to count.
- **Board cards are dealt automatically** inside `applyMove` when a betting round closes (no
  forced dealer moves); the UI animates newly revealed cards. When the betting is over early
  (all-ins), the remaining streets are dealt in the same move.
- **Everyone still in shows at the showdown** (no mucking), so the learner always sees why a
  hand was won or lost. Mucking is mentioned in Variants.
- **No betting against nobody**: once every opponent still in is all-in, raises/bets are not
  offered (online-poker behaviour). It changes nothing about who wins.
- **Fold is always legal on your turn**, even when checking is free (standard rules); the bots
  and the coach never fold when they can check for free.
- **Engine options** (`config.options`): `startingStack`, per-seat `stacks` (used to test side
  pots with unequal stacks), `smallBlind`, `bigBlind`, fixed `button`, and a fixed `deck`
  order (tests / curated practice hands). The site uses the defaults. If `affordableUnits` is
  given and the learner's configured stack is above the 100-chip escrow, it is capped at
  100 + `affordableUnits`, so the learner can never lose more than the wallet covers.

**Bots**

- **Easy**: a friendly "calling station" — calls a lot, checks most of the time, rarely raises,
  but folds trash to big bets.
- **Normal**: pre-flop starting-hand chart (Chen formula) by position and price (open-raise
  thresholds get looser closer to the button; re-raises premium hands; short stacks move
  all-in); after the flop a Monte-Carlo equity estimate (150 samples, opponents' cards and the
  rest of the board drawn only from cards the bot cannot see) against the pot odds, value bets,
  occasional semi-bluffs with draws and small bluffs heads-up.
- **Coach**: the normal logic with no random choices (no bluffs), explaining the price (pot odds)
  and the estimated chance of winning in plain words.

**Engine result flags** (for titles/roasts): `folded` = the learner folded; `bigPot` = |net| ≥ 30
chips; `bust` = the learner ended with 0 chips; `luckyLastCard` = won at the showdown with a hand
that was behind a beaten opponent on the turn and ahead after the river; `comeback` = the learner
was all-in (before the river) and behind a beaten opponent on the flop/turn while all-in, but won;
`closeFinish` = the learner's biggest contested pot was decided by a kicker (won or lost);
`perfect` = won holding four of a kind or a straight flush. Tags: `royal-flush`,
`straight-flush`, `four-of-a-kind` (learner's final hand), `bluff-win` (won without a showdown
after betting or raising), `showdown`, `split-pot`, `side-pot`, `all-in`, `folded-best-hand`
(folded a hand that would have won the showdown).

**Popular alternatives** (for the Variants note): multi-hand cash games with a rotating button;
tournaments with rising blinds; full 9–10-player tables; antes and straddles; Limit and Pot-Limit
betting; Omaha (four hole cards, use exactly two); Short Deck / Six Plus Hold'em (2s–5s removed,
flush beats full house); mucking losing hands at the showdown.
