/**
 * Rules audit: one focused test per rule in docs/RULES_DECISIONS.md, the engine
 * notes and standard No-Limit Hold'em — with the edge cases (short blinds,
 * short all-ins, multi-level side pots, odd chips, wheel straights, board
 * hands) — plus a seeded random-play fuzz that checks the turn order, the
 * minimum raise and the re-opening rule against an independent model built
 * from the public log.
 */
import { describe, expect, it } from 'vitest';
import { cardName, cardShort, makeDeck } from '@/games/core/cards';
import { createRng, type Rng, shuffle } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError } from '@/games/core/types';
import engine, {
  type TexasHoldemMove,
  type TexasHoldemState,
  betOptions,
  evaluate7,
  potTotal,
} from './engine';
import { A, B, C, F, R, X, checkDown, deal, play } from './test-helpers';

const keys = (s: TexasHoldemState, p: number) => engine.legalMoves(s, p).map(engine.moveKey);
const reason = (s: TexasHoldemState, p: number, m: TexasHoldemMove) => {
  const c = engine.checkMove(s, p, m);
  expect(c.ok).toBe(false);
  return c.reason ?? '';
};
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** Check or call until the street changes (or the hand ends), recording who acted. */
function passStreet(s: TexasHoldemState): { state: TexasHoldemState; order: number[] } {
  const street = s.street;
  const order: number[] = [];
  let t = s;
  while (!engine.isOver(t) && t.street === street) {
    const p = engine.currentPlayer(t) ?? -1;
    order.push(p);
    t = engine.applyMove(t, keys(t, p).includes('check') ? X : C);
  }
  return { state: t, order };
}

// ------------------------------------------------------------ positions

describe('audit: blinds and the order of play for every table size and button', () => {
  it('blinds, pre-flop order (left of the big blind; heads-up the button) and post-flop order (left of the button)', () => {
    for (let n = 2; n <= 6; n++) {
      for (let b = 0; b < n; b++) {
        const s = deal({ players: n, button: b });
        const sb = n === 2 ? b : (b + 1) % n;
        const bb = n === 2 ? (b + 1) % n : (b + 2) % n;
        expect([s.smallBlindSeat, s.bigBlindSeat], `n=${n} b=${b}`).toEqual([sb, bb]);
        expect(s.committed[sb]).toBe(1);
        expect(s.committed[bb]).toBe(2);
        // Pre-flop: everyone in turn starting left of the big blind; the big blind acts last.
        const pre = passStreet(s);
        const preOrder = Array.from({ length: n }, (_, i) => (bb + 1 + i) % n);
        expect(pre.order, `pre-flop n=${n} b=${b}`).toEqual(preOrder);
        expect(pre.state.street).toBe('flop');
        // After the flop: starting left of the button, the button last.
        const flop = passStreet(pre.state);
        const postOrder = Array.from({ length: n }, (_, i) => (b + 1 + i) % n);
        expect(flop.order, `flop n=${n} b=${b}`).toEqual(postOrder);
      }
    }
  });

  it('heads-up hole cards go to the big blind first (one at a time, starting left of the button)', () => {
    const deck = makeDeck();
    const s = engine.setup({ players: 2, options: { button: 1, deck } }, createRng(1));
    expect(s.bigBlindSeat).toBe(0);
    expect(s.hands[0]).toEqual([deck[0], deck[2]]);
    expect(s.hands[1]).toEqual([deck[1], deck[3]]);
  });

  it('after the flop folded and all-in seats are skipped when finding the first to act', () => {
    // 4 seats, button 0: the small blind (1) folds, the big blind (2) is all-in.
    let s = deal({ players: 4, button: 0, stacks: [100, 100, 6, 100] });
    s = play(s, [3, R(6)], [0, C], [1, F], [2, C]);
    expect(s.street).toBe('flop');
    expect(s.toAct).toBe(3);
  });
});

// --------------------------------------------------------------- blinds

