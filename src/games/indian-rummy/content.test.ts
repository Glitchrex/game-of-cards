/**
 * The lesson must teach exactly what the engine plays: every concrete claim made in the
 * lesson scenes and quiz is checked here against the engine's own meld solver and bots.
 */
import { describe, expect, it } from 'vitest';
import { type CardCode, cardShort } from '@/games/core/cards';
import { validateGameContent } from '@/lib/content/schema';
import content from '@content/games/indian-rummy';
import engine, { DEADWOOD_CAP, FIRST_DROP_POINTS, MIDDLE_DROP_POINTS } from './engine';
import {
  bestArrangement,
  deadwoodOf,
  handPoints,
  isJokerFor,
  isValidHand,
  wildRankFor,
} from './melds';
import { buildState, cards } from './test-helpers';

const parsed = validateGameContent(content, { fileSlug: 'indian-rummy', hasEngine: true });
const lesson = parsed.content?.lesson ?? [];

function zoneCards(step: number, id: string): CardCode[] {
  const zone = lesson[step]?.scene?.zones.find((z) => z.id === id);
  if (!zone) throw new Error(`lesson[${step}] has no zone "${id}"`);
  return zone.cards as CardCode[];
}

function allZoneCards(step: number): CardCode[] {
  return (lesson[step]?.scene?.zones ?? []).flatMap((z) => z.cards as CardCode[]);
}

