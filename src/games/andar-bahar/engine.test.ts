import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, type CardCode } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError, type Difficulty, type GameConfig } from '@/games/core/types';
import engine, {
  andarBaharEngine,
  bestSide,
  cardsDealt,
  DEALER,
  dealtInOrder,
  lastDealt,
  LEARNER,
  MAX_DEAL_LENGTH,
  MAX_GAME_MOVES,
  MAX_LOSS_UNITS,
  matchesJoker,
  matchingCard,
  nextSide,
  percent,
  settle,
  setupWithDeck,
  STOCK_SIZE,
  winChances,
  type AndarBaharMove,
  type AndarBaharState,
  type Side,
} from './engine';

// ------------------------------------------------------------------ helpers

const CONFIG: GameConfig = { players: 2 };
const BET_ANDAR: AndarBaharMove = { type: 'bet', side: 'andar' };
const BET_BAHAR: AndarBaharMove = { type: 'bet', side: 'bahar' };
const DEAL: AndarBaharMove = { type: 'deal' };
const bet = (side: Side): AndarBaharMove => ({ type: 'bet', side });

/**
 * A complete deck with `joker` turned up and `sequence` dealt first, in order (Andar,
 * Bahar, Andar, …). The rest of the deck follows in a fixed order.
 */
function deckWith(joker: CardCode, sequence: CardCode[]): CardCode[] {
  const used = new Set<CardCode>([joker, ...sequence]);
  return [joker, ...sequence, ...makeDeck().filter((c) => !used.has(c))];
}

/** A game in the 'bet' phase with a stacked deck. */
function table(joker: CardCode, sequence: CardCode[]): AndarBaharState {
  return setupWithDeck(CONFIG, deckWith(joker, sequence));
}

function dealTimes(state: AndarBaharState, n: number): AndarBaharState {
  let s = state;
  for (let i = 0; i < n; i++) s = engine.applyMove(s, DEAL);
  return s;
}

function dealOut(state: AndarBaharState): AndarBaharState {
  let s = state;
  while (!engine.isOver(s)) s = engine.applyMove(s, DEAL);
  return s;
}

/** Play a stacked deal to the end with the learner on `side`. */
function finished(joker: CardCode, sequence: CardCode[], side: Side): AndarBaharState {
  return dealOut(engine.applyMove(table(joker, sequence), bet(side)));
}

/** Non-matching filler for the Seven-of-Hearts joker (no Sevens). */
const FILLER: CardCode[] = makeDeck().filter((c) => c[0] !== '7');

/** The match (7S) is card `n` (1-based); everything before it is filler. */
function matchOnCard(n: number, side: Side = 'andar'): AndarBaharState {
  return finished('7H', [...FILLER.slice(0, n - 1), '7S'], side);
}

const keys = (moves: AndarBaharMove[]) => moves.map((m) => engine.moveKey(m));

/** Every move a learner or the dealer could attempt (plus malformed ones). */
const CANDIDATES: AndarBaharMove[] = [BET_ANDAR, BET_BAHAR, DEAL];

function seededGame(seed: number, difficulty: Difficulty = 'normal'): AndarBaharState[] {
  const states: AndarBaharState[] = [];
  let s = engine.setup(CONFIG, createRng(seed));
  const rng = createRng(`bots-${seed}`);
  states.push(s);
  while (!engine.isOver(s)) {
    const p = engine.currentPlayer(s)!;
    s = engine.applyMove(s, engine.botMove(s, p, difficulty, rng));
    states.push(s);
  }
  return states;
}

// -------------------------------------------------------------------- setup