describe('audit: short blinds', () => {
  it('heads-up, a big blind smaller than the small blind: nobody has to act, the board is dealt', () => {
    const s = deal({ players: 2, button: 0, stacks: [100, 1] });
    expect(engine.isOver(s)).toBe(true);
    expect(s.committed).toEqual([1, 1]);
    expect(s.board).toHaveLength(5);
    expect(s.log.some((e) => e.kind === 'uncalled')).toBe(false);
  });

  it('heads-up, the small blind all-in from posting: the big blind gets its extra chip back without acting', () => {
    const s = deal({ players: 2, button: 0, stacks: [1, 100] });
    expect(engine.isOver(s)).toBe(true);
    expect(s.log.find((e) => e.kind === 'uncalled')).toEqual({
      kind: 'uncalled',
      player: 1,
      amount: 1,
    });
    expect(s.committed).toEqual([1, 1]);
    expect(sum(s.stacks)).toBe(101);
  });

  it('a short big blind: callers still match the full big blind, and a side pot forms above it', () => {
    let s = deal({
      players: 3,
      button: 0,
      stacks: [100, 100, 1],
      hands: ['KS KH', 'QS QH', 'AS AH'],
      board: '2C 7D 9S 4H 3C',
    });
    expect(betOptions(s, 0).toCall).toBe(2);
    s = play(s, [0, C], [1, C]);
    expect(s.street).toBe('flop');
    s = checkDown(s);
    expect(s.outcome?.pots.map((p) => [p.amount, p.eligible, p.winners])).toEqual([
      [3, [0, 1, 2], [2]],
      [2, [0, 1], [0]],
    ]);
    expect(s.stacks).toEqual([100, 98, 3]);
  });

  it('a short-stacked big blind can only "raise" all-in for less, which does not re-open the betting', () => {
    let s = deal({ players: 3, button: 0, stacks: [100, 100, 3] });
    s = play(s, [0, C], [1, C]);
    expect(s.toAct).toBe(2);
    expect(keys(s, 2)).toEqual(['fold', 'check', 'all-in']);
    s = play(s, [2, A]);
    expect(s.currentBet).toBe(3);
    expect(s.minRaise).toBe(2);
    // Both limpers already acted and face only a 1-chip (incomplete) raise.
    expect(keys(s, 0)).toEqual(['fold', 'call']);
    s = play(s, [0, C]);
    expect(keys(s, 1)).toEqual(['fold', 'call']);
    s = play(s, [1, C]);
    expect(s.street).toBe('flop');
    expect(s.committed).toEqual([3, 3, 3]);
  });
});

// -------------------------------------------------------------- betting

