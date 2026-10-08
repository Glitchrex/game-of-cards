/**
 * Adversarial rule checks: one focused test per rule in docs/RULES_DECISIONS.md → Crazy Eights
 * (plus the engine notes), aimed at the edge cases — simultaneous end conditions, the last
 * stock card, tiny reshuffles, forced passes, shared pots and the starter-burying rule.
 */
import { describe, expect, it } from 'vitest';
import { makeDeck, type CardCode } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import type { PlayerId } from '@/games/core/types';
import {
  canDraw,
  canReshuffle,
  crazyEightsEngine as engine,
  type CrazyEightsMove,
  type CrazyEightsState,
} from './engine';
import { handPoints } from './rules';
import { chooseSuitForEight, seatView } from './strategy';
import { allCards, cards, FULL_DECK, makeState } from './test-helpers';

const keys = (moves: readonly CrazyEightsMove[]) => moves.map((m) => engine.moveKey(m));
const play = (card: string, suit?: 'S' | 'H' | 'D' | 'C'): CrazyEightsMove =>
  suit === undefined
    ? { type: 'play', card: card as CardCode }
    : { type: 'play', card: card as CardCode, suit };
const DRAW: CrazyEightsMove = { type: 'draw' };
const PASS: CrazyEightsMove = { type: 'pass' };
const run = (state: CrazyEightsState, ...moves: CrazyEightsMove[]) =>
  moves.reduce((s, m) => engine.applyMove(s, m), state);

describe('starter card', () => {
  it('every Eight turned up as the starter is buried in the bottom half of the stock', () => {
    let buried = 0;
    let multi = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const players = 2 + (seed % 3);
      const s = engine.setup({ players }, createRng(seed));
      expect(s.starter[0]).not.toBe('8');
      expect(s.stock).toHaveLength(52 - players * (players === 2 ? 7 : 5) - 1);
      expect(allCards(s)).toBe(FULL_DECK);
      if (s.buried.length > 1) multi++;
      for (const eight of s.buried) {
        buried++;
        // Strictly the bottom half: with 36 cards that is index 18–35, with 31 cards 16–30.
        expect(s.stock.indexOf(eight)).toBeGreaterThanOrEqual(s.stock.length / 2);
      }
    }
    // The scan really exercised the rule, including several Eights in a row.
    expect(buried).toBeGreaterThan(150);
    expect(multi).toBeGreaterThan(0);
  });

  it('the starter is the first non-Eight after the deal; the other cards keep their order', () => {
    for (const seed of [4, 251, 280, 690, 1010]) {
      for (const players of [2, 3, 4]) {
        const s = engine.setup({ players }, createRng(seed));
        // setup's first use of the rng is the deck shuffle, so the deal can be rebuilt.
        const deck = shuffle(makeDeck(), createRng(seed));
        const rest = deck.slice(players * (players === 2 ? 7 : 5));
        const k = rest.findIndex((c) => c[0] !== '8');
        expect(s.buried).toEqual(rest.slice(0, k));
        expect(s.starter).toBe(rest[k]);
        expect(s.stock.filter((c) => !s.buried.includes(c))).toEqual(rest.slice(k + 1));
      }
    }
  });
});

describe('ending the game', () => {
  it('going out wins even when the same play would also block the game', () => {
    // Stock empty; after your 3♥ nobody could follow — but you have no cards left: you went out.
    const s = run(makeState({ hands: ['3H', '4S', '5S'], top: 'KH', stock: '' }), play('3H'));
    expect(s.endReason).toBe('out');
    expect(s.winners).toEqual([0]);
    const r = engine.result(s);
    expect(r.humanNetUnits).toBe(2);
    expect(r.flags.tags).toContain('wentOut');
    expect(r.flags.tags).not.toContain('blocked');
  });

  it('drawing the last stock card that fits does not block the game — you must then play it', () => {
    const s = run(makeState({ hands: ['2C', '3D'], top: 'KH', stock: 'QH' }), DRAW);
    expect(s.stock).toEqual([]);
    expect(engine.isOver(s)).toBe(false);
    expect(s.turn).toBe(0);
    // No draw (stock empty), no pass (you can play): the only legal move is the Q♥.
    expect(keys(engine.legalMoves(s, 0))).toEqual(['play:QH']);
  });

  it('with an empty stock, stuck players pass until someone who can play must play', () => {
    const start = makeState({ hands: ['7S 2C', '9C', '4H 2D'], top: 'KH', stock: '' });
    const afterPasses = run(start, PASS, PASS);
    expect(afterPasses.turn).toBe(2);
    expect(keys(engine.legalMoves(afterPasses, 2))).toEqual(['play:4H']);
    // After the 4♥ nobody holds a Heart, a Four or an Eight: blocked at once.
    const end = run(afterPasses, play('4H'));
    expect(end.endReason).toBe('blocked');
    expect(engine.result(end).scores).toEqual([9, 9, 2]);
    expect(end.winners).toEqual([2]);
    expect(engine.result(end).humanNetUnits).toBe(-1);
  });

  it('a 4-player blocked game with a two-way tie pays each winner +1 and the losers −1', () => {
    const s = run(
      makeState({ hands: ['4H 2C 3S', '5D', '9C', 'TS'], top: 'KH', stock: '' }),
      play('4H'),
    );
    expect(s.endReason).toBe('blocked');
    const r = engine.result(s);
    expect(r.scores).toEqual([5, 5, 9, 10]);
    expect(r.winners).toEqual([0, 1]);
    expect(r.humanNetUnits).toBe(1);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.tags).toEqual(expect.arrayContaining(['blocked', 'sharedWin']));
    expect(r.flags.bigPot).toBe(false);
    expect(r.summary).toBe(
      'The game was blocked and you tied with Player 1 for the lowest total (5 points), so you share the pot.',
    );
  });

  it('an Eight left in hand scores 50 points after someone goes out', () => {
    const s = run(makeState({ hands: ['3H', '8S 2C', '9D'], top: 'KH' }), play('3H'));
    expect(engine.result(s).scores).toEqual([0, handPoints(cards('8S 2C')), 9]);
    expect(engine.result(s).scores?.[1]).toBe(52);
  });

  it('the learner never loses more than 1 unit, whatever the table size', () => {
    for (const players of [2, 3, 4]) {
      const hands = ['7S 2C KD QD', '4H', '9D', 'JC'].slice(0, players);
      const s = run(makeState({ hands, top: 'KH', turn: 1 }), play('4H'));
      expect(engine.result(s).humanNetUnits).toBe(-1);
    }
  });
});

