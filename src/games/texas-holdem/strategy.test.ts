import { describe, expect, it } from 'vitest';
import { type CardCode, makeDeck } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import type { Difficulty } from '@/games/core/types';
import engine, { type TexasHoldemMove, type TexasHoldemState } from './engine';
import {
  ANY_HAND,
  chenScore,
  describeHole,
  describeHoldings,
  estimateEquity,
  findDraws,
  readRanges,
  seatView,
} from './strategy';
import { A, B, C, F, R, X, cards, deal, play } from './test-helpers';

const keys = (s: TexasHoldemState, p: number) => engine.legalMoves(s, p).map(engine.moveKey);
const DIFFS: Difficulty[] = ['easy', 'normal'];

/** Bot moves for `seat` over many rng seeds. */
function botMoves(s: TexasHoldemState, seat: number, d: Difficulty, n = 60): TexasHoldemMove[] {
  return Array.from({ length: n }, (_, i) => engine.botMove(s, seat, d, createRng(`bm-${i}`)));
}

describe('starting-hand chart (Chen formula)', () => {
  it('scores classic hands', () => {
    const score = (s: string) => chenScore(cards(s));
    expect(score('AS AH')).toBe(20);
    expect(score('KS KD')).toBe(16);
    expect(score('QC QD')).toBe(14);
    expect(score('2C 2D')).toBe(5);
    expect(score('AS KS')).toBe(12);
    expect(score('AS KD')).toBe(10);
    expect(score('JS TS')).toBe(9);
    expect(score('7C 2D')).toBe(-1);
  });

  it('describes hole cards in plain words', () => {
    expect(describeHole(cards('QS QH'))).toBe('a pair of Queens');
    expect(describeHole(cards('KD AD'))).toBe('Ace-King of the same suit');
    expect(describeHole(cards('7C 2D'))).toBe('Seven-Two in different suits');
  });
});

describe('draws', () => {
  it('finds flush draws, open-ended and inside straight draws (only with a hole card, before the river)', () => {
    expect(findDraws(cards('AH 5H'), cards('KH 9H 2C'))).toEqual({ flush: true, straight: 0 });
    expect(findDraws(cards('9C 8D'), cards('7S 6H 2C'))).toEqual({ flush: false, straight: 2 });
    expect(findDraws(cards('9C 8D'), cards('6S 5H 2C'))).toEqual({ flush: false, straight: 1 });
    expect(findDraws(cards('2C 3D'), cards('9S TH JC QD'))).toEqual({ flush: false, straight: 0 });
    expect(findDraws(cards('AH 5H'), cards('KH 9H 2C 4D 8S')).flush).toBe(false);
    expect(findDraws(cards('AH 5H'), cards('KH 9H 2H')).flush).toBe(false); // already a flush
  });
});

describe('Monte-Carlo equity', () => {
  it('is about 85% for Aces against one random hand, and drops against more opponents', () => {
    const aces = estimateEquity(cards('AS AH'), [], 1, 3000, createRng('eq-1'));
    expect(aces).toBeGreaterThan(0.8);
    expect(aces).toBeLessThan(0.9);
    const vsFour = estimateEquity(cards('AS AH'), [], 4, 3000, createRng('eq-2'));
    expect(vsFour).toBeLessThan(aces);
    expect(vsFour).toBeGreaterThan(0.45);
  });

  it('is deterministic for a given rng and exact on a finished board with the nuts', () => {
    const a = estimateEquity(cards('9C 8D'), cards('7S 6H 2C'), 2, 150, createRng('same'));
    const b = estimateEquity(cards('9C 8D'), cards('7S 6H 2C'), 2, 150, createRng('same'));
    expect(a).toBe(b);
    expect(estimateEquity(cards('AS KS'), cards('QS JS TS 2D 3C'), 3, 150, createRng(1))).toBe(1);
    expect(estimateEquity(cards('7C 2D'), [], 0, 150, createRng(1))).toBe(1);
  });
});