describe('audit: No-Limit betting', () => {
  const headsUpFlop = () => play(deal({ players: 2, button: 0 }), C, X);

  it('check-raise: a player who checked may raise a full bet', () => {
    let s = headsUpFlop();
    s = play(s, [1, X], [0, B(4)]);
    expect(betOptions(s, 1).canRaise).toBe(true);
    expect(betOptions(s, 1).minRaiseTo).toBe(8);
    expect(engine.checkMove(s, 1, R(7)).ok).toBe(false);
    s = play(s, [1, R(8)]);
    expect(s.currentBet).toBe(8);
    expect(s.minRaise).toBe(4);
    // The original bettor faces a full raise, so it may re-raise.
    expect(betOptions(s, 0).canRaise).toBe(true);
    expect(betOptions(s, 0).minRaiseTo).toBe(12);
  });

  it('the slider: every whole bet from the big blind to all-in is legal, anything else is not', () => {
    const s = headsUpFlop();
    const o = betOptions(s, 1);
    expect([o.minBet, o.maxTo]).toEqual([2, 98]);
    for (let amount = 0; amount <= 100; amount++) {
      const ok = amount >= 2 && amount <= 98;
      expect(engine.checkMove(s, 1, B(amount)).ok, `bet ${amount}`).toBe(ok);
    }
    const t = engine.applyMove(s, B(10));
    for (let to = 0; to <= 100; to++) {
      const ok = to >= 20 && to <= 98;
      expect(engine.checkMove(t, 0, R(to)).ok, `raise to ${to}`).toBe(ok);
    }
  });

  it('a raise to exactly the whole stack is an all-in, even when it is smaller than a full raise', () => {
    let s = play(deal({ players: 2, button: 0, stacks: [100, 15] }), C, X);
    s = play(s, [1, X], [0, B(10)]);
    // Seat 1 has 13 left: raising to 13 is short of the 20 minimum, but it is all-in.
    expect(engine.checkMove(s, 1, R(12)).ok).toBe(false);
    expect(engine.checkMove(s, 1, R(13)).ok).toBe(true);
    const t = engine.applyMove(s, R(13));
    expect(t.stacks[1]).toBe(0);
    expect(t.minRaise).toBe(10);
    expect(t.log.at(-1)).toMatchObject({ effect: 'raise', full: false, allIn: true });
  });

  it('an all-in bet smaller than the big blind: a player yet to act may raise to it + the big blind', () => {
    let s = deal({ players: 3, button: 0, stacks: [100, 100, 3] });
    s = play(s, [0, C], [1, C], [2, X]);
    expect(s.street).toBe('flop');
    s = play(s, [1, X], [2, B(1)]);
    expect(s.currentBet).toBe(1);
    expect(s.minRaise).toBe(2);
    expect(betOptions(s, 0).canRaise).toBe(true);
    expect(betOptions(s, 0).minRaiseTo).toBe(3);
    s = play(s, [0, C]);
    // Seat 1 checked and now faces less than a full bet: call or fold only (TDA).
    expect(keys(s, 1)).toEqual(['fold', 'call']);
  });

  it('the all-in move also works as a call when the stack is too small to raise', () => {
    let s = deal({ players: 2, button: 0, stacks: [100, 30] });
    s = play(s, [0, R(40)]);
    expect(keys(s, 1)).toEqual(['fold', 'call']);
    expect(engine.checkMove(s, 1, A).ok).toBe(true);
    expect(engine.describeMove(s, 1, A)).toMatch(/^Player 1 calls all-in for 28 chips\./);
    const t = engine.applyMove(s, A);
    expect(t.log.find((e) => e.kind === 'action' && e.player === 1)).toMatchObject({
      type: 'all-in',
      effect: 'call',
      amount: 28,
    });
    expect(t.log.find((e) => e.kind === 'uncalled')).toEqual({
      kind: 'uncalled',
      player: 0,
      amount: 10,
    });
  });

  it('refuses malformed moves with a reason, and applyMove throws IllegalMoveError', () => {
    const s = headsUpFlop();
    const bad: unknown[] = [
      { type: 'bet', amount: 2.5 },
      { type: 'bet', amount: -4 },
      { type: 'bet', amount: Number.NaN },
      { type: 'bet', amount: Number.POSITIVE_INFINITY },
      { type: 'bet', amount: '10' },
      { type: 'bet' },
      { type: 'raise', to: 10 },
      { type: 'shove' },
      { kind: 'fold' },
      null,
      'fold',
    ];
    for (const m of bad) {
      const c = engine.checkMove(s, 1, m as TexasHoldemMove);
      expect(c.ok, JSON.stringify(m)).toBe(false);
      expect(c.reason?.length ?? 0).toBeGreaterThan(20);
      expect(() => engine.applyMove(s, m as TexasHoldemMove)).toThrow(IllegalMoveError);
    }
  });

  it('a lone bettor gets back everything nobody matched when all fold on the river', () => {
    let s = deal({ players: 3, button: 0 });
    s = passStreet(s).state;
    s = passStreet(s).state;
    s = passStreet(s).state;
    expect(s.street).toBe('river');
    s = play(s, [1, B(30)], [2, F], [0, F]);
    expect(s.outcome?.kind).toBe('fold');
    expect(s.log.find((e) => e.kind === 'uncalled')).toEqual({
      kind: 'uncalled',
      player: 1,
      amount: 30,
    });
    expect(s.stacks).toEqual([98, 104, 98]);
    expect(s.board).toHaveLength(5);
  });
});

// ----------------------------------------------------------------- pots

