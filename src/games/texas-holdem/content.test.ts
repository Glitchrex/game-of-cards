/**
 * The lesson must teach exactly the variant the engine plays: these checks tie
 * the examples and quiz answers in content/games/texas-holdem.ts to the engine.
 */
import { describe, expect, it } from 'vitest';
import type { CardCode } from '@/games/core/cards';
import { validateGameContent } from '@/lib/content/schema';
import content from '@content/games/texas-holdem';
import engine, { betOptions, compareHands, evaluateHand, potTotal } from './engine';
import { B, C, F, R, X, cards, checkDown, deal, play } from './test-helpers';

const step = (title: string) => {
  const s = content.lesson.find((l) => l.title === title);
  if (!s) throw new Error(`lesson step "${title}" not found`);
  return s;
};
const zoneCards = (title: string, id: string): CardCode[] => {
  const zone = step(title).scene?.zones.find((z) => z.id === id);
  if (!zone) throw new Error(`zone ${id} not found in "${title}"`);
  return zone.cards as CardCode[];
};
const quiz = (fragment: string) => {
  const q = content.quiz.find((x) => x.question.includes(fragment));
  if (!q) throw new Error(`quiz question with "${fragment}" not found`);
  return q.options[q.answer];
};

describe('Texas Hold’em content matches the engine', () => {
  it('validates as a featured Tier 1 content file at journey position 130', () => {
    const { issues } = validateGameContent(content, { fileSlug: 'texas-holdem', hasEngine: true });
    expect(issues).toEqual([]);
    expect(content.order).toBe(130);
    expect(content.featured).toBe(true);
    expect(content.players).toEqual({ min: 2, max: 6, ideal: 4 });
  });

  it('the hand-ranking scenes show each hand type, strongest first', () => {
    const zones: [string, string, string][] = [
      ['Hand rankings 1: the monsters', 'royal', 'Royal Flush'],
      ['Hand rankings 1: the monsters', 'quads', 'Four of a Kind, Nines'],
      ['Hand rankings 1: the monsters', 'boat', 'Full House, Kings full of Sevens'],
      ['Hand rankings 2: flush, straight, three of a kind', 'flush', 'Flush, Ace high'],
      ['Hand rankings 2: flush, straight, three of a kind', 'straight', 'Straight to the Nine'],
      ['Hand rankings 2: flush, straight, three of a kind', 'trips', 'Three of a Kind, Queens'],
      ['Hand rankings 3: two pair, pair, high card', 'twopair', 'Two Pair, Jacks and Fours'],
      ['Hand rankings 3: two pair, pair, high card', 'pair', 'Pair of Eights'],
      ['Hand rankings 3: two pair, pair, high card', 'high', 'High Card, Ace'],
    ];
    const values = zones.map(([title, id, name]) => {
      const v = evaluateHand(zoneCards(title, id));
      expect(v.name).toBe(name);
      return v;
    });
    for (let i = 1; i < values.length; i++) {
      const a = values[i - 1];
      const b = values[i];
      if (!a || !b) throw new Error('missing value');
      expect(compareHands(a, b)).toBeGreaterThan(0);
    }
  });

  it('“best five out of seven” makes the straight it describes', () => {
    const title = 'Best five out of seven';
    const v = evaluateHand([...zoneCards(title, 'hand'), ...zoneCards(title, 'board')]);
    expect(v.name).toBe('Straight to the Jack');
    expect(v.cards).toEqual(cards('JS TD 9C 8H 7H'));
  });

  it('the tiny worked hand plays out exactly as told: a 31-chip pot won by the King kicker', () => {
    const title = 'A tiny hand, start to finish';
    const mine = zoneCards(title, 'hand').join(' ');
    const asha = zoneCards(title, 'asha').join(' ');
    // Four seats: you (0) on the button, blinds 1 and 2, Asha (3) first to act.
    let s = deal({
      players: 4,
      button: 0,
      hands: [mine, '', '', asha],
      board: zoneCards(title, 'board').join(' '),
    });
    s = play(s, [3, R(6)], [0, C], [1, F], [2, F]);
    expect(s.street).toBe('flop');
    expect(s.board).toEqual(cards('AS 7D 4C'));
    s = play(s, [3, B(8)], [0, C], [3, X], [0, X], [3, X], [0, X]);
    expect(engine.isOver(s)).toBe(true);
    expect(s.outcome?.pots).toEqual([
      { amount: 31, eligible: [0, 3], winners: [0], shares: [31], handName: 'Pair of Aces' },
    ]);
    const r = engine.result(s);
    expect(r.flags.closeFinish).toBe(true);
    expect(step(title).scene?.caption).toContain('31 chips');
  });

  it('“after a bet of 6, the smallest raise is to 12”', () => {
    const flop = play(deal({ players: 4, button: 0 }), C, C, C, X, [1, B(6)]);
    expect(betOptions(flop, 2).minRaiseTo).toBe(12);
    expect(step('Your turn: fold, check, call, bet or raise').body).toContain(
      'after a bet of 6, the smallest raise is to 12',
    );
  });

  it('the blinds are 1 and 2, the pot starts at 3, everyone has 100 chips', () => {
    const s = deal({ players: 4, button: 0 });
    expect(s.smallBlind).toBe(1);
    expect(s.bigBlind).toBe(2);
    expect(potTotal(s)).toBe(3);
    expect(s.startingStacks).toEqual([100, 100, 100, 100]);
  });

  it('quiz answers agree with the engine', () => {
    // Flush vs straight.
    const flush = evaluateHand(cards('AD JD 8D 6D 3D'));
    const straight = evaluateHand(cards('5C 6H 7S 8C 9H'));
    expect(compareHands(flush, straight)).toBeGreaterThan(0);
    expect(quiz('flush or a straight')).toBe('The flush');
    // K♠ K♦ on K♣ 7♥ 7♦ 2♠ 9♣.
    expect(evaluateHand(cards('KS KD KC 7H 7D 2S 9C')).name).toBe(
      'Full House, Kings full of Sevens',
    );
    expect(quiz('K♠ K♦')).toBe('Full house, Kings full of Sevens');
    // Nobody has bet on the flop: call is the impossible move.
    const flop = play(deal({ players: 4, button: 0 }), C, C, C, X);
    expect(engine.checkMove(flop, 1, C).ok).toBe(false);
    expect(engine.checkMove(flop, 1, X).ok).toBe(true);
    expect(engine.checkMove(flop, 1, B(4)).ok).toBe(true);
    expect(engine.checkMove(flop, 1, { type: 'all-in' }).ok).toBe(true);
    expect(quiz('Nobody has bet yet on the flop')).toBe('Call');
    // Raise to 6 over a big blind of 2 → the smallest re-raise is to 10.
    const raised = play(deal({ players: 4, button: 0 }), [3, R(6)]);
    expect(betOptions(raised, 0).minRaiseTo).toBe(10);
    expect(quiz('raises to 6')).toBe('To 10 chips');
  });

  it('the button acts last after the flop', () => {
    const s = checkDown(play(deal({ players: 4, button: 0 }), C, C, C, X));
    const flopActions = s.log.filter((e) => e.kind === 'action' && e.street === 'flop');
    expect(flopActions[flopActions.length - 1]).toMatchObject({ player: 0 });
  });
});
