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
  wins; if hands are exactly equal, the player who _asked_ for the show loses.
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
- Beginner simplification: an _invalid_ declaration is blocked with an explanation instead
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

Each Tier 2 section below is the author's rules draft after an independent rules review.

### Gin Rummy

**Variant taught:** standard two-player Gin Rummy as described by the common references
(Hoyle-style rule books, Pagat, the Bicycle/USPCC rules): 10 cards each, Ace low, knock with
10 or fewer deadwood points, 25-point gin bonus, 25-point undercut bonus, game to 100.

**Rules as taught**

- 2 players, one 52-card deck, no jokers. Card values: Ace 1, 2–10 face value, J/Q/K 10.
- Deal 10 cards each; the next card is turned face up as the **upcard** (starts the discard
  pile); the rest is the stock.
- First turn: the non-dealer may take the upcard; if they pass, the dealer may take it; if
  both pass, the non-dealer draws from the stock. (Taught as a lesson tip; the example uses it.)
- Each turn: draw one card (top of stock or top of discard pile), then discard one.
- Melds: **sets** (3–4 cards of one rank) and **runs** (3+ consecutive cards of one suit).
  **Ace is low only** — A-2-3 is a run, Q-K-A and K-A-2 are not. A card belongs to one meld.
- **Knock** when deadwood ≤ 10 after discarding: discard face down and lay out the hand.
  Knocking is optional.
- **Gin** = 0 deadwood: 25-point bonus + the opponent's full deadwood; no laying off.
- After a normal knock the defender lays out melds and may **lay off** deadwood onto the
  knocker's melds. The knocker never lays off.