describe('setup', () => {
  it('turns up the top card as the joker and keeps the other 51 face down', () => {
    const s = engine.setup(CONFIG, createRng(1));
    expect(engine.id).toBe('andar-bahar');
    expect(andarBaharEngine).toBe(engine);
    expect(s.stock).toHaveLength(STOCK_SIZE);
    expect(new Set([s.joker, ...s.stock]).size).toBe(52);
    expect([s.joker, ...s.stock].sort()).toEqual(makeDeck().sort());
    expect(s.andar).toEqual([]);
    expect(s.bahar).toEqual([]);
    expect(s.bet).toBeNull();
    expect(s.winner).toBeNull();
    expect(s.phase).toBe('bet');
    expect(engine.currentPlayer(s)).toBe(LEARNER);
    expect(engine.isOver(s)).toBe(false);
    // Exactly three cards of the joker's rank are left to find.
    expect(s.stock.filter((c) => matchesJoker(s, c))).toHaveLength(3);
  });

  it('uses the rng to shuffle: the deck is the seeded Fisher–Yates order', () => {
    const s = engine.setup(CONFIG, createRng('x'));
    const deck = shuffle(makeDeck(), createRng('x'));
    expect([s.joker, ...s.stock]).toEqual(deck);
  });

  it('is deterministic: the same seed gives the same deal, different seeds differ', () => {
    expect(engine.setup(CONFIG, createRng(42))).toEqual(engine.setup(CONFIG, createRng(42)));
    const jokers = new Set(
      Array.from({ length: 40 }, (_, i) => engine.setup(CONFIG, createRng(i)).joker),
    );
    expect(jokers.size).toBeGreaterThan(10);
  });

  it('needs exactly two seats: the learner and the dealer', () => {
    for (const players of [0, 1, 3, 6]) {
      expect(() => engine.setup({ players }, createRng(1))).toThrow(RangeError);
      expect(() => engine.setup({ players }, createRng(1))).toThrow(/exactly 2 seats/);
    }
  });

  it('ignores affordableUnits and unknown options (there are no extra bets)', () => {
    const base = engine.setup(CONFIG, createRng(9));
    expect(engine.setup({ players: 2, affordableUnits: 0 }, createRng(9))).toEqual(base);
    expect(engine.setup({ players: 2, options: { foo: 1 } }, createRng(9))).toEqual(base);
  });

  it('setupWithDeck keeps the deck order: deck[0] is the joker, deck[1] goes to Andar', () => {
    const deck = deckWith('QD', ['5C', 'JH']);
    const s = setupWithDeck(CONFIG, deck);
    expect(s.joker).toBe('QD');
    expect(s.stock).toEqual(deck.slice(1));
    expect(s.stock[0]).toBe('5C');
  });

  it('setupWithDeck rejects anything but one complete 52-card deck', () => {
    const deck = makeDeck();
    expect(() => setupWithDeck(CONFIG, deck.slice(1))).toThrow(RangeError);
    expect(() => setupWithDeck(CONFIG, [...deck.slice(1), deck[1]!])).toThrow(RangeError);
    expect(() => setupWithDeck(CONFIG, [...deck.slice(1), 'X1'])).toThrow(RangeError);
    expect(() => setupWithDeck(CONFIG, [...deck, ...deck])).toThrow(RangeError);
    expect(() => setupWithDeck({ players: 3 }, deck)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------- turns and moves

describe('turns and legal moves', () => {
  it('bet phase: only the learner acts, choosing Andar or Bahar', () => {
    const s = table('7H', []);
    expect(keys(engine.legalMoves(s, LEARNER))).toEqual(['bet:andar', 'bet:bahar']);
    expect(engine.legalMoves(s, DEALER)).toEqual([]);
  });

  it('deal phase: the dealer has exactly one forced move, the learner none', () => {
    const s = engine.applyMove(table('7H', []), BET_BAHAR);
    expect(s.phase).toBe('deal');
    expect(engine.currentPlayer(s)).toBe(DEALER);
    expect(engine.legalMoves(s, DEALER)).toEqual([DEAL]);
    expect(engine.legalMoves(s, LEARNER)).toEqual([]);
  });

  it('when the deal is over nobody can move and currentPlayer is null', () => {
    const s = matchOnCard(5);
    expect(engine.isOver(s)).toBe(true);
    expect(engine.currentPlayer(s)).toBeNull();
    expect(engine.legalMoves(s, LEARNER)).toEqual([]);
    expect(engine.legalMoves(s, DEALER)).toEqual([]);
  });

  it('seats that do not exist never get moves', () => {
    const s = table('7H', []);
    expect(engine.legalMoves(s, 2)).toEqual([]);
    expect(engine.legalMoves(s, -1)).toEqual([]);
  });

  it('legalMoves and checkMove always agree, and currentPlayer is null iff over', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const s of seededGame(seed, seed % 2 ? 'easy' : 'normal')) {
        expect(engine.currentPlayer(s) === null).toBe(engine.isOver(s));
        for (const p of [LEARNER, DEALER, 2]) {
          const legal = new Set(keys(engine.legalMoves(s, p)));
          for (const m of CANDIDATES) {
            expect(engine.checkMove(s, p, m).ok, `${seed} p${p} ${engine.moveKey(m)}`).toBe(
              legal.has(engine.moveKey(m)),
            );
          }
        }
      }
    }
  });
});

// ------------------------------------------------------------ friendly whys

describe('checkMove explains every illegal move', () => {
  const betting = table('7H', ['3C', 'KD']);
  const dealing = engine.applyMove(betting, BET_ANDAR);
  const over = matchOnCard(4);

  const reason = (s: AndarBaharState, p: number, m: unknown) => {
    const check = engine.checkMove(s, p, m as AndarBaharMove);
    expect(check.ok).toBe(false);
    return check.reason ?? '';
  };

  it('a move that is not an Andar Bahar move', () => {
    for (const m of [{ type: 'hit' }, {}, null, 'deal', { side: 'andar' }]) {
      expect(reason(betting, LEARNER, m)).toMatch(/isn’t an Andar Bahar move/);
    }
  });

  it('a seat that is not at the table', () => {
    expect(reason(betting, 3, BET_ANDAR)).toBe(
      'There’s no Player 3 at this table — it’s just you and the dealer.',
    );
  });

  it('a bet on a side that does not exist', () => {
    expect(reason(betting, LEARNER, { type: 'bet', side: 'middle' })).toBe(
      'Pick a side to bet on: Andar (inside) or Bahar (outside).',
    );
    expect(reason(betting, LEARNER, { type: 'bet' })).toMatch(/Pick a side/);
  });

  it('the dealer trying to bet', () => {
    expect(reason(betting, DEALER, BET_ANDAR)).toMatch(/dealer never bets/);
    expect(reason(dealing, DEALER, BET_BAHAR)).toMatch(/dealer never bets/);
  });

  it('betting again on the same side once the dealing has started', () => {
    expect(reason(dealing, LEARNER, BET_ANDAR)).toBe(
      'Your bet on Andar is already placed and the dealing has started — now just watch for a Seven.',
    );
  });

  it('switching sides once the dealing has started', () => {
    expect(reason(dealing, LEARNER, BET_BAHAR)).toBe(
      'Bets are locked once the dealing starts, so you can’t switch from Andar to Bahar now. Watch for a Seven!',
    );
  });

  it('a malformed bet once the dealing has started is told the bet is locked', () => {
    // Not "Pick a side…" — that would invite a bet that can no longer be placed.
    for (const m of [{ type: 'bet', side: 'middle' }, { type: 'bet' }]) {
      expect(reason(dealing, LEARNER, m)).toBe(
        'Your bet on Andar is already placed and the dealing has started — now just watch for a Seven.',
      );
    }
  });

  it('the dealer is told it never bets, whatever side it names', () => {
    for (const s of [betting, dealing]) {
      expect(reason(s, DEALER, { type: 'bet', side: 'middle' })).toMatch(/dealer never bets/);
      expect(reason(s, DEALER, { type: 'bet' })).toMatch(/dealer never bets/);
    }
  });

  it('the learner trying to deal, before and after betting', () => {
    expect(reason(betting, LEARNER, DEAL)).toMatch(
      /You don’t deal the cards — the dealer does, and only after you’ve placed your bet/,
    );
    expect(reason(dealing, LEARNER, DEAL)).toBe(
      'The dealer deals every card for you, one at a time — just watch where the next Seven lands.',
    );
  });

  it('the dealer trying to deal before the bet', () => {
    expect(reason(betting, DEALER, DEAL)).toBe(
      'The dealer waits for your bet: no card is dealt until you’ve picked Andar or Bahar.',
    );
  });

  it('any move once the deal is over names the matching card', () => {
    for (const [p, m] of [
      [LEARNER, BET_ANDAR],
      [LEARNER, DEAL],
      [DEALER, DEAL],
    ] as const) {
      expect(reason(over, p, m)).toBe(
        'This deal is over — the Seven of Spades matched the joker on Bahar. Start a new game to play again.',
      );
    }
  });

  it('applyMove throws IllegalMoveError (with the reason) for illegal moves', () => {
    expect(() => engine.applyMove(betting, DEAL)).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(betting, DEAL)).toThrow(/You don’t deal the cards/);
    // applyMove acts for the current player — the dealer, who never bets.
    expect(() => engine.applyMove(dealing, BET_BAHAR)).toThrow(/dealer never bets/);
    expect(() =>
      engine.applyMove(betting, { type: 'bet', side: 'up' } as unknown as AndarBaharMove),
    ).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(over, DEAL)).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(over, DEAL)).toThrow(/already over/);
  });
});

