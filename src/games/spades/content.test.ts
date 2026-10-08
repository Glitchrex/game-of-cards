/**
 * The lesson must teach exactly the variant the engine plays: these checks tie
 * the worked examples in content/games/spades.ts to the engine and the coach.
 */
import { describe, expect, it } from 'vitest';
import type { CardCode } from '@/games/core/cards';
import { validateGameContent } from '@/lib/content/schema';
import content from '@content/games/spades';
import { breaksSpades, scoreTeam, winningPlay } from './rules';
import { estimateTricks, normalBid, seatView } from './strategy';
import { bidState } from './test-helpers';

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

describe('spades content matches the engine', () => {
  it('validates as a Tier 1 content file', () => {
    const { issues } = validateGameContent(content, { fileSlug: 'spades', hasEngine: true });
    expect(issues).toEqual([]);
    expect(content.order).toBe(110);
  });

  it('the bidding example hand is a bid of 4 for the coach', () => {
    const hand = zoneCards('Bidding: count your tricks', 'hand');
    const s = bidState({ hands: [hand.join(' '), null, null, null] });
    expect(normalBid(seatView(s, 0)).bid).toBe(4);
  });

  it('the Nil example hand is a Nil for the coach', () => {
    const hand = zoneCards('Nil: the bold zero', 'hand');
    expect(estimateTricks(hand).nilSuitable).toBe(true);
    const s = bidState({ hands: [hand.join(' '), null, null, null] });
    expect(normalBid(seatView(s, 0)).bid).toBe(0);
  });

  it('the scoring example and quiz answers use the engine’s scoring', () => {
    // Your team: bid 5 (3 + 2), won 7 → 52; opponents: bid 7 (4 + 3), won 6 → −70.
    const bids = [3, 4, 2, 3];
    const won = [4, 3, 3, 3];
    expect(scoreTeam(0, bids, won).total).toBe(52);
    expect(scoreTeam(1, bids, won).total).toBe(-70);
    const q = content.quiz.find((x) => x.question.includes('bid 5 and won 7'));
    expect(q?.options[q.answer]).toBe('52 points');
  });

  it('teaches the same "breaking Spades" rule the engine enforces', () => {
    // The pictured earlier trick breaks Spades: a Spade played on a Club lead.
    const earlier = zoneCards('Breaking Spades', 'trick');
    const plays = earlier.map((card, seat) => ({ seat, card }));
    const spadeAt = earlier.findIndex((c) => c.endsWith('S'));
    expect(spadeAt).toBeGreaterThan(0);
    expect(breaksSpades(plays.slice(0, spadeAt), earlier[spadeAt]!)).toBe(true);
    // Every place that defines it says "a Spade on a trick of another suit" and that
    // a Spades-only lead alone does not break them.
    const glossary = content.glossary.find((g) => g.term === 'breaking Spades')?.definition ?? '';
    expect(glossary).toMatch(/Spade on a trick of another suit/);
    expect(step('Breaking Spades').body).toMatch(/Spade on a trick of another suit/);
    expect(step('Breaking Spades').body).toMatch(/does not break Spades/);
    const q = content.quiz.find((x) => x.question.includes('No Spade has been played yet'));
    expect(q?.explanation).toMatch(/Spade on a trick of another suit/);
    expect(content.variantTaught).toMatch(/Spade on a trick of another suit/);
  });

  it('teaches avoiding bags as a habit for safe hands, as the bots play it', () => {
    expect(step('Beginner strategy').body).toMatch(/safely decided/);
    expect(content.tips.some((t) => /safely decided/.test(t))).toBe(true);
  });

  it('the trick examples are won by the highlighted card', () => {
    for (const [title, id] of [
      ['A trick: follow suit', 'trick'],
      ['Spades are always trump', 'trick'],
      ['Breaking Spades', 'trick'],
      ['A tiny example', 'trick'],
    ] as const) {
      const cardsInTrick = zoneCards(title, id);
      const plays = cardsInTrick.map((card, seat) => ({ seat, card }));
      const highlighted = step(title).scene?.zones.find((z) => z.id === id)?.highlight ?? [];
      expect([winningPlay(plays).seat]).toEqual(highlighted);
    }
  });
});
