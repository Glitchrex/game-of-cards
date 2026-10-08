/**
 * Adversarial rules verification for Klondike (docs/RULES_DECISIONS.md, docs/engine-notes,
 * and the standard rules). Each block names the rule it pins down; every test is written so
 * that it fails if the engine gets that rule wrong.
 */
import {
  RANKS,
  SUITS,
  cardName,
  cardShort,
  isRed,
  rankNumber,
  suitOf,
  type StandardCard,
  type Suit,
} from '@/games/core/cards';
import content from '@content/games/klondike';
import { createRng, shuffle, type Rng } from '@/games/core/rng';
import { deepFreeze, simulate } from '@/games/core/simulate';
import { IllegalMoveError, type Difficulty } from '@/games/core/types';
import {
  BREAK_EVEN_CARDS,
  isStuck,
  klondikeEngine as E,
  klondikeMoveLabel,
  type KlondikeMove,
  type KlondikeState,
} from './engine';
import { faceDownCount, foundationCount, fullDeck, isRun, isSafeHome } from './rules';
import { decide } from './strategy';

// ---------------------------------------------------------------------------
// Builders (independent of the other test file on purpose)
// ---------------------------------------------------------------------------

const C = (s: string): StandardCard[] =>
  s.trim() ? (s.trim().split(/\s+/) as StandardCard[]) : [];

interface Spec {
  piles?: Array<[string, string]>;
  stock?: string;
  waste?: string;
  home?: Partial<Record<Suit, number>>;
  extra?: Partial<KlondikeState>;
}

function build(spec: Spec): KlondikeState {
  const foundations: Record<Suit, StandardCard[]> = { S: [], H: [], D: [], C: [] };
  let home = 0;
  for (const suit of SUITS) {
    const n = spec.home?.[suit] ?? 0;
    foundations[suit] = RANKS.slice(0, n).map((r) => `${r}${suit}` as StandardCard);
    home += n;
  }
  return {
    stock: C(spec.stock ?? ''),
    waste: C(spec.waste ?? ''),
    tableau: Array.from({ length: 7 }, (_, i) => ({
      faceDown: C(spec.piles?.[i]?.[0] ?? ''),
      faceUp: C(spec.piles?.[i]?.[1] ?? ''),
    })),
    foundations,
    moveCount: 0,
    recycles: 0,
    resigned: false,
    flips: 0,
    lastFlipped: null,
    lastHome: null,
    bestHome: home,
    lastProgressAt: 0,
    last: null,
    ...spec.extra,
  };
}

/** A resigned position with `home` cards on the foundations (filled suit by suit). */
function resignedWith(home: number, extra: Partial<KlondikeState> = {}): KlondikeState {
  const counts: Partial<Record<Suit, number>> = {};
  let left = home;
  for (const suit of SUITS) {
    counts[suit] = Math.min(13, left);
    left -= counts[suit] ?? 0;
  }
  return build({ home: counts, extra: { resigned: true, ...extra } });
}

const DRAW: KlondikeMove = { type: 'draw' };
const RECYCLE: KlondikeMove = { type: 'recycle' };
const RESIGN: KlondikeMove = { type: 'resign' };
const W2F: KlondikeMove = { type: 'move', from: { kind: 'waste' }, to: { kind: 'foundation' } };
const w2t = (pile: number): KlondikeMove => ({
  type: 'move',
  from: { kind: 'waste' },
  to: { kind: 'tableau', pile },
});
const t2t = (pile: number, index: number, to: number): KlondikeMove => ({
  type: 'move',
  from: { kind: 'tableau', pile, index },
  to: { kind: 'tableau', pile: to },
});
const t2f = (pile: number, index: number): KlondikeMove => ({
  type: 'move',
  from: { kind: 'tableau', pile, index },
  to: { kind: 'foundation' },
});
const f2t = (suit: Suit, pile: number): KlondikeMove => ({
  type: 'move',
  from: { kind: 'foundation', suit },
  to: { kind: 'tableau', pile },
});

const legalKeys = (s: KlondikeState) => E.legalMoves(s, 0).map(E.moveKey);
const isLegal = (s: KlondikeState, m: KlondikeMove) => {
  const ok = E.checkMove(s, 0, m).ok;
  expect(legalKeys(s).includes(E.moveKey(m)), E.moveKey(m)).toBe(ok);
  return ok;
};
const why = (s: KlondikeState, m: KlondikeMove) => {
  const c = E.checkMove(s, 0, m);
  expect(c.ok).toBe(false);
  return c.reason ?? '';
};