// ----------------------------------------------------------------- dealing

describe('placing the bet and dealing', () => {
  it('the bet records the side and starts the deal without dealing a card', () => {
    const s = engine.applyMove(table('7H', []), BET_BAHAR);
    expect(s.bet).toBe('bahar');
    expect(s.phase).toBe('deal');
    expect(cardsDealt(s)).toBe(0);
    expect(s.stock).toHaveLength(STOCK_SIZE);
  });

  it('cards alternate one at a time, starting with Andar, from the top of the stock', () => {
    let s = engine.applyMove(table('7H', ['3C', 'KD', '2S', '9H', '7D']), BET_ANDAR);
    const sides: Side[] = [];
    for (let i = 0; i < 4; i++) {
      sides.push(nextSide(s));
      const top = s.stock[0];
      s = engine.applyMove(s, DEAL);
      expect(lastDealt(s)).toEqual({ card: top, side: sides[i], number: i + 1 });
      expect(s.stock).toHaveLength(STOCK_SIZE - i - 1);
      expect(s.phase).toBe('deal');
    }
    expect(sides).toEqual(['andar', 'bahar', 'andar', 'bahar']);
    expect(s.andar).toEqual(['3C', '2S']);
    expect(s.bahar).toEqual(['KD', '9H']);
    expect(dealtInOrder(s).map((d) => d.card)).toEqual(['3C', 'KD', '2S', '9H']);
    // Card 5 is a Seven: it lands on Andar and ends the deal.
    s = engine.applyMove(s, DEAL);
    expect(s.andar).toEqual(['3C', '2S', '7D']);
    expect(s.phase).toBe('over');
    expect(s.winner).toBe('andar');
    expect(matchingCard(s)).toBe('7D');
  });

  it('a match on the very first card wins for Andar at once', () => {
    const s = finished('KC', ['KH'], 'andar');
    expect(cardsDealt(s)).toBe(1);
    expect(s.andar).toEqual(['KH']);
    expect(s.bahar).toEqual([]);
    expect(s.winner).toBe('andar');
  });

  it('a match on the second card wins for Bahar', () => {
    const s = finished('KC', ['4D', 'KS'], 'andar');
    expect(s.bahar).toEqual(['KS']);
    expect(s.winner).toBe('bahar');
  });

  it('only the rank matters: a card of the joker’s suit is not a match', () => {
    const s = finished('7H', ['8H', '2H', 'AH', '7C'], 'bahar');
    expect(cardsDealt(s)).toBe(4);
    expect(s.winner).toBe('bahar');
    expect(matchingCard(s)).toBe('7C');
  });

  it('the deal stops at the FIRST match even though two more are still in the stock', () => {
    const s = finished('9S', ['3D', '9H', '9D', '9C'], 'bahar');
    expect(s.winner).toBe('bahar');
    expect(cardsDealt(s)).toBe(2);
    expect(s.stock).toContain('9D');
    expect(s.stock).toContain('9C');
  });

  it('the longest possible deal: all three matches at the bottom → card 49 decides', () => {
    const sevens: CardCode[] = ['7S', '7D', '7C'];
    const s = finished('7H', [...FILLER, ...sevens], 'andar');
    expect(cardsDealt(s)).toBe(MAX_DEAL_LENGTH);
    expect(MAX_DEAL_LENGTH).toBe(49);
    expect(s.winner).toBe('andar');
    expect(s.stock).toEqual(['7D', '7C']);
    expect(MAX_GAME_MOVES).toBe(50);
  });

  it('dealing never changes the bet or the joker', () => {
    const start = engine.applyMove(table('5C', []), BET_BAHAR);
    const end = dealOut(start);
    expect(end.bet).toBe('bahar');
    expect(end.joker).toBe('5C');
  });
});

