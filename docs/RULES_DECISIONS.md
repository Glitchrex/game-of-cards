# Rule decisions

Which variant of each game we teach and why. Rule of thumb: **the most widely played
standard rules, simplified only where a beginner would otherwise be blocked** — and every
simplification is listed here and mentioned in the game's in-app "Variants" note.

Betting vocabulary used below: the learner picks a **stake** (Jeet value of one betting
unit). `GameResult.humanNetUnits × stake` is the Jeet won or lost. `maxLossUnits` is the
worst case, escrowed from the wallet before the deal (see `docs/DECISIONS.md` D-04).

---

## Tier 1 (playable vs bot)

### Blackjack (21)
- 6-deck shoe, freshly shuffled every round (like a continuous shuffler).
- One learner vs the dealer. Dealer **stands on all 17s** (S17). Dealer peeks for
  Blackjack when showing an Ace or a ten-value card (US hole-card rule), so a dealer
  Blackjack only takes the original bet.
- Blackjack (Ace + ten-value as the first two cards) pays **3:2**; a win pays 1:1;
  equal totals push.
- Double down on any first two cards (one more card, bet doubled), including after a split.
- Split any pair **once** (two hands max). Split Aces get one card each; an Ace + ten
  after a split counts as 21, not Blackjack.
- No surrender, no insurance (both explained in Variants; insurance is a bad bet for
  beginners anyway).
- Coach hints use standard 6-deck S17/DAS basic strategy.
- Betting: stake options 10/25/50/100/250, `maxLossUnits` 1; doubles and splits are only
  offered if the wallet can cover the extra stake.

### Teen Patti
- 3 seats by default (learner + 2 bots); 2–5 supported. One deal per game.
- Everyone posts a **boot** of 1 unit. All players start **blind**.
- On your turn: **Pack** (fold), **Chaal** (bet), or **See** your cards (blind → seen,
  then you act). Blind players bet the current stake (1×) or raise to 2×; seen players bet
  2× the current stake or raise to 4× (the "stake" is the blind-equivalent amount).
- Chaal limit: the current stake cannot exceed 8 boots. **Pot limit 64 boots**: when a bet
  would reach the limit the pot is capped and every remaining player goes to a show.
- **Show**: only when exactly two players remain; costs the same as a chaal. Highest hand
  wins; if hands are exactly equal, the player who *asked* for the show loses.
- Hand ranking: Trail (three of a kind) > Pure sequence > Sequence > Colour > Pair > High
  card. Sequences rank A-K-Q (highest), A-2-3, K-Q-J … down to 4-3-2.
- No side show (mentioned in Variants), no jokers/wild-card variants.
- Betting: stake = Jeet per boot (5/10/20), `maxLossUnits` 64.

### Andar Bahar
- Single deck. The dealer turns up the **joker** (middle card). The learner bets on
  **Andar** (inside) or **Bahar** (outside).
- Cards are dealt alternately, **starting with Andar**, until a card matching the joker's
  rank appears; that side wins.
- Because Andar gets the first card it wins slightly more often, so **Andar pays 0.9:1**
  and **Bahar pays 1:1** (the common casino convention).
- Side bets on the number of cards dealt are omitted (Variants).
- Betting: stake 10/25/50/100/250, `maxLossUnits` 1.

### Indian Rummy (13-card Points Rummy)
- 2 players (learner vs bot); 2 standard decks + 2 printed jokers.
- 13 cards each. One card is turned up as the **wild joker**: every card of that rank (any
  suit) is a joker, as are the printed jokers. If the wild-joker card is a printed joker,
  Aces are wild.
- Turn: draw from the closed stock or the open discard pile, then discard one card.
- **Declare** when all 13 cards (after discarding the 14th) form valid groups with **at least
  two sequences, one of them pure** (no jokers). Sets: 3–4 cards of one rank, all different
  suits. Sequences: 3+ consecutive cards of one suit; Ace is low (A-2-3) or high (Q-K-A),
  no wrapping (K-A-2).
- Scoring: the loser pays points for ungrouped cards (A, K, Q, J, 10 = 10 points; number
  cards face value; jokers 0). If the loser has no pure sequence, every card counts.
  **Cap 80 points.**
- **Drop**: before your first draw = 20 points, later = 40 points.
- Beginner simplification: an *invalid* declaration is blocked with an explanation instead
  of the usual 80-point penalty.
- When the stock runs out, the discard pile (except its top card) is reshuffled.
- Betting: stake = Jeet per point (1/2/5), `maxLossUnits` 80.

