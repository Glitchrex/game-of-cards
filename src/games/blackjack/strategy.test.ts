import { describe, expect, it } from 'vitest';
import { makeDeck, RANKS, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import {
  cardPoints,
  describeTotal,
  handValue,
  isBlackjack,
  isBust,
  isPair,
  isTenValue,
  upcardNumber,
  upcardPhrase,
} from './hand';
import { basicStrategy, chartCell, strategyAdvice, type StrategyAction } from './strategy';

const ALL = { canDouble: true, canSplit: true };
const NO_DOUBLE = { canDouble: false, canSplit: true };
const NO_SPLIT = { canDouble: true, canSplit: false };
const NONE = { canDouble: false, canSplit: false };
/** One upcard per column of the chart: 2 3 4 5 6 7 8 9 10 A. */
const UPCARDS: CardCode[] = ['2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'KC', 'AC'];

/** The chart row for a hand as a string of H/S/D/P against every upcard. */
function row(cards: CardCode[], opts = ALL): string {
  const letter: Record<StrategyAction, string> = { hit: 'H', stand: 'S', double: 'D', split: 'P' };
  return UPCARDS.map((up) => letter[basicStrategy(cards, up, opts)]).join('');
}

describe('hand arithmetic', () => {
  it('values every rank: number cards face value, pictures 10, Ace 1', () => {
    const values = RANKS.map((r) => cardPoints(`${r}S`));
    expect(values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10]);
    expect(isTenValue('TD')).toBe(true);
    expect(isTenValue('QH')).toBe(true);
    expect(isTenValue('9H')).toBe(false);
  });

  it('counts one Ace as 11 when it fits (soft) and as 1 otherwise (hard)', () => {
    expect(handValue([])).toEqual({ total: 0, soft: false });
    expect(handValue(['AS', '6H'])).toEqual({ total: 17, soft: true });
    expect(handValue(['AS', '6H', '9D'])).toEqual({ total: 16, soft: false });
    expect(handValue(['AS', 'AH'])).toEqual({ total: 12, soft: true });
    expect(handValue(['AS', 'AH', '9D'])).toEqual({ total: 21, soft: true });
    expect(handValue(['AS', 'AH', 'AD', 'AC'])).toEqual({ total: 14, soft: true });
    expect(handValue(['AS', 'AH', 'TD'])).toEqual({ total: 12, soft: false });
    expect(handValue(['KS', 'QH'])).toEqual({ total: 20, soft: false });
    expect(handValue(['KS', 'QH', '2D'])).toEqual({ total: 22, soft: false });
  });

  it('recognises Blackjack only as two cards worth 21', () => {
    expect(isBlackjack(['AS', 'KH'])).toBe(true);
    expect(isBlackjack(['TD', 'AC'])).toBe(true);
    expect(isBlackjack(['AS', '5H', '5D'])).toBe(false);
    expect(isBlackjack(['KS', 'QH'])).toBe(false);
  });

  it('detects busts', () => {
    expect(isBust(['KS', 'QH', '2D'])).toBe(true);
    expect(isBust(['KS', 'QH', 'AD'])).toBe(false);
  });

  it('treats same-value cards as a pair, including any two ten-value cards', () => {
    expect(isPair(['8S', '8H'])).toBe(true);
    expect(isPair(['KS', 'QH'])).toBe(true);
    expect(isPair(['AS', 'AD'])).toBe(true);
    expect(isPair(['7S', '9H'])).toBe(false);
    expect(isPair(['8S', '8H', '8D'])).toBe(false);
    expect(isPair(['8S'])).toBe(false);
  });

  it('describes totals in beginner words', () => {
    expect(describeTotal(['AS', 'KH'])).toBe('Blackjack');
    expect(describeTotal(['AS', 'KH'], { canBeBlackjack: false })).toBe('soft 21'); // after a split
    expect(describeTotal(['AS', '6H'])).toBe('soft 17');
    expect(describeTotal(['TS', '5H'])).toBe('hard 15');
    expect(describeTotal(['3S', '5H'])).toBe('8');
    expect(describeTotal(['AS', 'AH', 'TD'])).toBe('hard 12');
    expect(describeTotal(['TS', '5H', '9D'])).toBe('24 (bust)');
  });

  it('names upcards the way a coach would', () => {
    expect(upcardPhrase('AS')).toBe('an Ace');
    expect(upcardPhrase('8S')).toBe('an 8');
    expect(upcardPhrase('6S')).toBe('a 6');
    expect(upcardPhrase('TS')).toBe('a 10');
    expect(upcardPhrase('KS')).toBe('a King (worth 10)');
    expect(upcardNumber('AS')).toBe(11);
    expect(upcardNumber('QS')).toBe(10);
  });
});

describe('basic strategy chart (6 decks, S17, DAS, no surrender)', () => {
  it('hard totals', () => {
    expect(row(['2S', '3H'])).toBe('HHHHHHHHHH'); // 5
    expect(row(['3S', '5H'])).toBe('HHHHHHHHHH'); // 8
    expect(row(['4S', '5H'])).toBe('HDDDDHHHHH'); // 9
    expect(row(['4S', '6H'])).toBe('DDDDDDDDHH'); // 10
    expect(row(['5S', '6H'])).toBe('DDDDDDDDDH'); // 11: hit vs Ace under S17
    expect(row(['TS', '2H'])).toBe('HHSSSHHHHH'); // 12
    expect(row(['TS', '3H'])).toBe('SSSSSHHHHH'); // 13
    expect(row(['TS', '4H'])).toBe('SSSSSHHHHH'); // 14
    expect(row(['TS', '5H'])).toBe('SSSSSHHHHH'); // 15
    expect(row(['TS', '6H'])).toBe('SSSSSHHHHH'); // 16: no surrender, so hit vs 9/10/A
    expect(row(['TS', '7H'])).toBe('SSSSSSSSSS'); // 17
    expect(row(['TS', '8H'])).toBe('SSSSSSSSSS'); // 18
  });

  it('soft totals', () => {
    expect(row(['AS', '2H'])).toBe('HHHDDHHHHH'); // soft 13
    expect(row(['AS', '3H'])).toBe('HHHDDHHHHH'); // soft 14
    expect(row(['AS', '4H'])).toBe('HHDDDHHHHH'); // soft 15
    expect(row(['AS', '5H'])).toBe('HHDDDHHHHH'); // soft 16
    expect(row(['AS', '6H'])).toBe('HDDDDHHHHH'); // soft 17
    expect(row(['AS', '7H'])).toBe('SDDDDSSHHH'); // soft 18
    expect(row(['AS', '8H'])).toBe('SSSSSSSSSS'); // soft 19 (S17: no double vs 6)
    expect(row(['AS', '9H'])).toBe('SSSSSSSSSS'); // soft 20
  });

  it('pairs (with doubling after split allowed)', () => {
    expect(row(['AS', 'AH'])).toBe('PPPPPPPPPP');
    expect(row(['2S', '2H'])).toBe('PPPPPPHHHH');
    expect(row(['3S', '3H'])).toBe('PPPPPPHHHH');
    expect(row(['4S', '4H'])).toBe('HHHPPHHHHH');
    expect(row(['5S', '5H'])).toBe('DDDDDDDDHH'); // never split 5s: play as 10
    expect(row(['6S', '6H'])).toBe('PPPPPHHHHH');
    expect(row(['7S', '7H'])).toBe('PPPPPPHHHH');
    expect(row(['8S', '8H'])).toBe('PPPPPPPPPP');
    expect(row(['9S', '9H'])).toBe('PPPPPSPPSS');
    expect(row(['TS', 'TH'])).toBe('SSSSSSSSSS');
    expect(row(['KS', 'QH'])).toBe('SSSSSSSSSS');
  });

  it('falls back sensibly when doubling is not allowed', () => {
    expect(row(['5S', '6H'], NO_DOUBLE)).toBe('HHHHHHHHHH'); // 11: hit instead
    expect(row(['AS', '7H'], NO_DOUBLE)).toBe('SSSSSSSHHH'); // soft 18: stand instead
    expect(chartCell(['AS', '7H'], '4C', true)).toBe('B');
    expect(chartCell(['5S', '6H'], '4C', true)).toBe('D');
  });

  it('plays a pair as a total when splitting is not allowed', () => {
    expect(row(['8S', '8H'], NO_SPLIT)).toBe('SSSSSHHHHH'); // hard 16
    expect(row(['AS', 'AH'], NO_SPLIT)).toBe('HHHHHHHHHH'); // soft 12
    expect(row(['9S', '9H'], NONE)).toBe('SSSSSSSSSS'); // hard 18
    expect(chartCell(['8S', '8H'], 'TC', false)).toBe('H');
  });
});

describe('strategy advice ("why")', () => {
  it('uses the reference sentence for standing on 12 against a dealer 6', () => {
    const advice = strategyAdvice(['TS', '2H'], '6D', ALL);
    expect(advice.action).toBe('stand');
    expect(advice.why).toBe(
      'Dealer shows a 6 — a weak card. Dealers bust a lot from 6, so stand on 12+ and let them bust.',
    );
  });

  it('explains every kind of decision in plain words', () => {
    expect(strategyAdvice(['TS', '6H'], 'TC', ALL).why).toMatch(/strong card/);
    expect(strategyAdvice(['TS', '2H'], '3C', ALL).why).toMatch(/only a 10-value card can bust/);
    expect(strategyAdvice(['TS', '3H'], '2C', ALL).why).toMatch(/stand on 13\+/);
    expect(strategyAdvice(['TS', '8H'], '9C', ALL).why).toMatch(/higher than a 3 would bust/);
    expect(strategyAdvice(['TS', 'QH'], '9C', NO_SPLIT).why).toMatch(/every card except an Ace/);
    expect(strategyAdvice(['5S', '6H'], '6C', ALL).why).toMatch(/best total to double/);
    expect(strategyAdvice(['5S', '6H'], 'AC', ALL).why).toMatch(/too strong/);
    expect(strategyAdvice(['4S', '6H'], '5C', ALL).why).toMatch(/great total to double/);
    expect(strategyAdvice(['4S', '5H'], '4C', ALL).why).toMatch(/worth doubling/);
    expect(strategyAdvice(['3S', '4H'], '4C', ALL).why).toMatch(/no card can bust you/);
    expect(strategyAdvice(['AS', '6H'], '4C', ALL).why).toMatch(/Ace can switch from 11 to 1/);
    expect(strategyAdvice(['AS', '7H'], '4C', ALL).why).toMatch(/double down/);
    expect(strategyAdvice(['AS', '7H'], 'TC', ALL).why).toMatch(/isn’t enough/);
    expect(strategyAdvice(['AS', '7H'], '7C', ALL).why).toMatch(/beats\. Stand/);
    expect(strategyAdvice(['AS', '8H'], '6C', ALL).why).toMatch(/strong hand/);
    expect(strategyAdvice(['AS', 'AH'], '6C', ALL).why).toMatch(/Always split Aces/);
    expect(strategyAdvice(['8S', '8H'], 'AC', ALL).why).toMatch(/Always split 8s/);
    expect(strategyAdvice(['9S', '9H'], '8C', ALL).why).toMatch(/only ties/);
    expect(strategyAdvice(['9S', '9H'], '5C', ALL).why).toMatch(/grow into 19/);
    expect(strategyAdvice(['6S', '6H'], '4C', ALL).why).toMatch(/split and play two hands/);
    expect(strategyAdvice(['TS', 'KH'], '6C', ALL).why).toMatch(/Keep your 20/);
    expect(strategyAdvice(['5S', '5H'], '6C', ALL).why).toMatch(/Never split 5s/);
    expect(strategyAdvice(['7S', '7H'], '9C', ALL).why).toMatch(/Don’t split your 7s/);
  });

  it('says so when the ideal play is not possible', () => {
    const noDouble = strategyAdvice(['5S', '6H'], '6C', NO_DOUBLE);
    expect(noDouble.action).toBe('hit');
    expect(noDouble.cell).toBe('D');
    expect(noDouble.why).toMatch(/can’t double right now/);
    const soft18 = strategyAdvice(['AS', '7H'], '5C', NO_DOUBLE);
    expect(soft18.action).toBe('stand');
    expect(soft18.why).toMatch(/can’t double right now/);
    const soft17 = strategyAdvice(['AS', '2H', '4D'], '4C', NONE);
    expect(soft17.action).toBe('hit');
    expect(soft17.why).toMatch(/can’t double right now/);
    const noSplit = strategyAdvice(['8S', '8H'], '6C', NONE);
    expect(noSplit.action).toBe('stand');
    expect(noSplit.why).toMatch(/can’t split right now, so play this as 16/);
  });

  it('always returns an allowed action and a non-empty reason for every starting hand', () => {
    const cards: CardCode[] = RANKS.map((r) => `${r}S` as CardCode);
    const optionSets = [ALL, NO_DOUBLE, NO_SPLIT, NONE];
    for (const a of cards) {
      for (const b of cards) {
        for (const up of UPCARDS) {
          for (const opts of optionSets) {
            const hand: CardCode[] = [a, `${b[0]}H` as CardCode];
            const advice = strategyAdvice(hand, up, opts);
            expect(advice.why.length).toBeGreaterThan(20);
            if (!opts.canDouble) expect(advice.action).not.toBe('double');
            if (!opts.canSplit) expect(advice.action).not.toBe('split');
            if (advice.action === 'split') expect(isPair(hand)).toBe(true);
            expect(advice.action).toBe(basicStrategy(hand, up, opts));
          }
        }
      }
    }
  });

  it('never calls a 2–6 "too strong", or says a 7 or higher will "struggle"', () => {
    const cards: CardCode[] = RANKS.map((r) => `${r}S` as CardCode);
    for (const a of cards) {
      for (const b of cards) {
        const hand: CardCode[] = [a, `${b[0]}H` as CardCode];
        for (const upcard of UPCARDS) {
          const n = upcardNumber(upcard);
          for (const opts of [ALL, NO_DOUBLE, NO_SPLIT, NONE]) {
            const { why } = strategyAdvice(hand, upcard, opts);
            if (n <= 6) expect(why, `${hand.join('+')} vs ${upcard}`).not.toMatch(/too strong/);
            if (n >= 7) {
              expect(why, `${hand.join('+')} vs ${upcard}`).not.toMatch(/likely to struggle/);
              expect(why).not.toMatch(/a (fairly )?weak card/);
            }
          }
        }
      }
    }
  });

  it('explains 9 against a 2 (hit, not double) without calling the 2 strong', () => {
    const advice = strategyAdvice(['4S', '5H'], '2C', ALL);
    expect(advice.action).toBe('hit');
    expect(advice.why).toBe(
      'With 9, no card can bust you, so take a card. Don’t double, though: 9 is only worth doubling against a dealer 3 to 6, and a 2 busts a little less often.',
    );
  });

  it('explains splitting 2s, 3s and 7s against a 7 as fighting a likely 17, not a weak dealer', () => {
    expect(strategyAdvice(['7S', '7H'], '7C', ALL)).toEqual({
      action: 'split',
      cell: 'P',
      why: 'Your two 7s make a weak 14, which usually loses to a dealer 7. Split them: a dealer 7 often stops on just 17, and each 7 gets a fresh start that can beat it.',
    });
    expect(strategyAdvice(['2S', '2H'], '7C', ALL).why).toMatch(/^Your two 2s make just 4\. Split/);
    expect(strategyAdvice(['3S', '3H'], '7C', ALL).why).toMatch(/^Your two 3s make just 6\. Split/);
  });

  it('says why a soft 17 or less is never a stand', () => {
    expect(strategyAdvice(['AS', '6H'], '2C', ALL).why).toBe(
      'Soft 17 can’t bust with one more card, because your Ace can switch from 11 to 1 — and standing on 17 only wins if the dealer busts. Take a card.',
    );
  });
});

describe('the dealer facts the coach quotes are true (6 decks, S17, after the peek)', () => {
  // 200,000 dealer hands drawn without replacement from a 6-deck shoe (a partial
  // Fisher–Yates shuffle per hand), skipping dealer Blackjacks (the peek ends those rounds).
  const finals = new Map<number, number[]>(); // upcard → counts of 17, 18, 19, 20, 21, bust
  const rng = createRng('dealer-facts');
  const shoe = makeDeck({ copies: 6 });
  for (let i = 0; i < 200_000; i++) {
    let left = shoe.length;
    const draw = (): CardCode => {
      const j = rng.int(left);
      left--;
      const c = shoe[j]!;
      shoe[j] = shoe[left]!;
      shoe[left] = c;
      return c;
    };
    const hand = [draw(), draw()];
    if (isBlackjack(hand)) continue;
    while (handValue(hand).total < 17) hand.push(draw());
    const counts = finals.get(upcardNumber(hand[0]!)) ?? [0, 0, 0, 0, 0, 0];
    counts[Math.min(handValue(hand).total, 22) - 17]!++;
    finals.set(upcardNumber(hand[0]!), counts);
  }
  const share = (upcard: number, total: number) => {
    const counts = finals.get(upcard)!;
    return counts[total - 17]! / counts.reduce((a, b) => a + b, 0);
  };
  const bust = (upcard: number) => share(upcard, 22);

  it('bust odds: about 1 in 3 from a 2, a bit more from a 3, about 4 in 10 from 4–6, 1 in 4 from 7–10, 1 in 6 from an Ace', () => {
    expect(bust(2)).toBeGreaterThan(0.31);
    expect(bust(2)).toBeLessThan(0.37);
    expect(bust(3)).toBeGreaterThan(bust(2));
    expect(bust(3)).toBeLessThan(0.4);
    for (const n of [4, 5, 6]) {
      expect(bust(n)).toBeGreaterThan(0.37);
      expect(bust(n)).toBeLessThan(0.45);
    }
    for (const n of [7, 8, 9, 10]) {
      expect(bust(n)).toBeGreaterThan(0.2);
      expect(bust(n)).toBeLessThan(0.3);
    }
    expect(bust(11)).toBeGreaterThan(0.14);
    expect(bust(11)).toBeLessThan(0.2);
  });

  it('a dealer 7, 8 or 9 most often stops on 17, 18 or 19; 9s and 10s often end on 19 or 20', () => {
    for (const n of [7, 8, 9]) {
      const most = [17, 18, 19, 20, 21].reduce((a, b) => (share(n, b) > share(n, a) ? b : a));
      expect(most).toBe(n + 10);
    }
    for (const n of [9, 10]) expect(share(n, 19) + share(n, 20)).toBeGreaterThan(0.4);
    // "The dealer will usually finish with 17 or more" against a 7 or higher.
    for (const n of [7, 8, 9, 10, 11]) expect(bust(n)).toBeLessThan(0.5);
  });
});