describe('purity', () => {
  it('applyMove never mutates its (deep-frozen) input', () => {
    let s = deepFreeze(table('7H', ['3C', 'KD', '7S']));
    const before = JSON.stringify(s);
    const next = engine.applyMove(s, BET_ANDAR);
    expect(JSON.stringify(s)).toBe(before);
    expect(next).not.toBe(s);
    s = deepFreeze(next);
    for (let i = 0; i < 3; i++) {
      const snapshot = JSON.stringify(s);
      const after = deepFreeze(engine.applyMove(s, DEAL));
      expect(JSON.stringify(s)).toBe(snapshot);
      s = after;
    }
    expect(engine.isOver(s)).toBe(true);
  });

  it('states are plain JSON', () => {
    const s = dealTimes(engine.applyMove(engine.setup(CONFIG, createRng(5)), BET_ANDAR), 2);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('the same seed and bot rng replay the identical game', () => {
    for (const seed of [1, 2, 3, 99]) {
      expect(seededGame(seed, 'easy')).toEqual(seededGame(seed, 'easy'));
      expect(seededGame(seed, 'normal')).toEqual(seededGame(seed, 'normal'));
    }
  });
});

// ------------------------------------------------------------ payouts

describe('result and payouts', () => {
  it('a winning Andar bet pays 0.9 to 1', () => {
    const r = engine.result(finished('QD', ['5C', 'JH', 'QS'], 'andar'));
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(0.9);
    expect(r.winners).toEqual([LEARNER]);
    expect(r.summary).toBe(
      'The Queen of Spades matched the joker on Andar as card 3 — your Andar bet wins 0.9 to 1!',
    );
  });

  it('a winning Bahar bet pays 1 to 1', () => {
    const r = engine.result(finished('QD', ['5C', 'JH', '2S', 'QC'], 'bahar'));
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(1);
    expect(r.winners).toEqual([LEARNER]);
    expect(r.summary).toBe(
      'The Queen of Clubs matched the joker on Bahar as card 4 — your Bahar bet wins 1 to 1!',
    );
  });

  it('a losing Andar bet loses its one unit', () => {
    const r = engine.result(finished('QD', ['5C', 'QH'], 'andar'));
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBe(-1);
    expect(r.winners).toEqual([DEALER]);
    expect(r.summary).toBe(
      'The Queen of Hearts matched the joker on Bahar as card 2, so your Andar bet loses.',
    );
  });

  it('a losing Bahar bet loses its one unit', () => {
    const r = engine.result(finished('QD', ['QH'], 'bahar'));
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBe(-1);
    expect(r.winners).toEqual([DEALER]);
    expect(r.summary).toBe(
      'The very first card, the Queen of Hearts, matched the joker on Andar, so your Bahar bet loses.',
    );
  });

  it('a long deal gets a “long wait” summary', () => {
    expect(engine.result(matchOnCard(30, 'bahar')).summary).toBe(
      'After a long wait, the Seven of Spades matched the joker on Bahar as card 30 — your Bahar bet wins 1 to 1!',
    );
  });

  it('there are no pushes, and the loss never exceeds the one escrowed unit', () => {
    for (let n = 1; n <= MAX_DEAL_LENGTH; n++) {
      for (const side of ['andar', 'bahar'] as const) {
        const r = engine.result(matchOnCard(n, side));
        expect(r.humanOutcome).not.toBe('push');
        expect(r.humanNetUnits).toBeGreaterThanOrEqual(-MAX_LOSS_UNITS);
        expect(r.humanNetUnits).toBeLessThanOrEqual(1);
        const sideWon = n % 2 === 1 ? 'andar' : 'bahar';
        expect(r.humanNetUnits).toBe(side === sideWon ? (side === 'andar' ? 0.9 : 1) : -1);
      }
    }
  });

  it('settle() reports the facts behind the payout', () => {
    expect(settle(matchOnCard(6, 'bahar'))).toEqual({
      bet: 'bahar',
      winner: 'bahar',
      won: true,
      net: 1,
      matchingCard: '7S',
      matchNumber: 6,
    });
  });

  it('result() and settle() refuse to settle an unfinished deal', () => {
    const betting = table('7H', []);
    expect(() => engine.result(betting)).toThrow(/not over/);
    expect(() => engine.result(engine.applyMove(betting, BET_ANDAR))).toThrow(/not over/);
    expect(() => settle(betting)).toThrow(/not over/);
  });
});

describe('result flags', () => {
  const flags = (n: number, side: Side = 'andar') => engine.result(matchOnCard(n, side)).flags;

  it('a first-card match is a lucky last card, a close finish and tagged first-card-match', () => {
    for (const side of ['andar', 'bahar'] as const) {
      const f = flags(1, side);
      expect(f.luckyLastCard).toBe(true);
      expect(f.closeFinish).toBe(true);
      expect(f.tags).toEqual(['andar-wins', 'first-card-match']);
    }
  });

  it('a match on card 2 or 3 is a close finish only', () => {
    expect(flags(2)).toMatchObject({ closeFinish: true, luckyLastCard: false });
    expect(flags(2).tags).toEqual(['bahar-wins']);
    expect(flags(3)).toMatchObject({ closeFinish: true, luckyLastCard: false });
  });

  it('an ordinary deal has no story flags', () => {
    for (const n of [4, 13, 25]) {
      expect(flags(n)).toMatchObject({ closeFinish: false, luckyLastCard: false });
    }
  });

  it('25 or more cards before the match (card 26+) is the long nail-biter', () => {
    expect(flags(25).luckyLastCard).toBe(false); // 24 cards before the match
    expect(flags(26)).toMatchObject({ luckyLastCard: true, closeFinish: false });
    expect(flags(26).tags).toEqual(['bahar-wins', 'long-deal']);
    expect(flags(49).luckyLastCard).toBe(true);
  });

  it('flags that cannot happen in Andar Bahar are always false', () => {
    for (let n = 1; n <= MAX_DEAL_LENGTH; n++) {
      const f = flags(n, n % 3 === 0 ? 'bahar' : 'andar');
      expect(f.bigPot).toBe(false);
      expect(f.comeback).toBe(false);
      expect(f.perfect).toBe(false);
      expect(f.bust).toBe(false);
      expect(f.folded).toBe(false);
    }
  });
});

// ------------------------------------------------------------------- bots

describe('bots', () => {
  const rng = () => createRng('bot-test');

  it('the dealer bot always deals, at either difficulty', () => {
    const s = engine.applyMove(table('7H', []), BET_ANDAR);
    expect(engine.botMove(s, DEALER, 'easy', rng())).toEqual(DEAL);
    expect(engine.botMove(s, DEALER, 'normal', rng())).toEqual(DEAL);
  });

  it('normal picks Andar, the side with the smaller average loss', () => {
    for (let seed = 0; seed < 30; seed++) {
      const s = engine.setup(CONFIG, createRng(seed));
      expect(engine.botMove(s, LEARNER, 'normal', rng())).toEqual(BET_ANDAR);
    }
    expect(bestSide()).toBe('andar');
  });

  it('normal is never worse than easy: exact average results, settled by the engine itself', () => {
    // Weight each first-match position k by how many of the C(51, 3) = 20,825 equally likely
    // placements of the three matches have their first one there: C(51 − k, 2).
    const weight = (k: number) => ((STOCK_SIZE - k) * (STOCK_SIZE - k - 1)) / 2;
    const average = (side: Side) => {
      let total = 0;
      let net = 0;
      for (let k = 1; k <= MAX_DEAL_LENGTH; k++) {
        total += weight(k);
        net += weight(k) * engine.result(matchOnCard(k, side)).humanNetUnits;
      }
      expect(total).toBe(20_825);
      return net / total;
    };
    const andar = average('andar');
    const bahar = average('bahar');
    expect(andar).toBeCloseTo((0.9 * 10_725 - 10_100) / 20_825, 12); // ≈ −2.15%
    expect(bahar).toBeCloseTo((10_100 - 10_725) / 20_825, 12); // ≈ −3.00%
    const pick = engine.botMove(table('7H', []), LEARNER, 'normal', rng());
    const normal = pick.type === 'bet' ? average(pick.side) : Number.NaN;
    const easy = (andar + bahar) / 2; // easy picks each side half the time
    expect(normal).toBe(Math.max(andar, bahar));
    expect(normal).toBeGreaterThan(easy);
  });

  it('easy picks a side at random — both sides come up', () => {
    const s = table('7H', []);
    const r = createRng('easy-sides');
    let andar = 0;
    for (let i = 0; i < 400; i++) {
      const m = engine.botMove(s, LEARNER, 'easy', r);
      expect(engine.checkMove(s, LEARNER, m).ok).toBe(true);
      if (m.type === 'bet' && m.side === 'andar') andar++;
    }
    expect(andar).toBeGreaterThan(150);
    expect(andar).toBeLessThan(250);
  });

  it('bots never peek at the face-down stock: reordering it changes no decision', () => {
    for (let seed = 0; seed < 20; seed++) {
      const s = engine.setup(CONFIG, createRng(seed));
      const peeked: AndarBaharState = { ...s, stock: shuffle(s.stock, createRng(`re-${seed}`)) };
      for (const d of ['easy', 'normal'] as const) {
        expect(engine.botMove(peeked, LEARNER, d, createRng(seed))).toEqual(
          engine.botMove(s, LEARNER, d, createRng(seed)),
        );
      }
    }
  });

  it('every bot move in many seeded games is legal', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let s = engine.setup(CONFIG, createRng(seed));
      const r = createRng(`b${seed}`);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s)!;
        const m = engine.botMove(s, p, seed % 2 ? 'easy' : 'normal', r);
        expect(keys(engine.legalMoves(s, p))).toContain(engine.moveKey(m));
        s = engine.applyMove(s, m);
      }
    }
  });

  it('asking a seat with no move for a bot move is a programming error', () => {
    const s = table('7H', []);
    expect(() => engine.botMove(s, DEALER, 'normal', rng())).toThrow(/no move/);
    expect(() => engine.botMove(matchOnCard(3), LEARNER, 'easy', rng())).toThrow(/no move/);
  });

  it('is fast: 10,000 decisions well under a second', () => {
    const s = table('7H', []);
    const r = rng();
    const t0 = performance.now();
    for (let i = 0; i < 10_000; i++) engine.botMove(s, LEARNER, i % 2 ? 'easy' : 'normal', r);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});

