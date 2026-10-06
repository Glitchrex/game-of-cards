import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError } from '@/games/core/types';
import blackjackDefault, {
  activeHand,
  basicStrategy,
  blackjackEngine as E,
  canDouble,
  canSplit,
  DEALER,
  dealerChecksForBlackjack,
  dealerHasBlackjack,
  LEARNER,
  LEARNER_MOVE_TYPES,
  playerHasBlackjack,
  settleRound,
  setupWithShoe,
  totalBetUnits,
  visibleDealerCards,
  type BlackjackMove,
  type BlackjackState,
} from './engine';
import { allCards, deal, finishDealer, mv, play, stackedShoe, type MoveType } from './test-helpers';

const types = (moves: BlackjackMove[]) => moves.map((m) => m.type);
const reason = (state: BlackjackState, player: number, type: MoveType) =>
  E.checkMove(state, player, mv(type)).reason;

// ---------------------------------------------------------------------------

describe('engine shape', () => {
  it('has the slug id and a default export', () => {
    expect(E.id).toBe('blackjack');
    expect(blackjackDefault).toBe(E);
  });

  it('gives every move a distinct, stable key', () => {
    const all: MoveType[] = [
      'hit',
      'stand',
      'double',
      'split',
      'reveal',
      'dealer-hit',
      'dealer-stand',
    ];
    const keys = all.map((t) => E.moveKey(mv(t)));
    expect(new Set(keys).size).toBe(all.length);
    expect(E.moveKey({ type: 'hit' })).toBe(E.moveKey({ type: 'hit' }));
    expect(LEARNER_MOVE_TYPES).toEqual(['hit', 'stand', 'double', 'split']);
  });
});

describe('setup and the deal', () => {
  it('shuffles a fresh 6-deck shoe and deals learner, upcard, learner, hole card', () => {
    const s = E.setup({ players: 2 }, createRng(1));
    expect(s.decks).toBe(6);
    expect(s.shoe).toHaveLength(312 - 4);
    expect(s.hands).toHaveLength(1);
    expect(s.hands[0]!.cards).toHaveLength(2);
    expect(s.dealer).toHaveLength(2);
    expect(s.holeRevealed).toBe(false);
    expect(s.extraUnits).toBe(0);
    expect(s.affordableUnits).toBeNull();
    expect(allCards(s).sort()).toEqual(makeDeck({ copies: 6 }).sort());
    // Deal order from a stacked shoe.
    const t = setupWithShoe({ players: 2 }, stackedShoe(['2S', '3S', '4S', '5S', '6S']));
    expect(t.hands[0]!.cards).toEqual(['2S', '4S']);
    expect(t.dealer).toEqual(['3S', '5S']);
    expect(t.shoe[0]).toBe('6S');
  });

  it('is deterministic: the same seed gives the same shoe, different seeds differ', () => {
    const a = E.setup({ players: 2 }, createRng('same'));
    const b = E.setup({ players: 2 }, createRng('same'));
    const c = E.setup({ players: 2 }, createRng('other'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a.shoe)).not.toBe(JSON.stringify(c.shoe));
  });

  it('replays a whole game identically from the same seeds', () => {
    const run = () => {
      let s = E.setup({ players: 2 }, createRng('replay'));
      const bot = createRng('replay-bot');
      const log: string[] = [];
      while (!E.isOver(s)) {
        const p = E.currentPlayer(s)!;
        const m = E.botMove(s, p, 'normal', bot);
        log.push(E.describeMove(s, p, m));
        s = E.applyMove(s, m);
      }
      return { log, state: JSON.stringify(s), result: JSON.stringify(E.result(s)) };
    };
    expect(run()).toEqual(run());
  });

  it('supports 1–8 decks through options.decks', () => {
    const s = E.setup({ players: 2, options: { decks: 1 } }, createRng(3));
    expect(s.decks).toBe(1);
    expect(allCards(s)).toHaveLength(52);
    expect(E.setup({ players: 2, options: { decks: 8 } }, createRng(3)).shoe).toHaveLength(412);
  });

  it('rejects impossible configurations with a clear error', () => {
    expect(() => E.setup({ players: 1 }, createRng(1))).toThrow(/exactly 2 seats/);
    expect(() => E.setup({ players: 3 }, createRng(1))).toThrow(RangeError);
    for (const decks of [0, 9, 2.5, '6']) {
      expect(() => E.setup({ players: 2, options: { decks } }, createRng(1))).toThrow(/decks/);
    }
    expect(() => E.setup({ players: 2, affordableUnits: Number.NaN }, createRng(1))).toThrow(
      /affordableUnits/,
    );
  });

  it('normalises affordableUnits to a whole number of extra bets (null = unlimited)', () => {
    const units = (affordableUnits?: number) =>
      E.setup({ players: 2, affordableUnits }, createRng(1)).affordableUnits;
    expect(units(undefined)).toBeNull();
    expect(units(Number.POSITIVE_INFINITY)).toBeNull();
    expect(units(2.9)).toBe(2);
    expect(units(-3)).toBe(0);
  });

  it('only accepts a shoe made of complete decks', () => {
    const shoe = stackedShoe([]);
    expect(() => setupWithShoe({ players: 2 }, shoe.slice(1))).toThrow(/complete/);
    const tampered = ['AS', ...shoe.slice(1)] as CardCode[];
    tampered[1] = 'AS';
    expect(() => setupWithShoe({ players: 2 }, tampered)).toThrow(/complete/);
    expect(() => setupWithShoe({ players: 2, options: { decks: 1 } }, shoe)).toThrow(/complete/);
  });
});