describe('audit: side pots and split pots', () => {
  it('three all-ins at different levels: a main pot and two side pots, each won by the best eligible hand', () => {
    // Button 0, SB 1, BB 2, UTG 3. Shorter stacks hold better hands.
    let s = deal({
      players: 4,
      button: 0,
      stacks: [100, 10, 30, 60],
      hands: ['JS JH', 'AS AH', 'KS KH', 'QS QH'],
      board: '2C 7D 9S 4H 3C',
    });
    s = play(s, [3, A], [0, C], [1, A], [2, A]);
    expect(engine.isOver(s)).toBe(true);
    expect(s.outcome?.pots.map((p) => [p.amount, p.eligible, p.winners])).toEqual([
      [40, [0, 1, 2, 3], [1]],
      [60, [0, 2, 3], [2]],
      [60, [0, 3], [3]],
    ]);
    expect(s.stacks).toEqual([40, 40, 60, 60]);
    const r = engine.result(s);
    expect(r.humanNetUnits).toBe(-60);
    expect(r.flags.tags).toContain('side-pot');
  });

  it('a split side pot: the odd chip (from a folded player) goes to the first winner left of the button', () => {
    // Button 0. Seat 2 (big blind, 5 chips) has Aces; seats 0 and 3 both play K-Q-J-7-5.
    let s = deal({
      players: 4,
      button: 0,
      stacks: [100, 100, 5, 100],
      hands: ['KS 2D', '9C 8D', 'AS AH', 'KD 2C'],
      board: 'QC JD 7S 5H 3C',
    });
    s = play(s, [3, R(6)], [0, C], [1, C], [2, A]);
    expect(s.street).toBe('flop');
    s = play(s, [1, X], [3, B(4)], [0, C], [1, F]);
    s = checkDown(s);
    const pots = s.outcome?.pots ?? [];
    expect(pots.map((p) => [p.amount, p.eligible])).toEqual([
      [20, [0, 2, 3]],
      [11, [0, 3]],
    ]);
    expect(pots[0]?.winners).toEqual([2]);
    expect(pots[1]?.winners).toEqual([3, 0]);
    expect(pots[1]?.shares).toEqual([6, 5]);
    expect(s.stacks).toEqual([95, 94, 20, 96]);
    expect(engine.result(s).flags.tags).toContain('split-pot');
  });

  it('a three-way split with two odd chips: one each to the first two winners left of the button', () => {
    let s = deal({
      players: 4,
      button: 0,
      hands: ['2C 3D', '4C 5D', '2D 3C', '4D 5C'],
      board: 'AS KS QS JS TS',
    });
    s = passStreet(s).state;
    s = play(s, [1, X], [2, B(2)], [3, C], [0, C], [1, F]);
    s = checkDown(s);
    const pot = s.outcome?.pots[0];
    expect(pot?.amount).toBe(14);
    expect(pot?.winners).toEqual([2, 3, 0]);
    expect(pot?.shares).toEqual([5, 5, 4]);
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('push');
    // Everyone just played the royal flush on the board: nothing the learner made.
    expect(r.flags.perfect).toBe(false);
    expect(r.flags.tags).not.toContain('royal-flush');
    expect(r.flags.tags).toContain('split-pot');
    expect(r.summary).toBe(
      'At the showdown you, Player 2 and Player 3 had equally good hands (Royal Flush), so you split the 14-chip pot.',
    );
  });
});

// --------------------------------------------------------- hand ranking

