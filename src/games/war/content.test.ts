/**
 * The lesson must teach exactly the variant the engine plays: these checks tie the scenes
 * and quiz answers in content/games/war.ts to the engine's rules.
 */
import { describe, expect, it } from 'vitest';
import type { CardCode } from '@/games/core/cards';
import { validateGameContent } from '@/lib/content/schema';
import content from '@content/games/war';
import {
  cardValue,
  DEFAULT_MAX_BATTLES,
  faceDownCount,
  resolveBattle,
  WAR_FACE_DOWN,
  warEngine,
} from './engine';
import { deal52, flip } from './test-helpers';

const step = (title: string) => {
  const s = content.lesson.find((l) => l.title === title);
  if (!s) throw new Error(`lesson step "${title}" not found`);
  return s;
};
const zone = (title: string, id: string) => {
  const z = step(title).scene?.zones.find((x) => x.id === id);
  if (!z) throw new Error(`zone ${id} not found in "${title}"`);
  return { ...z, cards: z.cards as CardCode[] };
};
const quiz = (fragment: string) => {
  const q = content.quiz.find((x) => x.question.includes(fragment));
  if (!q) throw new Error(`quiz question "${fragment}" not found`);
  return q.options[q.answer];
};

describe('war content matches the engine', () => {
  it('validates as a Tier 1 content file and is first on the journey', () => {
    const { issues } = validateGameContent(content, { fileSlug: 'war', hasEngine: true });
    expect(issues).toEqual([]);
    expect(content.order).toBe(10);
    expect(content.featured).toBe(false);
    expect(content.lesson.length).toBeGreaterThanOrEqual(5);
    expect(content.lesson.length).toBeLessThanOrEqual(7);
  });

  it('teaches the 60-battle limit the engine uses', () => {
    expect(DEFAULT_MAX_BATTLES).toBe(60);
    expect(content.variantTaught).toContain('60 battles');
    expect(step('How the game ends').body).toContain('60 battles');
  });

  it('every single-card battle scene highlights the card the engine says wins', () => {
    for (const title of ['The goal: win every card', 'A battle: flip and compare']) {
      const you = zone(title, 'you');
      const them = zone(title, 'opponent');
      const outcome = resolveBattle([you.cards, them.cards]);
      expect(outcome.wars).toBe(0);
      expect(outcome.winner).toBe(0);
      expect(you.highlight).toEqual([0]);
    }
  });

  it('the rank row runs from lowest to highest, with the Ace on top', () => {
    const row = zone('Which card is higher?', 'ranks');
    const values = row.cards.map(cardValue);
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(13);
    expect(row.highlight).toEqual([12]);
    expect(row.cards[12]?.[0]).toBe('A');
  });

  it('the war scene plays out exactly as the engine fights it', () => {
    const you = zone('A tie means WAR!', 'you');
    const them = zone('A tie means WAR!', 'opponent');
    const outcome = resolveBattle([you.cards, them.cards]);
    expect(outcome.wars).toBe(1);
    expect(outcome.winner).toBe(0);
    expect(outcome.won).toHaveLength(10);
    const hidden = Array.from({ length: WAR_FACE_DOWN }, (_, i) => i + 1);
    expect(you.faceDown).toEqual(hidden);
    expect(them.faceDown).toEqual(hidden);
    expect(you.highlight).toEqual([WAR_FACE_DOWN + 1]);
    expect(outcome.rounds[1]?.up).toEqual([you.cards[4], them.cards[4]]);
  });

  it('the two-Aces scene really is a war', () => {
    const outcome = resolveBattle([
      [...zone('The secret strategy: enjoy the luck', 'you').cards, '2C'],
      [...zone('The secret strategy: enjoy the luck', 'opponent').cards, '3C'],
    ]);
    expect(outcome.wars).toBeGreaterThan(0);
  });

  it('the ending example (30 vs 22 after battle 60) is a win for the learner', () => {
    // 29 vs 23 before the last battle, which the learner wins → 30 vs 22.
    const before = { ...deal52(['AS'], ['2C'], 29), battles: DEFAULT_MAX_BATTLES - 1 };
    const after = flip(before);
    expect([after.piles[0].length, after.piles[1].length]).toEqual([30, 22]);
    expect(warEngine.result(after).humanOutcome).toBe('win');
    expect(zone('How the game ends', 'you').label).toBe('You: 30 cards');
    expect(zone('How the game ends', 'opponent').label).toBe('Opponent: 22 cards');
  });

  it('the card counts quoted in the glossary, tips and lesson match the engine', () => {
    const term = (t: string) => content.glossary.find((g) => g.term === t)?.definition ?? '';
    // A war puts 10 cards in the middle, a double war 18 — and either is still one battle.
    const war = flip(deal52(['9H', '2S', '3S', '4S', 'QS'], ['9C', '2D', '3D', '4D', '4C'], 26));
    expect(war.lastBattle?.won).toHaveLength(10);
    expect(war.battles).toBe(1);
    const double = flip(
      deal52(
        ['9H', '2S', '3S', '4S', 'QS', '5S', '6S', '7S', 'AS'],
        ['9C', '2D', '3D', '4D', 'QD', '5D', '6D', '7D', '8D'],
        26,
      ),
    );
    expect(double.lastBattle?.wars).toBe(2);
    expect(double.lastBattle?.won).toHaveLength(18);
    expect(double.battles).toBe(1);
    expect(term('double war')).toContain('18 cards');
    expect(content.tips.some((t) => t.includes('10 cards') && t.includes('18'))).toBe(true);
    expect(step('How the game ends').body).toContain('counts as one battle');
    expect(content.variantTaught).toContain('counts as one battle');
    // A push is 26–26 at the cap (or both players out in the same war).
    const push = flip({ ...deal52(['AS'], ['2C'], 25), battles: DEFAULT_MAX_BATTLES - 1 });
    expect(warEngine.result(push).humanOutcome).toBe('push');
    expect([push.piles[0].length, push.piles[1].length]).toEqual([26, 26]);
    expect(term('push')).toContain('26 cards after 60 battles');
  });

  it('the quiz answers agree with the engine', () => {
    expect(cardValue('AD')).toBeGreaterThan(cardValue('KS'));
    expect(quiz('K♠')).toContain('the Ace is the highest card');
    expect(quiz('Seven')).toContain(`${WAR_FACE_DOWN} cards face down`);
    expect(faceDownCount(2)).toBe(1);
    expect(quiz('only have 2 cards left')).toBe('Lay 1 card face down and flip your last card');
    const winner = flip(deal52(['KH'], ['7C'])).piles[0];
    expect(winner.slice(-2)).toEqual(['KH', '7C']);
    expect(quiz('Where do the two cards go?')).toBe('Under the bottom of your pile');
    expect(quiz('after 60 battles')).toContain('Whoever holds more cards');
  });
});