describe('naturals and the peek', () => {
  it('a learner Blackjack against no dealer Blackjack ends at once and pays 3:2', () => {
    const s = deal(['AS', 'KH'], ['7C', '9D']);
    expect(playerHasBlackjack(s)).toBe(true);
    expect(s.phase).toBe('dealer');
    expect(E.legalMoves(s, LEARNER)).toEqual([]);
    expect(E.legalMoves(s, DEALER)).toEqual([{ type: 'reveal' }]);
    const end = play(s, 'reveal');
    expect(E.isOver(end)).toBe(true);
    expect(end.dealer).toEqual(['7C', '9D']); // the dealer never draws against a Blackjack
    const r = E.result(end);
    expect(r.humanNetUnits).toBe(1.5);
    expect(r.humanOutcome).toBe('win');
    expect(r.winners).toEqual([LEARNER]);
    expect(r.flags.perfect).toBe(true);
    expect(r.flags.tags).toEqual(['blackjack']);
    expect(r.summary).toMatch(/Blackjack! .*3 to 2/);
  });

  it('a learner Blackjack beats a dealer Ace that is not Blackjack, without the dealer drawing', () => {
    const s = deal(['AS', 'KH'], ['AD', '5D']);
    expect(dealerChecksForBlackjack('AD')).toBe(true);
    const end = play(s, 'reveal');
    expect(end.dealer).toHaveLength(2);
    expect(E.result(end).humanNetUnits).toBe(1.5);
  });

  it('Blackjack against dealer Blackjack is a push', () => {
    const end = play(deal(['AS', 'KH'], ['AD', 'QC']), 'reveal');
    const r = E.result(end);
    expect(r.humanNetUnits).toBe(0);
    expect(r.humanOutcome).toBe('push');
    expect(r.winners).toEqual([]);
    expect(r.flags.tags).toEqual(expect.arrayContaining(['blackjack', 'dealerBlackjack']));
    expect(r.summary).toMatch(/both have Blackjack/);
  });

  it('dealer Blackjack under an Ace is found by the peek: the round ends and only the bet is lost', () => {
    const s = deal(['TS', 'QH'], ['AD', 'KC']);
    expect(dealerHasBlackjack(s)).toBe(true);
    expect(s.phase).toBe('dealer');
    expect(E.legalMoves(s, LEARNER)).toEqual([]);
    expect(reason(s, LEARNER, 'hit')).toMatch(/dealer’s turn/);
    const r = E.result(play(s, 'reveal'));
    expect(r.humanNetUnits).toBe(-1);
    expect(r.humanOutcome).toBe('loss');
    expect(r.winners).toEqual([DEALER]);
    expect(r.flags.tags).toEqual(['dealerBlackjack']);
    expect(r.flags.bust).toBe(false);
    expect(r.summary).toMatch(/dealer has Blackjack/);
  });

  it('dealer Blackjack under a ten-value upcard is found by the peek too', () => {
    const s = deal(['9S', '9H'], ['KD', 'AC']);
    expect(s.phase).toBe('dealer'); // no chance to split the 9s
    expect(E.result(play(s, 'reveal')).humanNetUnits).toBe(-1);
  });

  it('there is no peek with a 2–9 upcard (and no dealer Blackjack is possible)', () => {
    const s = deal(['TS', '7H'], ['9D', 'AC']);
    expect(dealerChecksForBlackjack('9D')).toBe(false);
    expect(s.phase).toBe('player');
    expect(E.coach(s, LEARNER).situation).not.toMatch(/checked/);
    const end = finishDealer(play(s, 'stand'));
    expect(end.dealer).toEqual(['9D', 'AC']); // soft 20 stands
    expect(E.result(end).humanNetUnits).toBe(-1);
  });

  it('play goes on after a peek that finds nothing, and the coach says so', () => {
    const s = deal(['TS', '6H'], ['AD', '7C']);
    expect(s.phase).toBe('player');
    expect(E.coach(s, LEARNER).situation).toMatch(/already checked: no Blackjack/);
  });
});

describe('hitting and standing', () => {
  it('hit draws the next card; a bust ends the hand and the dealer only reveals', () => {
    const s = deal(['TS', '6H'], ['9D', '7C'], ['KS']);
    const busted = play(s, 'hit');
    expect(busted.hands[0]!.cards).toEqual(['TS', '6H', 'KS']);
    expect(busted.hands[0]!.done).toBe(true);
    expect(busted.phase).toBe('dealer');
    expect(E.legalMoves(busted, DEALER)).toEqual([{ type: 'reveal' }]);
    const end = play(busted, 'reveal');
    expect(E.isOver(end)).toBe(true);
    expect(end.dealer).toHaveLength(2); // 16, but no need to draw
    const r = E.result(end);
    expect(r.humanNetUnits).toBe(-1);
    expect(r.flags.bust).toBe(true);
    expect(r.summary).toBe('You went over 21 with 26, so you bust and lose your bet.');
  });

  it('a hand that reaches 21 stands automatically', () => {
    const s = play(deal(['TS', '6H'], ['9D', '7C'], ['5S', '2C']), 'hit');
    expect(s.hands[0]!.done).toBe(true);
    expect(s.phase).toBe('dealer');
    const end = finishDealer(s);
    expect(end.dealer).toEqual(['9D', '7C', '2C']);
    const r = E.result(end);
    expect(r.humanNetUnits).toBe(1);
    expect(r.flags.luckyLastCard).toBe(true); // hit into exactly 21 and won
    expect(r.flags.comeback).toBe(true); // drew to a hard 16 and won
    expect(r.flags.closeFinish).toBe(false);
  });

  it('keeps hitting below 21 and hands over to the dealer on stand', () => {
    let s = play(deal(['2S', '3H'], ['9D', '7C'], ['4S', '5C']), 'hit', 'hit');
    expect(s.hands[0]!.cards).toEqual(['2S', '3H', '4S', '5C']);
    expect(s.phase).toBe('player');
    s = play(s, 'stand');
    expect(s.phase).toBe('dealer');
    expect(E.currentPlayer(s)).toBe(DEALER);
  });

  it('settles higher total wins, lower loses, equal pushes', () => {
    const win = E.result(finishDealer(play(deal(['TS', '8H'], ['9D', '8C']), 'stand')));
    expect(win.humanNetUnits).toBe(1);
    expect(win.summary).toBe('Your 18 beats the dealer’s 17 — you win!');
    expect(win.flags.closeFinish).toBe(true);
    expect(win.scores).toEqual([18, 17]);

    const loss = E.result(finishDealer(play(deal(['TS', '7H'], ['9D', '9C']), 'stand')));
    expect(loss.humanNetUnits).toBe(-1);
    expect(loss.summary).toBe('The dealer’s 18 beats your 17, so you lose your bet.');
    expect(loss.flags.closeFinish).toBe(true); // lost by one point

    const push = E.result(finishDealer(play(deal(['TS', '8H'], ['9D', '9C']), 'stand')));
    expect(push.humanNetUnits).toBe(0);
    expect(push.humanOutcome).toBe('push');
    expect(push.winners).toEqual([]);
    expect(push.summary).toBe(
      'You and the dealer both have 18 — it’s a push, so your bet comes back.',
    );
    expect(push.flags.closeFinish).toBe(false);

    const big = E.result(finishDealer(play(deal(['TS', 'KH'], ['9D', '8C']), 'stand')));
    expect(big.flags.closeFinish).toBe(false); // 20 vs 17
  });
});