### Texas Hold'em Poker (No-Limit)
- 4 seats by default (learner + 3 bots), 2–6 supported. One hand per game.
- Each player starts with 100 chips. Blinds 1/2. Dealer button rotates by seed.
- Standard No-Limit betting: fold / check / call / bet / raise (min raise = previous raise
  size, all-in always allowed). Side pots are handled.
- Best five-card hand from 7 cards; standard ranking (royal flush … high card); ties split
  the pot (odd chip to the first winner left of the button).
- Betting: stake = Jeet per chip (1/2/5), `maxLossUnits` 100.

### Baccarat (Punto Banco)
- 8-deck shoe, fresh shuffle each round. Bets on **Player**, **Banker** or **Tie**.
- Standard tableau: naturals on 8/9; Player draws on 0–5 and stands on 6–7; Banker draws
  according to the standard third-card table.
- Player pays 1:1, Banker pays 0.95:1 (5% commission), Tie pays 8:1. Player and Banker bets
  **push** on a tie.
- Betting: stake 10/25/50/100/250, `maxLossUnits` 1.

### Hearts
- 4 players (learner + 3 bots), one hand per game. Pass 3 cards to the left.
- The 2♣ leads the first trick. No hearts or Q♠ on the first trick unless you have no
  other choice. Hearts cannot be led until "broken" (unless you hold only hearts).
- Each heart = 1 point, Q♠ = 13. **Shooting the moon** (all 26) gives 26 to everyone else.
- The player(s) with the **lowest** score win. Betting: winner-takes-pot — sole winner
  +3 units, shared win (k winners) +(4−k)/k, otherwise −1. `maxLossUnits` 1.
- Variants note: full games play to 100; passing rotates left/right/across/hold.

### Spades
- 4 players in partnerships: learner + bot partner (seat 2) vs two bots (seats 1 & 3).
  One hand per game.
- Each player bids 0–13 tricks (0 = **Nil**; no Blind Nil). Spades are always trump and
  cannot be led until broken (unless only spades are held).
- Partnership score: made bid = 10 × bid + 1 per overtrick (bag); failed = −10 × bid.
  Nil made = +100, failed = −100 (the partner's tricks count separately).
- Higher team score for the hand wins; tie = push. Betting ±1 unit, `maxLossUnits` 1.
- Variants note: full games play to 500 with a 10-bag penalty.

### Crazy Eights
- 3 players by default (learner + 2 bots), 2–4 supported. 7 cards each with 2 players,
  5 cards each with 3–4 players.
- Play a card matching the top card's **suit or rank**. **Eights are wild**: play one any
  time and name the next suit.
- You may draw instead of playing; if you cannot play you must draw, one card at a time,
  until you can. If the stock is empty and you cannot play, you pass.
- First to empty their hand wins. Betting: winner takes the pot (+N−1 units), else −1.

### Go Fish
- 3 players by default (learner + 2 bots), 2–5 supported. 7 cards each (5 with 4–5).
- On your turn ask one player for a rank you already hold. If they have any, they hand
  over all of them and you go again. Otherwise "Go Fish": draw one card; if it is the rank
  you asked for, show it and go again.
- Four of a kind = a **book**, laid down immediately. If your hand empties, draw a card
  (if the stock has any).
- When all 13 books are made, most books wins (ties share). Betting: pot model as above.

### War
- 2 players, 26 cards each. Both flip; the higher card (A high) wins both.
- Tie = **War**: each places 3 cards face down and 1 face up; the higher face-up card wins
  everything. A player without enough cards uses their last card as the face-up card.
- Won cards go to the bottom of the winner's pile in a fixed order.
- Beginner length cap: the game ends when one player has all the cards **or after 60
  battles**, in which case whoever holds more cards wins (equal = push).
- Betting: ±1 unit.

### Klondike Solitaire
- Draw-1, unlimited passes through the stock, 7 tableau piles, 4 foundations (A → K).
- Standard moves: build tableau down in alternating colours, only Kings to empty columns,
  foundation cards may be moved back to the tableau.
- The learner may resign at any time ("I'm done").
- Betting uses **Vegas-style scoring**: each card on a foundation returns 5/52 of the stake.
  Net units = 5 × foundationCards ÷ 52 − 1 (clearing all 52 = +4 units). `maxLossUnits` 1.
  Outcome = win if the game is cleared or the net is positive, else loss.

---

## Tier 2 (lesson + scripted example + quiz)

Tier 2 decisions are appended below by the content authors (one section per game).
