/**
 * The lesson must teach exactly the variant the engine plays: these checks tie the scenes,
 * tips, glossary and quiz answers in content/games/blackjack.ts to the engine and to the
 * basic-strategy chart the coach uses.
 */
import { describe, expect, it } from 'vitest';
import type { CardCode } from '@/games/core/cards';
import { validateGameContent } from '@/lib/content/schema';
import content from '@content/games/blackjack';
import {
  BLACKJACK_PAYS,
  basicStrategy,
  blackjackEngine as E,
  cardPoints,
  DEALER,
  dealerChecksForBlackjack,
  DEFAULT_DECKS,
  handValue,
  isAce,
  LEARNER,
  settleRound,
} from './engine';
import { deal, finishDealer, play } from './test-helpers';

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
const pair = (cards: CardCode[]): [CardCode, CardCode] => [cards[0]!, cards[1]!];
const quizAnswer = (fragment: string) => {
  const q = content.quiz.find((x) => x.question.includes(fragment));
  if (!q) throw new Error(`quiz question "${fragment}" not found`);
  return q.options[q.answer]!;
};

/** One upcard per strategy-chart column: 2 3 4 5 6 7 8 9 10 A. */
const UPCARDS: CardCode[] = ['2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'KC', 'AC'];
const up = (n: number): CardCode => UPCARDS[n === 11 ? 9 : n - 2]!;
const ALL = { canDouble: true, canSplit: true };
/** Basic strategy for a two-card hand against the upcard worth `n` (2–11). */
const chart = (cards: [CardCode, CardCode], n: number) => basicStrategy(cards, up(n), ALL);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
/** A two-card, non-pair hard hand worth `total` (12–19). */
const hard = (total: number): [CardCode, CardCode] => ['TS', `${total - 10}H` as CardCode];

describe('blackjack content matches the engine', () => {
  it('validates as a Tier 1 content file with the required placement and tip', () => {
    const { issues } = validateGameContent(content, { fileSlug: 'blackjack', hasEngine: true });
    expect(issues).toEqual([]);
    expect(content.order).toBe(40);
    expect(content.featured).toBe(true);
    expect(content.hook).toMatch(/closer to 21 than the dealer/);
    expect(content.tips).toContain(
      'Tip: in Blackjack, standing on 12 against a dealer 6 is usually right.',
    );
  });

  it('describes exactly the variant the engine plays', () => {
    expect(DEFAULT_DECKS).toBe(6);
    for (const phrase of [
      '6-deck shoe',
      'stands on all 17s (soft 17 too)',
      'peeks for Blackjack',
      'Blackjack pays 3 to 2',
      'also after splitting',
      'once',
      'split Aces get one card each',
      '21 after a split is not a Blackjack',
      'stands automatically',
      'no surrender and no insurance',
    ]) {
      expect(content.variantTaught).toContain(phrase);
    }
  });

  it('every hand total written in a scene label is the engine’s total', () => {
    const labelled: [string, string, number, boolean?][] = [
      ['The goal: beat the dealer', 'dealer', 17],
      ['The goal: beat the dealer', 'you', 19],
      ['What the cards are worth', 'soft', 17, true],
      ['The deal', 'you', 8],
      ['Your turn: hit or stand', 'you', 17],
      ['Double down', 'you', 21],
      ['Split a pair', 'hand1', 11],
      ['Split a pair', 'hand2', 18],
      ['The dealer’s turn', 'dealer', 17, true],
      ['The dealer’s turn', 'you', 18],
      ['Winning and payouts', 'dealer', 17],
      ['A tiny example', 'dealer', 25],
      ['A tiny example', 'you', 12],
      ['Beginner strategy', 'you', 12],
    ];
    for (const [title, id, total, soft] of labelled) {
      const z = zone(title, id);
      expect(handValue(z.cards).total, `${title} / ${id}`).toBe(total);
      if (soft !== undefined) expect(handValue(z.cards).soft).toBe(soft);
      expect(z.label, `${title} / ${id}`).toContain(String(total));
    }
  });

  it('teaches the card values the engine uses', () => {
    expect(zone('What the cards are worth', 'numbers').cards.map(cardPoints)).toEqual([2, 5, 9]);
    expect(zone('What the cards are worth', 'tens').cards.map(cardPoints)).toEqual([
      10, 10, 10, 10,
    ]);
    expect(isAce(zone('What the cards are worth', 'ace').cards[0]!)).toBe(true);
    // Tip: soft 17 + a 10 drops the Ace to 1 → hard 17.
    expect(handValue(['AD', '6S', 'TS'])).toEqual({ total: 17, soft: false });
  });

  it('the deal: a 9 upcard means no peek', () => {
    const dealer = zone('The deal', 'dealer');
    expect(dealer.faceDown).toEqual([1]);
    expect(dealerChecksForBlackjack(dealer.cards[0]!)).toBe(false);
    expect(dealerChecksForBlackjack('AS')).toBe(true);
    expect(dealerChecksForBlackjack('KS')).toBe(true);
  });

  it('hit or stand: the coach hits the 8 and stands on the 17 against a 9', () => {
    const you = zone('Your turn: hit or stand', 'you').cards;
    const dealer = pair(zone('Your turn: hit or stand', 'dealer').cards);
    const s = deal(pair(you), dealer, [you[2]!]);
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'hit' });
    const hit = play(s, 'hit');
    expect(hit.hands[0]!.cards).toEqual(you);
    expect(E.coach(hit, LEARNER).suggestion).toEqual({ type: 'stand' });
  });

  it('double down: 11 against a 6 is a double, and the King makes 21', () => {
    const you = zone('Double down', 'you').cards;
    const s = deal(pair(you), pair(zone('Double down', 'dealer').cards), [you[2]!]);
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'double' });
    const d = play(s, 'double');
    expect(d.hands[0]).toMatchObject({ cards: you, bet: 2, done: true });
  });

  it('split a pair: the coach splits 8s against a 7 and the hands become 11 and 18', () => {
    const h1 = zone('Split a pair', 'hand1').cards;
    const h2 = zone('Split a pair', 'hand2').cards;
    const s = deal([h1[0]!, h2[0]!], pair(zone('Split a pair', 'dealer').cards), [h1[1]!, h2[1]!]);
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'split' });
    expect(play(s, 'split').hands.map((h) => h.cards)).toEqual([h1, h2]);
  });

  it('the dealer’s turn: a soft 17 stands and the 18 wins', () => {
    const s = play(
      deal(
        pair(zone('The dealer’s turn', 'you').cards),
        pair(zone('The dealer’s turn', 'dealer').cards),
      ),
      'stand',
      'reveal',
    );
    expect(E.legalMoves(s, DEALER)).toEqual([{ type: 'dealer-stand' }]);
    expect(E.result(finishDealer(s)).humanNetUnits).toBe(1);
  });

  it('winning and payouts: Ace + King pays 3 to 2 (bet 10, win 15)', () => {
    const s = deal(
      pair(zone('Winning and payouts', 'you').cards),
      pair(zone('Winning and payouts', 'dealer').cards),
    );
    const r = E.result(play(s, 'reveal'));
    expect(r.humanNetUnits).toBe(BLACKJACK_PAYS);
    expect(10 * BLACKJACK_PAYS).toBe(15);
    expect(step('Winning and payouts').body).toContain('bet 10, win 15');
  });

  it('a tiny example plays out exactly as the engine plays it', () => {
    const dealer = zone('A tiny example', 'dealer').cards;
    const s = deal(pair(zone('A tiny example', 'you').cards), pair(dealer), [dealer[2]!]);
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'stand' });
    const end = finishDealer(play(s, 'stand'));
    expect(end.dealer).toEqual(dealer);
    expect(settleRound(end).dealerBust).toBe(true);
    expect(E.result(end).humanNetUnits).toBe(1);
  });

  it('beginner strategy: every rule of thumb in the lesson matches the coach’s chart', () => {
    const s = deal(
      pair(zone('Beginner strategy', 'you').cards),
      pair(zone('Beginner strategy', 'dealer').cards),
    );
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'stand' });
    const body = step('Beginner strategy').body;
    // "stand on a hard 17 or more"
    expect(body).toContain('stand on a hard 17 or more');
    for (const t of range(17, 19))
      for (const n of range(2, 11)) expect(chart(hard(t), n)).toBe('stand');
    expect(chart(['TS', 'KH'], 6)).toBe('stand');
    // "With a hard 12 to 16, stand if the dealer shows 2 to 6 (but hit 12 against a 2 or 3),
    //  and hit if the dealer shows 7 or higher."
    for (const t of range(12, 16)) {
      for (const n of range(2, 6)) {
        expect(chart(hard(t), n)).toBe(t === 12 && n <= 3 ? 'hit' : 'stand');
      }
      for (const n of range(7, 11)) expect(chart(hard(t), n)).toBe('hit');
    }
    // "Double 11 unless the dealer shows an Ace, and double 10 against 2 to 9."
    for (const n of range(2, 11)) {
      expect(chart(['5S', '6H'], n)).toBe(n === 11 ? 'hit' : 'double');
      expect(chart(['4S', '6H'], n)).toBe(n <= 9 ? 'double' : 'hit');
    }
    // "Always split Aces and 8s, never 10s or 5s."
    for (const n of range(2, 11)) {
      expect(chart(['AS', 'AH'], n)).toBe('split');
      expect(chart(['8S', '8H'], n)).toBe('split');
      expect(chart(['TS', 'TH'], n)).not.toBe('split');
      expect(chart(['5S', '5H'], n)).not.toBe('split');
    }
    // "Never stand on a soft 17 or less: hit it (or double against a weak upcard)."
    for (const second of ['2H', '3H', '4H', '5H', '6H'] as CardCode[]) {
      for (const n of range(2, 11)) {
        const action = chart(['AS', second], n);
        expect(action).not.toBe('stand');
        if (action === 'double') expect(n).toBeLessThanOrEqual(6);
      }
    }
    // Tip: "Soft 18 (Ace + 7): double against a dealer 3 to 6, stand against 2, 7 or 8, and
    // hit against 9, 10 or Ace."
    expect(range(2, 11).map((n) => chart(['AS', '7H'], n))).toEqual([
      'stand',
      'double',
      'double',
      'double',
      'double',
      'stand',
      'stand',
      'hit',
      'hit',
      'hit',
    ]);
  });

  it('the tips and mistakes agree with the chart', () => {
    // "double down on 11 unless the dealer shows an Ace"
    expect(content.tips).toContain('Tip: double down on 11 unless the dealer shows an Ace.');
    // "always split Aces and 8s — and never split 10s or 5s" (checked above)
    // "if the dealer shows 7 or higher, don't stand on a hard 12 to 16"
    for (const t of range(12, 16))
      for (const n of range(7, 11)) expect(chart(hard(t), n)).toBe('hit');
    // "when the dealer shows 2 to 6, stand on a hard 13 or more"
    for (const t of range(13, 19))
      for (const n of range(2, 6)) expect(chart(hard(t), n)).toBe('stand');
    expect(content.tips.some((t) => t.includes('stand on a hard 13 or more'))).toBe(true);
    // "Ace + 6 + 9 is 16, not a bust."
    expect(handValue(['AS', '6H', '9D'])).toEqual({ total: 16, soft: false });
    // "Hitting a hard 17 or more … most cards will bust you": 5 or more busts a 17.
    const busting = range(1, 10).filter((p) => 17 + p > 21);
    expect(busting).toEqual([5, 6, 7, 8, 9, 10]);
  });

  it('glossary examples are right', () => {
    const def = (term: string) => content.glossary.find((g) => g.term === term)!.definition;
    expect(def('Blackjack')).toContain('bet 10, win 15');
    expect(def('soft hand')).toContain('Ace + 6 = soft 17');
    expect(handValue(['AS', '6H'])).toEqual({ total: 17, soft: true });
    expect(def('hard hand')).toContain('10 + 6 = hard 16');
    expect(handValue(['TS', '6H'])).toEqual({ total: 16, soft: false });
    // "push … 19 against 19": the engine returns the bet.
    expect(
      E.result(finishDealer(play(deal(['TS', '9H'], ['9D', 'TC']), 'stand'))).humanNetUnits,
    ).toBe(0);
    expect(def('shoe')).toContain(`${DEFAULT_DECKS} decks`);
  });

  it('every quiz answer is what the engine does', () => {
    // A bust loses at once and the dealer doesn't draw.
    const bust = play(deal(['TS', '6H'], ['6D', 'TC'], ['7S', 'KS']), 'hit', 'reveal');
    expect(E.isOver(bust)).toBe(true);
    expect(bust.dealer).toHaveLength(2);
    expect(E.result(bust).humanNetUnits).toBe(-1);
    expect(quizAnswer('go over 21 with 23')).toMatch(/^You lose it straight away/);
    // Ace + 7 is a soft 18.
    expect(handValue(['AS', '7H'])).toEqual({ total: 18, soft: true });
    expect(quizAnswer('an Ace and a 7')).toMatch(/^Soft 18/);
    // Ace + Queen against no dealer Blackjack: 3 to 2 on a bet of 10.
    expect(E.result(play(deal(['AS', 'QH'], ['9D', '7C']), 'reveal')).humanNetUnits * 10).toBe(15);
    expect(quizAnswer('an Ace and a Queen')).toMatch(/^15/);
    // Hard 16 against a 10: hit.
    expect(chart(['TS', '6H'], 10)).toBe('hit');
    expect(quizAnswer('hard 16 and the dealer shows a 10')).toMatch(/^Hit/);
    // Dealer soft 17: stand.
    const soft17 = play(deal(['TS', '8H'], ['AD', '6C']), 'stand', 'reveal');
    expect(E.legalMoves(soft17, DEALER)).toEqual([{ type: 'dealer-stand' }]);
    expect(quizAnswer('soft 17 (Ace + 6)')).toBe('Stand');
  });
});