describe('audit: hand ranking edge cases', () => {
  const ev = (s: string) => evaluate7(s.split(' ') as Parameters<typeof evaluate7>[0]);

  it('A-2-3-4-5 is the lowest straight; with a 6 as well it is a Six-high straight', () => {
    expect(ev('AS 2D 3H 4C 5S KD QH').name).toBe('Straight to the Five');
    expect(ev('AS 2D 3H 4C 5S 6D QH').name).toBe('Straight to the Six');
    expect(ev('2S 3D 4H 5C 6S KD QH').score).toBeGreaterThan(ev('AS 2D 3H 4C 5S KD QH').score);
    expect(ev('TS JD QH KC AS 2D 3H').name).toBe('Straight to the Ace');
    expect(ev('KS AD 2H 3C 4S 9D 8H').category).toBe('high-card');
  });

  it('a wheel straight flush is a Five-high straight flush, below a Six-high one', () => {
    const wheel = ev('AH 2H 3H 4H 5H KD QC');
    expect(wheel.name).toBe('Straight Flush to the Five');
    expect(wheel.isRoyal).toBe(false);
    expect(ev('6H 2H 3H 4H 5H KD QC').score).toBeGreaterThan(wheel.score);
  });

  it('a straight flush beats a higher plain straight in the same seven cards; a flush beats a straight', () => {
    expect(ev('5H 6H 7H 8H 9H TC JC').name).toBe('Straight Flush to the Nine');
    expect(ev('4H 6H 7H 8C 9H 5D 2H').category).toBe('flush');
  });

  it('flushes compare all five cards, and only the best five of six suited cards count', () => {
    expect(ev('AH KH 9H 7H 5H 3H 2C').ranks).toEqual([14, 13, 9, 7, 5]);
    expect(ev('AH KH 9H 7H 5H 2C 3D').score).toBeGreaterThan(ev('AD KD 9D 7D 4D 2S 3C').score);
  });

  it('four of a kind on the board: the best kicker wins, and an equal kicker splits', () => {
    const board = '9C 9D 9H 9S 2D';
    expect(ev(`AS 3D ${board}`).score).toBeGreaterThan(ev(`KC 4H ${board}`).score);
    expect(ev(`3D 4C ${board}`).score).toBeGreaterThan(ev(`3H 2C ${board}`).score);
    expect(ev(`AS 3D ${board}`).score).toBe(ev(`AD 4C ${board}`).score);
  });

  it('full houses compare the three of a kind first; two sets make a full house', () => {
    const board = 'KS KD 7C 7H 2S';
    expect(ev(`KC 3D ${board}`).name).toBe('Full House, Kings full of Sevens');
    expect(ev(`7S 3H ${board}`).name).toBe('Full House, Sevens full of Kings');
    expect(ev(`KC 3D ${board}`).score).toBeGreaterThan(ev(`7S 3H ${board}`).score);
    expect(ev('QS QH QD 5C 5H 5S 2C').name).toBe('Full House, Queens full of Fives');
    expect(ev('QS QH QD 5C 5H 3S 3C').name).toBe('Full House, Queens full of Fives');
  });

  it('a straight beats the pair inside it', () => {
    expect(ev('5S 6D 7H 8C 9S 9D 2C').name).toBe('Straight to the Nine');
  });
});

// -------------------------------------------------- results and wording

describe('audit: result flags and summaries are honest', () => {
  it('the summary does not hide a split pot the learner lost', () => {
    const s = checkDown(
      deal({
        players: 3,
        button: 0,
        hands: ['2C 3D', 'AS 4H', 'AD 4C'],
        board: 'KC QD JH 9S 7C',
      }),
    );
    expect(s.outcome?.pots[0]?.winners).toEqual([1, 2]);
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('loss');
    expect(r.summary).toBe(
      'At the showdown Player 1 and Player 2 split the 6-chip pot, each with High Card, Ace, which beat your High Card, King.',
    );
  });

  it('perfect / four-of-a-kind are not awarded when the four of a kind is all on the board', () => {
    const s = checkDown(
      deal({ players: 2, button: 0, hands: ['AS 3D', 'KC 4H'], board: '9C 9D 9H 9S 2D' }),
    );
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.perfect).toBe(false);
    expect(r.flags.tags).not.toContain('four-of-a-kind');
    // With one Nine in the hand, the learner made the four of a kind: perfect.
    const t = checkDown(
      deal({ players: 2, button: 0, hands: ['9S 3D', 'KC 4H'], board: '9C 9D 9H AS 2D' }),
    );
    expect(engine.result(t).flags.perfect).toBe(true);
    expect(engine.result(t).flags.tags).toContain('four-of-a-kind');
  });

  it('a straight flush on the board improved by a hole card counts as the learner’s own', () => {
    const s = checkDown(
      deal({ players: 2, button: 0, hands: ['TH 2C', 'KC 4D'], board: '5H 6H 7H 8H 9H' }),
    );
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.perfect).toBe(true);
    expect(r.flags.tags).toContain('straight-flush');
  });

  it('winning the side pot but losing the main pot can still be a loss; the summary names both pots', () => {
    // Seat 1 (10 chips) has Aces; the learner's Kings beat seat 2's Queens for the side pot.
    let s = deal({
      players: 3,
      button: 0,
      stacks: [100, 10, 100],
      hands: ['KS KH', 'AS AH', 'QS QH'],
      board: '2C 7D 9S 4H 3C',
    });
    s = play(s, [0, R(10)], [1, C], [2, C]);
    expect(s.street).toBe('flop');
    s = play(s, [2, B(4)], [0, C]);
    s = checkDown(s);
    expect(s.outcome?.pots.map((p) => [p.amount, p.winners])).toEqual([
      [30, [1]],
      [8, [0]],
    ]);
    const r = engine.result(s);
    expect(r.humanNetUnits).toBe(-6);
    expect(r.humanOutcome).toBe('loss');
    expect(r.winners).toEqual([0, 1]);
    expect(r.summary).toBe(
      'At the showdown Player 1 won the main pot (30 chips) with Pair of Aces and you won the side pot (8 chips) with Pair of Kings.',
    );
  });
});

