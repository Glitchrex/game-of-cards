import { RANKS, SUITS, cardName, type StandardCard, type Suit } from '@/games/core/cards';
import { createRng, shuffle, type Rng } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError } from '@/games/core/types';
import klondikeDefault, {
  BREAK_EVEN_CARDS,
  autoFoundationMoves,
  canAutoFinish,
  isStuck,
  klondikeEngine as E,
  klondikeMoveKey,
  klondikeMoveLabel,
  vegasNetUnits,
  type KlondikeMove,
  type KlondikeState,
} from './engine';
import { applyUnchecked, foundationCount, fullDeck, isSafeHome, listLegalMoves } from './rules';
import { STALL_LIMIT, decide } from './strategy';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

const C = (s: string): StandardCard[] =>
  s.trim() ? (s.trim().split(/\s+/) as StandardCard[]) : [];

interface Spec {
  /** [faceDown, faceUp] per column (missing columns are empty). */
  piles?: Array<[string, string]>;
  stock?: string;
  waste?: string;
  /** Cards on each foundation (Ace upwards). */
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
  const tableau = Array.from({ length: 7 }, (_, i) => {
    const p = spec.piles?.[i];
    return { faceDown: C(p?.[0] ?? ''), faceUp: C(p?.[1] ?? '') };
  });
  return {
    stock: C(spec.stock ?? ''),
    waste: C(spec.waste ?? ''),
    tableau,
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

const reason = (s: KlondikeState, m: unknown) => {
  const c = E.checkMove(s, 0, m as KlondikeMove);
  expect(c.ok).toBe(false);
  return c.reason ?? '';
};
const ok = (s: KlondikeState, m: KlondikeMove) => {
  const c = E.checkMove(s, 0, m);
  expect(c, c.reason).toEqual({ ok: true });
  expect(E.legalMoves(s, 0).map(E.moveKey)).toContain(E.moveKey(m));
};
const keys = (s: KlondikeState) => E.legalMoves(s, 0).map(E.moveKey);

const allCards = (s: KlondikeState): StandardCard[] => [
  ...s.stock,
  ...s.waste,
  ...s.tableau.flatMap((p) => [...p.faceDown, ...p.faceUp]),
  ...SUITS.flatMap((suit) => s.foundations[suit]),
];

/** A cleared-but-one position: 51 cards home, the King of Hearts alone in column 1. */
function oneToGo(extra: Partial<KlondikeState> = {}): KlondikeState {
  return build({ piles: [['', 'KH']], home: { S: 13, H: 12, D: 13, C: 13 }, extra });
}

/** A mid-game position reached by mixing bot and random moves (always legal). */
function randomStates(count: number, seedBase = 1): KlondikeState[] {
  const out: KlondikeState[] = [];
  for (let g = 0; out.length < count; g++) {
    const rng = createRng(`rs-${seedBase}-${g}`);
    let s = E.setup({ players: 1 }, rng);
    const steps = rng.int(160);
    for (let i = 0; i < steps && !E.isOver(s); i++) {
      const legal = E.legalMoves(s, 0).filter((m) => m.type !== 'resign');
      const pick = rng.next() < 0.6 ? E.botMove(s, 0, 'normal', rng) : rng.pick(legal);
      if (pick.type === 'resign') break;
      s = E.applyMove(s, pick);
    }
    if (!E.isOver(s)) out.push(s);
  }
  return out;
}

/** Every structurally possible move (legal or not) for exhaustive legality checks. */
function everyMove(s: KlondikeState): KlondikeMove[] {
  const out: KlondikeMove[] = [DRAW, RECYCLE, RESIGN, W2F];
  for (let j = -1; j <= 7; j++) out.push(w2t(j));
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('setup and the deal', () => {
  test('exports the engine as default with the right id', () => {
    expect(klondikeDefault).toBe(E);
    expect(E.id).toBe('klondike');
  });

  test('deals 7 columns of 1–7 cards with only the top card face up, 24 in the stock', () => {
    const s = E.setup({ players: 1 }, createRng(42));
    s.tableau.forEach((p, i) => {
      expect(p.faceDown).toHaveLength(i);
      expect(p.faceUp).toHaveLength(1);
    });
    expect(s.stock).toHaveLength(24);
    expect(s.waste).toEqual([]);
    expect(foundationCount(s)).toBe(0);
    const cards = allCards(s);
    expect(cards).toHaveLength(52);
    expect(new Set(cards).size).toBe(52);
    expect(new Set(cards)).toEqual(new Set(fullDeck()));
  });

  test('same seed → same deal, different seeds → different deals', () => {
    const a = E.setup({ players: 1 }, createRng('seed-a'));
    const b = E.setup({ players: 1 }, createRng('seed-a'));
    const c = E.setup({ players: 1 }, createRng('seed-b'));
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
  });

  test('state is plain JSON', () => {
    const s = E.setup({ players: 1 }, createRng(7));
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  test('Klondike is strictly one player', () => {
    expect(() => E.setup({ players: 2 }, createRng(1))).toThrow(/one-player/);
    expect(() => E.setup({ players: 0 }, createRng(1))).toThrow(RangeError);
  });

  test('the learner is on turn at the start; draw and resign are offered, recycle is not', () => {
    const s = E.setup({ players: 1 }, createRng(3));
    expect(E.currentPlayer(s)).toBe(0);
    expect(E.isOver(s)).toBe(false);
    expect(keys(s)).toContain('draw');
    expect(keys(s)).toContain('resign');
    expect(keys(s)).not.toContain('recycle');
  });
});

// ---------------------------------------------------------------------------
// Stock & waste
// ---------------------------------------------------------------------------

describe('stock and waste (Draw-1, unlimited passes)', () => {
  test('draw turns the top stock card onto the waste', () => {
    const s = build({ stock: '2C 9H', piles: [['', 'KS']] });
    const n = E.applyMove(s, DRAW);
    expect(n.stock).toEqual(['2C']);
    expect(n.waste).toEqual(['9H']);
    expect(n.moveCount).toBe(1);
  });

  test('cannot draw from an empty stock', () => {
    expect(reason(build({ waste: '9H' }), DRAW)).toBe(
      'The stock is empty. Turn the waste pile over to make a fresh stock, then keep drawing.',
    );
    expect(reason(build({ piles: [['', 'KS']] }), DRAW)).toBe(
      'There are no cards left to draw — the stock and the waste are both empty.',
    );
  });

  test('the waste can only be turned over once the stock is empty', () => {
    expect(reason(build({ stock: '2C', waste: '9H' }), RECYCLE)).toBe(
      'You can only turn the waste over once the stock is empty — there is still 1 card left to draw.',
    );
    expect(reason(build({ stock: '2C 3D', waste: '9H' }), RECYCLE)).toContain(
      'there are still 2 cards left to draw',
    );
    expect(reason(build({ piles: [['', 'KS']] }), RECYCLE)).toBe(
      'The waste pile is empty, so there is nothing to turn over.',
    );
  });

  test('turning the waste over keeps the draw order, and passes are unlimited', () => {
    let s = E.setup({ players: 1 }, createRng(11));
    const firstPass: StandardCard[] = [];
    while (s.stock.length) {
      firstPass.push(s.stock[s.stock.length - 1] as StandardCard);
      s = E.applyMove(s, DRAW);
    }
    expect(keys(s)).toContain('recycle');
    expect(keys(s)).not.toContain('draw');
    for (let pass = 1; pass <= 5; pass++) {
      s = E.applyMove(s, RECYCLE);
      expect(s.recycles).toBe(pass);
      expect(s.waste).toEqual([]);
      const again: StandardCard[] = [];
      while (s.stock.length) {
        again.push(s.stock[s.stock.length - 1] as StandardCard);
        s = E.applyMove(s, DRAW);
      }
      expect(again).toEqual(firstPass);
    }
  });
});

// ---------------------------------------------------------------------------
// Tableau
// ---------------------------------------------------------------------------

describe('building the tableau', () => {
  test('a card goes on one rank higher in the opposite colour', () => {
    const s = build({
      waste: '7H',
      piles: [
        ['', '8S'],
        ['QD', '6C'],
        ['', '8C'],
      ],
    });
    ok(s, w2t(0));
    ok(s, w2t(2));
    const n = E.applyMove(s, w2t(0));
    expect(n.tableau[0]?.faceUp).toEqual(['8S', '7H']);
    expect(n.waste).toEqual([]);
    ok(n, t2t(1, 0, 0)); // 6♣ on 7♥
  });

  test('same colour is refused with the alternating-colour rule', () => {
    const s = build({ waste: '7H', piles: [['', '8D']] });
    expect(reason(s, w2t(0))).toBe(
      'A red 7 must go on a black 8 — the Eight of Diamonds is red too, and the colours must alternate.',
    );
  });

  test('wrong rank is refused, naming the card that is there', () => {
    const s = build({
      waste: '7H',
      piles: [
        ['', 'AS'],
        ['', 'TS'],
      ],
    });
    expect(reason(s, w2t(1))).toBe(
      'A red 7 must go on a black 8, but the top card of column 2 is the Ten of Spades.',
    );
    const t = build({ waste: 'JC', piles: [['', '5D']] });
    expect(reason(t, w2t(0))).toBe(
      'A black Jack must go on a red Queen, but the top card of column 1 is the Five of Diamonds.',
    );
  });

  test('a King can never go on another card', () => {
    const s = build({ waste: 'KH', piles: [['', 'QS']] });
    expect(reason(s, w2t(0))).toBe(
      "A King can only move into an empty column — no card is higher than a King, so it can't go on the Queen of Spades.",
    );
  });

  test('a whole run or the lower part of a run moves together', () => {
    const s = build({
      piles: [
        ['4C', '9S 8H 7C'],
        ['', 'TD'],
        ['', '9D'],
        ['', '8D'],
      ],
    });
    ok(s, t2t(0, 0, 1)); // 9♠ 8♥ 7♣ onto 10♦
    ok(s, t2t(0, 2, 3)); // 7♣ onto 8♦
    expect(reason(s, t2t(0, 1, 2))).toContain('A red 8 must go on a black 9');
    const n = E.applyMove(s, t2t(0, 0, 1));
    expect(n.tableau[1]?.faceUp).toEqual(['TD', '9S', '8H', '7C']);
    expect(n.tableau[0]).toEqual({ faceDown: [], faceUp: ['4C'] }); // flipped
    const m = E.applyMove(s, t2t(0, 2, 3));
    expect(m.tableau[0]?.faceUp).toEqual(['9S', '8H']);
    expect(m.tableau[3]?.faceUp).toEqual(['8D', '7C']);
  });

  test('face-down cards cannot be moved', () => {
    const s = build({
      piles: [
        ['4C 5C', '9S'],
        ['', 'TD'],
      ],
    });
    expect(reason(s, t2t(0, -1, 1))).toBe(
      'That card is face down. Only face-up cards can move — a face-down card turns over by itself once every card on top of it has moved away.',
    );
  });

  test('pointing past the face-up cards or at a non-integer spot is explained', () => {
    const s = build({
      piles: [
        ['', '9S'],
        ['', 'TD'],
      ],
    });
    expect(reason(s, t2t(0, 1, 1))).toBe('There is no card at that spot in column 1.');
    expect(reason(s, t2t(0, 0.5, 1))).toBe('Pick a face-up card in column 1 to move.');
  });

  test('a broken sequence cannot move as a group', () => {
    const s = build({
      piles: [
        ['', '9S 4H'],
        ['', 'TD'],
      ],
    });
    expect(reason(s, t2t(0, 0, 1))).toContain("Those cards aren't one unbroken run");
    expect(keys(s)).not.toContain('move:t0.0>t1');
  });

  test('moving cards to the column they are already in is explained', () => {
    const s = build({
      piles: [
        ['', '9S 8H'],
        ['', 'TD'],
      ],
    });
    expect(reason(s, t2t(0, 0, 0))).toBe(
      'Those cards are already in column 1. Pick a different column to move them to.',
    );
    expect(reason(s, t2t(0, 1, 0))).toBe(
      'That card is already in column 1. Pick a different column to move it to.',
    );
  });

  test('columns outside 1–7 are explained', () => {
    const s = build({ waste: '7H', piles: [['', '8S']] });
    expect(reason(s, w2t(7))).toBe('There is no column 8 — the columns are numbered 1 to 7.');
    expect(reason(s, w2t(-1))).toBe('There is no column 0 — the columns are numbered 1 to 7.');
    expect(reason(s, t2t(9, 0, 0))).toBe(
      'There is no column 10 — the columns are numbered 1 to 7.',
    );
    expect(reason(s, w2t(1.5))).toBe('Pick one of the 7 columns.');
  });

  test('empty sources are explained', () => {
    const s = build({ stock: '3D', piles: [['', '8S']] });
    expect(reason(s, w2t(0))).toBe('The waste pile is empty — draw a card from the stock first.');
    expect(reason(build({ piles: [['', '8S']] }), W2F)).toBe(
      'The waste pile is empty, so there is no card there to move.',
    );
    expect(reason(s, t2t(3, 0, 0))).toBe('Column 4 is empty — there is no card there to move.');
    // A column whose face-up cards are gone but which still hides cards (never happens in
    // play thanks to the automatic flip, but checkMove must still be safe).
    const odd = build({
      piles: [
        ['4C', ''],
        ['', 'TD'],
      ],
    });
    expect(reason(odd, t2t(0, 0, 1))).toBe('There is no face-up card in column 1 to move.');
  });

  test('you cannot build on a face-down card', () => {
    const odd = build({ waste: 'KD', piles: [['4C', '']] });
    expect(reason(odd, w2t(0))).toBe("You can't build on a face-down card in column 1.");
  });
});

describe('empty columns take only Kings', () => {
  test('a King, a King-run, a waste King and a foundation King may fill an empty column', () => {
    const s = build({
      waste: 'KD',
      piles: [
        ['3C', 'KS QH JC'],
        ['', ''],
      ],
      home: { H: 13 },
    });
    ok(s, t2t(0, 0, 1));
    ok(s, w2t(1));
    ok(s, f2t('H', 1));
    const n = E.applyMove(s, t2t(0, 0, 1));
    expect(n.tableau[1]?.faceUp).toEqual(['KS', 'QH', 'JC']);
    expect(n.tableau[0]?.faceUp).toEqual(['3C']);
  });

  test('anything else is refused', () => {
    const s = build({
      waste: 'QH',
      piles: [
        ['', 'QS JD'],
        ['', ''],
      ],
    });
    expect(reason(s, w2t(1))).toBe(
      "Only a King can go into an empty column. The Queen of Hearts can't start a new column.",
    );
    expect(reason(s, t2t(0, 0, 1))).toBe(
      'Only a King — or a run that starts with a King — can go into an empty column. This run starts with the Queen of Spades.',
    );
  });
});

// ---------------------------------------------------------------------------
// Foundations
// ---------------------------------------------------------------------------

describe('foundations', () => {
  test('build up by suit from the Ace', () => {
    let s = build({
      waste: 'AH',
      piles: [
        ['', '2H'],
        ['', '3H'],
      ],
    });
    ok(s, W2F);
    s = E.applyMove(s, W2F);
    expect(s.foundations.H).toEqual(['AH']);
    expect(s.lastHome).toBe('AH');
    s = E.applyMove(s, t2f(0, 0));
    s = E.applyMove(s, t2f(1, 0));
    expect(s.foundations.H).toEqual(['AH', '2H', '3H']);
  });

  test('an empty foundation needs its Ace first', () => {
    const s = build({ waste: '2H' });
    expect(reason(s, W2F)).toBe(
      'Foundations are built up in one suit, starting with the Ace. The Hearts foundation is still empty, so it needs the Ace of Hearts first.',
    );
  });

  test('a foundation needs the very next card of its suit', () => {
    const s = build({ waste: '7H', home: { H: 5 } });
    expect(reason(s, W2F)).toBe(
      'Foundations are built up in one suit, one card at a time. The Hearts foundation is up to the 5, so the next card it needs is the 6 of Hearts.',
    );
  });

  test('only one card at a time goes to a foundation', () => {
    const s = build({ piles: [['', '7D 6C']], home: { D: 5, C: 5 } });
    expect(reason(s, t2f(0, 0))).toBe(
      'Foundations take one card at a time, so only the last card in column 1 — the Six of Clubs — can go up right now.',
    );
    ok(s, t2f(0, 1));
  });

  test('foundation cards may come back down to the tableau', () => {
    const s = build({ piles: [['', '7S']], home: { H: 6 } });
    ok(s, f2t('H', 0));
    const n = E.applyMove(s, f2t('H', 0));
    expect(n.foundations.H).toHaveLength(5);
    expect(n.tableau[0]?.faceUp).toEqual(['7S', '6H']);
    expect(reason(s, f2t('H', 1))).toBe(
      "Only a King can go into an empty column. The Six of Hearts can't start a new column.",
    );
  });

  test('foundation-to-foundation, empty foundations and unknown suits are explained', () => {
    const s = build({ piles: [['', '7S']], home: { H: 6 } });
    expect(
      reason(s, {
        type: 'move',
        from: { kind: 'foundation', suit: 'H' },
        to: { kind: 'foundation' },
      }),
    ).toBe('The Six of Hearts is already on its foundation.');
    expect(reason(s, f2t('S', 0))).toBe(
      'The Spades foundation is empty — there is no card there to take back.',
    );
    expect(
      reason(s, {
        type: 'move',
        from: { kind: 'foundation', suit: 'X' },
        to: { kind: 'tableau', pile: 0 },
      }),
    ).toContain('There is no foundation like that');
  });
});

// ---------------------------------------------------------------------------
// Automatic flip & progress tracking
// ---------------------------------------------------------------------------

describe('face-down cards turn over automatically', () => {
  test('when the last face-up card leaves for another column', () => {
    const s = build({
      piles: [
        ['2D 9C', '7H'],
        ['', '8S'],
      ],
    });
    const n = E.applyMove(s, t2t(0, 0, 1));
    expect(n.tableau[0]).toEqual({ faceDown: ['2D'], faceUp: ['9C'] });
    expect(n.flips).toBe(1);
    expect(n.lastFlipped).toBe('9C');
    expect(n.lastProgressAt).toBe(1);
  });

  test('when the last face-up card goes to a foundation', () => {
    const s = build({ piles: [['QC', 'AS']] });
    const n = E.applyMove(s, t2f(0, 0));
    expect(n.tableau[0]).toEqual({ faceDown: [], faceUp: ['QC'] });
    expect(n.lastFlipped).toBe('QC');
  });

  test('a column with nothing hidden simply becomes empty', () => {
    const s = build({
      piles: [
        ['', '7H'],
        ['', '8S'],
      ],
    });
    const n = E.applyMove(s, t2t(0, 0, 1));
    expect(n.tableau[0]).toEqual({ faceDown: [], faceUp: [] });
    expect(n.flips).toBe(0);
  });

  test('progress counts flips, waste plays and new foundation highs — not shuffling', () => {
    let s = build({
      stock: '3D',
      waste: '6D',
      piles: [
        ['', '7S'],
        ['', '8H 7C'],
        ['', '8D'],
      ],
      home: { H: 6 },
    });
    s = E.applyMove(s, DRAW); // move 1: no progress
    expect(s.lastProgressAt).toBe(0);
    s = E.applyMove(s, t2t(1, 1, 2)); // move 2: 7♣ from 8♥ to 8♦ — lateral, no progress
    expect(s.lastProgressAt).toBe(0);
    s = E.applyMove(s, f2t('H', 0)); // move 3: 6♥ down — no progress
    expect(s.lastProgressAt).toBe(0);
    s = E.applyMove(s, t2f(0, 1)); // move 4: 6♥ back up — not a new high
    expect(s.lastProgressAt).toBe(0);
    expect(s.bestHome).toBe(6);
    expect(s.moveCount).toBe(4);
  });
});

describe('progress bookkeeping', () => {
  test('a waste play and a new foundation high both count as progress', () => {
    let s = build({ waste: '6D', piles: [['', '7S']], home: { H: 6 } });
    s = E.applyMove(s, w2t(0));
    expect(s.lastProgressAt).toBe(1);
    s = build({ waste: '7H', home: { H: 6 } });
    s = E.applyMove(s, W2F);
    expect(s.bestHome).toBe(7);
    expect(s.lastProgressAt).toBe(1);
  });

  test('the last card move is remembered; draws and recycles forget it', () => {
    let s = build({
      stock: '2C',
      piles: [
        ['', '7H'],
        ['', '8S'],
        ['', '8C'],
      ],
    });
    s = E.applyMove(s, t2t(0, 0, 1));
    expect(s.last).toEqual({ card: '7H', from: 'tableau', fromPile: 0, to: 'tableau', toPile: 1 });
    s = E.applyMove(s, DRAW);
    expect(s.last).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Resign, game over, turns, malformed input
// ---------------------------------------------------------------------------

describe('resigning and the end of the game', () => {
  test('"I\'m done" is always legal and ends the game', () => {
    const fresh = E.setup({ players: 1 }, createRng(5));
    ok(fresh, RESIGN);
    const dead = build({ piles: [['', '5S']] });
    expect(keys(dead)).toEqual(['resign']);
    const s = E.applyMove(fresh, RESIGN);
    expect(E.isOver(s)).toBe(true);
    expect(E.currentPlayer(s)).toBeNull();
    expect(E.legalMoves(s, 0)).toEqual([]);
    expect(reason(s, DRAW)).toBe('This game is over — deal a new game to keep playing.');
    expect(() => E.applyMove(s, DRAW)).toThrow(IllegalMoveError);
    expect(() => E.botMove(s, 0, 'normal', createRng(1))).toThrow();
    expect(E.coach(s, 0).suggestion).toBeUndefined();
  });

  test('sending the 52nd card home ends the game automatically', () => {
    const s = oneToGo();
    const n = E.applyMove(s, t2f(0, 0));
    expect(E.isOver(n)).toBe(true);
    expect(E.currentPlayer(n)).toBeNull();
    expect(reason(n, RESIGN)).toBe(
      'You already cleared the board — all 52 cards are home! Deal a new game to play again.',
    );
    expect(E.coach(n, 0).situation).toContain('all 52 cards are home');
  });
});

describe('turns and malformed moves', () => {
  test('only seat 0 plays', () => {
    const s = E.setup({ players: 1 }, createRng(5));
    expect(E.legalMoves(s, 1)).toEqual([]);
    expect(E.checkMove(s, 1, DRAW)).toEqual({
      ok: false,
      reason: "Klondike is played solo — Player 1 doesn't have a turn.",
    });
    expect(() => E.botMove(s, 1, 'normal', createRng(1))).toThrow();
    expect(E.coach(s, 2).suggestion).toBeUndefined();
    expect(E.coach(s, 2).situation).toContain('Player 2');
  });

  test.each([
    null,
    42,
    {},
    { type: 'jump' },
    { type: 'move' },
    { type: 'move', from: { kind: 'hand' }, to: { kind: 'foundation' } },
    { type: 'move', from: { kind: 'waste' }, to: { kind: 'waste' } },
    { type: 'move', from: { kind: 'tableau', pile: 0 }, to: { kind: 'foundation' } },
  ])('rejects malformed move %j with an explanation', (m) => {
    const s = E.setup({ players: 1 }, createRng(5));
    expect(reason(s, m)).toContain("That isn't a Klondike move.");
    expect(() => E.applyMove(s, m as KlondikeMove)).toThrow(IllegalMoveError);
    expect(typeof E.describeMove(s, 0, m as KlondikeMove)).toBe('string');
    expect(typeof E.moveKey(m as KlondikeMove)).toBe('string');
  });

  test('every illegal move throws IllegalMoveError with the checkMove reason', () => {
    const s = build({ waste: '7H', piles: [['', '8D']] });
    expect(() => E.applyMove(s, w2t(0))).toThrow(
      new IllegalMoveError(
        'A red 7 must go on a black 8 — the Eight of Diamonds is red too, and the colours must alternate.',
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** A resigned position with exactly `home` foundation cards (filled suit by suit). */
function resignedWith(home: number, extra: Partial<KlondikeState> = {}): KlondikeState {
  const counts: Partial<Record<Suit, number>> = {};
  let left = home;
  for (const suit of SUITS) {
    const n = Math.min(13, left);
    counts[suit] = n;
    left -= n;
  }
  return build({ home: counts, extra: { resigned: true, ...extra } });
}

describe('Vegas-style scoring', () => {
  test('net units = 5 × cards home ÷ 52 − 1', () => {
    expect(vegasNetUnits(0)).toBe(-1);
    expect(vegasNetUnits(52)).toBe(4);
    expect(vegasNetUnits(26)).toBeCloseTo(1.5, 12);
    expect(vegasNetUnits(10)).toBeLessThan(0);
    expect(vegasNetUnits(11)).toBeGreaterThan(0);
    expect(BREAK_EVEN_CARDS).toBe(11);
  });

  test('stopping with nothing home loses the whole stake', () => {
    const r = E.result(resignedWith(0));
    expect(r).toMatchObject({ winners: [], humanOutcome: 'loss', humanNetUnits: -1, scores: [0] });
    expect(r.flags).toMatchObject({
      folded: true,
      perfect: false,
      bigPot: false,
      closeFinish: false,
    });
    expect(r.flags.tags).toEqual(['resigned', 'nothingHome']);
    expect(r.summary).toBe(
      'You stopped before any card reached a foundation, so the stake is lost.',
    );
  });

  test('some cards home wins part of the stake back but is still a loss below 11', () => {
    const r = E.result(resignedWith(6));
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBeCloseTo(30 / 52 - 1, 12);
    expect(r.flags.closeFinish).toBe(false);
    expect(r.summary).toContain('6 cards home');
  });

  test('10 cards is a close loss, 11 cards a close win', () => {
    const ten = E.result(resignedWith(10));
    expect(ten.humanOutcome).toBe('loss');
    expect(ten.flags.closeFinish).toBe(true);
    expect(ten.summary).toContain('just one short');
    const eleven = E.result(resignedWith(11));
    expect(eleven.humanOutcome).toBe('win');
    expect(eleven.winners).toEqual([0]);
    expect(eleven.humanNetUnits).toBeCloseTo(55 / 52 - 1, 12);
    expect(eleven.flags.closeFinish).toBe(true);
    expect(eleven.flags.folded).toBe(true);
    expect(E.result(resignedWith(12)).flags.closeFinish).toBe(false);
  });

  test('a big Vegas haul (net ≥ 3 units) starts at 42 cards', () => {
    expect(E.result(resignedWith(41)).flags.bigPot).toBe(false);
    const r = E.result(resignedWith(42));
    expect(r.flags.bigPot).toBe(true);
    expect(r.humanNetUnits).toBeGreaterThanOrEqual(3);
    expect(r.flags.tags).toContain('allAcesHome');
  });

  test('clearing the board pays +4 units and is perfect', () => {
    const done = E.applyMove(oneToGo({ recycles: 1 }), t2f(0, 0));
    const r = E.result(done);
    expect(r).toMatchObject({ winners: [0], humanOutcome: 'win', humanNetUnits: 4, scores: [52] });
    expect(r.flags).toMatchObject({
      perfect: true,
      bigPot: true,
      folded: false,
      bust: false,
      comeback: false,
      closeFinish: false,
    });
    expect(r.flags.tags).toEqual(['cleared', 'allAcesHome']);
    expect(r.summary).toContain('all 52 cards');
  });

  test('clearing without ever turning the waste over is tagged firstPass', () => {
    const r = E.result(E.applyMove(oneToGo(), t2f(0, 0)));
    expect(r.flags.tags).toContain('firstPass');
  });

  test('comeback = cleared after three or more passes back through the stock', () => {
    expect(E.result(E.applyMove(oneToGo({ recycles: 3 }), t2f(0, 0))).flags.comeback).toBe(true);
    expect(E.result(E.applyMove(oneToGo({ recycles: 2 }), t2f(0, 0))).flags.comeback).toBe(false);
    expect(E.result(resignedWith(40, { recycles: 9 })).flags.comeback).toBe(false);
  });

  test('luckyLastCard = the last card home turned a loss into a win (exactly 11, never more)', () => {
    expect(E.result(resignedWith(11)).flags.luckyLastCard).toBe(true);
    expect(E.result(resignedWith(10)).flags.luckyLastCard).toBe(false);
    expect(E.result(resignedWith(12)).flags.luckyLastCard).toBe(false);
    // Twelve were home and one came back down: no card going home decided this result.
    expect(E.result(resignedWith(11, { bestHome: 12 })).flags.luckyLastCard).toBe(false);
    // A clear is never "lucky last card", even when the last hidden card was the last home.
    const cleared = E.applyMove(oneToGo({ lastFlipped: 'KH', flips: 21 }), t2f(0, 0));
    expect(E.result(cleared).flags.luckyLastCard).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Immutability, determinism, keys, legality agreement
// ---------------------------------------------------------------------------

describe('purity', () => {
  test('applyMove never mutates its (deep-frozen) input', () => {
    const cases: Array<[KlondikeState, KlondikeMove]> = [
      [build({ stock: '2C 9H' }), DRAW],
      [build({ waste: '2C 9H' }), RECYCLE],
      [
        build({
          piles: [
            ['2D 9C', '7H'],
            ['', '8S'],
          ],
        }),
        t2t(0, 0, 1),
      ],
      [build({ piles: [['QC', 'AS']] }), t2f(0, 0)],
      [build({ waste: '6D', piles: [['', '7S']] }), w2t(0)],
      [build({ piles: [['', '7S']], home: { H: 6 } }), f2t('H', 0)],
      [build({ stock: '2C' }), RESIGN],
    ];
    for (const [s, m] of cases) {
      const before = JSON.stringify(s);
      deepFreeze(s);
      const n = E.applyMove(s, m);
      expect(JSON.stringify(s)).toBe(before);
      expect(n).not.toBe(s);
    }
  });

  test('same seed and same bot → exactly the same game', () => {
    const play = (difficulty: 'easy' | 'normal') => {
      let s = E.setup({ players: 1 }, createRng('det-7'));
      const rng = createRng('bot-det-7');
      const log: string[] = [];
      while (!E.isOver(s)) {
        const m = E.botMove(s, 0, difficulty, rng);
        log.push(E.moveKey(m));
        s = E.applyMove(s, m);
      }
      return { log, result: E.result(s) };
    };
    expect(play('normal')).toEqual(play('normal'));
    expect(play('easy')).toEqual(play('easy'));
  });
});

describe('move keys', () => {
  test('keys are stable and unique per distinct move', () => {
    expect(klondikeMoveKey(t2t(1, 2, 3))).toBe('move:t1.2>t3');
    expect(klondikeMoveKey(t2t(1, 2, 3))).toBe(E.moveKey(t2t(1, 2, 3)));
    expect(E.moveKey(W2F)).toBe('move:w>f');
    expect(E.moveKey(w2t(4))).toBe('move:w>t4');
    expect(E.moveKey(t2f(0, 5))).toBe('move:t0.5>f');
    expect(E.moveKey(f2t('H', 6))).toBe('move:fH>t6');
    expect(E.moveKey(DRAW)).toBe('draw');
    for (const s of randomStates(40)) {
      const ks = keys(s);
      expect(new Set(ks).size).toBe(ks.length);
    }
    const all = everyMove(
      build({
        piles: [
          ['', '9S 8H 7C'],
          ['', 'TD'],
        ],
      }),
    ).map(E.moveKey);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('legalMoves and checkMove agree exactly', () => {
  test('on many real positions, every possible move', () => {
    const states = [
      ...randomStates(120),
      build({
        waste: 'KD',
        piles: [
          ['3C', 'KS QH JC'],
          ['', ''],
        ],
        home: { H: 13 },
      }),
      build({
        piles: [
          ['', '9S 4H'],
          ['', 'TD'],
        ],
      }),
      build({
        piles: [
          ['4C', ''],
          ['', 'TD'],
        ],
      }),
    ];
    for (const s of states) {
      const legal = new Set(keys(s));
      for (const m of everyMove(s)) {
        const c = E.checkMove(s, 0, m);
        expect(c.ok, `${E.moveKey(m)}: ${c.reason}`).toBe(legal.has(E.moveKey(m)));
        if (!c.ok) expect(c.reason?.length).toBeGreaterThan(10);
      }
      for (const m of E.legalMoves(s, 0)) expect(() => E.applyMove(s, m)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

describe('autoFoundationMoves / canAutoFinish / isStuck', () => {
  test('sends only safe cards home, in an order that stays legal', () => {
    const s = build({
      waste: 'AS',
      piles: [
        ['', '2S'],
        ['', '5H'],
        ['QD', '3S'],
      ],
      home: { H: 4, D: 2 },
    });
    expect(isSafeHome(s, '5H')).toBe(false);
    const moves = autoFoundationMoves(s);
    expect(moves.map(E.moveKey)).toEqual(['move:w>f', 'move:t0.0>f', 'move:t2.0>f']);
    let cur = s;
    for (const m of moves) cur = E.applyMove(cur, m);
    expect(cur.foundations.S).toEqual(['AS', '2S', '3S']);
    expect(cur.tableau[1]?.faceUp).toEqual(['5H']);
  });

  test('finishes the whole board once everything is face up and the stock is used', () => {
    const s = build({
      piles: [
        ['', 'KS QH JS TH 9S 8H 7S 6H 5S 4H 3S 2H AS'],
        ['', 'KH QS JH TS 9H 8S 7H 6S 5H 4S 3H 2S AH'],
        ['', 'KD QC JD TC 9D 8C 7D 6C 5D 4C 3D 2C AD'],
        ['', 'KC QD JC TD 9C 8D 7C 6D 5C 4D 3C 2D AC'],
      ],
    });
    expect(canAutoFinish(s)).toBe(true);
    const moves = autoFoundationMoves(s);
    expect(moves).toHaveLength(52);
    let cur = s;
    for (const m of moves) cur = E.applyMove(cur, m);
    expect(E.isOver(cur)).toBe(true);
    expect(E.result(cur).flags.perfect).toBe(true);
  });

  test('canAutoFinish needs no hidden cards and an empty stock and waste', () => {
    expect(canAutoFinish(build({ piles: [['2C', 'KS']] }))).toBe(false);
    expect(canAutoFinish(build({ stock: '2C', piles: [['', 'KS']] }))).toBe(false);
    expect(canAutoFinish(build({ waste: '2C', piles: [['', 'KS']] }))).toBe(false);
    expect(canAutoFinish(build({ piles: [['', 'KS']], extra: { resigned: true } }))).toBe(false);
  });

  test('isStuck only when no card anywhere can ever move again', () => {
    const dead = build({
      stock: '9D',
      waste: '4C',
      piles: [
        ['7S', '5S'],
        ['8D', '9H'],
      ],
    });
    expect(isStuck(dead)).toBe(true);
    const live = build({
      stock: '8S',
      waste: '4C',
      piles: [
        ['7S', '5S'],
        ['8D', '9H'],
      ],
    });
    expect(isStuck(live)).toBe(false); // the 8♠ in the stock fits on the 9♥
    const tableMove = build({
      piles: [
        ['7S', '4H'],
        ['', '5S'],
      ],
    });
    expect(isStuck(tableMove)).toBe(false);
  });

  test('labels never reveal the hidden card a move would turn over', () => {
    const s = build({
      stock: 'AH',
      piles: [
        ['QC', '7H'],
        ['', '8S'],
      ],
    });
    expect(klondikeMoveLabel(DRAW, s)).toBe('Draw a card');
    expect(klondikeMoveLabel(t2t(0, 0, 1), s)).toBe('7♥ → column 2');
    expect(klondikeMoveLabel(RESIGN, s)).toBe("I'm done");
    expect(klondikeMoveLabel(RECYCLE, s)).toBe('Turn the waste over');
    expect(
      klondikeMoveLabel(
        t2t(0, 0, 1),
        build({
          piles: [
            ['', '8S 7H'],
            ['', '9D'],
          ],
        }),
      ),
    ).toBe('8♠ (+1) → column 2');
  });
});

// ---------------------------------------------------------------------------
// describeMove
// ---------------------------------------------------------------------------

describe('describeMove', () => {
  test("describes every kind of move from the actor's point of view", () => {
    expect(E.describeMove(build({ stock: '2C 7C' }), 0, DRAW)).toBe(
      'You drew the Seven of Clubs from the stock.',
    );
    expect(E.describeMove(build({ waste: '2C' }), 0, RECYCLE)).toBe(
      'You turned the waste over to make a new stock (pass 2 through the cards).',
    );
    expect(E.describeMove(build({ waste: 'AH' }), 0, W2F)).toBe(
      'You put the Ace of Hearts from the waste on the Hearts foundation.',
    );
    expect(E.describeMove(build({ waste: '6D', piles: [['', '7S']] }), 0, w2t(0))).toBe(
      'You moved the Six of Diamonds from the waste onto the Seven of Spades in column 1.',
    );
    expect(
      E.describeMove(
        build({
          piles: [
            ['QS', '7C 6H'],
            ['', ''],
            ['', ''],
            ['', ''],
            ['', '8H'],
          ],
        }),
        0,
        t2t(0, 0, 4),
      ),
    ).toBe(
      'You moved 2 cards (the Seven of Clubs down to the Six of Hearts) from column 1 onto the Eight of Hearts in column 5 and turned over the Queen of Spades in column 1.',
    );
    expect(
      E.describeMove(
        build({
          piles: [
            ['', 'KS'],
            ['', ''],
          ],
        }),
        0,
        t2t(0, 0, 1),
      ),
    ).toBe('You moved the King of Spades from column 1 into empty column 2.');
    expect(E.describeMove(build({ piles: [['', '7S']], home: { H: 6 } }), 0, f2t('H', 0))).toBe(
      'You took the Six of Hearts back down from the Hearts foundation and put it on the Seven of Spades in column 1.',
    );
    expect(E.describeMove(build({ home: { S: 1 } }), 0, RESIGN)).toBe(
      'You stopped the game with 1 card on the foundations.',
    );
    expect(E.describeMove(oneToGo(), 0, t2f(0, 0))).toBe(
      'You put the King of Hearts from column 1 on the Hearts foundation — that is all 52 cards home!',
    );
  });

  test('uses "Player N" for other seats', () => {
    expect(E.describeMove(build({ stock: '7C' }), 1, DRAW)).toBe(
      'Player 1 drew the Seven of Clubs from the stock.',
    );
  });
});

// ---------------------------------------------------------------------------
// Coach & bots
// ---------------------------------------------------------------------------

const suggestionKey = (s: KlondikeState) => {
  const a = E.coach(s, 0);
  expect(a.suggestion).toBeDefined();
  return E.moveKey(a.suggestion as KlondikeMove);
};

describe('coach', () => {
  test('describes the position in plain words', () => {
    const s = E.setup({ players: 1 }, createRng(9));
    const a = E.coach(s, 0);
    expect(a.situation).toContain('0 cards of 52 are home on the foundations');
    expect(a.situation).toContain('21 face-down cards are still hidden');
    expect(a.situation).toContain('The stock has 24 cards left and the waste is empty.');
    expect(a.situation).toContain("I'm done");
    expect(a.why?.length).toBeGreaterThan(20);
  });

  test('Aces go home first', () => {
    const s = build({
      stock: '3D',
      waste: 'AC',
      piles: [
        ['4H 5H', '7H'],
        ['', '8S'],
      ],
    });
    expect(suggestionKey(s)).toBe('move:w>f');
    expect(E.coach(s, 0).why).toContain('Aces start the foundations');
  });

  test('frees the column with the most hidden cards', () => {
    const s = build({
      stock: '3D',
      piles: [
        ['4H', '7H'],
        ['', '8S'],
        ['5C 6C 9D', '7D'],
        ['', '8C'],
      ],
    });
    expect(suggestionKey(s)).toMatch(/^move:t2\.0>t[13]$/);
    expect(E.coach(s, 0).why).toContain('turns over a face-down card');
  });

  test('draws when nothing useful can move', () => {
    const s = build({
      stock: '3D 4D',
      piles: [
        ['4H', '7H'],
        ['', '9S'],
      ],
    });
    expect(suggestionKey(s)).toBe('draw');
  });

  test('turns the waste over when a waste card can be used, otherwise banks and stops', () => {
    const useful = build({ waste: '8S 3D', piles: [['4H', '9H']] });
    expect(suggestionKey(useful)).toBe('recycle');
    const stuck = build({ waste: '8D 3D', piles: [['4H', '9H']], home: { C: 1 } });
    expect(suggestionKey(stuck)).toBe('resign');
    expect(E.coach(stuck, 0).why).toContain("I'm done");
    const bankable = build({ waste: '8D 2C', piles: [['4H', '9H']], home: { C: 1 } });
    // The 2♣ is the waste card and can go home — it is "safe", so it is played normally.
    expect(suggestionKey(bankable)).toBe('move:w>f');
  });

  test('when stuck, banks unsafe cards before stopping', () => {
    // 6♥ can go home but is not safe (black 5s are not home) and nothing else works.
    const s = build({
      waste: '9C',
      piles: [
        ['4C', '6H'],
        ['', 'KD'],
      ],
      home: { H: 5 },
      extra: { recycles: 1 },
    });
    expect(suggestionKey(s)).toBe('move:t0.0>f'); // turns over the 4♣ — worth it on its own
    expect(E.coach(s, 0).why).toContain('turns over the face-down card under it');
    const t = build({
      waste: '9C',
      piles: [
        ['', '6H'],
        ['', 'KD'],
      ],
      home: { H: 5 },
      extra: { recycles: 1 },
    });
    expect(suggestionKey(t)).toBe('move:t0.0>f');
    expect(E.coach(t, 0).why).toContain('every card home earns back 5/52 of your stake');
  });

  test('keeps drawing to reach a remembered card that can still go home', () => {
    const s = build({
      stock: '7H 9C',
      waste: 'QS',
      piles: [
        ['4C', '5C'],
        ['', 'KS'],
      ],
      home: { H: 6 },
      extra: { recycles: 1 },
    });
    // Nothing fits in the columns, but the 7♥ (seen on an earlier pass) can go home.
    expect(suggestionKey(s)).toBe('draw');
    expect(E.coach(s, 0).why).toContain('keep going through the stock');
  });

  test('never suggests anything for a finished game or another seat', () => {
    expect(E.coach(resignedWith(3), 0).suggestion).toBeUndefined();
    expect(E.coach(E.setup({ players: 1 }, createRng(1)), 1).suggestion).toBeUndefined();
  });

  test('suggestions are always legal and explanations never reveal hidden cards', () => {
    for (const s of randomStates(150, 7)) {
      const a = E.coach(s, 0);
      const key = E.moveKey(a.suggestion as KlondikeMove);
      expect(keys(s)).toContain(key);
      const text = `${a.situation} ${a.why ?? ''}`;
      const hidden = [
        ...s.tableau.flatMap((p) => p.faceDown),
        ...(s.recycles === 0 ? s.stock : []),
      ];
      for (const c of hidden) expect(text).not.toContain(cardName(c));
    }
  });
});

/** Re-deal every hidden card (face-down cards, plus the unseen stock on the first pass). */
function scrambleHidden(s: KlondikeState, rng: Rng): KlondikeState {
  const stockHidden = s.recycles === 0;
  const pool = shuffle(
    [...s.tableau.flatMap((p) => p.faceDown), ...(stockHidden ? s.stock : [])],
    rng,
  );
  let pos = 0;
  const take = (n: number) => {
    const out = pool.slice(pos, pos + n);
    pos += n;
    return out;
  };
  const tableau = s.tableau.map((p) => ({ faceDown: take(p.faceDown.length), faceUp: p.faceUp }));
  return { ...s, tableau, stock: stockHidden ? take(s.stock.length) : s.stock };
}

describe('bots', () => {
  test('the normal bot only uses information the player could know', () => {
    const rng = createRng('scramble');
    for (const s of randomStates(150, 3)) {
      const want = E.moveKey(E.botMove(s, 0, 'normal', createRng(1)));
      for (let k = 0; k < 3; k++) {
        const t = scrambleHidden(s, rng);
        expect(E.moveKey(E.botMove(t, 0, 'normal', createRng(1)))).toBe(want);
        expect(E.moveKey(E.coach(t, 0).suggestion as KlondikeMove)).toBe(want);
      }
    }
  });

  test('the easy bot only uses information the player could know', () => {
    const rng = createRng('scramble-easy');
    for (const s of randomStates(80, 4)) {
      const want = E.moveKey(E.botMove(s, 0, 'easy', createRng('same')));
      const t = scrambleHidden(s, rng);
      expect(E.moveKey(E.botMove(t, 0, 'easy', createRng('same')))).toBe(want);
    }
  });

  test('both bots always choose legal moves', () => {
    const rng = createRng('legal');
    for (const s of randomStates(150, 5)) {
      for (const d of ['easy', 'normal'] as const) {
        const m = E.botMove(s, 0, d, rng);
        expect(keys(s)).toContain(E.moveKey(m));
      }
    }
  });

  test('with nothing at all to do, both bots resign', () => {
    const s = build({ piles: [['', '5S']] });
    expect(E.botMove(s, 0, 'normal', createRng(1))).toEqual(RESIGN);
    expect(E.botMove(s, 0, 'easy', createRng(1))).toEqual(RESIGN);
  });

  test('the normal bot never shuffles a lone King between empty columns', () => {
    const s = build({
      stock: '3D',
      piles: [
        ['', 'KS QH'],
        ['', ''],
      ],
    });
    expect(E.botMove(s, 0, 'normal', createRng(1))).toEqual(DRAW);
  });

  test('the normal bot does not empty a column unless a King is waiting for it', () => {
    // Every column is in use, so emptying column 1 only helps if a King can take its place.
    const rest: Array<[string, string]> = [
      ['', '4C'],
      ['', '4S'],
      ['', 'JS'],
      ['', 'JC'],
    ];
    const noKing = build({ stock: '3D', piles: [['', '7H'], ['', '8S'], ['5C', 'QD'], ...rest] });
    expect(E.botMove(noKing, 0, 'normal', createRng(1))).toEqual(DRAW);
    const king = build({ stock: '3D', piles: [['', '7H'], ['', '8S'], ['5C', 'KD'], ...rest] });
    expect(E.moveKey(E.botMove(king, 0, 'normal', createRng(1)))).toBe('move:t0.0>t1');
  });

  test('the normal bot never undoes its previous move', () => {
    // The 6♥ was just brought down onto the 7♠. Sending it straight back up would be a
    // "safe" foundation move (both black 5s are home) — but it is exactly the undo.
    const last = {
      card: '6H',
      from: 'foundation',
      fromPile: null,
      to: 'tableau',
      toPile: 0,
    } as const;
    const s = build({
      stock: '3D',
      piles: [['', '7S 6H']],
      home: { H: 5, S: 5, C: 5 },
      extra: { last },
    });
    expect(E.botMove(s, 0, 'normal', createRng(1))).toEqual(DRAW);
    const fresh = { ...s, last: null };
    expect(E.moveKey(E.botMove(fresh, 0, 'normal', createRng(1)))).toBe('move:t0.1>f');
  });

  test('the normal bot brings a foundation card down when it frees a hidden card', () => {
    // 6♥ comes down onto the 7♠ so the 5♣ (on face-down cards) can follow it.
    const s = build({
      stock: '3D',
      piles: [
        ['', '7S'],
        ['QD JC', '5C'],
      ],
      home: { H: 6, C: 4 },
    });
    expect(E.moveKey(E.botMove(s, 0, 'normal', createRng(1)))).toBe('move:t1.0>f');
    const t = build({
      stock: '3D',
      piles: [
        ['', '7S'],
        ['QD JC', '5C'],
      ],
      home: { H: 6, C: 3, S: 3 },
    });
    expect(E.moveKey(E.botMove(t, 0, 'normal', createRng(1)))).toBe('move:fH>t0');
  });

  test('the backstop makes a stalled bot bank its cards and stop', () => {
    const s = build({
      stock: '3D',
      waste: '9C',
      piles: [
        ['', '6H'],
        ['', 'KD'],
      ],
      home: { H: 5 },
      extra: { moveCount: STALL_LIMIT + 5, lastProgressAt: 0 },
    });
    expect(E.moveKey(E.botMove(s, 0, 'normal', createRng(1)))).toBe('move:t0.0>f');
    const after = applyUnchecked(s, t2f(0, 0));
    expect(E.botMove({ ...after, lastProgressAt: 0 }, 0, 'normal', createRng(1))).toEqual(RESIGN);
    // The coach ignores the backstop and still suggests drawing.
    expect(decide(s, 'normal', null, { backstop: false }).move).toEqual(DRAW);
    expect(E.coach(s, 0).suggestion).toEqual(DRAW);
  });

  test('a normal decision is quick', () => {
    const states = randomStates(60, 9);
    const t0 = performance.now();
    for (const s of states) E.botMove(s, 0, 'normal', createRng(1));
    expect((performance.now() - t0) / states.length).toBeLessThan(10);
  });

  test('legalMoves is complete for a known position', () => {
    const s = build({
      stock: '2C',
      waste: '6D',
      piles: [
        ['', '7S'],
        ['', '8H 7C'],
      ],
      home: { H: 6 },
    });
    expect(listLegalMoves(s).map(E.moveKey)).toEqual([
      'move:w>t0',
      'move:w>t1',
      'move:fH>t0',
      'move:fH>t1',
      'draw',
      'resign',
    ]);
  });
});