// ------------------------------------------------------------------ words

describe('describeMove', () => {
  const betting = table('7H', ['3C', 'KD', '7S']);
  const dealing = engine.applyMove(betting, BET_ANDAR);

  it('bets, from the learner’s point of view', () => {
    expect(engine.describeMove(betting, LEARNER, BET_ANDAR)).toBe('You bet on Andar (inside).');
    expect(engine.describeMove(betting, LEARNER, BET_BAHAR)).toBe('You bet on Bahar (outside).');
  });

  it('each dealt card is named (it lands face up) with its number and side', () => {
    expect(engine.describeMove(dealing, DEALER, DEAL)).toBe(
      'Player 1 deals card 1, the Three of Clubs, to Andar.',
    );
    const second = engine.applyMove(dealing, DEAL);
    expect(engine.describeMove(second, DEALER, DEAL)).toBe(
      'Player 1 deals card 2, the King of Diamonds, to Bahar.',
    );
  });

  it('the matching card is announced as the winner', () => {
    const s = dealTimes(dealing, 2);
    expect(engine.describeMove(s, DEALER, DEAL)).toBe(
      'Player 1 deals card 3, the Seven of Spades, to Andar — it matches the joker, so Andar wins!',
    );
  });

  it('never names a face-down card other than the one being turned up', () => {
    for (let seed = 0; seed < 30; seed++) {
      const states = seededGame(seed);
      for (const s of states) {
        const p = engine.currentPlayer(s);
        if (p === null) continue;
        for (const m of engine.legalMoves(s, p)) {
          const text = engine.describeMove(s, p, m);
          const visible = m.type === 'deal' ? 1 : 0;
          for (const hidden of s.stock.slice(visible)) {
            expect(text).not.toContain(cardName(hidden));
          }
        }
      }
    }
  });

  it('the announcement names exactly the card that then lands, on the side it lands', () => {
    for (let seed = 0; seed < 40; seed++) {
      let s = engine.applyMove(engine.setup(CONFIG, createRng(seed)), BET_BAHAR);
      while (!engine.isOver(s)) {
        const text = engine.describeMove(s, DEALER, DEAL);
        s = engine.applyMove(s, DEAL);
        const landed = lastDealt(s)!;
        expect(text).toContain(
          `card ${landed.number}, the ${cardName(landed.card)}, to ${landed.side === 'andar' ? 'Andar' : 'Bahar'}`,
        );
        expect(text.includes('matches the joker')).toBe(engine.isOver(s));
      }
    }
  });

  it('illegal or malformed moves get a short refusal', () => {
    expect(engine.describeMove(betting, LEARNER, DEAL)).toBe('You can’t deal right now.');
    expect(engine.describeMove(dealing, LEARNER, BET_BAHAR)).toBe('You can’t bet right now.');
    expect(engine.describeMove(betting, DEALER, DEAL)).toBe('Player 1 can’t deal right now.');
    expect(
      engine.describeMove(betting, LEARNER, { type: 'split' } as unknown as AndarBaharMove),
    ).toBe('That isn’t an Andar Bahar move.');
  });
});