describe('the dealer', () => {
  it('turns over the hole card first, hits 16 or less, then stands on 17+', () => {
    let s = play(deal(['TS', '8H'], ['9D', '7C'], ['5S']), 'stand');
    expect(E.legalMoves(s, DEALER)).toEqual([{ type: 'reveal' }]);
    expect(E.legalMoves(s, LEARNER)).toEqual([]);
    expect(visibleDealerCards(s)).toEqual(['9D', null]);
    expect(reason(s, DEALER, 'dealer-hit')).toBe(
      'The dealer must turn over the face-down hole card first.',
    );
    expect(reason(s, DEALER, 'dealer-stand')).toBe(
      'The dealer must turn over the face-down hole card first.',
    );
    s = play(s, 'reveal');
    expect(visibleDealerCards(s)).toEqual(['9D', '7C']);
    expect(reason(s, DEALER, 'reveal')).toBe('The hole card is already face up.');
    expect(E.legalMoves(s, DEALER)).toEqual([{ type: 'dealer-hit' }]);
    expect(reason(s, DEALER, 'dealer-stand')).toBe(
      'The dealer has 16 and must take another card — dealers always hit on 16 or less.',
    );
    s = play(s, 'dealer-hit');
    expect(s.dealer).toEqual(['9D', '7C', '5S']);
    expect(E.legalMoves(s, DEALER)).toEqual([{ type: 'dealer-stand' }]);
    expect(reason(s, DEALER, 'dealer-hit')).toMatch(/has hard 21 and must stand/);
    s = play(s, 'dealer-stand');
    expect(E.isOver(s)).toBe(true);
    expect(E.currentPlayer(s)).toBeNull();
    expect(E.result(s).humanNetUnits).toBe(-1);
  });

  it('stands on soft 17 (S17)', () => {
    const s = play(deal(['TS', '8H'], ['AD', '6C']), 'stand', 'reveal');
    expect(E.legalMoves(s, DEALER)).toEqual([{ type: 'dealer-stand' }]);
    expect(reason(s, DEALER, 'dealer-hit')).toBe(
      'The dealer has soft 17 and must stand — dealers stand on 17 or more, even a soft 17.',
    );
    expect(E.result(play(s, 'dealer-stand')).humanNetUnits).toBe(1);
  });

  it('counts the Ace correctly over several cards (soft 16 hits, then soft 17 stands)', () => {
    const end = finishDealer(play(deal(['TS', '8H'], ['5C', 'AD'], ['AH']), 'stand'));
    expect(end.dealer).toEqual(['5C', 'AD', 'AH']);
    expect(E.result(end).humanNetUnits).toBe(1);
  });

  it('a dealer bust ends the round at once and pays every standing hand', () => {
    const s = play(deal(['TS', '4H'], ['6D', 'TC'], ['KS']), 'stand', 'reveal', 'dealer-hit');
    expect(E.isOver(s)).toBe(true);
    const r = E.result(s);
    expect(r.humanNetUnits).toBe(1);
    expect(r.flags.tags).toEqual(['dealerBust']);
    expect(r.flags.luckyLastCard).toBe(true); // stood on 14, dealer busted
    expect(r.flags.closeFinish).toBe(false);
    expect(r.summary).toBe('The dealer busted with 26, so your 14 wins!');
  });
});

describe('doubling down', () => {
  it('doubles the bet, draws exactly one card and finishes the hand', () => {
    const s = deal(['6S', '5H'], ['6D', 'TC'], ['9S', '8C']);
    expect(types(E.legalMoves(s, LEARNER))).toEqual(['hit', 'stand', 'double']);
    const d = play(s, 'double');
    expect(d.hands[0]).toMatchObject({
      cards: ['6S', '5H', '9S'],
      bet: 2,
      doubled: true,
      done: true,
    });
    expect(d.extraUnits).toBe(1);
    expect(totalBetUnits(d)).toBe(2);
    expect(d.phase).toBe('dealer');
    const r = E.result(finishDealer(d));
    expect(r.humanNetUnits).toBe(2);
    expect(r.flags.bigPot).toBe(true);
    expect(r.flags.tags).toEqual(['dealerBust', 'doubled']);
    expect(r.summary).toBe(
      'The dealer busted with 24, so your 20 wins — twice your bet, because you doubled down!',
    );
  });

  it('a lost double costs two bets', () => {
    const r = E.result(finishDealer(play(deal(['6S', '5H'], ['TD', '9C'], ['2S']), 'double')));
    expect(r.humanNetUnits).toBe(-2);
    expect(r.flags.bigPot).toBe(true);
    expect(r.summary).toBe('The dealer’s 19 beats your 13, so you lose your doubled bet.');
  });

  it('doubling into 21 and winning is a lucky last card (but not a comeback from 11)', () => {
    const r = E.result(finishDealer(play(deal(['6S', '5H'], ['9D', '8C'], ['KS']), 'double')));
    expect(r.humanNetUnits).toBe(2);
    expect(r.flags.luckyLastCard).toBe(true);
    expect(r.flags.comeback).toBe(false);
  });

  it('is only allowed on the first two cards', () => {
    const s = play(deal(['2S', '3H'], ['TD', '9C'], ['4S']), 'hit');
    expect(canDouble(s)).toBe(false);
    expect(types(E.legalMoves(s, LEARNER))).toEqual(['hit', 'stand']);
    expect(reason(s, LEARNER, 'double')).toBe(
      'You can only double down on your first two cards — you’ve already taken a card on this hand. You can still hit or stand.',
    );
    expect(() => E.applyMove(s, mv('double'))).toThrow(IllegalMoveError);
  });

  it('works on soft hands too', () => {
    expect(canDouble(deal(['AS', '7H'], ['5D', 'TC']))).toBe(true);
  });
});