describe('audit: checkMove reasons are correct and specific', () => {
  it('the big blind trying to "bet" is told it can check or raise (not "call 0 chips")', () => {
    // Button 2 → small blind 3, big blind 0 (the learner), first to act 1.
    let s = deal({ players: 4, button: 2 });
    s = play(s, [1, C], [2, C], [3, C]);
    expect(s.toAct).toBe(0);
    const text = reason(s, 0, B(4));
    expect(text).not.toMatch(/call 0/);
    expect(text).toBe(
      'Before the flop the blinds already count as the first bet, so you can\'t "bet" — you can check, raise to 4 or more, or fold.',
    );
  });

  it('checking pre-flop with nothing in yet: staying in costs the big blind (no "more")', () => {
    const s = deal({ players: 4, button: 1 }); // first to act: seat 0
    expect(s.toAct).toBe(0);
    expect(reason(s, 0, X)).toBe(
      "You can't check — the big blind is 2 chips, so staying in costs 2 chips. You can call, raise or fold.",
    );
    const sb = deal({ players: 4, button: 3 }); // seat 0 is the small blind
    const t = play(sb, [2, C], [3, C]);
    expect(reason(t, 0, X)).toBe(
      "You can't check — the big blind is 2 chips, so staying in costs 1 chip more. You can call, raise or fold.",
    );
  });

  it('checking after a raise says who raised', () => {
    const t = play(deal({ players: 4, button: 2 }), [1, R(6)], [2, C], [3, C]);
    expect(t.toAct).toBe(0);
    expect(reason(t, 0, X)).toBe(
      "You can't check — Player 1 raised, so the bet to match is 6 chips. Call 4 chips to stay in, raise, or fold.",
    );
  });

  it('a short all-in bet that did not re-open the betting is named in the reason', () => {
    // 3 seats, button 2: small blind 0 (learner), big blind 1, first to act 2. Seat 1 is short.
    let s = deal({ players: 3, button: 2, stacks: [100, 3, 100] });
    s = play(s, [2, C], [0, C], [1, X]);
    expect(s.street).toBe('flop');
    s = play(s, [0, X], [1, B(1)], [2, C]);
    expect(s.toAct).toBe(0);
    expect(reason(s, 0, R(5))).toBe(
      "Player 1 went all-in for less than a full bet, and you have already acted this round, so the betting isn't re-opened: you can't raise. You can call 1 chip or fold.",
    );
  });
});

// ------------------------------------------------- hidden information

describe('audit: the coach only uses what the learner can see', () => {
  /** Re-deal every card `seat` cannot see (other hole cards, burns, undealt deck). */
  function reshuffleHidden(s: TexasHoldemState, seat: number, seed: string): TexasHoldemState {
    const visible = new Set([...(s.hands[seat] ?? []), ...s.board]);
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

  it('the whole coach advice (situation, suggestion and why) ignores the cards it cannot see', () => {
    let checked = 0;
    for (let g = 0; g < 25; g++) {
      let s = engine.setup({ players: 2 + (g % 5) }, createRng(`audit-hidden-${g}`));
      const rng = createRng(`audit-hidden-bots-${g}`);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s) ?? 0;
        for (const seat of [p, (p + 1) % s.players]) {
          const other = reshuffleHidden(s, seat, `audit-rehide-${g}-${checked}`);
          expect(engine.coach(other, seat)).toEqual(engine.coach(s, seat));
          checked++;
        }
        s = engine.applyMove(s, engine.botMove(s, p, 'normal', rng));
      }
    }
    expect(checked).toBeGreaterThan(150);
  });
});