describe('coach', () => {
  it('before the bet: explains the game, suggests the normal bot’s legal bet, and why', () => {
    const s = table('7H', []);
    const advice = engine.coach(s, LEARNER);
    expect(advice.situation).toMatch(/The joker is the Seven of Hearts/);
    expect(advice.situation).toMatch(/starting with Andar/);
    expect(advice.situation).toMatch(/any suit counts/);
    const suggestion = advice.suggestion as AndarBaharMove;
    expect(engine.checkMove(s, LEARNER, suggestion).ok).toBe(true);
    expect(suggestion).toEqual(engine.botMove(s, LEARNER, 'normal', createRng(1)));
    expect(advice.why).toMatch(/pure chance/);
    expect(advice.why).toContain('51.5%');
    expect(advice.why).toContain('48.5%');
    expect(advice.why).toMatch(/0\.9 to 1/);
    expect(advice.why).toMatch(/neither side is a smart or skilful pick/);
  });

  it('during the deal the learner gets the live odds but no suggestion', () => {
    let s = engine.applyMove(table('7H', ['3C', 'KD', '2S']), BET_BAHAR);
    s = dealTimes(s, 3);
    const advice = engine.coach(s, LEARNER);
    expect(advice.suggestion).toBeUndefined();
    expect(advice.situation).toMatch(/^You bet on Bahar\./);
    expect(advice.situation).toMatch(/3 cards dealt so far, and no match yet/);
    expect(advice.situation).toMatch(/The next card goes to Bahar/);
    expect(advice.situation).toContain(percent(winChances(3).bahar));
    expect(advice.why).toMatch(/three remaining Sevens/);
  });

  it('when only the three matches are left face down, the coach says the next card must match', () => {
    // 48 non-matching cards, then the three Sevens: card 49 is certain to match on Andar.
    const start = engine.applyMove(table('7H', [...FILLER, '7S', '7D', '7C']), BET_BAHAR);
    const s = dealTimes(start, MAX_DEAL_LENGTH - 1);
    expect(engine.isOver(s)).toBe(false);
    expect(nextSide(s)).toBe('andar');
    const advice = engine.coach(s, LEARNER);
    expect(advice.suggestion).toBeUndefined();
    expect(advice.situation).toMatch(/^You bet on Bahar\. .*48 cards dealt so far/);
    expect(advice.situation).toMatch(
      /Only the three Sevens are still face down, so the next card is sure to match — Andar will win this deal\.$/,
    );
    // No "about 0.0%" / "about 100.0%" for a certainty.
    expect(`${advice.situation} ${advice.why}`).not.toMatch(/%/);
    expect(advice.why).toMatch(/every card left is a Seven/);
    const last = engine.applyMove(s, DEAL);
    expect(last.winner).toBe('andar');
    // One card earlier it is still a live chance: Bahar is due card 48 and is the favourite.
    const before = engine.coach(dealTimes(start, MAX_DEAL_LENGTH - 2), LEARNER);
    expect(before.situation).toContain(`about a ${percent(winChances(47).bahar)} chance`);
    expect(percent(winChances(47).bahar)).toBe('75.0%');
  });

  it('the live odds use the article and rank correctly (an Ace, an Eight)', () => {
    const s = dealTimes(engine.applyMove(table('AH', ['2C']), BET_ANDAR), 1);
    expect(engine.coach(s, LEARNER).situation).toMatch(/chance of getting the next Ace\.$/);
    const filler = makeDeck().filter((c) => c[0] !== '8');
    const end = dealTimes(
      engine.applyMove(table('8H', [...filler, '8S', '8D', '8C']), BET_ANDAR),
      MAX_DEAL_LENGTH - 1,
    );
    expect(engine.coach(end, LEARNER).why).toMatch(/every card left is an Eight/);
  });

  it('the dealer’s coach is the forced deal', () => {
    const s = engine.applyMove(table('7H', []), BET_ANDAR);
    const advice = engine.coach(s, DEALER);
    expect(advice.suggestion).toEqual(DEAL);
    expect(advice.situation).toMatch(/No cards are dealt yet\. The next card goes to Andar/);
    expect(advice.why).toMatch(/no choices/);
    expect(engine.coach(table('7H', []), DEALER).suggestion).toBeUndefined();
  });

  it('after the deal the coach repeats the result', () => {
    const s = matchOnCard(7);
    expect(engine.coach(s, LEARNER)).toEqual({ situation: engine.result(s).summary });
  });

  it('a seat that does not exist', () => {
    expect(engine.coach(table('7H', []), 4).situation).toMatch(/There’s no Player 4/);
  });

  it('never reveals the face-down stock', () => {
    for (let seed = 0; seed < 30; seed++) {
      for (const s of seededGame(seed)) {
        if (engine.isOver(s)) continue;
        for (const p of [LEARNER, DEALER]) {
          const a = engine.coach(s, p);
          for (const hidden of s.stock) {
            expect(`${a.situation} ${a.why ?? ''}`).not.toContain(cardName(hidden));
          }
        }
      }
    }
  });
});