describe('reading opponents from their public betting', () => {
  // Heads-up, button 0. Seat 0 raises pre-flop and bets every street; seat 1 calls along.
  const barrage = () =>
    play(
      deal({ players: 2, button: 0, hands: ['', 'KC QS'], board: 'AH 8C 6D 2D TH' }),
      [0, R(6)],
      [1, C],
      [1, X],
      [0, B(8)],
      [1, C],
      [1, X],
      [0, B(20)],
      [1, C],
      [1, X],
      [0, B(40)],
    );

  it('turns raises and bets into likely ranges', () => {
    const s = barrage();
    expect(readRanges(seatView(s, 1))).toEqual([{ minChen: 7, aggressiveAt: [3, 4, 5] }]);
    const quiet = play(deal({ players: 3, button: 0 }), C, C, X);
    expect(readRanges(seatView(quiet, 1))).toEqual([ANY_HAND, ANY_HAND]);
    const caller = play(deal({ players: 3, button: 0 }), [0, R(6)], [1, C]);
    expect(readRanges(seatView(caller, 2))).toEqual([
      { minChen: 7, aggressiveAt: [] },
      { minChen: 5, aggressiveAt: [] },
    ]);
  });

  it('an aggressive opponent is given stronger hands than a random one', () => {
    const hole = cards('KC QS');
    const board = cards('AH 8C 6D 2D TH');
    const random = estimateEquity(hole, board, 1, 2000, createRng('r1'));
    const vsBettor = estimateEquity(
      hole,
      board,
      [{ minChen: 7, aggressiveAt: [3, 4, 5] }],
      2000,
      createRng('r2'),
    );
    expect(vsBettor).toBeLessThan(random - 0.1);
    expect(vsBettor).toBeGreaterThan(0.05); // bluffs exist
  });

  it('the normal bot folds King high to a river bet after a barrage', () => {
    const s = barrage();
    expect(s.street).toBe('river');
    expect(s.toAct).toBe(1);
    for (const m of botMoves(s, 1, 'normal')) expect(m).toEqual(F);
    const advice = engine.coach(s, 1);
    expect(advice.suggestion).toEqual(F);
    expect(advice.why).toMatch(/betting suggests/);
  });
});

describe('coach wording', () => {
  it('points out when the made hand is all on the board', () => {
    expect(describeHoldings(cards('KC QC'), cards('2C 9H 2S'))).toBe(
      'Pair of Twos (all on the board, so everyone shares it)',
    );
    expect(describeHoldings(cards('KC 2D'), cards('2C 9H 2S'))).toBe('Three of a Kind, Twos');
    expect(describeHoldings(cards('AH 5H'), cards('KH 9H 2C'))).toBe(
      'High Card, Ace, plus a flush draw (one more card of your suit makes a flush)',
    );
    expect(describeHoldings(cards('AH 5H'), [])).toBe('Ace-Five of the same suit');
  });

  it('does not promise more cards on the river', () => {
    const s = play(
      deal({ players: 2, button: 0, hands: ['', 'KC KD'], board: 'KH 7S 2D 9C 3H' }),
      [0, C],
      [1, X],
      [1, X],
      [0, X],
      [1, X],
      [0, X],
    );
    expect(s.street).toBe('river');
    const advice = engine.coach(s, 1);
    expect(['bet', 'all-in']).toContain((advice.suggestion as TexasHoldemMove).type);
    expect(advice.why).not.toMatch(/see more cards/);
    expect(advice.why).toMatch(/may still call and pay you/);
  });
});

