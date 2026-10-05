# Blackjack (21) — rules draft

Engine: `src/games/blackjack/engine.ts` (Tier 1). Content: `content/games/blackjack.ts`.

## Variant taught

Standard casino Blackjack, one learner against the dealer, with "good" multi-deck rules:

- **Shoe**: 6 standard decks (312 cards), shuffled fresh every round, like a continuous
  shuffling machine. One round = one game.
- **Deal**: learner, dealer upcard, learner, dealer hole card (face down).
- **Peek (US hole-card rule)**: when the upcard is an Ace or a ten-value card the dealer
  checks the hole card immediately. A dealer Blackjack ends the round at once and takes
  only the original bet (a learner Blackjack against it pushes).
- **Learner Blackjack** (Ace + ten-value as the first two cards) against no dealer Blackjack
  ends the round at once and pays **3:2**. The dealer only turns the hole card over.
- **Learner actions**: hit, stand, double down, split.
  - **Double down** on any first two cards, including after a split (DAS): bet ×2, exactly
    one more card, hand finished.
  - **Split** any pair **once** (two hands max). A pair is two cards of the same _value_, so
    any two ten-value cards (e.g. King + Queen) may be split, as in most casinos. Each split
    hand is dealt its second card straight away and they are played left to right. Split
    Aces get exactly one card each (no further decisions). A two-card 21 after a split is a
    plain 21 (pays 1:1), never a Blackjack.
  - A hand that reaches **21 stands automatically**.
- **Dealer**: turns the hole card over, then **hits 16 or less and stands on all 17s,
  including soft 17 (S17)**. The dealer does not draw when every learner hand has busted or
  the round was decided by a natural.
- **Payouts**: win 1:1, Blackjack 3:2, equal totals push, a bust always loses (even if the
  dealer busts later).
- **Not offered**: surrender, insurance, even money, re-splitting.

## Decisions and simplifications (and why)

| Decision                                           | Why                                                                                                                                                                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6-deck shoe, fresh shuffle every round             | The most common casino setup; a fresh shuffle keeps rounds independent and makes card counting irrelevant (nothing for a beginner to worry about). The engine also accepts `options.decks` 1–8 (default 6).                   |
| S17 (dealer stands on soft 17)                     | The friendlier, very common rule; one fixed rule ("17 or more, stand") is easiest to teach.                                                                                                                                   |
| Peek for Blackjack                                 | Standard US rule; it means you never lose a double or split to a dealer Blackjack, which is less confusing for beginners.                                                                                                     |
| DAS, split once, split Aces one card               | Standard rules; one split keeps the table readable on a phone (max two hands).                                                                                                                                                |
| Ten-value cards count as a pair                    | Matches most casinos. The coach still tells you to keep the 20.                                                                                                                                                               |
| Auto-stand on 21                                   | Hitting 21 can never help; every online table does this.                                                                                                                                                                      |
| Split hands get their second card immediately      | Equivalent outcome to dealing it later; simpler to show and explain.                                                                                                                                                          |
| No surrender / insurance / even money              | Extra decisions that confuse beginners; insurance is a poor bet. All mentioned in Variants.                                                                                                                                   |
| Doubles/splits only when the wallet can cover them | Escrow betting (D-04): the shell escrows 1 unit; `config.affordableUnits` = extra units the wallet can still cover. Each double/split costs 1 more unit; when it can't be covered the move is refused with a friendly reason. |

## Betting

- Stake options 10/25/50/100/250, `maxLossUnits` 1 (doubles/splits are extra, only when
  affordable).
- `humanNetUnits`: Blackjack +1.5; each hand ±its bet (1, or 2 if doubled); push 0. Range
  −4 … +4 (split and double both hands); never below −(1 + affordableUnits).

## Result flags

- `tags`: `blackjack` (learner natural), `dealerBlackjack`, `dealerBust`, `split`, `doubled`.
- `perfect`: learner natural. `bust`: every learner hand busted. `folded`: never.
- `comeback`: the round was won and a winning hand had drawn a card while on a hard 12–16.
- `luckyLastCard`: the round was won and either a hit/double brought a winning hand to exactly
  21, or the dealer busted while the learner stood on 16 or less.
- `closeFinish`: some hand won or lost by exactly one point (totals compared, no naturals,
  no dealer bust). `bigPot`: |net| ≥ 2.

## Coach and bots

- Coach and the `normal` bot use 6-deck S17 DAS no-surrender **basic strategy**
  (`src/games/blackjack/strategy.ts`), falling back to hit/stand when a double or split is
  not allowed. They only use the learner's cards and the dealer's upcard.
- `easy` bot: hit below 15, otherwise stand (never doubles or splits).
- Measured over 1,000,000 seeded rounds, basic strategy loses 0.35% ± 0.12% per round
  (the published edge for these rules is about 0.4–0.5%); the easy bot loses about 5%.

## Popular alternatives (Variants note)

- Dealer **hits soft 17** (H17) — slightly worse for the player.
- **Re-splitting** up to four hands; re-splitting Aces.
- **Late surrender**: give up half your bet after the peek.
- **Insurance / even money** when the dealer shows an Ace (a side bet; poor value).
- **6:5 Blackjack** tables — much worse for the player; avoid.
- Single- or double-deck games; European **no-hole-card** rule (the dealer takes the second
  card after you play, and a dealer Blackjack can take doubles and splits).
- Home cousins: British **Pontoon** ("twist" / "stick"), French **Vingt-et-un**;
  **Spanish 21** (no pip 10s, bonus payouts).
