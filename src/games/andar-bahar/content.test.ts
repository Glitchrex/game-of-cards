/**
 * The lesson must teach exactly the variant the engine plays: these checks replay every
 * lesson scene that shows a deal through the engine, and tie the numbers quoted in the
 * lesson, tips and quiz to the engine's exact odds and payouts.
 */
import { describe, expect, it } from 'vitest';
import { makeDeck, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { validateGameContent } from '@/lib/content/schema';
import content from '@content/games/andar-bahar';
import engine, {
  expectedNetBeforeDeal,
  MAX_DEAL_LENGTH,
  otherSide,
  PAYOUT,
  percent,
  setupWithDeck,
  sideForCard,
  winChances,
  type AndarBaharState,
} from './engine';

type Zone = { id: string; cards: string[]; highlight?: number[] };

function zone(zones: readonly Zone[], id: string): Zone | undefined {
  return zones.find((z) => z.id === id);
}

/** Interleave the two piles into deal order: Andar 1st, Bahar 1st, Andar 2nd, … */
function dealOrder(andar: readonly string[], bahar: readonly string[]): CardCode[] {
  const out: CardCode[] = [];
  for (let i = 0; i < andar.length + bahar.length; i++) {
    const card = (sideForCard(i) === 'andar' ? andar : bahar)[Math.floor(i / 2)];
    if (card === undefined) throw new Error('piles do not alternate from Andar');
    out.push(card as CardCode);
  }
  return out;
}

function replay(joker: CardCode, sequence: CardCode[]): AndarBaharState {
  const rest = makeDeck().filter((c) => c !== joker && !sequence.includes(c));
  let s = engine.applyMove(setupWithDeck({ players: 2 }, [joker, ...sequence, ...rest]), {
    type: 'bet',
    side: 'bahar',
  });
  for (let i = 0; i < sequence.length && !engine.isOver(s); i++) {
    s = engine.applyMove(s, { type: 'deal' });
  }
  return s;
}

const allText = [
  ...content.lesson.flatMap((l) => [l.body, l.tip ?? '', l.scene?.caption ?? '']),
  ...content.tips,
  ...content.mistakes,
  ...content.glossary.map((g) => g.definition),
  ...content.quiz.flatMap((q) => [q.question, q.explanation, ...q.options]),
].join(' ');

describe('andar-bahar content matches the engine', () => {
  it('validates as a Tier 1 content file at journey order 50', () => {
    const { issues } = validateGameContent(content, { fileSlug: 'andar-bahar', hasEngine: true });
    expect(issues).toEqual([]);
    expect(content.order).toBe(50);
    expect(content.featured ?? false).toBe(false);
  });

  it('every lesson deal replays on the engine with the same winner and highlighted match', () => {
    let replayed = 0;
    for (const step of content.lesson) {
      const zones = (step.scene?.zones ?? []) as Zone[];
      const andar = zone(zones, 'andar');
      const bahar = zone(zones, 'bahar');
      const joker = zone(zones, 'joker')?.cards[0] as CardCode | undefined;
      if (!andar || !bahar || !joker) continue;
      replayed++;
      const sequence = dealOrder(andar.cards, bahar.cards);
      expect(new Set([joker, ...sequence]).size, step.title).toBe(sequence.length + 1);
      const s = replay(joker, sequence);
      const last = sequence.at(-1);
      const matched = last !== undefined && last[0] === joker[0];
      // Either the scene ends on the match, or nothing has matched yet.
      expect(engine.isOver(s), step.title).toBe(matched);
      expect(s.andar.length + s.bahar.length, step.title).toBe(sequence.length);
      if (matched) {
        const side = sideForCard(sequence.length - 1);
        expect(s.winner, step.title).toBe(side);
        const pile = side === 'andar' ? andar : bahar;
        expect(pile.highlight, step.title).toEqual([pile.cards.length - 1]);
      } else {
        expect(andar.highlight ?? [], step.title).toEqual([]);
        expect(bahar.highlight ?? [], step.title).toEqual([]);
      }
    }
    expect(replayed).toBeGreaterThanOrEqual(5);
  });

  it('the worked example pays what the engine pays', () => {
    const step = content.lesson.find((l) => l.title === 'A tiny example');
    const zones = (step?.scene?.zones ?? []) as Zone[];
    const sequence = dealOrder(zone(zones, 'andar')!.cards, zone(zones, 'bahar')!.cards);
    const s = replay(zone(zones, 'joker')!.cards[0] as CardCode, sequence);
    const r = engine.result(s); // the learner bet Bahar in replay()
    expect(r.humanNetUnits * 10).toBe(10);
    expect(step?.body).toMatch(/bet 10 Jeet on \[\[Bahar\]\]/);
    expect(step?.body).toMatch(/win 10 more/);
  });

  it('the odds and payouts quoted to learners are the engine’s', () => {
    expect(percent(winChances(0).andar)).toBe('51.5%');
    expect(percent(winChances(0).bahar)).toBe('48.5%');
    expect(allText).toContain('51.5');
    expect(allText).toContain('48.5');
    expect(PAYOUT).toEqual({ andar: 0.9, bahar: 1 });
    expect(allText).toContain('0.9 to 1');
    const andarLoss = Math.round(-expectedNetBeforeDeal('andar') * 100);
    const baharLoss = Math.round(-expectedNetBeforeDeal('bahar') * 100);
    expect([andarLoss, baharLoss]).toEqual([2, 3]);
    expect(allText).toContain(`about ${andarLoss} Jeet lost per 100 bet, against ${baharLoss}`);
    const q = content.quiz.find((x) => x.question.includes('10 Jeet on Andar'));
    expect(q?.options[q.answer]).toBe(`${10 * PAYOUT.andar} Jeet`);
  });

  it('the quiz answer on the first card agrees with the engine', () => {
    const q = content.quiz.find((x) => x.question.includes('first card'));
    expect(q?.options[q.answer]).toBe('Andar');
    expect(sideForCard(0)).toBe('andar');
  });

  it('bets lock the moment the bet is placed, before card 1 — as the lesson says', () => {
    const step = content.lesson.find((l) => l.title === 'Place your bet');
    expect(step?.body).toMatch(
      /As soon as your bet is down the dealing starts, and bets are locked/,
    );
    // The engine allows no window between betting and the first card for switching sides.
    const placed = engine.applyMove(engine.setup({ players: 2 }, createRng(3)), {
      type: 'bet',
      side: 'andar',
    });
    expect(placed.andar.length + placed.bahar.length).toBe(0);
    const switchCheck = engine.checkMove(placed, 0, { type: 'bet', side: 'bahar' });
    expect(switchCheck.ok).toBe(false);
    expect(switchCheck.reason).toMatch(/Bets are locked/);
    expect(allText).not.toMatch(/once the first card is dealt, bets/i);
  });

  it('never claims the choice of side cannot change the odds (Andar and Bahar differ)', () => {
    const { andar, bahar } = winChances(0);
    expect(andar).not.toBeCloseTo(bahar, 2);
    expect(allText).not.toMatch(/no choice can change your (odds|chances)/i);
    expect(allText).not.toMatch(/(equal|same) (odds|chances)|50\s*(\/|-)\s*50/i);
    const pure = content.glossary.find((g) => g.term === 'pure chance');
    expect(pure?.definition).toMatch(/Picking a side is your only choice/);
  });

  it('the “side due the next card is the favourite” tip holds at every point of the deal', () => {
    expect(content.tips.some((t) => /due the next card is always the favourite/.test(t))).toBe(
      true,
    );
    for (let dealt = 0; dealt < MAX_DEAL_LENGTH; dealt++) {
      const c = winChances(dealt);
      const next = sideForCard(dealt);
      expect(c[next]).toBeGreaterThan(c[otherSide(next)]);
    }
    // Only slightly at the start; by the end it can be a near-certainty.
    expect(winChances(0).andar - winChances(0).bahar).toBeLessThan(0.04);
    expect(winChances(MAX_DEAL_LENGTH - 2).bahar).toBe(0.75);
  });
});
