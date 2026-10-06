/**
 * Rule-by-rule verification of the Blackjack engine against docs/RULES_DECISIONS.md, the
 * engine notes (docs/engine-notes/blackjack.md) and standard casino rules. Each `describe`
 * names one rule; each test is a focused edge case that fails if the rule is implemented
 * wrongly. The last block fuzzes the engine with random (legal) moves.
 */
import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, RANKS, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import type { GameConfig } from '@/games/core/types';
import {
  BLACKJACK_PAYS,
  blackjackEngine as E,
  canDouble,
  canSplit,
  DEALER,
  dealerChecksForBlackjack,
  DEALER_STANDS_ON,
  DEFAULT_DECKS,
  describeHand,
  describeTotal,
  isBlackjack,
  LEARNER,
  settleRound,
  type BlackjackMove,
  type BlackjackState,
} from './engine';
import { ALL_MOVE_TYPES, allCards, deal, finishDealer, mv, play, refTotal } from './test-helpers';

const net = (s: BlackjackState) => E.result(s).humanNetUnits;
const types = (s: BlackjackState, p = LEARNER) => E.legalMoves(s, p).map((m) => m.type);

describe('Rule: a 6-deck shoe, freshly shuffled every round', () => {
  it('every round deals from all 312 cards of six full decks, in a seed-dependent order', () => {
    expect(DEFAULT_DECKS).toBe(6);
    const full = makeDeck({ copies: 6 }).sort();
    const firstCards = new Set<string>();
    for (let seed = 0; seed < 50; seed++) {
      const s = E.setup({ players: 2 }, createRng(seed));
      expect(allCards(s).sort()).toEqual(full);
      firstCards.add(s.hands[0]!.cards.join());
      // Nothing carries over between rounds: a round is a pure function of its seed.
      expect(E.setup({ players: 2 }, createRng(seed))).toEqual(s);
    }
    expect(firstCards.size).toBeGreaterThan(40);
    // The shoe really is shuffled, not dealt in deck order.
    const s = E.setup({ players: 2 }, createRng(7));
    expect(allCards(s)).not.toEqual(makeDeck({ copies: 6 }));
  });
});

describe('Rule: the dealer stands on all 17s (S17) and hits 16 or less — whatever you hold', () => {
  it('a two-card hard 17 stands without drawing', () => {
    const end = finishDealer(play(deal(['TS', '8H'], ['TD', '7C'], ['2S']), 'stand'));
    expect(end.dealer).toEqual(['TD', '7C']);
    expect(net(end)).toBe(1);
  });

  it('a soft 17 made from three cards also stands (Ace + 2 + 4)', () => {
    const end = finishDealer(play(deal(['TS', '9H'], ['2C', 'AD'], ['4S', '5S']), 'stand'));
    expect(end.dealer).toEqual(['2C', 'AD', '4S']);
    expect(net(end)).toBe(1);
  });

  it('a soft 16 that turns hard keeps hitting (Ace + 5 + 9 = hard 15, then 17)', () => {
    const end = finishDealer(play(deal(['TS', '8H'], ['5C', 'AD'], ['9S', '2S', 'KS']), 'stand'));
    expect(end.dealer).toEqual(['5C', 'AD', '9S', '2S']);
    expect(refTotal(end.dealer)).toBe(17);
    expect(net(end)).toBe(1);
  });

  it('two Aces are a soft 12 for the dealer, who hits', () => {
    const s = deal(['TS', '9H'], ['AD', 'AC'], ['5S']);
    expect(s.phase).toBe('player'); // A + A is no Blackjack
    const end = finishDealer(play(s, 'stand'));
    expect(end.dealer).toEqual(['AD', 'AC', '5S']); // soft 17: stop
    expect(net(end)).toBe(1);
  });

  it('the dealer stands on 17 even when that loses to you', () => {
    const end = finishDealer(play(deal(['TS', 'KH'], ['9D', '8C'], ['2S']), 'stand'));
    expect(end.dealer).toHaveLength(2);
    expect(net(end)).toBe(1);
  });

  it('the dealer hits 16 even when it already beats your total', () => {
    const end = finishDealer(play(deal(['TS', '2H'], ['9D', '7C'], ['KS']), 'stand'));
    expect(end.dealer).toEqual(['9D', '7C', 'KS']);
    expect(net(end)).toBe(1); // the dealer busted and your 12 wins
  });

  it('DEALER_STANDS_ON is 17 and the forced move follows it for every total', () => {
    expect(DEALER_STANDS_ON).toBe(17);
    // Walk the dealer through small cards: it must hit until 17+ and then stand.
    const end = finishDealer(
      play(deal(['TS', '9H'], ['2D', '2C'], ['2S', '2H', '3C', '3D', 'AS', 'KS']), 'stand'),
    );
    // 2+2+2+2+3+3 = 14; the Ace can only count 1 (11 would make 25), so 15: hit again.
    expect(end.dealer).toEqual(['2D', '2C', '2S', '2H', '3C', '3D', 'AS', 'KS']);
    expect(refTotal(end.dealer)).toBe(25);
    expect(net(end)).toBe(1);
  });
});

