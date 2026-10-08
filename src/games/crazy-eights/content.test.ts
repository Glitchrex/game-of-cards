/**
 * The lesson must teach exactly the variant the engine plays: these checks tie every worked
 * example, scene and quiz answer in content/games/crazy-eights.ts to the engine's rules.
 */
import { describe, expect, it } from 'vitest';
import { cardShort, makeDeck, suitOf, type CardCode, type Suit } from '@/games/core/cards';
import { validateGameContent } from '@/lib/content/schema';
import content from '@content/games/crazy-eights';
import { crazyEightsEngine as engine } from './engine';
import { canPlay, cardPoints, handPoints, handSizeFor, isEight, playableCards } from './rules';
import { makeState } from './test-helpers';

const step = (title: string) => {
  const s = content.lesson.find((l) => l.title === title);
  if (!s) throw new Error(`lesson step "${title}" not found`);
  return s;
};
const zone = (title: string, id: string) => {
  const z = step(title).scene?.zones.find((x) => x.id === id);
  if (!z) throw new Error(`zone ${id} not found in "${title}"`);
  return z;
};
const zoneCards = (title: string, id: string) => zone(title, id).cards as CardCode[];
const highlighted = (title: string, id: string) => {
  const z = zone(title, id);
  return (z.highlight ?? []).map((i) => z.cards[i] as CardCode);
};
const SHORT = new Map(makeDeck().map((c) => [cardShort(c), c] as const));
/** "The 7♦" → '7D' */
const parseOption = (text: string): CardCode => {
  const c = SHORT.get(text.replace(/^The /, ''));
  if (!c) throw new Error(`not a card option: ${text}`);
  return c;
};
const pileAt = (top: CardCode, activeSuit: Suit = suitOf(top)) => ({ top, activeSuit });

describe('crazy eights content matches the engine', () => {
  it('validates as a Tier 1 content file at journey position 30', () => {
    const { issues } = validateGameContent(content, { fileSlug: 'crazy-eights', hasEngine: true });
    expect(issues).toEqual([]);
    expect(content.order).toBe(30);
  });

  it('the deal scene shows a real deal: every seat holds the hand size for that table', () => {
    const title = 'Deal 5 cards each (7 for two players)';
    const seats = step(title).scene!.zones.filter((z) => z.id !== 'stock' && z.id !== 'pile');
    expect(seats.length).toBeGreaterThanOrEqual(2);
    for (const seat of seats) expect(seat.cards).toHaveLength(handSizeFor(seats.length));
    expect(zoneCards(title, 'pile')).toHaveLength(1);
    expect(isEight(zoneCards(title, 'pile')[0]!)).toBe(false);
    expect([2, 3, 4].map(handSizeFor)).toEqual([7, 5, 5]);
  });

  it('the matching scenes highlight exactly the cards the engine lets you play', () => {
    const cases: [string, string, CardCode, Suit?][] = [
      ['Your turn: match the suit or the rank', 'hand', 'QH'],
      ['Matching the rank switches the suit', 'hand', 'QC'],
      ['Eights are wild!', 'hand', 'KS'],
      ['After an Eight, follow the named suit', 'next', '8D', 'C'],
    ];
    for (const [title, id, top, suit] of cases) {
      const hand = zoneCards(title, id);
      expect(highlighted(title, id)).toEqual(playableCards(hand, pileAt(top, suit)));
    }
    // The rank match (Q♣ on Q♥) really switches the suit to Clubs.
    const s = makeState({ hands: ['QC 3S', '4D', '5D'], top: 'QH' });
    expect(engine.applyMove(s, { type: 'play', card: 'QC' }).activeSuit).toBe('C');
  });

  it('the drawing scene: nothing matches, and the drawn card does', () => {
    const title = "Can't play? Draw from the stock";
    expect(playableCards(zoneCards(title, 'hand'), pileAt('6S'))).toEqual([]);
    expect(canPlay(zoneCards(title, 'drawn')[0]!, pileAt('6S'))).toBe(true);
  });

  it('the blocked-game scene: nobody can play, the labels add up, and the lowest wins', () => {
    const title = 'Winning — and the rare blocked game';
    const top = zoneCards(title, 'pile')[0]!;
    const seats = ['you', 'p1', 'p2'];
    const totals = seats.map((id) => {
      const hand = zoneCards(title, id);
      expect(playableCards(hand, pileAt(top))).toEqual([]);
      const total = handPoints(hand);
      expect(zone(title, id).label).toContain(`${total} points`);
      return total;
    });
    expect(Math.min(...totals)).toBe(totals[0]);
    const body = step(title).body;
    expect(body).toContain('K, Q, J and 10 count 10, an Ace counts 1');
    expect(cardPoints('KD')).toBe(10);
    expect(cardPoints('AH')).toBe(1);
    expect(cardPoints('8S')).toBe(50);
    expect(body).toContain('An Eight would count 50');
    expect(body).toContain('tied players share the pot');
  });

  it('the tiny example is a legal sequence of plays', () => {
    const played = zoneCards('A tiny example', 'played');
    expect(played).toEqual(['5D', '5C', 'JC', '8S', '2H']);
    let pile = pileAt(played[0]!);
    for (const c of played.slice(1)) {
      expect(canPlay(c, pile)).toBe(true);
      // The 8♠ names Hearts.
      pile = pileAt(c, isEight(c) ? 'H' : suitOf(c));
    }
    // Player 1 had no Club, no Five and no Eight but drew the J♣, which fits.
    expect(canPlay('JC', pileAt('5C'))).toBe(true);
  });

  it('the strategy scene suggests what the coach (normal bot) would play', () => {
    const title = 'Beginner strategy';
    const hand = zoneCards(title, 'hand');
    const s = makeState({ hands: [hand.join(' '), '2S 3S 4S', '5S 6S 7S'], top: 'KD' });
    const suggestion = engine.coach(s, 0).suggestion;
    expect(suggestion).toEqual({ type: 'play', card: highlighted(title, 'hand')[0] });
    expect(step(title).scene?.caption).toContain('K♥');
  });

  it('every quiz answer about a legal card agrees with the engine', () => {
    const q1 = content.quiz.find((q) =>
      q.question.includes('top card of the discard pile is the 7♠'),
    );
    expect(q1).toBeDefined();
    const legal1 = q1!.options.filter((o) => canPlay(parseOption(o), pileAt('7S')));
    expect(legal1).toEqual([q1!.options[q1!.answer]]);
    const q2 = content.quiz.find((q) => q.question.includes('plays the 8♥ and names Clubs'));
    expect(q2).toBeDefined();
    const cardOptions = q2!.options.filter((o) => o.startsWith('The '));
    const legal2 = cardOptions.filter((o) => canPlay(parseOption(o), pileAt('8H', 'C')));
    expect(legal2).toEqual([q2!.options[q2!.answer]]);
  });

  it('the stuck-player quiz matches the engine: draw while the stock has cards', () => {
    const s = makeState({ hands: ['7S 2C', '4H', '5H'], top: 'KH' });
    expect(engine.legalMoves(s, 0)).toEqual([{ type: 'draw' }]);
    const q = content.quiz.find((x) => x.question.includes('Nothing in your hand matches'));
    expect(q!.options[q!.answer]).toMatch(/^Draw/);
  });
});
