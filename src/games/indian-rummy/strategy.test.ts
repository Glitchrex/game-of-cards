import { describe, expect, it } from 'vitest';
import { type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import type { Difficulty } from '@/games/core/types';
import engine, { type IndianRummyMove, type IndianRummyState } from './engine';
import { bestArrangement, isJokerFor } from './melds';
import { chooseMove, completesGroup, connectorCount, partnersOf } from './strategy';
import { buildState, cards } from './test-helpers';

const WILD: CardCode = '7C';
const ALMOST = cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C 2D 8C');
const LOOSE = cards('3C 4C 5C 8H 8D 8S AS KD QH JC 9D 6H 2S');
/** No joker, no pure sequence, hardly anything in a row (the lesson's "hand to drop"). */
const HOPELESS = cards('2S 5S 9S QS 3H 6H TH KH 4D 8D JD AC 5C');
const BOTH: Difficulty[] = ['easy', 'normal'];

function bot(s: IndianRummyState, d: Difficulty, seed = 1): IndianRummyMove {
  const m = engine.botMove(s, s.turn, d, createRng(seed));
  expect(engine.checkMove(s, s.turn, m)).toEqual({ ok: true });
  return m;
}

describe('helpers', () => {
  it('partnersOf lists cards that could group with a card given one more', () => {
    const hand = cards('9H 9D JH 8H KH 9H 7S X1');
    expect(partnersOf(hand, '9H', '7').sort()).toEqual(['8H', '9D', 'JH'].sort());
    expect(partnersOf(hand, '7S', '7')).toEqual([]); // jokers fit anything
  });

  it('completesGroup spots a set or a three-card run made with cards in hand', () => {
    expect(completesGroup(cards('9H 9D 2C'), '9C', '7')).toBe(true);
    expect(completesGroup(cards('9H 9H 2C'), '9H', '7')).toBe(false); // same suit twice
    expect(completesGroup(cards('5H 6H 2C'), '7H', '8')).toBe(true);
    expect(completesGroup(cards('5H 7H 2C'), '6H', '8')).toBe(true);
    expect(completesGroup(cards('QS KS 2C'), 'AS', '8')).toBe(true);
    expect(completesGroup(cards('KS AS 2C'), '2S', '8')).toBe(false); // no wrap
    expect(completesGroup(cards('5H 2C'), 'X1', '8')).toBe(true);
  });

  it('connectorCount counts same-suit cards at most two apart', () => {
    expect(connectorCount(HOPELESS, '7')).toBe(0);
    expect(connectorCount(cards('4S 5S 7S 9H'), '7')).toBe(1); // 7♠ is a joker
  });
});

describe('both bots', () => {
  it('declare as soon as they can', () => {
    const s = engine.applyMove(
      buildState({ hands: [ALMOST, LOOSE], wildCard: WILD, stockTop: ['QH'] }),
      { type: 'draw', from: 'stock' },
    );
    for (const d of BOTH) expect(bot(s, d)).toEqual({ type: 'declare', discard: '8C' });
  });

  it('take a joker from the open pile', () => {
    for (const d of BOTH) {
      const s = buildState({ hands: [LOOSE, ALMOST], wildCard: WILD, discard: ['7H'] });
      expect(bot(s, d)).toEqual({ type: 'draw', from: 'discard' });
    }
  });

  it('take an open card that completes a group, and ignore a useless one', () => {
    for (const d of BOTH) {
      const good = buildState({ hands: [ALMOST, LOOSE], wildCard: WILD, discard: ['QH'] });
      expect(bot(good, d)).toEqual({ type: 'draw', from: 'discard' });
      const useless = buildState({ hands: [ALMOST, LOOSE], wildCard: WILD, discard: ['5D'] });
      expect(bot(useless, d)).toEqual({ type: 'draw', from: 'stock' });
    }
  });

  it('must use the open pile if the closed stock is ever empty, and the stock if the pile is', () => {
    for (const d of BOTH) {
      const s = buildState({ hands: [ALMOST, LOOSE], wildCard: WILD, discard: ['5D'] });
      expect(bot({ ...s, stock: [] }, d).type).not.toBe('discard');
      expect(engine.legalMoves({ ...s, stock: [] }, 0).map(engine.moveKey)).not.toContain(
        'draw:stock',
      );
      expect(bot({ ...s, discard: [] }, d)).toEqual({ type: 'draw', from: 'stock' });
    }
  });

  it('never peek: the move is the same whatever the opponents hold or the stock order', () => {
    let compared = 0;
    for (let seed = 0; seed < 20; seed++) {
      const a = engine.setup({ players: 2 + (seed % 3) }, createRng(`peek-${seed}`));
      // Swap every other seat's hand with 13 stock cards, then reverse the stock.
      let stock = a.stock.slice();
      const hands = a.hands.map((h, i) => {
        if (i === a.turn) return h;
        const fresh = stock.slice(0, 13);
        stock = [...stock.slice(13), ...h];
        return fresh;
      });
      const b: IndianRummyState = { ...a, hands, stock: stock.reverse() };
      let x = a;
      let y = b;
      // Only the original seat's view is identical, so stop when the turn passes.
      for (let step = 0; step < 4 && x.turn === a.turn && !engine.isOver(x); step++) {
        for (const d of BOTH) {
          expect(engine.botMove(x, x.turn, d, createRng(step))).toEqual(
            engine.botMove(y, y.turn, d, createRng(step)),
          );
          compared++;
        }
        const m = engine.botMove(x, x.turn, 'normal', createRng(step));
        if (m.type === 'draw' && m.from === 'stock') break; // the next card differs
        x = engine.applyMove(x, m);
        y = engine.applyMove(y, m);
      }
    }
    expect(compared).toBeGreaterThanOrEqual(40);
  });
});

describe('normal bot', () => {
  it('never throws a joker', () => {
    const hand = cards('4S 5S 6S 9H 7D JH KS KD X1 2H 2C QD 8C 3H');
    const s = buildState({ hands: [hand, LOOSE], wildCard: WILD, phase: 'discard' });
    const m = bot(s, 'normal');
    expect(m.type).toBe('discard');
    if (m.type === 'discard') expect(isJokerFor(m.card, '7')).toBe(false);
  });

  it('throws a loose high card before a connected one', () => {
    const hand = cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C QD 8C 3H');
    const s = buildState({ hands: [hand, LOOSE], wildCard: WILD, phase: 'discard' });
    expect(bot(s, 'normal')).toEqual({ type: 'discard', card: 'QD' });
  });

  it('drops a hopeless opening hand (a first drop) but not one with a joker', () => {
    const s = buildState({ hands: [HOPELESS, LOOSE], wildCard: WILD });
    expect(bot(s, 'normal')).toEqual({ type: 'drop' });
    expect(chooseMove(s, 0, 'normal', null).why).toMatch(/costs only 20 points/);
    expect(bot(s, 'easy').type).toBe('draw');
    const joker = buildState({
      hands: [[...HOPELESS.slice(0, 12), '7D'], LOOSE],
      wildCard: WILD,
    });
    expect(bot(joker, 'normal').type).toBe('draw');
  });

  it('makes a middle drop late in the game without a pure sequence or a joker', () => {
    const late = (turns: number) =>
      buildState({
        hands: [HOPELESS, LOOSE],
        wildCard: WILD,
        hasDrawn: [true, true],
        turnsTaken: [turns, turns],
      });
    expect(bot(late(8), 'normal')).toEqual({ type: 'drop' });
    expect(chooseMove(late(8), 0, 'normal', null).why).toMatch(/middle drop costs 40 points/);
    expect(bot(late(7), 'normal').type).toBe('draw');
  });
});

describe('easy bot', () => {
  it('throws a card that is not in any group (never a joker)', () => {
    const hand = cards('4S 5S 6S 9H 7D JH KS KD X1 2H 2C QD 8C 3H');
    const s = buildState({ hands: [hand, LOOSE], wildCard: WILD, phase: 'discard' });
    const loose = new Set(
      bestArrangement(hand, '7').groups.find((g) => g.kind === 'unmatched')?.cards ?? [],
    );
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const m = bot(s, 'easy', seed);
      expect(m.type).toBe('discard');
      if (m.type !== 'discard') continue;
      expect(loose.has(m.card)).toBe(true);
      expect(isJokerFor(m.card, '7')).toBe(false);
      seen.add(m.card);
    }
    expect(seen.size).toBeGreaterThan(1); // it varies its choice
  });

  it('ignores an open card that only makes a pair', () => {
    const s = buildState({ hands: [ALMOST, LOOSE], wildCard: WILD, discard: ['8D'] });
    expect(bot(s, 'easy')).toEqual({ type: 'draw', from: 'stock' });
  });
});

describe('legality and speed in many positions', () => {
  it('always proposes a legal move, and the normal bot decides quickly', () => {
    let decisions = 0;
    let normalMs = 0;
    for (let g = 0; g < 40; g++) {
      let s = engine.setup({ players: 2 + (g % 5) }, createRng(`pos-${g}`));
      const rng = createRng(`pos-bots-${g}`);
      for (let step = 0; step < 400 && !engine.isOver(s); step++) {
        const p = engine.currentPlayer(s) ?? 0;
        const keys = new Set(engine.legalMoves(s, p).map(engine.moveKey));
        const t0 = performance.now();
        const n = engine.botMove(s, p, 'normal', rng);
        normalMs += performance.now() - t0;
        decisions++;
        const e = engine.botMove(s, p, 'easy', rng);
        expect(keys.has(engine.moveKey(n))).toBe(true);
        expect(keys.has(engine.moveKey(e))).toBe(true);
        s = engine.applyMove(s, g % 2 ? n : e);
      }
    }
    // A few tenths of a millisecond on a laptop; the bound leaves room for slow machines.
    expect(normalMs / decisions).toBeLessThan(10);
  }, 60_000);
});