describe('Rule: the dealer peeks under an Ace or a 10-value upcard (US hole-card rule)', () => {
  it('only an Ace or a 10-value upcard can ever hide a dealer Blackjack', () => {
    for (const up of RANKS) {
      for (const hole of RANKS) {
        const cards: CardCode[] = [`${up}S`, `${hole}H`];
        if (isBlackjack(cards)) expect(dealerChecksForBlackjack(cards[0]!)).toBe(true);
      }
    }
    expect(RANKS.filter((r) => dealerChecksForBlackjack(`${r}D`))).toEqual([
      'A',
      'T',
      'J',
      'Q',
      'K',
    ]);
  });

  it('finds Blackjack under every 10-value upcard and under an Ace, before the learner acts', () => {
    const dealers: [CardCode, CardCode][] = [
      ['TD', 'AC'],
      ['JD', 'AC'],
      ['QD', 'AC'],
      ['KD', 'AC'],
      ['AD', 'TC'],
      ['AD', 'JC'],
      ['AD', 'QC'],
      ['AD', 'KC'],
    ];
    for (const dealer of dealers) {
      const s = deal(['5S', '6H'], dealer); // an 11 the learner would love to double
      expect(s.phase).toBe('dealer');
      expect(types(s)).toEqual([]);
      expect(types(s, DEALER)).toEqual(['reveal']);
      const end = play(s, 'reveal');
      expect(E.isOver(end)).toBe(true);
      expect(end.dealer).toEqual(dealer);
      expect(net(end)).toBe(-1); // only the original bet: no chance to double into it
    }
  });

  it('a pair of Aces cannot be split into a dealer Blackjack', () => {
    const s = deal(['AS', 'AH'], ['TD', 'AC']);
    expect(canSplit(s)).toBe(false);
    expect(net(play(s, 'reveal'))).toBe(-1);
  });

  it('after a peek that finds nothing, a dealer 21 made by drawing takes the whole doubled bet', () => {
    const s = deal(['6S', '5H'], ['TD', '4C'], ['9S', '7S']);
    expect(s.phase).toBe('player');
    const end = finishDealer(play(s, 'double'));
    expect(end.dealer).toEqual(['TD', '4C', '7S']);
    expect(net(end)).toBe(-2); // 20 loses to 21: a drawn 21 is not a natural
  });
});