describe('normal bot', () => {
  it('raises (or shoves) Aces and folds Seven-Two under the gun', () => {
    const aces = deal({ players: 6, button: 0, hands: ['', '', '', 'AS AH', '', ''] });
    for (const m of botMoves(aces, 3, 'normal')) expect(['raise', 'all-in']).toContain(m.type);
    const trash = deal({ players: 6, button: 0, hands: ['', '', '', '7C 2D', '', ''] });
    for (const m of botMoves(trash, 3, 'normal')) expect(m).toEqual(F);
  });

  it('checks a weak hand in the big blind instead of folding for free', () => {
    const s = play(deal({ players: 4, button: 0, hands: ['', '', '7C 2D', ''] }), C, C, C);
    for (const m of botMoves(s, 2, 'normal')) expect(m).toEqual(X);
    for (const m of botMoves(s, 2, 'easy')) expect(m.type).not.toBe('fold');
  });

  it('never folds the nuts and folds air to a big river bet', () => {
    const nuts = play(
      deal({ players: 2, button: 0, hands: ['', 'AH 5H'], board: 'KH 9H 2H 4D 8S' }),
      [0, C],
      [1, X],
      [1, X],
      [0, B(4)],
    );
    for (const m of botMoves(nuts, 1, 'normal'))
      expect(['call', 'raise', 'all-in']).toContain(m.type);
    const air = play(
      deal({ players: 2, button: 0, hands: ['', '7C 2D'], board: 'KH 9H 4S JD 8S' }),
      [0, C],
      [1, X],
      [1, X],
      [0, X],
      [1, X],
      [0, X],
      [1, X],
      [0, B(40)],
    );
    expect(air.street).toBe('river');
    for (const m of botMoves(air, 1, 'normal')) expect(m).toEqual(F);
    for (const m of botMoves(air, 1, 'easy')) expect(m).toEqual(F);
  });

  it('bets a strong made hand for value when checked to', () => {
    const s = play(
      deal({ players: 2, button: 0, hands: ['', 'KC KD'], board: 'KH 7S 2D 9C 3H' }),
      [0, C],
      [1, X],
    );
    const moves = botMoves(s, 1, 'normal');
    expect(moves.filter((m) => m.type === 'bet' || m.type === 'all-in').length).toBeGreaterThan(50);
  });

  it('a short stack with a good hand moves all-in', () => {
    const s = deal({
      players: 4,
      button: 0,
      stacks: [100, 100, 100, 16],
      hands: ['', '', '', 'AS KD'],
    });
    for (const m of botMoves(s, 3, 'normal')) expect(m).toEqual(A);
  });
});

describe('easy bot', () => {
  it('folds trash to a big bet but calls small bets a lot', () => {
    const shove = play(
      deal({ players: 4, button: 0, hands: ['', '', '', '7C 2D'] }),
      [3, C],
      [0, A],
    );
    const atShove = play(shove, [1, F], [2, F]);
    for (const m of botMoves(atShove, 3, 'easy')) expect(m).toEqual(F);
    // A so-so hand always limps in; even real trash limps in about half the time.
    const soSo = deal({ players: 4, button: 0, hands: ['', '', '', 'KC 8D'] });
    const calls = botMoves(soSo, 3, 'easy', 100).filter((m) => m.type === 'call').length;
    expect(calls).toBe(100);
    const trash = deal({ players: 4, button: 0, hands: ['', '', '', '9C 4D'] });
    const trashCalls = botMoves(trash, 3, 'easy', 100).filter((m) => m.type === 'call').length;
    expect(trashCalls).toBeGreaterThan(25);
    expect(trashCalls).toBeLessThan(75);
  });

  it('rarely raises', () => {
    const s = deal({ players: 4, button: 0, hands: ['', '', '', 'QC JD'] });
    const raises = botMoves(s, 3, 'easy', 200).filter((m) => m.type === 'raise').length;
    expect(raises).toBe(0);
  });
});

