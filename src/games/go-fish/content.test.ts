/**
 * The lesson must teach exactly the variant the engine plays: these checks tie the
 * worked examples in content/games/go-fish.ts to the engine and the coach.
 */
import { describe, expect, it } from 'vitest';
import type { CardCode } from '@/games/core/cards';
import type { PlayerId } from '@/games/core/types';
import { validateGameContent } from '@/lib/content/schema';
import content from '@content/games/go-fish';
import { goFishEngine as engine, type GoFishMove } from './engine';
import { handSizeFor, MAX_PLAYERS, MIN_PLAYERS, mostBooks, payoutUnits } from './rules';
import { makeState } from './test-helpers';

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
const ask = (target: PlayerId, rank: string): GoFishMove =>
  ({ type: 'ask', target, rank }) as GoFishMove;
const quiz = (text: string) => {
  const q = content.quiz.find((x) => x.question.includes(text));
  if (!q) throw new Error(`quiz question "${text}" not found`);
  return q.options[q.answer];
};

describe('go fish content matches the engine', () => {
  it('validates as a Tier 1 content file at journey position 20', () => {
    const { issues } = validateGameContent(content, { fileSlug: 'go-fish', hasEngine: true });
    expect(issues).toEqual([]);
    expect(content.order).toBe(20);
    expect(content.featured).toBe(false);
    expect(content.players).toEqual({ min: MIN_PLAYERS, max: MAX_PLAYERS, ideal: 3 });
  });

  it('deals the number of cards the lesson says', () => {
    expect(zoneCards('Deal 7 cards each (5 with 4 or 5 players)', 'hand')).toHaveLength(
      handSizeFor(2),
    );
    expect(zoneCards('Deal 7 cards each (5 with 4 or 5 players)', 'opponent')).toHaveLength(
      handSizeFor(3),
    );
    expect(handSizeFor(4)).toBe(5);
    expect(handSizeFor(5)).toBe(5);
  });

  it('the asking step lists exactly the ranks the engine lets you ask for', () => {
    const hand = zoneCards('Your turn: ask for a rank you hold', 'hand');
    const s = makeState({ hands: [hand.join(' '), '4S 4H', 'QS QD'] });
    const ranks = [...new Set(engine.legalMoves(s, 0).map((m) => m.rank))];
    expect(ranks).toEqual(['2', '3', '7', '9', 'K']);
    expect(engine.checkMove(s, 0, ask(1, 'Q')).ok).toBe(false);
    expect(step('Your turn: ask for a rank you hold').body).toContain(
      'Twos, Threes, Sevens, Nines or Kings — but not Queens',
    );
  });

  it('the tiny example plays out move for move on the engine', () => {
    // You: 5♣ 5♥ J♦. Player 1 has the 5♠; Player 2 has no Fives; the pond gives 5♦ then 2♠.
    const s = makeState({ hands: ['5C 5H JD', '5S 9C 9D', 'KS KH 3C'], stock: '5D 2S' });
    const a = engine.applyMove(s, ask(1, '5'));
    expect(a.turn).toBe(0);
    const b = engine.applyMove(a, ask(2, '5'));
    expect(b.books[0]).toEqual([{ rank: '5', via: 'wish' }]);
    expect(b.turn).toBe(0);
    const c = engine.applyMove(b, ask(1, 'J'));
    expect(c.turn).toBe(1);
    expect(c.hands[0]!.slice().sort()).toEqual(zoneCards('A tiny example', 'hand').slice().sort());
    expect(zoneCards('A tiny example', 'book').every((card) => card[0] === '5')).toBe(true);
  });

  it('the winning example and the quiz use the engine’s rules', () => {
    const books = ['you', 'p1', 'p2'].map((id) => zoneCards('Winning: the most books', id).length);
    expect(books).toEqual([5, 4, 4]);
    expect(books.reduce((x, y) => x + y, 0)).toBe(13);
    expect(mostBooks(books)).toEqual([0]);
    expect(payoutUnits(0, mostBooks(books), 3)).toBe(2);
    expect(quiz('When does the game end')).toBe('When all 13 books are made; most books wins');

    // "You hold the 7♠, the 7♦ and the K♣."
    const q1 = makeState({ hands: ['7S 7D KC', '2S 2H', '3S 3H'] });
    expect([...new Set(engine.legalMoves(q1, 0).map((m) => m.rank))]).toEqual(['7', 'K']);
    expect(quiz('You hold the 7♠')).toBe('Sevens or Kings');

    // "They hold two Fives": both are handed over and you go again.
    const q2 = engine.applyMove(makeState({ hands: ['5C', '5S 5H 9D', 'KS'] }), ask(1, '5'));
    expect(q2.hands[0]).toEqual(['5S', '5H', '5C']);
    expect(q2.turn).toBe(0);
    expect(quiz('they hold two Fives')).toBe('They hand over both Fives and you go again');

    // Fishing your wish.
    const q3 = engine.applyMove(makeState({ hands: ['JC', '5S', 'KS'], stock: 'JD' }), ask(1, 'J'));
    expect(q3.turn).toBe(0);
    expect(quiz('draw a Jack')).toBe('Show it and go again');
  });

  it('the strategy example is what the coach would suggest', () => {
    const hand = zoneCards('Beginner strategy: listen and remember', 'hand');
    const s = makeState({
      hands: [hand.join(' '), '2S 9D 9H', 'QS 5D 6D'],
      log: [
        { type: 'ask', seat: 2, target: 1, rank: 'Q', got: 0 },
        { type: 'fish', seat: 2, card: '6D', wish: false },
      ],
    });
    expect(engine.coach(s, 0).suggestion).toEqual(ask(2, 'Q'));
  });
});
