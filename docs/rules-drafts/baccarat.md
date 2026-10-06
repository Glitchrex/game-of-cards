# Baccarat (Punto Banco) — rules draft

Engine: `src/games/baccarat/engine.ts` (Tier 1; drawing rules and payouts in `rules.ts`,
exact odds in `odds.ts`). Content: `content/games/baccarat.ts`.

## Variant taught

Punto Banco, one learner against the house:

- **Shoe**: eight standard 52-card decks (416 cards, no jokers), shuffled fresh for every
  coup. One coup = one game. (`options.decks` accepts 1–8 for tests; 8 is the default.)
- **Hands**: two hands are dealt, called **Player** (Punto) and **Banker** (Banco). Neither
  belongs to the learner or the dealer — they are just the two things you can bet on.
- **Bet**: before any card is dealt the learner bets one stake on **Player**, **Banker** or
  **Tie**. Bets are locked once the dealing starts.
- **Card values**: Ace = 1, 2–9 = face value, 10/J/Q/K = 0. A hand's total is the sum of
  its cards with only the last digit kept (7 + 6 = 13 → 3), so totals run 0–9.
- **Deal**: four cards face up, one at a time — Player, Banker, Player, Banker.
- **Naturals**: if either hand's two-card total is 8 or 9 (a natural), both hands stand.
- **Player's third card**: Player draws on 0–5 and stands on 6–7.
- **Banker's third card**: if Player stood, Banker draws on 0–5 and stands on 6–7. If Player
  drew, Banker follows the standard table, using the value of Player's third card:

  | Banker total | Draws when Player's third card is | Stands when it is |
  | ------------ | --------------------------------- | ----------------- |
  | 0–2          | anything                          | —                 |
  | 3            | 0–7 or 9                          | 8                 |
  | 4            | 2–7                               | 0, 1, 8, 9        |
  | 5            | 4–7                               | 0–3, 8, 9         |
  | 6            | 6–7                               | 0–5, 8, 9         |
  | 7            | —                                 | anything          |

- **Winner**: the total closer to 9 wins; equal totals are a tie.
- **Payouts**: Player **1 to 1**, Banker **0.95 to 1** (1 to 1 less a 5% commission), Tie
  **8 to 1**. Player and Banker bets **push** (the stake comes back) on a tie. A losing bet
  loses its stake.
- **Not offered**: side bets (Player/Banker Pair, Dragon 7, …).

## Decisions and simplifications (and why)

| Decision                                   | Why                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Punto Banco (not chemin de fer / banque)   | The version played in almost every casino today; every draw is fixed, so a beginner can enjoy it without learning any decisions.            |
| 8-deck shoe                                | The most common casino shoe, and the one behind the familiar figures (Banker 45.86%, Player 44.62%, Tie 9.52%).                             |
| Fresh shuffle every coup                   | Keeps every coup independent — the key beginner lesson ("streaks and scorecards don't predict anything"). Casinos deal many coups per shoe. |
| Classic 5% commission on Banker (0.95 : 1) | The standard payout; "no-commission" tables change the Banker payout in special cases and are mentioned in Variants.                        |
| Tie pays 8 to 1                            | The most common Tie payout (some tables pay 9 to 1 — Variants).                                                                             |
| One learner vs the house                   | Bettors never interact in Punto Banco, so extra bot bettors would add nothing.                                                              |
| Dealing is one forced dealer move per card | Lets the UI animate each card (and announce each total) in the real order; the dealer has no choices.                                       |
| No side bets                               | They add complexity without teaching anything about the game.                                                                               |

## Odds (exact)

`odds.ts` enumerates every possible coup for a fresh shoe, weighting each sequence of card
values by its exact probability without replacement. For 8 decks:

- Banker wins **45.860%**, Player **44.625%**, Tie **9.516%** of coups.
- House edge (average loss per unit bet): Banker **≈ 1.06%** (0.4462 − 0.95 × 0.4586),
  Player **≈ 1.24%** (0.4586 − 0.4462), Tie **≈ 14.36%** (1 − 9 × 0.0952).