describe('splitting', () => {
  it('splits a pair into two one-bet hands, each dealt a second card; doubling after a split is allowed', () => {
    const s = deal(['8S', '8H'], ['TD', '7C'], ['3C', 'KH', '9D']);
    expect(types(E.legalMoves(s, LEARNER))).toEqual(['hit', 'stand', 'double', 'split']);
    const sp = play(s, 'split');
    expect(sp.hands.map((h) => h.cards)).toEqual([
      ['8S', '3C'],
      ['8H', 'KH'],
    ]);
    expect(sp.hands.every((h) => h.fromSplit && h.bet === 1)).toBe(true);
    expect(sp.activeHand).toBe(0);
    expect(sp.extraUnits).toBe(1);
    expect(canDouble(sp)).toBe(true); // DAS
    const doubled = play(sp, 'double');
    expect(doubled.hands[0]).toMatchObject({ cards: ['8S', '3C', '9D'], bet: 2, done: true });
    expect(doubled.activeHand).toBe(1);
    expect(doubled.phase).toBe('player');
    const end = finishDealer(play(doubled, 'stand'));
    const r = E.result(end);
    expect(r.humanNetUnits).toBe(3);
    expect(r.flags.bigPot).toBe(true);
    expect(r.flags.tags).toEqual(['split', 'doubled']);
    expect(r.summary).toBe(
      'You played two hands: the first won with 20 (doubled) and the second won with 18 against the dealer’s 17, so you come out three bets ahead.',
    );
    expect(settleRound(end).hands.map((h) => h.net)).toEqual([2, 1]);
  });

  it('split Aces get one card each, and Ace + 10 after a split is 21, not Blackjack', () => {
    const sp = play(deal(['AS', 'AH'], ['9D', '8C'], ['KC', '5D']), 'split');
    expect(sp.hands.map((h) => h.cards)).toEqual([
      ['AS', 'KC'],
      ['AH', '5D'],
    ]);
    expect(sp.hands.every((h) => h.done)).toBe(true);
    expect(sp.phase).toBe('dealer'); // no decisions on split Aces
    expect(E.legalMoves(sp, LEARNER)).toEqual([]);
    const end = finishDealer(sp);
    expect(playerHasBlackjack(end)).toBe(false);
    const s = settleRound(end);
    expect(s.hands.map((h) => [h.outcome, h.net])).toEqual([
      ['win', 1],
      ['loss', -1],
    ]);
    const r = E.result(end);
    expect(r.humanNetUnits).toBe(0);
    expect(r.humanOutcome).toBe('push');
    expect(r.flags.perfect).toBe(false);
    expect(r.flags.tags).not.toContain('blackjack');
  });

  it('allows splitting any two ten-value cards (same value), though the coach says keep 20', () => {
    const s = deal(['KS', 'QH'], ['6D', '7C']);
    expect(canSplit(s)).toBe(true);
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'stand' });
  });

  it('a split hand that lands on 21 with its second card stands automatically', () => {
    const sp = play(deal(['TS', 'TH'], ['6D', 'TC'], ['AC', '5D', '9S']), 'split');
    expect(sp.hands[0]!.done).toBe(true);
    expect(sp.activeHand).toBe(1);
    const end = finishDealer(play(sp, 'stand'));
    const r = E.result(end);
    expect(settleRound(end).hands.map((h) => h.outcome)).toEqual(['win', 'win']);
    expect(r.humanNetUnits).toBe(2); // the 21 pays 1:1, not 3:2
    expect(r.flags.luckyLastCard).toBe(true); // second hand stood on 15 and the dealer busted
  });

  it('only once per round', () => {
    const sp = play(deal(['8S', '8H'], ['TD', '7C'], ['8C', 'KH']), 'split');
    expect(sp.hands[0]!.cards).toEqual(['8S', '8C']);
    expect(canSplit(sp)).toBe(false);
    expect(types(E.legalMoves(sp, LEARNER))).toEqual(['hit', 'stand', 'double']);
    expect(reason(sp, LEARNER, 'split')).toBe(
      'You can split only once per round — you’re already playing two hands.',
    );
    // The bot plays the second pair of 8s as a hard 16 against a 10: hit.
    expect(E.botMove(sp, LEARNER, 'normal', createRng(1))).toEqual({ type: 'hit' });
  });

  it('only a pair, and only on the first two cards', () => {
    const s = deal(['7S', '9H'], ['TD', '7C']);
    expect(canSplit(s)).toBe(false);
    expect(reason(s, LEARNER, 'split')).toBe(
      'You can only split a pair — two cards of the same value, like two 8s (any two 10-value cards, like a King and a Queen, count too). Your 7 and 9 aren’t a pair.',
    );
    const hit = play(deal(['2S', '2H'], ['TD', '7C'], ['3C']), 'hit');
    expect(reason(hit, LEARNER, 'split')).toBe(
      'You can only split your first two cards, before you take any more.',
    );
  });

  it('when both split hands bust the dealer only reveals', () => {
    const s = play(
      deal(['8S', '8H'], ['TD', '7C'], ['5C', '6H', 'KS', 'KD']),
      'split',
      'hit',
      'hit',
    );
    expect(s.phase).toBe('dealer');
    const end = play(s, 'reveal');
    expect(E.isOver(end)).toBe(true);
    expect(end.dealer).toHaveLength(2);
    const r = E.result(end);
    expect(r.humanNetUnits).toBe(-2);
    expect(r.flags.bust).toBe(true);
    expect(r.flags.bigPot).toBe(true);
    expect(r.summary).toBe(
      'You played two hands: the first busted with 23 and the second busted with 24, so you lose two bets.',
    );
  });

  it('when one split hand is alive the dealer plays it out', () => {
    const s = play(
      deal(['8S', '8H'], ['TD', '6C'], ['5C', 'TH', 'KS', '9D']),
      'split',
      'hit',
      'stand',
    );
    const end = finishDealer(s);
    expect(end.dealer).toEqual(['TD', '6C', '9D']);
    const r = E.result(end);
    expect(r.humanNetUnits).toBe(0);
    expect(r.flags.bust).toBe(false);
    expect(r.flags.luckyLastCard).toBe(false); // the live hand stood on 18, not ≤ 16
    expect(r.summary).toBe(
      'You played two hands: the first busted with 23 and the second won with 18 — the dealer busted with 25, so you break even.',
    );
  });
});

