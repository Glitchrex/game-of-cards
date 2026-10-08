/**
 * Exact Baccarat odds, computed — not simulated — by walking every possible coup.
 *
 * A coup uses at most six cards, and only their VALUES matter (0–9; the 0 group holds the
 * 10s and picture cards, so it is four times as common). For a shoe of `decks` complete
 * decks, `computeCoupOdds` enumerates the values of the cards in deal order — Player,
 * Banker, Player, Banker, then the third cards the tableau calls for — weighting each
 * branch by the exact probability of drawing those values without replacement. That is
 * at most 10⁶ leaves (about 300,000 in practice).
 *
 * That walk takes several milliseconds (more on a phone), so the engine and coach read the
 * results from `COUP_ODDS`, a table produced by `computeCoupOdds` for every shoe size; the
 * tests recompute it and check every entry. For the 8-deck shoe taught here it gives the
 * well-known figures: Banker wins 45.86% of coups, Player 44.62% and Tie 9.52%, so the
 * house edge is about 1.06% on Banker, 1.24% on Player and 14.4% on Tie.
 */
import {
  BETS,
  bankerDraws,
  MAX_DECKS,
  MIN_DECKS,
  NATURAL_MIN,
  netUnits,
  playerDraws,
  type BetOn,
  type CoupWinner,
} from './rules';

/** Probability of each way a coup can end (they sum to 1). */
export type CoupOdds = Readonly<Record<CoupWinner, number>>;

const OUTCOMES: readonly CoupWinner[] = ['player', 'banker', 'tie'];

function checkDecks(decks: number): void {
  if (!Number.isInteger(decks) || decks < MIN_DECKS || decks > MAX_DECKS) {
    throw new RangeError(
      `Baccarat: a shoe holds a whole number of decks from ${MIN_DECKS} to ${MAX_DECKS} ` +
        `(got ${decks}).`,
    );
  }
}

/**
 * Exact chance of a Player win, a Banker win and a tie for a freshly shuffled shoe of
 * `decks` complete decks, by exhaustive enumeration (see the file comment).
 */
export function computeCoupOdds(decks: number): CoupOdds {
  checkDecks(decks);
  // counts[v] = cards of value v left: 16 per deck for 0 (10, J, Q, K), 4 for 1–9.
  const counts = Array.from({ length: 10 }, (_, v) => (v === 0 ? 16 : 4) * decks);
  let left = 52 * decks;
  const won: Record<CoupWinner, number> = { player: 0, banker: 0, tie: 0 };

  const tally = (weight: number, p: number, b: number) => {
    won[p > b ? 'player' : b > p ? 'banker' : 'tie'] += weight;
  };

  /** Call `next(value, weight × P(value))` for every value still in the shoe. */
  const draw = (weight: number, next: (value: number, w: number) => void) => {
    for (let v = 0; v < 10; v++) {
      const n = counts[v] ?? 0;
      if (n === 0) continue;
      const w = (weight * n) / left;
      counts[v] = n - 1;
      left--;
      next(v, w);
      left++;
      counts[v] = n;
    }
  };

  const thirdCards = (w: number, p: number, b: number) => {
    if (p >= NATURAL_MIN || b >= NATURAL_MIN) return tally(w, p, b);
    if (playerDraws(p)) {
      draw(w, (p3, w5) => {
        const pt = (p + p3) % 10;
        if (bankerDraws(b, p3)) draw(w5, (b3, w6) => tally(w6, pt, (b + b3) % 10));
        else tally(w5, pt, b);
      });
    } else if (bankerDraws(b, null)) {
      draw(w, (b3, w5) => tally(w5, p, (b + b3) % 10));
    } else {
      tally(w, p, b);
    }
  };

  draw(1, (p1, w1) =>
    draw(w1, (b1, w2) =>
      draw(w2, (p2, w3) => draw(w3, (b2, w4) => thirdCards(w4, (p1 + p2) % 10, (b1 + b2) % 10))),
    ),
  );
  return { ...won };
}

/** `computeCoupOdds(decks)` for every shoe size the engine supports (verified by the tests). */
export const COUP_ODDS: Readonly<Record<number, CoupOdds>> = {
  1: { player: 0.4467604303041842, banker: 0.459624155172192, tie: 0.0936154145237083 },
  2: { player: 0.4465081508226471, banker: 0.45907273455192, tie: 0.09441911462598594 },
  3: { player: 0.44639923768141876, banker: 0.45886775632961063, tie: 0.09473300598851336 },
  4: { player: 0.44634034988184745, banker: 0.4587614762010986, tie: 0.09489817391763236 },
  5: { player: 0.4463036260180225, banker: 0.4586965166861864, tie: 0.09499985729545665 },
  6: { player: 0.4462785698392909, banker: 0.45865271882579817, tie: 0.09506871133581417 },
  7: { player: 0.4462603934991566, banker: 0.4586211954232446, tie: 0.09511841107627667 },
  8: { player: 0.44624660934317073, banker: 0.4585974226322891, tie: 0.09515596802363396 },
};

/** Exact chance of each coup outcome for a fresh `decks`-deck shoe (table lookup). */
export function coupOdds(decks: number): CoupOdds {
  checkDecks(decks);
  const odds = COUP_ODDS[decks];
  if (!odds) throw new RangeError(`Baccarat: no odds for a ${decks}-deck shoe.`);
  return odds;
}

/** Average net stake units per coup for a bet (negative: the bet loses this much on average). */
export function expectedNet(bet: BetOn, odds: CoupOdds): number {
  let ev = 0;
  for (const w of OUTCOMES) ev += odds[w] * netUnits(bet, w);
  return ev;
}

/** The house edge on each bet: the share of every bet the house keeps on average. */
export function houseEdges(decks: number): Readonly<Record<BetOn, number>> {
  const odds = coupOdds(decks);
  const out: Record<BetOn, number> = { player: 0, banker: 0, tie: 0 };
  for (const bet of BETS) out[bet] = -expectedNet(bet, odds);
  return out;
}

/** The bet with the smallest house edge for this shoe (Banker, for every shoe size). */
export function bestBet(decks: number): BetOn {
  const edges = houseEdges(decks);
  let best: BetOn = 'banker';
  for (const bet of BETS) if (edges[bet] < edges[best]) best = bet;
  return best;
}

/** "45.86%" / "9.5%" — a probability or edge as a percentage with `digits` decimals. */
export function percent(p: number, digits = 2): string {
  return `${(p * 100).toFixed(digits)}%`;
}