describe('Rule: Blackjack pays 3:2, a win 1:1, equal totals push', () => {
  it('a natural pays 1.5 with every 10-value card, in either order', () => {
    expect(BLACKJACK_PAYS).toBe(1.5);
    const naturals: [CardCode, CardCode][] = [
      ['AS', 'TH'],
      ['AS', 'JH'],
      ['AS', 'QH'],
      ['AS', 'KH'],
      ['KH', 'AS'],
    ];
    for (const player of naturals) {
      const s = deal(player, ['9D', '7C']);
      expect(s.phase).toBe('dealer');
      expect(net(play(s, 'reveal'))).toBe(1.5);
    }
  });

  it('a natural wins at once: the dealer never draws, even when the next card would make 21', () => {
    const end = play(deal(['AS', 'KH'], ['7C', '4D'], ['KS']), 'reveal');
    expect(end.dealer).toEqual(['7C', '4D']);
    expect(net(end)).toBe(1.5);
  });

  it('a natural against a dealer natural pushes, whichever card the dealer shows', () => {
    expect(net(play(deal(['AS', 'KH'], ['AD', 'QC']), 'reveal'))).toBe(0);
    expect(net(play(deal(['AS', 'KH'], ['QD', 'AC']), 'reveal'))).toBe(0);
  });

  it('a three-card 21 is not a Blackjack: it pays 1:1 and pushes against a dealer 21', () => {
    const win = finishDealer(play(deal(['TS', '6H'], ['9D', 'TC'], ['5C']), 'hit'));
    expect(net(win)).toBe(1); // 21 vs 19
    expect(E.result(win).flags.perfect).toBe(false);
    const push = finishDealer(play(deal(['TS', '6H'], ['9D', '7C'], ['5C', '5S']), 'hit'));
    expect(push.dealer).toEqual(['9D', '7C', '5S']);
    expect(net(push)).toBe(0);
  });

  it('Ace + 10 after splitting Aces is a plain 21: it pushes against a dealer 21', () => {
    const end = finishDealer(play(deal(['AS', 'AH'], ['9D', '7C'], ['KC', '5D', '5S']), 'split'));
    expect(end.dealer).toEqual(['9D', '7C', '5S']);
    expect(settleRound(end).hands.map((h) => [h.total, h.outcome, h.net])).toEqual([
      [21, 'push', 0],
      [16, 'loss', -1],
    ]);
    expect(net(end)).toBe(-1);
    expect(E.result(end).flags.tags).not.toContain('blackjack');
  });

  it('a bust always loses — even when the dealer busts afterwards', () => {
    const end = finishDealer(
      play(deal(['8S', '8H'], ['6D', 'TC'], ['5C', '9H', 'KS', '8D']), 'split', 'hit', 'stand'),
    );
    expect(end.dealer).toEqual(['6D', 'TC', '8D']); // 24: bust
    expect(settleRound(end).hands.map((h) => [h.bust, h.outcome, h.net])).toEqual([
      [true, 'loss', -1],
      [false, 'win', 1],
    ]);
  });
});

describe('Rule: double down on any first two cards (one card, bet ×2), also after a split', () => {
  it('is allowed on every two-card total, hard, soft or a pair', () => {
    const hands: [CardCode, CardCode][] = [
      ['2S', '3H'],
      ['TS', '2H'],
      ['TS', '9H'],
      ['AS', '2H'],
      ['AS', '9H'],
      ['5S', '5H'],
      ['TS', 'KH'],
    ];
    for (const h of hands) {
      const s = deal(h, ['9D', '7C']);
      expect(canDouble(s)).toBe(true);
      expect(types(s)).toContain('double');
    }
  });

  it('draws exactly one card even onto a tiny total, then the hand is over', () => {
    const d = play(deal(['2S', '3H'], ['9D', '8C'], ['2C', '4H']), 'double');
    expect(d.hands[0]!.cards).toEqual(['2S', '3H', '2C']);
    expect(d.phase).toBe('dealer');
    expect(net(finishDealer(d))).toBe(-2);
  });

  it('a doubled push returns both bets (net 0); a doubled bust loses both and the dealer only reveals', () => {
    expect(net(finishDealer(play(deal(['6S', '5H'], ['9D', '8C'], ['6C']), 'double')))).toBe(0);
    const bust = play(deal(['TS', '2H'], ['9D', '7C'], ['KS', '5C']), 'double');
    expect(bust.phase).toBe('dealer');
    const end = play(bust, 'reveal');
    expect(E.isOver(end)).toBe(true);
    expect(end.dealer).toHaveLength(2);
    expect(net(end)).toBe(-2);
    expect(E.result(end).flags.bust).toBe(true);
  });

  it('is never possible on split Aces (they take one card and stop)', () => {
    const sp = play(deal(['AS', 'AH'], ['9D', '7C'], ['2C', '3D']), 'split');
    expect(sp.phase).toBe('dealer');
    expect(canDouble(sp)).toBe(false);
    expect(E.checkMove(sp, LEARNER, mv('double')).ok).toBe(false);
  });

  it('after a split each double costs one more unit, up to −4 in total', () => {
    const s = deal(['8S', '8H'], ['9D', '8C'], ['3C', '2H', '9S', '6D'], { affordableUnits: 3 });
    const end = finishDealer(play(s, 'split', 'double', 'double'));
    expect(end.extraUnits).toBe(3);
    expect(end.hands.map((h) => h.bet)).toEqual([2, 2]);
    expect(settleRound(end).hands.map((h) => [h.total, h.net])).toEqual([
      [20, 2],
      [16, -2],
    ]);
    expect(net(end)).toBe(0);
  });
});