describe('affordability (config.affordableUnits)', () => {
  it('with no spare Jeet, doubling and splitting are refused with a wallet reason', () => {
    const s = deal(['8S', '8H'], ['6D', '7C'], [], { affordableUnits: 0 });
    expect(types(E.legalMoves(s, LEARNER))).toEqual(['hit', 'stand']);
    expect(reason(s, LEARNER, 'split')).toBe(
      'Splitting means adding a second bet the same size as your first, and your wallet can’t cover that right now. You can still hit or stand.',
    );
    expect(reason(s, LEARNER, 'double')).toMatch(/^Doubling down means adding a second bet/);
    const advice = E.coach(s, LEARNER);
    expect(advice.suggestion).toEqual({ type: 'stand' }); // 16 vs 6 when 8s can't be split
    expect(advice.why).toMatch(/can’t split right now/);
  });

  it('one spare unit covers a split but not a double afterwards', () => {
    const sp = play(
      deal(['8S', '8H'], ['6D', '7C'], ['3C', '2H'], { affordableUnits: 1 }),
      'split',
    );
    expect(canDouble(sp)).toBe(false);
    expect(reason(sp, LEARNER, 'double')).toMatch(/wallet can’t cover/);
    expect(E.coach(sp, LEARNER).suggestion).toEqual({ type: 'hit' }); // 11 vs 6, can't double
    expect(E.botMove(sp, LEARNER, 'normal', createRng(1))).toEqual({ type: 'hit' });
  });

  it('two spare units cover a split and one double', () => {
    const sp = play(
      deal(['8S', '8H'], ['6D', '7C'], ['3C', '2H', '9S'], { affordableUnits: 2 }),
      'split',
      'double',
    );
    expect(sp.extraUnits).toBe(2);
    expect(sp.activeHand).toBe(1);
    expect(canDouble(sp)).toBe(false);
  });

  it('unlimited: split and double both hands — the worst case is −4 units', () => {
    const end = finishDealer(
      play(deal(['8S', '8H'], ['TD', '9C'], ['3C', '2H', '5S', '4D']), 'split', 'double', 'double'),
    );
    expect(end.extraUnits).toBe(3);
    expect(totalBetUnits(end)).toBe(4);
    const r = E.result(end);
    expect(r.humanNetUnits).toBe(-4);
    expect(r.humanNetUnits).toBeGreaterThanOrEqual(-(1 + end.extraUnits));
  });
});

describe('checkMove reasons for every other illegal move', () => {
  const s = deal(['TS', '6H'], ['9D', '7C']);

  it('unknown or malformed moves', () => {
    const msg = 'That isn’t a Blackjack move. You can hit, stand, double down or split.';
    expect(E.checkMove(s, LEARNER, { type: 'fold' } as unknown as BlackjackMove).reason).toBe(msg);
    expect(E.checkMove(s, LEARNER, { type: 'toString' } as unknown as BlackjackMove).reason).toBe(
      msg,
    );
    expect(E.checkMove(s, LEARNER, null as unknown as BlackjackMove).reason).toBe(msg);
    expect(E.checkMove(s, LEARNER, {} as unknown as BlackjackMove).reason).toBe(msg);
  });

  it('casino options we leave out get a specific explanation', () => {
    const check = (type: string) => E.checkMove(s, LEARNER, { type } as unknown as BlackjackMove);
    expect(check('surrender')).toEqual({
      ok: false,
      reason:
        'Surrender isn’t offered at this table — you play every hand out. (Some casinos let you give up half your bet; see Variants.)',
    });
    expect(check('insurance').reason).toMatch(/^Insurance isn’t offered at this table/);
    expect(check('even-money').reason).toMatch(/^Even money isn’t offered at this table/);
    expect(() => E.applyMove(s, { type: 'surrender' } as unknown as BlackjackMove)).toThrow(
      IllegalMoveError,
    );
  });

  it('a seat that does not exist', () => {
    expect(reason(s, 5, 'hit')).toBe(
      'There’s no Player 5 at this table — it’s just you and the dealer.',
    );
    expect(E.legalMoves(s, 5)).toEqual([]);
  });

  it('after the round is over', () => {
    const end = finishDealer(play(s, 'stand'));
    expect(reason(end, LEARNER, 'hit')).toBe('This round is over. Deal a new hand to play again.');
    expect(() => E.applyMove(end, mv('hit'))).toThrow(IllegalMoveError);
    expect(E.legalMoves(end, LEARNER)).toEqual([]);
    expect(E.legalMoves(end, DEALER)).toEqual([]);
  });

  it('the learner trying a dealer move, and the dealer trying a learner move', () => {
    expect(reason(s, LEARNER, 'reveal')).toBe(
      'Only the dealer can do that — the dealer’s moves happen automatically.',
    );
    expect(reason(s, DEALER, 'hit')).toMatch(/^The dealer never chooses moves/);
  });

  it('acting out of turn', () => {
    expect(reason(s, DEALER, 'reveal')).toBe(
      'The dealer waits until you’ve finished all your hands.',
    );
    const dealerTurn = play(s, 'stand');
    expect(reason(dealerTurn, LEARNER, 'stand')).toBe(
      'It’s the dealer’s turn now, not yours — watch the dealer play out their hand.',
    );
    // applyMove checks the move for the seat whose turn it is (the dealer).
    expect(() => E.applyMove(dealerTurn, mv('hit'))).toThrow(IllegalMoveError);
  });

  it('hit and stand are always fine on your turn', () => {
    expect(E.checkMove(s, LEARNER, mv('hit'))).toEqual({ ok: true });
    expect(E.checkMove(s, LEARNER, mv('stand'))).toEqual({ ok: true });
  });
});