describe('drawing and passing', () => {
  it('after drawing by choice you may play a card you already held', () => {
    const s = run(makeState({ hands: ['3H 7S', '4S 5S', '9D'], top: 'KH', stock: '2C 9S' }), DRAW);
    expect(s.hands[0]).toEqual(cards('7S 3H 2C'));
    expect(keys(engine.legalMoves(s, 0))).toEqual(['play:3H', 'draw']);
    const next = run(s, play('3H'));
    expect(next.turn).toBe(1);
    expect(next.drawnThisTurn).toBe(0);
  });

  it('a reshuffle of a two-card discard pile gives a one-card stock, then you pass', () => {
    // You hold 7♠; Player 1 holds every other card except the K♥ (top) and the Q♣ under it.
    const others = makeDeck()
      .filter((c) => !['7S', 'KH', 'QC'].includes(c))
      .join(' ');
    const base = makeState({ hands: ['7S', others], top: 'KH', under: 'QC', reshuffle: true });
    const s0: CrazyEightsState = { ...base, stock: [], discard: ['QC', 'KH'] };
    expect(allCards(s0)).toBe(FULL_DECK);
    expect(canReshuffle(s0)).toBe(true);
    const s1 = run(s0, DRAW);
    expect(s1.reshuffles).toBe(1);
    expect(s1.hands[0]).toEqual(cards('7S QC'));
    expect(s1.stock).toEqual([]);
    expect(s1.discard).toEqual(['KH']);
    // Nothing left to shuffle, nothing matches, Player 1 can still play: you must pass.
    expect(canDraw(s1)).toBe(false);
    expect(engine.isOver(s1)).toBe(false);
    expect(engine.legalMoves(s1, 0)).toEqual([PASS]);
    expect(allCards(s1)).toBe(FULL_DECK);
  });

  it('an Eight may name its own suit, and the next player follows that suit', () => {
    const s = run(makeState({ hands: ['8D 3C', '5D 5S', '9H'], top: 'KH' }), play('8D', 'D'));
    expect(s.activeSuit).toBe('D');
    expect(keys(engine.legalMoves(s, 1))).toEqual(['play:5D', 'draw']);
  });
});

describe('result flags', () => {
  it('comeback measures the gap to the opponent with the FEWEST cards', () => {
    // You 5, Player 1 2, Player 2 6: you are 3 behind the leader.
    const s = run(
      makeState({ hands: ['2C 3C 4C 5C', '9H 9S', 'TD JD QD KD AD 2D'], top: 'KH', stock: '6C' }),
      DRAW,
    );
    expect(s.maxBehind).toBe(3);
  });

  it('closeFinish on a loss is about the learner nearly going out, not a rival bot', () => {
    // Player 1 goes out; Player 2 has 1 card left but you still hold 2.
    const s = run(makeState({ hands: ['7S 2C', '4H', '9D'], top: 'KH', turn: 1 }), play('4H'));
    expect(engine.result(s).flags.closeFinish).toBe(false);
  });
});

describe('coach reasons', () => {
  it('naming a suit for one remaining card does not promise that it can be played next turn', () => {
    const s = makeState({ hands: ['8S 4D', '4S 5S', '6C'], top: 'KH' });
    const { reason } = chooseSuitForEight(seatView(s, 0, true), cards('4D'));
    expect(reason).toMatch(/the 4♦/);
    expect(reason).toMatch(/if nobody changes the suit/);
  });

  it('every coach reason on the learner’s turn names only cards the learner can see', () => {
    for (let seed = 1; seed <= 60; seed++) {
      let s = engine.setup({ players: 2 + (seed % 3) }, createRng(`coach-leak-${seed}`));
      const rng = createRng(seed);
      while (!engine.isOver(s)) {
        const p: PlayerId = s.turn;
        if (p === 0) {
          const visible = new Set<string>([...s.hands[0]!, ...s.discard, ...s.buried]);
          const advice = engine.coach(s, 0);
          const hidden = [...s.stock, ...s.hands.slice(1).flat()].filter((c) => !visible.has(c));
          for (const c of hidden) {
            const short = `${c[0] === 'T' ? '10' : c[0]}${{ S: '♠', H: '♥', D: '♦', C: '♣' }[c[1] as 'S']}`;
            expect(`${advice.situation} ${advice.why ?? ''}`).not.toContain(` ${short}`);
          }
        }
        s = engine.applyMove(s, engine.botMove(s, p, 'normal', rng));
      }
    }
  });
});