describe('moveKey', () => {
  it('is unique per distinct move and stable', () => {
    expect(keys(CANDIDATES)).toEqual(['bet:andar', 'bet:bahar', 'deal']);
    expect(engine.moveKey({ type: 'bet', side: 'andar' })).toBe(engine.moveKey(BET_ANDAR));
    expect(new Set(keys(CANDIDATES)).size).toBe(3);
  });

  it('a malformed move never shares a key with a legal move (and never throws)', () => {
    const legalKeys = new Set(keys(CANDIDATES));
    const malformed = [{ type: 'hit' }, {}, { side: 'andar' }, null, 'deal', 7, { type: 'bet' }];
    const seen = new Set<string>();
    for (const m of malformed) {
      const key = engine.moveKey(m as unknown as AndarBaharMove);
      expect(legalKeys.has(key), String(key)).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(malformed.length);
  });
});

describe('queries', () => {
  it('cardsDealt, nextSide, dealtInOrder, lastDealt and matchingCard track the deal', () => {
    let s = engine.applyMove(table('AH', ['2C', '3C', 'AD']), BET_ANDAR);
    expect(cardsDealt(s)).toBe(0);
    expect(nextSide(s)).toBe('andar');
    expect(lastDealt(s)).toBeNull();
    expect(matchingCard(s)).toBeNull();
    s = dealTimes(s, 2);
    expect(cardsDealt(s)).toBe(2);
    expect(nextSide(s)).toBe('andar');
    expect(dealtInOrder(s)).toEqual([
      { card: '2C', side: 'andar', number: 1 },
      { card: '3C', side: 'bahar', number: 2 },
    ]);
    expect(matchingCard(s)).toBeNull();
    s = engine.applyMove(s, DEAL);
    expect(matchingCard(s)).toBe('AD');
    expect(matchesJoker(s, 'AS')).toBe(true);
    expect(matchesJoker(s, '2H')).toBe(false);
  });
});