describe('Rule: split any pair once (two hands max); split Aces get one card each', () => {
  it('an Ace dealt to a split Ace is not split again: the hand stays a soft 12', () => {
    const sp = play(deal(['AS', 'AH'], ['9D', '8C'], ['AC', '5D']), 'split');
    expect(sp.hands.map((h) => h.cards)).toEqual([
      ['AS', 'AC'],
      ['AH', '5D'],
    ]);
    expect(sp.hands.every((h) => h.done)).toBe(true);
    expect(describeHand(sp.hands[0]!)).toBe('soft 12');
    const end = finishDealer(sp);
    expect(end.dealer).toEqual(['9D', '8C']);
    expect(net(end)).toBe(-2); // soft 12 and soft 16 both lose to 17
  });

  it('the first split hand is played to the end before the second one starts', () => {
    let s = play(deal(['9S', '9H'], ['6D', 'TC'], ['2C', '3D', '4S', 'KS']), 'split');
    expect(s.activeHand).toBe(0);
    expect(s.hands.map((h) => h.cards.length)).toEqual([2, 2]);
    s = play(s, 'hit'); // 9 + 2 + 4 = 15 on the first hand only
    expect(s.hands[0]!.cards).toEqual(['9S', '2C', '4S']);
    expect(s.hands[1]!.cards).toEqual(['9H', '3D']);
    expect(s.activeHand).toBe(0);
    s = play(s, 'stand');
    expect(s.activeHand).toBe(1);
  });

  it('a split hand that hits to exactly 21 stands automatically and play moves on', () => {
    const s = play(deal(['8S', '8H'], ['6D', 'TC'], ['3C', '9H', 'TD']), 'split', 'hit');
    expect(s.hands[0]!.cards).toEqual(['8S', '3C', 'TD']);
    expect(s.hands[0]!.done).toBe(true);
    expect(s.activeHand).toBe(1);
    expect(s.phase).toBe('player');
  });

  it('labels Ace + 10 after a split as 21, not Blackjack', () => {
    const sp = play(deal(['AS', 'AH'], ['9D', '7C'], ['KC', '5D']), 'split');
    expect(describeHand(sp.hands[0]!)).toBe('soft 21');
    expect(describeTotal(sp.hands[0]!.cards)).toBe('Blackjack'); // cards alone can't tell
    const natural = deal(['AS', 'KH'], ['9D', '7C']);
    expect(describeHand(natural.hands[0]!)).toBe('Blackjack');
  });
});

describe('Rule: no surrender and no insurance', () => {
  it('are never legal — not even against a dealer Ace, or with a Blackjack (even money)', () => {
    const states = [
      deal(['TS', '6H'], ['AD', '7C']),
      deal(['TS', '6H'], ['TD', '7C']),
      deal(['AS', 'KH'], ['AD', '7C']),
    ];
    for (const s of states) {
      for (const p of [LEARNER, DEALER]) {
        for (const type of ['surrender', 'insurance', 'even-money']) {
          const m = { type } as unknown as BlackjackMove;
          expect(E.checkMove(s, p, m).ok).toBe(false);
          expect(E.checkMove(s, p, m).reason).toMatch(/isn’t offered at this table/);
        }
        expect(
          E.legalMoves(s, p).every((m) => (ALL_MOVE_TYPES as readonly string[]).includes(m.type)),
        ).toBe(true);
      }
    }
  });
});

describe('Rule: a hand that reaches 21 stands automatically', () => {
  it('a soft 21 from three cards is finished', () => {
    const s = play(deal(['AS', '2H'], ['9D', '7C'], ['8C', '5S']), 'hit');
    expect(s.hands[0]!.cards).toEqual(['AS', '2H', '8C']);
    expect(s.phase).toBe('dealer');
    expect(types(s)).toEqual([]);
    expect(E.checkMove(s, LEARNER, mv('hit')).reason).toMatch(/dealer’s turn/);
  });
});

