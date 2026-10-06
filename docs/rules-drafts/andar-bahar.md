# Andar Bahar — rules draft

Engine: `src/games/andar-bahar/engine.ts` (Tier 1; exact odds in `rules.ts`).
Content: `content/games/andar-bahar.ts`.

## Variant taught

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

## Decisions and simplifications (and why)

| Decision                                   | Why                                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First card always to Andar                 | One fixed rule is easiest to teach and matches the most common convention behind the 0.9 / 1 payouts. Tables that switch the starting side are mentioned in Variants. |
| Andar 0.9:1, Bahar 1:1                     | The common casino convention: the side that gets the first card wins slightly more often, so it pays slightly less. It also gives a clear, honest lesson in odds.     |
| Learner sees the joker before betting      | Standard order of play; it makes the bet feel connected to the card being hunted (it doesn't change the odds — every rank gives the same 51.5% / 48.5%).              |
| Single deck, fresh shuffle every deal      | Keeps every deal independent, which is the key beginner lesson ("the cards have no memory").                                                                          |
| No side bets                               | Extra bets on the number of cards dealt add complexity without teaching anything about the game. Mentioned in Variants.                                               |
| One learner vs the dealer                  | Andar Bahar has no interaction between bettors, so extra bot bettors would add nothing.                                                                               |
| Dealing is one forced dealer move per card | Lets the UI animate each card landing; the dealer has no choices.                                                                                                     |

## Odds (exact)

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

## Betting

- Stake options 10/25/50/100/250, `maxLossUnits` 1.
- `humanNetUnits`: +0.9 (Andar win), +1 (Bahar win), −1 (loss). No optional extra
  commitments, so `affordableUnits` has no effect.

## Result flags

- `luckyLastCard`: the match came on the very first card, or after at least 25 cards were
  dealt without one (card 26 or later — the long nail-biter).
- `closeFinish`: the match came within the first 3 cards.
- `tags`: `andar-wins` / `bahar-wins`, `first-card-match`, `long-deal` (card 26+).
- `bigPot`, `comeback`, `perfect`, `bust`, `folded`: never (single unit, no decisions after
  the bet).

## Coach and bots

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

## Popular alternatives (Variants note)

- Tables that start with **Bahar**, or change the starting side from deal to deal — the
  side that gets the first card is then the one paid a little less.
- **Side bets** on how many cards are dealt before the match (1–5, 6–10, …).
- Friendly **home games** that pay both sides 1 to 1 and rotate the dealer.
- Regional names: Katti; Mankatha in Tamil Nadu.
