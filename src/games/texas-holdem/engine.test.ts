import { describe, expect, it } from 'vitest';
import { cardName, makeDeck } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError } from '@/games/core/types';
import engine, {
  MAX_LOSS_UNITS,
  type TexasHoldemMove,
  type TexasHoldemState,
  betOptions,
  buildPots,
  potTotal,
  positionName,
  seatName,
} from './engine';
import { A, B, C, F, R, X, cards, checkDown, deal, play, rigDeck } from './test-helpers';

const keys = (s: TexasHoldemState, p: number) => engine.legalMoves(s, p).map(engine.moveKey);
const reason = (s: TexasHoldemState, p: number, m: TexasHoldemMove) => {
  const c = engine.checkMove(s, p, m);
  expect(c.ok).toBe(false);
  return c.reason ?? '';
};
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

// 4 seats, button 0 → small blind 1, big blind 2, first to act pre-flop 3.
const four = (o: Partial<Parameters<typeof deal>[0]> = {}) => deal({ players: 4, button: 0, ...o });

// ------------------------------------------------------------------ setup

describe('setup', () => {
  it('seats 4 players with 100 chips, posts blinds 1/2 left of the button', () => {
    const s = engine.setup({ players: 4 }, createRng('setup-a'));
    expect(s.players).toBe(4);
    expect(s.startingStacks).toEqual([100, 100, 100, 100]);
    const sb = (s.button + 1) % 4;
    const bb = (s.button + 2) % 4;
    expect(s.smallBlindSeat).toBe(sb);
    expect(s.bigBlindSeat).toBe(bb);
    expect(s.committed[sb]).toBe(1);
    expect(s.committed[bb]).toBe(2);
    expect(s.stacks[sb]).toBe(99);
    expect(s.stacks[bb]).toBe(98);
    expect(potTotal(s)).toBe(3);
    expect(s.currentBet).toBe(2);
    expect(s.street).toBe('preflop');
    expect(s.board).toEqual([]);
    expect(s.toAct).toBe((s.button + 3) % 4);
    expect(engine.currentPlayer(s)).toBe(s.toAct);
    for (const h of s.hands) expect(h).toHaveLength(2);
    expect(s.log.filter((e) => e.kind === 'blind')).toHaveLength(2);
  });

  it('defaults to 4 players and uses every card exactly once', () => {
    const s = engine.setup({ players: undefined as unknown as number }, createRng('d'));
    expect(s.players).toBe(4);
    const all = [...s.hands.flat(), ...s.board, ...s.burned, ...s.deck];
    expect(all).toHaveLength(52);
    expect(new Set(all)).toEqual(new Set(makeDeck()));
  });

  it('deals one card at a time starting left of the button, then burns before each street', () => {
    const deck = makeDeck();
    const s = engine.setup({ players: 4, options: { button: 0, deck } }, createRng(1));
    expect(s.hands[1]).toEqual([deck[0], deck[4]]);
    expect(s.hands[2]).toEqual([deck[1], deck[5]]);
    expect(s.hands[3]).toEqual([deck[2], deck[6]]);
    expect(s.hands[0]).toEqual([deck[3], deck[7]]);
    const end = checkDown(s);
    expect(end.burned).toEqual([deck[8], deck[12], deck[14]]);
    expect(end.board).toEqual([deck[9], deck[10], deck[11], deck[13], deck[15]]);
  });

  it('heads-up: the button posts the small blind and acts first pre-flop, last after the flop', () => {
    let s = deal({ players: 2, button: 0 });
    expect(s.smallBlindSeat).toBe(0);
    expect(s.bigBlindSeat).toBe(1);
    expect(s.committed).toEqual([1, 2]);
    expect(s.toAct).toBe(0);
    s = play(s, [0, C]);
    expect(s.toAct).toBe(1);
    expect(keys(s, 1)).toContain('check');
    s = play(s, [1, X]);
    expect(s.street).toBe('flop');
    expect(s.toAct).toBe(1);
    s = play(s, [1, X]);
    expect(s.toAct).toBe(0);
    expect(positionName(s, 0)).toBe('Button and small blind');
    expect(positionName(s, 1)).toBe('Big blind');
  });

  it('three players: the button is first to act pre-flop', () => {
    const s = deal({ players: 3, button: 1 });
    expect(s.smallBlindSeat).toBe(2);
    expect(s.bigBlindSeat).toBe(0);
    expect(s.toAct).toBe(1);
  });

  it('chooses the button from the seed, or from options.button', () => {
    const buttons = new Set<number>();
    for (let i = 0; i < 40; i++) buttons.add(engine.setup({ players: 4 }, createRng(i)).button);
    expect(buttons).toEqual(new Set([0, 1, 2, 3]));
    expect(engine.setup({ players: 5, options: { button: 3 } }, createRng(1)).button).toBe(3);
  });

  it('is deterministic: same seed → same deal; different seeds → different deals', () => {
    const a = engine.setup({ players: 6 }, createRng('same'));
    const b = engine.setup({ players: 6 }, createRng('same'));
    const c = engine.setup({ players: 6 }, createRng('other'));
    expect(a).toEqual(b);
    expect(a.hands).not.toEqual(c.hands);
  });

  it('supports 2–6 players and rejects other counts and bad options', () => {
    for (const players of [2, 3, 4, 5, 6]) {
      expect(engine.setup({ players }, createRng(players)).hands).toHaveLength(players);
    }
    const bad: unknown[] = [
      { players: 1 },
      { players: 7 },
      { players: 2.5 },
      { players: 3, options: { stacks: [100, 100] } },
      { players: 2, options: { stacks: [100, 0] } },
      { players: 2, options: { stacks: [100, 10.5] } },
      { players: 2, options: { startingStack: -5 } },
      { players: 2, options: { smallBlind: 0 } },
      { players: 2, options: { smallBlind: 2, bigBlind: 1 } },
      { players: 4, options: { button: 4 } },
      { players: 4, options: { button: -1 } },
      { players: 2, options: { deck: makeDeck().slice(1) } },
      { players: 2, options: { deck: [...makeDeck().slice(1), '2S'] } },
      { players: 2, options: { deck: [...makeDeck().slice(1), 'X1'] } },
    ];
    for (const config of bad) {
      expect(() =>
        engine.setup(config as Parameters<typeof engine.setup>[0], createRng(1)),
      ).toThrow(RangeError);
    }
  });

  it('accepts custom stacks and blinds', () => {
    const s = engine.setup(
      { players: 3, options: { stacks: [50, 80, 120], smallBlind: 5, bigBlind: 10, button: 0 } },
      createRng(1),
    );
    expect(s.startingStacks).toEqual([50, 80, 120]);
    expect(s.committed).toEqual([0, 5, 10]);
    expect(betOptions(s, 0).minRaiseTo).toBe(20);
    const t = engine.setup({ players: 2, options: { startingStack: 40 } }, createRng(1));
    expect(t.startingStacks).toEqual([40, 40]);
  });

  it('caps the learner’s stack above the 100-chip escrow by affordableUnits', () => {
    const big = { players: 2, options: { stacks: [150, 100] } };
    expect(engine.setup({ ...big, affordableUnits: 20 }, createRng(1)).startingStacks[0]).toBe(120);
    expect(engine.setup({ ...big, affordableUnits: 0 }, createRng(1)).startingStacks[0]).toBe(100);
    expect(engine.setup(big, createRng(1)).startingStacks[0]).toBe(150);
    expect(MAX_LOSS_UNITS).toBe(100);
  });

  it('a blind bigger than the stack is posted all-in; the bet to match stays the full big blind', () => {
    const s = four({ stacks: [100, 100, 1, 100] });
    expect(s.committed[2]).toBe(1);
    expect(s.stacks[2]).toBe(0);
    expect(s.allInStreet[2]).toBe('preflop');
    expect(s.currentBet).toBe(2);
    expect(betOptions(s, 3).toCall).toBe(2);
  });

  it('when the blinds put everyone all-in the board is dealt straight away', () => {
    const s = deal({ players: 2, button: 0, stacks: [1, 2] });
    expect(engine.isOver(s)).toBe(true);
    expect(engine.currentPlayer(s)).toBeNull();
    expect(s.board).toHaveLength(5);
    expect(s.outcome?.kind).toBe('showdown');
  });

  it('produces plain JSON-serialisable state', () => {
    const s = play(engine.setup({ players: 5 }, createRng('json')), C, C);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

// ----------------------------------------------------- legal moves / turns

describe('legal moves and turn order', () => {
  it('only the seat to act has legal moves; currentPlayer is null exactly when over', () => {
    let s = four();
    expect(keys(s, 3).length).toBeGreaterThan(0);
    for (const p of [0, 1, 2]) expect(engine.legalMoves(s, p)).toEqual([]);
    s = play(s, F, F, F);
    expect(engine.isOver(s)).toBe(true);
    expect(engine.currentPlayer(s)).toBeNull();
    for (const p of [0, 1, 2, 3]) expect(engine.legalMoves(s, p)).toEqual([]);
  });

  it('facing the big blind: fold, call, a few raise sizes (min, ½, ¾, pot) and all-in', () => {
    expect(keys(four(), 3)).toEqual([
      'fold',
      'call',
      'raise:4',
      'raise:5',
      'raise:6',
      'raise:7',
      'all-in',
    ]);
  });

  it('nobody has bet after the flop: fold, check, bet sizes (min, ½, ¾, pot) and all-in', () => {
    const s = play(four(), C, C, C, X);
    expect(s.street).toBe('flop');
    expect(potTotal(s)).toBe(8);
    expect(keys(s, 1)).toEqual(['fold', 'check', 'bet:2', 'bet:4', 'bet:6', 'bet:8', 'all-in']);
  });

  it('the big blind gets the option: check or raise when nobody raised (no call)', () => {
    const s = play(four(), [3, C], [0, C], [1, C]);
    expect(s.toAct).toBe(2);
    expect(keys(s, 2)).toEqual([
      'fold',
      'check',
      'raise:4',
      'raise:6',
      'raise:8',
      'raise:10',
      'all-in',
    ]);
  });

  it('when calling costs everything, the call is the all-in (no duplicate, no raise)', () => {
    const s = four({ stacks: [100, 100, 100, 2] });
    expect(keys(s, 3)).toEqual(['fold', 'call']);
    expect(betOptions(s, 3).callIsAllIn).toBe(true);
    expect(engine.checkMove(s, 3, A).ok).toBe(true);
  });

  it('a stack smaller than a full raise can still go all-in', () => {
    const s = four({ stacks: [100, 100, 100, 3] });
    expect(keys(s, 3)).toEqual(['fold', 'call', 'all-in']);
    expect(engine.checkMove(s, 3, R(3)).ok).toBe(true);
    expect(engine.checkMove(s, 3, R(4)).ok).toBe(false);
  });

  it('bet and raise sizes never repeat and stop below all-in', () => {
    const s = four({ stacks: [100, 100, 100, 6] });
    expect(keys(s, 3)).toEqual(['fold', 'call', 'raise:4', 'raise:5', 'all-in']);
  });

  it('skips folded and all-in players', () => {
    let s = four({ stacks: [100, 100, 100, 10] });
    s = play(s, [3, A], [0, F], [1, C], [2, C]);
    expect(s.street).toBe('flop');
    expect(s.toAct).toBe(1);
    s = play(s, [1, X], [2, X]);
    expect(s.street).toBe('turn');
    expect(s.toAct).toBe(1);
  });

  it('moveKey is stable and unique per move', () => {
    const moves: TexasHoldemMove[] = [F, X, C, A, B(2), B(3), R(4), R(5)];
    const ks = moves.map(engine.moveKey);
    expect(new Set(ks).size).toBe(moves.length);
    expect(engine.moveKey({ type: 'bet', amount: 2 })).toBe(engine.moveKey(B(2)));
    expect(engine.moveKey(B(4))).not.toBe(engine.moveKey(R(4)));
  });
});

// ------------------------------------------------------------- betting

describe('betting rules', () => {
  const headsUpFlop = (stacks?: number[]) => play(deal({ players: 2, button: 0, stacks }), C, X);

  it('the minimum bet is the big blind; smaller bets only as an all-in', () => {
    const s = headsUpFlop();
    expect(s.toAct).toBe(1);
    expect(engine.checkMove(s, 1, B(1)).ok).toBe(false);
    expect(engine.checkMove(s, 1, B(2)).ok).toBe(true);
    const short = headsUpFlop([100, 3]);
    expect(short.stacks[1]).toBe(1);
    expect(engine.checkMove(short, 1, B(1)).ok).toBe(true);
    expect(engine.checkMove(short, 1, A).ok).toBe(true);
  });

  it('accepts any whole bet or raise between the minimum and all-in (slider amounts)', () => {
    const s = headsUpFlop();
    for (const amount of [2, 3, 17, 37, 97, 98]) {
      expect(engine.checkMove(s, 1, B(amount)).ok).toBe(true);
    }
    const t = engine.applyMove(s, B(37));
    expect(t.streetBets[1]).toBe(37);
    expect(t.stacks[1]).toBe(61);
    for (const to of [74, 75, 90, 98]) expect(engine.checkMove(t, 0, R(to)).ok).toBe(true);
    expect(engine.checkMove(t, 0, R(73)).ok).toBe(false);
  });

  it('a raise must go up by at least the previous bet/raise increment', () => {
    let s = four();
    s = play(s, [3, R(6)]);
    expect(s.minRaise).toBe(4);
    expect(betOptions(s, 0).minRaiseTo).toBe(10);
    expect(engine.checkMove(s, 0, R(9)).ok).toBe(false);
    expect(engine.checkMove(s, 0, R(10)).ok).toBe(true);
    s = play(s, [0, R(16)]);
    expect(s.minRaise).toBe(10);
    expect(betOptions(s, 1).minRaiseTo).toBe(26);
    expect(engine.checkMove(s, 1, R(25)).ok).toBe(false);
    expect(engine.checkMove(s, 1, R(26)).ok).toBe(true);
  });

  // 3 seats, button 0: pre-flop everyone calls 2; the big blind (seat 2) is short.
  const shortFlop = (bbStack: number) =>
    play(deal({ players: 3, button: 0, stacks: [100, 100, bbStack] }), [0, C], [1, C], [2, X]);

  it('an all-in for less than a full raise does not re-open the betting for players who acted', () => {
    let s = shortFlop(14);
    expect(s.street).toBe('flop');
    s = play(s, [1, B(10)], [2, A]);
    expect(s.currentBet).toBe(12);
    expect(s.minRaise).toBe(10);
    // Seat 0 has not acted on the flop yet: it may raise, to at least 12 + 10.
    expect(betOptions(s, 0).canRaise).toBe(true);
    expect(betOptions(s, 0).minRaiseTo).toBe(22);
    s = play(s, [0, C]);
    // Seat 1 bet 10 and faces only a 2-chip (incomplete) raise: call or fold.
    expect(s.toAct).toBe(1);
    expect(keys(s, 1)).toEqual(['fold', 'call']);
    expect(engine.checkMove(s, 1, R(30)).ok).toBe(false);
    expect(engine.checkMove(s, 1, A).ok).toBe(false);
    s = play(s, [1, C]);
    expect(s.street).toBe('turn');
  });

  it('a full raise after a short all-in re-opens the betting', () => {
    let s = shortFlop(14);
    s = play(s, [1, B(10)], [2, A], [0, R(22)]);
    expect(betOptions(s, 1).canRaise).toBe(true);
    expect(keys(s, 1)).toContain('all-in');
  });

  it('short all-ins that add up to a full raise do re-open the betting', () => {
    const run = (lastStack: number) =>
      play(
        deal({ players: 4, button: 0, stacks: [100, 100, 16, lastStack] }),
        [3, C],
        [0, C],
        [1, C],
        [2, X],
        [1, B(10)],
        [2, A],
        [3, A],
        [0, C],
      );
    const closed = run(21); // all-ins to 14 then 19: only 9 more than seat 1's bet
    expect(closed.toAct).toBe(1);
    expect(betOptions(closed, 1).canRaise).toBe(false);
    expect(betOptions(closed, 1).raiseClosed).toBe(true);
    const open = run(22); // all-ins to 14 then 20: a full 10 more
    expect(open.toAct).toBe(1);
    expect(betOptions(open, 1).canRaise).toBe(true);
  });

  it('nobody can raise when everyone else is all-in — only call or fold', () => {
    let s = deal({ players: 2, button: 0, stacks: [100, 30] });
    s = play(s, [0, R(6)], [1, A]);
    expect(s.toAct).toBe(0);
    expect(keys(s, 0)).toEqual(['fold', 'call']);
    expect(engine.checkMove(s, 0, R(60)).ok).toBe(false);
    expect(engine.checkMove(s, 0, A).ok).toBe(false);
    s = play(s, [0, C]);
    expect(engine.isOver(s)).toBe(true);
    expect(s.board).toHaveLength(5);
  });

  it('a short stack calls for less; unmatched chips go back at the end of the round', () => {
    let s = deal({ players: 2, button: 0, stacks: [100, 30] });
    s = play(s, [0, A], [1, C]);
    const back = s.log.find((e) => e.kind === 'uncalled');
    expect(back).toEqual({ kind: 'uncalled', player: 0, amount: 70 });
    expect(s.committed).toEqual([30, 30]);
    expect(sum(s.stacks)).toBe(130);
    expect(s.board).toHaveLength(5);
    expect(s.log.filter((e) => e.kind === 'deal')).toHaveLength(3);
  });

  it('closing a round deals the next street after a burn and resets the betting', () => {
    let s = four({ board: 'AS KD 7C 4H 2S' });
    s = play(s, [3, C], [0, C], [1, C], [2, X]);
    expect(s.street).toBe('flop');
    expect(s.board).toEqual(cards('AS KD 7C'));
    expect(s.burned).toHaveLength(1);
    expect(s.streetBets).toEqual([0, 0, 0, 0]);
    expect(s.currentBet).toBe(0);
    expect(s.minRaise).toBe(2);
    expect(s.toAct).toBe(1);
    s = play(s, [1, X], [2, X], [3, X], [0, X]);
    expect(s.street).toBe('turn');
    expect(s.board).toEqual(cards('AS KD 7C 4H'));
    expect(s.burned).toHaveLength(2);
    s = play(s, [1, B(4)], [2, C], [3, F], [0, C]);
    expect(s.street).toBe('river');
    expect(s.board).toHaveLength(5);
    expect(s.toAct).toBe(1);
    s = play(s, [1, X], [2, X], [0, X]);
    expect(s.outcome?.kind).toBe('showdown');
    expect(s.outcome?.showdown).toEqual([0, 1, 2]);
  });

  it('when everyone folds to a bet, its unmatched part comes back and the bettor takes the pot', () => {
    const s = play(four(), [3, R(6)], [0, F], [1, F], [2, F]);
    expect(engine.isOver(s)).toBe(true);
    expect(s.outcome?.kind).toBe('fold');
    expect(s.outcome?.winners).toEqual([3]);
    expect(s.log.find((e) => e.kind === 'uncalled')).toEqual({
      kind: 'uncalled',
      player: 3,
      amount: 4,
    });
    expect(s.outcome?.pots[0]?.amount).toBe(5);
    expect(s.stacks).toEqual([100, 99, 98, 103]);
    expect(s.board).toEqual([]);
  });

  it('a walk: everyone folds to the big blind', () => {
    const s = play(four(), F, F, F);
    expect(s.outcome?.winners).toEqual([2]);
    expect(s.stacks).toEqual([100, 99, 101, 100]);
  });
});

// ------------------------------------------------------- pots & showdown

describe('side pots and the showdown', () => {
  it('unequal all-ins make a main pot and a side pot; unmatched chips go back', () => {
    let s = deal({
      players: 3,
      button: 0,
      stacks: [100, 20, 50],
      hands: ['KS KH', 'AS AH', 'QS QH'],
      board: '2C 7D 9S 4H 3C',
    });
    s = play(s, [0, A], [1, C], [2, C]);
    expect(s.log.find((e) => e.kind === 'uncalled')).toEqual({
      kind: 'uncalled',
      player: 0,
      amount: 50,
    });
    const o = s.outcome;
    expect(o?.kind).toBe('showdown');
    expect(o?.pots.map((p) => [p.amount, p.eligible, p.winners])).toEqual([
      [60, [0, 1, 2], [1]],
      [60, [0, 2], [0]],
    ]);
    expect(s.stacks).toEqual([110, 60, 0]);
    const r = engine.result(s);
    expect(r.scores).toEqual([10, 40, -50]);
    expect(r.winners).toEqual([0, 1]);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.tags).toContain('side-pot');
    expect(r.summary).toBe(
      'At the showdown Player 1 won the main pot (60 chips) with Pair of Aces and you won the side pot (60 chips) with Pair of Kings.',
    );
  });

  it('the short stack cannot win more than it matched', () => {
    let s = deal({
      players: 3,
      button: 0,
      stacks: [20, 50, 100],
      hands: ['AS AH', 'QS QH', 'KS KH'],
      board: '2C 7D 9S 4H 3C',
    });
    s = play(s, [0, A], [1, A], [2, C]);
    expect(s.stacks).toEqual([60, 0, 110]);
  });

  it('folded players’ chips stay in the pot, but they cannot win it', () => {
    let s = four({ hands: ['2C 3D', 'AS AH', 'KS KH', '7C 8D'], board: '2S 9H JD 4C 5H' });
    s = play(s, [3, C], [0, C], [1, C], [2, X], [1, B(8)], [2, C], [3, F], [0, F]);
    s = checkDown(s);
    expect(s.outcome?.pots).toHaveLength(1);
    expect(s.outcome?.pots[0]?.amount).toBe(24);
    expect(s.outcome?.pots[0]?.eligible).toEqual([1, 2]);
    expect(s.outcome?.winners).toEqual([1]);
  });

  it('equal best hands split the pot; the odd chip goes to the first winner left of the button', () => {
    // Button 0: seat 1 folds its small blind, seats 0 and 2 both play the board.
    let s = deal({
      players: 3,
      button: 0,
      hands: ['2C 3D', '4C 5D', '2D 3C'],
      board: 'AS KD QH JC TS',
    });
    s = play(s, [0, C], [1, F], [2, X]);
    s = checkDown(s);
    const pot = s.outcome?.pots[0];
    expect(pot?.amount).toBe(5);
    expect(pot?.winners).toEqual([2, 0]);
    expect(pot?.shares).toEqual([3, 2]);
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('push');
    expect(r.humanNetUnits).toBe(0);
    expect(r.flags.tags).toContain('split-pot');
    expect(r.summary).toContain('split the 5-chip pot');

    // Button 2: seat 0 is first left of the button and gets the odd chip.
    let t = deal({
      players: 3,
      button: 2,
      hands: ['2C 3D', '4C 5D', '2D 3C'],
      board: 'AS KD QH JC TS',
    });
    t = play(t, [2, R(5)], [0, C], [1, C], [0, B(2)], [1, F], [2, C]);
    t = checkDown(t);
    expect(t.outcome?.pots[0]?.amount).toBe(19);
    expect(t.outcome?.pots[0]?.winners).toEqual([0, 2]);
    expect(t.outcome?.pots[0]?.shares).toEqual([10, 9]);
    expect(engine.result(t).humanOutcome).toBe('win');
  });

  it('a kicker breaks a tie between equal pairs', () => {
    let s = deal({ players: 2, button: 0, hands: ['AH KD', 'AC QS'], board: 'AS 7D 4C 2H 9S' });
    s = checkDown(s);
    expect(s.outcome?.winners).toEqual([0]);
    expect(s.outcome?.pots[0]?.handName).toBe('Pair of Aces');
  });

  it('buildPots handles levels and chips folded above every live player', () => {
    expect(buildPots([10, 50, 50], [false, false, true])).toEqual([
      { amount: 30, eligible: [0, 1] },
      { amount: 80, eligible: [1] },
    ]);
    expect(buildPots([20, 20, 60], [false, false, true])).toEqual([
      { amount: 100, eligible: [0, 1] },
    ]);
    expect(buildPots([5, 25, 25, 25], [false, false, false, false])).toEqual([
      { amount: 20, eligible: [0, 1, 2, 3] },
      { amount: 60, eligible: [1, 2, 3] },
    ]);
  });
});

// ------------------------------------------------------- checkMove reasons

describe('checkMove reasons', () => {
  it('explains whose turn it is', () => {
    const s = four();
    expect(reason(s, 0, C)).toBe("It's Player 3's turn, not yours.");
    expect(reason(s, 1, C)).toBe("It's Player 3's turn, not Player 1's.");
    const t = play(s, [3, C]);
    expect(reason(t, 2, X)).toBe("It's your turn, not Player 2's.");
  });

  it('explains that a folded player is out and an all-in player has nothing to decide', () => {
    let s = four({ stacks: [100, 100, 100, 10] });
    s = play(s, [3, A], [0, F]);
    expect(reason(s, 0, C)).toMatch(/already folded/);
    expect(reason(s, 3, C)).toMatch(/all-in and has no more decisions/);
    let t = deal({ players: 3, button: 1, stacks: [5, 100, 100] });
    t = play(t, [1, C], [2, C]);
    expect(t.stacks[0]).toBe(3);
    t = play(t, [0, A]);
    expect(reason(t, 0, C)).toMatch(/You're already all-in/);
    // The all-in was a full raise, so the betting is open again for Player 1.
    expect(betOptions(t, 1).canRaise).toBe(true);
    expect(reason(t, 2, R(20))).toBe("It's Player 1's turn, not Player 2's.");
  });

  it('explains that the hand is over, bad seats and things that are not moves', () => {
    const over = play(four(), F, F, F);
    expect(reason(over, 2, X)).toBe('The hand is over — there are no more moves to make.');
    const s = four();
    expect(reason(s, 3, { type: 'dance' } as unknown as TexasHoldemMove)).toMatch(
      /isn't a poker move/,
    );
    expect(reason(s, 9, F)).toBe('There is no seat 9 at this table.');
  });

  it('explains why you cannot check when facing a bet', () => {
    const s = four();
    // Seat 3 has nothing in yet, so it costs the whole big blind (not "2 chips more").
    expect(reason(s, 3, X)).toBe(
      "You can't check — the big blind is 2 chips, so staying in costs 2 chips. You can call, raise or fold.",
    );
    const t = play(four(), C, C, C, X, [1, B(6)]);
    expect(reason(t, 2, X)).toBe(
      "You can't check — Player 1 bet, so the bet to match is 6 chips. Call 6 chips to stay in, raise, or fold.",
    );
  });

  it('explains that there is nothing to call', () => {
    const bbOption = play(four(), C, C, C);
    expect(reason(bbOption, 2, C)).toMatch(/already put in the big blind and nobody raised/);
    const flop = play(four(), C, C, C, X);
    expect(reason(flop, 1, C)).toBe(
      "There's nothing to call — nobody has bet yet this round. You can check for free, or make a bet.",
    );
  });

  it('explains that you cannot open the betting when there is already a bet', () => {
    expect(reason(four(), 3, B(6))).toBe(
      'Before the flop the blinds already count as the first bet, so you can\'t "bet" — you can call 2 chips, raise to 4 or more, or fold.',
    );
    const t = play(four(), C, C, C, X, [1, B(6)]);
    expect(reason(t, 2, B(10))).toBe(
      "Player 1 already bet this round (the bet is 6 chips), so you can't open the betting — you can call 6 chips, raise to 12 or more, or fold.",
    );
  });

  it('explains that there is nothing to raise yet', () => {
    const flop = play(four(), C, C, C, X);
    expect(reason(flop, 1, R(6))).toBe(
      "Nobody has bet yet this round, so there's nothing to raise. You can check, or bet 2 chips or more.",
    );
  });

  it('explains whole-chip amounts', () => {
    const flop = play(four(), C, C, C, X);
    expect(reason(flop, 1, B(2.5))).toMatch(/whole chips/);
    expect(reason(flop, 1, B(0))).toMatch(/whole chips/);
    expect(reason(four(), 3, R(4.5))).toMatch(/whole chips/);
    expect(reason(four(), 3, { type: 'raise' } as unknown as TexasHoldemMove)).toMatch(
      /whole chips/,
    );
  });

  it('explains bet sizes that are too small or too big', () => {
    const flop = play(four(), C, C, C, X);
    expect(reason(flop, 1, B(1))).toBe(
      'The smallest bet allowed is the big blind: 2 chips. You can only bet less than that by going all-in.',
    );
    expect(reason(flop, 1, B(99))).toBe(
      "You only have 98 chips, so you can't bet 99. To bet everything, go all-in.",
    );
  });

  it('explains raise sizes that are too small, not bigger, or too big', () => {
    const s = play(four(), [3, R(6)]);
    expect(reason(s, 0, R(8))).toBe(
      'The smallest raise here is to 10 chips — a raise must add at least 4 chips (the size of the last bet or raise) on top of the 6 chips bet. You can raise by less only by going all-in.',
    );
    expect(reason(s, 0, R(6))).toBe(
      'A raise has to make the bet bigger than 6 chips. To just match it, call instead.',
    );
    expect(reason(s, 0, R(101))).toBe(
      "You have 100 chips, so the most you can raise to is 100 — and that's going all-in.",
    );
    expect(reason(s, 2, R(200))).toMatch(/turn/);
    const t = play(s, [0, C], [1, C]);
    expect(reason(t, 2, R(200))).toBe(
      "You have 100 chips for this round (98 chips left plus the 2 chips you already bet), so the most you can raise to is 100 — and that's going all-in.",
    );
  });

  it('explains when a short all-in has not re-opened the betting', () => {
    let s = play(
      deal({ players: 3, button: 0, stacks: [100, 100, 14] }),
      [0, C],
      [1, C],
      [2, X],
      [1, B(10)],
      [2, A],
      [0, C],
    );
    expect(reason(s, 1, R(30))).toBe(
      "Player 2 went all-in for less than a full raise, and you have already acted this round, so the betting isn't re-opened: you can't raise. You can call 2 chips or fold.",
    );
    expect(reason(s, 1, A)).toMatch(/you can't go all-in as a raise/);
    s = play(s, [1, C]);
    expect(s.street).toBe('turn');
  });

  it('explains that you cannot raise when a call already puts you all-in', () => {
    const s = four({ stacks: [100, 100, 100, 2] });
    expect(reason(s, 3, R(4))).toBe(
      "You don't have enough chips to raise — calling 2 chips already puts you all-in. You can call or fold.",
    );
  });

  it('explains that nobody can respond when everyone else is all-in', () => {
    const s = play(deal({ players: 2, button: 0, stacks: [100, 30] }), [0, R(6)], [1, A]);
    expect(reason(s, 0, R(60))).toBe(
      'Everyone else still in the hand is all-in, so nobody could match a raise. You can call 24 chips or fold.',
    );
    expect(reason(s, 0, A)).toMatch(/nobody could match a raise/);
    // A hand-made spot where the opponent is all-in and nothing is owed.
    const flop = play(deal({ players: 2, button: 0 }), C, X);
    const odd: TexasHoldemState = { ...flop, stacks: [98, 0] };
    expect(reason(odd, 1, B(4))).toMatch(/not your|turn|all-in/);
    const odd2: TexasHoldemState = { ...flop, stacks: [0, 98] };
    expect(reason(odd2, 1, B(4))).toBe(
      "Everyone else still in the hand is all-in, so there's nobody left to bet against — just check.",
    );
  });

  it('accepts every move in legalMoves, and applyMove throws IllegalMoveError otherwise', () => {
    const states = [four(), play(four(), [3, R(6)]), play(four(), C, C, C, X)];
    for (const s of states) {
      const p = engine.currentPlayer(s) ?? 0;
      for (const m of engine.legalMoves(s, p)) expect(engine.checkMove(s, p, m).ok).toBe(true);
    }
    const s = four();
    expect(() => engine.applyMove(s, X)).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(s, B(4))).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(s, R(3))).toThrow(IllegalMoveError);
    const over = play(four(), F, F, F);
    expect(() => engine.applyMove(over, F)).toThrow(IllegalMoveError);
  });
});

// ------------------------------------------------------- result & flags

describe('result and flags', () => {
  it('result() before the end throws', () => {
    expect(() => engine.result(four())).toThrow();
  });

  it('net = final stack − starting stack; scores sum to zero', () => {
    const s = play(four(), [3, R(6)], [0, F], [1, F], [2, F]);
    const r = engine.result(s);
    expect(r.scores).toEqual([0, -1, -2, 3]);
    expect(sum(r.scores ?? [])).toBe(0);
    expect(r.humanNetUnits).toBe(0);
    expect(r.humanOutcome).toBe('push');
    expect(r.winners).toEqual([3]);
    expect(r.flags.folded).toBe(true);
    expect(r.summary).toBe(
      'You folded before the flop, and Player 3 won the 5-chip pot without a showdown.',
    );
  });

  it('folding in the blind is a loss of the blind', () => {
    const s = play(four({ button: 3 }), [2, C], [3, C], [0, F], [1, X]);
    expect(s.street).toBe('flop');
    const end = checkDown(s);
    const r = engine.result(end);
    expect(r.humanNetUnits).toBe(-1);
    expect(r.humanOutcome).toBe('loss');
    expect(r.flags.folded).toBe(true);
    expect(r.summary).toMatch(/^You folded before the flop; at the showdown /);
  });

  it('bluff-win: the learner bets and everyone folds', () => {
    let s = four();
    s = play(s, [3, C], [0, C], [1, C], [2, X], [1, X], [2, X], [3, X], [0, B(6)], [1, F]);
    s = play(s, [2, F], [3, F]);
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(6);
    expect(r.flags.tags).toContain('bluff-win');
    expect(r.flags.folded).toBe(false);
    expect(r.flags.bigPot).toBe(false);
    expect(r.summary).toBe(
      'Everyone else folded, so you won the 8-chip pot without showing your cards.',
    );
  });

  it('a big pot, a bust and the worst case of −100 (the maximum loss)', () => {
    let s = deal({ players: 2, button: 0, hands: ['7C 2D', 'AS AH'], board: 'KD 9S 4H 3C JS' });
    s = play(s, [0, A], [1, C]);
    const r = engine.result(s);
    expect(r.humanNetUnits).toBe(-MAX_LOSS_UNITS);
    expect(r.humanOutcome).toBe('loss');
    expect(r.flags.bust).toBe(true);
    expect(r.flags.bigPot).toBe(true);
    expect(r.flags.tags).toContain('all-in');
    expect(r.summary).toBe(
      "At the showdown Player 1's Pair of Aces beat your High Card, King, so Player 1 won the 200-chip pot.",
    );
  });

  it('a big win sets bigPot; a small one does not', () => {
    let s = deal({ players: 2, button: 0, hands: ['AS AH', '7C 2D'], board: 'KD 9S 4H 3C JS' });
    s = play(s, [0, R(20)], [1, C]);
    s = checkDown(s);
    const r = engine.result(s);
    expect(r.humanNetUnits).toBe(20);
    expect(r.flags.bigPot).toBe(false);
    let t = deal({ players: 2, button: 0, hands: ['AS AH', '7C 2D'], board: 'KD 9S 4H 3C JS' });
    t = play(t, [0, R(30)], [1, C]);
    t = checkDown(t);
    expect(engine.result(t).flags.bigPot).toBe(true);
    expect(engine.result(t).summary).toBe(
      "At the showdown your Pair of Aces beat Player 1's High Card, King, and you won the 60-chip pot.",
    );
  });

  it('luckyLastCard: behind on the turn, ahead after the river', () => {
    // A-K vs Q-Q: Ace high on the turn, a King on the river.
    const lucky = checkDown(
      deal({ players: 2, button: 0, hands: ['AH KH', 'QS QD'], board: '2H 7C 9S 4D KD' }),
    );
    const r = engine.result(lucky);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.luckyLastCard).toBe(true);
    expect(r.flags.comeback).toBe(false); // not all-in
    // Same hands, but the King comes on the turn: ahead on the turn already.
    const early = checkDown(
      deal({ players: 2, button: 0, hands: ['AH KH', 'QS QD'], board: '2H 7C 9S KD 4D' }),
    );
    expect(engine.result(early).flags.luckyLastCard).toBe(false);
  });

  it('comeback: all-in and behind on the flop/turn, but won', () => {
    let s = deal({ players: 2, button: 0, hands: ['AH KH', 'QS QD'], board: '2H 7C 9S KD 3S' });
    s = play(s, [0, A], [1, C]);
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.comeback).toBe(true);
    expect(r.flags.luckyLastCard).toBe(false);
    // Ahead all the way: no comeback.
    let t = deal({ players: 2, button: 0, hands: ['AH KH', 'QS QD'], board: 'KS 7C 9S 2D 3S' });
    t = play(t, [0, A], [1, C]);
    expect(engine.result(t).flags.comeback).toBe(false);
    // Behind on the flop but not all-in until the turn, when already ahead: no comeback.
    let u = deal({ players: 2, button: 0, hands: ['AH KH', 'QS QD'], board: '2H 7C 9S KD 3S' });
    u = play(u, [0, C], [1, X], [1, X], [0, X], [1, X], [0, A], [1, C]);
    expect(u.outcome?.kind).toBe('showdown');
    expect(engine.result(u).flags.comeback).toBe(false);
  });

  it('closeFinish: a kicker decides (win or lose); not when the hands are different kinds', () => {
    const win = checkDown(
      deal({ players: 2, button: 0, hands: ['AH KD', 'AC QS'], board: 'AS 7D 4C 2H 9S' }),
    );
    expect(engine.result(win).flags.closeFinish).toBe(true);
    const lose = checkDown(
      deal({ players: 2, button: 0, hands: ['AC QS', 'AH KD'], board: 'AS 7D 4C 2H 9S' }),
    );
    expect(engine.result(lose).humanOutcome).toBe('loss');
    expect(engine.result(lose).flags.closeFinish).toBe(true);
    const clear = checkDown(
      deal({ players: 2, button: 0, hands: ['KH KD', 'QC QS'], board: 'AS 7D 4C 2H 9S' }),
    );
    expect(engine.result(clear).flags.closeFinish).toBe(false);
  });

  it('perfect: winning with four of a kind or a straight flush; royal-flush tag', () => {
    const quads = checkDown(
      deal({ players: 2, button: 0, hands: ['QS QH', 'AC KD'], board: 'QD QC 2S 7H 9D' }),
    );
    const rq = engine.result(quads);
    expect(rq.flags.perfect).toBe(true);
    expect(rq.flags.tags).toContain('four-of-a-kind');
    const royal = checkDown(
      deal({ players: 2, button: 0, hands: ['AS KS', 'AC KD'], board: 'QS JS TS 2D 3C' }),
    );
    const rr = engine.result(royal);
    expect(rr.flags.perfect).toBe(true);
    expect(rr.flags.tags).toContain('royal-flush');
    const sf = checkDown(
      deal({ players: 2, button: 0, hands: ['9H 8H', 'AC KD'], board: '7H 6H 5H 2D 3C' }),
    );
    expect(engine.result(sf).flags.tags).toContain('straight-flush');
    const plain = checkDown(
      deal({ players: 2, button: 0, hands: ['AS AH', 'KC KD'], board: '2S 7H 9D 3C 4D' }),
    );
    expect(engine.result(plain).flags.perfect).toBe(false);
  });

  it('folded-best-hand: the learner folded the hand that would have won', () => {
    let s = four({ hands: ['AS AH', '7C 2D', '8H 3S', '9D 4C'], board: 'KD QS 5H 6C JS' });
    s = play(s, [3, C], [0, F]);
    s = checkDown(s);
    const r = engine.result(s);
    expect(r.flags.folded).toBe(true);
    expect(r.flags.tags).toContain('folded-best-hand');
  });

  it('the showdown tag and a plain multi-way win summary', () => {
    const s = checkDown(
      four({ hands: ['AS AH', '7C 2D', '8H 3S', '9D 4C'], board: 'KD QS 5H 6C JS' }),
    );
    const r = engine.result(s);
    expect(r.flags.tags).toContain('showdown');
    expect(r.summary).toBe(
      'At the showdown your Pair of Aces beat every other hand, and you won the 8-chip pot.',
    );
  });
});

// ------------------------------------------- immutability & determinism

describe('immutability and determinism', () => {
  const playOut = (seed: number) => {
    let s = engine.setup({ players: 5 }, createRng(`imm-${seed}`));
    const rng = createRng(`bots-${seed}`);
    const log: string[] = [];
    while (!engine.isOver(s)) {
      const p = engine.currentPlayer(s) ?? 0;
      const m = engine.botMove(s, p, p % 2 ? 'easy' : 'normal', rng);
      const before = JSON.stringify(s);
      deepFreeze(s);
      const next = engine.applyMove(s, m);
      expect(JSON.stringify(s)).toBe(before);
      log.push(engine.moveKey(m));
      s = next;
    }
    return { log, result: engine.result(s), state: s };
  };

  it('applyMove never mutates its (deep-frozen) input', () => {
    for (let seed = 0; seed < 25; seed++) playOut(seed);
  });

  it('the same seeds replay exactly the same hand', () => {
    for (const seed of [3, 11, 19]) expect(playOut(seed)).toEqual(playOut(seed));
  });
});

// --------------------------------------------------------------- describe

describe('describeMove', () => {
  it('uses "You" for seat 0 and "Player N" for the others', () => {
    const s = four();
    expect(engine.describeMove(s, 3, C)).toBe('Player 3 calls 2 chips.');
    const t = play(s, [3, C]);
    expect(engine.describeMove(t, 0, R(6))).toBe('You raise to 6 chips.');
    expect(engine.describeMove(t, 0, F)).toBe('You fold.');
    expect(seatName(0)).toBe('You');
    expect(seatName(4)).toBe('Player 4');
  });

  it('announces all-ins and newly dealt board cards (but never hole cards)', () => {
    const s = four({ board: 'AS KD 7C 4H 2S' });
    const t = play(s, [3, C], [0, C], [1, C]);
    const text = engine.describeMove(t, 2, X);
    expect(text).toBe(
      'Player 2 checks. The flop: Ace of Spades, King of Diamonds and Seven of Clubs.',
    );
    const short = four({ stacks: [100, 100, 100, 2] });
    expect(engine.describeMove(short, 3, C)).toBe('Player 3 calls 2 chips and is all-in.');
    expect(engine.describeMove(four(), 3, A)).toBe('Player 3 goes all-in, raising to 100 chips.');
    const flop = play(four(), C, C, C, X);
    expect(engine.describeMove(flop, 1, A)).toBe('Player 1 goes all-in for 98 chips.');
    expect(engine.describeMove(flop, 1, B(98))).toBe('Player 1 bets 98 chips — all-in!');
    expect(engine.describeMove(flop, 1, B(5))).toBe('Player 1 bets 5 chips.');
    const shortCall = four({ stacks: [100, 100, 100, 2] });
    expect(engine.describeMove(shortCall, 3, A)).toBe('Player 3 calls all-in for 2 chips.');
  });

  it('does not reveal a folding bot’s cards or a winner’s cards when everyone folds', () => {
    const s = play(four(), [3, R(6)], [0, F], [1, F]);
    const text = engine.describeMove(s, 2, F);
    expect(text).toBe(
      'Player 2 folds. 4 chips that nobody matched go back to Player 3. Everyone else has folded, so Player 3 wins the 5-chip pot.',
    );
    for (const c of [...(s.hands[2] ?? []), ...(s.hands[3] ?? [])]) {
      expect(text).not.toContain(cardName(c));
    }
  });

  it('describes the run-out and the showdown', () => {
    const s = deal({ players: 2, button: 0, hands: ['AH KH', 'QS QD'], board: '2H 7C 9S 4D KD' });
    const t = play(s, [0, A]);
    expect(engine.describeMove(t, 1, C)).toBe(
      'Player 1 calls 98 chips and is all-in. No more betting is possible, so the rest of the board is dealt. The flop: Two of Hearts, Seven of Clubs and Nine of Spades. The turn: Four of Diamonds. The river: King of Diamonds. Showdown: you win the 200-chip pot with Pair of Kings.',
    );
  });

  it('explains illegal moves instead of describing them', () => {
    expect(engine.describeMove(four(), 3, X)).toMatch(/^Not allowed: You can't check/);
  });
});

// ------------------------------------------------------------------ coach

describe('coach', () => {
  it('on your turn: describes the spot, lists the options and suggests a legal move', () => {
    const s = play(four({ hands: ['AS AH', '', '', ''] }), [3, C]);
    const c = engine.coach(s, 0);
    expect(c.situation).toContain('You hold A♠ A♥ — a pair of Aces.');
    expect(c.situation).toContain("You're on the button");
    expect(c.situation).toContain('To stay in you must call 2 chips.');
    expect(c.situation).toContain(
      'You can fold, call 2 chips, raise to 4–99 chips or go all-in for 100 chips.',
    );
    const legal = keys(s, 0);
    expect(legal).toContain(engine.moveKey(c.suggestion as TexasHoldemMove));
    expect(['raise', 'all-in']).toContain((c.suggestion as TexasHoldemMove).type);
    expect(c.why).toMatch(/very best starting hands/);
    expect(engine.coach(s, 0)).toEqual(c);
  });

  it('suggests folding trash and explains why', () => {
    const s = play(four({ hands: ['7C 2D', '', '', ''] }), [3, R(6)]);
    const c = engine.coach(s, 0);
    expect(c.suggestion).toEqual(F);
    expect(c.why).toMatch(/weak starting hand/);
  });

  it('after the flop it talks about the made hand, draws and the price', () => {
    let s = four({ hands: ['AH 5H', '', '', ''], board: 'KH 9H 2C 4D 8S' });
    s = play(s, [3, C], [0, C], [1, C], [2, X], [1, B(6)], [2, F], [3, F]);
    const c = engine.coach(s, 0);
    expect(c.situation).toContain('The board shows K♥ 9♥ 2♣.');
    expect(c.situation).toMatch(/flush draw/);
    expect(c.situation).toContain('To stay in you must call 6 chips.');
    expect(keys(s, 0)).toContain(engine.moveKey(c.suggestion as TexasHoldemMove));
    expect(c.why).toMatch(/win at least \d+% of the time/);
  });

  it('when it is not your turn, after folding, all-in, or at the end: no suggestion', () => {
    const s = four();
    const c = engine.coach(s, 0);
    expect(c.situation).toMatch(/^It's Player 3's turn/);
    expect(c.suggestion).toBeUndefined();
    const folded = play(four(), [3, C], [0, F]);
    expect(engine.coach(folded, 0).situation).toMatch(/^You've folded/);
    const allIn = play(four({ stacks: [10, 100, 100, 100] }), [3, C], [0, A]);
    expect(engine.coach(allIn, 0).situation).toMatch(/^You're all-in/);
    const over = play(four(), F, F, F);
    expect(engine.coach(over, 0).situation).toBe(engine.result(over).summary);
  });
});

// --------------------------------------------------------------- rigging

describe('test helpers', () => {
  it('rigDeck builds a full deck that deals the requested cards', () => {
    const deck = rigDeck({
      players: 3,
      button: 2,
      hands: ['AS AH', 'KS KH', ''],
      board: '2C 3C 4C',
    });
    expect(new Set(deck).size).toBe(52);
    const s = deal({ players: 3, button: 2, hands: ['AS AH', 'KS KH', ''], board: '2C 3C 4C' });
    expect(s.hands[0]).toEqual(cards('AS AH'));
    expect(s.hands[1]).toEqual(cards('KS KH'));
    expect(checkDown(s).board.slice(0, 3)).toEqual(cards('2C 3C 4C'));
  });
});

describe('coach option wording', () => {
  it('lists a single amount instead of a one-chip range', () => {
    // The learner is first to act with 5 chips: a raise to exactly 4, or all-in.
    const s = deal({ players: 4, button: 1, stacks: [5, 100, 100, 100] });
    expect(s.toAct).toBe(0);
    expect(engine.coach(s, 0).situation).toContain(
      'You can fold, call 2 chips, raise to 4 chips or go all-in for 5 chips.',
    );
  });
});