describe('Rule: doubles and splits only when the wallet covers them (affordableUnits)', () => {
  it('a wallet that covers the split but nothing more still allows hit and stand on both hands', () => {
    let s = deal(['8S', '8H'], ['6D', '7C'], ['3C', '2H'], { affordableUnits: 1 });
    expect(types(s)).toEqual(['hit', 'stand', 'double', 'split']);
    s = play(s, 'split');
    expect(types(s)).toEqual(['hit', 'stand']);
    s = play(s, 'stand');
    expect(types(s)).toEqual(['hit', 'stand']);
  });
});

describe('Rule: result flags are honest', () => {
  it('closeFinish ignores a dealer bust by one (21 against 22)', () => {
    const r = E.result(finishDealer(play(deal(['TS', '6H'], ['6D', 'TC'], ['5C', '6S']), 'hit')));
    expect(r.humanNetUnits).toBe(1);
    expect(r.flags.closeFinish).toBe(false);
    expect(r.flags.luckyLastCard).toBe(true); // hit into 21 and won
    expect(r.flags.tags).toEqual(['dealerBust']);
  });

  it('closeFinish ignores naturals (Blackjack 21 against a dealer 20)', () => {
    const r = E.result(play(deal(['AS', 'KH'], ['TD', 'QC']), 'reveal'));
    expect(r.humanNetUnits).toBe(1.5);
    expect(r.flags.closeFinish).toBe(false);
    expect(r.flags.bigPot).toBe(false); // 1.5 < 2
    expect(r.flags.perfect).toBe(true);
  });

  it('bust is only set when every hand busted, and comeback needs the round to be won', () => {
    const oneBust = E.result(
      finishDealer(
        play(deal(['8S', '8H'], ['6D', 'TC'], ['5C', '9H', 'KS', '8D']), 'split', 'hit', 'stand'),
      ),
    );
    expect(oneBust.flags.bust).toBe(false);
    expect(oneBust.humanOutcome).toBe('push');
    expect(oneBust.flags.comeback).toBe(false);
    expect(oneBust.flags.luckyLastCard).toBe(false);
  });

  it('scores are the best live total and the dealer total', () => {
    const r = E.result(
      finishDealer(
        play(deal(['8S', '8H'], ['6D', 'TC'], ['5C', '9H', 'KS', '8D']), 'split', 'hit', 'stand'),
      ),
    );
    expect(r.scores).toEqual([17, 24]);
  });
});

// ---------------------------------------------------------------------------
// Fuzz: random legal moves for the learner, varied shoes and wallets.
// ---------------------------------------------------------------------------

/** Change the hole card to one that keeps the dealer's Blackjack status (public via the peek). */
function withOtherHoleCard(s: BlackjackState): BlackjackState {
  const [up, hole] = s.dealer as [CardCode, CardCode];
  const candidates: CardCode[] = ['2C', '3C', '4D', '5H', '6S', '7D', '8C', '9H', 'TD', 'AS'];
  const alt = candidates.find(
    (c) => c[0] !== hole[0] && isBlackjack([up, c]) === isBlackjack([up, hole]),
  );
  return alt ? { ...s, dealer: [up, alt, ...s.dealer.slice(2)] } : s;
}

function fuzzConfig(seed: number): GameConfig {
  const decks = [6, 1, 2, 4, 8][seed % 5];
  const affordableUnits = [undefined, 0, 1, 2, 3, 7][seed % 6];
  return { players: 2, affordableUnits, options: { decks } };
}