/** Every structurally possible move (legal or not). */
function everyMove(s: KlondikeState): KlondikeMove[] {
  const out: KlondikeMove[] = [DRAW, RECYCLE, RESIGN, W2F];
  for (let j = 0; j < 7; j++) out.push(w2t(j));
  s.tableau.forEach((p, i) => {
    for (let k = -1; k <= p.faceUp.length; k++) {
      out.push(t2f(i, k));
      for (let j = 0; j < 7; j++) out.push(t2t(i, k, j));
    }
  });
  for (const suit of SUITS) {
    out.push({ type: 'move', from: { kind: 'foundation', suit }, to: { kind: 'foundation' } });
    for (let j = 0; j < 7; j++) out.push(f2t(suit, j));
  }
  return out;
}

/** Cards the learner cannot see: face-down cards, plus the stock before its first pass. */
function hiddenCards(s: KlondikeState): StandardCard[] {
  return [...s.tableau.flatMap((p) => p.faceDown), ...(s.recycles === 0 ? s.stock : [])];
}

function allCards(s: KlondikeState): StandardCard[] {
  return [
    ...s.stock,
    ...s.waste,
    ...s.tableau.flatMap((p) => [...p.faceDown, ...p.faceUp]),
    ...SUITS.flatMap((suit) => s.foundations[suit]),
  ];
}