- Banker is the best bet for every shoe size from 1 to 8 decks (1 deck: Banker 1.01%,
  Player 1.29%, Tie 15.75%).

The table of exact odds (`COUP_ODDS`, decks 1–8) is recomputed and checked in
`odds.test.ts`; a 60,000-coup simulation in `simulation.test.ts` confirms the frequencies,
and `audit.test.ts` reproduces the 8-deck and 1-deck figures exactly from the engine's own
deal (see Verification).

## Betting

- Stake options 10/25/50/100/250, `maxLossUnits` 1.
- `humanNetUnits`: +1 (Player win), +0.95 (Banker win), +8 (Tie win), 0 (Player/Banker bet
  on a tie), −1 (loss). No optional extra commitments, so `affordableUnits` has no effect.
- Note for the shell: a Banker win at a 10-Jeet stake is 9.5 Jeet before rounding.

## Bots and coach

- Normal bot: always bets Banker (the smallest house edge). Easy bot: a random bet.
  The dealer seat's only move is to deal the next card.
- Coach: before the bet, suggests Banker and explains the house edges in plain words (with
  the exact figures for the shoe in play) and that the drawing is automatic. During the
  deal, it explains which rule decides the next card.

## Result flags

- `perfect`: the learner won with a natural 9 on their side (for a Tie bet: a 9–9 natural
  tie).
- `luckyLastCard`: the winning hand drew a third card, and its first two cards alone would
  not have beaten the other hand's final total. For a tie: the last card dealt turned
  unequal totals into the tie.
- `comeback`: the learner won although their side was behind after the first four cards or
  after a third card (for a Tie bet: the totals were unequal at some point).
- `closeFinish`: the totals differ by exactly 1.
- `bigPot`: only a winning Tie bet (+8 units). `bust` and `folded` are always false.
- `tags`: `natural` (either hand had a natural), `tie` (the coup was a tie).

## Popular alternatives (for the Variants note)

- **Mini-baccarat**: identical rules at a smaller, faster table.
- **No-commission baccarat**: Banker pays 1 to 1 except in one case — e.g. half when Banker
  wins with a 6, or a push when Banker wins with a three-card 7.
- **Tie 9 to 1** at some tables.
- **Chemin de fer / baccarat banque**: the older French games, where the bank is held at
  the table (in chemin de fer it passes from player to player; in baccarat banque one
  banker keeps it) and some draws are a choice, such as whether to draw on a 5.
- **Side bets** such as Player Pair and Banker Pair.

## Verification (rules audit)

`src/games/baccarat/audit.test.ts` is an independent check of the engine against this page:

- **Every possible coup**: the engine is driven card by card through every sequence of card
  values it asks for (339,400 complete coups for 8 decks). Each coup is compared with a
  reference written from the rules above: which hand gets each card, when the deal stops,
  the winner, the payout and outcome of all three bets, every result flag, the summary,
  the move log and the coach's explanation of each card. Weighted by their exact
  probabilities, the engine's coups reproduce the published odds (8 decks: Banker 45.8597%,
  Player 44.6247%, Tie 9.5156%; 1 deck: 45.9624% / 44.6760% / 9.3615%) and house edges.
  Deliberately broken rules (e.g. Banker 3 standing on a 9, a tie losing Player bets,
  Banker paying 1 to 1) all make it fail.
- **Edge cases**: naturals on both sides, 9 + 9 = natural 8, three-card 9s, picture-card
  zeros, and every boundary of the Banker table played through the engine.
- **Fuzzing**: 3,000 coups with random legal moves on 1–8 decks, trying every illegal move
  for every seat at every step (each must be refused with a reason and throw
  `IllegalMoveError`), deep-frozen and JSON round-tripped states, and card conservation.
- **Hidden information**: reshuffling the face-down shoe never changes the coach, the bots
  or the move log (the deal's log only names the card it turns face up).
- **Bots**: over 30,000 coups the normal bot (always Banker) wins about 46% and loses about
  1% a coup; the easy bot (random bets) wins about 33% and loses about 6% a coup.