describe('bots in tricky spots', () => {
  const spots: [string, TexasHoldemState, number][] = [];
  // Facing an incomplete all-in raise after having bet: only call / fold allowed.
  const closed = play(
    deal({ players: 3, button: 0, stacks: [100, 100, 14], hands: ['', 'AS AH', ''] }),
    [0, C],
    [1, C],
    [2, X],
    [1, B(10)],
    [2, A],
    [0, C],
  );
  spots.push(['raise closed', closed, 1]);
  // Everyone else all-in.
  spots.push([
    'others all-in',
    play(
      deal({ players: 2, button: 0, stacks: [100, 30], hands: ['KS KH', ''] }),
      [0, R(6)],
      [1, A],
    ),
    0,
  ]);
  // Calling costs the whole stack.
  spots.push(['call is all-in', deal({ players: 4, button: 0, stacks: [100, 100, 100, 2] }), 3]);
  // Stack smaller than a full raise.
  spots.push(['tiny stack', deal({ players: 4, button: 0, stacks: [100, 100, 100, 3] }), 3]);
  // Big blind option.
  spots.push(['big blind option', play(deal({ players: 4, button: 0 }), C, C, C), 2]);
  // Heads-up small blind first to act, and a short-stacked big blind on the flop.
  spots.push(['heads-up', deal({ players: 2, button: 1 }), 1]);
  spots.push(['short flop', play(deal({ players: 2, button: 0, stacks: [100, 3] }), C, X), 1]);

  it.each(spots)('%s: every bot move is legal', (_name, s, seat) => {
    expect(engine.currentPlayer(s)).toBe(seat);
    const legal = keys(s, seat);
    for (const d of DIFFS) {
      for (const m of botMoves(s, seat, d, 40)) {
        expect(legal).toContain(engine.moveKey(m));
        expect(engine.checkMove(s, seat, m).ok).toBe(true);
      }
    }
  });

  it('botMove refuses to move for a seat whose turn it is not', () => {
    const s = deal({ players: 4, button: 0 });
    expect(() => engine.botMove(s, 0, 'normal', createRng(1))).toThrow();
  });
});

describe('no peeking', () => {
  /** Re-deal everything `seat` cannot see (other hole cards, burns, undealt deck). */
  function reshuffleHidden(s: TexasHoldemState, seat: number, seed: string): TexasHoldemState {
    const visible = new Set<CardCode>([...(s.hands[seat] ?? []), ...s.board]);
    const hidden = shuffle(
      makeDeck().filter((c) => !visible.has(c)),
      createRng(seed),
    );
    const take = (n: number) => hidden.splice(0, n);
    return {
      ...s,
      hands: s.hands.map((h, i) => (i === seat ? h.slice() : take(2))),
      burned: take(s.burned.length),
      deck: take(s.deck.length),
    };
  }

  it('a bot decides the same way whatever the cards it cannot see are', () => {
    let checked = 0;
    for (let g = 0; g < 30; g++) {
      let s = engine.setup({ players: 2 + (g % 5) }, createRng(`peek-${g}`));
      const rng = createRng(`peek-bots-${g}`);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s) ?? 0;
        for (const d of DIFFS) {
          const mine = engine.botMove(s, p, d, createRng(`same-${g}-${checked}`));
          const other = reshuffleHidden(s, p, `hidden-${g}-${checked}`);
          expect(seatView(other, p)).toEqual(seatView(s, p));
          expect(engine.botMove(other, p, d, createRng(`same-${g}-${checked}`))).toEqual(mine);
          expect(engine.coach(other, p).suggestion).toEqual(engine.coach(s, p).suggestion);
          checked++;
        }
        s = engine.applyMove(s, engine.botMove(s, p, 'normal', rng));
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe('speed', () => {
  it('normal decisions at a full 6-seat table are quick', () => {
    let worst = 0;
    let total = 0;
    let n = 0;
    for (let g = 0; g < 40; g++) {
      let s = engine.setup({ players: 6 }, createRng(`speed-${g}`));
      const rng = createRng(`speed-bots-${g}`);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s) ?? 0;
        const t0 = performance.now();
        const m = engine.botMove(s, p, 'normal', rng);
        const dt = performance.now() - t0;
        worst = Math.max(worst, dt);
        total += dt;
        n++;
        s = engine.applyMove(s, m);
      }
    }
    expect(total / n).toBeLessThan(5);
    expect(worst).toBeLessThan(150);
  });
});