describe('fuzz: 3,000 rounds of random legal moves', () => {
  it('never crashes, sticks, mutates, loses or duplicates a card, or leaks the hole card', () => {
    const tally = { rounds: 0, moves: 0, maxMoves: 0, win: 0, loss: 0, push: 0, net: 0 };
    for (let seed = 0; seed < 3000; seed++) {
      const config = fuzzConfig(seed);
      const pick = createRng(`fuzz-moves-${seed}`);
      let s = E.setup(config, createRng(`fuzz-${seed}`));
      const expected = allCards(s).sort().join();
      let steps = 0;
      while (!E.isOver(s)) {
        const p = E.currentPlayer(s);
        expect(p).not.toBeNull();
        const player = p!;
        const legal = E.legalMoves(s, player);
        expect(legal.length).toBeGreaterThan(0);
        // legalMoves and checkMove agree for both seats, and every refusal has a reason.
        for (const seat of [LEARNER, DEALER]) {
          const allowed = ALL_MOVE_TYPES.filter((t) => E.checkMove(s, seat, mv(t)).ok);
          expect(allowed.sort()).toEqual(
            E.legalMoves(s, seat)
              .map((m) => m.type)
              .sort(),
          );
          for (const t of ALL_MOVE_TYPES) {
            const c = E.checkMove(s, seat, mv(t));
            if (!c.ok) expect(c.reason?.length ?? 0).toBeGreaterThan(10);
          }
        }
        if (player === LEARNER) {
          // The learner's coach, bot and move log never depend on the hole card or the
          // order of the undrawn shoe (beyond the very card the move draws).
          const twin = withOtherHoleCard(s);
          const reversed: BlackjackState = { ...s, shoe: [...s.shoe].reverse() };
          expect(E.coach(twin, LEARNER)).toEqual(E.coach(s, LEARNER));
          expect(E.coach(reversed, LEARNER)).toEqual(E.coach(s, LEARNER));
          for (const d of ['easy', 'normal'] as const) {
            const m = E.botMove(s, LEARNER, d, createRng(1));
            expect(E.botMove(twin, LEARNER, d, createRng(1))).toEqual(m);
            expect(E.botMove(reversed, LEARNER, d, createRng(1))).toEqual(m);
            expect(E.checkMove(s, LEARNER, m).ok).toBe(true);
          }
          for (const t of ALL_MOVE_TYPES) {
            expect(E.describeMove(twin, LEARNER, mv(t))).toBe(E.describeMove(s, LEARNER, mv(t)));
          }
          // Coach suggestions are legal at every point of the round, and match the normal bot.
          const advice = E.coach(s, LEARNER);
          expect(E.checkMove(s, LEARNER, advice.suggestion as BlackjackMove).ok).toBe(true);
          expect(advice.suggestion).toEqual(E.botMove(s, LEARNER, 'normal', createRng(1)));
        } else if (!s.holeRevealed) {
          const twin = withOtherHoleCard(s);
          expect(E.coach(twin, LEARNER)).toEqual(E.coach(s, LEARNER));
          expect(E.coach(s, LEARNER).situation).not.toContain(cardName(s.dealer[1]!));
        }
        const move = legal[pick.int(legal.length)]!;
        const text = E.describeMove(s, player, move);
        expect(text).not.toMatch(/undefined|NaN|null|\[object/);
        const before = JSON.stringify(s);
        deepFreeze(s);
        const next = E.applyMove(s, move);
        expect(JSON.stringify(s)).toBe(before);
        expect(JSON.parse(JSON.stringify(next))).toEqual(next);
        s = next;
        steps++;
        expect(allCards(s).sort().join()).toBe(expected);
        expect(s.extraUnits).toBe(s.hands.reduce((n, h) => n + h.bet, 0) - 1);
        if (s.affordableUnits !== null) expect(s.extraUnits).toBeLessThanOrEqual(s.affordableUnits);
        expect(steps).toBeLessThan(40);
      }
      expect(E.currentPlayer(s)).toBeNull();
      expect(E.legalMoves(s, LEARNER)).toEqual([]);
      expect(E.legalMoves(s, DEALER)).toEqual([]);
      const r = E.result(s);
      const worst = -(1 + (s.affordableUnits ?? 3));
      expect(r.humanNetUnits).toBeGreaterThanOrEqual(Math.max(worst, -4));
      expect(r.humanNetUnits).toBeLessThanOrEqual(4);
      expect(r.summary).not.toMatch(/undefined|NaN/);
      expect(E.coach(s, LEARNER).situation).toBe(r.summary);
      tally.rounds++;
      tally.moves += steps;
      tally.maxMoves = Math.max(tally.maxMoves, steps);
      tally[r.humanOutcome]++;
      tally.net += r.humanNetUnits;
    }
    console.info(
      `[blackjack fuzz] ${tally.rounds} rounds, avg ${(tally.moves / tally.rounds).toFixed(2)} ` +
        `moves (max ${tally.maxMoves}), win/loss/push ${tally.win}/${tally.loss}/${tally.push}, ` +
        `net/round ${(tally.net / tally.rounds).toFixed(4)}`,
    );
    expect(tally.rounds).toBe(3000);
  }, 120_000);
});