- Scoring: knocker scores the deadwood difference. **Undercut** (defender's deadwood ≤
  knocker's): defender scores the difference + 25.
- If the stock is down to its last two cards and nobody has knocked, the hand is a draw
  (no score). Taught as a short tip.
- First to 100 points wins the game.

**Simplifications / decisions and why**

- End-of-game "box" scoring (100-point game bonus, 25 per hand won, doubled shutout) is
  described in Variants but not taught in the lesson: it is bookkeeping that doesn't change
  how a hand is played, and beginners learn one hand at a time.
- We don't teach the rule found in some rule books that you may not discard the card you
  have just taken from the discard pile in the same turn — it is not universal and never
  matters in our example. It can be added to the lesson if the RULES_DECISIONS merge
  adopts it.
- Bonus sizes vary between sources (gin 20 or 25; undercut 10, 20 or 25). We use 25/25,
  the most common modern figures, and mention the others in Variants.
- Big Gin (11-card gin) is a variant, not part of the core rules taught.
- Equal deadwood counts are an undercut (the knocker does not win ties), as in Pagat and
  Hoyle-style rules; the gin knocker can never be undercut.

**Popular alternatives (in the in-app Variants note)**

- Box scoring (game bonus, line/box bonuses, shutout doubling).
- Oklahoma Gin (upcard sets the knock limit; an Ace means gin only).
- Straight Gin (no knocking).
- Big Gin bonus; Hollywood scoring (three games at once); 3–4 player versions.

**History note (hedged in content):** grew out of older rummy games in the US in the early
1900s; a popular story credits Elwood T. Baker (New York, c. 1909) — stated as a story, not
fact. 1930s–40s craze, especially in Hollywood. Name often said to be a pun on rum/rummy.

### Bridge (beginner introduction)

**Variant taught:** a beginner introduction to Contract Bridge — the core loop only: deal, a
simple bidding idea, the contract, declarer and dummy, trick play (trumps / No Trump), and
making the contract. Full Laws, bidding systems and detailed scoring are pointed to in Variants.

**Rules as taught (these follow the Laws of Contract Bridge)**

- 4 players, 2 partnerships (partners opposite). 52 cards, 13 each, dealt one at a time.
  Ace high … 2 low.
- Auction: starts with the dealer, clockwise. A bid = level 1–7 + strain; tricks promised =
  level + 6 (book). Strain order ♣ < ♦ < ♥ < ♠ < NT. Each bid must be higher than the last
  (higher level, or same level and higher strain). A bid followed by three passes ends the
  auction; the last bid is the contract.
- If all four players pass at the start, the deal is thrown in and redealt (taught in one
  sentence; in duplicate it simply scores zero).
- Declarer = the player of the contracting side who _first_ named the contract's strain
  (suit or No Trump).
  Opening lead by the player to declarer's left, then dummy is faced and declarer plays both
  hands.
- Play: must follow suit; otherwise any card (a trump = ruff). Highest trump, else highest card
  of the suit led, wins; the winner leads next.
- Scoring summary given: trick points per odd trick ♣/♦ 20, ♥/♠ 30, NT 40 then 30; game = 100+
  trick points (3NT, 4♥/4♠, 5♣/5♦) earns a bonus; failing gives the defenders points;
  overtricks score a little extra.

**Simplifications / editorial decisions**

- Bidding is taught as _guidelines_, explicitly labelled as such: high card points (A4 K3 Q2
  J1), open with about 12+, about 25 combined for game, about 33 for a small slam. Partner's
  1♠–3♠ is described as "in many beginner systems … spade support and about 10–12 points" (the
  limit raise in both Standard American and Acol) rather than tying the site to one system.
- Doubles, redoubles, vulnerability, slam/part-score/rubber bonuses and exact penalty values are
  not drilled (mentioned in Variants). No exact bonus numbers are given, to avoid mixing up
  rubber and duplicate scoring.
- Revokes are mentioned only as a mistake ("costs tricks"), without the exact penalty.
- Seats are introduced as North/South vs East/West in the first lesson step, because every
  later caption uses compass names.
- "Draw trumps" is a glossary term (used in the strategy step and the example).
- Origin: country United States (Contract Bridge's scoring was devised there in 1925),
  region "global" because the game is played worldwide; history traces it back to English
  Whist (Hoyle's 1742 treatise), dates bridge-whist loosely to the late 1800s and auction
  bridge to the early 1900s, and hedges the cruise story ("reportedly").

**Scripted example (consistency notes)**

- South (learner, dealer): ♠AKJ74 ♥A63 ♦85 ♣K92 (15 HCP). North (dummy): ♠QT82 ♥KQ5 ♦A9643
  ♣7 (11 HCP). West: ♠96 ♥JT98 ♦KQJT ♣A86. East: ♠53 ♥742 ♦72 ♣QJT543.
- Auction: 1♠ – pass – 3♠ – pass – 4♠ – all pass. Opening lead K♦.
- Play (all 13 tricks scripted): A♦; two rounds of trumps (2–2 split); three hearts; 7♣ to K♣
  loses to A♣; West cashes Q♦; J♦ ruffed by South; club ruffed in dummy; crossruff for the
  rest → 11 tricks (4♠ +1).
- Decisions: open 1♠; accept the invitation (4♠); count 9 sure winners; draw trumps; stop after
  two rounds (keep dummy's trumps); ruff the club in dummy.

**Popular alternatives (in Variants)**

- Full rubber or duplicate bridge; bidding systems (Standard American, 2-over-1, Acol) and
  conventions (Stayman, Blackwood); Chicago; Minibridge (teaching game that replaces the
  auction with a points count); Honeymoon Bridge for
  two. Learners are pointed to their national federation or a local club.

**Editorial review (second pass)**

- All 13 tricks of the scripted deal were replayed against the four hands above: every follow
  is legal (e.g. East is void in diamonds by trick 9, West must follow with the 10♦ at trick 11
  and the 8♣ at trick 12), trick winners are correct and the total is 11 tricks for N–S.
- Narration now spells out the moves a beginner could not infer: dummy's 5♥ under the A♥ and
  the 6♥ entry to dummy's K♥; South's 8♦ under West's Q♦; partner's 3♠ described as an
  invitation; the K♦ lead only "suggests" West holds the Q♦.
- Final scene highlights all five ruffs (4♠, 10♠, 7♠, Q♠, J♠), not four.

### Twenty-Nine (29)

**Variant taught:** standard **four-player partnership Twenty-Nine** as usually described
(Pagat / common Indian club rules): 32 cards, J-9-A-10-K-Q-8-7 ranking, bidding 16–28 on the
first four cards, a hidden trump card, the pair, and ±1 game point per deal, playing to 6.

**Rules as taught**

- 4 players, fixed partnerships, partners opposite. Deal and play are **anticlockwise**.
- 32 cards (A, K, Q, J, 10, 9, 8, 7 of each suit). Rank in every suit, high to low:
  **J, 9, A, 10, K, Q, 8, 7**.
- Card points: **J = 3, 9 = 2, A = 1, 10 = 1**, others 0 — 28 points in the deck.
- The dealer deals **4 cards each**; bidding is done on these four.
- **Bidding:** starts with the player to the dealer's right. Each player bids a number from
  **16 to 28** (each bid higher than the last) or passes; a player who passes is out. The highest
  bidder is the **bidder** and their team must take at least the bid in card points.
- The bidder chooses trumps **secretly** by placing one card **from their first four** face down
  (the **trump card**). Then 4 more cards each are dealt (8 each).
- The **player to the dealer's right leads** the first trick. Players must follow suit; the
  highest card of the suit led wins unless trumps (once revealed) are played; the winner leads.
- **Calling for trump:** a player who cannot follow suit may ask for the trump card to be
  revealed. The bidder turns it face up and takes it back into hand. The player who called must
  play a trump to that trick if they have one. Before the reveal, a card of the (secret) trump
  suit played off-suit does not count as a trump. The bidder may call for trump themselves when
  they cannot follow suit.
- After the reveal, trumping is **never compulsory** except for the player who called, in the
  trick in which they called: a player who can't follow suit may play a trump or any other card.
  (Stated explicitly in the lesson after review.)
- **Pair:** after trumps are revealed, a player holding K and Q of trumps may show them. If the
  bidding team holds the pair, the target goes down by 4; if the opponents hold it, the target
  goes up by 4 (never above 28).
- **Scoring:** bidders take ≥ bid → **+1 game point**; otherwise **−1**. A game is usually played
  to **+6** (or until a team reaches −6); many players keep score with the spare 6s.

**Simplifications / decisions and why**

- **Auction simplified to "bid higher or pass."** The traditional 29 auction is conducted between
  two players at a time, with the earlier speaker allowed to "hold" (match) the current bid.
  That mechanic is confusing for absolute beginners and doesn't change the core idea (highest
  bidder wins the right to name trumps); it is described in Variants.
- **Minimum bid 16** (as specified in the brief and the most common form); 15/17 starts noted in
  Variants.
- **Pair timing** kept loose in the lesson ("once trumps are revealed"). Many groups require the
  holder's team to have won a trick after the reveal before showing it, and some say the bid can
  never drop below 16 after a pair reduction — both noted as "varies" in Variants / here rather
  than taught, because sources and home rules differ.
- **Double / redouble, single hand, redeal when the first four cards hold no points** are left to
  Variants (optional extras).
- **All-pass:** not covered in the lesson (cards are thrown in and redealt in most descriptions;
  some groups force the dealer to bid). Not needed to learn the game.
- The "bidder may not lead trumps before they are revealed" type of restrictions found in some
  rule sets (more common in Twenty-Eight) are not taught; the example never has the bidder lead
  the trump suit before the reveal, so it is consistent with either rule.

**Example hand** (verified with a small script: every hand has 8 cards, all 32 cards used once,
every play follows suit legally, points add to 28): You bid 17 on J♥ 9♥ 8♥ A♣, hide the 8♥,
lead J♠ (+4), lose a cheap 7♣ to the dealer's J♣ (opp +3), reveal trumps on the A♦ lead and win
with the 8♥ (+3), pull trumps with J♥ (+4) and 9♥ (+3), then A♣ is overtaken by partner's 9♣
(+4) and partner wins J♦ (+3) and 10♦ (+4). Final 25–3; bid made, +1 game point.

**Popular alternatives (in the in-app Variants note)**

- Traditional paired auction with "hold"; starting bid 15 or 17.
- Double (×2) and redouble (×4).
- Single hand (one player tries to win all 8 tricks alone).
- Redeal when a player's first four cards hold no points.
- Pair-timing variations.
- Twenty-Eight as a close cousin.

**History note (hedged in content):** popular in India and neighbouring countries such as
Bangladesh and Nepal; part of the Jass family (with Belote/Klaverjas) where J and 9 are top
cards; card historians think the family reached South Asia from Europe ("exactly how and when is
not known"); the cards total only 28, and the origin of the name is described as uncertain. No
dates or names asserted.

**Editorial review (second pass)**

- Rules re-checked statement by statement (ranking, card points, 4 + 4 deal, bidding range,
  hidden trump from the first four cards, calling for trump, pair ±4, ±1 game point to 6/−6).
  No rule errors found. The example deal was re-simulated: 32 unique cards, all plays legal, trick
  winners correct, 25–3 total = 28.
- Added the missing "after the reveal, trumping is optional" sentence to the calling-for-trump
  step, and "(the bidder may call too)".
- Added a `suit` glossary term, linked in the ranking step, because absolute beginners don't know
  the word; replaced "ranks" with "kinds of card" in step 1.
- History: "where the Jack and Nine **of trumps** are also the top cards" (in Belote/Klaverjas the
  J-9 order applies only to trumps).
- Example trick 1: partner's 10♠ was forced (their only Spade), so "cleverly drops" became
  "follows with". Trick 6 decision: the A♣ is not yet a sure winner (the 9♣ is still out), so
  the feedback/pro hint now say it is the _best chance_ (one higher card out vs two for the Q♠),
  and the narration notes that all trumps are gone.
- Still unverified against a primary source (pagat.com unreachable from this environment): the
  16 floor after a bidding-team pair (not stated in the lesson; the lesson's 20 → 16 example is
  safe either way) and the all-pass procedure.

### Mendikot

**Variant taught:** standard **four-player partnership Mendikot** with **cut hukum** trumps
(trump suit set by the first card played by a player who can't follow suit), one 52-card deck,
Ace high, the team with 3 or 4 tens winning the deal (2–2 decided by tricks).

**Rules as taught**

- 4 players, fixed partnerships, partners opposite. Deal and play are **anticlockwise**.
- One 52-card deck, no jokers. All cards dealt: **13 each**. Rank: A (high), K, Q, J, 10 … 2.
- The **player to the dealer's right leads** the first trick; the winner of each trick leads the
  next. Players must follow suit if able; otherwise they may play any card.
- **Cut hukum:** no trumps at the start. The first time a player can't follow suit, the suit of
  the card they play becomes trumps (_hukum_) for the rest of the deal. That card already counts
  as a trump in that trick, so it wins unless a later player in the same trick plays a higher
  trump.
- After that, a trump beats any non-trump; higher trump beats lower. Trumping is **not
  compulsory** when void — you may discard instead.
- **Winning the deal:** the team that captures **3 or 4 tens** wins. With **2 tens each**, the team
  with **7 or more tricks** wins. All four tens = **Mendikot**; all 13 tricks = **whitewash**.

**Simplifications / decisions and why**

- **Cut hukum chosen over band hukum.** Both are standard ways of fixing trumps in Mendikot.
  Cut hukum needs no secret card and no extra "reveal" rule, so it's the easiest for absolute
  beginners — and it gives the site variety, since Twenty-Nine already teaches a hidden trump
  card. Band hukum (one player — often the one to the dealer's right — places a card face down
  whose suit is trumps, revealed the first time someone can't follow suit) is described in
  Variants with that "often" hedge, because descriptions differ on who chooses.
- **Scoring across deals kept informal.** Mendikot has no single standard points table; most
  descriptions count deals won, with Mendikot/whitewash as bigger wins, and the losing team
  dealing next (exact dealer-rotation rules vary and were not verified against a primary
  source, so they are not stated precisely). The content says "many families" for all of this
  rather than inventing a points scheme.
- **Batch sizes of the deal** (often 5-4-4) are not taught; "13 each" is all a beginner needs.
- No obligation to trump when void (standard for Mendikot/whist-family games); stated in the
  lesson.

**Example hand** (verified with a small script: all 52 cards used once, every play legal, cut
hukum applied on trick 1): dealer is partner (North), so West leads. W leads A♦, you're void and
set Clubs as trumps with the 5♣; partner feeds the 10♦. You lead A♠ and East's singleton 10♠
falls. East trumps your K♠ with the 3♣. East leads 5♥, partner wins with A♥ and you feed the
10♥ (3 tens — deal won). Partner leads the 8♣ trump; you play A♣ and East's last club, the 10♣,
falls: **Mendikot**. The remaining 8 tricks are summarised (they can't change the result).

**Popular alternatives (in the in-app Variants note)**

- Band hukum (hidden trump card).
- Six- or eight-player versions in alternating teams, removing some low cards.
- Informal scoring by deals won; Mendikot / whitewash counting extra; loser deals.
- Dehla Pakad ("catch the ten"), described as a very similar North Indian game.

**History note (hedged in content):** much-loved family game in western India, especially
Maharashtra and Gujarat; often a first trick-taking game for children; part of the wider
trick-taking family that includes Whist; origin of the name stated as uncertain. No dates or
names asserted.

**Editorial review (second pass)**

- Rules re-checked (52 cards Ace high, 13 each, anticlockwise, player to dealer's right leads,
  cut hukum with the cutting card counting as trump in that trick, optional trumping, 3–4 tens or
  2–2 with 7+ tricks, Mendikot / whitewash). No rule errors found.
- Example re-checked by completing all four 13-card hands consistently with the five scripted
  tricks: every play is legal (East's only Spade is the 10♠, East's only Clubs are the 3♣ and
  10♣), winners and ten counts are correct, and all four decisions' "correct" answers are right.
- Added `suit` and `trump` glossary terms (beginners meet "suit" in the ranking step and "trump"
  as a verb throughout); linked them in the ranking and "Using trumps" steps.

### Durak

**Variant taught:** Podkidnoy ("throw-in") Durak, the most widely played form (Pagat; Russian
house-rule consensus), taught as a two-player game. The lesson mentions how the throw-in idea
extends to 3–6 players, but every scene and the scripted example are two-player.

**Rules as taught**

- Deck: 36 cards, 6 up to Ace in each suit (a 52-card deck minus 2–5). Ranks low → high:
  6, 7, 8, 9, 10, J, Q, K, A.
- Deal 6 cards each. The next card is turned face up and placed under the stock (crosswise, so it
  stays visible); its suit is trump and it is the last card drawn.
- First deal: the player holding the lowest trump attacks first.
- Attack: the attacker plays any card. The defender must beat it with a higher card of the same
  suit or with any trump; a trump attack can only be beaten by a higher trump. The defender may
  always choose to pick up instead of beating.
- Throw-in (podkidnoy): after a card is beaten, the attacker may add another attack card of any
  rank already on the table (attack or defence cards). Limits: at most 6 attack cards in a bout,
  and never more than the number of cards the defender held at the start of the bout.
- If the defender beats everything and the attacker adds nothing more → "beaten": all the cards
  go face down to the discard pile and the defender becomes the next attacker.
- If the defender can't or won't beat a card → they pick up every card on the table (the attacker
  may first throw in more matching cards, within the limits) and lose their turn to attack; in a
  two-player game the attacker attacks again.
- Refill: after each bout, players with fewer than 6 cards draw back up to 6 — attacker first,
  defender last. Once the stock (including the face-up trump) is gone, nobody draws.
- With the stock empty, a player who runs out of cards is safe. The last player holding cards is
  the durak (the only loser). If the last two players run out at the same moment, it is usually
  called a draw.

**Simplifications / editorial decisions**

- Podkidnoy chosen over "simple" Durak because throwing in is the heart of the game as most
  Russians play it. Simple Durak is described in Variants (hedged: "usually played without
  throw-ins").
- Two-player focus: the multi-player rules (attack the player on your left, others may also
  throw in, who may throw in differs by table) are only summarised in Variants.
- The attack is taught as one card at a time; opening with a pair or more of the same rank is
  listed as a table variant, as is the common "first bout max 5 cards" limit.
- Who starts later games (and who deals) varies by table — content only says "often the newest
  durak deals". No rule for "nobody has a trump" is stated (rare; tables usually redeal or let
  the lowest card start).
- Strategy (lead low non-trumps, use the cheapest beating card, save trumps, use pairs to
  throw in, picking up early is not a disaster) is presented as rules of thumb.
- History is hedged: "is thought to have spread across Russia during the 1800s", "widely called
  the most popular card game in Russia and many former Soviet countries".

**Scripted example (consistency notes)**

- Trump: hearts; face-up trump card 9♥ (stock face-down placeholder 10♦).
- You: 6♥ 7♠ 7♦ 8♣ 10♣ K♠ (lowest trump → you attack). Opponent: J♠ 9♦ 9♣ Q♠ Q♦ 8♥.
- Bout 1: 7♠ (decision) beaten by J♠; throw in 7♦ (decision) beaten by 9♦; "beaten". You draw
  A♥ 8♠, opponent draws J♣ K♦.
- Bout 2: opponent attacks 9♣; you beat with 10♣ (decision); beaten. Opponent draws A♦, you
  draw 9♠. You attack next.
- Fast-forward to the empty stock: you hold 8♠ 8♦; opponent Q♠ K♥ 6♣. You lead 8♠ (beaten by
  Q♠), throw in your last card 8♦ (decision; 2 attack cards ≤ defender's 3) — beaten by K♥, but
  you are out; opponent holding 6♣ is the durak.
- Decisions: opening attack with a low paired non-trump; throw in a matching rank; defend with
  the cheapest beating card; endgame throw-in of the last card.

**Review notes**

- Rules re-checked against Pagat's Podkidnoy Durak: deck, deal, trump under the stock, lowest
  trump attacks first, beating, throw-in ranks (attack and defence cards both count), six-card /
  defender's-hand limit, pick-up (attacker may add more first, defender loses the next attack),
  draw order (attacker first, defender last), going out once the stock is empty, and the draw
  when the last two go out together. No rule errors found; quiz answers and example bookkeeping
  (hand sizes, draws, throw-in limits, who attacks next) all check out.
- Lesson "Throwing in" scene fixed: the 9♣ was drawn already on the table while the caption said
  the attacker "may add" it. The table now shows 9♦ beaten by Q♦, with 9♣ and Q♥ highlighted in
  the attacker's hand; the body notes that the defender's cards count for throw-in ranks.
- Small wording fixes: "Never waste a trump on an opening attack" softened (low trumps are
  sometimes led in the endgame); the step-4 tip no longer uses "picking up" before it is taught;
  "Beaten!" also applies when the attacker simply chooses not to throw in more.

**Popular alternatives (in Variants)**

- 3–6 players (attack to the left; others throw in — some tables only the defender's
  neighbours); Perevodnoy (passing/transfer) Durak; simple Durak without throw-ins; first-bout
  limit of 5 cards; opening with several cards of the same rank; match play with the durak
  dealing next.

### Scopa

**Variant taught:** classic two-player Scopa (Pagat / standard Italian rules) to 11 points,
with the 40-card French-suited deck per D-08.

**Rules as taught**

- Deck: 40 cards — A, 2–7, J, Q, K of each suit (52-card deck minus 8, 9, 10). Values: A = 1,
  2–7 face value, J = 8, Q = 9, K = 10 (J/Q/K stand in for Fante/Cavallo/Re). Diamonds stand in
  for coins (denari), so the Settebello is the 7♦.
- Deal: 3 cards to each player and 4 face up to the table; the rest is the stock. The non-dealer
  plays first; players alternate one card at a time. When both hands are empty, the dealer deals
  3 more to each (none to the table) until the stock runs out. The deal alternates between hands.
- A played card captures a table card of equal value, or a set of table cards whose values add
  up to it. If a single card of equal value is on the table, it must be taken in preference to a
  sum (if several singles match, the player chooses one). A card that can capture must capture;
  a card that can't capture is trailed (left face up on the table).
- Scopa: a capture that clears the table scores 1 point (marked by leaving the capturing card
  face up in the pile). A sweep on the very last play of the hand does not count as a scopa.
- End of hand: any cards still on the table go to the player who made the last capture (not a
  scopa).
- Scoring each hand: 1 point each for most cards, most diamonds, the Settebello (7♦), the
  primiera; plus 1 per scopa. Ties in cards (20–20), diamonds (5–5) or primiera totals score
  nothing.
- Primiera: each player takes their best card in each suit using 7 = 21, 6 = 18, A = 16, 5 = 15,
  4 = 14, 3 = 13, 2 = 12, J/Q/K = 10; higher total of the four wins. A player needs a card in all
  four suits to count a primiera.
- Game: first to 11 points. If both pass 11 in the same hand, the higher score wins (stated in
  variantTaught); a tie is played off with another hand (kept out of the content for simplicity).

**Simplifications / editorial decisions**

- Two players only in the lesson and example; four-player partnership play is a variant.
- No Napola, no Re Bello, no "three or four Kings on the table → redeal" rule — all listed as
  some-tables variants because they are regional rather than baseline.
- Beginner strategy (grab 7s and diamonds, don't leave a table total ≤ 10 when trailing, trail
  face cards rather than 7s/6s/diamonds, count the 7s) is presented as rules of thumb.
- History: "Scopa" = "broom"; "has long been played all over Italy"; hedged as "often called"
  one of Italy's two great national card games (with Briscola). Regional packs are described as
  "many of them" Italian-suited, because several northern regional packs (Piedmontese, Milanese,
  Genoese, Tuscan) are French-suited. The Pertini 1982 Scopone photo on the World Cup flight home
  is a well-documented event and is the only specific fact given.
- "Hand" has two meanings for beginners (the cards you hold / one whole deal), so it is a
  glossary term and linked where it first means a deal. "Stock" is also a glossary term.

**Scripted example (consistency notes)**

- Opponent deals; you play first. Table: 7♦ 3♣ 4♠ Q♥. You: 7♠ 2♥ J♣. Opponent: Q♠ J♦ A♠.
  Stock placeholder (face down): Q♣ J♥.
- Review fix: the first draft gave you the K♣ and offered "trail the K♣" as an option, but
  K (10) = 7♦ + 3♣ is a legal capture, so under the must-capture rule the K♣ could not be
  trailed (and it could have taken the Settebello). Replaced by the J♣ (8), which captures
  nothing on 7♦ 3♣ 4♠ Q♥ and still makes a safe trail later (3 + 4 + 8 = 15).
- You 7♠×7♦ (decision: single-match rule, Settebello) → opp Q♠×Q♥ → table 3♣ 4♠ → you trail J♣
  (decision: keep the table above 10) → opp J♦×J♣ → you trail 2♥ (forced) → opp trails A♠
  (forced) → table 3♣ 4♠ 2♥ A♠ = 10.
- Second deal: you K♥ 5♦ 3♥; opponent K♣ 6♦ 2♠. You K♥ sweeps 3+4+2+1 (decision: scopa; the
  3♥ option also re-teaches the single-match rule, since it must take the 3♣) → opponent trails
  2♠ on the empty table.
- Review fix: the first draft gave you the 6♠ here, yet the opponent's best spade in the
  primiera count was that same 6♠. Your third card is now the 3♥ (your best heart stays 5♥).
- Fast-forward to the count: opponent made the last capture. Primiera (decision): you 7♦ 7♠ 5♥
  A♣ = 73, opponent 6♦ 6♠ 7♥ 7♣ = 78 → opponent. Cards 22–18 (you), diamonds 6–4 (you: A♦ 2♦
  3♦ 5♦ 7♦ K♦; opponent: 4♦ 6♦ J♦ Q♦), Settebello (you), one scopa each → you 4, opponent 2.
- Lesson "Scoring a hand" scene: the 7♦ is now shown inside "Your diamonds: 6 of the 10"
  (it previously sat in a separate zone, implying seven diamonds).

**Popular alternatives (in Variants)**

- Italian-suited regional packs (Fante/Cavallo/Re = 8/9/10, coins = diamonds); four players in
  partnerships; Scopone and Scopone Scientifico (10 cards each, none to the table); Scopa a 15
  (Scopa di Quindici) and Cirulla (captures summing to 15 with the played card); playing to 15
  or 21; Napola bonus for capturing A-2-3 of coins; redeal if three or four Kings are dealt to
  the table.

### Briscola

**Variant taught:** classic two-player Briscola (Pagat / standard Italian rules), one hand, with
the 40-card French-suited deck per D-08 (the Queen plays the Cavallo/Knight).

**Rules as taught**

- Deck: 40 cards — A, 2–7, J, Q, K of each suit (52-card deck minus 8, 9, 10).
- Rank in every suit, high → low: A, 3, K, Q, J, 7, 6, 5, 4, 2.
- Card points: A 11, 3 10, K 4, Q 3, J 2, others 0 — 120 in the deck (30 per suit).
- Deal 3 cards each; the next card is turned face up and placed under the stock, sticking out.
  Its suit is the briscola (trump); it is the last card drawn.
- The non-dealer leads the first trick. The second player may play any card — there is no
  obligation to follow suit or to beat.
- Trick winner: the higher briscola if any briscola was played; otherwise the higher card of the
  suit led. A card of another non-briscola suit never wins.
- The winner takes the trick, draws first from the stock, the loser draws second, and the
  winner leads next. With two cards left, the winner gets the face-down card and the loser gets
  the face-up briscola. After the stock is gone, the last three tricks are played without
  drawing.
- After 20 tricks, more than 60 card points wins; 60–60 is a draw.

**Simplifications / editorial decisions**

- One hand = one game in the content; match play ("a few hands", e.g. best of three) is
  mentioned as a common custom.
- No exchange of a low trump for the face-up card (regional rule; listed in Variants without
  naming a specific card because which card may swap differs by region).
- Two players only in the lesson and example; 3-player (one 2 removed), 4-player partnerships
  (signals allowed by some groups) and 5-player Briscola Chiamata are variants.
- Terms "carico" (Ace or Three) and "liscio" (zero-point card, glossed as "blank") are used as
  friendly vocabulary.
- Strategy (lead blanks, bank your Ace on a led blank of the same suit, save briscole for Aces
  and Threes, don't trump zero-point tricks, count the ten briscole, watch the face-up briscola
  near the end) is presented as rules of thumb.
- History is hedged: Ace-Ten family; "is thought to be related to" the French Brusquembille;
  "along with Scopa and Tressette, one of Italy's best-loved card games" (review fix: the draft
  called it one of Italy's "two" national games, which leaves out Tressette); relatives Brisca
  (Spain) and Briškula (Croatian coast). No dates given.
- Wording: the content says "game" (not "hand") for one deal, because beginners read "hand" as
  the cards they hold. One game = one deal of the 40 cards.
- Review fixes to strategy wording: "lead an Ace or Three" is only a mistake for non-briscola
  cards; "when the briscole are gone your Threes are safe" was corrected — a Three can still
  fall to the Ace of its own suit, so only Aces (and Threes whose Ace has gone) are safe to lead;
  "the 2 of briscola captures a Three" now says "the Three of another suit".

**Scripted example (consistency notes)**

- Briscola: clubs; face-up card 3♣ (stock face-down placeholder Q♠ early on; Q♦ is the last
  hidden card at trick 17).
- You: A♥ 2♠ Q♣ (non-dealer, you lead). Opponent: 7♠ K♦ 5♥.
- T1: 2♠ (decision) vs 7♠ → opponent, 0. Draws: opponent A♠, you A♦.
- T2: opponent 5♥, you A♥ (decision: bank the Ace) → you 11. Draws: you 4♠, opponent J♥.
- T3: you 4♠, opponent A♠ → opponent 11. Draws: opponent 3♠, you 6♦.
- T4: opponent 3♠, you Q♣ (decision: trump the Three) → you 13. Score 24–11.
- Fast-forward to T17 (two cards left in the stock): score 34–57; you K♥ 7♣ 2♦, opponent 4♥ 3♦
  J♠. Opponent leads 4♥; you throw 2♦ (decision: lose the zero trick to receive the face-up 3♣).
  Opponent draws Q♦.
- T18–T20: J♠ vs 7♣ (you +2), K♥ vs Q♦ (you +7), 3♣ vs 3♦ (you +20) → final 63–57.
- Point bookkeeping: your 63 = A♥ 11 + 3♠ 10 + Q♣ 3 + J♠ 2 + K♥ 4 + Q♦ 3 + 3♣ 10 + 3♦ 10 + 10
  from fast-forwarded tricks; opponent 57 = A♠ 11 + 46 from fast-forwarded tricks
  (the remaining A♦ A♣ 3♥ K♦ K♠ K♣ Q♠ Q♥ J♣ J♥ J♦ total exactly 56 = 10 + 46).

**Popular alternatives (in Variants)**

- Italian-suited regional packs (Fante/Cavallo/Re worth 2/3/4); four players in partnerships
  (some allow signals); three players with one 2 removed; Briscola Chiamata for five (auction,
  called secret partner); swapping a low briscola for the face-up card; match play such as best
  of three.

### Tiến Lên

**Variant taught:** Southern-style Tiến Lên (Tiến Lên Miền Nam), the most widely played form,
for 4 players with 13 cards each (Tier 2: content only, `content/games/tien-len.ts`). The
baseline follows Pagat's description plus common Vietnamese practice. Where those two differ,
we teach the smaller rule that both share and list the rest under Variants.

**Rules as taught**

- One standard 52-card deck, no jokers; deal it all out one card at a time (13 each).
  Turns traditionally go counter-clockwise (to the right).
- Ranks: 3 (low) … K, A, 2 (high). Suits only break ties: ♠ < ♣ < ♦ < ♥. So the 3♠ is the
  lowest card and the 2♥ the highest.
- Combinations: single, pair, triple, four of a kind, sequence (3+ consecutive ranks, any
  suits, may end with an Ace as Q-K-A, never contains a 2, no wrap-around), double sequence
  (3+ consecutive pairs).
- The leader plays any combination. Each following player must play the same type with the
  same number of cards, but higher, or pass. To compare, look at the highest card (rank, then
  suit). For example, 7♣ 7♥ beats 7♠ 7♦ because it holds the 7♥.
- **Passing is final for the round:** a player who passes can't play again until a new round
  starts. When all the others have passed, the last player to play clears the table and leads.
- **Bombs / chops:** four of a kind, or a double sequence of three pairs, can beat a single 2. A double sequence of four pairs can beat a pair of 2s. A higher bomb of the same kind
  beats a lower one.
- First game: the holder of the 3♠ starts, and their first play must include it. Later games:
  the previous loser usually deals and the previous winner leads anything.
- The first player out wins. The others play on for 2nd, 3rd and last place.

**Decisions and simplifications (and why)**

- Four-player game only in the lesson and example. 2–3 players get one sentence in Variants
  (13 cards each, the rest left out).
- Bomb rules are cut down to the core that every source agrees on (quad or three pairs chop a
  single 2; four pairs chop a pair of 2s). Disputed extras are in Variants: a quad chopping a
  pair of 2s, a quad beating three pairs, five pairs beating three 2s, chopping out of turn or
  after passing.
- We don't say whether a player who has already passed may still chop, because sources
  disagree. The example never needs that rule: the learner only chops before passing in that
  round.
- Instant wins (e.g. dealt four 2s), "caught holding 2s" penalties and scoring systems are
  left out of the core. They're mentioned as house rules.
- Play direction is "traditionally counter-clockwise", with a note that many groups abroad
  play clockwise.
- History is hedged: "often called Vietnam's national card game", "exact beginnings are not
  well recorded". The "heo" (pig) nickname for 2s and the "chặt heo" (chop the pig) phrase are
  given as southern Vietnamese usage.

**Scripted example (consistency notes)**

- Seats: You → Lan (right) → Minh (across) → Hoa (left), counter-clockwise.
- Learner's hand: 3♠ 4♣ 4♥ 5♦ 6♥ 7♠ 9♦ 9♥ 10♠ 10♣ J♣ J♦ K♠.
- Round 1: learner leads 3♠-4♣-5♦-6♥-7♠ (decision). Lan and Minh pass, Hoa beats it with
  5♠-6♣-7♦-8♠-9♣, learner passes, and Hoa wins (Lan and Minh are locked out).
- Round 2: Hoa leads 8♣ 8♦. The learner passes to keep the 9-9-10-10-J-J bomb (decision). Lan
  plays Q♣ Q♦, Minh and Hoa pass, and Lan wins.
- Round 3: Lan 10♦, Minh A♦, Hoa 2♠. The learner chops with 9♦ 9♥ 10♠ 10♣ J♣ J♦ (decision).
  All pass.
- Round 4: the learner leads 4♥ rather than K♠ (decision). Lan 8♥, Minh 10♥, Hoa J♥. The
  learner plays K♠ (decision: don't pass) and goes out first.
- Every card shown is unique across the deal. Opponent card counts at the end: Lan 9, Minh 11,
  Hoa 4.

**Popular alternatives (in Variants)**

- Extra bomb powers (quad vs pair of 2s, quad vs three pairs, five pairs vs three 2s).
- Re-entering after a pass (often only to chop); instant wins; penalties for leftover 2s.
- Northern Tiến Lên (Miền Bắc), usually played with stricter suit-matching rules.
- Clockwise play; 2–3 players; scoring by finishing place over several games.

**Editorial review (rules + pedagogy pass)**

- Example step 4 said "No ordinary single can beat a 2". That's wrong, because a higher 2 beats
  a lower one. It now says "Only a higher 2 — or a bomb — can beat it."
- Example step 5 said "they'd need an even bigger one" to beat the chop. Under the taught rules
  only a higher three-pair run beats a three-pair run, so the text now says exactly that.
- "Loser deals the next game" is now hedged as "usually".
- The lesson's bomb tip now notes that many tables let a player who has passed still chop a 2.
  This makes the "a pass lasts the whole round" rule honest without making it part of the
  core rules.
- Variants: with 2–3 players, if nobody holds the 3♠, the holder of the lowest card usually
  starts.
- Added the glossary terms `rank` and `suit` (the audience has never held a card) and linked
  them in the card-ranking step. The two spellings of "four of a kind" are now one link.
- Softened the superlatives: the hook and SEO text say "much-loved" instead of "favourite",
  and the history says "a popular pastime at Tết".

### Big Two

**Variant taught:** classic Hong Kong-style Big Two (Choh Dai Di) for 4 players, 13 cards
each, one hand = one game (in the spirit of D-05). Tier 2: content only,
`content/games/big-two.ts`.

**Rules as taught**

- One standard 52-card deck, no jokers, 13 cards each. Turns traditionally go
  counter-clockwise (to the right); Variants notes that many groups play clockwise.
- Ranks: 3 (low) … K, A, 2 (high). Suits break ties: ♦ < ♣ < ♥ < ♠. So the 3♦ is the lowest
  card and the 2♠ the highest.
- Legal plays: single, pair, triple, or a five-card hand. A four-card play is never legal.
- Five-card hands, low to high: straight < flush < full house < four of a kind + any card <
  straight flush.
- Each play must beat the previous one with the same number of cards. Five-card hands beat
  lower five-card hands of any type.
- Comparisons:
  - singles: rank, then suit;
  - pairs: the higher card of each (K♣ K♠ beats K♦ K♥);
  - triples: rank;
  - straights and straight flushes: top card (rank, then suit);
  - flushes: top card first;
  - full house: the rank of its triple;
  - four of a kind: the rank of its four.
- **Passing is not final:** a pass only skips that turn. When all the other players pass in a
  row, the last player to play leads anything.
- The holder of the 3♦ starts the hand, and the first play must include the 3♦.
- The first player out wins the hand. The others score 1 penalty point per card left, and a
  common rule doubles that for 10 or more cards.

**Decisions and simplifications (and why)**

- **Straights:** we teach only 3-4-5-6-7 up to 10-J-Q-K-A, with no 2s and no low Ace. Rule
  books and tables disagree a lot about straights containing a 2 (A-2-3-4-5, 2-3-4-5-6,
  J-Q-K-A-2) and how they rank. Leaving them out is simple and never contradicts a table that
  allows them. Noted in Variants.
- **Flush tie-break:** compare by top card (poker-like, and easy for beginners). Some tables
  compare suits first; noted in Variants.
- **Passing:** taught as non-binding, which is the usual Big Two reading of "play continues
  until everyone else passes in a row". "Once you pass you're out for the round" is listed as
  a house rule. This contrasts with our Tiến Lên lesson, where a pass is binding, and a
  lesson tip warns that the two games' suit orders differ.
- **Scoring:** only the per-card penalty is taught. The "10+ cards double" multiplier is
  hedged as "a common rule". Triple penalties and penalties for unplayed 2s vary a lot, so
  they're only mentioned generally.
- **Who starts later hands:** we always use the 3♦ holder, because each hand stands alone.
  "The previous winner leads" is in Variants.
- 2–3 player deals vary between sources, so Variants only says that groups differ.
- History is hedged: the origins are "hazy" and "usually linked with southern China and Hong
  Kong". Taiwan's name (Dà Lǎo Èr) and the Philippine Pusoy Dos (different suit order) are in
  Variants.

**Scripted example (consistency notes)**

- Seats: You → Mei (right) → Kit (across) → Sam (left), counter-clockwise.
- Learner's hand: 3♦ 4♠ 5♥ 6♣ 7♦ 8♥ 9♣ 9♥ Q♦ Q♣ Q♠ K♥ 2♠.
- Round 1: the learner leads the straight 3♦-4♠-5♥-6♣-7♦ (decision). Mei passes, Kit plays
  the flush 4♣ 7♣ 10♣ J♣ K♣, Sam passes. The learner beats it with the full house Q♦ Q♣ Q♠ 9♣
  9♥ (decision). Everyone passes; the narration notes that Mei's earlier pass didn't lock her
  out.
- Round 2: the learner leads 8♥ (decision: weakest single, keep the 2♠). Mei 10♦, Kit A♠,
  Sam 2♦. The learner plays 2♠ (decision). All pass.
- Round 3: the learner leads the last card, K♥, and wins.
- Penalties shown: Mei 12 cards, Kit 7, Sam 12 (24 / 7 / 24 under the "double for 10+" rule).
  All visible cards are unique.

**Popular alternatives (in Variants)**

- Straights with 2s or a low Ace; flushes compared by suit first.
- The previous winner leads; binding passes; the "last card" rule (the player before someone
  with one card must play their highest single).
- Four of a kind or a straight flush beating a single 2; other penalty multipliers.
- Regional versions: Dà Lǎo Èr (Taiwan) and Pusoy Dos (Philippines, different suit order);
  2–3 players.

**Editorial review (rules + pedagogy pass)**

- Example step 3 said nobody could beat the learner's Q-Q-Q-9-9 "because nobody has four of a
  kind or a straight flush". That missed the fact that a higher full house (K, A or 2
  triple) also beats it. The narration now lists all three.
- The flush definition said "any five cards of the same suit". It now says "not all in a
  row", because five suited cards in a row are a straight flush.
- One tip said "a 2 wins a round of singles". Only the 2♠ is unbeatable, so the tip now names
  the 2♠.
- The K♥ option in example step 3 (lead K♥ vs 8♥ while holding the 2♠) is honestly almost as
  good, because the 2♠ guarantees the lead later either way. Its feedback now says so and
  frames 8♥ as the better habit, instead of calling K♥ "middle of the road".
- Added the glossary terms `rank`, `suit` and `hand` (hand = your cards and also one whole
  deal) and linked them. "Hands you may know from poker" became "patterns borrowed from the
  game of poker", because the audience hasn't played poker.
- Variants: added clockwise play.

### Belote

**Variant taught:** a **beginner introduction to Classic Belote** (French _belote classique_)
for four players in two partnerships: deal 5 + turned card, two rounds of "take or pass",
must-follow / must-trump / must-overtrump, belote-rebelote, dix de der, takers needing more
points than the defenders out of 162. Declarations (_annonces_) and Coinche are left to Variants.

**Rules as taught**

- 4 players, fixed partnerships, partners opposite. Deal and play are **anticlockwise** (the
  traditional French direction).
- 32 cards. **Trump suit:** J (20), 9 (14), A (11), 10 (10), K (4), Q (3), 8 (0), 7 (0).
  **Other suits:** A (11), 10 (10), K (4), Q (3), J (2), 9, 8, 7 (0). 152 card points + **10 for
  the last trick** (_dix de der_) = **162**.
- Deal **3 then 2** cards each; turn up the next card (the **turned card**).
- **Taking:** starting with the player to the dealer's right, each says "I take" or "Pass". The
  first to take makes the turned card's suit trumps and picks it up. If all pass, a second round:
  each may name another suit as trumps or pass. If all pass twice, redeal.
- Completing the deal: the **taker gets 2 more cards** (plus the turned card), the others 3 each
  (8 each).
- The **player to the dealer's right leads** the first trick, whoever took.
- **Play:** follow suit if able. If unable: must trump if possible, **unless partner is
  currently winning the trick** (then any card). When trumping, must **overtrump** any trump
  already in the trick if able. When **trumps are led**, must play a higher trump if able — even
  if partner is winning.
- **Belote-rebelote:** K + Q of trumps in one hand = 20 points; announce "Belote" with the first
  card played and "Rebelote" with the second ("at most tables the bonus only counts if you
  announce it").
- **Scoring:** if the takers' total (card points + belote) is greater than the defenders', each
  team scores what it won. Otherwise the takers are **dedans**: they score 0 and the defenders
  score 162. **Capot** (all 8 tricks) = 250. Game target described as "often 1000".

**Simplifications / decisions and why**

- **Taught as a beginner introduction** (per the brief for complex games): the lesson and example
  follow one deal's core loop — take, pull trumps, follow/trump rules, belote, count.
- **Declarations (annonces) not taught** — sequences (tierce 20, quarte 50, quinte 100) and
  four of a kind (Jacks 200, Nines 150, A/10/K/Q 100) are part of the full classic rules but add a
  lot of bookkeeping; described in Variants.
- **Undertrumping:** the lesson now says explicitly "if you can't beat it, you still have to play
  a trump (a lower one)", the standard French rule when you can't overtrump an opponent and
  partner isn't winning. Some house rules allow a discard instead; mentioned in Variants. The
  example hand never hits this case, so it's consistent with either rule.
- **Whether you must overtrump your partner's trump when you choose to trump** (partner winning,
  you void) is not addressed — rules differ and a beginner can simply discard.
- **Tie (81–81, "litige")** and its carry-over, **score rounding**, and whether a failing
  side keeps its belote are not taught (rule sets differ); the lesson only says what happens when
  the takers win or lose.
- **Capot = 250** is the most common figure (some play 252); game target hedged as "often 1000"
  with 501 mentioned in Variants.

**Example hand** (re-simulated: all 32 cards used once, every play obeys follow / trump /
overtrump / go-higher-in-trumps rules, totals 162): you take the turned J♥ holding 9♥ K♥ Q♥ A♠
10♦, lead J♥ (W forced to drop A♥, +31) and 9♥ (E's 10♥ falls, +24), play A♠ with partner
loading the 10♠ (+23), lose the lead to partner's K♠ (+7), load the 10♦ on partner's master A♣
(+21). Partner leads K♣ and West wins it with the 10♣ — an opponent is winning, so you **must**
trump: K♥ "Belote" (+20). Holding only Q♥ (the last trump) and 7♦, you lead the 7♦ (W's A♦
wins, defenders +13) and keep the Q♥ to win the last trick, "Rebelote" (+13 + 10 dix de der).
Final: takers 149 + 20 = 169, defenders 13 — contract made.

**Popular alternatives (in the in-app Variants note)**

- Full classic rules with declarations.
- Belote coinchée (Coinche): auction with points targets and doubling.
- No-trumps / all-trumps contracts.
- Undertrump house rule.
- 2- and 3-player versions; clockwise play; shorter games to 501.
- Cousins: Klaverjas (Netherlands), Belot (Bulgaria), Baloot (Saudi Arabia).

**History note (hedged in content):** became hugely popular in France during the 20th century
and is "often called" the country's favourite card game; part of the Jass family where the J and
9 of trumps are strongest; cousins Klaverjas, Bulgarian Belot, Baloot; the origin of the name is
described as "still debated". No dates or inventor names asserted.

**Editorial review (second pass)**

- **Strategy error fixed in the example.** The first draft had partner lead K♣, West play J♣,
  and taught "trump partner's non-master King with your K♥" as correct, then had you lead Q♥ and
  lose the last trick with the 7♦. With K♥ Q♥ being the last two trumps, they win two tricks
  whenever they're played, so trumping there was not best (throwing the 7♦ scores more in every
  distribution), and leading Q♥ before 7♦ gave away the last trick and the dix de der. The ending
  was rebuilt (10♣ and J♣ swapped between West and East): West now wins the trick with the 10♣,
  so trumping is _compulsory_ (a rule check), and a new decision teaches saving the last trump
  for the last trick. The tip "if partner's card is not the boss… trump to make sure" was
  replaced with the must-trump / must-overtrump rule, since that heuristic is not always right.
- **Overtrump wording**: "whenever you play a trump, you must beat the highest trump" was too
  broad (it ignored the partner-winning exception). Now: must beat an _opponent's_ trump if
  able, otherwise still play a (lower) trump; when trumps are led, go higher if able even over
  partner.
- **Second round of taking**: the taker still picks up the turned card — now stated.
- **Dedans**: "they score nothing" changed to "they lose all their card points" so the lesson
  doesn't contradict tables (including, as far as we know, the French federation rules) where a
  belote is always kept by the team that announced it. That point is still unverified here and
  so not stated in the lesson.
- Added a `suit` glossary term; "cash" (jargon) replaced by "play"; load feedback no longer
  assumes the learner knows West holds the A♦.

### Skat (beginner introduction)

**Variant taught:** a beginner introduction to standard Skat following the International Skat
Order (ISkO): three active players, 32-card French-suited deck, bidding from 18, skat pick-up
and discard, and the three game types (suit, grand, null). Scoring is simplified.

**Rules as taught**

- 3 active players (with 4, the dealer sits out). Deck 7–A in four suits (32 cards).
  Deal 3–skat(2)–4–3: 10 cards each, 2 in the skat. Seats: forehand (dealer's left),
  middlehand, rearhand.
- Card points: A 11, 10 10, K 4, Q 3, J 2, 9/8/7 0 — 120 total. Declarer needs 61+ (60 loses).
- Suit game: trumps J♣ J♠ J♥ J♦, then A 10 K Q 9 8 7 of the trump suit (11 trumps). Plain suits
  rank A 10 K Q 9 8 7. Jacks belong to the trump suit for following purposes.
- Grand: only the four Jacks are trumps. Null: no trumps, ranking A K Q J 10 9 8 7, declarer
  must lose every trick.
- Bidding: middlehand calls numbers (18, 20, 22, 23, 24, 27, 30, …) to forehand, who says "yes"
  or passes; rearhand then bids against the survivor. If nobody bids, the cards are thrown in.
- Declarer may pick up the skat and discard any two cards; the skat's points count for the
  declarer. Playing without the skat ("hand") is mentioned.
- Game value = base (♦9, ♥10, ♠11, ♣12, grand 24) × multiplier (matadors "with/without" + 1
  for game + 1 for Schneider + 1 for Schwarz). Matadors are counted as an unbroken run of top
  trumps from the J♣ (in a suit game the run can continue into the trump suit's A, 10, K…),
  and the skat's cards count too. Null = 23. The value must reach the bid (otherwise the game is
  lost). Schneider = losing side has 30 or fewer.
- Scoring: won game = +value; lost game = −2 × value.

**Simplifications / editorial decisions**

- No Seeger–Fabian tournament bonuses (+50 / −50 / defenders' bonus), no Kontra/Re, no
  Ramsch/Bock — all listed in Variants.
- Hand games, ouvert and announcements are mentioned but not scored in the lesson (Schwarz is
  given one clause in the multiplier explanation);
  null hand/ouvert values (35/46/59) appear only in Variants.
- The exact overbid rule (value raised to the next multiple of the base value ≥ the bid) is
  reduced to "your value must reach your bid, or you lose".
- French suits are used (our renderer is French-suited); the German-suited equivalents
  (Acorns = clubs, Leaves = spades, Hearts, Bells = diamonds) are given in Variants.
- History is hedged: created in Altenburg in the early 1800s; name "thought to" derive from
  Italian _scartare_; mentions the Skat fountain, the Skat court in Altenburg and recognition as
  German intangible cultural heritage (no dates given for the latter).

**Scripted example (consistency notes)**

- Learner = forehand. Hand: J♣ J♥ A♥ 10♥ K♥ 8♥ 7♥ A♣ 10♠ 8♦; skat Q♥ 7♣. Middlehand: J♠ A♠ K♠
  9♠ 7♠ 10♦ Q♦ 9♦ 10♣ 8♣. Rearhand (dealer): J♦ 9♥ Q♠ 8♠ A♦ K♦ 7♦ K♣ Q♣ 9♣.
- Bidding: middlehand 18, learner yes, middlehand and rearhand pass → declarer at 18.
  Discard 10♠ + 8♦; announce hearts ("with 1, game 2" = 20 ≥ 18).
- Tricks: J♣ (J♠, 9♥); J♥ (9♦, J♦); A♣ (8♣, 9♣); 7♣ lost to 10♣ with K♣ smeared (14 points to
  the defenders); everything else to the declarer. Final 106–14 → Schneider, value
  (1 + 1 + 1) × 10 = 30.
- Decisions (6): hold at 18; discard the lonely 10 and create voids; choose hearts over
  grand/null; lead the J♣ to pull trumps; count trumps and lead the J♥ to draw the last one
  (the J♦); read the result (win with Schneider).
- Judgement call: middlehand's spade hand (one Jack, "without 1") is worth 22, so it could
  have bid 20; it passes because the hand is weak. This is a choice, not a rule.

**Popular alternatives (in Variants)**

- Seeger–Fabian tournament scoring; hand games, Schneider/Schwarz announced, ouvert; null
  values 23/35/46/59; Ramsch; Bock rounds; Kontra and Re; four at a table with the dealer
  sitting out; German-suited cards.

**Editorial review (second pass)**

- Fixed a card error in the bidding lesson: the scene claimed "five clubs" but showed four
  (A♣ 10♣ K♣ 9♣); the hand now holds 8♣ instead of 7♦ and the caption gives its value
  ("at least" (2 + 1) × 12 = 36, since a Jack in the skat could raise it).
- The multiplier explanation previously said "count your top Jacks"; it now says top trumps
  (matadors run on into the trump suit) and mentions Schwarz.
- Trick 1 now has its own example step (it was only described in a caption), with a new
  decision on drawing the last trump. Hand sizes run 10 → 12 → 10 → 9 → 8 → 6 across steps.
- Rearhand glossary definition reworded (the old "whoever is left" was ambiguous with the
  seat on the left).

### Euchre

**Variant taught:** standard four-player partnership Euchre (Pagat / Hoyle): 24-card deck, two
rounds of choosing trump with the turned-up card, Right and Left Bowers, going alone, game to 10. If all four pass twice, the hand is thrown in and the deal passes left.

**Rules as taught**

- 4 players, 2 fixed partnerships (partners sit opposite). Deck: 9, 10, J, Q, K, A of each suit
  (24 cards). The deal passes one seat to the left each hand.
- 5 cards each, dealt in packets of 2 and 3 (either order). The remaining 4 cards are the
  kitty; its top card is turned face up.
- **Round one:** starting left of the dealer, each player passes or orders up the turned card's
  suit. If ordered up (by anyone, including the dealer "picking it up"), the dealer takes the
  turned card and discards one card face down.
- **Round two:** if all four pass, the card is turned down; each player in turn may name any
  _other_ suit or pass. If everyone passes again → throw in, next dealer.
- Ranking in trump: Right Bower (J of trump), Left Bower (J of the same colour), A, K, Q, 10, 9.
  Other suits: A, K, Q, (J), 10, 9. The Left Bower belongs to the trump suit for the whole deal
  (it follows trump leads and does not follow its printed suit).
- Player left of the dealer leads; must follow suit if able (otherwise trump or discard);
  highest trump, else highest card of the suit led, wins; winner leads.
- Scoring: makers 3–4 tricks = 1; all 5 (march) = 2; lone hand 3–4 = 1, lone march = 4;
  makers euchred (fewer than 3) = 2 to the defenders. Game = 10 points.

**Simplifications / editorial decisions**

- Going alone is explained (lesson + glossary) but not used in the scripted example, to keep the
  first deal readable. Who leads when a lone hand is played differs between rule books, so the
  content does not state it.
- No "stick the dealer", no Joker, no defending alone — all listed as variants because they are
  common house rules rather than the baseline.
- Strategy advice (call with 3+ trumps incl. a Bower, lead trumps as makers, don't trump a
  trick partner is sure to win, discard to create a void, count the 7 trumps) is presented as rules of
  thumb, not rules.
- Origin shown as the United States (where the game took its modern form); the history notes
  its probable Alsatian ancestor Juckerspiel and hedges the Joker story ("widely believed",
  "around the 1860s"). Popularity is dated loosely ("during the 1800s").

**Scripted example (consistency notes)**

- Learner = dealer (South). Turn-up J♥; everyone passes; learner picks it up and discards 9♦
  (kitty face-down cards: Q♠, Q♣, K♦ + the discarded 9♦).
- Full deal used: South J♦ A♥ A♣ 9♣ 9♦ (+J♥ −9♦); West K♠ K♥ 9♥ Q♦ J♣; North A♠ T♦ T♥ K♣ T♠;
  East 9♠ A♦ Q♥ J♠ T♣. All five tricks are played out and the makers march (2 points).
- Decisions: pick it up; discard to create a void; don't trump partner's A♠; Left Bower trap
  (J♦ is not a diamond) — trump with A♥; lead the Right Bower; count trumps and pull the last one.

**Popular alternatives (in Variants)**

- Stick the dealer; Joker / "Benny" as top trump (25 cards); 32-card deck with 8s and 7s;
  playing to 5, 7 or 11; defending alone / 4 points for euchring a lone hand; Bid Euchre;
  two- and three-player versions such as three-handed "cutthroat" Euchre.

**Editorial review (second pass)**

- Rules re-checked against Pagat/Hoyle; the full scripted deal (incl. kitty Q♠ Q♣ K♦ + J♥) was
  replayed trick by trick: every card appears once, every follow is legal, trick winners and
  the march (2 points) are correct.
- Added: plain-suit ranking (A K Q J 10 9) to the trick lesson; the term "picking it up" for
  the dealer accepting; lone hand 3–4 tricks = 1 point (lesson + glossary).
- Softened absolutes: "never trump partner's winning trick" → "don't trump a trick your
  partner is sure to win" (trumping partner can be right when a later opponent could
  overtake); "pulls a trump from each opponent" → "anyone who still has a trump must play it".

### Cribbage

**Variant taught:** a **beginner introduction to standard two-player, six-card Cribbage**
(the form played by cribbage clubs and described by Pagat/Hoyle): deal 6, throw 2 to the
dealer's crib, cut a starter, peg to 31, count pone's hand → dealer's hand → crib, first to
121 wins.

**Rules as taught**

- 2 players, one 52-card deck, a cribbage board (or pen and paper).
- Deal 6 each; each player discards 2 face down to the **crib**, which belongs to the dealer.
  The deal alternates every hand.
- The **pone** (non-dealer) cuts; the dealer turns up the **starter**. Starter Jack = dealer
  pegs 2 (**his heels**).
- **The play (pegging):** pone leads; players alternate, announcing the running total
  (A = 1, number cards face value, J/Q/K = 10), never exceeding 31. Scoring: count of 15 = 2;
  31 = 2; pair = 2, three of a kind = 6, four = 12; runs of 3+ among the most recent cards
  (any order, no other cards in between) = 1 per card. Ace is low only (A-2-3 is a run,
  Q-K-A is not). "Go" when you can't play; the
  opponent continues if able; last card of a count = 1 (31 scores 2 instead). Count resets;
  the player who did not play the last card leads the next count. You must play if you can.
- **The show:** each hand counts with the starter. Fifteens 2 each (all distinct
  combinations), pairs 2 each, runs 1 per card (multiple runs counted separately, e.g.
  double runs), hand flush 4 (5 with starter), crib flush only with all 5 cards (5),
  **his nobs** (Jack of the starter's suit in hand or crib) = 1.
- Counting order: pone, dealer's hand, crib. The first player to reach 121 wins at once,
  even mid-count.
- **Skunk:** winning before the loser reaches 91 — described as "many players count it as a
  double win".

**Simplifications / decisions and why**

- Taught as a beginner introduction (per the brief for complex games): the lesson follows
  one hand's core loop; club extras are described in Variants rather than taught.
- **Muggins** (claiming points the opponent misses) is not taught — it's optional and
  unfriendly for beginners; it's in Variants.
- Cutting for first deal (low card deals) is not covered; not needed to learn the game.
- Content `type` is `collecting`: the schema has no "adding" category (Pagat files Cribbage
  under adding games); scoring card combinations is the closest fit. Can be revisited if
  the schema gains an adding/other type.
- All example counts were checked with a small scorer script: pone hand 4♣5♦6♥6♠ + 9♣ =
  16; dealer 5♣7♣8♦10♥ + 9♣ = 8; crib 9♦K♣J♠Q♥ + 9♣ = 5; pegging you 9, opponent 5.
  Lesson worked example 4♦5♦6♦J♠ + 5♠ = 17.

**Popular alternatives (in the in-app Variants note)**

- Muggins / cutthroat; skunk and double skunk (below 61).
- Five-card Cribbage (older form, game to 61).
- Three-player (5 cards each, one card dealt to the crib, throw 1) and four-player
  partnership (5 cards each, throw 1).
- Short game to 61.

**History note (hedged in content):** traditionally credited to the English poet Sir John
Suckling in the early 1600s, said to be developed from an older game called Noddy; long-time English pub
favourite; "his nobs" as a surviving old term.

### Canasta

**Variant taught:** a **beginner introduction to Classic Canasta** for **4 players in two
partnerships** (partners sit opposite), as described in the standard references (Pagat
"Classic Canasta", Hoyle). The lesson and example focus on the core loop: draw → meld →
take the pile → build canastas → go out → score.

**Rules as taught**

- 108 cards: two 52-card decks + 4 jokers. 11 cards each; stock face down; one card turned
  up to start the discard pile. Play is clockwise.
- Wild cards: Jokers and 2s.
- Card values: Joker 50; Ace and 2 = 20; K, Q, J, 10, 9, 8 = 10; 7, 6, 5, 4 and black 3 = 5.
- Turn: draw the top stock card (or take the whole discard pile), meld if you wish,
  discard one card (unless going out).
- Melds: 3+ cards of the same rank; no sequences. At least 2 natural cards and at most
  3 wild cards per meld. Partnerships share melds.
- Initial meld: in **every hand**, the team's first meld must total at least **50 points**
  while the team's score is under 1,500 (several melds may be put down together to reach
  it; only the melded cards count, not red threes or bonuses). The higher targets are
  mentioned in a lesson tip and in Variants.
- Canasta = 7+ cards. Natural canasta 500, mixed canasta (1–3 wilds) 300. Stack with a red
  card on top for natural, black for mixed.
- Taking the pile: the top card must be melded immediately — with a natural pair, a natural
  card + a wild card, or by adding it to the team's existing meld. The pile is **frozen**
  for a team that hasn't made its initial meld, and for everybody once it contains a wild
  card; a frozen pile can only be taken with a natural pair matching the top card. The pile
  can never be taken when its top card is a wild card or a black three.
- Red threes: laid face up straight away and replaced from the stock; 100 each; they count
  minus if the team has made no meld by the end of the hand.
- Black threes: a stop card — the next player can't take the pile. Black threes can only be
  melded when going out (mentioned in the glossary).
- Going out: allowed only once the team has at least **one canasta**; meld all cards (may
  discard the last). Optional "Partner, may I go out?" — if asked, the answer is binding.
  Going out = 100.
- Hand score: bonuses (canastas, red threes, going out) + values of melded cards − values of
  cards left in the team's hands. Game to 5,000.

**Simplifications / decisions and why**

- **Partnership (4-player) Classic chosen over 2-player:** it is the original and standard
  form of Classic Canasta, and the shared-melds idea is the heart of the game. 2-player rules
  are in Variants.
- Taught as a beginner introduction (per the brief for complex games). The rising first-meld
  targets (90 at 1,500+, 120 at 3,000+, 15 below zero), the concealed going-out bonus (200),
  the 800 bonus for all four red threes, and black-three melding details are described in
  Variants/glossary rather than given their own lesson steps.
- The detail that, before the initial meld, cards taken from the pile (other than its top
  card) don't count towards the 50 minimum is not spelled out; the lesson simply says the
  pile is frozen until the first meld. The example avoids the situation (the first meld is
  made from the hand).
- Stock-exhaustion rules (play continues while players can take the pile) are omitted;
  beginner hands rarely get there.
- The example uses one red three, one mixed canasta, a black-three block and going out so
  the learner sees every key rule once. All counts are worked out in the narration
  (740 for the hand). The timeline was checked turn by turn: after five turns and six melded
  cards, the partner must still hold five cards, so their leftover is five low cards worth
  25 (no fewer than 5 points per card is possible).

**Popular alternatives (in the in-app Variants note)**

- 2 players: 15 cards each, draw 2 discard 1, two canastas needed to go out.
- 3 players: 13 cards each, individual play.
- Samba and Bolivia (three decks, sequences allowed); Modern American Canasta (different
  rules: draw two, special canastas of sevens and of wild cards); Hand and Foot.

**History note (hedged in content):** thought to have been invented in Montevideo, Uruguay,
in the late 1930s, often credited to Segundo Santos and Alberto Serrato; spread to Argentina
and became a US craze around 1950. "Canasta" = "basket" in Spanish; the reason for the name
is given as one popular explanation only.

### President

**Variant taught:** classic President (also known as Scum) for 4 players. The content also
supports 3–7. Tier 2: content only, `content/games/president.ts`. We use the family-friendly
name throughout. The titles are President, Vice-President, Vice-Scum and Scum, with "Scum" as
the traditional neutral term; ruder names are only alluded to ("some ruder ones").

**Rules as taught**

- One standard 52-card deck (two decks for big groups), dealt out completely one card at a
  time. With 4 players that's 13 each; with other numbers some players get one extra card.
  Play goes clockwise.
- Ranks: 3 (low) … K, A, 2 (high). **Suits don't matter.**
- The leader plays a single, a pair, a triple or four of a kind. Each player in turn plays the
  same number of cards of a **strictly higher** rank, or passes. Equal rank is not allowed.
- **Passing is not final:** a pass only skips that turn. When everyone else passes after a
  play, that player clears the pile and leads anything. If they have just gone out, the next
  player still in leads.
- First hand: the holder of the 3♣ starts, and the first play must include it.
- Finishing order: 1st = President, 2nd = Vice-President, second from last (3rd out with four
  players) = Vice-Scum, last player left holding cards = Scum. With 5+ players, the ones in the
  middle are neutral; with 3, groups usually skip the Vice titles.
- **Card swap before each later hand:** the Scum gives the President their two best cards and
  gets any two back. The Vice-Scum gives the Vice-President their best card and gets any one
  back.

**Decisions and simplifications (and why)**

- **Strictly higher, no equal-rank skip:** this is the simplest core rule. "Equal play skips
  the next player" is a very common house rule and is listed in Variants.
- **No special 2s, no jokers, no revolutions:** 2s are just the top rank. With equal plays
  banned, a 2 can't be beaten, so it wins the round naturally. "2 clears the pile at once" and
  jokers are listed as house rules. Revolutions are credited to Japan's Daifugō.
- **Non-binding pass:** we teach this as the common casual rule. Binding passes (out until the
  pile is cleared) are in Variants.
- **3♣ opens the first hand:** a widely used convention that gives beginners a clear start.
  Who leads later hands varies (often the Scum, sometimes the President), so the content
  says so instead of picking one. The example stops at the swap before hand 2 begins.
- Seat-changing, "the Scum deals" and similar social rituals are mentioned as fun house rules
  only.
- Origin is shown as Worldwide (`UN` / `global`): the game has no single documented
  birthplace. The history is hedged ("thought to be a Western cousin of East Asian games such
  as Japan's Daifugō").

**Scripted example (consistency notes)**

- Seats: You → Ava (left) → Ben (across) → Cara (right), clockwise.
- Learner's hand: 3♣ 3♦ 5♠ 5♥ 5♦ 7♦ 8♣ 8♥ 9♣ Q♠ Q♣ A♥ 2♠.
- Round 1: the learner leads 3♣ 3♦ (decision). Ava 8♠ 8♦, Ben passes, Cara 10♠ 10♦. The
  learner plays Q♠ Q♣ (decision). All pass.
- Round 2: the learner leads the triple 5♠ 5♥ 5♦ (decision). All pass.
- Round 3: the learner leads 8♣ 8♥. Ava passes, Ben plays J♣ J♥, and Cara, the learner and
  Ava pass. Ben wins.
- Round 4: Ben 4♥, Cara 6♦, learner 7♦, Ava 10♣, Ben K♣, Cara passes, learner A♥. All pass.
- Round 5: the learner leads 2♠ rather than 9♣ (decision). All pass. The learner leads 9♣ and
  goes out first (President). Ava finishes as Vice-President, Ben as Vice-Scum and Cara as
  Scum.
- Hand 2 swap: Cara gives 2♥ and A♦. The learner gives back the lone 3♥ and 4♠ (decision)
  from a new 13-card hand (3♥ 4♠ 6♦ 6♣ 8♦ 9♥ 9♠ J♦ Q♥ K♠ K♣ A♠ 2♣).

**Popular alternatives (in Variants)**

- Equal-rank plays that skip the next player; 2s clear the pile; jokers (highest or wild).
- Binding passes; seat changes; the Scum deals; the Scum or the President leads later hands.
- Neutral middle players with 5+; two decks for big groups.
- Daifugō's revolution (four of a kind reverses the ranking).

**Editorial review (rules + pedagogy pass)**

- The Vice-Scum was defined as "the second-to-last player to go out". With four players the
  Scum never goes out, so that wording points at the Vice-President. It's now "finishes second
  from last (the third out, with four players)" in both the glossary and the lesson.
- "A 2 usually wins the round" was wrong under our strictly-higher rule, where a 2 can never be
  beaten. It now says so.
- The card-swap step now says who leads later hands, hedged: "varies from table to table, but
  it is often the Scum". Before, beginners weren't told at all.
- Example step 4 claimed "nobody has three cards higher than 5s — triples are rare!". It now
  just says what a player would need to beat the triple.
- Added the glossary terms `rank`, `suit` and `hand` (hand = one whole deal, which beginners
  mix up with "the cards you hold") and linked them.
- Variants: three-player games usually skip the Vice titles (only President ↔ Scum swap).

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
  Kings). The "a move" lesson step lists the empty column as a fourth destination.
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

**Rules-editor review**

- Rules, deal (4 × 7 + 4 × 6), supermove formula, quiz answers and every example move re-checked
  against Pagat / classic Windows FreeCell: no rule errors found.
- Fixed: one wrong-option feedback claimed the K♦ "has nowhere to go" — it could still go into a
  free cell; the feedback now says so (and why that is bad). The King-in-a-free-cell feedback now
  notes it can also leave for its foundation at the very end.
- Fixed: the fast-forward step now says where the Q♣ in the free cell came from.
- Added `suit` and `rank` to the glossary (linked in the lesson) for absolute beginners; small
  wording fixes ("sitting on the 10♠", tense of the tiny worked example).
- Decision options were all authored with the correct answer first and the UI does not shuffle
  them; they are now in varied order.

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

**Rules-editor review**

- Deal (6/6/6/6/5/5/5/5/5/5 + 50 stock), building, run movement, the no-deal-with-an-empty-column
  rule, run removal, Windows scoring note and every example step re-checked against Pagat /
  classic Windows Spider: no rule errors found. Rank counts per scene stay within eight copies.
- Fixed: the tip "nothing can ever go above a King" (and a matching after-game tip) was confusing;
  both now say a King-led run never has to move onto another card.
- Added `rank` to the glossary (linked in "A move"); the fast-forward step now says the 8♠ 7♠ 6♠
  came from column 4.
- Decision options are now in varied order (the correct answer was always first).

### Old Maid

**Variant taught:** Classic Old Maid with a standard deck (Pagat / Bicycle-style rules): one
Queen removed, pairs by rank, cards drawn blind from a neighbour. Taught for four players; valid
for 2–8.

**Rules as taught**

- Deck: 52 cards with one Queen removed (51 cards). We suggest removing the Q♣ ("many families
  take out the Q♣"), but with rank-only pairing any Queen works: three Queens remain, so one can
  never be paired.
- Deal all 51 cards one at a time, starting on the dealer's left; some players may get one card
  more (with four players: 13, 13, 13, 12 — the dealer gets 12).
- A pair is two cards of the same rank, regardless of suit or colour. With three of a kind, put
  down two and keep the third.
- Before play, everyone puts all their pairs face up on the discard pile.
- Play: the player on the dealer's left goes first, and turns pass to the left. On your turn you
  take one card, unseen, from the face-down fan of the player on your right (so the first player
  draws from the dealer); if it makes a pair, put the pair down. Then the player on your left
  draws from you.
- You must offer every card you hold, face down; no peeking, no holding cards back.
- A player who runs out of cards is out and safe. If the player you would draw from has gone
  out, you draw from the next player still in the game.
- When every pair is down, the player left holding the last Queen (the Old Maid) loses. There is
  no single winner.

**Simplifications / editorial decisions**

- Rank-only pairing chosen as the most widespread rule; colour-matching pairs (with the Q♠ as a
  fixed Old Maid) is in Variants.
- Because pairing is by rank, the Old Maid only becomes a specific card once two Queens have
  paired. The lesson and example make this explicit (Mia pairs Q♥ Q♦, so the Q♠ is the Old Maid).
- Direction is taught as "draw from the player on your right, turns pass left"; tables that draw
  from the left are mentioned in Variants.
- Strategy is honestly presented as minimal: sort by rank, mix your cards before offering, keep
  a poker face, watch faces when picking, and remember where the Old Maid went.
- The two-player endgame pick is a decision where both options are "correct" (a 50/50 luck pick)
  — it teaches that the game is luck, while the other four decisions test rules and etiquette.
- History is hedged: "thought to have been a favourite in Victorian Britain"; special picture
  decks sold "by the late 1800s"; relatives Schwarzer Peter (Germany) and Babanuki (Japan, with a
  Joker). Origin given as United Kingdom.
- No mention of the old drinking-game origins (keeps the page family-friendly, and it is
  uncertain anyway).

**Scripted example (consistency notes)**

- Seats clockwise: You, Sam (your left), Mia, Leo (your right, dealer). You draw from Leo; Sam
  draws from you; Mia from Sam; Leo from Mia.
- Your 13: A♠ 2♥ 3♠ 4♣ 5♠ 7♠ 7♥ 7♦ 8♣ 9♥ J♣ K♣ K♥. Decision 1: discard 7♠ 7♥ and K♣ K♥, keep
  7♦ (three of a kind rule).
- Mia discards Q♥ Q♦ → the Q♠ (in Leo's hand) is the Old Maid.
- You draw the 9♣ from Leo. Decision 2: put down the 9s.
- Fast-forward: you hold 5♠ J♣ and draw the Q♠ from Leo. Decision 3: poker face (a Queen and a
  Jack are not a pair).
- Decision 4: offer all three cards mixed, evenly fanned, face down. Sam takes the Q♠.
- Fast-forward: Sam and Mia go out; the Q♠ travelled Sam → Mia → Leo. You hold 5♠; Leo holds
  5♦ + Q♠. Decision 5 (luck): pick either card — you get the 5♦, pair, go out; Leo is the Old
  Maid.

**Popular alternatives (in Variants)**

- Colour-matching pairs with the Q♣ removed; adding a Joker as the odd card instead (Babanuki);
  a similar French game with a Jack as the odd card; Germany's Schwarzer Peter with a special
  deck; commercial picture-pair decks; drawing from the left instead of the right.

**Rules-editor review**

- Removal of one Queen, the 13/13/13/12 deal (dealer short), rank-only pairs, three-of-a-kind,
  draw direction, the travel of the Q♠ and every hand size in the example re-checked: no rule
  errors found.
- Added the missing rule for skipping players who have gone out (lesson "Going out").
- Tips said the Old Maid must go "all the way round the table" to come back; that is only true
  while everyone is still in, so they now say "through every other player still in the game".
- Lesson hands made continuous (the J♣ is in the hand from "What counts as a pair" onwards, so
  the J♥ pick in "A turn" makes sense); a 6-card `stack` zone trimmed to 3 cards.
- Added `suit` to the glossary; decision options are now in varied order.

### Cheat

**Variant taught:** Classic Cheat / I Doubt It with a fixed rising rank sequence (the version in
Pagat and Hoyle-style books): Aces, 2s, 3s … Kings, then Aces again. Name "Cheat" with aka Bluff
and I Doubt It (the US schoolyard name is mentioned, as "BS", only in the history text).

**Rules as taught**

- 3–8 players (taught with four), one 52-card deck (two decks shuffled together for big groups).
- Deal out every card; some players may get one more.
- The player on the dealer's left starts; turns go clockwise.
- On your turn put 1–4 cards face down on the pile and announce how many and the rank. The rank
  is fixed by the sequence: the first player claims Aces, the next 2s, and so on to Kings, then
  back to Aces.
- The number announced must equal the number of cards put down (everyone can see it); the rank
  may be a lie. Passing is not allowed: with none of the rank you must still play at least one
  card.
- Before the next player plays, anyone may call "Cheat!" (the first caller is the challenger).
  The cards just played are turned face up. If any card is not of the claimed rank, the player
  who played them picks up the whole pile; if all are true, the challenger picks up the whole
  pile. A fresh pile starts and play continues with the next player and the next rank.
- Suits never matter; only ranks do.
- The first player to get rid of all their cards wins. A final play can be challenged; if it was
  a lie, that player picks up the pile and the game continues.

**Simplifications / editorial decisions**

- Fixed rising sequence chosen over the British "same, one higher or one lower" option, which is
  listed in Variants (hedged as "many British tables").
- 1–4 cards per turn taught as standard; "any number of cards" is a Variant.
- No passing; the "pass allowed" house rule is a Variant.
- Anyone may challenge (first caller wins the right); "only the next player may challenge" is a
  Variant.
- The game is taught as ending when the first player goes out; playing on for places is a
  Variant.
- Strategy is presented as rules of thumb: tell the truth when you can, lie with one card or hide
  one stranger among real cards, count the cards you hold to spot impossible claims, always
  challenge a last card, lie early while the pile is small.
- History is hedged and contains no dates: many names (Cheat in Britain, I Doubt It in older
  American books, Bluff, the "BS" schoolyard name); inventor unknown. Origin given as worldwide
  ('UN').

**Scripted example (consistency notes)**

- Seats clockwise: You, Ava (your left), Ben, Cara (your right, dealer). Rank order: You A, Ava 2,
  Ben 3, Cara 4, You 5, …
- Your 13: A♥ 2♠ 3♠ 3♦ 4♠ 6♦ 7♣ 9♥ 10♦ J♥ Q♦ K♠ K♦ (no 5s, no 8s).
- Decision 1: play the A♥ honestly ("One Ace"). Ava plays 2♣ 2♦ ("Two Twos").
- Ben plays 3♣ 9♦ J♠ as "Three Threes". Decision 2: call Cheat (you hold two 3s, so three is
  impossible). Ben picks up all six cards; the pile restarts.
- Cara "One Four". Decision 3: with no 5s, play one card (the 6♦) as "One Five"; nobody calls.
- Fast-forward (you were caught once and picked up a pile): you hold 8♣ 8♥. Ava plays her last
  card (Q♣) as "One Five". Decision 4: call Cheat on a last card → Ava picks up the pile.
- Ben "One Six", Cara "Two Sevens", unchallenged. Decision 5: you play both Eights as "Two
  Eights" (the count must match). Cara calls Cheat wrongly and picks up the pile; you win.

**Popular alternatives (in Variants)**

- Same / one higher / one lower claims; passing allowed; any number of cards per turn; only the
  next player may challenge; two decks for big groups; starting with the holder of the A♠ or 2♣;
  playing on for second and third place.

**Rules-editor review**

- Rank sequence, 1–4 cards, no passing, challenge resolution, last-card challenge, quiz answers and
  the whole example (seat order, whose rank is whose, 13/12/11-card hands, the 4 + 1 = 5 cards Ava
  picks up) re-checked against Pagat Cheat / Hoyle's I Doubt It: no rule errors found.
- The lesson now says what happens after a challenge (fresh pile, next player, next rank); before,
  only the example said it.
- Added `suit` to the glossary with "suits don't matter in Cheat"; a 4-card `stack` zone trimmed
  to 3 cards (label now says "4 cards"); decision options are now in varied order.

---

## Appendix: Tier 1 engine rule notes

Detailed implementation decisions recorded by each engine author and verifier (the summaries at the top of this file are authoritative; these add edge cases).

### Blackjack (21) — rules draft

Engine: `src/games/blackjack/engine.ts` (Tier 1). Content: `content/games/blackjack.ts`.

#### Variant taught

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
- **Not offered**: surrender, insurance, even money, re-splitting. A `surrender`, `insurance`
  or `even-money` move is refused with a specific, friendly reason (not just "not a move").

#### Decisions and simplifications (and why)

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

#### Betting

- Stake options 10/25/50/100/250, `maxLossUnits` 1 (doubles/splits are extra, only when
  affordable).
- `humanNetUnits`: Blackjack +1.5; each hand ±its bet (1, or 2 if doubled); push 0. Range
  −4 … +4 (split and double both hands); never below −(1 + affordableUnits).

#### Result flags

- `tags`: `blackjack` (learner natural), `dealerBlackjack`, `dealerBust`, `split`, `doubled`.
- `perfect`: learner natural. `bust`: every learner hand busted. `folded`: never.
- `comeback`: the round was won and a winning hand had drawn a card while on a hard 12–16.
- `luckyLastCard`: the round was won and either a hit/double brought a winning hand to exactly
  21, or the dealer busted while the learner stood on 16 or less.
- `closeFinish`: some hand won or lost by exactly one point (totals compared, no naturals,
  no dealer bust). `bigPot`: |net| ≥ 2.

#### Coach and bots

- Coach and the `normal` bot use 6-deck S17 DAS no-surrender **basic strategy**
  (`src/games/blackjack/strategy.ts`), falling back to hit/stand when a double or split is
  not allowed. They only use the learner's cards and the dealer's upcard.
- `easy` bot: hit below 15, otherwise stand (never doubles or splits).
- Measured over 1,000,000 seeded rounds, basic strategy loses 0.35% ± 0.12% per round
  (the published edge for these rules is about 0.4–0.5%); the easy bot loses about 5%.

#### Verification (rules review)

- `rules.test.ts` checks every rule above with focused edge cases (S17 with multi-card soft
  17s and soft-to-hard hands, the peek under every 10-value card and the Ace, naturals never
  letting the dealer draw, three-card 21 and split 21 pushing against a dealer 21, busts
  losing to a busting dealer, doubles on every two-card total, split-Ace re-pairs, auto-stand
  on soft 21, honest flags) plus a 3,000-round fuzz with random legal moves over 1–8 decks and
  wallets 0–7 (legalMoves = checkMove, no stuck states, no mutation, card conservation,
  bounded payouts, and the learner's coach/bot/move log never depending on the hole card).
- `content.test.ts` replays every lesson scene, tip, glossary example and quiz answer
  through the engine and the strategy chart.
- `strategy.test.ts` re-derives the dealer facts the coach quotes (bust odds per upcard,
  the most likely final totals) from 200,000 simulated dealer hands.
- Every rule mutation tried (H17, 1:1 naturals, no peek, playable split Aces, no DAS, no
  auto-stand, the dealer drawing against busts, split 21 as Blackjack, pushes paying,
  wallet off-by-one, a bust beating a dealer bust, re-splitting, late doubles, a dealer
  Blackjack taking doubles) makes the suite fail.
- Labels: `describeHand(hand)` names a split Ace + 10 "soft 21", never "Blackjack"
  (`describeTotal(cards)` alone cannot tell where a hand came from).

#### Popular alternatives (Variants note)

- Dealer **hits soft 17** (H17) — slightly worse for the player.
- **Re-splitting** up to four hands; re-splitting Aces.
- **Late surrender**: give up half your bet after the peek.
- **Insurance / even money** when the dealer shows an Ace (a side bet; poor value).
- **6:5 Blackjack** tables — much worse for the player; avoid.
- Single- or double-deck games; European **no-hole-card** rule (the dealer takes the second
  card after you play, and a dealer Blackjack can take doubles and splits).
- Home cousins: British **Pontoon** ("twist" / "stick"), French **Vingt-et-un**;
  **Spanish 21** (no pip 10s, bonus payouts).

### Teen Patti

**Variant taught:** classic **Teen Patti** (blind/seen betting, no side show) for 2–5
players, **one deal per game** (D-05). This is what the engine (`src/games/teen-patti/`) and the
lesson (`content/games/teen-patti.ts`) both implement.

**Rules as taught and implemented**

- One standard 52-card deck, no jokers. 3 seats by default (learner + 2 bots); 2–5 supported.
- The dealer is chosen by the seed. Everyone posts a **boot** of 1 unit (1 unit = 1 boot).
  Three cards each are dealt face down, one at a time, starting on the dealer's left; that
  player acts first and play continues clockwise (to the next seat number).
- Everyone starts **blind**. On your turn you may:
  - **See** — look at your cards (free). You are now **seen** and act again immediately.
  - **Chaal** — bet the current **stake** if blind, **2× the stake** if seen.
  - **Raise** — bet double a chaal (blind 2× stake, seen 4× stake); the stake doubles.
    Only allowed while the new stake stays within the **chaal limit of 8 boots** (so the
    stake goes 1 → 2 → 4 → 8).
  - **Show** — only when exactly two players are left; costs the same as a chaal. Both
    hands are compared; the better hand takes the pot; **exactly equal hands → the player
    who asked loses**. Blind players may ask for a show too.
  - **Pack** — fold; you lose what you have put in.
- **Pot limit 64 boots.** If a bet (chaal, raise or show) would bring the pot to 64 or more,
  it is reduced so the pot is exactly 64. For a chaal or raise, every player still in then
  shows: the best hand wins; equal best hands split the pot.
- **Last player standing** (everyone else packed) wins the pot without showing.
- **Hand ranking**: Trail (three of a kind) > Pure sequence (straight flush) > Sequence
  (straight) > Colour (flush) > Pair > High card. Sequences rank **A-K-Q** (highest),
  **A-2-3** (second), then K-Q-J, Q-J-10 … down to 4-3-2; sequences never wrap (K-A-2 is
  Ace high). Same category: compare card by card from the highest (Ace high); pairs compare
  the pair, then the odd card. Suits never break ties.
- **Betting / units**: humanNetUnits = boots won − boots put in. Worst case = the whole capped
  pot, so `maxLossUnits` = 64 (stake = Jeet per boot: 5/10/20).

**Decisions / simplifications and why**

- **No side show** (a seen player asking the previous seen player for a private compare).
  It adds a second, conditional compare rule that confuses first-timers; it is described in
  Variants.
- **Pot limit 64 and chaal limit 8** (boots) keep a single hand short and cap the worst case
  so the D-04 escrow (64 units) always covers the learner. They are exposed as engine options
  (`potLimit` ≤ 64, `stakeLimit` ∈ {1, 2, 4, 8}) but the site uses the defaults.
- **A show that itself hits the pot limit** is still a _requested_ show: its cost is capped,
  only the two players compare, and the asker loses an exact tie. (Only chaal/raise bets
  trigger the "everyone shows, ties split" pot-limit show.)
- **Split pots** are paid in whole boots: each winner gets an equal share and any odd boot
  goes to the winner nearest the dealer's left (the usual odd-chip convention).
- **Show cost when blind vs seen** follows the chaal price of the asker (blind = stake,
  seen = 2× stake). No rule stops a seen player asking a blind player for a show — some
  tables forbid it; we keep the single, simple rule "two left → either may ask".
- **Seeing is a move on your turn** (not "any time"), so the UI can animate it and the
  learner then chooses their bet with the cards in view.
- **Bots and coach near the pot limit.** When the next chaal would reach the pot limit it is
  the last bet of the hand, so the normal bot and the coach treat it as a showdown decision:
  a blind player looks first (seeing is free and the capped bet costs the same), a seen
  player chaals only if its chance of winning beats the price (no bluffing into a forced
  show), and heads-up it chaals rather than asking for a show (same price, but an exact tie
  splits instead of losing). A raise that would itself reach the limit is never chosen: it
  ends the betting at once, so it cannot make the others pay more. The coach's situation
  text states the real, capped price.
- **Dealing happens at setup** (no forced dealer moves): every card is dealt before the first
  decision, so the UI animates the whole deal at the start of the game.
- **A-2-3 is the second-best sequence**, as fixed in `docs/RULES_DECISIONS.md`. Conventions
  vary between groups (some rank A-2-3 as the very top or the very bottom sequence); this is
  mentioned in Variants.

**Engine result flags** (for titles/roasts): `folded` = learner packed; `bigPot` = |net| ≥ 8;
`closeFinish` = the learner was in the show and it was decided by the high card, a kicker or
an exact tie (a split pot the learner shares always counts); `luckyLastCard` = the learner
won a show outright (never a split) and it was decided by the very last card compared; `perfect` = won holding a Trail; `comeback` = won although a player who packed held
a better hand; `bust` = the learner asked for a show and lost it. Tags: `trail`,
`pure-sequence` (learner's hand), `blind-win` (won without seeing), `bluff-win` (comeback
with no show), `show`, `pot-limit`, `split-pot`, `packed-best-hand`.

**Popular alternatives** (for the Variants note): side show; table-specific boots and limits;
A-2-3 ranked differently; dealer's-choice games such as Muflis (lowest hand wins), AK47 (A, K, 4,
7 wild), joker/wild-card games and Best of Four.

### Andar Bahar — rules draft

Engine: `src/games/andar-bahar/engine.ts` (Tier 1; exact odds in `rules.ts`).
Content: `content/games/andar-bahar.ts`.

#### Variant taught

Classic Andar Bahar, one learner against the dealer:

- **Deck**: one standard 52-card deck, no printed jokers, shuffled fresh every game.
  One deal = one game.
- **Joker**: the dealer turns the top card face up in the middle. Any card of the same
  **rank** (any suit) is a match. Three such cards are always left in the 51-card stock.
- **Bet**: after seeing the joker, the learner bets one stake on **Andar** (inside) or
  **Bahar** (outside). Placing the bet starts the dealing, so bets are locked from that moment
  (there is no window to switch sides before card 1).
- **Deal**: the dealer deals face up, one card at a time, alternately to Andar and Bahar,
  **always starting with Andar** (cards 1, 3, 5, … go to Andar; 2, 4, 6, … to Bahar).
- **Match**: the first card of the joker's rank ends the deal; the side it landed on wins.
  A complete deck always has a match by card 49 at the latest.
- **Payouts**: a winning Andar bet pays **0.9 to 1**; a winning Bahar bet pays **1 to 1**;
  a losing bet loses its stake. There are no pushes.
- **Not offered**: side bets on how many cards are dealt before the match.

#### Decisions and simplifications (and why)

| Decision                                   | Why                                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First card always to Andar                 | One fixed rule is easiest to teach and matches the most common convention behind the 0.9 / 1 payouts. Tables that switch the starting side are mentioned in Variants. |
| Andar 0.9:1, Bahar 1:1                     | The common casino convention: the side that gets the first card wins slightly more often, so it pays slightly less. It also gives a clear, honest lesson in odds.     |
| Learner sees the joker before betting      | Standard order of play; it makes the bet feel connected to the card being hunted (it doesn't change the odds — every rank gives the same 51.5% / 48.5%).              |
| Single deck, fresh shuffle every deal      | Keeps every deal independent, which is the key beginner lesson ("the cards have no memory").                                                                          |
| No side bets                               | Extra bets on the number of cards dealt add complexity without teaching anything about the game. Mentioned in Variants.                                               |
| One learner vs the dealer                  | Andar Bahar has no interaction between bettors, so extra bot bettors would add nothing.                                                                               |
| Dealing is one forced dealer move per card | Lets the UI animate each card landing; the dealer has no choices.                                                                                                     |

#### Odds (exact)

With 51 unseen cards holding 3 matches, every placement is equally likely. The first match is
card `k` with probability C(51 − k, 2) / C(51, 3); Andar gets the odd-numbered cards:

- Andar wins **10,725 / 20,825 ≈ 51.50%**, Bahar **10,100 / 20,825 ≈ 48.50%**.
- Average result per unit bet: Andar **≈ −2.15%** (0.9 × 0.5150 − 0.4850), Bahar
  **≈ −3.00%** (0.4850 − 0.5150). So the 0.9 payout does not fully cancel Andar's first-card
  advantage: Andar is very slightly the kinder bet, but both are pure chance.
- The match comes on card 13 on average; 3/51 ≈ 5.9% of deals end on the first card and
  ≈ 12.5% go 26 cards or longer.

These numbers are verified by a brute-force enumeration in `rules.test.ts` and by a
40,000-deal simulation in `simulation.test.ts`.

#### Betting

- Stake options 10/25/50/100/250, `maxLossUnits` 1.
- `humanNetUnits`: +0.9 (Andar win), +1 (Bahar win), −1 (loss). No optional extra
  commitments, so `affordableUnits` has no effect.

#### Result flags

- `luckyLastCard`: the match came on the very first card, or after at least 25 cards were
  dealt without one (card 26 or later — the long nail-biter).
- `closeFinish`: the match came within the first 3 cards.
- `tags`: `andar-wins` / `bahar-wins`, `first-card-match`, `long-deal` (card 26+).
- `bigPot`, `comeback`, `perfect`, `bust`, `folded`: never (single unit, no decisions after
  the bet).

#### Coach and bots

- The dealer has exactly one legal move (`deal`) at every step.
- `normal` learner bot and the coach's suggestion: **Andar**, the side with the smaller
  average loss (−2.15% vs −3.00%). The coach explains that it is pure chance, why Andar pays
  less (51.5% vs 48.5%), and that the difference is a whisker, not a strategy.
- `easy` learner bot: a random side.
- Both use only public information (the joker and how many cards are still face down).
- During the deal the coach quotes the learner's live chance of getting the next card of the
  joker's rank (exact, from the number of face-down cards). After 48 cards without a match only
  the three matches are left, so it says the next card is sure to match instead of quoting
  "about 100%" / "about 0%".
- Illegal-move reasons put the most fundamental problem first: the dealer never bets, and once
  the dealing starts every bet attempt (even a malformed one) is told the bet is locked.

#### Popular alternatives (Variants note)

- Tables that start with **Bahar**, or change the starting side from deal to deal — the
  side that gets the first card is then the one paid a little less.
- **Side bets** on how many cards are dealt before the match (1–5, 6–10, …).
- Friendly **home games** that pay both sides 1 to 1 and rotate the dealer.
- Regional names: Katti; Mankatha in Tamil Nadu.

### Indian Rummy (13-card Points Rummy)

**Variant taught:** 13-card **Points Rummy**, one deal per game (D-05). This is what the engine
(`src/games/indian-rummy/`) and the lesson (`content/games/indian-rummy.ts`) both implement. The
site plays it one-on-one (learner vs one bot); the engine supports 2–6 seats with the same rules.

**Rules as taught and implemented**

- **Cards:** two standard 52-card decks plus two printed jokers (106 cards). Identical cards from
  the two decks are interchangeable.
- **Deal:** the dealer is chosen by the seed (engine option `dealer`). 13 cards each, one at a
  time starting on the dealer's left. The next card is turned face up under the stock as the
  **wild-joker card**; the next starts the **open pile**; the rest is the **closed stock**. The
  player on the dealer's left (the next seat number) plays first; play goes clockwise.
- **Jokers:** every card of the wild-joker card's rank (any suit) is a joker, and so are the
  printed jokers. If the wild-joker card is itself a printed joker, **Aces are wild**. The
  wild-joker card stays out of play — nobody may take it.
- **Turn:** draw one card (top of the closed stock or top of the open pile — jokers on the
  open pile may be picked up), then discard one card face up. Instead of discarding you may
  **declare**.
- **Groups:**
  - **Pure sequence** — 3+ consecutive cards of one suit with no joker standing in. A
    wild-rank card sitting in its own natural place (5♥ in 4♥ 5♥ 6♥ when 5s are wild) keeps it
    pure.
  - **Impure sequence** — 3+ consecutive cards of one suit where jokers fill gaps or ends.
  - **Set** — 3 or 4 cards of one rank in different suits (jokers may replace missing suits;
    two cards of the same suit never share a set).
  - Ace is low (A-2-3) or high (Q-K-A); sequences never wrap (K-A-2). Any length ≥ 3.
  - A group may consist mostly of jokers: three jokers that include a wild-rank card form a
    sequence (that card in its natural place plus two jokers).
- **Declare:** after drawing, throw the 14th card and show 13 cards that are **all** in groups,
  with **at least two sequences, at least one of them pure**. The declarer wins.
- **Scoring:** every other player pays their **deadwood** — the points of the cards they cannot
  group in their best arrangement: A, K, Q, J, 10 = 10; 2–9 = face value; jokers (printed and
  wild) = 0. **If a player cannot make a pure sequence, every card counts.** Payments are
  capped at **80 points**. With more than two players the winner collects from everyone.
- **Drop:** at the start of your turn, before drawing, you may drop out: **20 points** if you
  have not drawn a card yet this game (first drop), **40 points** later (middle drop). A dropped
  player's 13 cards are set aside face down. With two players the other player wins at once;
  with more, play continues and the eventual winner collects the drop points too.
- **Stock runs out:** at the end of the turn that emptied it, the open pile except its top card
  is shuffled (seeded RNG stored in the state) to form a new closed stock.
- **Betting / units:** 1 unit = 1 point. `humanNetUnits` = +the sum of what the other players
  pay when the learner wins; −the learner's own points when they lose. Worst case = 80, so
  `maxLossUnits` = 80 (stake = Jeet per point: 1/2/5). Best case = 80 × (players − 1).

**Decisions / simplifications and why**

- **Invalid declarations are blocked** with a precise explanation (no pure sequence / no second
  sequence / which cards are still loose, plus a "discard X instead" tip when another discard
  would work) instead of the usual 80-point penalty. Beginners learn the rule without being
  punished for misreading their hand. Mentioned in Variants.
- **Deadwood when a pure sequence exists counts every other group** (sets and impure sequences
  included), even if the loser has no second sequence. This is the rule as written in
  `docs/RULES_DECISIONS.md` ("if the loser has no pure sequence, every card counts"); some
  sites additionally require a second sequence before sets count.
- **Turn cap:** if 200 turns (draw + discard) pass without a declaration — which only happens
  with very weak play — the game ends, every remaining hand is scored by deadwood (same rules
  and cap) and the lowest wins; tied lowest hands share the losers' points equally (so a
  two-player tie is a push). Keeps every game finite. The cap is the engine option `maxTurns`
  (the simulations use short caps to exercise this ending).
- **Comeback flag uses raw deadwood.** With the "no pure sequence → every card counts" rule
  almost every opening hand is worth 60+ points, so "deadwood ≥ 60 at some point" would be
  true for nearly every win. The flag therefore uses the points of the ungrouped cards in the
  best grouping, ignoring the pure-sequence rule (measured at the deal and after every
  discard).
- **No rule against discarding the card just taken from the open pile.** Some tables forbid it;
  it is not universal and does not change the strategy a beginner needs.
- **Dealing happens at setup** (no forced dealer moves), like Teen Patti: the UI animates the
  whole deal at the start.
- **Hands are dealt sorted** (suit, then rank) for display; drawn cards are appended at the end.
- **Displayed groups** (`bestArrangement`, used by the board): sequences are laid out low → high
  with each joker in a place it can really fill; spare jokers in a complete hand join a
  sequence (below the run when it already ends on an Ace, so nothing looks like K-A-2), and a
  jokers-only sequence shows its wild-rank card in its own place. Long runs may be shown split
  in two (e.g. a pure run plus a second sequence) when that is what makes the hand declarable.
- **`affordableUnits`** is not used: there are no optional extra commitments beyond the
  80-point escrow (a drop costs at most 40).
- **Attempting to take the wild-joker card** is modelled as the move `{ type: 'draw', from:
'wild' }`, which is never legal — boards may submit it so the learner sees why.

**Engine result flags** (for titles/roasts): `perfect` = the learner declared on one of their
first 3 turns or with a hand that needs no joker standing in; `comeback` = the learner won
after their hand had at least 60 points of ungrouped cards (raw deadwood, not counting the
pure-sequence penalty) at some point; `closeFinish` = a loser paid ≤ 10 points (or a tie at the
turn cap); `luckyLastCard` = the learner declared using the card just drawn blind from the
closed stock; `bigPot` = |net| ≥ 40 points; `folded` = the learner dropped; `bust` = the
learner paid the full 80 points. Tags: the ending (`declare`, `drop`, `turn-cap`),
`first-drop`/`middle-drop` (learner), `opponent-dropped`, `no-jokers`, `quick-declare`,
`full-count`, `stock-finish`, `reshuffled`, `aces-wild`.

**Bots:** normal takes the open card only when it clearly improves its hand (always a joker),
throws the card whose loss hurts least by a "distance to declaring" score (loose cards cost
most, pairs and close same-suit cards less, high points slightly more; jokers are never
thrown), declares as soon as it can, drops a hopeless opening hand (no joker, no pure
sequence, hardly any connected cards — about 1 hand in 80) and very rarely makes a middle drop
(no pure sequence and no joker after 8 turns). Easy takes the open card only when it completes
a group at once, throws a random card that is not in a group, declares when it can and never
drops. Bots see only their own hand, the open pile and the wild-joker card.

**Popular alternatives** (for the Variants note): the 80-point wrong-declaration penalty; Pool
Rummy (101/201, elimination over many deals); Deals Rummy (fixed number of deals); games
without printed jokers; no picking jokers from the open pile; 25/50-point drops; 10-card
rummy; 21-card Marriage Rummy with three decks.

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
    not acted yet may raise, to at least the all-in amount + the last full raise. The same goes
    for an all-in **bet** smaller than the big blind: a player who already checked may only call
    or fold, a player yet to act may raise to the all-in amount + the big blind.
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
- **"All-in always allowed"** (the Tier 1 summary above) has the two standard exceptions where
  an all-in would be a raise nobody may make: when a short all-in has not re-opened the betting
  for this player, and when every other player still in is already all-in. In both spots the
  player may still call (all-in for less if short) or fold, and `checkMove` explains why.
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
`perfect` = won holding four of a kind or a straight flush that the learner's own hole cards
help make (four Nines or a straight flush lying entirely on the board belong to everyone and do
not count). Tags: `royal-flush`, `straight-flush`, `four-of-a-kind` (the learner's own final
hand, with the same "not all on the board" rule), `bluff-win` (won without a showdown after
betting or raising), `showdown`, `split-pot` (the learner shared a pot), `side-pot`, `all-in`,
`folded-best-hand` (folded a hand that would have won the showdown).

**Popular alternatives** (for the Variants note): multi-hand cash games with a rotating button;
tournaments with rising blinds; full 9–10-player tables; antes and straddles; Limit and Pot-Limit
betting; Omaha (four hole cards, use exactly two); Short Deck / Six Plus Hold'em (2s–5s removed,
flush beats full house); mucking losing hands at the showdown.

### Baccarat (Punto Banco) — rules draft

Engine: `src/games/baccarat/engine.ts` (Tier 1; drawing rules and payouts in `rules.ts`,
exact odds in `odds.ts`). Content: `content/games/baccarat.ts`.

#### Variant taught

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

#### Decisions and simplifications (and why)

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

#### Odds (exact)

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

#### Betting

- Stake options 10/25/50/100/250, `maxLossUnits` 1.
- `humanNetUnits`: +1 (Player win), +0.95 (Banker win), +8 (Tie win), 0 (Player/Banker bet
  on a tie), −1 (loss). No optional extra commitments, so `affordableUnits` has no effect.
- Note for the shell: a Banker win at a 10-Jeet stake is 9.5 Jeet before rounding.

#### Bots and coach

- Normal bot: always bets Banker (the smallest house edge). Easy bot: a random bet.
  The dealer seat's only move is to deal the next card.
- Coach: before the bet, suggests Banker and explains the house edges in plain words (with
  the exact figures for the shoe in play) and that the drawing is automatic. During the
  deal, it explains which rule decides the next card.

#### Result flags

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

#### Popular alternatives (for the Variants note)

- **Mini-baccarat**: identical rules at a smaller, faster table.
- **No-commission baccarat**: Banker pays 1 to 1 except in one case — e.g. half when Banker
  wins with a 6, or a push when Banker wins with a three-card 7.
- **Tie 9 to 1** at some tables.
- **Chemin de fer / baccarat banque**: the older French games, where the bank is held at
  the table (in chemin de fer it passes from player to player; in baccarat banque one
  banker keeps it) and some draws are a choice, such as whether to draw on a 5.
- **Side bets** such as Player Pair and Banker Pair.

#### Verification (rules audit)

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

### Hearts

**Variant taught:** classic 4-player Hearts ("Black Lady" scoring), one hand = one game
(D-05). Engine: `src/games/hearts/engine.ts`; content: `content/games/hearts.ts`.

**Rules implemented**

- 4 seats (learner = seat 0, three bots), one standard 52-card deck, 13 cards each.
- **Passing:** each player passes 3 cards to the **left** (seat i → seat i+1). Seats choose
  in turn order (0, 1, 2, 3); a chosen pass leaves the hand at once, but nobody receives
  anything until all four have chosen, then the cards change hands simultaneously — so no
  one can see what they will receive before passing.
- The holder of the **2♣** (after passing) leads it to the first trick.
- **Follow suit** if able; otherwise play any card.
- **First trick:** no point cards (Hearts or Q♠) unless you hold nothing else. A player
  whose hand is only point cards (Hearts and/or the Q♠) may play any of them.
- **Breaking Hearts:** a Heart cannot be led until a Heart has been played on an earlier
  trick, unless the leader holds only Hearts. The **Q♠ does not break Hearts** (the
  standard modern rule; some tables play that she does — see Variants).
- Highest card of the led suit wins (Ace high) and leads the next trick.
- **Scoring:** 1 point per Heart, 13 for the Q♠ (26 per hand). **Shooting the moon:** a
  player who takes all 26 scores 0 and every other player scores 26.
- **Winner(s):** lowest hand score; ties share the win.

**Betting (winner-takes-pot):** each loser pays 1 unit into the pot and the winners split
it: sole winner **+3 units**, two tied winners **+1** each, three tied winners **+1/3**
each, losers **−1**. The four seats' payouts always sum to 0. `maxLossUnits` 1. A push is
impossible (four-way ties can't happen: 26 or 78 points never split evenly four ways).

**Decisions and simplifications (and why)**

- One hand instead of a game to 100 points — keeps a game under ~10 minutes (D-05).
- The pass always goes left (no left/right/across/hold rotation) because there is only one
  hand. The engine also supports `options.passDirection: 'right' | 'across' | 'hold'` for
  future use; the lesson teaches only "left".
- Shooting the moon uses the "everyone else +26" form (the most common), not "shooter −26".
- No Jack of Diamonds bonus (Omnibus) and no "Q♠ breaks Hearts" house rule — both are
  mentioned in the Variants note.
- Result flags: `perfect` when the learner scores 0 (no points, or shot the moon);
  `bigPot` for a sole win (+3); `comeback` when the learner had ≥ 13 points along the way
  and still won (in practice only via shooting the moon); `closeFinish` when the learner's
  score is within 2 points of the decisive rival (the best non-winner when the learner won,
  the winner when the learner lost); `luckyLastCard` when the final trick turned the
  learner's result from not-winning into a win; `bust` when the learner lost after taking
  the Q♠; tags `shootTheMoon`, `opponentShotMoon`, `queenOfSpades`, `cleanHand`,
  `sharedWin`.

**Popular alternatives (Variants note)**

- Full game to 100 points; pass direction rotates left → right → across → hold.
- Q♠ breaks Hearts; Hearts may be led at any time; points allowed on the first trick.
- Jack of Diamonds counts −10 (Omnibus Hearts).
- Moon shooter subtracts 26 from their own score instead.
- 3, 5 or 6 players with a few low cards removed so the deck divides evenly.

### Spades

**Variant taught:** classic 4-player partnership Spades, one hand = one game (D-05).
Engine: `src/games/spades/engine.ts` (rules helpers in `rules.ts`, bots and coach in
`strategy.ts`); content: `content/games/spades.ts`.

**Rules implemented**

- 4 seats, clockwise (seat i+1 is on seat i's left). Partnerships: **learner (seat 0) +
  bot partner (seat 2)** against seats 1 and 3. One standard 52-card deck, no jokers.
- **Dealer** is chosen from the seed (`config.options.dealer` can fix it, 0–3). The deck
  is dealt one card at a time starting with the player on the dealer's left; 13 each.
  The deal happens in `setup()` (as in Hearts) — there is no separate deal move.
- **Bidding:** starting on the dealer's left, each player bids once, 0–13 tricks.
  **0 = Nil** ("I will win no tricks"). No Blind Nil, no minimum team bid, no
  restriction on the total of all bids.
- **Play:** the player on the dealer's left leads the first trick. **Follow suit** if
  able; otherwise play any card (trumping is never compulsory).
- **Spades are always trump:** the highest Spade in a trick wins it; with no Spade, the
  highest card of the led suit wins (Ace high). The winner leads the next trick.
- **Breaking Spades:** a Spade cannot be **led** until Spades are broken, unless the
  leader holds nothing but Spades. Spades become broken the first time a Spade is played
  **on a trick of another suit** — a player who can't follow suit trumps (or throws away
  a Spade). A Spade led by a Spades-only hand, and the Spades played to follow it, do
  **not** break Spades, so the next leader who still holds other suits must lead one of
  them. This is the definition in `docs/engine-notes/spades.md` ("a spade was played on a
  non-spade lead") and the standard (Pagat) rule; `rules.ts` `breaksSpades()` implements
  it for the engine, the bots' memory and the tests.
- **Scoring** (per partnership, after 13 tricks):
  - Contract = the sum of the partners' non-Nil bids.
  - Contract made → **10 × contract + 1 per overtrick** ("bag"); failed ("set") →
    **−10 × contract** (no bags).
  - **Nil:** +100 if the Nil bidder took no tricks, −100 otherwise; scored separately
    for each Nil bidder.
  - **A Nil bidder's tricks never count toward the partner's contract** (standard), but
    **each one counts as a bag (+1)** for the team — whether or not the partner's contract
    was made. Choice documented here as required by the engine notes.
  - If both partners bid Nil the contract is 0 (trivially made, 0 points) and only the
    Nil results and bags score.
- **Winner:** the partnership with the higher score for the hand; equal scores = push.

**Betting:** ±1 unit (`humanNetUnits` = +1 win, −1 loss, 0 push), `maxLossUnits` 1. No
extra commitments exist in Spades, so `config.affordableUnits` is not used.

**Result flags (computed from what actually happened)**

- `perfect`: the learner's team made its contract **exactly** (contract > 0 and zero
  bags, i.e. no overtricks and no tricks taken by a Nil bidder), **or** a Nil bid by the
  learner or the partner succeeded (tag `nil`).
- `closeFinish`: the two team scores differ by ≤ 10 (a tie included).
- `comeback`: the learner's team **won the hand** and made its contract after being
  **behind** with 4 or fewer tricks left — "behind" = it still needed at least 2 more
  tricks and more than half of the remaining tricks (e.g. 3 of the last 4, 2 of the last
  3, the last 2). Needing only the very last trick is not counted as a comeback (that is
  `luckyLastCard` territory). A late contract that still loses the hand is not a
  comeback (`ResultFlags.comeback` = "behind at some point and still won").
- `luckyLastCard`: the learner's team won, but would not have been winning had the hand
  been scored before the 13th trick. Usually the learner's team took the last trick, but
  it also fires when the last trick breaks an opponent's Nil (a 200-point swing).
- `bigPot`: the learner's team **won** by ≥ 100 points.
- `bust`: the learner's team lost and either was set or the learner's own Nil failed.
- `folded`: always false (nobody can fold in Spades).
- `tags`: `nil` (learner-team Nil made), `nilFailed`, `opponentNil` (an opponent's Nil
  made), `bustedNil` (an opponent's Nil failed), `set`, `setOpponents`, `exactBid`, `tie`.

**Bots** (use only their own hand + public bids and played cards)

- Easy bid: Aces + ½ × Kings + Spades beyond three, rounded, ±1 at random, at least 1
  (never Nil). Easy play: mostly the lowest legal card, sometimes the cheapest winner
  when the team still needs tricks, occasionally a random legal card.
- Normal bid: counts likely tricks (Aces; Kings with a guard; Spade honours and Spade
  length; short side suits with spare Spades to trump) and bids a little under the count
  (being set costs far more than a bag), never pushing the team contract above 13; bids
  Nil only with a very weak, safe hand (no Aces, ≤ 3 Spades none above the 9, no short
  Kings/Queens, low cards in every suit) and never when the partner already bid Nil.
  Normal play: wins the tricks the team needs (cheapest sure winner, trump when void,
  second hand low, third hand high), never overtakes a partner who is safely winning,
  tries to set the opponents, covers a partner's Nil, dodges tricks when it bid Nil, and
  lets an opponent's Nil bidder win tricks. Once both contracts are settled it ducks to
  avoid bags (the full-game habit the engine notes ask for) **only when the remaining
  tricks can no longer change who wins the hand**; while they still can, it keeps
  winning tricks, because in this one-hand game each bag is +1 and every trick the
  opponents take is +1 for them (always ducking threw away hands that were decided by a
  single bag — see the "keeps competing" strategy test, a position from real play). The
  coach reuses the normal logic. Its reasons only call a card a sure winner when no
  opponent can possibly beat it; otherwise they say it "should win … unless an opponent
  has run out of that suit and trumps it".

**Decisions and simplifications (and why)**

- One hand instead of a game to 500 — keeps a game around 10 minutes (D-05). With a
  single hand there is no 10-bag penalty, so bags are simply +1 each; the bots and the
  lesson still teach avoiding bags (because that is what matters in a full game), but
  only once the hand is safely decided — while the score is close, every extra trick is
  a point.
- No Blind Nil, no jokers, no minimum bid — fewer rules for a first game; all mentioned
  in the Variants note.

**Popular alternatives (Variants note)**

- Full game to 500 points (sometimes also ending at −200); every 10 bags costs 100.
- Blind Nil (±200), Big/Little Jokers as top trumps, minimum team bid of 4,
  "Suicide" Spades (one partner per team must bid Nil).
- A Nil bidder's tricks counting toward the partner's bid.
- 2- and 3-player "cutthroat" Spades without partnerships.

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
  is an Eight it is **buried** at a random spot in the bottom half of the stock (index ≥
  stock length ÷ 2, never the exact middle) and the next card is turned instead (repeat if
  needed — the starter is the first non-Eight after the deal, and the other stock cards keep
  their order). Buried Eights are public (`state.buried`).
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
  player seems to lack); draws only when it has nothing to play. In simulations (3,000
  games each, seat 0 against bots) normal beats easy at every table size: heads-up 58 % vs
  49 % against easy bots and 50 % vs 42 % against normal bots; with 3 players 40 % vs 34 %
  and 33 % vs 28 %; with 4 players 32 % vs 27 % and 26 % vs 21 %.
- The **coach** suggests exactly the normal bot's move and explains it in plain words (only
  from what the learner can see).

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
- `luckyLastCard` — the learner won, their final book was completed by fishing their wish
  (book `via: 'wish'`), **and that book decided the game**: without it the learner would
  not have won outright (final margin over the best opponent ≤ 1 book). A wished final
  book in a game won comfortably is not "the decisive card". Tag `luckyFinalBook` records
  the wished final book win or lose.
- `perfect` — a landslide: the learner made more books than all the opponents together
  (≥ 7 of 13, which always means a sole win). Heads-up that would be _every_ win (7–6 is
  the closest possible finish), so with 2 players it takes at least twice the opponent's
  books: ≥ 9 (`perfectBooksFor(players)`).
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
  the cards it cannot place), nudged towards ranks it holds more of. It never makes an ask
  the history shows must fail (for example asking a player again for the rank it just took
  from them) while any other ask could still work; when every ask must fail it asks for
  the rank whose unseen copies must all be in the pond, i.e. its best chance to fish its
  wish. The coach gives the same advice and says honestly when an ask is a sure miss. The
  simulation checks at every step that this memory is sound (proven ≤ actual ≤ proven +
  possible). Measured over 600 seeded games each: heads-up, a normal learner beats an easy
  bot about 65 % of the time (an easy learner beats a normal bot about 41 %); with 3
  players a normal learner beats two easy bots about 89 % of the time (easy vs two normal:
  about 6 %).

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
- Result flags follow `docs/engine-notes/go-fish.md`, tightened where the literal note
  would mislabel a game: `perfect` needs 9 books heads-up (7 is any heads-up win) and
  `luckyLastCard` needs the wished final book to have decided the game.

**Popular alternatives (Variants note)**

- Pairs instead of books of four, for very young children.
- Ending the game when the pond runs out or when the first player runs out of cards.
- Dealing 5 cards even for two players; drawing five new cards when your hand empties.
- Passing the turn after every ask, even after a catch.
- Happy Families and Quartett: the same idea with special picture decks.

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

### Klondike Solitaire — rules draft

Engine: `src/games/klondike/engine.ts` (rules core `rules.ts`, bots/coach `strategy.ts`).
Content: `content/games/klondike.ts`.

#### Variant taught

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

#### Decisions and simplifications (and why)

| Decision                                                 | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Draw-1, unlimited passes                                 | The friendliest common setting: every stock card is reachable on every pass, so beginners are never cut off. Draw-3 and limited passes are described in Variants.                                                                                                                                                                                                                                                                                                                      |
| Vegas-style payout with unlimited passes                 | `docs/RULES_DECISIONS.md` keeps Vegas money (5/52 of the stake per card home) for the Jeet bet but not the casino's pass limit. With good play this is generous (see "Balance" below).                                                                                                                                                                                                                                                                                                 |
| Automatic flip of the uncovered face-down card           | Every modern app does it; flipping by hand is never a decision. It happens inside the move that uncovers it (no separate move).                                                                                                                                                                                                                                                                                                                                                        |
| No undo                                                  | Matches a real deck and keeps the payout honest. The coach and "I'm done" cover being stuck.                                                                                                                                                                                                                                                                                                                                                                                           |
| Resign is always legal                                   | The rules decision "the learner may resign at any time"; it is the only way to end a stuck deal (the engine never ends a game on its own unless it is cleared).                                                                                                                                                                                                                                                                                                                        |
| Pointless moves stay legal                               | e.g. shuffling a King between empty columns. The engine lists every legal move; the coach and bots simply never choose them.                                                                                                                                                                                                                                                                                                                                                           |
| Malformed or impossible moves are explained, not ignored | Every illegal attempt gets a specific, beginner-friendly reason (e.g. "A red 7 must go on a black 8 — the Eight of Diamonds is red too…", "Only a King can go into an empty column…", "Foundations take one card at a time…"). Reasons never claim a card is ready to go home when it isn't, an Ace refused in the columns is pointed to its foundation, and no reason depends on a hidden card. A tableau source `index` < 0 means "a face-down card" so the UI can let learners try. |

#### Betting (Vegas-style)

- Stake = Jeet per unit, `maxLossUnits` 1 (escrowed before the deal, D-04).
- `humanNetUnits = 5 × foundationCards ÷ 52 − 1`: 0 cards → −1, 10 cards → −0.04,
  **11 cards → +0.06 (first profitable count)**, 26 → +1.5, 52 → **+4** (five times the stake
  back).
- `humanOutcome`: **win** if the board is cleared or the net is positive (11+ cards), else
  **loss**. Never a push (no card count gives exactly 0).
- `scores: [foundationCards]`; `winners: [0]` on a win, else `[]`.

#### Result flags

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

#### Bots and coach

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

#### Verification

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

#### Balance (simulation, 1,200 seeded games)

- normal bot: clears ≈ 38% of deals, wins (11+ cards) ≈ 58%, average ≈ 26 cards home,
  ≈ +1.5 units per game.
- easy bot: clears ≈ 9%, wins ≈ 40%, average ≈ 13 cards home, ≈ +0.3 units per game.
- So with unlimited passes, Vegas-style Klondike is a _positive_ game for a careful player.
  If the economy needs it to be tougher, the casino rule (a single pass through the stock)
  would be the standard lever; we did not apply it because the rules decision says unlimited.

#### Popular alternatives (for the Variants note)

- **Draw-3**: three cards turned at a time, only the top one playable.
- **Casino Vegas**: one pass (Draw-1) or three passes (Draw-3), $52 per deck, $5 per card.
- **Standard scoring** in apps (e.g. 10 points per foundation card, time bonus) and undo.
- **Thoughtful solitaire**: all cards dealt face up.
- Cousins: FreeCell, Spider Solitaire.
