### War

**Variant taught:** classic two-player War (3 cards face down in a war) with the beginner
length cap of 60 battles. Engine: `src/games/war/engine.ts` (battle mechanics in
`src/games/war/rules.ts`); content: `content/games/war.ts`.

**Rules implemented**

- 2 seats only: the learner (seat 0) against one bot (seat 1). One shuffled 52-card deck
  is dealt one card at a time, alternately, starting with the learner: **26 cards each**
  in a face-down pile (pile top = index 0). Nobody looks at or reorders their pile.
- **A battle:** both players turn their top card face up at once. The higher **rank**
  wins — 2 lowest … 10, J, Q, K, **Ace highest**; **suits never matter**.
- **War (a tie):** each player lays **3 cards face down** and turns **1 face up**; the
  higher face-up card takes every card in the middle (10 cards). If the face-up cards tie
  again the war repeats (double war = 18 cards, and so on). A whole chain of wars is
  **one battle**.
- **Short of cards in a war:** a player with fewer than 4 cards lays all but their last
  card face down and uses the **last card as the face-up card** (3 cards → 2 down + 1 up,
  2 → 1 + 1, 1 → 0 + 1). A player with **no card left when a war needs one loses** the
  battle — the opponent collects the middle and therefore holds all 52 cards, ending the
  game.
- **Both run out in the same war** (only possible when every face-up card ties until both
  piles are empty — astronomically rare, but handled): nobody can go on, each player takes
  back exactly the cards they played, and the game ends as a **push**.
- **Collecting:** the winner puts the cards **under** their pile in a fixed order — the
  winner's own cards first, then the loser's, each in the order they were played (opening
  card, then each war's face-down cards and face-up card).
- **End of the game:** as soon as one player holds all 52 cards, or after **60 battles**
  (`options.maxBattles`, 1–1000, default 60). At the cap the bigger pile wins; equal
  piles (26–26) are a push. If the 60th battle also wins the last card, that counts as an
  "all cards" win.

**Moves and turns (UI contract)**

- War has no decisions, so `currentPlayer` is **always seat 0** while the game runs and
  the only move is `{ type: 'flip' }` (moveKey `'flip'`). One flip fights the whole battle,
  including any chain of wars; the bot never moves on its own. `legalMoves(state, 1)` is
  always empty. In simulations seat 0 is driven by `botMove`.
- `state.lastBattle.rounds` keeps every card turned in the latest battle
  (`rounds[0]` = the opening flip, later rounds = wars, each with `down` and `up` per seat)
  so the board can animate the battle step by step; `won` is the collection order and
  `counts` the pile sizes afterwards. `state.history` keeps one compact record per battle
  (winner, wars, cards in the middle, pile sizes) for the result flags.
- Face-down war cards are hidden information: `describeMove` and the coach never name
  them (they only name the face-up cards).
- The coach's "why" is checked against the battle it describes: it says "3 cards face
  down" only when both players laid 3, names a double war as such, and only promises a
  10-card war when both piles can still afford one (5 cards each).

**Betting:** win **+1** unit, lose **−1**, push **0**. `maxLossUnits` 1. There are no
optional extra commitments, so `config.affordableUnits` does not affect War.

**Result flags**

- `comeback` — the learner won after holding **16 cards or fewer** at the end of some
  battle.
- `closeFinish` — the game ended at the battle cap with the piles **within 4 cards**
  (28–24, 26–26 or 24–28). Used for close-win titles and close-loss roasts.
- `luckyLastCard` — the **final battle was a war won by the learner, and it decided the
  game**: the learner won, and had Player 1 taken the cards in the middle instead, the
  learner would not have been ahead (`lastWarDecided`). Examples at the cap: 27–25 before
  a final 10-card war → 32–20 counts (losing it would be 22–30); 35–17 → 40–12 does not
  (still 30–22 after losing it). Finishing off a bot with one or two cards left does not
  count either; a final war that swallows half the deck does. This matches how the other
  engines read the flag ("the decisive card arrived at the very end").
- `bigPot`, `perfect`, `bust`, `folded` — never (±1 bet, no choices to make).
- Tags: the ending (`all-cards`, `battle-cap` or `both-out`); `war-won` plus
  `war-won:<n>` (the number of battles that went to war and were won by the learner);
  `double-war` when any battle had two or more wars in a row.

**Bots:** there is nothing to decide, so `botMove` always flips at both difficulties
(`easy` and `normal` are identical). It throws if asked to move for a seat that is not
to act, like the other engines. The coach explains that War is pure luck, what a war is,
what happened in the last battle, how many battles remain near the cap, and always
suggests the flip.

**Simulation (default rules):** 5,000 seeded games average 58.1 battles; 13 % end with
one player holding all 52 cards and 87 % at the 60-battle cap. Learner outcomes: 47.5 %
win, 46.6 % loss, 5.9 % push. Flags: `closeFinish` 17.6 %, `comeback` 5.5 %,
`luckyLastCard` 1.0 %. Easy and normal play identical games from the same seed.

**Decisions and simplifications (and why)**

- **60-battle cap** (from docs/RULES_DECISIONS.md): with these rules an uncapped game
  averages about 200 battles (2,000 seeded deals, many far longer). The cap keeps a game
  to a few minutes; the bigger pile wins. A war chain, however long, is one battle.
- **Fixed collection order** (winner's cards first, then the loser's, in play order):
  deterministic, easy to explain and to animate. At a real table people pick the cards up
  in any order.
- **One flip = one whole battle**, war chain included, with the details kept in
  `lastBattle` for the animation — the learner never has to press anything during a war.
- **Both players out in the same war = push**: no standard rule exists for this; a tie is
  the fairest and simplest outcome, and each player keeps exactly the cards they played so
  every card is still accounted for.
- **Two players only:** the classic game. Multi-player War is described in Variants.

**Popular alternatives (Variants note)**

- Playing with no time limit, to the last card (or for an agreed time).
- Wars with 1 or 2 face-down cards instead of 3, or chanting "I de-clare war!" with one
  card per beat.
- Picking up won cards in any order, or shuffling your pile from time to time (shorter
  games, fewer loops).
- Three or more players: everyone flips, the highest card takes all, and only the tied
  players fight the war.
- "Low card wins" for a twist.