/** States along real games: normal-bot games mixed with random legal moves. */
function gameStates(games: number, seedBase: string, every = 3): KlondikeState[] {
  const out: KlondikeState[] = [];
  for (let g = 0; g < games; g++) {
    const rng = createRng(`${seedBase}-${g}`);
    let s = E.setup({ players: 1 }, rng);
    for (let step = 0; !E.isOver(s) && step < 400; step++) {
      if (step % every === 0) out.push(s);
      const legal = E.legalMoves(s, 0).filter((m) => m.type !== 'resign');
      const m = rng.next() < 0.7 ? E.botMove(s, 0, 'normal', rng) : rng.pick(legal);
      if (m.type === 'resign') break;
      s = E.applyMove(s, m);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// The deal
// ---------------------------------------------------------------------------

describe('rule: the deal (7 columns of 1–7 cards, dealt row by row, top card up, 24 in stock)', () => {
  test('cards are dealt row by row, left to right, from one shuffled deck', () => {
    for (const seed of [1, 2, 'x', 99]) {
      const s = E.setup({ players: 1 }, createRng(seed));
      const deck = shuffle(fullDeck(), createRng(seed));
      // Row r deals one card to each column p ≥ r, so column p holds rows 0..p.
      let pos = 0;
      const expected: StandardCard[][] = Array.from({ length: 7 }, () => []);
      for (let r = 0; r < 7; r++) {
        for (let p = r; p < 7; p++) expected[p]?.push(deck[pos++] as StandardCard);
      }
      s.tableau.forEach((col, p) => {
        expect([...col.faceDown, ...col.faceUp]).toEqual(expected[p]);
        expect(col.faceUp).toEqual([expected[p]?.[p]]);
      });
      expect(s.stock).toEqual(deck.slice(28));
      expect(faceDownCount(s)).toBe(21);
    }
  });

  test('every seed deals each of the 52 cards exactly once', () => {
    for (let seed = 0; seed < 50; seed++) {
      const cards = allCards(E.setup({ players: 1 }, createRng(seed)));
      expect(cards.slice().sort()).toEqual(fullDeck().slice().sort());
    }
  });
});

// ---------------------------------------------------------------------------
// Stock and waste
// ---------------------------------------------------------------------------

describe('rule: Draw-1 — one card at a time, and only the top waste card is playable', () => {
  test('a draw moves exactly one card, the top of the stock, onto the waste', () => {
    const s = build({ stock: '2C 9H 4S', waste: 'QD' });
    const n = E.applyMove(s, DRAW);
    expect(n.stock).toEqual(['2C', '9H']);
    expect(n.waste).toEqual(['QD', '4S']);
  });

  test('a card buried in the waste can never be played, even when it would fit', () => {
    // 6♦ (buried) fits on the 7♠; the top card 9♥ does not.
    const s = build({ waste: '6D 9H', piles: [['', '7S']], home: { D: 5 } });
    expect(isLegal(s, w2t(0))).toBe(false);
    expect(isLegal(s, W2F)).toBe(false); // the 6♦ could go home, but it is not on top
    expect(why(s, w2t(0))).toContain('A red 9 must go on a black 10'); // judged by the top card
  });
});

describe('rule: unlimited passes — turn the waste over (same order) whenever the stock is empty', () => {
  test('thirty passes in a row are all allowed and replay the same order', () => {
    let s = build({ stock: '3C 8D KH', piles: [['', '5S']] });
    const order = (st: KlondikeState) => st.stock.slice().reverse();
    const first = order(s);
    for (let pass = 1; pass <= 30; pass++) {
      const seen: StandardCard[] = [];
      while (s.stock.length > 0) {
        expect(isLegal(s, RECYCLE)).toBe(false);
        seen.push(s.stock.at(-1) as StandardCard);
        s = E.applyMove(s, DRAW);
      }
      expect(seen).toEqual(first);
      expect(isLegal(s, DRAW)).toBe(false);
      expect(isLegal(s, RECYCLE)).toBe(true);
      s = E.applyMove(s, RECYCLE);
      expect(s.recycles).toBe(pass);
      expect(s.waste).toEqual([]);
    }
  });

  test('a single card in the waste can be turned over and drawn again forever', () => {
    let s = build({ waste: '4H', piles: [['', '5S']] });
    for (let i = 0; i < 5; i++) {
      s = E.applyMove(s, RECYCLE);
      expect(s.stock).toEqual(['4H']);
      s = E.applyMove(s, DRAW);
      expect(s.waste).toEqual(['4H']);
    }
  });

  test('with the stock and the waste both empty, neither draw nor recycle is offered', () => {
    const s = build({ piles: [['', '5S']] });
    expect(isLegal(s, DRAW)).toBe(false);
    expect(isLegal(s, RECYCLE)).toBe(false);
    expect(legalKeys(s)).toEqual(['resign']);
  });
});

// ---------------------------------------------------------------------------
// Tableau building
// ---------------------------------------------------------------------------

describe('rule: build down in alternating colours (checked for every pair of cards)', () => {
  test('X may go on Y exactly when Y is one rank higher and the other colour', () => {
    const deck = fullDeck();
    for (const top of deck) {
      for (const c of deck) {
        if (c === top) continue;
        const s = build({ waste: c, piles: [['', top]] });
        const want = isRed(c) !== isRed(top) && rankNumber(top) === rankNumber(c) + 1;
        expect(isLegal(s, w2t(0)), `${c} on ${top}`).toBe(want);
      }
    }
  });

  test('the same rule holds for runs moved between columns and for foundation cards', () => {
    const s = build({
      piles: [
        ['2D', '9S 8H 7C'],
        ['', 'TH'],
        ['', 'TC'],
        ['', '8S'],
        ['', '8D'],
      ],
      home: { H: 6 },
    });
    expect(isLegal(s, t2t(0, 0, 1))).toBe(true); // 9♠ run on 10♥
    expect(isLegal(s, t2t(0, 0, 2))).toBe(false); // 9♠ on 10♣ (both black)
    expect(isLegal(s, t2t(0, 2, 4))).toBe(true); // 7♣ on 8♦
    expect(isLegal(s, t2t(0, 2, 3))).toBe(false); // 7♣ on 8♠
    expect(isLegal(s, f2t('H', 0))).toBe(true); // 6♥ on 7♣
    expect(isLegal(s, f2t('H', 4))).toBe(false); // 6♥ on 8♦
  });

  test('an Ace refused in the columns is pointed to the foundations', () => {
    const s = build({
      waste: 'AS',
      piles: [
        ['', '3H'],
        ['', '2C'],
        ['', ''],
      ],
    });
    for (const pile of [0, 1, 2]) {
      const r = why(s, w2t(pile));
      expect(r).toContain('Aces belong on the foundations');
      expect(isLegal(s, W2F)).toBe(true); // …and that advice is really legal
    }
    // A non-Ace keeps the plain rule sentence.
    expect(why(build({ waste: '5S', piles: [['', '7H']] }), w2t(0))).not.toContain('Aces');
  });
});

describe('rule: a run (or its lower part) moves as one unit, and keeps its order', () => {
  test('every suffix of a run can move; the cards land in the same order', () => {
    const run = C('KH QS JD TC 9H 8S');
    // For each starting index, a column top that accepts that card (empty for the King).
    const targets = ['', 'KD', 'QC', 'JH', 'TS', '9D'];
    for (let k = 0; k < run.length; k++) {
      const target = targets[k] ?? '';
      const s = build({
        piles: [
          ['4C', run.join(' ')],
          ['', target],
        ],
      });
      expect(isLegal(s, t2t(0, k, 1)), `move from index ${k}`).toBe(true);
      const n = E.applyMove(s, t2t(0, k, 1));
      expect(n.tableau[1]?.faceUp).toEqual([...C(target), ...run.slice(k)]);
      expect(n.tableau[0]?.faceUp).toEqual(k === 0 ? ['4C'] : run.slice(0, k));
    }
  });
});

describe('rule: only a King (or a run starting with one) may fill an empty column', () => {
  test('checked for every card from the waste and from a foundation', () => {
    for (const c of fullDeck()) {
      const fromWaste = build({ waste: c, piles: [['', '']] });
      expect(isLegal(fromWaste, w2t(0)), c).toBe(rankNumber(c) === 13);
      const suit = suitOf(c);
      const fromHome = build({ piles: [['', '']], home: { [suit]: rankNumber(c) } });
      expect(isLegal(fromHome, f2t(suit, 0)), `${c} from home`).toBe(rankNumber(c) === 13);
    }
  });

  test('a King run moving off face-down cards into an empty column turns one over', () => {
    const s = build({
      piles: [
        ['3D 4S', 'KC QH'],
        ['', ''],
      ],
    });
    const n = E.applyMove(s, t2t(0, 0, 1));
    expect(n.tableau[1]?.faceUp).toEqual(['KC', 'QH']);
    expect(n.tableau[0]).toEqual({ faceDown: ['3D'], faceUp: ['4S'] });
  });
});

// ---------------------------------------------------------------------------
// Foundations
// ---------------------------------------------------------------------------

describe('rule: foundations build up by suit from the Ace (checked for every card and height)', () => {
  test('a card goes home exactly when its own suit is one rank below it', () => {
    for (const suit of SUITS) {
      for (let height = 0; height <= 12; height++) {
        for (const c of fullDeck()) {
          if (suitOf(c) === suit && rankNumber(c) <= height) continue; // already home
          const s = build({ waste: c, home: { [suit]: height } });
          const otherSuitEmpty = suitOf(c) !== suit;
          const want = otherSuitEmpty ? rankNumber(c) === 1 : rankNumber(c) === height + 1;
          expect(isLegal(s, W2F), `${c} with ${suit}×${height}`).toBe(want);
          if (want) expect(E.applyMove(s, W2F).foundations[suitOf(c)].at(-1)).toBe(c);
        }
      }
    }
  });

  test('only one card at a time goes up, and the reason never claims a card is ready when it is not', () => {
    // The 8♥ is the last card of the run, but the Hearts foundation is still empty.
    const notReady = build({ piles: [['', '9S 8H']] });
    const r = why(notReady, t2f(0, 0));
    expect(r).toContain('one card at a time');
    expect(r).not.toContain('can go up right now');
    expect(r).toContain('Ace of Hearts');
    expect(isLegal(notReady, t2f(0, 1))).toBe(false);
    // When the last card really can go up, the reason says so — and that move is legal.
    const ready = build({ piles: [['', '2S AH']] });
    expect(why(ready, t2f(0, 0))).toContain('Ace of Hearts');
    expect(isLegal(ready, t2f(0, 1))).toBe(true);
  });

  test('the top foundation card may come back down; cards under it may not', () => {
    const s = build({
      piles: [
        ['', '7S'],
        ['', '6C'],
      ],
      home: { H: 6 },
    });
    expect(isLegal(s, f2t('H', 0))).toBe(true);
    const n = E.applyMove(s, f2t('H', 0));
    expect(n.foundations.H).toEqual(['AH', '2H', '3H', '4H', '5H']);
    // Only the new top (5♥) is offered next, and it fits on the 6♣.
    expect(legalKeys(n)).toContain('move:fH>t1');
    expect(isLegal(n, f2t('H', 1))).toBe(true);
  });

  test('a card moved to "the foundation" always lands on its own suit', () => {
    const s = build({ waste: '3C', home: { S: 2, H: 2, D: 2, C: 2 } });
    const n = E.applyMove(s, W2F);
    expect(n.foundations.C).toEqual(['AC', '2C', '3C']);
    for (const suit of ['S', 'H', 'D'] as const) expect(n.foundations[suit]).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Automatic flip
// ---------------------------------------------------------------------------

describe('rule: the top face-down card turns over by itself, inside the same move', () => {
  test('exactly one card flips — the top hidden one — and it costs no extra move', () => {
    const s = build({
      piles: [
        ['2D 9C JH', '7H'],
        ['', '8S'],
      ],
      extra: { moveCount: 4 },
    });
    const n = E.applyMove(s, t2t(0, 0, 1));
    expect(n.tableau[0]).toEqual({ faceDown: ['2D', '9C'], faceUp: ['JH'] });
    expect(n.moveCount).toBe(5);
    expect(n.flips).toBe(1);
    expect(E.currentPlayer(n)).toBe(0);
  });

  test('moving only part of the face-up cards turns nothing over', () => {
    const s = build({
      piles: [
        ['2D', '9S 8H'],
        ['', '9C'],
      ],
    });
    const n = E.applyMove(s, t2t(0, 1, 1));
    expect(n.tableau[0]).toEqual({ faceDown: ['2D'], faceUp: ['9S'] });
    expect(n.flips).toBe(0);
  });

  test('a column never shows hidden cards with nothing face up during real play', () => {
    for (const s of gameStates(30, 'flip-inv')) {
      for (const p of s.tableau)
        if (p.faceDown.length > 0) expect(p.faceUp.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Resign, end of game
// ---------------------------------------------------------------------------

describe('rule: "I\'m done" is always legal; the game ends on resign or when all 52 are home', () => {
  test('resign is offered in every reachable position', () => {
    for (const s of gameStates(25, 'resign-always', 5)) {
      expect(isLegal(s, RESIGN)).toBe(true);
      const done = E.applyMove(s, RESIGN);
      expect(E.isOver(done)).toBe(true);
      expect(E.result(done).humanNetUnits).toBeCloseTo((5 * foundationCount(s)) / 52 - 1, 12);
    }
  });

  test('the 52nd card ends the game whether it comes from the waste or a column', () => {
    const fromWaste = build({ waste: 'KC', home: { S: 13, H: 13, D: 13, C: 12 } });
    const n = E.applyMove(fromWaste, W2F);
    expect(E.isOver(n)).toBe(true);
    expect(E.currentPlayer(n)).toBeNull();
    expect(E.result(n).humanNetUnits).toBe(4);
    // After the clear nothing at all is legal — not even resigning.
    for (const m of everyMove(n)) expect(E.checkMove(n, 0, m).ok).toBe(false);
    expect(() => E.applyMove(n, RESIGN)).toThrow(IllegalMoveError);
  });

  test('a game never ends by itself while cards are left, even when nothing can move', () => {
    const s = build({ piles: [['4H', '5S']], stock: '' });
    expect(E.isOver(s)).toBe(false);
    expect(E.currentPlayer(s)).toBe(0);
    expect(E.legalMoves(s, 0)).toEqual([RESIGN]);
  });
});

// ---------------------------------------------------------------------------
// Vegas-style payout and result flags
// ---------------------------------------------------------------------------

describe('rule: Vegas payout — net = 5 × cards home ÷ 52 − 1; win iff cleared or net > 0', () => {
  test('every possible card count pays exactly per docs/RULES_DECISIONS.md', () => {
    for (let home = 0; home <= 52; home++) {
      const s =
        home === 52
          ? build({ home: { S: 13, H: 13, D: 13, C: 13 } })
          : resignedWith(home, { bestHome: home });
      const r = E.result(s);
      const net = (5 * home) / 52 - 1;
      expect(r.humanNetUnits).toBeCloseTo(net, 12);
      expect(r.humanNetUnits).toBeGreaterThanOrEqual(-1); // maxLossUnits = 1
      expect(r.humanNetUnits).toBeLessThanOrEqual(4);
      const win = home === 52 || net > 0;
      expect(r.humanOutcome, `${home} cards`).toBe(win ? 'win' : 'loss');
      expect(r.winners).toEqual(win ? [0] : []);
      expect(r.scores).toEqual([home]);
      expect(win).toBe(home >= BREAK_EVEN_CARDS);
      expect(r.summary.length).toBeGreaterThan(20);
    }
  });
});

describe('result flags are honest', () => {
  test('closeFinish: 10 or 11 cards (one either side of breaking even) — never 9, 12 or a clear', () => {
    const close = (n: number) => E.result(resignedWith(n)).flags.closeFinish;
    expect([9, 10, 11, 12].map(close)).toEqual([false, true, true, false]);
  });

  test('bigPot: net ≥ 3 units, i.e. 42+ cards home', () => {
    const big = (n: number) => E.result(resignedWith(n)).flags.bigPot;
    expect([41, 42, 51].map(big)).toEqual([false, true, true]);
  });

  test('luckyLastCard: the last card home turned a loss into a win (exactly 11 cards, never more)', () => {
    const lucky = (n: number, extra: Partial<KlondikeState> = {}) =>
      E.result(resignedWith(n, { bestHome: n, ...extra })).flags.luckyLastCard;
    expect(lucky(11)).toBe(true);
    expect(lucky(10)).toBe(false);
    expect(lucky(12)).toBe(false);
    // 12 were home, one came back down: the result was not decided by a card going home.
    expect(lucky(11, { bestHome: 12 })).toBe(false);
    // A clear was decided long before the last King went up — even if the last hidden card
    // happened to be that King.
    const cleared = E.applyMove(
      build({
        piles: [['', 'KH']],
        home: { S: 13, H: 12, D: 13, C: 13 },
        extra: { lastFlipped: 'KH', flips: 21 },
      }),
      t2f(0, 0),
    );
    expect(E.result(cleared).flags.luckyLastCard).toBe(false);
  });

  test('folded only when the learner pressed "I\'m done"; bust never', () => {
    expect(E.result(resignedWith(30)).flags.folded).toBe(true);
    const cleared = build({ home: { S: 13, H: 13, D: 13, C: 13 } });
    expect(E.result(cleared).flags.folded).toBe(false);
    expect(E.result(cleared).flags.bust).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Turn structure and purity
// ---------------------------------------------------------------------------

describe('rule: one seat; applyMove is pure and strict', () => {
  test('no seat but 0 ever has a move', () => {
    const s = E.setup({ players: 1 }, createRng(3));
    for (const p of [1, 2, -1]) {
      expect(E.legalMoves(s, p)).toEqual([]);
      expect(E.checkMove(s, p, DRAW).ok).toBe(false);
    }
  });

  test('every illegal move throws IllegalMoveError and leaves the frozen input untouched', () => {
    for (const s of gameStates(6, 'strict', 7)) {
      const legal = new Set(legalKeys(s));
      const before = JSON.stringify(s);
      deepFreeze(s);
      for (const m of everyMove(s)) {
        if (legal.has(E.moveKey(m))) {
          const n = E.applyMove(s, m);
          expect(allCards(n).slice().sort()).toEqual(fullDeck().slice().sort());
        } else {
          expect(() => E.applyMove(s, m)).toThrow(IllegalMoveError);
        }
      }
      expect(JSON.stringify(s)).toBe(before);
    }
  });
});

// ---------------------------------------------------------------------------
// Hidden information: reasons, labels, descriptions, coach, bots
// ---------------------------------------------------------------------------

/** Re-deal every card the player cannot see. */
function scrambleHidden(s: KlondikeState, rng: Rng): KlondikeState {
  const stockHidden = s.recycles === 0;
  const pool = shuffle(
    [...s.tableau.flatMap((p) => p.faceDown), ...(stockHidden ? s.stock : [])],
    rng,
  );
  let pos = 0;
  const take = (n: number) => pool.slice(pos, (pos += n));
  return {
    ...s,
    tableau: s.tableau.map((p) => ({ faceDown: take(p.faceDown.length), faceUp: p.faceUp })),
    stock: stockHidden ? take(s.stock.length) : s.stock,
  };
}

describe('no text ever reveals a hidden card', () => {
  const states = gameStates(25, 'hidden-text', 4);
  const rng = createRng('hidden-text-scramble');

  test('checkMove reasons and move labels do not change when the hidden cards are re-dealt', () => {
    for (const s of states) {
      const t = scrambleHidden(s, rng);
      for (const m of everyMove(s)) {
        expect(E.checkMove(t, 0, m)).toEqual(E.checkMove(s, 0, m));
        expect(klondikeMoveLabel(m, t)).toBe(klondikeMoveLabel(m, s));
      }
      // Labels never show a hidden card, even by name.
      for (const m of E.legalMoves(s, 0)) {
        const label = klondikeMoveLabel(m, s);
        for (const c of hiddenCards(s)) expect(label).not.toContain(cardShort(c));
      }
    }
  });

  test('describeMove names only the card the move itself reveals (the drawn or flipped card)', () => {
    for (const s of states) {
      const hidden = hiddenCards(s);
      for (const m of E.legalMoves(s, 0)) {
        const text = E.describeMove(s, 0, m);
        const stillHidden = new Set(hiddenCards(E.applyMove(s, m)));
        const revealed = hidden.filter((c) => !stillHidden.has(c));
        expect(revealed.length).toBeLessThanOrEqual(1);
        for (const c of hidden) {
          if (!revealed.includes(c)) {
            expect(text, `${E.moveKey(m)}: ${text}`).not.toContain(cardName(c));
          }
        }
      }
    }
  });

  test('the coach always suggests a legal move, and its words do not depend on hidden cards', () => {
    for (const s of states) {
      const a = E.coach(s, 0);
      expect(legalKeys(s)).toContain(E.moveKey(a.suggestion as KlondikeMove));
      expect(a.why?.length ?? 0).toBeGreaterThan(20);
      const b = E.coach(scrambleHidden(s, rng), 0);
      expect(b.situation).toBe(a.situation);
      expect(b.why).toBe(a.why);
      expect(E.moveKey(b.suggestion as KlondikeMove)).toBe(E.moveKey(a.suggestion as KlondikeMove));
    }
  });
});

describe("the coach's words are true", () => {
  test('a dead deal with nothing home: no "0 cards" to keep, no promise that a card can move', () => {
    const s = build({ piles: [['', '5S']] });
    expect(isStuck(s)).toBe(true);
    const a = E.coach(s, 0);
    expect(a.suggestion).toEqual(RESIGN);
    expect(a.why).toContain('this deal is stuck');
    expect(a.why).not.toContain('0 cards');
    expect(a.why).toContain('stake is lost');
    expect(a.why).not.toContain('stock'); // there is no stock to talk about
    expect(a.situation).not.toContain('You can move a face-up card');
    expect(a.situation).not.toContain("keep what you've earned");
    expect(a.situation).toContain('No card can move');
  });

  test('when the heuristic gives up but moves remain, the coach says the deal only "looks" stuck', () => {
    // 7♣ can still hop between the red 8s, so the rules check does not call this stuck.
    const s = build({
      waste: '2D',
      piles: [
        ['', '8H 7C'],
        ['', '8D'],
        ['4S', '9S'],
      ],
      home: { C: 3 },
      extra: { recycles: 1 },
    });
    expect(isStuck(s)).toBe(false);
    const a = E.coach(s, 0);
    expect(a.suggestion).toEqual(RESIGN);
    expect(a.why).toContain('looks stuck');
    expect(a.why).toContain('you keep the value of the 3 cards already home');
    expect(a.situation).toContain('You can move a face-up card');
  });

  test('a position with only drawing left says so', () => {
    const s = build({ stock: '3D', piles: [['4H', '9S']], home: { S: 1 } });
    expect(E.coach(s, 0).situation).toContain('No card can move right now, so draw from the stock');
  });
});

describe('bots and coach use only what the learner could know', () => {
  test('along whole bot games (including later passes), hidden cards never change a decision', () => {
    const rng = createRng('verify-scramble');
    for (let g = 0; g < 12; g++) {
      let s = E.setup({ players: 1 }, createRng(`verify-fair-${g}`));
      const botRng = createRng(`verify-fair-bot-${g}`);
      while (!E.isOver(s)) {
        const want = E.moveKey(E.botMove(s, 0, 'normal', createRng(1)));
        const wantEasy = E.moveKey(E.botMove(s, 0, 'easy', createRng('e')));
        const t = scrambleHidden(s, rng);
        expect(E.moveKey(E.botMove(t, 0, 'normal', createRng(1)))).toBe(want);
        expect(E.moveKey(E.botMove(t, 0, 'easy', createRng('e')))).toBe(wantEasy);
        expect(E.moveKey(decide(t, 'normal', null, { backstop: false }).move)).toBe(
          E.moveKey(decide(s, 'normal', null, { backstop: false }).move),
        );
        s = E.applyMove(s, E.botMove(s, 0, 'normal', botRng));
      }
    }
  });
});

describe('bot strength and termination', () => {
  const stats = (difficulty: Difficulty) => {
    let cleared = 0;
    let home = 0;
    const summary = simulate(E, {
      games: 150,
      seedBase: 70_001,
      config: { players: 1 },
      difficulty: () => difficulty,
      maxMoves: 2000,
      freezeEvery: 0,
      onGameEnd: (s) => {
        const n = foundationCount(s);
        home += n;
        if (n === 52) cleared++;
      },
    });
    return { cleared, home, net: summary.netUnits, wins: summary.outcomes.win };
  };

  test('normal is clearly stronger than easy on the same deals', { timeout: 60_000 }, () => {
    const normal = stats('normal');
    const easy = stats('easy');
    expect(normal.cleared).toBeGreaterThan(easy.cleared * 2);
    expect(normal.wins).toBeGreaterThan(easy.wins);
    expect(normal.home).toBeGreaterThan(easy.home);
    expect(normal.net).toBeGreaterThan(easy.net);
  });

  test('a learner who always follows the coach reaches the end of every deal', () => {
    for (let g = 0; g < 60; g++) {
      let s = E.setup({ players: 1 }, createRng(`coach-follow-${g}`));
      let n = 0;
      while (!E.isOver(s) && n < 1000) {
        s = E.applyMove(s, E.coach(s, 0).suggestion as KlondikeMove);
        n++;
      }
      expect(E.isOver(s), `deal ${g}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// isStuck soundness
// ---------------------------------------------------------------------------

describe('isStuck is never wrong when it says "stuck"', () => {
  test('from a stuck position, no sequence of moves changes anything that matters', () => {
    const stuck = [
      build({
        stock: '9D',
        waste: '4C',
        piles: [
          ['7S', '5S'],
          ['8D', '9H'],
        ],
      }),
      build({
        waste: '2D QC',
        piles: [
          ['', 'KS QH'],
          ['', ''],
          ['6C', '8H'],
        ],
      }),
      build({ piles: [['4H', '5S']] }),
    ];
    const rng = createRng('stuck-walk');
    for (const s of stuck) {
      expect(isStuck(s)).toBe(true);
      let w = s;
      for (let i = 0; i < 400; i++) {
        const moves = E.legalMoves(w, 0).filter((m) => m.type !== 'resign');
        if (moves.length === 0) break;
        w = E.applyMove(w, rng.pick(moves));
        expect(foundationCount(w)).toBe(foundationCount(s));
        expect(faceDownCount(w)).toBe(faceDownCount(s));
        expect(w.stock.length + w.waste.length).toBe(s.stock.length + s.waste.length);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The lesson, quiz and tips agree with the engine
// ---------------------------------------------------------------------------

describe('content matches the engine', () => {
  const lessonStep = (prefix: string) => {
    const step = content.lesson.find((l) => l.title.startsWith(prefix));
    if (!step) throw new Error(`no lesson step "${prefix}"`);
    return step;
  };
  const zoneOf = (prefix: string, id: string) => {
    const z = lessonStep(prefix).scene?.zones.find((x) => x.id === id);
    if (!z) throw new Error(`no zone ${id} in "${prefix}"`);
    return z;
  };
  const zone = (prefix: string, id: string) => zoneOf(prefix, id).cards as StandardCard[];
  /** The face-up cards of a column scene (its face-down indexes left out). */
  const faceUpOf = (prefix: string, id: string) => {
    const z = zoneOf(prefix, id);
    return zone(prefix, id).filter((_, i) => !(z.faceDown ?? []).includes(i));
  };
  const fromShort = (label: string): StandardCard => {
    const card = fullDeck().find((c) => cardShort(c) === label);
    if (!card) throw new Error(`not a card: ${label}`);
    return card;
  };

  test('quiz: exactly the answer card goes on the 9♠ (and the 8♦ from the explanation too)', () => {
    const q = content.quiz.find((x) => x.question.includes('9♠'));
    expect(q).toBeDefined();
    q?.options.forEach((label, i) => {
      const s = build({ waste: fromShort(label), piles: [['', '9S']] });
      expect(isLegal(s, w2t(0)), label).toBe(i === q.answer);
    });
    expect(isLegal(build({ waste: '8D', piles: [['', '9S']] }), w2t(0))).toBe(true);
  });

  test('quiz: an empty column takes only a King; an empty foundation only its Ace', () => {
    const qCol = content.quiz.find((x) => x.question.includes('empty'));
    expect(qCol?.options[qCol.answer]).toContain('King');
    const qHome = content.quiz.find((x) => x.question.includes('Hearts foundation'));
    expect(qHome?.options[qHome.answer]).toBe('The Ace of Hearts');
    expect(isLegal(build({ waste: 'AS' }), W2F)).toBe(true);
    expect(isLegal(build({ waste: 'AH' }), W2F)).toBe(true);
    expect(isLegal(build({ waste: 'KH' }), W2F)).toBe(false);
  });

  test('lesson scenes show only runs the engine would build, and moves it would allow', () => {
    for (const [step, id] of [
      ['Build down', 'col'],
      ['Empty columns', 'new'],
      ['Uncover', 'c6'],
      ['A tiny example', 'c2'],
    ] as const) {
      expect(isRun(faceUpOf(step, id)), `${step} / ${id}`).toBe(true);
    }
    // "Empty columns": the new column starts with a King.
    expect(rankNumber(faceUpOf('Empty columns', 'new')[0] ?? 'AS')).toBe(13);
    // "Build down": the 6♦ from the waste can go on the 7♣ next.
    const buildDown = build({
      waste: zone('Build down', 'waste').join(' '),
      piles: [['', faceUpOf('Build down', 'col').join(' ')]],
    });
    expect(isLegal(buildDown, w2t(0))).toBe(true);
    // "A tiny example": the uncovered A♠ can go straight up next to the A♥.
    const tiny = build({
      piles: [['9D', faceUpOf('A tiny example', 'c5').join(' ')]],
      home: { H: zone('A tiny example', 'home').length },
    });
    expect(faceUpOf('A tiny example', 'c5')).toEqual(['AS']);
    expect(isLegal(tiny, t2f(0, 0))).toBe(true);
  });

  test('foundations scene: the 4♥ goes on the 3♥ and the 2♣ on the A♣', () => {
    const s = build({
      waste: '4H',
      piles: [['8D', '2C']],
      home: {
        H: zone('Foundations', 'hearts').length,
        C: zone('Foundations', 'clubs').length,
      },
    });
    expect(isLegal(s, W2F)).toBe(true);
    expect(isLegal(s, t2f(0, 0))).toBe(true);
  });

  test('Vegas lesson: the scene shows break-even exactly, and 11 really is the first win', () => {
    const tops = zone('Winning', 'home');
    expect(tops.reduce((n, c) => n + rankNumber(c), 0)).toBe(BREAK_EVEN_CARDS);
    expect(lessonStep('Winning').body).toContain(`${BREAK_EVEN_CARDS} or more cards home`);
    expect(E.result(resignedWith(BREAK_EVEN_CARDS)).humanOutcome).toBe('win');
    expect(E.result(resignedWith(BREAK_EVEN_CARDS - 1)).humanOutcome).toBe('loss');
    expect(E.result(build({ home: { S: 13, H: 13, D: 13, C: 13 } })).humanNetUnits + 1).toBe(5);
  });

  test('the deal described in the lesson and glossary is the deal the engine makes', () => {
    const s = E.setup({ players: 1 }, createRng('content-deal'));
    const inTableau = s.tableau.reduce((n, p) => n + p.faceDown.length + p.faceUp.length, 0);
    const faceUp = s.tableau.reduce((n, p) => n + p.faceUp.length, 0);
    expect(lessonStep('Setting up').tip).toContain(`${inTableau} cards in the tableau`);
    expect(lessonStep('Setting up').tip).toContain(`only ${faceUp} face up`);
    expect(lessonStep('Setting up').tip).toContain(`${s.stock.length} in the stock`);
    const stock = content.glossary.find((g) => g.term === 'stock');
    expect(stock?.definition).toContain(`(${s.stock.length} cards)`);
  });

  test('the "safe to send home" tip is the rule the coach uses', () => {
    const tip = content.tips.find((t) => t.includes('safe to send home'));
    expect(tip).toContain('5♥ once both black 4s are up');
    expect(isSafeHome(build({ home: { S: 4, C: 4, H: 4 } }), '5H')).toBe(true);
    expect(isSafeHome(build({ home: { S: 4, C: 3, H: 4 } }), '5H')).toBe(false);
  });
});