describe('result flags', () => {
  it('a comeback needs a HARD 12–16 that drew and won', () => {
    const soft = E.result(
      finishDealer(play(deal(['AS', '2H'], ['9D', '8C'], ['5C']), 'hit', 'stand')),
    );
    expect(soft.humanNetUnits).toBe(1); // soft 18 beats 17
    expect(soft.flags.comeback).toBe(false);
    const hardLost = E.result(
      finishDealer(play(deal(['TS', '3H'], ['9D', 'TC'], ['4C']), 'hit', 'stand')),
    );
    expect(hardLost.humanNetUnits).toBe(-1);
    expect(hardLost.flags.comeback).toBe(false);
    const hardWon = E.result(
      finishDealer(play(deal(['TS', '3H'], ['9D', '8C'], ['6C']), 'hit', 'stand')),
    );
    expect(hardWon.humanNetUnits).toBe(1);
    expect(hardWon.flags.comeback).toBe(true);
  });

  it('a lucky last card needs a win: hitting into 21 and pushing does not count', () => {
    const r = E.result(finishDealer(play(deal(['TS', '6H'], ['TD', '6C'], ['5S', '5C']), 'hit')));
    expect(r.humanOutcome).toBe('push');
    expect(r.flags.luckyLastCard).toBe(false);
    expect(r.flags.comeback).toBe(false);
  });

  it('the dealer busting while you stood on 17+ is not "lucky"', () => {
    const r = E.result(finishDealer(play(deal(['TS', '7H'], ['6D', 'TC'], ['KS']), 'stand')));
    expect(r.humanNetUnits).toBe(1);
    expect(r.flags.luckyLastCard).toBe(false);
  });

  it('a plain win sets no special flags', () => {
    const r = E.result(finishDealer(play(deal(['TS', 'KH'], ['9D', '8C']), 'stand')));
    expect(r.flags).toEqual({
      comeback: false,
      closeFinish: false,
      luckyLastCard: false,
      bigPot: false,
      perfect: false,
      bust: false,
      folded: false,
      tags: [],
    });
  });

  it('result() and settleRound() refuse to run before the round is over', () => {
    const s = deal(['TS', '6H'], ['9D', '7C']);
    expect(() => E.result(s)).toThrow(/not over/);
    expect(() => settleRound(s)).toThrow(/not over/);
  });
});