describe('audit: the learner can never lose more than the wallet covers', () => {
  it('affordableUnits caps a bigger configured stack, and a nonsense value counts as nothing extra', () => {
    const big = { players: 2, options: { stacks: [300, 100] } };
    expect(engine.setup({ ...big, affordableUnits: 50 }, createRng(1)).startingStacks[0]).toBe(150);
    expect(engine.setup({ ...big, affordableUnits: -5 }, createRng(1)).startingStacks[0]).toBe(100);
    expect(
      engine.setup({ ...big, affordableUnits: Number.NaN }, createRng(1)).startingStacks[0],
    ).toBe(100);
    expect(engine.setup({ players: 2, affordableUnits: 0 }, createRng(1)).startingStacks[0]).toBe(
      100,
    );
  });
});

// ---------------------------------------------------------------- fuzz

/** Seats that still have to act this street, derived only from the public log. */
function modelNeedsToAct(s: TexasHoldemState): (seat: number) => boolean {
  const acted = new Set<number>();
  for (let i = s.log.length - 1; i >= 0; i--) {
    const e = s.log[i];
    if (!e || e.kind === 'deal') break;
    if (e.kind === 'action') acted.add(e.player);
  }
  const live = s.folded.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);
  const withChips = live.filter((i) => (s.stacks[i] ?? 0) > 0);
  const maxBet = Math.max(0, ...live.map((i) => s.streetBets[i] ?? 0));
  const toMatch = s.street === 'preflop' ? Math.max(maxBet, s.bigBlind) : maxBet;
  return (seat) => {
    if (s.folded[seat] || (s.stacks[seat] ?? 0) === 0) return false;
    const bet = s.streetBets[seat] ?? 0;
    if (withChips.length === 1) {
      return bet < Math.max(0, ...live.filter((i) => i !== seat).map((i) => s.streetBets[i] ?? 0));
    }
    return !acted.has(seat) || bet < toMatch;
  };
}

/** Bet to match, last full raise and each seat's level when it last acted — from the log. */
function modelBetting(s: TexasHoldemState) {
  let start = 0;
  for (let i = s.log.length - 1; i >= 0; i--) {
    if (s.log[i]?.kind === 'deal') {
      start = i + 1;
      break;
    }
  }
  let current = s.street === 'preflop' ? s.bigBlind : 0;
  let lastFull = s.bigBlind;
  const level = new Map<number, number>();
  for (const e of s.log.slice(start)) {
    if (e.kind !== 'action') continue;
    if (e.to > current) {
      if (e.to - current >= lastFull) lastFull = e.to - current;
      current = e.to;
    }
    level.set(e.player, current);
  }
  return { current, lastFull, level };
}

function randomMove(s: TexasHoldemState, p: number, rng: Rng): TexasHoldemMove {
  const legal = engine.legalMoves(s, p);
  const o = betOptions(s, p);
  const r = rng.next();
  if (r < 0.15 && o.canBet) {
    // A stack below the minimum bet can only bet everything (all-in).
    if (o.maxTo <= o.minBet) return { type: 'bet', amount: o.maxTo };
    return { type: 'bet', amount: o.minBet + rng.int(o.maxTo - o.minBet + 1) };
  }
  if (r < 0.3 && o.canRaise) {
    const lo = Math.min(o.minRaiseTo, o.maxTo);
    return { type: 'raise', to: lo + rng.int(o.maxTo - lo + 1) };
  }
  const passive = legal.filter((m) => m.type === 'check' || m.type === 'call');
  if (passive.length && r < 0.75) return rng.pick(passive);
  const nonFold = legal.filter((m) => m.type !== 'fold');
  return nonFold.length && rng.next() < 0.85 ? rng.pick(nonFold) : rng.pick(legal);
}