describe('Indian Rummy content matches the engine', () => {
  it('is valid content with the agreed journey order and featured flag', () => {
    expect(parsed.issues).toEqual([]);
    expect(parsed.content?.order).toBe(120);
    expect(parsed.content?.featured).toBe(true);
    expect(lesson.length).toBeGreaterThanOrEqual(7);
    expect(lesson.length).toBeLessThanOrEqual(10);
  });

  it('step 1: the goal hand is a valid declaration', () => {
    expect(isValidHand(allZoneCards(0), '7')).toBe(true);
  });

  it('step 2: the wild-joker card 7♣ makes the 7♦ in hand a joker', () => {
    expect(zoneCards(1, 'wild')).toEqual(['7C']);
    expect(wildRankFor('7C')).toBe('7');
    expect(zoneCards(1, 'hand')).toHaveLength(13);
    expect(zoneCards(1, 'hand')).toContain('7D');
  });

  it('step 3: the K♥ on the open pile makes J♥ Q♥ K♥', () => {
    const hand = [...zoneCards(2, 'hand'), ...zoneCards(2, 'open')];
    const group = bestArrangement(hand, '7').groups.find((g) => g.cards.includes('KH'));
    expect(group?.kind).toBe('pure-sequence');
  });

  it('steps 4–6: the example groups are what the labels say', () => {
    const kindOf = (list: CardCode[]) => {
      const a = bestArrangement(list, '7');
      return a.groups.length === 1 ? a.groups[0]?.kind : 'not one group';
    };
    expect(kindOf(zoneCards(3, 'pure'))).toBe('pure-sequence');
    expect(kindOf(zoneCards(3, 'high'))).toBe('pure-sequence');
    expect(kindOf(zoneCards(3, 'wrap'))).toBe('unmatched');
    expect(kindOf(zoneCards(3, 'mixed'))).toBe('unmatched');
    expect(kindOf(zoneCards(4, 'three'))).toBe('set');
    expect(kindOf(zoneCards(4, 'four'))).toBe('set');
    expect(kindOf(zoneCards(4, 'bad'))).toBe('unmatched');
    expect(kindOf(zoneCards(5, 'impure'))).toBe('sequence');
    expect(kindOf(zoneCards(5, 'set'))).toBe('set');
  });

  it('step 7: the declared hand is valid after throwing the 8♣', () => {
    expect(isValidHand(allZoneCards(6), '7')).toBe(true);
    expect(lesson[6]?.scene?.caption).toMatch(/8♣/);
  });

  it('step 8: the deadwood adds up to 20 points', () => {
    const hand = allZoneCards(7);
    expect(hand).toHaveLength(13);
    expect(deadwoodOf(hand, '7')).toBe(20);
    expect(handPoints(zoneCards(7, 'dead'), '7')).toBe(20);
    expect(lesson[7]?.scene?.caption).toMatch(/= 20 points/);
    expect(lesson[7]?.body).toMatch(
      new RegExp(
        `${FIRST_DROP_POINTS} points before your first draw and ${MIDDLE_DROP_POINTS} points later`,
      ),
    );
    expect(lesson[7]?.body).toMatch(new RegExp(`more than ${DEADWOOD_CAP} points`));
  });

  it('step 9: drawing the 3♦ and throwing the 8♣ wins; Priya pays 32', () => {
    const hand = [...zoneCards(8, 'hand'), ...zoneCards(8, 'drawn')];
    const s = buildState({
      hands: [hand, zoneCards(8, 'priya')],
      wildCard: '7C',
      phase: 'discard',
    });
    expect(engine.checkMove(s, 0, { type: 'declare', discard: '8C' })).toEqual({ ok: true });
    const over = engine.applyMove(s, { type: 'declare', discard: '8C' });
    expect(over.outcome?.points).toEqual([0, 32]);
    expect(lesson[8]?.body).toMatch(/= 32 points/);
  });

  it('step 10: the normal bot would drop the "hand to drop" before its first draw', () => {
    const s = buildState({
      hands: [zoneCards(9, 'weak'), cards('3C 4C 5C 8H 8D 8S AS KD QH JC 9D 6H 2S')],
      wildCard: '7C',
    });
    expect(engine.coach(s, 0).suggestion).toEqual({ type: 'drop' });
  });

  it('every labelled group in the lesson scenes really is that group (the 7♣ makes 7s wild)', () => {
    const kindOf = (list: CardCode[]) => {
      const groups = bestArrangement(list, '7').groups;
      return groups.length === 1 ? groups[0]?.kind : 'not one group';
    };
    let checked = 0;
    for (const step of lesson) {
      for (const zone of step.scene?.zones ?? []) {
        const list = zone.cards as CardCode[];
        const label = zone.label ?? '';
        let expected: string | null = null;
        if (label.startsWith('Pure sequence')) expected = 'pure-sequence';
        else if (label.startsWith('Impure sequence')) expected = 'sequence';
        else if (label.startsWith('Set')) expected = 'set';
        else if (label.startsWith('Not ')) expected = 'unmatched';
        if (expected) {
          expect(kindOf(list), `${step.title}: ${label}`).toBe(expected);
          checked++;
        }
        // A label that names a joker must point at a real joker in that zone.
        const named = /\((\S+) = joker\)/.exec(label)?.[1];
        if (named) {
          const card = list.find((c) => cardShort(c) === named);
          expect(card && isJokerFor(card, '7'), `${label}`).toBe(true);
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(18);
    // "Always keep" shows jokers only.
    expect(zoneCards(9, 'keep').every((c) => isJokerFor(c, '7'))).toBe(true);
  });

  it('quiz answers agree with the rules engine', () => {
    const quiz = parsed.content?.quiz ?? [];
    // Q1: only 9♠ 10♠ J♠ is a pure sequence when 7s are wild.
    expect(quiz[0]?.options[quiz[0].answer]).toBe('9♠ 10♠ J♠');
    expect(bestArrangement(cards('9S TS JS'), '7').groups[0]?.kind).toBe('pure-sequence');
    expect(bestArrangement(cards('5H 6H 7D 8H'), '7').groups[0]?.kind).toBe('sequence');
    // Q3: no pure sequence and 95 points → pays 80.
    const ninetyFive = cards('9S QS KS 9H JH KH TD QD 6D JC 9C KC 2S');
    expect(handPoints(ninetyFive, '7')).toBeGreaterThan(80);
    expect(deadwoodOf(ninetyFive, '7')).toBe(80);
    expect(quiz[2]?.options[quiz[2].answer]).toBe('80 points');
    // Q4: with the 4♥ turned up, the 4♠ is a joker.
    expect(quiz[3]?.options[quiz[3].answer]).toBe('4♠');
    expect(wildRankFor('4H')).toBe('4');
  });
});