describe('immutability', () => {
  it('never mutates a frozen input state, whatever the move', () => {
    const cases: [BlackjackState, MoveType][] = [
      [deal(['TS', '6H'], ['9D', '7C']), 'hit'],
      [deal(['TS', '6H'], ['9D', '7C']), 'stand'],
      [deal(['6S', '5H'], ['9D', '7C']), 'double'],
      [deal(['8S', '8H'], ['9D', '7C']), 'split'],
      [deal(['AS', 'AH'], ['9D', '7C']), 'split'],
      [play(deal(['TS', '8H'], ['9D', '7C']), 'stand'), 'reveal'],
      [play(deal(['TS', '8H'], ['9D', '7C']), 'stand', 'reveal'), 'dealer-hit'],
      [play(deal(['TS', '8H'], ['9D', '8C']), 'stand', 'reveal'), 'dealer-stand'],
    ];
    for (const [state, type] of cases) {
      const before = JSON.stringify(state);
      deepFreeze(state);
      const next = E.applyMove(state, mv(type));
      expect(JSON.stringify(state)).toBe(before);
      expect(next).not.toBe(state);
      expect(allCards(next).sort()).toEqual(allCards(state).sort());
    }
  });

  it('states are plain JSON', () => {
    const s = deal(['8S', '8H'], ['9D', '7C']);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('bots', () => {
  const rng = createRng('bots');

  it('the dealer bot always makes its single forced move', () => {
    const s = play(deal(['TS', '8H'], ['9D', '7C'], ['5S']), 'stand');
    expect(E.botMove(s, DEALER, 'easy', rng)).toEqual({ type: 'reveal' });
    expect(E.botMove(play(s, 'reveal'), DEALER, 'normal', rng)).toEqual({ type: 'dealer-hit' });
  });

  it('easy hits below 15 and stands otherwise — never doubles or splits', () => {
    expect(E.botMove(deal(['TS', '4H'], ['6D', '7C']), LEARNER, 'easy', rng)).toEqual({
      type: 'hit',
    });
    expect(E.botMove(deal(['TS', '5H'], ['TD', '7C']), LEARNER, 'easy', rng)).toEqual({
      type: 'stand',
    });
    expect(E.botMove(deal(['5S', '6H'], ['6D', '7C']), LEARNER, 'easy', rng)).toEqual({
      type: 'hit',
    });
    expect(E.botMove(deal(['8S', '8H'], ['6D', '7C']), LEARNER, 'easy', rng)).toEqual({
      type: 'stand',
    });
    expect(E.botMove(deal(['AS', '3H'], ['6D', '7C']), LEARNER, 'easy', rng)).toEqual({
      type: 'hit',
    });
  });

  it('normal plays basic strategy within what is allowed', () => {
    expect(E.botMove(deal(['5S', '6H'], ['6D', '7C']), LEARNER, 'normal', rng)).toEqual({
      type: 'double',
    });
    expect(E.botMove(deal(['8S', '8H'], ['TD', '7C']), LEARNER, 'normal', rng)).toEqual({
      type: 'split',
    });
    expect(E.botMove(deal(['TS', '2H'], ['6D', '7C']), LEARNER, 'normal', rng)).toEqual({
      type: 'stand',
    });
    expect(
      E.botMove(
        deal(['5S', '6H'], ['6D', '7C'], [], { affordableUnits: 0 }),
        LEARNER,
        'normal',
        rng,
      ),
    ).toEqual({ type: 'hit' });
    // Soft 18 vs 4 with three cards: can't double, so stand.
    const s = play(deal(['AS', '3H'], ['4D', '7C'], ['4C']), 'hit');
    expect(E.botMove(s, LEARNER, 'normal', rng)).toEqual({ type: 'stand' });
  });

  it('bot moves are always legal, even in awkward spots', () => {
    const spots = [
      deal(['AS', 'AH'], ['6D', '7C'], [], { affordableUnits: 0 }),
      play(deal(['8S', '8H'], ['6D', '7C'], ['3C', '2H'], { affordableUnits: 1 }), 'split'),
      play(deal(['8S', '8H'], ['TD', '7C'], ['8C', 'KH']), 'split'),
      play(deal(['2S', '3H'], ['TD', '9C'], ['4S', 'AC']), 'hit', 'hit'),
    ];
    for (const s of spots) {
      for (const d of ['easy', 'normal'] as const) {
        const m = E.botMove(s, LEARNER, d, rng);
        expect(E.checkMove(s, LEARNER, m)).toEqual({ ok: true });
      }
    }
  });

  it('the learner bot and the coach never peek at the hole card or the shoe', () => {
    let checked = 0;
    for (let seed = 0; seed < 400; seed++) {
      const s = E.setup({ players: 2 }, createRng(`peek-${seed}`));
      if (s.phase !== 'player') continue;
      // A different hole card (a 2 never makes Blackjack) and a reversed shoe.
      const twin: BlackjackState = {
        ...s,
        dealer: [s.dealer[0]!, '2C'],
        shoe: [...s.shoe].reverse(),
      };
      for (const d of ['easy', 'normal'] as const) {
        expect(E.botMove(twin, LEARNER, d, createRng(seed))).toEqual(
          E.botMove(s, LEARNER, d, createRng(seed)),
        );
      }
      expect(E.coach(twin, LEARNER)).toEqual(E.coach(s, LEARNER));
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('botMove refuses to move for a seat whose turn it is not', () => {
    const s = deal(['TS', '6H'], ['9D', '7C']);
    expect(() => E.botMove(s, DEALER, 'normal', rng)).toThrow(/no move/);
  });

  it('normal decisions are fast (well under a millisecond)', () => {
    const s = deal(['AS', '6H'], ['5D', '7C']);
    const t0 = performance.now();
    for (let i = 0; i < 2000; i++)
      basicStrategy(s.hands[0]!.cards, s.dealer[0]!, { canDouble: true, canSplit: false });
    for (let i = 0; i < 2000; i++) E.botMove(s, LEARNER, 'normal', rng);
    expect((performance.now() - t0) / 4000).toBeLessThan(1);
  });
});

describe('describeMove', () => {
  it('narrates the learner as "You" with the drawn card and new total', () => {
    const s = deal(['TS', '6H'], ['9D', '7C'], ['KS']);
    expect(E.describeMove(s, LEARNER, mv('hit'))).toBe(
      'You hit and drew the King of Spades, making 26 — bust!',
    );
    expect(E.describeMove(s, LEARNER, mv('stand'))).toBe('You stand on 16.');
    const soft = deal(['AS', '2H'], ['9D', '7C'], ['3C']);
    expect(E.describeMove(soft, LEARNER, mv('hit'))).toBe(
      'You hit and drew the Three of Clubs, making soft 16.',
    );
    const toTwentyOne = deal(['TS', '6H'], ['9D', '7C'], ['5C']);
    expect(E.describeMove(toTwentyOne, LEARNER, mv('hit'))).toBe(
      'You hit and drew the Five of Clubs, making 21!',
    );
    const dbl = deal(['6S', '5H'], ['6D', 'TC'], ['9S']);
    expect(E.describeMove(dbl, LEARNER, mv('double'))).toBe(
      'You doubled down and drew the Nine of Spades, making 20. Your bet is doubled and this hand is finished.',
    );
  });

  it('narrates splits and which hand is being played', () => {
    const s = deal(['8S', '8H'], ['TD', '7C'], ['3C', 'KH', '4D']);
    expect(E.describeMove(s, LEARNER, mv('split'))).toBe(
      'You split your pair of Eights into two hands: the first gets the Three of Clubs and the second gets the King of Hearts.',
    );
    const sp = play(s, 'split');
    expect(E.describeMove(sp, LEARNER, mv('hit'))).toBe(
      'You hit with your first hand and drew the Four of Diamonds, making 15.',
    );
    expect(E.describeMove(play(sp, 'stand'), LEARNER, mv('stand'))).toBe(
      'You stand on 18 with your second hand.',
    );
    expect(
      E.describeMove(deal(['AS', 'AH'], ['TD', '7C'], ['3C', 'KH']), LEARNER, mv('split')),
    ).toMatch(/pair of Aces .* Split Aces get just one card each\.$/);
    expect(
      E.describeMove(deal(['KS', 'QH'], ['TD', '7C'], ['3C', 'KH']), LEARNER, mv('split')),
    ).toMatch(/^You split your King and Queen into two hands/);
    expect(
      E.describeMove(deal(['6S', '6H'], ['TD', '7C'], ['3C', 'KH']), LEARNER, mv('split')),
    ).toMatch(/pair of Sixes/);
  });

  it('narrates the dealer as "Player 1" so the UI can swap in the persona name', () => {
    let s = play(deal(['TS', '8H'], ['9D', '7C'], ['5S']), 'stand');
    expect(E.describeMove(s, DEALER, mv('reveal'))).toBe(
      'Player 1 turns over the hole card: the Seven of Clubs. Player 1 has 16.',
    );
    s = play(s, 'reveal');
    expect(E.describeMove(s, DEALER, mv('dealer-hit'))).toBe(
      'Player 1 draws the Five of Spades, making 21!',
    );
    s = play(s, 'dealer-hit');
    expect(E.describeMove(s, DEALER, mv('dealer-stand'))).toBe('Player 1 stands on 21.');
    const bj = deal(['TS', '8H'], ['AD', 'KC']);
    expect(E.describeMove(bj, DEALER, mv('reveal'))).toBe(
      'Player 1 turns over the hole card: the King of Clubs. Player 1 has Blackjack!',
    );
    const soft = play(deal(['TS', '8H'], ['AD', '6C']), 'stand', 'reveal');
    expect(E.describeMove(soft, DEALER, mv('dealer-stand'))).toBe('Player 1 stands on soft 17.');
  });

  it('never names the hole card before it is revealed', () => {
    const s = deal(['8S', '8H'], ['TD', 'QC'], ['3C', 'KH', '4D']);
    const hole = cardName(s.dealer[1]!);
    for (const t of LEARNER_MOVE_TYPES) {
      expect(E.describeMove(s, LEARNER, mv(t))).not.toContain(hole);
    }
  });

  it('describes moves that are not allowed without applying them', () => {
    const s = play(deal(['2S', '3H'], ['TD', '9C'], ['4S']), 'hit');
    expect(E.describeMove(s, LEARNER, mv('double'))).toBe('You can’t double down right now.');
    expect(E.describeMove(s, DEALER, mv('reveal'))).toBe(
      'Player 1 can’t turn over the hole card right now.',
    );
    expect(E.describeMove(s, LEARNER, { type: 'insure' } as unknown as BlackjackMove)).toBe(
      'That isn’t a Blackjack move.',
    );
  });
});

describe('coach', () => {
  it('describes the spot, suggests the basic-strategy move and explains why', () => {
    const s = deal(['TS', '2H'], ['6D', '7C']);
    const advice = E.coach(s, LEARNER);
    expect(advice.situation).toBe(
      'You have hard 12 (10 + 2). The dealer shows a 6. You can hit, stand or double down.',
    );
    expect(advice.suggestion).toEqual({ type: 'stand' });
    expect(advice.why).toBe(
      'Dealer shows a 6 — a weak card. Dealers bust a lot from 6, so stand on 12+ and let them bust.',
    );
  });

  it('lists exactly the legal moves and names split hands', () => {
    const s = deal(['8S', '8H'], ['TD', '7C'], ['3C', 'KH']);
    expect(E.coach(s, LEARNER).situation).toMatch(/You can hit, stand, double down or split\.$/);
    expect(E.coach(s, LEARNER).situation).toMatch(/a 10 and has already checked: no Blackjack/);
    const sp = play(s, 'split');
    expect(E.coach(sp, LEARNER).situation).toMatch(
      /^You’re playing your first of two hands\. You have 11 \(8 \+ 3\)/,
    );
  });

  it('suggestions are always legal and match the normal bot', () => {
    for (let seed = 0; seed < 300; seed++) {
      const s = E.setup({ players: 2, affordableUnits: seed % 3 }, createRng(`coach-${seed}`));
      if (s.phase !== 'player') continue;
      const advice = E.coach(s, LEARNER);
      const suggestion = advice.suggestion as BlackjackMove;
      expect(E.checkMove(s, LEARNER, suggestion).ok).toBe(true);
      expect(suggestion).toEqual(E.botMove(s, LEARNER, 'normal', createRng(1)));
      expect(advice.why).toBeTruthy();
    }
  });

  it('while the dealer plays it explains the dealer rules without spoiling the hole card', () => {
    let s = play(deal(['TS', '8H'], ['9D', '7C'], ['5S']), 'stand');
    const watching = E.coach(s, LEARNER);
    expect(watching.suggestion).toBeUndefined();
    expect(watching.situation).toMatch(/turns over the face-down hole card/);
    expect(watching.situation).not.toMatch(/Seven|has 16|dealer has/);
    const dealerView = E.coach(s, DEALER);
    expect(dealerView.suggestion).toEqual({ type: 'reveal' });
    s = play(s, 'reveal');
    expect(E.coach(s, LEARNER).situation).toBe(
      'The dealer has hard 16. Dealers must take a card on 16 or less, so the dealer draws.',
    );
    s = play(s, 'dealer-hit');
    expect(E.coach(s, LEARNER).situation).toMatch(/must stand — dealers stand on 17 or more/);
    expect(E.coach(deal(['TS', '8H'], ['9D', '7C']), DEALER).situation).toMatch(/waits/);
  });

  it('explains early endings: learner Blackjack, dealer Blackjack, bust', () => {
    // A 2–9 upcard can't hide a Blackjack, so there is nothing to hedge about.
    expect(E.coach(deal(['AS', 'KH'], ['7C', '9D']), LEARNER).situation).toBe(
      'You have Blackjack! A dealer 7 can’t make Blackjack, so you win 3 to 2. The dealer just turns over the hole card.',
    );
    // Under an Ace or a 10 the peek has already told everyone.
    expect(E.coach(deal(['AS', 'KH'], ['AD', '9D']), LEARNER).situation).toBe(
      'You have Blackjack! The dealer peeked under the Ace and has no Blackjack, so you win 3 to 2. The dealer just turns over the hole card.',
    );
    expect(E.coach(deal(['AS', 'KH'], ['TD', 'AC']), LEARNER).situation).toBe(
      'You have Blackjack — but the dealer peeked under the 10 and has one too, so it’s a push and your bet comes back.',
    );
    expect(E.coach(deal(['TS', 'QH'], ['AD', 'KC']), LEARNER).situation).toMatch(
      /dealer has Blackjack/,
    );
    const bust = play(deal(['TS', '6H'], ['9D', '7C'], ['KS']), 'hit');
    expect(E.coach(bust, LEARNER).situation).toMatch(/went over 21/);
  });

  it('after the round it repeats the summary; unknown seats get a polite note', () => {
    const end = finishDealer(play(deal(['TS', '8H'], ['9D', '8C']), 'stand'));
    expect(E.coach(end, LEARNER)).toEqual({ situation: E.result(end).summary });
    expect(E.coach(deal(['TS', '8H'], ['9D', '8C']), 4).situation).toMatch(/no Player 4/);
  });

  it('activeHand is only defined while the learner is deciding', () => {
    const s = deal(['TS', '8H'], ['9D', '8C']);
    expect(activeHand(s)).toBe(s.hands[0]);
    expect(activeHand(play(s, 'stand'))).toBeUndefined();
  });
});

describe('curated seeds (used by the practice hand and deterministic E2E tests)', () => {
  const dealSeed = (seed: number) => E.setup({ players: 2 }, createRng(seed));
  const standAndFinish = (s: BlackjackState) => finishDealer(play(s, 'stand'));

  it('seed 183: hard 12 against a dealer 6 — the coach says stand, and the dealer busts', () => {
    const s = dealSeed(183);
    expect(s.hands[0]!.cards).toEqual(['7S', '5S']);
    expect(s.dealer[0]).toBe('6S');
    expect(E.coach(s, LEARNER).suggestion).toEqual({ type: 'stand' });
    const r = E.result(standAndFinish(s));
    expect(r.humanNetUnits).toBe(1);
    expect(r.flags.luckyLastCard).toBe(true);
  });

  it('seed 10: a learner Blackjack (forced win); seed 3: a dealer Blackjack (forced loss)', () => {
    expect(E.result(play(dealSeed(10), 'reveal')).humanNetUnits).toBe(1.5);
    expect(E.result(play(dealSeed(3), 'reveal')).humanNetUnits).toBe(-1);
  });

  it('seed 1: standing wins; seed 2: standing loses', () => {
    expect(E.result(standAndFinish(dealSeed(1))).humanOutcome).toBe('win');
    expect(E.result(standAndFinish(dealSeed(2))).humanOutcome).toBe('loss');
  });
});
