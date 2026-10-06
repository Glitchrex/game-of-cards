import { describe, expect, it } from 'vitest';
import { createRng } from '@/games/core/rng';
import {
  crazyEightsEngine as engine,
  canDraw,
  type CrazyEightsEvent,
  type CrazyEightsMove,
} from './engine';
import { cards, makeState } from './test-helpers';
import { chooseSuitForEight, easyMove, normalDecision, seatView } from './strategy';

describe('seat view (what a bot may know)', () => {
  it('remembers suits a player drew on until they play that suit again', () => {
    const s = makeState({
      hands: ['3H 7S', '4S 5D', '9D'],
      top: 'KH',
      log: [
        { type: 'draw', seat: 1, card: 'AS', facing: 'H', reshuffled: false },
        { type: 'draw', seat: 1, card: 'AD', facing: 'C', reshuffled: false },
        { type: 'play', seat: 1, card: 'QC', suit: 'C' },
        { type: 'draw', seat: 2, card: '2D', facing: 'S', reshuffled: false },
        { type: 'play', seat: 2, card: '8C', suit: 'H' },
      ],
    });
    const view = seatView(s, 0, canDraw(s));
    expect(view.drewOn).toEqual([[], ['H'], ['S']]);
    // An Eight says nothing about the suits a player holds.
    expect(view.seen).toEqual([s.starter, 'QC', '8C']);
    expect(view.handCounts).toEqual([2, 2, 1]);
    expect(view.hand).toEqual(cards('7S 3H'));
    expect(view.pile).toMatchObject({ top: 'KH', activeSuit: 'H', canDraw: true });
  });

  it('records who named the suit for an Eight on top', () => {
    const s = makeState({ hands: ['3H', '4S', '5S'], top: '8D', activeSuit: 'S', namedBy: 2 });
    expect(seatView(s, 0, true).pile.namedBy).toBe(2);
  });

  it('only counts draws made on the current turn for the player to move', () => {
    const s = makeState({ hands: ['3H', '4S', '5S'], top: 'KH', drawnThisTurn: 2 });
    expect(seatView(s, 0, true).drawnThisTurn).toBe(2);
    expect(seatView(s, 1, true).drawnThisTurn).toBe(0);
  });
});

describe('naming a suit for an Eight', () => {
  const view = (hand: string, log: CrazyEightsEvent[] = []) =>
    seatView(makeState({ hands: [hand, '4S 5S'], top: 'KH', log }), 0, true);

  it('names the longest suit left in hand', () => {
    const v = view('8S 2C 9C 4D');
    expect(chooseSuitForEight(v, cards('2C 9C 4D'))).toEqual({
      suit: 'C',
      reason: 'Clubs are your longest suit (2 cards), so you can keep playing them',
    });
  });

  it('explains a single remaining card plainly', () => {
    const v = view('8S 4D');
    expect(chooseSuitForEight(v, cards('4D'))).toEqual({
      suit: 'D',
      reason:
        'you still hold a Diamond (the 4♦), so you can play it next turn if nobody changes the suit',
    });
  });

  it('with only Eights left, picks a suit the next player had to draw on', () => {
    const v = view('8S 8H', [
      { type: 'draw', seat: 1, card: 'AS', facing: 'D', reshuffled: false },
    ]);
    expect(chooseSuitForEight(v, cards('8H'))).toMatchObject({ suit: 'D' });
    expect(chooseSuitForEight(v, cards('8H')).reason).toMatch(/Player 1 had to draw/);
  });

  it('otherwise picks the suit seen most often, or admits any suit will do', () => {
    // The starter K♥ and one Club have been seen: a tie, so no suit is better.
    const tied = view('8S', [{ type: 'play', seat: 1, card: '4C', suit: 'C' }]);
    expect(chooseSuitForEight(tied, []).reason).toBe(
      'you have no other suit left to aim for, so any suit is as good as another',
    );
    const played = view('8S', [
      { type: 'play', seat: 1, card: '4C', suit: 'C' },
      { type: 'play', seat: 0, card: '9C', suit: 'C' },
    ]);
    const choice = chooseSuitForEight(played, []);
    // The starter KH is one Heart; two Clubs have been played.
    expect(choice.suit).toBe('C');
    expect(choice.reason).toMatch(/more Clubs have been played/);
  });
});

describe('decisions', () => {
  it('normal explains drawing again and reshuffling', () => {
    const s = makeState({
      hands: ['7S 2C', '4H', '5H'],
      top: 'KH',
      stock: '',
      reshuffle: true,
      drawnThisTurn: 1,
    });
    const d = normalDecision(seatView(s, 0, canDraw(s)));
    expect(d.move).toEqual({ type: 'draw' });
    expect(d.why).toMatch(/so draw again/);
    expect(d.why).toMatch(/shuffled into a new stock first/);
  });

  it('easy names a random suit when only Eights are left', () => {
    const s = makeState({ hands: ['8S', '4H', '5H'], top: 'KH' });
    const suits = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const m = easyMove(seatView(s, 0, true), createRng(i)) as Extract<
        CrazyEightsMove,
        { type: 'play' }
      >;
      expect(m.card).toBe('8S');
      suits.add(m.suit ?? '');
    }
    expect(suits.size).toBeGreaterThan(1);
  });
});

describe('recommended practice hand', () => {
  it('seed 1344 (3 players): following the coach wins against easy and normal bots', () => {
    for (const difficulty of ['easy', 'normal'] as const) {
      let s = engine.setup({ players: 3 }, createRng(1344));
      // Opening choice: a suit match (Q♦), a rank switch (K♠) or the wild 8♥.
      expect(engine.legalMoves(s, 0).map((m) => engine.moveKey(m))).toEqual([
        'play:KS',
        'play:8H:S',
        'play:8H:H',
        'play:8H:D',
        'play:8H:C',
        'play:QD',
        'draw',
      ]);
      expect(engine.coach(s, 0).suggestion).toEqual({ type: 'play', card: 'KS' });
      const rng = createRng('bot-1344');
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s)!;
        const move =
          p === 0
            ? (engine.coach(s, 0).suggestion as CrazyEightsMove)
            : engine.botMove(s, p, difficulty, rng);
        s = engine.applyMove(s, move);
      }
      expect(engine.result(s).humanOutcome).toBe('win');
    }
  });
});