describe('audit: random legal play against an independent model', () => {
  it('600 hands with random tables and random slider amounts: turn order, min raise, re-opening, conservation, coach, no leaks', () => {
    for (let g = 0; g < 600; g++) {
      const rng = createRng(`audit-fuzz-${g}`);
      const players = 2 + rng.int(5);
      const sb = 1 + rng.int(3);
      const bb = sb + rng.int(4);
      const kind = rng.int(3);
      const stacks = Array.from({ length: players }, () =>
        kind === 0 ? 1 + rng.int(12) : kind === 1 ? 1 + rng.int(300) : 100,
      );
      let s = engine.setup(
        { players, options: { stacks, smallBlind: sb, bigBlind: bb, button: rng.int(players) } },
        createRng(`audit-deal-${g}`),
      );
      const total = sum(s.startingStacks);
      const at = (step: number) => `[game ${g} step ${step}]`;
      let step = 0;
      let from = s.bigBlindSeat;
      while (!engine.isOver(s)) {
        // Whoever acts is the first seat clockwise (from the last actor, or the button on a new
        // street, or the big blind pre-flop) that still has to act.
        const need = modelNeedsToAct(s);
        let expected: number | null = null;
        for (let i = 1; i <= players && expected === null; i++) {
          if (need((from + i) % players)) expected = (from + i) % players;
        }
        const p = engine.currentPlayer(s);
        expect(p, `${at(step)} seat to act`).toBe(expected);
        if (p === null) break;
        const legal = engine.legalMoves(s, p);
        expect(legal.length, at(step)).toBeGreaterThan(0);
        for (const m of legal) expect(engine.checkMove(s, p, m).ok, at(step)).toBe(true);
        const model = modelBetting(s);
        const o = betOptions(s, p);
        expect(s.currentBet, `${at(step)} bet to match`).toBe(model.current);
        expect(s.minRaise, `${at(step)} min raise`).toBe(model.lastFull);
        const owed = s.currentBet - (s.streetBets[p] ?? 0);
        const othersWithChips = s.stacks.some((c, i) => i !== p && !s.folded[i] && c > 0);
        const lvl = model.level.get(p);
        const mayRaise =
          s.currentBet > 0 &&
          (s.stacks[p] ?? 0) > owed &&
          othersWithChips &&
          (lvl === undefined || s.currentBet - lvl >= model.lastFull);
        expect(o.canRaise, `${at(step)} may raise`).toBe(mayRaise);
        // Coach: a legal suggestion; never names a card the learner cannot see.
        const advice = engine.coach(s, p);
        const suggestion = advice.suggestion as TexasHoldemMove;
        expect(engine.checkMove(s, p, suggestion).ok, at(step)).toBe(true);
        // Folding is legal even when checking is free, but neither the coach nor a bot does it.
        if (legal.some((m) => m.type === 'check')) {
          expect(suggestion.type, at(step)).not.toBe('fold');
          for (const d of ['easy', 'normal'] as const) {
            const botPick = engine.botMove(s, p, d, createRng(`audit-bot-${g}-${step}`));
            expect(botPick.type, `${at(step)} ${d}`).not.toBe('fold');
          }
        }
        const hidden = [...s.hands.filter((_, i) => i !== p).flat(), ...s.deck, ...s.burned];
        const words = `${advice.situation} ${advice.why ?? ''}`;
        for (const c of hidden) {
          expect(words.includes(cardShort(c)) || words.includes(cardName(c)), at(step)).toBe(false);
        }
        const move = randomMove(s, p, rng);
        expect(engine.checkMove(s, p, move).ok, `${at(step)} ${engine.moveKey(move)}`).toBe(true);
        const text = engine.describeMove(s, p, move);
        deepFreeze(s);
        const next = engine.applyMove(s, move);
        // Never names a hole card, a burn card or an undealt card.
        for (const c of [...next.hands.flat(), ...next.burned, ...next.deck]) {
          expect(text.includes(cardName(c)), `${at(step)} ${text}`).toBe(false);
        }
        from = next.board.length !== s.board.length ? next.button : p;
        s = next;
        step++;
        const all = [...s.hands.flat(), ...s.board, ...s.burned, ...s.deck];
        expect(new Set(all).size, at(step)).toBe(52);
        expect(sum(s.stacks) + (s.outcome ? 0 : sum(s.committed)), at(step)).toBe(total);
        expect(step, at(step)).toBeLessThan(200);
      }
      const r = engine.result(s);
      expect(r.humanNetUnits).toBe((s.stacks[0] ?? 0) - (s.startingStacks[0] ?? 0));
      expect(r.humanNetUnits).toBeGreaterThanOrEqual(-(s.startingStacks[0] ?? 0));
      expect(sum(r.scores ?? [])).toBe(0);
      expect(potTotal(s)).toBe(sum(s.outcome?.payouts ?? []));
    }
  });
});
